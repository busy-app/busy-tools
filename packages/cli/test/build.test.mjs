// End-to-end check of `busy-cli build`: runs the built CLI on a copy of test/fixtures/app and looks at what it leaves.

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, describe, test } from 'node:test'

const CLI = fileURLToPath(new URL('../dist/index.js', import.meta.url))
const FIXTURE = fileURLToPath(new URL('fixtures/app', import.meta.url))

const APP_ID = 'app.example.fixture'

/** Files the built package must contain. */
const EXPECTED = ['appmeta/manifest.json', 'scripts/main.js']
/** Project files that must never be packaged as app resources. */
const FORBIDDEN = ['resources/package.json', 'resources/README.md', 'resources/tsconfig.json']

/** Runs `busy-cli build` in `dir`, raising an error that carries the CLI's own output. */
function build(dir, args = []) {
  try {
    return execFileSync(process.execPath, [CLI, 'build', ...args], { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  } catch (err) {
    const output = [err.stdout, err.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`busy-cli build ${args.join(' ')} failed\n${output}`)
  }
}

/** The entries of the archive, one path per line. */
const listing = (archive) => execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' })

describe('busy-cli build', () => {
  let work
  let count = 0

  before(() => {
    work = mkdtempSync(resolve(tmpdir(), 'busy-cli-build-'))
  })

  after(() => {
    rmSync(work, { recursive: true, force: true })
  })

  /** A fresh copy of the fixture, so no test sees what another one added or built. */
  const app = () => {
    const dir = resolve(work, `app-${++count}`)
    cpSync(FIXTURE, dir, { recursive: true })
    return dir
  }

  test('builds only the tgz by default', () => {
    const dir = app()
    build(dir)
    const dist = resolve(dir, 'dist')

    assert.deepEqual(readdirSync(dist), [`${APP_ID}.tgz`])
    // The archive holds the <id>/ folder itself, ready to unpack as-is.
    const entries = listing(resolve(dist, `${APP_ID}.tgz`))
    assert.match(entries, new RegExp(`^${APP_ID}/appmeta/manifest\\.json$`, 'm'))
    assert.match(entries, new RegExp(`^${APP_ID}/scripts/main\\.js$`, 'm'))
  })

  test('builds only the folder with --emit dir', () => {
    const dir = app()
    build(dir, ['--emit', 'dir'])
    assert.deepEqual(readdirSync(resolve(dir, 'dist')), [APP_ID])

    // The package folder is named after the manifest id.
    const pkg = resolve(dir, 'dist', APP_ID)
    for (const file of EXPECTED) assert.ok(existsSync(resolve(pkg, file)), `dist/${file} is missing`)
    for (const file of FORBIDDEN) assert.ok(!existsSync(resolve(pkg, file)), `dist/${file} should not be packaged`)
    // Only the app's own modules get a file of their own, and this one has none.
    assert.deepEqual(readdirSync(resolve(pkg, 'scripts')), ['main.js'])
  })

  test('builds the folder and the tgz with --emit both', () => {
    const dir = app()
    build(dir, ['--emit', 'both'])
    assert.deepEqual(readdirSync(resolve(dir, 'dist')).sort(), [APP_ID, `${APP_ID}.tgz`])
    assert.ok(existsSync(resolve(dir, 'dist', APP_ID, 'scripts/main.js')), '--emit both dropped the folder')
  })

  test('rejects an unknown --emit', () => {
    assert.throws(() => build(app(), ['--emit', 'zip']), /--emit needs one of tgz, dir, both, not zip/)
  })

  test('points the removed --tgz and --tgz-only to --emit', () => {
    const dir = app()
    assert.throws(() => build(dir, ['--tgz']), /--tgz was replaced by --emit both/)
    assert.throws(() => build(dir, ['--tgz-only']), /--tgz-only is now the default/)
  })

  test('names the tgz with --tgz-name', () => {
    const dir = app()
    build(dir, ['--tgz-name', '{id}-{version}.tgz'])
    const archive = resolve(dir, 'dist', `${APP_ID}-0.1.0.tgz`)

    assert.ok(existsSync(archive), 'the named archive is missing')
    // The name changes, the folder inside does not.
    assert.match(listing(archive), new RegExp(`^${APP_ID}/scripts/main\\.js$`, 'm'))
  })

  test('rejects --tgz-name with --emit dir, which makes no archive', () => {
    assert.throws(() => build(app(), ['--emit', 'dir', '--tgz-name', 'x.tgz']), /--emit dir makes none/)
  })

  test('redirects the build with --out', () => {
    const dir = app()
    build(dir, ['--out', '../elsewhere'])
    assert.ok(existsSync(resolve(dir, '../elsewhere', `${APP_ID}.tgz`)), '--out did not redirect the build')
  })

  test('packages resources', () => {
    // A file in src/images/ lands in the package's images/; one loose in src/ is sorted by extension into the same place.
    const dir = app()
    mkdirSync(resolve(dir, 'src/images'))
    writeFileSync(resolve(dir, 'src/images/icon.png'), '')
    writeFileSync(resolve(dir, 'src/loose.png'), '')
    build(dir, ['--emit', 'dir'])
    for (const file of ['images/icon.png', 'images/loose.png']) {
      assert.ok(existsSync(resolve(dir, 'dist', APP_ID, file)), `${file} is missing`)
    }
  })

  test('gives each app module its own chunk', () => {
    // Modules beside main.ts and in subfolders, each expected to be split out. Functions rather than constants: a lone constant is inlined and its chunk disappears.
    //
    // The two format.ts check that chunks named after the module's path under src/ keep same-named modules apart.
    const dir = app()
    mkdirSync(resolve(dir, 'src/lib'))
    mkdirSync(resolve(dir, 'src/other'))
    writeFileSync(resolve(dir, 'src/greeting.ts'), 'export function greeting(n: number): string {\n  return `Hi ${n}`;\n}\n')
    writeFileSync(resolve(dir, 'src/lib/format.ts'), 'export function pad(n: number): string {\n  return String(n).padStart(2, "0");\n}\n')
    writeFileSync(resolve(dir, 'src/other/format.ts'), 'export function wrap(s: string): string {\n  return `[${s}]`.repeat(1);\n}\n')
    writeFileSync(
      resolve(dir, 'src/main.ts'),
      'import { greeting } from "./greeting.ts";\n' +
        'import { pad } from "./lib/format.ts";\n' +
        'import { wrap } from "./other/format.ts";\n\n' +
        'function main(): void {\n  console.log(wrap(greeting(Date.now())) + pad(Date.now()));\n}\n\nmain();\n',
    )

    build(dir, ['--emit', 'dir'])
    const scripts = resolve(dir, 'dist', APP_ID, 'scripts')
    assert.deepEqual(readdirSync(scripts).sort(), ['greeting.js', 'lib-format.js', 'main.js', 'other-format.js'])
    // Same name, different folders: the two must not be merged.
    assert.match(readFileSync(resolve(scripts, 'lib-format.js'), 'utf8'), /padStart/, 'lib-format.js lost its module')
  })

  test('rejects an export in the entry', () => {
    const dir = app()
    const main = resolve(dir, 'src/main.ts')
    writeFileSync(main, readFileSync(main, 'utf8').replace('function main()', 'export default function main()'))
    assert.throws(() => build(dir), /must not export anything/)
  })
})
