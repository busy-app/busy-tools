// Which package manager installs the app, and how its commands are spelled. Pure functions, so the tests can reach them without spawning anything.

/** The package managers a generated app can be installed with. */
export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const
export type PackageManager = (typeof PACKAGE_MANAGERS)[number]

/** Used when the generator was not launched by a package manager it supports, e.g. as a global busy-create-app. */
export const FALLBACK: PackageManager = 'npm'

const VERSION_RE = /^\d+\.\d+\.\d+$/

function isPackageManager(name: unknown): name is PackageManager {
  return PACKAGE_MANAGERS.includes(name as PackageManager)
}

/**
 * The package manager that launched the generator, from npm_config_user_agent: "pnpm/11.4.0 npm/? node/v24.16.0 darwin arm64" → { pm: "pnpm", version: "11.4.0" }; npm when there is none or it is not supported.
 * @param userAgent - The value of npm_config_user_agent, which `npm create`, `pnpm create`, `yarn create` and `bun create` set.
 * @returns The package manager, and its version when the user agent names a supported one with a plain x.y.z version.
 */
export function detectPackageManager(userAgent: string | undefined): { pm: PackageManager; version: string | undefined } {
  const [first] = (userAgent ?? '').trim().split(/\s+/)
  const [name, version] = (first ?? '').split('/')
  if (!isPackageManager(name)) return { pm: FALLBACK, version: undefined }
  return { pm: name, version: version && VERSION_RE.test(version) ? version : undefined }
}

/** Whether a Yarn version is 2 or later, which reads a different yarn.lock than Yarn 1 and is set up through Corepack. */
export function isYarnBerry(version: string | undefined): boolean {
  return version !== undefined && !version.startsWith('1.')
}

/** How a package.json script is run: `npm run build`, `pnpm build`, `yarn build`, `bun run build`; Bun needs `run` as well, since `bun build` invokes its built-in bundler. */
export function runCommand(pm: PackageManager): string {
  return pm === 'npm' || pm === 'bun' ? `${pm} run` : pm
}

/** What goes between a script and its options: npm takes options after the script name as its own unless they follow `--`. */
export function argsSeparator(pm: PackageManager): string {
  return pm === 'npm' ? ' --' : ''
}

/** The install command for CI, which fails on a lockfile out of date with package.json. */
function ciInstall(pm: PackageManager, version: string | undefined): string {
  switch (pm) {
    case 'npm':
      return 'npm ci'
    case 'pnpm':
      return 'pnpm install --frozen-lockfile'
    case 'yarn':
      return isYarnBerry(version) ? 'yarn install --immutable' : 'yarn install --frozen-lockfile'
    case 'bun':
      return 'bun install --frozen-lockfile'
  }
}

/** The GitHub Actions steps that set up Node and the package manager and install the dependencies, indented to sit under `steps:`. */
export function ciSetup(pm: PackageManager, version: string | undefined): string {
  const node = (cache?: string) =>
    ['- uses: actions/setup-node@v6', '  with:', '    node-version-file: .nvmrc', ...(cache ? [`    cache: ${cache}`] : [])].join('\n')

  const steps: string[] = []
  switch (pm) {
    case 'npm':
      steps.push(node('npm'))
      break
    case 'pnpm':
      steps.push('- uses: pnpm/action-setup@v4', node('pnpm'))
      break
    case 'yarn':
      // The runner's own Yarn is 1.x; Corepack runs the Yarn 2+ version the packageManager field names.
      steps.push(node(), ...(isYarnBerry(version) ? ['- run: corepack enable'] : []))
      break
    case 'bun':
      // The scripts run busy-cli under Node, so Bun only installs.
      steps.push(node(), '- uses: oven-sh/setup-bun@v2')
      break
  }
  steps.push(`- run: ${ciInstall(pm, version)}`)

  return steps.map((step) => step.replace(/^/gm, '      ')).join('\n\n')
}
