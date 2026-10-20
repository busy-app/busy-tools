import { build, DEFAULT_ADDR, EMITS, type Emit } from '../lib/build.js'
import { requireProject } from '../lib/paths.js'

const USAGE = `
Usage: busy-cli build [options]

Options:
  --out <path>            output directory (default: dist, relative to the project)
  --emit <tgz|dir|both>   what the build leaves (default: tgz):
                            tgz   the <id>.tgz archive, ready for busy-cli app install
                            dir   the <id>/ folder
                            both  the folder and the archive
  --addr <host>           BUSY Bar address the app connects to (default: ${DEFAULT_ADDR}, the device the app runs on)
  --no-minify             skip minification (readable output for on-device debugging)
  --bundle                bundle all modules into a single scripts/main.js
  --tgz-name <name>       custom archive file name (default: <id>.tgz)
  -h, --help              show help

Writing {id} or {version} in --tgz-name puts the app's id or version from the manifest in that place:
  busy-cli build --tgz-name "{id}-{version}.tgz"    →  app.example.my_app-1.0.0.tgz
`

/** What replaced each removed flag, for a clear error instead of a flag silently ignored. */
const REPLACED: Record<string, string> = {
  '--tgz': '--tgz was replaced by --emit both, which keeps the folder next to the archive.',
  '--tgz-only': '--tgz-only is now the default, the same as --emit tgz.',
}

function isEmit(value: unknown): value is Emit {
  return EMITS.includes(value as Emit)
}

export async function buildCommand(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE)
    return
  }

  const project = requireProject(process.cwd())

  const outFlag = args.indexOf('--out')
  if (outFlag !== -1 && !args[outFlag + 1]) {
    throw new Error('--out needs a path')
  }

  const out = outFlag === -1 ? undefined : args[outFlag + 1]

  const addrFlag = args.indexOf('--addr')
  if (addrFlag !== -1 && !args[addrFlag + 1]) {
    throw new Error('--addr needs a host')
  }

  const addr = addrFlag === -1 ? undefined : args[addrFlag + 1]

  const removed = args.find((a) => a in REPLACED)
  if (removed) throw new Error(REPLACED[removed])

  const emitFlag = args.indexOf('--emit')
  const emitValue = emitFlag === -1 ? 'tgz' : args[emitFlag + 1]
  if (!isEmit(emitValue)) {
    throw new Error(`--emit needs one of ${EMITS.join(', ')}${emitValue ? `, not ${emitValue}` : ''}`)
  }
  const emit = emitValue

  const nameFlag = args.indexOf('--tgz-name')
  if (nameFlag !== -1 && !args[nameFlag + 1]) {
    throw new Error('--tgz-name needs a file name, e.g. --tgz-name "{id}-{version}.tgz"')
  }
  if (nameFlag !== -1 && emit === 'dir') {
    throw new Error('--tgz-name names the archive, and --emit dir makes none.')
  }

  const tgzName = nameFlag === -1 ? undefined : args[nameFlag + 1]

  await build(project, {
    ...(out ? { out } : {}),
    ...(addr ? { addr } : {}),
    minify: !args.includes('--no-minify'),
    bundle: args.includes('--bundle'),
    emit,
    ...(tgzName ? { tgzName } : {}),
  })
}
