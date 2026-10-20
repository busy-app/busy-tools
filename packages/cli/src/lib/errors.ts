// Turning any thrown value into text that says what went wrong: never a bare word like "terminated", always its cause and code as well.

import { c } from './colors.js'

type Detailed = Error & { code?: unknown }

/** The message and the code of one error, e.g. "other side closed (UND_ERR_SOCKET)". */
function describeOne(err: Detailed): string {
  const message = err.message || err.name
  return typeof err.code === 'string' || typeof err.code === 'number' ? `${message} (${err.code})` : message
}

/**
 * An error and the chain of its causes on one line, e.g. "fetch failed: other side closed (UND_ERR_SOCKET)".
 * @param err - Anything thrown, an Error or not.
 */
export function explainCause(err: unknown): string {
  const parts: string[] = []
  let current: unknown = err
  // Bounded, as a cause chain can loop back on itself.
  for (let depth = 0; current !== undefined && depth < 8; depth++) {
    if (!(current instanceof Error)) {
      parts.push(String(current))
      break
    }
    const part = describeOne(current)
    // fetch wraps the real reason in a generic "fetch failed"; repeating the same text adds nothing.
    if (parts.at(-1) !== part) parts.push(part)
    current = current.cause
  }
  return parts.join(': ')
}

/** An error the CLI raised itself, worded for the user, so it is shown as is. */
export class UserError extends Error {
  override name = 'UserError'
}

/**
 * The text to show for an error that ends a command. The CLI's own errors and plain `Error`s are already worded for the user; anything else is unexpected, and comes with its type, causes and stack, so that it is never just one word.
 * @param err - Anything thrown.
 */
export function formatError(err: unknown): string {
  if (err instanceof UserError) return err.message
  if (!(err instanceof Error)) return `Unexpected error: ${String(err) || 'nothing was thrown with it'}`

  const detailed = err as Detailed
  // A plain Error with no code and no cause is the CLI's own wording.
  if (err.name === 'Error' && detailed.code === undefined && err.cause === undefined) return err.message

  const text = explainCause(err)
  if (err.name === 'Error' || err.name === 'RollupError') return text
  const stack = err.stack?.split('\n').slice(1).join('\n')
  return `Unexpected error: ${err.name}: ${text}${stack ? `\n${c.dim(stack)}` : ''}`
}
