import {
  readdir,
  mkdir,
  rename,
  stat,
  readFile,
  writeFile,
  rmdir,
} from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import readline from "node:readline";

// ─────────────────────────────────────────────
// ANSI Color & Style Helpers
// ─────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  red: "\x1b[31m",
  bgGreen: "\x1b[42m",
  bgBlue: "\x1b[44m",
  gray: "\x1b[90m",
};

const col = (color: string, text: string) => `${color}${text}${c.reset}`;
const bold = (t: string) => col(c.bold, t);
const green = (t: string) => col(c.green, t);
const yellow = (t: string) => col(c.yellow, t);
const red = (t: string) => col(c.red, t);
const cyan = (t: string) => col(c.cyan, t);
const magenta = (t: string) => col(c.magenta, t);
const blue = (t: string) => col(c.blue, t);
const gray = (t: string) => col(c.gray, t);
const dim = (t: string) => col(c.dim, t);

// ─────────────────────────────────────────────
// Progress Bar
// ─────────────────────────────────────────────
function renderProgressBar(current: number, total: number, width = 35): string {
  const pct = total === 0 ? 1 : current / total;
  const filled = Math.round(pct * width);
  const empty = width - filled;
  const bar = `${"█".repeat(filled)}${"░".repeat(empty)}`;
  const pctStr = `${Math.round(pct * 100)}%`.padStart(4);
  return `${col(c.cyan, bar)} ${col(c.bold, pctStr)} ${dim(`(${current}/${total})`)}`;
}

// ─────────────────────────────────────────────
// Readline
// ─────────────────────────────────────────────
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> =>
  new Promise((resolve) => rl.question(query, resolve));

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const IGNORED_FILES = new Set([
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
  "docs",
]);

const SUPPORTED_FORMATS: Record<string, string> = {
  "YYYY-MM-DD": "Flat  : 2026-06-22/ (default)",
  "YYYY/MM/DD": "Hierarkis: 2026/06/22/",
  "YYYY/MM": "Bulan : 2026/06/",
  "YYYY": "Tahun : 2026/",
};

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface FileMoveInfo {
  originalPath: string;
  filename: string;
  detectedDate: string;
  source: "filename" | "exif" | "video_metadata" | "creation_date" | "modification_date";
  targetDir: string;
}

interface HistoryEntry {
  from: string;
  to: string;
  timestamp: string;
}

interface CLIArgs {
  targetPathArg: string;
  skipConfirm: boolean;
  dryRun: boolean;
  doUndo: boolean;
  recursive: boolean;
  extFilter: Set<string> | null; // null = all
  format: string;
  dedup: boolean;
}

// ─────────────────────────────────────────────
// Arg Parser
// ─────────────────────────────────────────────
function parseArgs(argv: string[]): CLIArgs {
  const args = argv.slice(2);
  let skipConfirm = false;
  let dryRun = false;
  let doUndo = false;
  let recursive = false;
  let dedup = false;
  let targetPathArg = "";
  let format = "YYYY-MM-DD";
  let extFilter: Set<string> | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-y" || arg === "--yes") skipConfirm = true;
    else if (arg === "-d" || arg === "--dry-run") dryRun = true;
    else if (arg === "--undo") doUndo = true;
    else if (arg === "-r" || arg === "--recursive") recursive = true;
    else if (arg === "--dedup") dedup = true;
    else if (arg === "-f" || arg === "--format") {
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        format = next;
        i++;
      }
    } else if (arg === "--ext") {
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        extFilter = new Set(
          next
            .split(",")
            .map((e) => (e.startsWith(".") ? e.toLowerCase() : `.${e.toLowerCase()}`))
        );
        i++;
      }
    } else if (!arg.startsWith("-")) {
      targetPathArg = arg;
    }
  }

  return { skipConfirm, dryRun, doUndo, recursive, dedup, targetPathArg, format, extFilter };
}

// ─────────────────────────────────────────────
// Date from Filename
// ─────────────────────────────────────────────
function extractDateFromFilename(filename: string): string | null {
  const regex =
    /(?:^|[^0-9])(19\d{2}|20\d{2})[-_]?(0[1-9]|1[0-2])[-_]?(0[1-9]|[12]\d|3[01])/;
  const match = filename.match(regex);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return null;
}

// ─────────────────────────────────────────────
// Date from EXIF (JPEG/TIFF/HEIC)
// ─────────────────────────────────────────────
async function extractDateFromExif(filePath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (![".jpg", ".jpeg", ".tiff", ".tif", ".heic", ".heif"].includes(ext)) return null;
  try {
    const fd = await Bun.file(filePath).arrayBuffer();
    const buf = Buffer.from(fd.slice(0, Math.min(131072, fd.byteLength)));
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;

    const exifMarker = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
    let exifStart = -1;
    for (let i = 2; i < buf.length - 6; i++) {
      if (buf.slice(i, i + 6).equals(exifMarker)) {
        exifStart = i + 6;
        break;
      }
    }
    if (exifStart === -1) return null;

    const byteOrder = buf.slice(exifStart, exifStart + 2).toString("ascii");
    const isLE = byteOrder === "II";
    const r16 = (o: number) => (isLE ? buf.readUInt16LE(exifStart + o) : buf.readUInt16BE(exifStart + o));
    const r32 = (o: number) => (isLE ? buf.readUInt32LE(exifStart + o) : buf.readUInt32BE(exifStart + o));

    const parseDate = (offset: number): string | null => {
      const s = buf.slice(exifStart + offset, exifStart + offset + 19).toString("ascii");
      if (/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
        const [dp] = s.split(" ");
        const [y, m, d] = dp.split(":");
        if (!isNaN(new Date(`${y}-${m}-${d}`).getTime()) && parseInt(y) > 1900)
          return `${y}-${m}-${d}`;
      }
      return null;
    };

    const targetTags = [0x9003, 0x9004, 0x0132];
    const ifd0 = r32(4);
    const n = r16(ifd0);

    for (let i = 0; i < n && i < 64; i++) {
      const eo = ifd0 + 2 + i * 12;
      if (eo + 12 > buf.length - exifStart) break;
      const tag = r16(eo);
      if (tag === 0x8769) {
        const subOff = r32(eo + 8);
        const sn = r16(subOff);
        for (let j = 0; j < sn && j < 64; j++) {
          const so = subOff + 2 + j * 12;
          if (so + 12 > buf.length - exifStart) break;
          if (targetTags.includes(r16(so))) {
            const d = parseDate(r32(so + 8));
            if (d) return d;
          }
        }
      }
      if (targetTags.includes(tag)) {
        const d = parseDate(r32(eo + 8));
        if (d) return d;
      }
    }
  } catch {}
  return null;
}

// ─────────────────────────────────────────────
// Date from Video (MP4/MOV)
// ─────────────────────────────────────────────
async function extractDateFromVideo(filePath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (![".mp4", ".mov", ".m4v", ".m4a", ".3gp"].includes(ext)) return null;
  try {
    const fd = await Bun.file(filePath).arrayBuffer();
    const buf = Buffer.from(fd.slice(0, Math.min(262144, fd.byteLength)));
    const QT_EPOCH = 2082844800;

    let offset = 0;
    while (offset < buf.length - 8) {
      const size = buf.readUInt32BE(offset);
      const type = buf.slice(offset + 4, offset + 8).toString("ascii");
      if (size < 8) break;
      if (type === "moov") {
        let io = offset + 8;
        const end = offset + size;
        while (io < end - 8) {
          const is = buf.readUInt32BE(io);
          const it = buf.slice(io + 4, io + 8).toString("ascii");
          if (is < 8) break;
          if (it === "mvhd") {
            const ver = buf.readUInt8(io + 8);
            const ct = ver === 1
              ? buf.readUInt32BE(io + 12) * 0x100000000 + buf.readUInt32BE(io + 16)
              : buf.readUInt32BE(io + 12);
            if (ct > 0) {
              const d = new Date((ct - QT_EPOCH) * 1000);
              if (!isNaN(d.getTime()) && d.getUTCFullYear() > 1970) {
                const y = d.getUTCFullYear();
                const m = String(d.getUTCMonth() + 1).padStart(2, "0");
                const dd = String(d.getUTCDate()).padStart(2, "0");
                return `${y}-${m}-${dd}`;
              }
            }
          }
          io += is;
        }
      }
      offset += size;
    }
  } catch {}
  return null;
}

// ─────────────────────────────────────────────
// File Hash (MD5 for dedup)
// ─────────────────────────────────────────────
async function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("md5");
    const stream = createReadStream(filePath, { highWaterMark: 65536 });
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

// ─────────────────────────────────────────────
// Format folder path from date string
// ─────────────────────────────────────────────
function formatTargetPath(baseDir: string, dateStr: string, format: string): string {
  const [year, month, day] = dateStr.split("-");
  let rel: string;
  switch (format) {
    case "YYYY/MM/DD": rel = path.join(year, month, day); break;
    case "YYYY/MM":   rel = path.join(year, month); break;
    case "YYYY":      rel = year; break;
    default:          rel = dateStr; // YYYY-MM-DD (flat)
  }
  return path.join(baseDir, rel);
}

// ─────────────────────────────────────────────
// Unique destination path
// ─────────────────────────────────────────────
function getUniqueDest(destDir: string, filename: string): string {
  let dest = path.join(destDir, filename);
  if (!existsSync(dest)) return dest;
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let n = 1;
  while (true) {
    const p = path.join(destDir, `${base}_(${n})${ext}`);
    if (!existsSync(p)) return p;
    n++;
  }
}

// ─────────────────────────────────────────────
// Scan files (optionally recursive)
// ─────────────────────────────────────────────
async function scanFiles(
  dir: string,
  recursive: boolean,
  extFilter: Set<string> | null,
  rootDir: string
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_FILES.has(entry.name)) continue;
      // Skip date folders that rapikan itself created
      if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(entry.name)) continue;
      if (/^\d{4}$/.test(entry.name)) continue;
      if (recursive) {
        const sub = await scanFiles(fullPath, recursive, extFilter, rootDir);
        files.push(...sub);
      }
      continue;
    }

    if (!entry.isFile()) continue;
    if (IGNORED_FILES.has(entry.name)) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (extFilter && !extFilter.has(ext)) continue;

    files.push(fullPath);
  }

  return files;
}

// ─────────────────────────────────────────────
// Source label helpers
// ─────────────────────────────────────────────
function sourceLabel(s: FileMoveInfo["source"]): string {
  switch (s) {
    case "filename":          return cyan("  [Nama File]  ");
    case "exif":              return magenta("  [EXIF Foto]  ");
    case "video_metadata":    return blue("  [Meta Video] ");
    case "creation_date":     return gray("  [Tgl Dibuat] ");
    case "modification_date": return gray("  [Tgl Diubah] ");
  }
}

// ─────────────────────────────────────────────
// Print header banner
// ─────────────────────────────────────────────
function printBanner() {
  console.log("");
  console.log(bold(cyan("  ██████╗  █████╗ ██████╗ ██╗██╗  ██╗ █████╗ ███╗   ██╗")));
  console.log(bold(cyan("  ██╔══██╗██╔══██╗██╔══██╗██║██║ ██╔╝██╔══██╗████╗  ██║")));
  console.log(bold(cyan("  ██████╔╝███████║██████╔╝██║█████╔╝ ███████║██╔██╗ ██║")));
  console.log(bold(cyan("  ██╔══██╗██╔══██║██╔═══╝ ██║██╔═██╗ ██╔══██║██║╚██╗██║")));
  console.log(bold(cyan("  ██║  ██║██║  ██║██║     ██║██║  ██╗██║  ██║██║ ╚████║")));
  console.log(bold(cyan("  ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝")));
  console.log(dim("  File Organizer by Date — github.com/dwirx/rapikan"));
  console.log("");
}

// ─────────────────────────────────────────────
// UNDO
// ─────────────────────────────────────────────
async function undoLastOperation(targetDir: string): Promise<void> {
  const historyFile = path.join(targetDir, ".rapikan-history.json");

  if (!existsSync(historyFile)) {
    console.log(yellow("\n  ⚠ Tidak ada riwayat pemindahan di folder ini."));
    console.log(dim(`    Dicari: ${historyFile}`));
    rl.close();
    return;
  }

  let history: HistoryEntry[];
  try {
    history = JSON.parse(await readFile(historyFile, "utf-8"));
  } catch {
    console.log(red("\n  ✗ File riwayat rusak atau tidak valid."));
    rl.close();
    return;
  }

  if (!history.length) {
    console.log(yellow("\n  ⚠ Riwayat kosong. Tidak ada yang bisa dikembalikan."));
    rl.close();
    return;
  }

  console.log(bold(`\n  ↩  Riwayat: ${history.length} file`));
  console.log(dim(`     Dicatat: ${history[0]?.timestamp ?? "-"}\n`));

  for (const e of history) {
    const from = dim(path.relative(targetDir, e.to));
    const to = green(path.basename(e.from));
    console.log(`  ${yellow("←")} ${from}  →  ${to}`);
  }

  const confirm = await question(bold(`\n  Kembalikan semua? (y/n): `));
  if (confirm.toLowerCase().trim() !== "y") {
    console.log(yellow("\n  Undo dibatalkan.\n"));
    rl.close();
    return;
  }

  let ok = 0, fail = 0;
  for (const e of history) {
    try {
      await mkdir(path.dirname(e.from), { recursive: true });
      const dest = getUniqueDest(path.dirname(e.from), path.basename(e.from));
      await rename(e.to, dest);
      console.log(`  ${green("✓")} ${dim(path.relative(targetDir, e.to))} → ${green(path.relative(targetDir, dest))}`);
      ok++;
    } catch (err: any) {
      console.log(`  ${red("✗")} ${e.to}: ${err.message}`);
      fail++;
    }
  }

  // Remove empty date dirs
  for (const e of history) {
    try {
      const dir = path.dirname(e.to);
      const rem = await readdir(dir);
      if (rem.length === 0) await rmdir(dir);
    } catch {}
  }

  await writeFile(historyFile, "[]", "utf-8");

  console.log(`\n  ${bold(green("UNDO SELESAI"))}`);
  console.log(`  ${green("✓")} Dikembalikan : ${bold(String(ok))} file`);
  if (fail > 0) console.log(`  ${red("✗")} Gagal        : ${bold(red(String(fail)))} file`);
  console.log("");
  rl.close();
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv);

  printBanner();

  // ── Badges aktif ──
  const badges: string[] = [];
  if (opts.dryRun) badges.push(yellow("◉ DRY-RUN"));
  if (opts.recursive) badges.push(cyan("◉ RECURSIVE"));
  if (opts.dedup) badges.push(magenta("◉ DEDUP-HASH"));
  if (opts.extFilter) badges.push(green(`◉ EXT: ${[...opts.extFilter].join(",")}`));
  if (opts.format !== "YYYY-MM-DD") badges.push(blue(`◉ FORMAT: ${opts.format}`));
  if (badges.length) console.log("  " + badges.join("  ") + "\n");

  // ── Pilih target dir ──
  let targetDir = "";
  if (opts.targetPathArg) {
    targetDir = path.resolve(opts.targetPathArg);
  } else {
    const cwd = path.resolve(process.cwd());
    const parent = path.resolve(cwd, "..");
    console.log(bold("  Pilih folder yang ingin dirapikan:"));
    console.log(`  ${cyan("1.")} Folder Saat Ini  ${dim(cwd)}`);
    console.log(`  ${cyan("2.")} Folder Induk     ${dim(parent)}`);
    console.log(`  ${cyan("3.")} Path Kustom`);
    const ch = await question(bold("\n  Pilih (1/2/3, default 1): "));
    if (ch.trim() === "2") targetDir = parent;
    else if (ch.trim() === "3") {
      const p = await question("  Path: ");
      targetDir = p.trim() ? path.resolve(p.trim()) : cwd;
    } else targetDir = cwd;
  }

  targetDir = path.normalize(targetDir);

  if (opts.doUndo) {
    await undoLastOperation(targetDir);
    return;
  }

  console.log(`\n  ${bold("📂 Memindai:")} ${cyan(targetDir)}\n`);

  // ── Scan ──
  let filePaths: string[];
  try {
    filePaths = await scanFiles(targetDir, opts.recursive, opts.extFilter, targetDir);
  } catch (err: any) {
    console.log(red(`\n  ✗ Gagal membaca folder: ${err.message}\n`));
    rl.close();
    return;
  }

  if (filePaths.length === 0) {
    console.log(yellow("  ⚠ Tidak ada file yang perlu dirapikan.\n"));
    rl.close();
    return;
  }

  // ── Detect dates ──
  console.log(dim(`  Menganalisis ${filePaths.length} file...\n`));

  const moves: FileMoveInfo[] = [];
  const hashMap = new Map<string, string>(); // hash → first seen path
  const dupGroups = new Map<string, string[]>(); // hash → [paths]

  for (let i = 0; i < filePaths.length; i++) {
    const fp = filePaths[i];
    const filename = path.basename(fp);

    // Progress while scanning
    process.stdout.write(
      `\r  ${renderProgressBar(i + 1, filePaths.length, 30)}  ${dim(filename.slice(0, 30).padEnd(30))}`
    );

    let date = "";
    let source: FileMoveInfo["source"] = "filename";

    // 1. Filename
    const df = extractDateFromFilename(filename);
    if (df) { date = df; source = "filename"; }

    // 2. EXIF
    if (!date) {
      const de = await extractDateFromExif(fp);
      if (de) { date = de; source = "exif"; }
    }

    // 3. Video
    if (!date) {
      const dv = await extractDateFromVideo(fp);
      if (dv) { date = dv; source = "video_metadata"; }
    }

    // 4. FS metadata
    if (!date) {
      try {
        const s = await stat(fp);
        const t = Math.min(s.birthtimeMs || Infinity, s.mtimeMs || Infinity);
        if (t !== Infinity) {
          const d = new Date(t);
          date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          source = (s.birthtimeMs <= s.mtimeMs) ? "creation_date" : "modification_date";
        }
      } catch {
        continue;
      }
    }

    if (!date) continue;

    // 5. Dedup check
    if (opts.dedup) {
      try {
        const hash = await computeFileHash(fp);
        if (hashMap.has(hash)) {
          const existing = hashMap.get(hash)!;
          if (!dupGroups.has(hash)) dupGroups.set(hash, [existing]);
          dupGroups.get(hash)!.push(fp);
          continue; // skip duplicate
        }
        hashMap.set(hash, fp);
      } catch {}
    }

    const tDir = formatTargetPath(targetDir, date, opts.format);
    moves.push({ originalPath: fp, filename, detectedDate: date, source, targetDir: tDir });
  }

  process.stdout.write("\r" + " ".repeat(80) + "\r"); // clear progress line

  // ── Dedup report ──
  if (opts.dedup && dupGroups.size > 0) {
    console.log(bold(magenta(`  🧬 Duplikat Terdeteksi (${dupGroups.size} grup):\n`)));
    for (const [hash, paths] of dupGroups) {
      console.log(`  ${magenta("▸")} Hash: ${dim(hash.slice(0, 12))}...`);
      for (const p of paths) console.log(`    ${dim("•")} ${path.relative(targetDir, p)}`);
    }
    const totalDups = [...dupGroups.values()].reduce((s, a) => s + a.length - 1, 0);
    console.log(dim(`\n  ${totalDups} file duplikat dilewati (tidak akan dipindahkan)\n`));
  }

  // ── Preview table ──
  if (moves.length === 0) {
    console.log(yellow("\n  ⚠ Tidak ada file unik yang perlu dirapikan.\n"));
    rl.close();
    return;
  }

  const byDate = new Map<string, FileMoveInfo[]>();
  for (const m of moves) {
    const key = m.detectedDate;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(m);
  }

  const sortedDates = [...byDate.keys()].sort();
  console.log(bold(`  📋 Rencana Pemindahan — ${moves.length} file ke ${sortedDates.length} folder:\n`));

  for (const date of sortedDates) {
    const items = byDate.get(date)!;
    const relDir = path.relative(targetDir, formatTargetPath(targetDir, date, opts.format));
    console.log(`  ${bold(green("▸"))} ${bold(relDir + path.sep)}  ${dim(`(${items.length} file)`)}`);
    for (const m of items) {
      const relSrc = dim(path.relative(targetDir, m.originalPath));
      console.log(`    ${gray("•")} ${relSrc}  ${sourceLabel(m.source)}`);
    }
  }

  if (opts.dryRun) {
    console.log(bold(yellow("\n  ✔ SIMULASI SELESAI — Tidak ada file yang dipindahkan.")));
    console.log(dim("    Hapus flag --dry-run untuk benar-benar merapikan.\n"));
    rl.close();
    return;
  }

  // ── Confirm ──
  let confirmed = false;
  if (opts.skipConfirm) {
    console.log(cyan("\n  Auto-konfirmasi (-y). Memulai...\n"));
    confirmed = true;
  } else {
    const ans = await question(bold(`\n  Rapikan ${moves.length} file sekarang? (y/n): `));
    confirmed = ans.toLowerCase().trim() === "y" || ans.toLowerCase().trim() === "ya";
  }

  if (!confirmed) {
    console.log(yellow("\n  Dibatalkan. Tidak ada file yang dipindahkan.\n"));
    rl.close();
    return;
  }

  // ── Execute ──
  console.log("");
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
      await rename(m.originalPath, dest);
      history.push({ from: m.originalPath, to: dest, timestamp: ts });
      ok++;
    } catch (err: any) {
      fail++;
    }
  }

  process.stdout.write("\r" + " ".repeat(80) + "\r");

  // ── Save history ──
  await writeFile(path.join(targetDir, ".rapikan-history.json"), JSON.stringify(history, null, 2), "utf-8");

  // ── Summary ──
  console.log(`\n  ${bold(green("✔ SELESAI!"))}\n`);
  console.log(`  ${green("✓")} Berhasil dipindahkan  : ${bold(green(String(ok)))} file`);
  if (fail > 0) console.log(`  ${red("✗")} Gagal               : ${bold(red(String(fail)))} file`);
  if (opts.dedup && dupGroups.size > 0) {
    const d = [...dupGroups.values()].reduce((s, a) => s + a.length - 1, 0);
    console.log(`  ${magenta("◎")} Duplikat dilewati     : ${bold(magenta(String(d)))} file`);
  }
  console.log(`\n  ${dim("Riwayat:")}  ${dim(".rapikan-history.json")}`);
  console.log(`  ${dim("Undo   :")}  ${dim(`rapikan ${opts.targetPathArg || "."} --undo`)}\n`);

  rl.close();
}

main().catch((err) => {
  console.error(red("\n  ✗ Error tak terduga:"), err);
  rl.close();
});