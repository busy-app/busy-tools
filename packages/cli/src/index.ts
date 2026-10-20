#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { log } from '@clack/prompts'
import { createCommand } from './commands/create.js'
import { buildCommand } from './commands/build.js'
import { appCommand } from './commands/app.js'
import { c, helpRow } from './lib/colors.js'
import { formatError } from './lib/errors.js'

// Relative to dist/, where this file lands; package.json stays at the package root.
const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { name: string; version: string }
const VERSION = `${PKG.name} ${PKG.version}`

const USAGE = `
${c.dim(VERSION)}

${c.bold('busy-cli')} — BUSY Bar app development

${c.bold('Usage:')} busy-cli ${c.cyan('<command>')} [options]

${c.bold('Commands:')}
${helpRow('create [dir]', 'scaffold a new BUSY Bar JS app')}
${helpRow('build [app]', 'build app(s) in the current project')}
${helpRow('app <command>', 'install, uninstall, run or stop an app on a connected BUSY Bar')}

${c.bold('Options:')}
${helpRow('-v, --version', 'show the version')}
${helpRow('-h, --help', 'show help')}

Run ${c.cyan('busy-cli <command> --help')} for command-specific options.
`

type Command = (args: string[]) => Promise<void>

const COMMANDS: Record<string, Command> = { create: createCommand, build: buildCommand, app: appCommand }

const [, , cmd, ...args] = process.argv

if (!cmd || cmd === '--help' || cmd === '-h') {
  console.log(USAGE)
  process.exit(0)
}

if (cmd === '--version' || cmd === '-v') {
  console.log(VERSION)
  process.exit(0)
}

// create-app prints its own version next; this one tells which CLI launched it.
if (cmd === 'create') console.log(c.dim(VERSION))

const command = COMMANDS[cmd]
if (!command) {
  log.error(`Unknown command: ${cmd}`)
  console.log(USAGE)
  process.exit(1)
}

command(args).catch((err: unknown) => {
  log.error(formatError(err))
  process.exitCode = 1
})
