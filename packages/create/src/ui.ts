// The generator's console output: clack's prompts in a terminal, and matching formatting non-interactively, where answers are read line by line from stdin.

import { spawn } from 'node:child_process'
import { createInterface, type Interface } from 'node:readline'
import { cancel, isCancel, log, text } from '@clack/prompts'

/** Prompts need a terminal on both ends: keys come from stdin, and clack redraws stdout. */
export const interactive = process.stdin.isTTY === true && process.stdout.isTTY === true

// Escape codes only reach a terminal: piped output and NO_COLOR get plain text, FORCE_COLOR turns them on regardless.
const colors = process.env.FORCE_COLOR ? true : process.stdout.isTTY === true && !process.env.NO_COLOR
const wrap = (code: number) => (s: string) => (colors ? `\x1b[${code}m${s}\x1b[0m` : s)

export const c = {
  bold: wrap(1),
  dim: wrap(2),
}

/** Ends the run the way nuxi does when a prompt is cancelled with Ctrl+C. */
export function abort(): never {
  cancel('Operation cancelled.')
  process.exit(1)
}

/** Displays an answer provided via a flag or piped input, matching how clack formats submitted answers. */
export function answered(message: string, value: string): void {
  log.step(`${message}\n${c.dim(value || '(empty)')}`)
}

export type Question = {
  message: string
  /** Taken on Enter, and shown as the placeholder. */
  fallback?: string | undefined
  /** An error message for a bad answer, or null for a good one. */
  validate?: ((value: string) => string | null) | undefined
}

let rl: Interface | undefined
let lines: AsyncIterator<string> | undefined

/** The next line of piped input. A line iterator rather than readline/promises: question() resolves only once when stdin is a pipe. */
function nextLine(): Promise<IteratorResult<string>> {
  rl ??= createInterface({ input: process.stdin })
  lines ??= rl[Symbol.asyncIterator]()
  return lines.next()
}

/** Releases stdin once all questions are answered, so the process can exit. */
export function closeInput(): void {
  rl?.close()
}

/**
 * Asks one question: via an interactive clack prompt in a terminal, or from the next line of stdin when non-interactive, where invalid answers are reported and the next line is read.
 * @param question - The question, its default and its check.
 * @returns The trimmed answer, or the default for an empty one.
 */
export async function ask({ message, fallback, validate }: Question): Promise<string> {
  const settle = (value: string | undefined) => value?.trim() || fallback || ''

  if (interactive) {
    const value = await text({
      message,
      ...(fallback ? { placeholder: fallback, defaultValue: fallback } : {}),
      validate: (value) => validate?.(settle(value)) ?? undefined,
    })
    if (isCancel(value)) abort()
    return settle(value)
  }

  for (;;) {
    const line = await nextLine()
    const answer = settle(line.done ? undefined : line.value)
    const error = validate?.(answer)
    if (!error) {
      answered(message, answer)
      return answer
    }
    // End of input: there is no chance to correct the answer.
    if (line.done) throw new Error(`${message}: ${error}`)
    log.error(`${message}: ${error}`)
  }
}

/**
 * Runs a command silently while displaying a spinner; output is buffered and reported if the command fails.
 * @param cmd - The command, e.g. `pnpm`.
 * @param args - Its arguments.
 * @param cwd - Where to run it.
 * @returns Whether it succeeded, and what it printed to stdout and stderr together.
 */
export function runQuietly(cmd: string, args: string[], cwd: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()))
    // A missing command never starts, so it has no exit code to report.
    child.on('error', (err) => resolve({ ok: false, output: err.message }))
    child.on('close', (code) => resolve({ ok: code === 0, output }))
  })
}
