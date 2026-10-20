// The package manager `busy-cli create` launches the generator with: `<pm> create @busy-app/app`, which then installs the app with that same package manager.

/** The package managers the generator supports, in the order the prompt lists them. */
export const PACKAGE_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'] as const
export type PackageManager = (typeof PACKAGE_MANAGERS)[number]

/** Preselected at the prompt. */
export const RECOMMENDED: PackageManager = 'pnpm'

const FLAG = '--package-manager'

export function isPackageManager(name: unknown): name is PackageManager {
  return PACKAGE_MANAGERS.includes(name as PackageManager)
}

/**
 * Takes --package-manager out of the arguments, as `--package-manager pnpm` or `--package-manager=pnpm`; the rest go to the generator.
 * @param args - The arguments after `busy-cli create`.
 * @returns The flag's value, unchecked, and the arguments without it.
 */
export function takePackageManager(args: string[]): { value?: string; rest: string[] } {
  const at = args.findIndex((a) => a === FLAG || a.startsWith(`${FLAG}=`))
  if (at === -1) return { rest: args }

  const arg = args[at] as string
  const inline = arg.startsWith(`${FLAG}=`)
  const value = inline ? arg.slice(FLAG.length + 1) : args[at + 1]
  if (!value || value.startsWith('-')) throw new Error(`${FLAG} needs one of ${PACKAGE_MANAGERS.join(', ')}`)

  return { value, rest: [...args.slice(0, at), ...args.slice(at + (inline ? 1 : 2))] }
}

/** The command that launches the generator; npm takes the generator's options as its own unless they follow `--`. */
export function createCommandLine(pm: PackageManager, args: string[]): string[] {
  return ['create', '@busy-app/app', ...(pm === 'npm' && args.length > 0 ? ['--'] : []), ...args]
}
