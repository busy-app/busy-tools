// The commands suggested in messages: runnable from a package.json script, where busy-cli is not on PATH, and as they are otherwise.

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { after, describe, test } from 'node:test'

import { buildHint, rerunHint } from '../dist/lib/hints.js'

/** The environment a package manager sets for a script, e.g. `pnpm app:install`. */
const script = (pm, name) => ({ npm_lifecycle_event: name, npm_config_user_agent: `${pm}/1.0.0 npm/? node/v24.16.0 darwin arm64` })

const work = mkdtempSync(resolve(tmpdir(), 'busy-cli-hints-'))
after(() => rmSync(work, { recursive: true, force: true }))

let count = 0
/** A project folder whose package.json has the given scripts, or none at all for null. */
function project(scripts) {
  const dir = resolve(work, `p${++count}`)
  mkdirSync(dir)
  if (scripts !== null) writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ scripts }))
  return dir
}

describe('buildHint', () => {
  test('names the script that runs busy-cli build, whatever it is called', () => {
    const dir = project({ 'app/build': 'busy-cli build', 'app/install': 'busy-cli app install' })
    assert.equal(buildHint(dir, script('pnpm', 'app/install')), 'pnpm app/build')
    assert.equal(buildHint(dir, script('npm', 'app/install')), 'npm run app/build')
    assert.equal(buildHint(dir, script('yarn', 'app/install')), 'yarn app/build')
    assert.equal(buildHint(dir, script('bun', 'app/install')), 'bun run app/build')
  })

  test('prefers the script with no options', () => {
    const dir = project({ 'build/debug': 'busy-cli build --no-minify', build: 'busy-cli build' })
    assert.equal(buildHint(dir, script('pnpm', 'app:install')), 'pnpm build')
  })

  test('takes a script with options when there is no other', () => {
    const dir = project({ pack: 'busy-cli build --emit both' })
    assert.equal(buildHint(dir, script('pnpm', 'app:install')), 'pnpm pack')
  })

  test('runs the binary through the package manager without such a script', () => {
    const dir = project({ start: 'vite' })
    assert.equal(buildHint(dir, script('npm', 'x')), 'npx busy-cli build')
    assert.equal(buildHint(dir, script('pnpm', 'x')), 'pnpm exec busy-cli build')
    assert.equal(buildHint(dir, script('yarn', 'x')), 'yarn busy-cli build')
    assert.equal(buildHint(dir, script('bun', 'x')), 'bunx busy-cli build')
    assert.equal(buildHint(project(null), script('pnpm', 'x')), 'pnpm exec busy-cli build')
  })

  test('keeps busy-cli build outside a script', () => {
    const dir = project({ build: 'busy-cli build' })
    assert.equal(buildHint(dir, {}), 'busy-cli build')
    // npx sets a user agent, but runs no script.
    assert.equal(buildHint(dir, { npm_config_user_agent: 'npm/11.0.0 node/v24' }), 'busy-cli build')
    // A package manager the CLI does not know.
    assert.equal(buildHint(dir, script('deno', 'app:install')), 'busy-cli build')
  })
})

describe('rerunHint', () => {
  test('runs the same script again', () => {
    assert.equal(rerunHint('busy-cli app install', script('pnpm', 'app/install')), 'pnpm app/install')
    assert.equal(rerunHint('busy-cli app install', script('npm', 'app:install')), 'npm run app:install')
  })

  test('keeps the command outside a script', () => {
    assert.equal(rerunHint('busy-cli app install', {}), 'busy-cli app install')
  })
})
