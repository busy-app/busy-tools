// Commands suggested in messages, spelled the way the user can run them. Run from a package.json script, busy-cli is in node_modules/.bin rather than on PATH, so `busy-cli build` would not run in their terminal: the hint names the project's own script, or runs the binary through the package manager.

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isPackageManager, type PackageManager } from './packageManager.js'

/** The package manager running the current package.json script, and that script's name; undefined outside a script. */
function scriptContext(env: NodeJS.ProcessEnv): { pm: PackageManager; script: string } | undefined {
  const script = env.npm_lifecycle_event
  const name = env.npm_config_user_agent?.trim().split(/\s+/)[0]?.split('/')[0]
  if (!script || !isPackageManager(name)) return undefined
  return { pm: name, script }
}

/** How a package.json script is run: `npm run build`, `pnpm build`, `yarn build`, `bun run build`; bun needs `run` as well, since `bun build` is its own bundler. */
function runScript(pm: PackageManager, script: string): string {
  return pm === 'npm' || pm === 'bun' ? `${pm} run ${script}` : `${pm} ${script}`
}

/** How the project's own busy-cli is run without a script, from node_modules/.bin. */
function runBin(pm: PackageManager, command: string): string {
  switch (pm) {
    case 'npm':
      return `npx ${command}`
    case 'pnpm':
      return `pnpm exec ${command}`
    case 'yarn':
      return `yarn ${command}`
    case 'bun':
      return `bunx ${command}`
  }
}

/**
 * The script in the project's package.json that runs `busy-cli build`: the one with no options first, as the template's `build`, then any other; matched by its command, so a renamed script is still found.
 * @param root - The project folder, the one holding package.json.
 */
function buildScript(root: string): string | undefined {
  const path = resolve(root, 'package.json')
  if (!existsSync(path)) return undefined
  let scripts: Record<string, unknown>
  try {
    scripts = (JSON.parse(readFileSync(path, 'utf8')) as { scripts?: Record<string, unknown> }).scripts ?? {}
  } catch {
    return undefined
  }
  const entries = Object.entries(scripts).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  return (
    entries.find(([, command]) => command.trim() === 'busy-cli build')?.[0] ??
    entries.find(([, command]) => /^busy-cli build(\s|$)/.test(command.trim()))?.[0]
  )
}

/**
 * The command that builds the app, to suggest when the package is missing or rejected.
 * @param root - The project folder.
 * @param env - The environment, where a package manager running a script leaves its traces.
 */
export function buildHint(root: string, env: NodeJS.ProcessEnv = process.env): string {
  const context = scriptContext(env)
  if (!context) return 'busy-cli build'
  const script = buildScript(root)
  return script ? runScript(context.pm, script) : runBin(context.pm, 'busy-cli build')
}

/**
 * The command that runs the current one again: the same package.json script when run from one, `fallback` otherwise.
 * @param fallback - The busy-cli command itself, e.g. `busy-cli app install`.
 * @param env - The environment, where a package manager running a script leaves its traces.
 */
export function rerunHint(fallback: string, env: NodeJS.ProcessEnv = process.env): string {
  const context = scriptContext(env)
  return context ? runScript(context.pm, context.script) : fallback
}
