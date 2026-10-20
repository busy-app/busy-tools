// Unit tests for the package manager detection and its commands, against the built dist/.

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { argsSeparator, ciSetup, detectPackageManager, isYarnBerry, runCommand } from '../dist/packageManager.js'

/** User agents in the format each package manager sets them. */
const AGENTS = {
  npm: 'npm/11.13.0 node/v24.16.0 darwin arm64 workspaces/false',
  pnpm: 'pnpm/11.4.0 npm/? node/v24.16.0 darwin arm64',
  yarn1: 'yarn/1.22.22 npm/? node/v24.16.0 darwin arm64',
  yarn4: 'yarn/4.9.1 npm/? node/v24.16.0 darwin arm64',
  bun: 'bun/1.2.2 npm/? node/v22.6.0 darwin arm64',
  deno: 'deno/2.1.4 npm/? deno/2.1.4 darwin aarch64',
}

describe('detectPackageManager', () => {
  test('takes the package manager that launched the generator, with its version', () => {
    assert.deepEqual(detectPackageManager(AGENTS.npm), { pm: 'npm', version: '11.13.0' })
    assert.deepEqual(detectPackageManager(AGENTS.pnpm), { pm: 'pnpm', version: '11.4.0' })
    assert.deepEqual(detectPackageManager(AGENTS.yarn1), { pm: 'yarn', version: '1.22.22' })
    assert.deepEqual(detectPackageManager(AGENTS.yarn4), { pm: 'yarn', version: '4.9.1' })
    assert.deepEqual(detectPackageManager(AGENTS.bun), { pm: 'bun', version: '1.2.2' })
  })

  test('drops a version that is not x.y.z', () => {
    assert.deepEqual(detectPackageManager('pnpm/? node/v24'), { pm: 'pnpm', version: undefined })
    assert.deepEqual(detectPackageManager('pnpm'), { pm: 'pnpm', version: undefined })
  })

  test('falls back to npm for none or one it does not support', () => {
    for (const agent of [undefined, '', '  ', AGENTS.deno]) {
      assert.deepEqual(detectPackageManager(agent), { pm: 'npm', version: undefined }, String(agent))
    }
  })
})

describe('isYarnBerry', () => {
  test('tells Yarn 2+ from Yarn 1', () => {
    assert.equal(isYarnBerry('4.9.1'), true)
    assert.equal(isYarnBerry('2.0.0'), true)
    assert.equal(isYarnBerry('1.22.22'), false)
    assert.equal(isYarnBerry(undefined), false)
  })
})

describe('commands', () => {
  test('runs a script the way each package manager spells it', () => {
    assert.equal(runCommand('npm'), 'npm run')
    assert.equal(runCommand('pnpm'), 'pnpm')
    assert.equal(runCommand('yarn'), 'yarn')
    // `bun build` is Bun's bundler, not the script.
    assert.equal(runCommand('bun'), 'bun run')
  })

  test('separates the options from the script only for npm', () => {
    assert.equal(argsSeparator('npm'), ' --')
    for (const pm of ['pnpm', 'yarn', 'bun']) assert.equal(argsSeparator(pm), '', pm)
  })
})

describe('ciSetup', () => {
  test('installs from the lockfile', () => {
    assert.match(ciSetup('npm', '11.13.0'), /- run: npm ci$/m)
    assert.match(ciSetup('pnpm', '11.4.0'), /- run: pnpm install --frozen-lockfile$/m)
    assert.match(ciSetup('yarn', '1.22.22'), /- run: yarn install --frozen-lockfile$/m)
    assert.match(ciSetup('yarn', '4.9.1'), /- run: yarn install --immutable$/m)
    assert.match(ciSetup('bun', '1.2.2'), /- run: bun install --frozen-lockfile$/m)
  })

  test('sets up the package manager before installing', () => {
    assert.match(ciSetup('pnpm', '11.4.0'), /pnpm\/action-setup@v4[\s\S]*cache: pnpm/)
    assert.match(ciSetup('bun', '1.2.2'), /oven-sh\/setup-bun@v2/)
    // Only Yarn 2+ needs Corepack; the runner's own Yarn is 1.x.
    assert.match(ciSetup('yarn', '4.9.1'), /- run: corepack enable/)
    assert.doesNotMatch(ciSetup('yarn', '1.22.22'), /corepack/)
  })

  test('indents every step under steps:', () => {
    for (const line of ciSetup('pnpm', '11.4.0').split('\n')) {
      if (line) assert.match(line, /^ {6}\S|^ {8,}\S/, line)
    }
  })
})
