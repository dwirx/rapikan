import { readdir, mkdir, rename, readFile, writeFile, rmdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { bold, green, red, dim, cyan, magenta, yellow } from "../utils/colors.js";
import { renderProgressBar } from "../utils/progress.js";
import { getUniqueDest, formatTargetPath } from "../utils/fs.js";
import { detectDate, DateSource } from "./scanner.js";
import { sourceLabel } from "../cli/banner.js";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface FileMoveInfo {
  originalPath: string;
  filename:     string;
  detectedDate: string;
  source:       DateSource;
  targetDir:    string;
}

export interface HistoryEntry {
  from:      string;
  to:        string;
  timestamp: string;
}

// ─────────────────────────────────────────────
// Organize — move (or copy) files into date folders
// ─────────────────────────────────────────────
export async function organizeFiles(
  moves:      FileMoveInfo[],
  targetDir:  string,
  doCopy:     boolean,
): Promise<{ ok: number; fail: number; history: HistoryEntry[] }> {
  let ok = 0, fail = 0;
  const history: HistoryEntry[] = [];
  const ts = new Date().toISOString();

  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    process.stdout.write(
      `\r  ${renderProgressBar(i + 1, moves.length)}  ${dim(m.filename.slice(0, 25).padEnd(25))}`
    );

    try {
      await mkdir(m.targetDir, { recursive: true });
      const dest = getUniqueDest(m.targetDir, m.filename);
      if (doCopy) {
        await copyFile(m.originalPath, dest);
      } else {
        await rename(m.originalPath, dest);
      }
      history.push({ from: m.originalPath, to: dest, timestamp: ts });
      ok++;
    } catch {
      fail++;
    }
  }

  process.stdout.write("\r" + " ".repeat(80) + "\r");
  return { ok, fail, history };
}

// ─────────────────────────────────────────────
// Build preview table (groups by date)
// ─────────────────────────────────────────────
export function buildPreview(
  moves:     FileMoveInfo[],
  targetDir: string,
  format:    string,
): Map<string, FileMoveInfo[]> {
  const byDate = new Map<string, FileMoveInfo[]>();
  for (const m of moves) {
    if (!byDate.has(m.detectedDate)) byDate.set(m.detectedDate, []);
    byDate.get(m.detectedDate)!.push(m);
  }
  return byDate;
}

export function printPreview(
  moves:     FileMoveInfo[],
  byDate:    Map<string, FileMoveInfo[]>,
  targetDir: string,
  format:    string,
  doCopy:    boolean,
): void {
  const sortedDates = [...byDate.keys()].sort();
  const verb        = doCopy ? "Penyalinan" : "Pemindahan";
  console.log(bold(`  📋 Rencana ${verb} — ${moves.length} file ke ${sortedDates.length} folder:\n`));

  for (const date of sortedDates) {
    const items  = byDate.get(date)!;
    const relDir = path.relative(targetDir, formatTargetPath(targetDir, date, format));
    console.log(`  ${bold(green("▸"))} ${bold(relDir + path.sep)}  ${dim(`(${items.length} file)`)}`);
    for (const m of items) {
      const relSrc = dim(path.relative(targetDir, m.originalPath));
      console.log(`    ${dim("•")} ${relSrc}  ${sourceLabel(m.source)}`);
    }
  }
}

// ─────────────────────────────────────────────
// Save organize history log
// ─────────────────────────────────────────────
export async function saveHistory(targetDir: string, history: HistoryEntry[]): Promise<void> {
  await writeFile(
    path.join(targetDir, ".rapikan-history.json"),
    JSON.stringify(history, null, 2),
    "utf-8"
  );
}
