// How requests to the BUSY Bar fail: against a local server that answers the way the firmware does, a broken-off answer included.

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, describe, test } from 'node:test'

import { request } from '../dist/lib/device.js'
import { explainCause, formatError, UserError } from '../dist/lib/errors.js'

/** Answers by the path, the way the firmware's api_apps.c does. */
const ROUTES = {
  // A reply cut by the closing socket: Content-Length promises more than arrives, as with the firmware's 408 to a stalled upload.
  '/stalled': (req, res) => {
    res.writeHead(408, { 'Content-Type': 'application/json', Connection: 'close', 'Content-Length': '40' })
    res.write('{"error":"Upl')
    setTimeout(() => req.socket.destroy(), 20)
  },
  '/reset': (req) => req.socket.destroy(),
  '/api/apps/stage': (_, res) => json(res, 400, { error: 'Wrong app manifest', error_code: 'manifest_error' }),
  '/api/apps/launch': (_, res) => json(res, 404, { error: 'Not Found' }),
  '/html': (_, res) => {
    res.writeHead(500, { 'Content-Type': 'text/html' })
    res.end('<h1>oops</h1>')
  },
  '/forbidden': (_, res) => json(res, 403, { error: 'Forbidden' }),
  '/ok': (_, res) => json(res, 200, { result: 'OK' }),
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

describe('request', () => {
  let server
  let device

  before(async () => {
    server = createServer((req, res) => ROUTES[req.url.split('?')[0]](req, res))
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    device = { base: new URL(`http://127.0.0.1:${server.address().port}`) }
  })

  after(() => server.close())

  /** The message request() fails with, as a UserError. */
  const failure = async (path) => {
    const err = await request(device, 'POST', path).then(
      () => assert.fail(`${path} did not fail`),
      (e) => e,
    )
    assert.ok(err instanceof UserError, `${path} failed with a ${err.name}, not a UserError`)
    return err.message
  }

  test('returns the parsed body', async () => {
    assert.deepEqual(await request(device, 'GET', '/ok'), { result: 'OK' })
  })

  test('explains an interrupted response, with its status and cause', async () => {
    const message = await failure('/stalled')
    assert.match(message, /HTTP 408/)
    assert.match(message, /closed before the error details arrived: terminated: .*UND_ERR_RES_CONTENT_LENGTH_MISMATCH/)
  })

  test('explains a dropped connection with its code', async () => {
    assert.match(await failure('/reset'), /received no response from the BUSY Bar: .*(ECONNRESET|UND_ERR_SOCKET)/)
  })

  test('adds what the error code means', async () => {
    const message = await failure('/api/apps/stage')
    assert.match(message, /Wrong app manifest \(HTTP 400 Bad Request, manifest_error\)/)
    assert.match(message, /manifest\.json in the package is invalid/)
  })

  test('adds what a generic status means for the endpoint', async () => {
    assert.match(await failure('/api/apps/launch'), /No app with this id is installed/)
  })

  test('shows the start of a non-JSON response', async () => {
    assert.match(await failure('/html'), /not the BUSY Bar's JSON: <h1>oops<\/h1>/)
  })

  test('hints at the password on 403', async () => {
    assert.match(await failure('/forbidden'), /--password/)
  })
})

describe('errors', () => {
  test('joins the cause chain with codes, skipping repeats', () => {
    const socket = Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' })
    assert.equal(explainCause(new TypeError('fetch failed', { cause: socket })), 'fetch failed: other side closed (UND_ERR_SOCKET)')
    assert.equal(explainCause(new Error('same', { cause: new Error('same') })), 'same')
  })

  test('shows the CLI\'s own errors as they are', () => {
    assert.equal(formatError(new UserError('No BUSY Bar at 10.0.4.20')), 'No BUSY Bar at 10.0.4.20')
    assert.equal(formatError(new Error('--out needs a path')), '--out needs a path')
  })

  test('never leaves an unexpected error at one word', () => {
    const text = formatError(new TypeError('terminated', { cause: new Error('other side closed') }))
    assert.match(text, /^Unexpected error: TypeError: terminated: other side closed\n/)
    assert.match(text, /at /, 'the stack is missing')
    assert.equal(formatError('boom'), 'Unexpected error: boom')
  })
})
