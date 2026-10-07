// Escape codes only reach an interactive terminal: piped or redirected output, and NO_COLOR, get plain text. FORCE_COLOR turns them on regardless.
const enabled = process.env.FORCE_COLOR ? true : process.stdout.isTTY && !process.env.NO_COLOR;

const wrap = (code: number) => (s: string) => (enabled ? `\x1b[${code}m${s}\x1b[0m` : s);

export const c = {
  bold: wrap(1),
  dim: wrap(2),
  red: wrap(31),
  yellow: wrap(33),
  cyan: wrap(36)
};

/** One line of a help listing: the command or option in color, padded so the descriptions line up. */
export const helpRow = (name: string, text: string) => `  ${c.cyan(name.padEnd(24))} ${text}`;
