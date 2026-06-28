import { computeFileHash } from "../utils/fs.js";

// ─────────────────────────────────────────────
// Deduplication — group files by MD5 hash
// ─────────────────────────────────────────────
export interface DedupResult {
  /** Files kept (first seen per hash) */
  unique:    string[];
  /** hash → [all paths with that hash] */
  dupGroups: Map<string, string[]>;
  /** hash → first-seen path */
  hashMap:   Map<string, string>;
}

export async function groupByHash(
  filePaths:       string[],
  onProgress?:     (i: number, total: number, file: string) => void
): Promise<DedupResult> {
  const hashMap   = new Map<string, string>();
  const dupGroups = new Map<string, string[]>();
  const unique:   string[] = [];

  for (let i = 0; i < filePaths.length; i++) {
    const fp = filePaths[i];
    onProgress?.(i + 1, filePaths.length, fp);
    try {
      const hash = await computeFileHash(fp);
      if (hashMap.has(hash)) {
        const existing = hashMap.get(hash)!;
        if (!dupGroups.has(hash)) dupGroups.set(hash, [existing]);
        dupGroups.get(hash)!.push(fp);
      } else {
        hashMap.set(hash, fp);
        unique.push(fp);
      }
    } catch {
      unique.push(fp); // if hashing fails, treat as unique
    }
  }

  return { unique, dupGroups, hashMap };
}
