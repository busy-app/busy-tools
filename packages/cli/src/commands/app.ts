import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, relative, resolve } from 'node:path'
import { readAppId } from '../lib/build.js'
import { c, helpRow } from '../lib/colors.js'
import { DEFAULT_ADDR, type Device, ensureReachable, request, takeDevice } from '../lib/device.js'
import { findProject, outRoot } from '../lib/paths.js'

const USAGE = `
${c.bold('busy-cli app')} — manage apps on a connected BUSY Bar

${c.bold('Usage:')} busy-cli app ${c.cyan('<command>')} [options]

${c.bold('Commands:')}
${helpRow('install [file.tgz]', 'upload an app package and install it')}
${helpRow('uninstall [app-id]', 'remove an installed app, keeping its settings')}
${helpRow('run [app-id]', 'launch an installed app')}
${helpRow('stop', 'quit the running app')}

  Run from an app folder, ${c.cyan('uninstall')} and ${c.cyan('run')} need no id: it is read from appmeta/manifest.json.
  ${c.cyan('install')} without a file takes dist/<id>.tgz of that folder, the package ${c.cyan('busy-cli build')} makes. It does not build anything itself.

${c.bold('Options:')}
${helpRow('--addr <host>', `BUSY Bar address ${c.dim(`(default: ${DEFAULT_ADDR}, its default address over USB)`)}`)}
${helpRow('--password <password>', 'the password from "Password protection", only needed over Wi-Fi (see below)')}

${c.bold('Connecting:')}
  Over USB the BUSY Bar needs no password. Its address there is ${DEFAULT_ADDR} unless it was changed, in that case pass it with ${c.cyan('--addr <host>')}.
  Over Wi-Fi pass its IP address or hostname with ${c.cyan('--addr <host>')}. Whether that works is set in the "HTTP API" section of the BUSY Bar web UI, under "Over Wi-Fi":
    HTTP API access off        every request over Wi-Fi is refused; use USB
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
      return install(device, target ?? ownPackage())
    case 'run':
      return run(device, target ?? ownAppId('run'))
    case 'stop':
      return stop(device)
    case 'uninstall':
      return uninstall(device, target ?? ownAppId('uninstall'))
    case undefined:
      console.log(USAGE)
      return
    default:
      throw new Error(`Unknown app command: ${sub}\n${USAGE}`)
  }
}

const APP_FOLDER = 'an app folder: one that has appmeta/manifest.json, directly or under src/'

/** The id of the app in the current folder, for a command given none. */
function ownAppId(command: string): string {
  const project = findProject(process.cwd())
  if (!project) throw new Error(`app ${command} needs an app id.\nOr run it from ${APP_FOLDER}.`)
  return readAppId(project)
}

/** The package of the app in the current folder, where `busy-cli build` leaves it. Nothing is built here: a missing package is an error. */
function ownPackage(): string {
  const project = findProject(process.cwd())
  if (!project) throw new Error(`app install needs a path to a .tgz package.\nOr run it from ${APP_FOLDER}.`)

  const path = resolve(outRoot(project), `${readAppId(project)}.tgz`)
  if (!existsSync(path)) {
    throw new Error(`Nothing to install: there is no ${relative(process.cwd(), path)}.\nBuild it first with busy-cli build, or pass the path to a .tgz package.`)
  }
  return path
}

async function install(device: Device, file: string): Promise<void> {
  const path = resolve(file)
  if (!existsSync(path)) throw new Error(`No such file: ${path}`)

  const body = await readFile(path)
  await ensureReachable(device)

  console.log(`\n▶ Uploading ${basename(path)} to ${device.base.host}`)
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
