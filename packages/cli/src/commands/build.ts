import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from '../lib/build.js'

const USAGE = `
Usage: busy-cli build [options]

Options:
  --out <path>     output directory (default: dist, relative to the project)
  --no-minify      skip minification (readable output for on-device debugging)
  --bundle         bundle all modules into a single scripts/main.js
  --tgz            also pack the built app into <id>.tgz
  --tgz-only       pack into <id>.tgz, without keeping the folder
  -h, --help       show this
`

export async function buildCommand(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE)
    return
  }

  const cwd = process.cwd()
  if (!existsSync(resolve(cwd, 'src/appmeta/manifest.json'))) {
    throw new Error(`No src/appmeta/manifest.json found in ${cwd}.\nRun this command from inside a BUSY Bar app project.`)
  }

  const outFlag = args.indexOf('--out')
  if (outFlag !== -1 && !args[outFlag + 1]) {
    throw new Error('--out needs a path')
  }

  const out = outFlag === -1 ? undefined : args[outFlag + 1]

  await build(cwd, {
    ...(out ? { out } : {}),
    minify: !args.includes('--no-minify'),
    bundle: args.includes('--bundle'),
    tgz: args.includes('--tgz'),
    tgzOnly: args.includes('--tgz-only'),
  })
}
