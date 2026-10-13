import { execFileSync } from 'node:child_process'

export async function createCommand(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log('\nUsage: busy-cli create [directory] [--id <id>] [--name <name>] [--description <text>] [--author <name>] [--api-version <x.y.z>]\n')
    return
  }

  execFileSync('pnpm', ['create', '@busy-app/app', ...args], { stdio: 'inherit' })
}
