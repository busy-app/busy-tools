// Unit tests for how `busy-cli create` picks the package manager and launches the generator, against the built dist/.

import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { createCommandLine, takePackageManager } from '../dist/lib/packageManager.js'

describe('takePackageManager', () => {
  test('takes the flag in either form, leaving the rest for the generator', () => {
    assert.deepEqual(takePackageManager(['my-app', '--package-manager', 'yarn', '--no-git']), { value: 'yarn', rest: ['my-app', '--no-git'] })
    assert.deepEqual(takePackageManager(['my-app', '--package-manager=bun']), { value: 'bun', rest: ['my-app'] })
  })

  test('leaves the arguments alone without the flag', () => {
    assert.deepEqual(takePackageManager(['my-app', '--no-git']), { rest: ['my-app', '--no-git'] })
  })

  test('passes an unknown name through unchecked', () => {
    assert.deepEqual(takePackageManager(['--package-manager', 'pnmp']), { value: 'pnmp', rest: [] })
  })

  test('rejects the flag without a value', () => {
    assert.throws(() => takePackageManager(['--package-manager']), /needs one of/)
    assert.throws(() => takePackageManager(['--package-manager', '--no-git']), /needs one of/)
    assert.throws(() => takePackageManager(['--package-manager=']), /needs one of/)
  })
})

describe('createCommandLine', () => {
  test('puts the generator options after -- for npm only', () => {
    assert.deepEqual(createCommandLine('npm', ['my-app', '--no-git']), ['create', '@busy-app/app', '--', 'my-app', '--no-git'])
    assert.deepEqual(createCommandLine('npm', []), ['create', '@busy-app/app'])
    for (const pm of ['pnpm', 'yarn', 'bun']) {
      assert.deepEqual(createCommandLine(pm, ['my-app', '--no-git']), ['create', '@busy-app/app', 'my-app', '--no-git'], pm)
    }
  })
})
