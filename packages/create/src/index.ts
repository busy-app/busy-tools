#!/usr/bin/env node
// Scaffolds a BUSY Bar JS app from template/.
//
//   pnpm create @busy-app/app [directory] [options]
//
// Asks for the app's id, name, description and author, copies the template with those substituted, and initializes a git repository. Every prompt has a flag; anything not passed is asked for.

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

// Relative to dist/, where this file lands; template/ stays at the package root.
const TEMPLATE = fileURLToPath(new URL('../template', import.meta.url))

/** Files npm strips or misreads inside a published package. */
const RENAME = new Map([
  ['_gitignore', '.gitignore'],
  ['_env.example', '.env.example'],
])
/** Files carrying {{placeholders}}; the suffix is dropped on copy. */
const TPL_SUFFIX = '.tpl'

const wrap = (code: number) => (s: string) => `\x1b[${code}m${s}\x1b[0m`

const c = {
  bold: wrap(1),
  dim: wrap(2),
  green: wrap(32),
  red: wrap(31),
}

/** The id the app is known by, e.g. `app.example.my-app`. */
const ID_RE = /^[a-zA-Z0-9._-]+$/
/** Longest id the manifest accepts. */
const ID_MAX = 32

/** Placeholder namespace, meant to be replaced before publishing. */
const NAMESPACE = 'app.example'

/** Turns a folder name into an app id: "My App" → "app.example.my-app". */
function suggestId(dirName: string): string {
  const slug = dirName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  // A dotted name is already an id; anything else gets the placeholder namespace.
  return slug.includes('.') ? slug : `${NAMESPACE}.${slug || 'app'}`
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

/** "app.example.my-app" → "My app". */
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
  'no-git': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const

const USAGE = `
Usage: busy-create-app [directory] [options]

Options:
  --dir <name>          the directory to create, if not given as an argument
  --id <id>             app id, e.g. app.example.my-app
  --name <name>         display name
  --description <text>  one-line description
  --author <name>       author
  --no-git              skip git init
  -h, --help            show this

Anything not passed is asked for at the prompt.
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
}

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

  // A line iterator rather than readline/promises: question() resolves only once when stdin is a pipe, which breaks piped and CI runs.
  const rl = createInterface({ input: process.stdin })
  const lines = rl[Symbol.asyncIterator]()

  /**
   * A value for one field. A flag answers it, still validated; otherwise it is asked for, and Enter (or end of input) takes the default.
   */
  type Field = {
    /** The flag that answers this prompt without asking. */
    option: 'dir' | 'id' | 'name' | 'description' | 'author'
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

  console.log(`\n${c.bold('Creating a BUSY Bar JS app')}\n`)

  const dirName = await ask('Directory', {
    option: 'dir',
    fallback: 'my-app',
    validate: (v) => (v ? checkTarget(resolve(process.cwd(), v)) : 'a directory is required'),
  })
  const target = resolve(process.cwd(), dirName)

  const appId = await ask('App id', {
    option: 'id',
    fallback: suggestId(basename(target)),
    validate: (v) => {
      if (!ID_RE.test(v)) return 'only letters, digits, dot, dash and underscore'
      if (v.length > ID_MAX) return `at most ${ID_MAX} characters, this one is ${v.length}`
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
  const author = await ask('Author', {
    option: 'author',
    fallback: gitAuthor(),
    validate: (v) => (v ? null : 'an author is required'),
  })
  // Not asked for: the app is private, so the folder name will do.
  const packageName = packageNameFor(dirName)

  rl.close()

  // Undo a copy that fails partway, rather than leave a half-written app.
  const preexisting = existsSync(target)
  try {
    copyTemplate(TEMPLATE, target, { appId, appName, description, author, packageName })
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

  const where = dirName === '.' ? '' : `cd ${dirName}\n  `
  console.log(`\n${c.green('✔')} Created ${c.bold(appId)} in ${target}${git ? '' : c.dim(' (no git)')}`)
  console.log(`\nNext:\n\n  ${where}pnpm install\n  cp .env.example .env\n  pnpm build\n`)

  return target
}

main().catch((err) => {
  console.error(c.red(`\n✖ ${err instanceof Error ? err.message : String(err)}`))
  process.exitCode = 1
})
