#!/usr/bin/env node
// Scaffolds a BUSY Bar JS app from template/.
//
//   npm create @busy-app/app [directory] [options]
//
// Asks for the app's author, id, name, description and API version, copies the template with those substituted, initializes a git repository and installs the dependencies with the package manager that launched it. Every prompt has a flag; anything not passed is asked for.

import { execFileSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { argsSeparator, ciSetup, detectPackageManager, isYarnBerry, runCommand } from './packageManager.js'

// Relative to dist/, where this file lands; template/ stays at the package root.
const TEMPLATE = fileURLToPath(new URL('../template', import.meta.url))

const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { name: string; version: string }
const VERSION = `${PKG.name} ${PKG.version}`

/** Files npm strips or misreads inside a published package. */
const RENAME = new Map([['_gitignore', '.gitignore']])
/** Files carrying {{placeholders}}; the suffix is dropped on copy. */
const TPL_SUFFIX = '.tpl'

const wrap = (code: number) => (s: string) => `\x1b[${code}m${s}\x1b[0m`

const c = {
  bold: wrap(1),
  dim: wrap(2),
  green: wrap(32),
  red: wrap(31),
}

/** The id the app is known by, e.g. `app.jane_doe.my_app`; the same check as js_app_is_valid_id in the firmware. */
const ID_RE = /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,31}$/
/** Longest id the manifest accepts. */
const ID_MAX = 32
/** One part of an id between dots. */
const SEGMENT_RE = /^[a-zA-Z0-9_-]+$/

/** The minimum BUSY Bar HTTP API version a new app asks for by default. */
const API_VERSION = '27.12.0'
const API_VERSION_RE = /^\d+\.\d+\.\d+$/

/** The namespace segment used when the author's name gives none; meant to be replaced before publishing. */
const PLACEHOLDER = 'example'
/** The app segment used when the folder name gives none. */
const APP_PLACEHOLDER = 'app'

/** Lowercases a name and turns every run of whitespace into an underscore, keeping every other character: "My-App 2" → "my-app_2". */
function slugify(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '_')
}

/** Turns a folder name and the author into an app id: "My App" by "Jane Doe" → "app.jane_doe.my_app". */
function suggestId(dirName: string, author: string): string {
  const slug = slugify(dirName)
  // A dotted name is already an id.
  if (slug.includes('.') && ID_RE.test(slug)) return slug

  // A part the firmware would reject gives way to its placeholder; the other part stays.
  const app = SEGMENT_RE.test(slug) ? slug : APP_PLACEHOLDER
  const namespace = slugify(author)
  const id = `app.${SEGMENT_RE.test(namespace) ? namespace : PLACEHOLDER}.${app}`
  // An author too long to fit leaves the placeholder too.
  return id.length > ID_MAX ? `app.${PLACEHOLDER}.${app}` : id
}

/**
 * The folder name as an npm package name: lowercase, no leading dot or dash.
 * The app is private, but package.json still needs a name npm accepts.
 */
function packageNameFor(dirName: string): string {
  const slug = basename(dirName)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+/, '')
    .replace(/-+$/, '')
  return slug || 'app'
}

/** "app.jane_doe.my_app" → "My app". */
function suggestName(appId: string): string {
  const tail = appId.split('.').pop() ?? appId
  const words = tail.replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** One flag per prompt. */
const OPTIONS = {
  dir: { type: 'string' },
  id: { type: 'string' },
  name: { type: 'string' },
  description: { type: 'string' },
  author: { type: 'string' },
  'api-version': { type: 'string' },
  'no-git': { type: 'boolean' },
  'no-install': { type: 'boolean' },
  version: { type: 'boolean', short: 'v' },
  help: { type: 'boolean', short: 'h' },
} as const

const USAGE = `
${VERSION}

Usage: busy-create-app [directory] [options]

Options:
  --dir <name>          the directory to create, if not given as an argument
  --author <name>       author
  --id <id>             app id, e.g. app.jane_doe.my_app
  --name <name>         display name
  --description <text>  one-line description
  --api-version <x.y.z> minimum BUSY Bar HTTP API version the app needs (default: ${API_VERSION})
  --no-git              skip git init
  --no-install          skip installing dependencies
  -v, --version         show the version
  -h, --help            show help

Anything not passed is asked for at the prompt. The dependencies are installed with the package manager that launched the generator (npm create, pnpm create, yarn create, bun create), or npm.
`

/** Parses argv; a bad flag ends the run. */
function parseOptions(argv: string[]) {
  try {
    const { values, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true })
    // The directory can come as a positional or as --dir.
    return { ...values, dir: positionals[0] ?? values.dir }
  } catch (err) {
    throw new Error(`${err instanceof Error ? err.message : String(err)}\n${USAGE}`)
  }
}

/** The git user's name, when there is one. */
function gitAuthor() {
  try {
    return execFileSync('git', ['config', 'user.name'], { encoding: 'utf8' }).trim() || undefined
  } catch {
    return undefined
  }
}

/** What the template's {{placeholders}} are filled with. */
type Values = {
  appId: string
  appName: string
  description: string
  author: string
  packageName: string
  apiVersion: string
  /** The package manager itself, as in `pnpm install`. */
  pm: string
  /** The prefix that runs a script, as in `npm run build`. */
  run: string
  /** Put after a script name that is followed by options: ` --` for npm, nothing for the rest. */
  argsSep: string
  /** The CI steps that install the dependencies. */
  ciSetup: string
}

/** Keeps Yarn 2+ from switching the app to Plug'n'Play, which leaves no node_modules for the build tools to resolve from. */
const YARNRC = `# Dependencies go into node_modules, where the build tools look for them, instead of Yarn 2+'s Plug'n'Play. Yarn 1 ignores this file.
nodeLinker: node-modules
`

/** Substitutes {{placeholders}}; an unknown one throws. */
function fill(text: string, values: Values): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    if (!(key in values)) throw new Error(`template placeholder {{${key}}} has no value`)
    return values[key as keyof Values]
  })
}

/** Copies template/ into the target, renaming and filling as it goes. */
function copyTemplate(srcDir: string, destDir: string, values: Values): void {
  mkdirSync(destDir, { recursive: true })

  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const src = resolve(srcDir, entry.name)
    const name = RENAME.get(entry.name) ?? entry.name

    if (entry.isDirectory()) {
      copyTemplate(src, resolve(destDir, name), values)
      continue
    }

    if (name.endsWith(TPL_SUFFIX)) {
      const out = resolve(destDir, name.slice(0, -TPL_SUFFIX.length))
      writeFileSync(out, fill(readFileSync(src, 'utf8'), values))
      continue
    }

    cpSync(src, resolve(destDir, name))
  }
}

/** Checks the target is writable: absent, or an empty directory. */
function checkTarget(dir: string): string | null {
  if (!existsSync(dir)) return null
  if (!statSync(dir).isDirectory()) return `${dir} exists and is not a directory`
  const entries = readdirSync(dir).filter((n) => n !== '.git' && n !== '.DS_Store')
  return entries.length > 0 ? `${dir} is not empty` : null
}

async function main() {
  const opts = parseOptions(process.argv.slice(2))
  if (opts.help) {
    console.log(USAGE)
    return
  }
  if (opts.version) {
    console.log(VERSION)
    return
  }

  // A line iterator rather than readline/promises: question() resolves only once when stdin is a pipe, which breaks piped and CI runs.
  const rl = createInterface({ input: process.stdin })
  const lines = rl[Symbol.asyncIterator]()

  /**
   * A value for one field. A flag answers it, still validated; otherwise it is asked for, and Enter (or end of input) takes the default.
   */
  type Field = {
    /** The flag that answers this prompt without asking. */
    option: 'dir' | 'id' | 'name' | 'description' | 'author' | 'api-version'
    fallback?: string | undefined
    validate?: ((value: string) => string | null) | undefined
  }

  const ask = async (question: string, { option, fallback, validate }: Field): Promise<string> => {
    const flag = opts[option]
    if (typeof flag === 'string') {
      const error = validate?.(flag)
      if (error) throw new Error(`--${option}: ${error}`)
      return flag
    }

    for (;;) {
      const shown = fallback ? ` ${c.dim(`(${fallback})`)}` : ''
      process.stdout.write(`${question}${shown}: `)

      const line = await lines.next()
      if (line.done) process.stdout.write('\n')
      const answer = (line.done ? '' : line.value.trim()) || fallback || ''

      const error = validate?.(answer)
      if (!error) return answer

      // End of input: there is no chance to correct the answer.
      if (line.done) throw new Error(`${question}: ${error}`)
      console.log(c.red(`  ${error}`))
    }
  }

  console.log(`\n${c.dim(VERSION)}\n\n${c.bold('Creating a BUSY Bar JS app')}\n`)

  const dirName = await ask('Directory', {
    option: 'dir',
    fallback: 'my-app',
    validate: (v) => (v ? checkTarget(resolve(process.cwd(), v)) : 'a directory is required'),
  })
  const target = resolve(process.cwd(), dirName)

  // Asked for before the id, which defaults to a namespace made from it.
  const author = await ask('Author', {
    option: 'author',
    fallback: gitAuthor(),
    validate: (v) => (v ? null : 'an author is required'),
  })
  const appId = await ask('App id', {
    option: 'id',
    fallback: suggestId(basename(target), author),
    validate: (v) => {
      if (v.length > ID_MAX) return `at most ${ID_MAX} characters, this one is ${v.length}`
      if (!ID_RE.test(v)) return `only Latin letters, digits, underscore, dash and dot, not starting with a dot, at most ${ID_MAX} characters`
      return null
    },
  })
  const appName = await ask('Display name', {
    option: 'name',
    fallback: suggestName(appId),
    validate: (v) => (v ? null : 'a name is required'),
  })
  const description = await ask('Description', {
    option: 'description',
    fallback: appName,
  })
  const apiVersion = await ask('API version', {
    option: 'api-version',
    fallback: API_VERSION,
    validate: (v) => (API_VERSION_RE.test(v) ? null : `expected x.y.z, e.g. ${API_VERSION}`),
  })
  // Not asked for: the app is private, so the folder name will do.
  const packageName = packageNameFor(dirName)

  rl.close()

  const { pm, version: pmVersion } = detectPackageManager(process.env.npm_config_user_agent)
  const runCmd = runCommand(pm)

  // Undo a copy that fails partway, rather than leave a half-written app.
  const preexisting = existsSync(target)
  try {
    copyTemplate(TEMPLATE, target, {
      appId,
      appName,
      description,
      author,
      packageName,
      apiVersion,
      pm,
      run: runCmd,
      argsSep: argsSeparator(pm),
      ciSetup: ciSetup(pm, pmVersion),
    })

    if (pm === 'yarn') {
      writeFileSync(resolve(target, '.yarnrc.yml'), YARNRC)
      // Marks the app as a project of its own, so Yarn 2+ does not refuse to install it inside another one.
      writeFileSync(resolve(target, 'yarn.lock'), '')
    }

    // Yarn 1 and 2+ answer to the same yarn command, and the CI runner defaults to 1.x: this field tells Corepack which version generated the lockfile.
    if (pm === 'yarn' && isYarnBerry(pmVersion)) {
      const pkgPath = resolve(target, 'package.json')
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>
      pkg.packageManager = `yarn@${pmVersion}`
      writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
    }
  } catch (err) {
    if (!preexisting) rmSync(target, { recursive: true, force: true })
    throw err
  }

  let git = false
  if (!opts['no-git']) {
    try {
      execFileSync('git', ['init', '--quiet'], { cwd: target, stdio: 'ignore' })
      git = true
    } catch {
      // git is optional; the app works without it.
    }
  }

  console.log(`\n${c.green('✔')} Created ${c.bold(appId)} in ${target}${git ? '' : c.dim(' (no git)')}`)

  let installed = false
  if (!opts['no-install']) {
    console.log(`\nInstalling dependencies with ${pm}\n`)
    try {
      execFileSync(pm, ['install'], { cwd: target, stdio: ['ignore', 'inherit', 'inherit'] })
      installed = true
    } catch {
      // The app is complete without its dependencies; the hint below leaves the install to the user.
      console.log(c.red(`\n✖ ${pm} install failed, run it again once the cause is fixed`))
    }
  }

  const where = dirName === '.' ? '' : `cd ${dirName}\n  `
  console.log(`\nNext:\n\n  ${where}${installed ? '' : `${pm} install\n  `}${runCmd} build\n`)

  return target
}

main().catch((err) => {
  console.error(c.red(`\n✖ ${err instanceof Error ? err.message : String(err)}`))
  process.exitCode = 1
})
