import { build, DEFAULT_ADDR } from '../lib/build.js'
import { requireProject } from '../lib/paths.js'

const USAGE = `
Usage: busy-cli build [options]

Options:
  --out <path>       output directory (default: dist, relative to the project)
  --addr <host>      BUSY Bar address the app connects to (default: ${DEFAULT_ADDR}, the device the app runs on)
  --no-minify        skip minification (readable output for on-device debugging)
  --bundle           bundle all modules into a single scripts/main.js
  --tgz              also pack the built app into <id>.tgz
  --tgz-only         pack into <id>.tgz, without keeping the folder
  --tgz-name <name>  custom archive file name (default: <id>.tgz)
  -h, --help         show this

Writing {id} or {version} in --tgz-name puts the app's id or version from the manifest in that place:
  busy-cli build --tgz --tgz-name "{id}-{version}.tgz"    →  app.example.my_app-1.0.0.tgz
`

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

  const tgz = args.includes('--tgz')
  const tgzOnly = args.includes('--tgz-only')
  if (tgz && tgzOnly) {
    throw new Error('--tgz and --tgz-only are mutually exclusive: one keeps the folder, the other does not')
  }

  const nameFlag = args.indexOf('--tgz-name')
  if (nameFlag !== -1 && !args[nameFlag + 1]) {
    throw new Error('--tgz-name needs a file name, e.g. --tgz-name "{id}-{version}.tgz"')
  }
  if (nameFlag !== -1 && !tgz && !tgzOnly) {
    throw new Error('--tgz-name names the archive, so it needs --tgz or --tgz-only')
  }

  const tgzName = nameFlag === -1 ? undefined : args[nameFlag + 1]

  await build(project, {
    ...(out ? { out } : {}),
    ...(addr ? { addr } : {}),
    minify: !args.includes('--no-minify'),
    bundle: args.includes('--bundle'),
    tgz,
    tgzOnly,
    ...(tgzName ? { tgzName } : {}),
  })
}
