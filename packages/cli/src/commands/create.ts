import { execFileSync } from 'node:child_process'
import { createInterface } from 'node:readline/promises'
import { c, helpRow } from '../lib/colors.js'
import {
  createCommandLine,
  isPackageManager,
  PACKAGE_MANAGERS,
  type PackageManager,
  parseAnswer,
  RECOMMENDED,
  takePackageManager,
} from '../lib/packageManager.js'

const USAGE = `
${c.bold('busy-cli create')} — scaffold a new BUSY Bar JS app with @busy-app/create-app

${c.bold('Usage:')} busy-cli create [directory] [options]

${c.bold('Options:')}
${helpRow('--package-manager <name>', `${PACKAGE_MANAGERS.join(', ')}: runs ${c.cyan('<name> create @busy-app/app')}, which installs the app with it; prompted when omitted; required without an interactive terminal`)}
${helpRow('--dir <name>', 'the directory to create, if not given as an argument')}
${helpRow('--author <name>', 'author')}
${helpRow('--id <id>', 'app id, e.g. app.jane_doe.my_app')}
${helpRow('--name <name>', 'display name')}
${helpRow('--description <text>', 'one-line description')}
${helpRow('--api-version <x.y.z>', 'minimum BUSY Bar HTTP API version the app needs')}
${helpRow('--no-git', 'skip git init')}
${helpRow('--no-install', 'skip installing dependencies')}

  Every option but ${c.cyan('--package-manager')} goes to the generator; anything not passed is asked for at its prompts.
`

/** Asks for the package manager from a numbered list, under a note explaining why the flag was missing or invalid. */
async function askPackageManager(note?: string): Promise<PackageManager> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    if (note) console.log(note)
    console.log('Which package manager would you like to use?')
    PACKAGE_MANAGERS.forEach((pm, i) => console.log(`  ${i + 1}) ${pm}${pm === RECOMMENDED ? c.dim(' (recommended)') : ''}`))

    for (;;) {
      const pm = parseAnswer(await rl.question(`Package manager ${c.dim(`(${RECOMMENDED})`)}: `))
      if (pm) return pm
      console.log(c.red(`  expected a number from 1 to ${PACKAGE_MANAGERS.length} or one of ${PACKAGE_MANAGERS.join(', ')}`))
    }
  } finally {
    // Hands stdin over to the generator's own prompts.
    rl.close()
  }
}

/**
 * The flag answers the prompt in advance; without a valid one, the user is prompted. Without a terminal, the prompt cannot be shown, so the package manager must be specified via the flag.
 * @param flag - The value of --package-manager, unchecked.
 */
async function choosePackageManager(flag: string | undefined): Promise<PackageManager> {
  if (isPackageManager(flag)) return flag

  if (!process.stdin.isTTY) {
    const expected = `Pass one of ${PACKAGE_MANAGERS.join(', ')} with --package-manager <name>.`
    if (flag !== undefined) throw new Error(`Unknown package manager: ${flag}\n${expected}`)
    throw new Error(`A package manager is required, and it cannot be prompted without an interactive terminal.\n${expected}`)
  }

  return askPackageManager(flag === undefined ? undefined : c.red(`Unknown package manager: ${flag}`))
}

export async function createCommand(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE)
    return
  }

  const { value, rest } = takePackageManager(args)
  const pm = await choosePackageManager(value)

  try {
    execFileSync(pm, createCommandLine(pm, rest), { stdio: 'inherit' })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw new Error(`${pm} is not installed or not found in PATH`)
    // The generator has printed its own error; repeating it adds nothing.
    process.exitCode = (err as { status?: number }).status ?? 1
  }
}
