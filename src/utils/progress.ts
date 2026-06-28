import { c, col, dim } from "./colors.js";

// ─────────────────────────────────────────────
// Progress Bar
// ─────────────────────────────────────────────
export function renderProgressBar(current: number, total: number, width = 35): string {
  const pct    = total === 0 ? 1 : current / total;
  const filled = Math.round(pct * width);
  const empty  = width - filled;
  const bar    = `${"█".repeat(filled)}${"░".repeat(empty)}`;
  const pctStr = `${Math.round(pct * 100)}%`.padStart(4);
  return `${col(c.cyan, bar)} ${col(c.bold, pctStr)} ${dim(`(${current}/${total})`)}`;
}
