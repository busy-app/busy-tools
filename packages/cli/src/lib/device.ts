// Talking to a BUSY Bar over its HTTP API. Without --addr the CLI goes to the address the device has over USB by default.

import { connect } from 'node:net'
import { explainCause, UserError } from './errors.js'
import { buildHint, rerunHint } from './hints.js'
import { findProject } from './paths.js'

export const DEFAULT_ADDR = '10.0.4.20'

const CONNECT_TIMEOUT_MS = 3000
const REQUEST_TIMEOUT_MS = 30_000

/** What a failed call means where the firmware answers with a generic text such as "Bad Request", by endpoint and status; taken from the firmware's api_apps.c and its OpenAPI description. {build} and {rerun} stand for the commands that build the app and run this one again, spelled for how the CLI was started. */
const MEANINGS: Record<string, Record<number, string>> = {
  '/api/apps/stage': {
    400: 'The BUSY Bar rejected the package. Build it with {build}, which packs it the way the BUSY Bar expects.',
    408: 'The upload stalled: the BUSY Bar received no data for 5 seconds and closed the connection. Try again, or connect over USB if currently on Wi-Fi.',
    409: 'The upload session expired or was interrupted, or the app needs a newer HTTP API than the firmware supports.',
    413: 'The package is too large: the BUSY Bar accepts at most 100 MB.',
    508: 'The BUSY Bar could not save the package. Check that its storage has free space.',
  },
  '/api/apps/install': {
    400: 'The BUSY Bar did not install the uploaded app; the firmware does not report why. Run {rerun} again.',
  },
  '/api/apps/launch': {
    400: 'The app id is invalid.',
    404: 'No app with this id is installed on the BUSY Bar.',
    409: 'The app needs a newer HTTP API than the firmware supports, or a higher-priority app is running.',
    503: 'The BUSY Bar failed to launch the app.',
  },
  '/api/apps/quit': {
    409: 'No app is running.',
    503: 'The BUSY Bar failed to quit the running app.',
  },
  '/api/apps': {
    400: 'The app id is missing or invalid.',
    404: 'No app with this id is installed on the BUSY Bar.',
    503: 'The app is running, and the BUSY Bar failed to quit it before uninstalling.',
  },
}

/** How much of a body that is not JSON goes into the error. */
const RAW_SHOWN = 200

/** What the installer's error_code from /api/apps/stage means. */
const ERROR_CODES: Record<string, string> = {
  unpack_error: 'The package could not be unpacked. Build it with {build}, which packs it the way the BUSY Bar expects.',
  manifest_error: 'The appmeta/manifest.json in the package is invalid.',
  api_mismatch: 'The app needs a newer HTTP API than the firmware supports: lower api_version in the manifest, or update the firmware.',
  installation_failed: 'The BUSY Bar could not install the app.',
}

const ACCESS_HINT = `The BUSY Bar refused the request. No password is needed over USB. Over Wi-Fi, verify the "HTTP API" settings in the web UI: "HTTP API access" must be enabled, and if "Password protection" is enabled, pass the password via --password <password>.`

export interface Device {
  base: URL
  /** The "Password protection" password from the web UI, sent as X-API-Token. The firmware asks for it only over Wi-Fi. */
  password?: string
}

export interface RequestOptions {
  query?: Record<string, string | number>
  body?: Uint8Array<ArrayBuffer>
  timeoutMs?: number
}

/** Pulls `--addr <host>` and `--password <password>` out of the arguments, returning the device to talk to and the arguments left over. */
export function takeDevice(args: string[]): { device: Device; rest: string[] } {
  const addr = takeOption(args, '--addr', 'a host (e.g. its IP on Wi-Fi)')
  const password = takeOption(addr.rest, '--password', 'the "Password protection" password set on the BUSY Bar')

  return {
    device: { base: baseUrl(addr.value ?? DEFAULT_ADDR), ...(password.value ? { password: password.value } : {}) },
    rest: password.rest,
  }
}

/** Fails fast when nothing listens at the address, instead of waiting out the system TCP timeout. */
export function ensureReachable({ base }: Device): Promise<void> {
  const port = Number(base.port) || (base.protocol === 'https:' ? 443 : 80)

  return new Promise((resolve, reject) => {
    const fail = (reason: string) => {
      socket.destroy()
      reject(new UserError(`No BUSY Bar at ${base.host} (${reason}).\nCheck that it is connected, or pass another address with --addr.`))
    }

    const socket = connect({ host: base.hostname, port, timeout: CONNECT_TIMEOUT_MS })
    socket.once('connect', () => {
      socket.destroy()
      resolve()
    })
    socket.once('timeout', () => fail('timed out'))
    socket.once('error', (err) => fail(err.message))
  })
}

/** Fills {build} and {rerun} in a meaning with the commands the user can run where they are. */
function spellCommands(text: string): string {
  return text
    .replaceAll('{build}', () => buildHint(findProject(process.cwd())?.root ?? process.cwd()))
    .replaceAll('{rerun}', () => rerunHint('busy-cli app install'))
}

/** The error body the firmware sends: `{"error": "..."}`, and from the installer an `error_code` too. */
type ErrorBody = { error?: unknown; error_code?: unknown }

/**
 * Words a failed call: what the BUSY Bar said, what the status means for this endpoint, and how to get past it.
 * @param path - The endpoint, which decides what a status means.
 * @param res - The response, whose status arrived even when its body did not.
 * @param body - The parsed body, or undefined when it was not JSON or broke off.
 * @param raw - The body as text, shown when it is not the firmware's JSON.
 * @param broken - Why the body broke off, when it did.
 */
function failure(path: string, res: Response, body: ErrorBody | undefined, raw: string, broken?: string): string {
  const said = typeof body?.error === 'string' && body.error ? body.error : undefined
  const code = typeof body?.error_code === 'string' ? body.error_code : undefined
  const status = `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`

  const lines = [said ? `The BUSY Bar answered: ${said} (${status}${code ? `, ${code}` : ''})` : `The BUSY Bar answered ${status}`]
  if (broken) lines.push(`The connection closed before the error details arrived: ${broken}.`)
  // Not the firmware's JSON, e.g. a proxy's HTML page: its start still tells what answered.
  else if (!said && raw.trim()) lines.push(`The response was not the BUSY Bar's JSON: ${raw.trim().slice(0, RAW_SHOWN)}${raw.trim().length > RAW_SHOWN ? '…' : ''}`)

  const meaning = (code && ERROR_CODES[code]) || MEANINGS[path]?.[res.status]
  if (meaning) lines.push(spellCommands(meaning))
  if (res.status === 403) lines.push(ACCESS_HINT)
  return lines.join('\n')
}

/** Calls the device API and returns the parsed JSON body. Every failure, from a refused connection to a body cut short, is raised as a UserError that says what happened. */
export async function request<T>(device: Device, method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(path, device.base)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(key, String(value))
  }
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS

  let res: Response
  try {
    res = await fetch(url, {
      method,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        ...(device.password ? { 'X-API-Token': device.password } : {}),
        ...(options.body ? { 'Content-Type': 'application/octet-stream' } : {}),
      },
      ...(options.body ? { body: options.body } : {}),
    })
  } catch (err) {
    throw new UserError(`${method} ${url.pathname} received no response from the BUSY Bar: ${describe(err, timeoutMs)}.`)
  }

  // The firmware closes the connection right after some responses, e.g. to a stalled upload, while the request is still going out; the body can then break off after the status has arrived.
  let text: string
  try {
    text = await res.text()
  } catch (err) {
    if (res.ok) throw new UserError(`${method} ${url.pathname} succeeded, but the connection closed before the response could be read: ${describe(err, timeoutMs)}.`)
    throw new UserError(failure(path, res, undefined, '', describe(err, timeoutMs)))
  }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = undefined
  }

  if (!res.ok) throw new UserError(failure(path, res, data as ErrorBody | undefined, text))
  return data as T
}

function takeOption(args: string[], name: string, needs: string): { value?: string; rest: string[] } {
  const flag = args.indexOf(name)
  if (flag === -1) return { rest: args }

  const value = args[flag + 1]
  if (!value || value.startsWith('-')) throw new Error(`${name} needs ${needs}`)

  return { value, rest: [...args.slice(0, flag), ...args.slice(flag + 2)] }
}

function baseUrl(addr: string): URL {
  try {
    return new URL(/^https?:\/\//.test(addr) ? addr : `http://${addr}`)
  } catch {
    throw new Error(`Invalid address: ${addr}`)
  }
}

/** Why a request or its response failed: a timeout in words, anything else with its whole cause chain and codes. */
function describe(err: unknown, timeoutMs: number): string {
  if (err instanceof Error && err.name === 'TimeoutError') return `no response within ${timeoutMs / 1000} s`
  return explainCause(err)
}
