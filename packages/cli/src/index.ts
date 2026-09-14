#!/usr/bin/env node

import { createCommand } from './commands/create.js'
import { buildCommand } from './commands/build.js'
import { c } from './lib/colors.js'

const USAGE = `
${c.bold('busy-cli')} — BUSY Bar app development

${c.bold('Usage:')} busy-cli <command> [options]

${c.bold('Commands:')}
  create [dir]      scaffold a new BUSY Bar JS app
  build  [app]      build app(s) in the current project

Run ${c.dim('busy-cli <command> --help')} for command-specific options.
`

type Command = (args: string[]) => Promise<void>

const COMMANDS: Record<string, Command> = { create: createCommand, build: buildCommand }

const [, , cmd, ...args] = process.argv

if (!cmd || cmd === '--help' || cmd === '-h') {
  console.log(USAGE)
  process.exit(0)
}

const command = COMMANDS[cmd]
if (!command) {
  console.error(c.red(`\n✖ Unknown command: ${cmd}\n`) + USAGE)
  process.exit(1)
}

command(args).catch((err: unknown) => {
  console.error(c.red(`\n✖ ${err instanceof Error ? err.message : String(err)}`))
  process.exitCode = 1
})
