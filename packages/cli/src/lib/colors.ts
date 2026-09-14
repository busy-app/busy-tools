const wrap = (code: number) => (s: string) => `\x1b[${code}m${s}\x1b[0m`;

export const c = {
  bold: wrap(1),
  dim: wrap(2),
  red: wrap(31)
};
