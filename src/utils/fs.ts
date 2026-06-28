import { existsSync, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
export const IGNORED_FILES = new Set([
  "index.ts",
  "package.json",
  "tsconfig.json",
  "bun.lock",
  "node_modules",
  ".git",
  ".gitignore",
  ".agents",
  ".gemini",
  ".rapikan-history.json",
  ".rapikan-delete-log.json",
  "docs",
  "dist",
  "src",
  "build.ts",
]);

// ─────────────────────────────────────────────
// Unique destination path (avoid overwrite)
// ─────────────────────────────────────────────
export function getUniqueDest(destDir: string, filename: string): string {
  let dest = path.join(destDir, filename);
  if (!existsSync(dest)) return dest;
  const ext  = path.extname(filename);
  const base = path.basename(filename, ext);
  let n = 1;
  while (true) {
    const p = path.join(destDir, `${base}_(${n})${ext}`);
    if (!existsSync(p)) return p;
    n++;
  }
}

// ─────────────────────────────────────────────
// MD5 hash for dedup
// ─────────────────────────────────────────────
export async function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash   = createHash("md5");
    const stream = createReadStream(filePath, { highWaterMark: 65536 });
    stream.on("data",  (chunk) => hash.update(chunk));
    stream.on("end",   ()      => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

// ─────────────────────────────────────────────
// Format folder path from date string
// ─────────────────────────────────────────────
export function formatTargetPath(baseDir: string, dateStr: string, format: string): string {
  const [year, month, day] = dateStr.split("-");
  let rel: string;
  switch (format) {
    case "YYYY/MM/DD": rel = path.join(year, month, day); break;
    case "YYYY/MM":    rel = path.join(year, month);      break;
    case "YYYY":       rel = year;                        break;
    default:           rel = dateStr;                     // YYYY-MM-DD (flat)
  }
  return path.join(baseDir, rel);
}
