import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { IGNORED_FILES } from "../utils/fs.js";
import { extractDateFromFilename } from "../date/filename.js";
import { extractDateFromExif }     from "../date/exif.js";
import { extractDateFromVideo }    from "../date/video.js";

// ─────────────────────────────────────────────
// detectDate — try all 4 date sources in order
// ─────────────────────────────────────────────
export type DateSource =
  | "filename"
  | "exif"
  | "video_metadata"
  | "creation_date"
  | "modification_date";

export interface DetectedDate {
  date:   string;
  source: DateSource;
}

export async function detectDate(filePath: string): Promise<DetectedDate | null> {
  const filename = path.basename(filePath);

  // 1. Filename pattern
  const df = extractDateFromFilename(filename);
  if (df) return { date: df, source: "filename" };

  // 2. EXIF metadata
  const de = await extractDateFromExif(filePath);
  if (de) return { date: de, source: "exif" };

  // 3. Video atom
  const dv = await extractDateFromVideo(filePath);
  if (dv) return { date: dv, source: "video_metadata" };

  // 4. Filesystem timestamps
  try {
    const s = await stat(filePath);
    const t = Math.min(s.birthtimeMs || Infinity, s.mtimeMs || Infinity);
    if (t !== Infinity) {
      const d      = new Date(t);
      const date   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const source = s.birthtimeMs <= s.mtimeMs ? "creation_date" : "modification_date";
      return { date, source };
    }
  } catch {}

  return null;
}

// ─────────────────────────────────────────────
// scanFiles — recursive directory scan
// ─────────────────────────────────────────────
export async function scanFiles(
  dir:       string,
  recursive: boolean,
  extFilter: Set<string> | null,
  rootDir:   string
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_FILES.has(entry.name)) continue;
      // Skip date folders rapikan itself created
      if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(entry.name)) continue;
      if (/^\d{4}$/.test(entry.name)) continue;
      if (recursive) {
        const sub = await scanFiles(fullPath, recursive, extFilter, rootDir);
        files.push(...sub);
      }
      continue;
    }

    if (!entry.isFile())                    continue;
    if (IGNORED_FILES.has(entry.name))      continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (extFilter && !extFilter.has(ext))   continue;

    files.push(fullPath);
  }

  return files;
}

// ─────────────────────────────────────────────
// scanAllFiles — no filter, used by delete ops
// ─────────────────────────────────────────────
export async function scanAllFiles(dir: string, recursive: boolean): Promise<string[]> {
  return scanFiles(dir, recursive, null, dir);
}
