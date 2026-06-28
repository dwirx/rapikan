import { readdir, stat, rm, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import {
  bold, green, yellow, red, cyan, magenta, blue, gray, dim
} from "../utils/colors.js";
import { computeFileHash } from "../utils/fs.js";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1_024)         return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

async function confirm(rl: readline.Interface, prompt: string): Promise<boolean> {
  return new Promise((resolve) =>
    rl.question(prompt, (ans) => resolve(ans.toLowerCase().trim() === "y"))
  );
}

async function appendDeleteLog(targetDir: string, entries: object[]): Promise<void> {
  const logFile = path.join(targetDir, ".rapikan-delete-log.json");
  let existing: object[] = [];
  try {
    if (existsSync(logFile)) {
      existing = JSON.parse(await readFile(logFile, "utf-8"));
    }
  } catch {}
  await writeFile(logFile, JSON.stringify([...existing, ...entries], null, 2), "utf-8");
}

// ─────────────────────────────────────────────
// Recursive directory scanner (returns dirs & files)
// ─────────────────────────────────────────────
async function scanDirsRecursive(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const full = path.join(dir, e.name);
      results.push(full);
      const sub = await scanDirsRecursive(full);
      results.push(...sub);
    }
  } catch {}
  return results;
}

async function scanFilesAll(dir: string, recursive: boolean): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (recursive) {
          const sub = await scanFilesAll(full, true);
          results.push(...sub);
        }
      } else if (e.isFile()) {
        // Skip log files rapikan creates
        if (e.name === ".rapikan-history.json" || e.name === ".rapikan-delete-log.json") continue;
        results.push(full);
      }
    }
  } catch {}
  return results;
}

// ─────────────────────────────────────────────
// 1. cleanEmptyFolders
// ─────────────────────────────────────────────
export async function cleanEmptyFolders(
  targetDir:   string,
  dryRun:      boolean,
  skipConfirm: boolean,
  rl:          readline.Interface,
): Promise<void> {
  console.log(bold(cyan("\n  🗂  Mencari folder kosong...\n")));

  const allDirs  = await scanDirsRecursive(targetDir);
  const emptyDirs: string[] = [];

  for (const d of allDirs) {
    try {
      const entries = await readdir(d);
      if (entries.length === 0) emptyDirs.push(d);
    } catch {}
  }

  if (emptyDirs.length === 0) {
    console.log(green("  ✓ Tidak ada folder kosong ditemukan.\n"));
    return;
  }

  console.log(bold(`  🗑  ${emptyDirs.length} folder kosong ditemukan:\n`));
  for (const d of emptyDirs) {
    console.log(`    ${red("✗")} ${dim(path.relative(targetDir, d))}`);
  }

  if (dryRun) {
    console.log(bold(yellow("\n  ✔ DRY-RUN — Tidak ada folder yang dihapus.\n")));
    return;
  }

  const go = skipConfirm ||
    await confirm(rl, bold(`\n  Hapus ${emptyDirs.length} folder kosong? (y/n): `));

  if (!go) {
    console.log(yellow("\n  Dibatalkan. Tidak ada folder yang dihapus.\n"));
    return;
  }

  let deleted = 0, failed = 0;
  const logEntries: object[] = [];
  const ts = new Date().toISOString();

  for (const d of emptyDirs) {
    try {
      await rm(d, { recursive: true, force: true });
      console.log(`  ${green("✓")} ${dim(path.relative(targetDir, d))}`);
      logEntries.push({ action: "delete_empty_folder", path: d, timestamp: ts });
      deleted++;
    } catch (err: any) {
      console.log(`  ${red("✗")} ${dim(path.relative(targetDir, d))} — ${err.message}`);
      failed++;
    }
  }

  await appendDeleteLog(targetDir, logEntries);

  console.log(`\n  ${bold(green("✔ CLEAN SELESAI"))}`);
  console.log(`  ${green("✓")} Folder dihapus : ${bold(String(deleted))}`);
  if (failed > 0) console.log(`  ${red("✗")} Gagal          : ${bold(red(String(failed)))}`);
  console.log(`  ${dim("Log:")} ${dim(".rapikan-delete-log.json")}\n`);
}

// ─────────────────────────────────────────────
// 2. deleteDuplicates
// ─────────────────────────────────────────────
export async function deleteDuplicates(
  targetDir:   string,
  recursive:   boolean,
  dryRun:      boolean,
  skipConfirm: boolean,
  rl:          readline.Interface,
): Promise<void> {
  console.log(bold(magenta("\n  🧬 Memindai duplikat (MD5 hash)...\n")));

  const files = await scanFilesAll(targetDir, recursive);
  if (files.length === 0) {
    console.log(yellow("  ⚠ Tidak ada file untuk diperiksa.\n"));
    return;
  }

  // Compute hashes
  const hashMap   = new Map<string, string>();   // hash → first-seen path
  const dupGroups = new Map<string, string[]>(); // hash → all paths

  for (let i = 0; i < files.length; i++) {
    const fp = files[i];
    process.stdout.write(
      `\r  ${cyan("Hashing")} [${i + 1}/${files.length}] ${dim(path.basename(fp).slice(0, 40).padEnd(40))}`
    );
    try {
      const hash = await computeFileHash(fp);
      if (hashMap.has(hash)) {
        if (!dupGroups.has(hash)) dupGroups.set(hash, [hashMap.get(hash)!]);
        dupGroups.get(hash)!.push(fp);
      } else {
        hashMap.set(hash, fp);
      }
    } catch {}
  }
  process.stdout.write("\r" + " ".repeat(80) + "\r");

  if (dupGroups.size === 0) {
    console.log(green("  ✓ Tidak ada duplikat ditemukan.\n"));
    return;
  }

  // For each dup group: keep oldest birthtime, delete the rest
  const toDelete: string[] = [];
  let totalSaving = 0;

  console.log(bold(magenta(`  🔍 ${dupGroups.size} grup duplikat ditemukan:\n`)));

  for (const [hash, paths] of dupGroups) {
    console.log(`  ${magenta("▸")} Hash: ${dim(hash.slice(0, 12))}...`);

    // Get stat for each file to find oldest
    const withStat = await Promise.all(
      paths.map(async (p) => {
        try {
          const s = await stat(p);
          return { path: p, birthtime: s.birthtimeMs || s.ctimeMs };
        } catch {
          return { path: p, birthtime: Date.now() };
        }
      })
    );

    withStat.sort((a, b) => a.birthtime - b.birthtime); // oldest first
    const keeper = withStat[0];

    for (const { path: p, birthtime } of withStat) {
      const isKeeper = p === keeper.path;
      let fsize = 0;
      try { fsize = (await stat(p)).size; } catch {}
      const label = isKeeper ? green("  ✓ SIMPAN") : red("  ✗ HAPUS ");
      console.log(`    ${label} ${dim(path.relative(targetDir, p))} ${gray(`(${fmtBytes(fsize)})`)}`);
      if (!isKeeper) {
        toDelete.push(p);
        totalSaving += fsize;
      }
    }
    console.log("");
  }

  console.log(bold(`  💾 Total potensi ruang terbebas: ${green(fmtBytes(totalSaving))}`));

  if (dryRun) {
    console.log(bold(yellow("\n  ✔ DRY-RUN — Tidak ada file yang dihapus.\n")));
    return;
  }

  const go = skipConfirm ||
    await confirm(rl, bold(`\n  Hapus ${toDelete.length} file duplikat? (y/n): `));

  if (!go) {
    console.log(yellow("\n  Dibatalkan.\n"));
    return;
  }

  let deleted = 0, failed = 0, savedBytes = 0;
  const logEntries: object[] = [];
  const ts = new Date().toISOString();

  for (const fp of toDelete) {
    try {
      let fsize = 0;
      try { fsize = (await stat(fp)).size; } catch {}
      await rm(fp, { force: true });
      logEntries.push({ action: "delete_duplicate", path: fp, size: fsize, timestamp: ts });
      savedBytes += fsize;
      deleted++;
    } catch (err: any) {
      console.log(`  ${red("✗")} ${dim(fp)}: ${err.message}`);
      failed++;
    }
  }

  await appendDeleteLog(targetDir, logEntries);

  console.log(`\n  ${bold(green("✔ DELETE DUPES SELESAI"))}`);
  console.log(`  ${green("✓")} File dihapus       : ${bold(String(deleted))}`);
  console.log(`  ${green("✓")} Ruang terbebas     : ${bold(green(fmtBytes(savedBytes)))}`);
  if (failed > 0) console.log(`  ${red("✗")} Gagal              : ${bold(red(String(failed)))}`);
  console.log(`  ${dim("Log:")} ${dim(".rapikan-delete-log.json")}\n`);
}

// ─────────────────────────────────────────────
// 3. deleteWhere — criteria-based delete
// ─────────────────────────────────────────────
interface Criteria {
  type:  "size" | "age" | "ext";
  op?:   "<" | ">";
  value?: number;    // bytes for size, ms for age
  exts?:  Set<string>;
}

function parseCriteria(raw: string): Criteria | null {
  raw = raw.trim();

  // size<1MB | size>10MB | size<500KB
  const sizeMatch = raw.match(/^size([<>])([\d.]+)(KB|MB|GB)$/i);
  if (sizeMatch) {
    const op  = sizeMatch[1] as "<" | ">";
    const num = parseFloat(sizeMatch[2]);
    const unit = sizeMatch[3].toUpperCase();
    let bytes = num;
    if      (unit === "KB") bytes = num * 1_024;
    else if (unit === "MB") bytes = num * 1_048_576;
    else if (unit === "GB") bytes = num * 1_073_741_824;
    return { type: "size", op, value: bytes };
  }

  // age>30d | age>1y | age>6m
  const ageMatch = raw.match(/^age([<>])(\d+)(d|m|y)$/i);
  if (ageMatch) {
    const op   = ageMatch[1] as "<" | ">";
    const num  = parseInt(ageMatch[2]);
    const unit = ageMatch[3].toLowerCase();
    let ms = num * 86_400_000; // default days
    if      (unit === "m") ms = num * 30 * 86_400_000;
    else if (unit === "y") ms = num * 365 * 86_400_000;
    return { type: "age", op, value: ms };
  }

  // ext=.tmp,.log,.DS_Store
  const extMatch = raw.match(/^ext=(.+)$/i);
  if (extMatch) {
    const exts = new Set(
      extMatch[1].split(",").map((e) => (e.startsWith(".") ? e.toLowerCase() : `.${e.toLowerCase()}`))
    );
    return { type: "ext", exts };
  }

  return null;
}

export async function deleteWhere(
  targetDir:   string,
  criteriaStr: string,
  recursive:   boolean,
  dryRun:      boolean,
  skipConfirm: boolean,
  rl:          readline.Interface,
): Promise<void> {
  const criteria = parseCriteria(criteriaStr);
  if (!criteria) {
    console.log(red(`\n  ✗ Kriteria tidak valid: "${criteriaStr}"`));
    console.log(dim("    Contoh: size<1MB  |  age>30d  |  ext=.tmp,.log\n"));
    return;
  }

  console.log(bold(blue(`\n  🔎 Mencari file dengan kriteria: ${cyan(criteriaStr)}\n`)));

  const allFiles = await scanFilesAll(targetDir, recursive);
  const matched: Array<{ path: string; size: number; age: number }> = [];
  const now      = Date.now();

  for (const fp of allFiles) {
    try {
      const s    = await stat(fp);
      const size = s.size;
      const age  = now - (s.birthtimeMs || s.ctimeMs || s.mtimeMs || now);

      let match = false;
      if (criteria.type === "size" && criteria.op && criteria.value !== undefined) {
        match = criteria.op === "<" ? size < criteria.value : size > criteria.value;
      } else if (criteria.type === "age" && criteria.op && criteria.value !== undefined) {
        match = criteria.op === "<" ? age < criteria.value : age > criteria.value;
      } else if (criteria.type === "ext" && criteria.exts) {
        match = criteria.exts.has(path.extname(fp).toLowerCase());
      }

      if (match) matched.push({ path: fp, size, age });
    } catch {}
  }

  if (matched.length === 0) {
    console.log(yellow("  ⚠ Tidak ada file yang cocok dengan kriteria tersebut.\n"));
    return;
  }

  const totalSize = matched.reduce((s, f) => s + f.size, 0);
  console.log(bold(`  📋 ${matched.length} file cocok dengan kriteria ${cyan(criteriaStr)}:\n`));

  for (const f of matched) {
    const ageDays = Math.round(f.age / 86_400_000);
    const relPath = path.relative(targetDir, f.path);
    console.log(
      `    ${red("✗")} ${dim(relPath)}  ${gray(`(${fmtBytes(f.size)}, ${ageDays}d lalu)`)}`
    );
  }

  console.log(bold(`\n  💾 Total: ${red(fmtBytes(totalSize))} akan dihapus`));

  if (dryRun) {
    console.log(bold(yellow("\n  ✔ DRY-RUN — Tidak ada file yang dihapus.\n")));
    return;
  }

  const go = skipConfirm ||
    await confirm(rl, bold(`\n  Hapus ${matched.length} file? (y/n): `));

  if (!go) {
    console.log(yellow("\n  Dibatalkan.\n"));
    return;
  }

  let deleted = 0, failed = 0, savedBytes = 0;
  const logEntries: object[] = [];
  const ts = new Date().toISOString();

  for (const f of matched) {
    try {
      await rm(f.path, { force: true });
      logEntries.push({
        action:    "delete_where",
        criteria:  criteriaStr,
        path:      f.path,
        size:      f.size,
        timestamp: ts,
      });
      savedBytes += f.size;
      deleted++;
    } catch (err: any) {
      console.log(`  ${red("✗")} ${dim(f.path)}: ${err.message}`);
      failed++;
    }
  }

  await appendDeleteLog(targetDir, logEntries);

  console.log(`\n  ${bold(green("✔ DELETE WHERE SELESAI"))}`);
  console.log(`  ${green("✓")} File dihapus      : ${bold(String(deleted))}`);
  console.log(`  ${green("✓")} Ruang terbebas    : ${bold(green(fmtBytes(savedBytes)))}`);
  if (failed > 0) console.log(`  ${red("✗")} Gagal             : ${bold(red(String(failed)))}`);
  console.log(`  ${dim("Log:")} ${dim(".rapikan-delete-log.json")}\n`);
}

// ─────────────────────────────────────────────
// 4. deleteManual — hapus file/folder apapun
// ─────────────────────────────────────────────

interface RmTarget {
  resolvedPath: string;
  exists: boolean;
  isDir: boolean;
  size: number;     // 0 for directories (estimated)
  itemCount: number; // file/folder count inside if dir
}

async function getTargetInfo(p: string): Promise<RmTarget> {
  const resolvedPath = path.resolve(p);
  if (!existsSync(resolvedPath)) {
    return { resolvedPath, exists: false, isDir: false, size: 0, itemCount: 0 };
  }
  try {
    const s = await stat(resolvedPath);
    if (s.isDirectory()) {
      let count = 0;
      try {
        const entries = await readdir(resolvedPath, { recursive: true } as any);
        count = (entries as string[]).length;
      } catch {}
      return { resolvedPath, exists: true, isDir: true, size: 0, itemCount: count };
    }
    return { resolvedPath, exists: true, isDir: false, size: s.size, itemCount: 1 };
  } catch {
    return { resolvedPath, exists: false, isDir: false, size: 0, itemCount: 0 };
  }
}

export async function deleteManual(
  targets:     string[],
  dryRun:      boolean,
  skipConfirm: boolean,
  rl:          readline.Interface,
  logDir?:     string,
): Promise<void> {
  if (targets.length === 0) {
    console.log(red("\n  ✗ Tidak ada target yang diberikan."));
    console.log(dim("    Contoh: rapikan --rm ./file.mp4 ./folder-lama ./foto.jpg\n"));
    return;
  }

  console.log(bold(red(`\n  🗑  Mode Hapus Manual — ${targets.length} target:\n`)));

  // Resolve and inspect each target
  const infos: RmTarget[] = [];
  for (const t of targets) {
    const info = await getTargetInfo(t);
    infos.push(info);
  }

  // Preview table
  let totalFiles = 0;
  let totalSize = 0;
  const validTargets: RmTarget[] = [];

  for (const info of infos) {
    if (!info.exists) {
      console.log(`  ${yellow("⚠")} ${dim(info.resolvedPath)}  ${yellow("(tidak ditemukan, dilewati)")}`);
      continue;
    }

    const typeLabel = info.isDir
      ? cyan(`[FOLDER] ${info.itemCount} item di dalamnya`)
      : gray(`[FILE] ${fmtBytes(info.size)}`);

    console.log(`  ${red("✗")} ${bold(path.basename(info.resolvedPath))}  ${typeLabel}`);
    console.log(`    ${dim(info.resolvedPath)}`);

    validTargets.push(info);
    totalFiles += info.isDir ? info.itemCount : 1;
    totalSize  += info.size;
  }

  if (validTargets.length === 0) {
    console.log(yellow("\n  ⚠ Semua target tidak ditemukan. Tidak ada yang dihapus.\n"));
    return;
  }

  console.log("");
  console.log(bold(`  📊 Ringkasan:`));
  console.log(`  ${red("✗")} Target valid      : ${bold(red(String(validTargets.length)))}`);
  if (totalSize > 0)
    console.log(`  ${red("✗")} Total ukuran file : ${bold(red(fmtBytes(totalSize)))}`);
  if (validTargets.some(t => t.isDir))
    console.log(`  ${yellow("⚠")} ${bold(yellow("Folder dan SEMUA isinya akan dihapus permanen!"))}`);

  if (dryRun) {
    console.log(bold(yellow("\n  ✔ DRY-RUN — Tidak ada yang dihapus.\n")));
    return;
  }

  const go = skipConfirm ||
    await confirm(rl, bold(red(`\n  ⚠ Yakin hapus ${validTargets.length} target? TIDAK BISA DIBATALKAN! (y/n): `)));

  if (!go) {
    console.log(yellow("\n  Dibatalkan. Tidak ada yang dihapus.\n"));
    return;
  }

  console.log("");
  let deleted = 0, failed = 0;
  const logEntries: object[] = [];
  const ts = new Date().toISOString();

  for (const info of validTargets) {
    try {
      await rm(info.resolvedPath, { recursive: true, force: true });
      const icon = info.isDir ? "📁" : "📄";
      console.log(`  ${green("✓")} ${icon} ${bold(path.basename(info.resolvedPath))}  ${dim("dihapus")}`);
      logEntries.push({
        action:    "delete_manual",
        path:      info.resolvedPath,
        isDir:     info.isDir,
        itemCount: info.itemCount,
        size:      info.size,
        timestamp: ts,
      });
      deleted++;
    } catch (err: any) {
      console.log(`  ${red("✗")} ${path.basename(info.resolvedPath)}: ${err.message}`);
      failed++;
    }
  }

  // Save log to the first target's parent directory (or cwd)
  const logTarget = logDir ?? path.dirname(validTargets[0].resolvedPath);
  try {
    await appendDeleteLog(logTarget, logEntries);
  } catch {}

  console.log(`\n  ${bold(green("✔ HAPUS SELESAI"))}`);
  console.log(`  ${green("✓")} Berhasil dihapus  : ${bold(String(deleted))}`);
  if (failed > 0) console.log(`  ${red("✗")} Gagal             : ${bold(red(String(failed)))}`);
  console.log(`  ${dim("Log:")} ${dim(".rapikan-delete-log.json")}\n`);
}


// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmtBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1_024)         return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

async function confirm(rl: readline.Interface, prompt: string): Promise<boolean> {
  return new Promise((resolve) =>
    rl.question(prompt, (ans) => resolve(ans.toLowerCase().trim() === "y"))
  );
}

async function appendDeleteLog(targetDir: string, entries: object[]): Promise<void> {
  const logFile = path.join(targetDir, ".rapikan-delete-log.json");
  let existing: object[] = [];
  try {
    if (existsSync(logFile)) {
      existing = JSON.parse(await readFile(logFile, "utf-8"));
    }
  } catch {}
  await writeFile(logFile, JSON.stringify([...existing, ...entries], null, 2), "utf-8");
}

// ─────────────────────────────────────────────
// Recursive directory scanner (returns dirs & files)
// ─────────────────────────────────────────────
async function scanDirsRecursive(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const full = path.join(dir, e.name);
      results.push(full);
      const sub = await scanDirsRecursive(full);
      results.push(...sub);
    }
  } catch {}
  return results;
}

async function scanFilesAll(dir: string, recursive: boolean): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (recursive) {
          const sub = await scanFilesAll(full, true);
          results.push(...sub);
        }
      } else if (e.isFile()) {
        // Skip log files rapikan creates
        if (e.name === ".rapikan-history.json" || e.name === ".rapikan-delete-log.json") continue;
        results.push(full);
      }
    }
  } catch {}
  return results;
}

// ─────────────────────────────────────────────
// 1. cleanEmptyFolders
// ─────────────────────────────────────────────
export async function cleanEmptyFolders(
  targetDir:   string,
  dryRun:      boolean,
  skipConfirm: boolean,
  rl:          readline.Interface,
): Promise<void> {
  console.log(bold(cyan("\n  🗂  Mencari folder kosong...\n")));

  const allDirs  = await scanDirsRecursive(targetDir);
  const emptyDirs: string[] = [];

  for (const d of allDirs) {
    try {
      const entries = await readdir(d);
      if (entries.length === 0) emptyDirs.push(d);
    } catch {}
  }

  if (emptyDirs.length === 0) {
    console.log(green("  ✓ Tidak ada folder kosong ditemukan.\n"));
    return;
  }

  console.log(bold(`  🗑  ${emptyDirs.length} folder kosong ditemukan:\n`));
  for (const d of emptyDirs) {
    console.log(`    ${red("✗")} ${dim(path.relative(targetDir, d))}`);
  }

  if (dryRun) {
    console.log(bold(yellow("\n  ✔ DRY-RUN — Tidak ada folder yang dihapus.\n")));
    return;
  }

  const go = skipConfirm ||
    await confirm(rl, bold(`\n  Hapus ${emptyDirs.length} folder kosong? (y/n): `));

  if (!go) {
    console.log(yellow("\n  Dibatalkan. Tidak ada folder yang dihapus.\n"));
    return;
  }

  let deleted = 0, failed = 0;
  const logEntries: object[] = [];
  const ts = new Date().toISOString();

  for (const d of emptyDirs) {
    try {
      await rm(d, { recursive: true, force: true });
      console.log(`  ${green("✓")} ${dim(path.relative(targetDir, d))}`);
      logEntries.push({ action: "delete_empty_folder", path: d, timestamp: ts });
      deleted++;
    } catch (err: any) {
      console.log(`  ${red("✗")} ${dim(path.relative(targetDir, d))} — ${err.message}`);
      failed++;
    }
  }

  await appendDeleteLog(targetDir, logEntries);

  console.log(`\n  ${bold(green("✔ CLEAN SELESAI"))}`);
  console.log(`  ${green("✓")} Folder dihapus : ${bold(String(deleted))}`);
  if (failed > 0) console.log(`  ${red("✗")} Gagal          : ${bold(red(String(failed)))}`);
  console.log(`  ${dim("Log:")} ${dim(".rapikan-delete-log.json")}\n`);
}

// ─────────────────────────────────────────────
// 2. deleteDuplicates
// ─────────────────────────────────────────────
export async function deleteDuplicates(
  targetDir:   string,
  recursive:   boolean,
  dryRun:      boolean,
  skipConfirm: boolean,
  rl:          readline.Interface,
): Promise<void> {
  console.log(bold(magenta("\n  🧬 Memindai duplikat (MD5 hash)...\n")));

  const files = await scanFilesAll(targetDir, recursive);
  if (files.length === 0) {
    console.log(yellow("  ⚠ Tidak ada file untuk diperiksa.\n"));
    return;
  }

  // Compute hashes
  const hashMap   = new Map<string, string>();   // hash → first-seen path
  const dupGroups = new Map<string, string[]>(); // hash → all paths

  for (let i = 0; i < files.length; i++) {
    const fp = files[i];
    process.stdout.write(
      `\r  ${cyan("Hashing")} [${i + 1}/${files.length}] ${dim(path.basename(fp).slice(0, 40).padEnd(40))}`
    );
    try {
      const hash = await computeFileHash(fp);
      if (hashMap.has(hash)) {
        if (!dupGroups.has(hash)) dupGroups.set(hash, [hashMap.get(hash)!]);
        dupGroups.get(hash)!.push(fp);
      } else {
        hashMap.set(hash, fp);
      }
    } catch {}
  }
  process.stdout.write("\r" + " ".repeat(80) + "\r");

  if (dupGroups.size === 0) {
    console.log(green("  ✓ Tidak ada duplikat ditemukan.\n"));
    return;
  }

  // For each dup group: keep oldest birthtime, delete the rest
  const toDelete: string[] = [];
  let totalSaving = 0;

  console.log(bold(magenta(`  🔍 ${dupGroups.size} grup duplikat ditemukan:\n`)));

  for (const [hash, paths] of dupGroups) {
    console.log(`  ${magenta("▸")} Hash: ${dim(hash.slice(0, 12))}...`);

    // Get stat for each file to find oldest
    const withStat = await Promise.all(
      paths.map(async (p) => {
        try {
          const s = await stat(p);
          return { path: p, birthtime: s.birthtimeMs || s.ctimeMs };
        } catch {
          return { path: p, birthtime: Date.now() };
        }
      })
    );

    withStat.sort((a, b) => a.birthtime - b.birthtime); // oldest first
    const keeper = withStat[0];

    for (const { path: p, birthtime } of withStat) {
      const isKeeper = p === keeper.path;
      let fsize = 0;
      try { fsize = (await stat(p)).size; } catch {}
      const label = isKeeper ? green("  ✓ SIMPAN") : red("  ✗ HAPUS ");
      console.log(`    ${label} ${dim(path.relative(targetDir, p))} ${gray(`(${fmtBytes(fsize)})`)}`);
      if (!isKeeper) {
        toDelete.push(p);
        totalSaving += fsize;
      }
    }
    console.log("");
  }

  console.log(bold(`  💾 Total potensi ruang terbebas: ${green(fmtBytes(totalSaving))}`));

  if (dryRun) {
    console.log(bold(yellow("\n  ✔ DRY-RUN — Tidak ada file yang dihapus.\n")));
    return;
  }

  const go = skipConfirm ||
    await confirm(rl, bold(`\n  Hapus ${toDelete.length} file duplikat? (y/n): `));

  if (!go) {
    console.log(yellow("\n  Dibatalkan.\n"));
    return;
  }

  let deleted = 0, failed = 0, savedBytes = 0;
  const logEntries: object[] = [];
  const ts = new Date().toISOString();

  for (const fp of toDelete) {
    try {
      let fsize = 0;
      try { fsize = (await stat(fp)).size; } catch {}
      await rm(fp, { force: true });
      logEntries.push({ action: "delete_duplicate", path: fp, size: fsize, timestamp: ts });
      savedBytes += fsize;
      deleted++;
    } catch (err: any) {
      console.log(`  ${red("✗")} ${dim(fp)}: ${err.message}`);
      failed++;
    }
  }

  await appendDeleteLog(targetDir, logEntries);

  console.log(`\n  ${bold(green("✔ DELETE DUPES SELESAI"))}`);
  console.log(`  ${green("✓")} File dihapus       : ${bold(String(deleted))}`);
  console.log(`  ${green("✓")} Ruang terbebas     : ${bold(green(fmtBytes(savedBytes)))}`);
  if (failed > 0) console.log(`  ${red("✗")} Gagal              : ${bold(red(String(failed)))}`);
  console.log(`  ${dim("Log:")} ${dim(".rapikan-delete-log.json")}\n`);
}

// ─────────────────────────────────────────────
// 3. deleteWhere — criteria-based delete
// ─────────────────────────────────────────────
interface Criteria {
  type:  "size" | "age" | "ext";
  op?:   "<" | ">";
  value?: number;    // bytes for size, ms for age
  exts?:  Set<string>;
}

function parseCriteria(raw: string): Criteria | null {
  raw = raw.trim();

  // size<1MB | size>10MB | size<500KB
  const sizeMatch = raw.match(/^size([<>])([\d.]+)(KB|MB|GB)$/i);
  if (sizeMatch) {
    const op  = sizeMatch[1] as "<" | ">";
    const num = parseFloat(sizeMatch[2]);
    const unit = sizeMatch[3].toUpperCase();
    let bytes = num;
    if      (unit === "KB") bytes = num * 1_024;
    else if (unit === "MB") bytes = num * 1_048_576;
    else if (unit === "GB") bytes = num * 1_073_741_824;
    return { type: "size", op, value: bytes };
  }

  // age>30d | age>1y | age>6m
  const ageMatch = raw.match(/^age([<>])(\d+)(d|m|y)$/i);
  if (ageMatch) {
    const op   = ageMatch[1] as "<" | ">";
    const num  = parseInt(ageMatch[2]);
    const unit = ageMatch[3].toLowerCase();
    let ms = num * 86_400_000; // default days
    if      (unit === "m") ms = num * 30 * 86_400_000;
    else if (unit === "y") ms = num * 365 * 86_400_000;
    return { type: "age", op, value: ms };
  }

  // ext=.tmp,.log,.DS_Store
  const extMatch = raw.match(/^ext=(.+)$/i);
  if (extMatch) {
    const exts = new Set(
      extMatch[1].split(",").map((e) => (e.startsWith(".") ? e.toLowerCase() : `.${e.toLowerCase()}`))
    );
    return { type: "ext", exts };
  }

  return null;
}

export async function deleteWhere(
  targetDir:   string,
  criteriaStr: string,
  recursive:   boolean,
  dryRun:      boolean,
  skipConfirm: boolean,
  rl:          readline.Interface,
): Promise<void> {
  const criteria = parseCriteria(criteriaStr);
  if (!criteria) {
    console.log(red(`\n  ✗ Kriteria tidak valid: "${criteriaStr}"`));
    console.log(dim("    Contoh: size<1MB  |  age>30d  |  ext=.tmp,.log\n"));
    return;
  }

  console.log(bold(blue(`\n  🔎 Mencari file dengan kriteria: ${cyan(criteriaStr)}\n`)));

  const allFiles = await scanFilesAll(targetDir, recursive);
  const matched: Array<{ path: string; size: number; age: number }> = [];
  const now      = Date.now();

  for (const fp of allFiles) {
    try {
      const s    = await stat(fp);
      const size = s.size;
      const age  = now - (s.birthtimeMs || s.ctimeMs || s.mtimeMs || now);

      let match = false;
      if (criteria.type === "size" && criteria.op && criteria.value !== undefined) {
        match = criteria.op === "<" ? size < criteria.value : size > criteria.value;
      } else if (criteria.type === "age" && criteria.op && criteria.value !== undefined) {
        match = criteria.op === "<" ? age < criteria.value : age > criteria.value;
      } else if (criteria.type === "ext" && criteria.exts) {
        match = criteria.exts.has(path.extname(fp).toLowerCase());
      }

      if (match) matched.push({ path: fp, size, age });
    } catch {}
  }

  if (matched.length === 0) {
    console.log(yellow("  ⚠ Tidak ada file yang cocok dengan kriteria tersebut.\n"));
    return;
  }

  const totalSize = matched.reduce((s, f) => s + f.size, 0);
  console.log(bold(`  📋 ${matched.length} file cocok dengan kriteria ${cyan(criteriaStr)}:\n`));

  for (const f of matched) {
    const ageDays = Math.round(f.age / 86_400_000);
    const relPath = path.relative(targetDir, f.path);
    console.log(
      `    ${red("✗")} ${dim(relPath)}  ${gray(`(${fmtBytes(f.size)}, ${ageDays}d lalu)`)}`
    );
  }

  console.log(bold(`\n  💾 Total: ${red(fmtBytes(totalSize))} akan dihapus`));

  if (dryRun) {
    console.log(bold(yellow("\n  ✔ DRY-RUN — Tidak ada file yang dihapus.\n")));
    return;
  }

  const go = skipConfirm ||
    await confirm(rl, bold(`\n  Hapus ${matched.length} file? (y/n): `));

  if (!go) {
    console.log(yellow("\n  Dibatalkan.\n"));
    return;
  }

  let deleted = 0, failed = 0, savedBytes = 0;
  const logEntries: object[] = [];
  const ts = new Date().toISOString();

  for (const f of matched) {
    try {
      await rm(f.path, { force: true });
      logEntries.push({
        action:    "delete_where",
        criteria:  criteriaStr,
        path:      f.path,
        size:      f.size,
        timestamp: ts,
      });
      savedBytes += f.size;
      deleted++;
    } catch (err: any) {
      console.log(`  ${red("✗")} ${dim(f.path)}: ${err.message}`);
      failed++;
    }
  }

  await appendDeleteLog(targetDir, logEntries);

  console.log(`\n  ${bold(green("✔ DELETE WHERE SELESAI"))}`);
  console.log(`  ${green("✓")} File dihapus      : ${bold(String(deleted))}`);
  console.log(`  ${green("✓")} Ruang terbebas    : ${bold(green(fmtBytes(savedBytes)))}`);
  if (failed > 0) console.log(`  ${red("✗")} Gagal             : ${bold(red(String(failed)))}`);
  console.log(`  ${dim("Log:")} ${dim(".rapikan-delete-log.json")}\n`);
}
