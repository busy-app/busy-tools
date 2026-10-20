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

/** Whether version `a` is `b` or later; both are plain x.y.z. */
function atLeast(a: string, b: string): boolean {
  const [x = 0, y = 0, z = 0] = a.split('.').map(Number)
  const [p = 0, q = 0, r = 0] = b.split('.').map(Number)
  return x !== p ? x > p : y !== q ? y > q : z >= r
}

/** The first Yarn that knows npmPreapprovedPackages; an earlier one stops at a setting it does not know. */
const YARN_AGE_GATE = '4.10.0'

/**
 * The generated app's .yarnrc.yml, which Yarn 1 ignores.
 * @param version - The Yarn version, which decides what the file may hold.
 * @returns `nodeLinker: node-modules`, and for Yarn 4.10+ the @busy-app packages let past its quarantine of versions younger than a day, so that a new app installs on the day the CLI or the library is released.
 */
export function yarnrc(version: string | undefined): string {
  const lines = [
    "# Dependencies go into node_modules, where the build tools look for them, instead of Yarn 2+'s Plug'n'Play. Yarn 1 ignores this file.",
    'nodeLinker: node-modules',
  ]
  if (version && atLeast(version, YARN_AGE_GATE)) {
    lines.push(
      '',
      '# Yarn holds back versions published less than a day ago; the BUSY Bar packages this app is built with are let through on the day they are released.',
      'npmPreapprovedPackages:',
      '  - "@busy-app/*"',
    )
  }
  return `${lines.join('\n')}\n`
}

/** Whether a Yarn version is 2 or later, which reads a different yarn.lock than Yarn 1 and is set up through Corepack. */
export function isYarnBerry(version: string | undefined): boolean {
  return version !== undefined && !version.startsWith('1.')
}

/**
 * The arguments that install a freshly generated app.
 * @param pm - The package manager.
 * @param version - Its version, which tells Yarn 2+ from Yarn 1.
 * @returns `install`, with `--no-immutable` for Yarn 2+: with CI set, as on GitHub Actions, it forbids writing the lockfile by default, and a new app has only the empty one the generator leaves.
 */
export function installArgs(pm: PackageManager, version: string | undefined): string[] {
  return pm === 'yarn' && isYarnBerry(version) ? ['install', '--no-immutable'] : ['install']
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
