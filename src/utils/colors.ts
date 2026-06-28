// ─────────────────────────────────────────────
// ANSI Color & Style Helpers
// ─────────────────────────────────────────────
export const c = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  blue:    "\x1b[34m",
  magenta: "\x1b[35m",
  cyan:    "\x1b[36m",
  white:   "\x1b[37m",
  red:     "\x1b[31m",
  bgGreen: "\x1b[42m",
  bgBlue:  "\x1b[44m",
  gray:    "\x1b[90m",
};

export const col     = (color: string, text: string) => `${color}${text}${c.reset}`;
export const bold    = (t: string) => col(c.bold,    t);
export const green   = (t: string) => col(c.green,   t);
export const yellow  = (t: string) => col(c.yellow,  t);
export const red     = (t: string) => col(c.red,     t);
export const cyan    = (t: string) => col(c.cyan,    t);
export const magenta = (t: string) => col(c.magenta, t);
export const blue    = (t: string) => col(c.blue,    t);
export const gray    = (t: string) => col(c.gray,    t);
export const dim     = (t: string) => col(c.dim,     t);
