// Talking to a BUSY Bar over its HTTP API. Without --addr the CLI goes to the address the device has over USB by default.

import { connect } from 'node:net'

export const DEFAULT_ADDR = '10.0.4.20'

const CONNECT_TIMEOUT_MS = 3000
const REQUEST_TIMEOUT_MS = 30_000

const ACCESS_HINT = `The BUSY Bar refused the request. Over USB no password is needed. Over Wi-Fi it depends on the "HTTP API" section of the BUSY Bar web UI: "HTTP API access" has to be on, and with "Password protection" on the password has to be passed as --password <password>.`

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
  const addr = takeOption(args, '--addr', 'a host, e.g. --addr 192.168.1.50')
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
      reject(new Error(`No BUSY Bar at ${base.host} (${reason}).\nCheck that it is connected, or pass another address with --addr.`))
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

/** Calls the device API and returns the parsed JSON body. Throws with the device's own error message on a non-2xx response. */
export async function request<T>(device: Device, method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(path, device.base)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(key, String(value))
  }

  let res: Response
  try {
    res = await fetch(url, {
      method,
      signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
      headers: {
        ...(device.password ? { 'X-API-Token': device.password } : {}),
        ...(options.body ? { 'Content-Type': 'application/octet-stream' } : {}),
      },
      ...(options.body ? { body: options.body } : {}),
    })
  } catch (err) {
    throw new Error(`${method} ${url.pathname} failed: ${describe(err)}`)
  }

  const text = await res.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = undefined
  }

  if (!res.ok) {
    const message = (data as { error?: string } | undefined)?.error ?? (text.trim() || res.statusText)
    throw new Error(`${message} (HTTP ${res.status})${res.status === 403 ? `\n${ACCESS_HINT}` : ''}`)
  }

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

function describe(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  if (err.name === 'TimeoutError') return 'timed out'
  return err.cause instanceof Error ? err.cause.message : err.message
}
