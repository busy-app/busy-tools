#!/usr/bin/env node

import { createCommand } from './commands/create.js'
import { buildCommand } from './commands/build.js'
import { appCommand } from './commands/app.js'
import { c, helpRow } from './lib/colors.js'

const USAGE = `
${c.bold('busy-cli')} — BUSY Bar app development

${c.bold('Usage:')} busy-cli ${c.cyan('<command>')} [options]

${c.bold('Commands:')}
${helpRow('create [dir]', 'scaffold a new BUSY Bar JS app')}
${helpRow('build [app]', 'build app(s) in the current project')}
${helpRow('app <command>', 'install, run, stop or uninstall an app on a connected BUSY Bar')}

Run ${c.cyan('busy-cli <command> --help')} for command-specific options.
`

type Command = (args: string[]) => Promise<void>

const COMMANDS: Record<string, Command> = { create: createCommand, build: buildCommand, app: appCommand }

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
