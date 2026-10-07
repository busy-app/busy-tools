import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { c, helpRow } from '../lib/colors.js'
import { DEFAULT_ADDR, type Device, ensureReachable, request, takeDevice } from '../lib/device.js'

const USAGE = `
${c.bold('busy-cli app')} — manage apps on a connected BUSY Bar

${c.bold('Usage:')} busy-cli app ${c.cyan('<command>')} [options]

${c.bold('Commands:')}
${helpRow('install <file.tgz>', 'upload an app package and install it')}
${helpRow('run <app-id>', 'launch an installed app')}
${helpRow('stop', 'quit the running app')}
${helpRow('uninstall <app-id>', 'remove an installed app, keeping its settings')}

${c.bold('Options:')}
${helpRow('--addr <host>', `BUSY Bar address ${c.dim(`(default: ${DEFAULT_ADDR}, its default address over USB)`)}`)}
${helpRow('--password <password>', 'the password from "Password protection", only needed over Wi-Fi (see below)')}

${c.bold('Connecting:')}
  Over USB the BUSY Bar needs no password. Its address there is ${DEFAULT_ADDR} unless it was changed, in that case pass it with ${c.cyan('--addr')}.
  Over Wi-Fi pass its IP with ${c.cyan('--addr')}. Whether that works is set in the "HTTP API" section of the BUSY Bar web UI, under "Over Wi-Fi":
    HTTP API access off        every request over Wi-Fi is refused, use USB
    HTTP API access on         works as is
    Password protection on     pass that password with ${c.cyan('--password')}
`

// Uploading and unpacking a package on the device takes far longer than a plain call.
const INSTALL_TIMEOUT_MS = 120_000

interface AppInfo {
  id: string
  name: string
  version: string
}

interface StageResult {
  install_key: number
  staged: AppInfo
  installed?: AppInfo
}

export async function appCommand(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE)
    return
  }

  const { device, rest } = takeDevice(args)
  const unknown = rest.find((a) => a.startsWith('-'))
  if (unknown) throw new Error(`Unknown option: ${unknown}`)

  const [sub, target] = rest

  switch (sub) {
    case 'install':
      if (!target) throw new Error('app install needs a path to a .tgz package')
      return install(device, target)
    case 'run':
      if (!target) throw new Error('app run needs an app id')
      return run(device, target)
    case 'stop':
      return stop(device)
    case 'uninstall':
      if (!target) throw new Error('app uninstall needs an app id')
      return uninstall(device, target)
    case undefined:
      console.log(USAGE)
      return
    default:
      throw new Error(`Unknown app command: ${sub}\n${USAGE}`)
  }
}

async function install(device: Device, file: string): Promise<void> {
  const path = resolve(file)
  if (!existsSync(path)) throw new Error(`No such file: ${path}`)

  const body = await readFile(path)
  await ensureReachable(device)

  console.log(`\n▶ Uploading ${file} to ${device.base.host}`)
  const { install_key, staged, installed } = await request<StageResult>(device, 'POST', '/api/apps/stage', {
    body,
    timeoutMs: INSTALL_TIMEOUT_MS,
  })

  console.log(`  ${installed ? `replacing v${installed.version} with` : 'installing'} ${staged.id} v${staged.version}`)
  await request(device, 'POST', '/api/apps/install', { query: { install_key }, timeoutMs: INSTALL_TIMEOUT_MS })

  console.log(`\n✔ Installed ${c.bold(staged.name)} ${c.dim(`(${staged.id})`)}`)
}

async function run(device: Device, appId: string): Promise<void> {
  await ensureReachable(device)
  await request(device, 'POST', '/api/apps/launch', { query: { app_id: appId } })

  console.log(`\n✔ Launched ${c.bold(appId)}`)
}

async function stop(device: Device): Promise<void> {
  await ensureReachable(device)
  await request(device, 'POST', '/api/apps/quit')

  console.log('\n✔ Stopped')
}

async function uninstall(device: Device, appId: string): Promise<void> {
  await ensureReachable(device)
  await request(device, 'DELETE', '/api/apps', { query: { app_id: appId } })

  console.log(`\n✔ Uninstalled ${c.bold(appId)}`)
}
