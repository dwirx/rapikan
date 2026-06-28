import { readdir, mkdir, rename, stat, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

// Helper to ask questions in the console
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> =>
  new Promise((resolve) => rl.question(query, resolve));

// Files/folders to ignore from being reorganized
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
]);

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface FileMoveInfo {
  originalPath: string;
  filename: string;
  detectedDate: string; // YYYY-MM-DD
  source: "filename" | "exif" | "video_metadata" | "creation_date" | "modification_date";
  targetDir: string;
  targetPath: string;
}

interface HistoryEntry {
  from: string;
  to: string;
  timestamp: string;
}

// ─────────────────────────────────────────────
// Date extraction: Filename
// ─────────────────────────────────────────────

/**
 * Extracts a date from a filename.
 * Supports patterns: YYYYMMDD, YYYY-MM-DD, YYYY_MM_DD (years 1900-2099).
 */
function extractDateFromFilename(filename: string): string | null {
  const regex =
    /(?:^|[^0-9])(19\d{2}|20\d{2})[-_]?(0[1-9]|1[0-2])[-_]?(0[1-9]|[12]\d|3[01])/;
  const match = filename.match(regex);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }
  return null;
}

// ─────────────────────────────────────────────
// Date extraction: EXIF (JPEG/TIFF)
// ─────────────────────────────────────────────

/**
 * Reads EXIF DateTimeOriginal from JPEG/TIFF files without external dependencies.
 * EXIF DateTimeOriginal marker = 0x9003
 * Format stored in EXIF: "YYYY:MM:DD HH:MM:SS"
 */
async function extractDateFromExif(filePath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (![".jpg", ".jpeg", ".tiff", ".tif", ".heic", ".heif"].includes(ext)) return null;

  try {
    // Read first 128KB of file - enough to find EXIF data
    const fd = await Bun.file(filePath).arrayBuffer();
    const buf = Buffer.from(fd.slice(0, Math.min(131072, fd.byteLength)));

    // JPEG starts with 0xFFD8
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;

    // Search for EXIF header "Exif\0\0"
    const exifMarker = Buffer.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // "Exif\0\0"
    let exifStart = -1;
    for (let i = 2; i < buf.length - 6; i++) {
      if (buf.slice(i, i + 6).equals(exifMarker)) {
        exifStart = i + 6; // Start of TIFF header
        break;
      }
    }
    if (exifStart === -1) return null;

    // Detect byte order: II (little-endian) or MM (big-endian)
    const byteOrder = buf.slice(exifStart, exifStart + 2).toString("ascii");
    const isLittleEndian = byteOrder === "II";

    const readUInt16 = (offset: number) =>
      isLittleEndian
        ? buf.readUInt16LE(exifStart + offset)
        : buf.readUInt16BE(exifStart + offset);

    const readUInt32 = (offset: number) =>
      isLittleEndian
        ? buf.readUInt32LE(exifStart + offset)
        : buf.readUInt32BE(exifStart + offset);

    // IFD0 offset from TIFF header
    const ifdOffset = readUInt32(4);
    const entryCount = readUInt16(ifdOffset);

    // Search IFD entries for DateTimeOriginal (0x9003) or DateTime (0x0132)
    const targetTags = [0x9003, 0x9004, 0x0132]; // DateTimeOriginal, DateTimeDigitized, DateTime

    for (let i = 0; i < entryCount && i < 64; i++) {
      const entryOffset = ifdOffset + 2 + i * 12;
      if (entryOffset + 12 > buf.length - exifStart) break;

      const tag = readUInt16(entryOffset);
      if (targetTags.includes(tag)) {
        const valueOffset = readUInt32(entryOffset + 8);
        // The date string is 20 bytes: "YYYY:MM:DD HH:MM:SS\0"
        const dateStr = buf
          .slice(exifStart + valueOffset, exifStart + valueOffset + 19)
          .toString("ascii");
        // Validate format: "YYYY:MM:DD HH:MM:SS"
        if (/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
          const [datePart] = dateStr.split(" ");
          const [y, m, d] = datePart.split(":");
          const date = new Date(`${y}-${m}-${d}`);
          if (!isNaN(date.getTime()) && parseInt(y) > 1900) {
            return `${y}-${m}-${d}`;
          }
        }
      }
    }

    // If not in IFD0, also search for SubIFD (EXIF IFD pointer = 0x8769)
    for (let i = 0; i < entryCount && i < 64; i++) {
      const entryOffset = ifdOffset + 2 + i * 12;
      if (entryOffset + 12 > buf.length - exifStart) break;

      const tag = readUInt16(entryOffset);
      if (tag === 0x8769) {
        // EXIF IFD offset
        const subIfdOffset = readUInt32(entryOffset + 8);
        const subEntryCount = readUInt16(subIfdOffset);

        for (let j = 0; j < subEntryCount && j < 64; j++) {
          const subEntryOffset = subIfdOffset + 2 + j * 12;
          if (subEntryOffset + 12 > buf.length - exifStart) break;

          const subTag = readUInt16(subEntryOffset);
          if (targetTags.includes(subTag)) {
            const valueOffset = readUInt32(subEntryOffset + 8);
            const dateStr = buf
              .slice(exifStart + valueOffset, exifStart + valueOffset + 19)
              .toString("ascii");
            if (/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
              const [datePart] = dateStr.split(" ");
              const [y, m, d] = datePart.split(":");
              const date = new Date(`${y}-${m}-${d}`);
              if (!isNaN(date.getTime()) && parseInt(y) > 1900) {
                return `${y}-${m}-${d}`;
              }
            }
          }
        }
        break;
      }
    }
  } catch {
    // silently skip
  }
  return null;
}

// ─────────────────────────────────────────────
// Date extraction: Video Metadata (MP4/MOV)
// ─────────────────────────────────────────────

/**
 * Reads creation_time from MP4/MOV/M4V file atoms without external dependencies.
 * The 'mvhd' box (movie header) contains a 32-bit creation time in seconds
 * since 1904-01-01 00:00:00 UTC (QuickTime epoch).
 */
async function extractDateFromVideoMetadata(filePath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (![".mp4", ".mov", ".m4v", ".m4a", ".3gp"].includes(ext)) return null;

  try {
    const fd = await Bun.file(filePath).arrayBuffer();
    const buf = Buffer.from(fd.slice(0, Math.min(262144, fd.byteLength))); // Read first 256KB

    // QuickTime epoch: seconds since 1904-01-01
    const QUICKTIME_EPOCH_OFFSET = 2082844800; // seconds between 1904-01-01 and 1970-01-01

    let offset = 0;
    while (offset < buf.length - 8) {
      // Read box size (4 bytes) and type (4 bytes)
      const boxSize = buf.readUInt32BE(offset);
      const boxType = buf.slice(offset + 4, offset + 8).toString("ascii");

      if (boxSize < 8) break; // Invalid box

      if (boxType === "moov") {
        // Recurse into moov box
        let innerOffset = offset + 8;
        const moovEnd = offset + boxSize;

        while (innerOffset < moovEnd - 8) {
          const innerSize = buf.readUInt32BE(innerOffset);
          const innerType = buf.slice(innerOffset + 4, innerOffset + 8).toString("ascii");

          if (innerSize < 8) break;

          if (innerType === "mvhd") {
            // Version 0: 32-bit timestamps; Version 1: 64-bit timestamps
            const version = buf.readUInt8(innerOffset + 8);

            let creationTime: number;
            if (version === 1) {
              // 64-bit: read as two 32-bit values (high + low)
              const high = buf.readUInt32BE(innerOffset + 12);
              const low = buf.readUInt32BE(innerOffset + 16);
              creationTime = high * 0x100000000 + low;
            } else {
              // 32-bit
              creationTime = buf.readUInt32BE(innerOffset + 12);
            }

            if (creationTime > 0) {
              const unixTimestamp = (creationTime - QUICKTIME_EPOCH_OFFSET) * 1000;
              const date = new Date(unixTimestamp);

              if (!isNaN(date.getTime()) && date.getFullYear() > 1970) {
                const y = date.getUTCFullYear();
                const m = String(date.getUTCMonth() + 1).padStart(2, "0");
                const d = String(date.getUTCDate()).padStart(2, "0");
                return `${y}-${m}-${d}`;
              }
            }
          }
          innerOffset += innerSize;
        }
      }

      offset += boxSize;
    }
  } catch {
    // silently skip
  }
  return null;
}

// ─────────────────────────────────────────────
// Unique destination path (deduplication)
// ─────────────────────────────────────────────

function getUniqueDestPath(destDir: string, filename: string): string {
  let destPath = path.join(destDir, filename);
  if (!existsSync(destPath)) return destPath;

  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);
  let counter = 1;

  while (true) {
    const candidatePath = path.join(destDir, `${baseName}_(${counter})${ext}`);
    if (!existsSync(candidatePath)) return candidatePath;
    counter++;
  }
}

// ─────────────────────────────────────────────
// UNDO feature
// ─────────────────────────────────────────────

async function undoLastOperation(targetDir: string): Promise<void> {
  const historyFile = path.join(targetDir, ".rapikan-history.json");

  if (!existsSync(historyFile)) {
    console.log("\n[INFO] Tidak ada riwayat pemindahan yang ditemukan di folder ini.");
    console.log(`       File riwayat yang dicari: ${historyFile}`);
    rl.close();
    return;
  }

  let history: HistoryEntry[];
  try {
    const raw = await readFile(historyFile, "utf-8");
    history = JSON.parse(raw);
  } catch {
    console.error("[ERROR] File riwayat rusak atau tidak valid.");
    rl.close();
    return;
  }

  if (!history.length) {
    console.log("\n[INFO] Riwayat pemindahan kosong. Tidak ada yang bisa dikembalikan.");
    rl.close();
    return;
  }

  console.log(`\nDitemukan ${history.length} file dalam riwayat terakhir:`);
  console.log(`Dicatat pada: ${history[0].timestamp}\n`);

  for (const entry of history) {
    const fromShort = path.relative(targetDir, entry.to);
    const toShort = path.basename(entry.from);
    console.log(` - /${fromShort} -> kembali ke /${toShort}`);
  }

  const confirm = await question(`\nKembalikan semua file ke lokasi semula? (y/n, default n): `);
  if (confirm.toLowerCase().trim() !== "y" && confirm.toLowerCase().trim() !== "ya") {
    console.log("\nProses undo dibatalkan.");
    rl.close();
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const entry of history) {
    try {
      // Ensure the original directory exists
      await mkdir(path.dirname(entry.from), { recursive: true });

      // Avoid overwriting if file exists at original location
      const finalDest = getUniqueDestPath(path.dirname(entry.from), path.basename(entry.from));
      await rename(entry.to, finalDest);
      console.log(`[OK] Dikembalikan: ${path.relative(targetDir, entry.to)} -> ${path.relative(targetDir, finalDest)}`);
      successCount++;
    } catch (err: any) {
      console.error(`[GAGAL] Gagal mengembalikan ${entry.to}: ${err.message}`);
      failCount++;
    }
  }

  // Clean up empty date directories after undo
  for (const entry of history) {
    const dir = path.dirname(entry.to);
    try {
      const remaining = await readdir(dir);
      if (remaining.length === 0) {
        await import("node:fs/promises").then((fs) => fs.rmdir(dir));
      }
    } catch {
      // ignore
    }
  }

  // Clear history file after successful undo
  await writeFile(historyFile, "[]", "utf-8");

  console.log(`\n=============================================`);
  console.log(`UNDO SELESAI`);
  console.log(`Berhasil dikembalikan : ${successCount} file`);
  console.log(`Gagal dikembalikan    : ${failCount} file`);
  console.log(`=============================================\n`);

  rl.close();
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let skipConfirm = false;
  let dryRun = false;
  let doUndo = false;
  let targetPathArg = "";

  for (const arg of args) {
    if (arg === "-y" || arg === "--yes") skipConfirm = true;
    else if (arg === "-d" || arg === "--dry-run") dryRun = true;
    else if (arg === "--undo") doUndo = true;
    else if (!arg.startsWith("-")) targetPathArg = arg;
  }

  console.log("\n=============================================");
  console.log("   TOOL MERAPIKAN FILE BERDASARKAN TANGGAL   ");
  console.log("=============================================\n");

  if (dryRun) {
    console.log("🔍 MODE SIMULASI (DRY-RUN) AKTIF - Tidak ada file yang akan dipindahkan.\n");
  }

  let targetDir = "";

  if (targetPathArg) {
    targetDir = path.resolve(targetPathArg);
  } else {
    const currentDir = path.resolve(process.cwd());
    const parentDir = path.resolve(currentDir, "..");

    console.log("Pilih folder yang ingin dirapikan:");
    console.log(`1. Folder Saat Ini : ${currentDir}`);
    console.log(`2. Folder Induk    : ${parentDir}`);
    console.log("3. Path Kustom (masukkan sendiri)");

    const choice = await question("\nPilih (1/2/3, default 1): ");

    if (choice.trim() === "2") {
      targetDir = parentDir;
    } else if (choice.trim() === "3") {
      const customPath = await question("Masukkan path kustom lengkap: ");
      targetDir = customPath.trim() ? path.resolve(customPath.trim()) : currentDir;
    } else {
      targetDir = currentDir;
    }
  }

  targetDir = path.normalize(targetDir);

  // If --undo flag, run undo flow instead
  if (doUndo) {
    await undoLastOperation(targetDir);
    return;
  }

  console.log(`Memindai folder: ${targetDir}...`);

  let dirEntries;
  try {
    dirEntries = await readdir(targetDir, { withFileTypes: true });
  } catch (err: any) {
    console.error(`\n[ERROR] Gagal membaca folder: ${err.message}`);
    rl.close();
    return;
  }

  const moves: FileMoveInfo[] = [];

  for (const entry of dirEntries) {
    if (!entry.isFile()) continue;
    if (IGNORED_FILES.has(entry.name)) continue;

    const originalPath = path.join(targetDir, entry.name);
    let detectedDate = "";
    let source: FileMoveInfo["source"] = "filename";

    // Priority 1: Date from filename
    const dateFromFilename = extractDateFromFilename(entry.name);
    if (dateFromFilename) {
      detectedDate = dateFromFilename;
      source = "filename";
    }

    // Priority 2: EXIF metadata (photos)
    if (!detectedDate) {
      const dateFromExif = await extractDateFromExif(originalPath);
      if (dateFromExif) {
        detectedDate = dateFromExif;
        source = "exif";
      }
    }

    // Priority 3: Video metadata (MP4/MOV)
    if (!detectedDate) {
      const dateFromVideo = await extractDateFromVideoMetadata(originalPath);
      if (dateFromVideo) {
        detectedDate = dateFromVideo;
        source = "video_metadata";
      }
    }

    // Priority 4: File system metadata (birthtime/mtime)
    if (!detectedDate) {
      try {
        const fileStat = await stat(originalPath);
        const birthTime = fileStat.birthtimeMs || Infinity;
        const mTime = fileStat.mtimeMs || Infinity;
        const timeToUse = Math.min(birthTime, mTime);

        if (timeToUse !== Infinity) {
          const date = new Date(timeToUse);
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, "0");
          const d = String(date.getDate()).padStart(2, "0");
          detectedDate = `${y}-${m}-${d}`;
          source =
            fileStat.birthtimeMs <= fileStat.mtimeMs ? "creation_date" : "modification_date";
        }
      } catch {
        console.warn(`[PERINGATAN] Gagal membaca metadata file: ${entry.name}. File dilewati.`);
        continue;
      }
    }

    if (!detectedDate) {
      console.warn(`[PERINGATAN] Gagal menentukan tanggal untuk: ${entry.name}. File dilewati.`);
      continue;
    }

    const destDir = path.join(targetDir, detectedDate);
    moves.push({
      originalPath,
      filename: entry.name,
      detectedDate,
      source,
      targetDir: destDir,
      targetPath: "",
    });
  }

  if (moves.length === 0) {
    console.log("\nTidak ada file yang perlu dirapikan di folder tersebut.");
    rl.close();
    return;
  }

  console.log(`\nDitemukan ${moves.length} file untuk dirapikan:\n`);

  // Display preview table
  const sourceLabel = (s: FileMoveInfo["source"]) => {
    switch (s) {
      case "filename":       return "[Nama File]   ";
      case "exif":           return "[EXIF Foto]   ";
      case "video_metadata": return "[Metadata Video]";
      case "creation_date":  return "[Tgl Dibuat]  ";
      case "modification_date": return "[Tgl Diubah]  ";
    }
  };

  for (const move of moves) {
    console.log(
      ` - ${move.filename.padEnd(45)} -> /${move.detectedDate}/ ${sourceLabel(move.source)}`
    );
  }

  // In dry-run mode, stop here
  if (dryRun) {
    console.log("\n✅ Simulasi selesai. Tidak ada file yang dipindahkan (mode --dry-run).");
    console.log("   Hapus flag --dry-run untuk benar-benar merapikan file.");
    rl.close();
    return;
  }

  let confirmed = false;
  if (skipConfirm) {
    console.log("\nAuto-konfirmasi aktif (-y/--yes). Memulai pemindahan...");
    confirmed = true;
  } else {
    const confirm = await question(
      `\nApakah Anda yakin ingin merapikan file-file ini? (y/n, default n): `
    );
    if (confirm.toLowerCase().trim() === "y" || confirm.toLowerCase().trim() === "ya") {
      confirmed = true;
    }
  }

  if (confirmed) {
    console.log("\nMemulai proses pemindahan...");
    let successCount = 0;
    let failCount = 0;
    const historyLog: HistoryEntry[] = [];
    const timestamp = new Date().toISOString();

    for (const move of moves) {
      try {
        await mkdir(move.targetDir, { recursive: true });

        const uniqueDestPath = getUniqueDestPath(move.targetDir, move.filename);
        const finalFilename = path.basename(uniqueDestPath);

        await rename(move.originalPath, uniqueDestPath);

        // Save to history for undo
        historyLog.push({
          from: move.originalPath,
          to: uniqueDestPath,
          timestamp,
        });

        if (finalFilename !== move.filename) {
          console.log(`[OK] ${move.filename} -> ${move.detectedDate}/${finalFilename} (Direname karena duplikat)`);
        } else {
          console.log(`[OK] ${move.filename} -> ${move.detectedDate}/`);
        }
        successCount++;
      } catch (err: any) {
        console.error(`[GAGAL] Gagal memindahkan ${move.filename}: ${err.message}`);
        failCount++;
      }
    }

    // Save history log to target directory for undo
    const historyFile = path.join(targetDir, ".rapikan-history.json");
    await writeFile(historyFile, JSON.stringify(historyLog, null, 2), "utf-8");

    console.log(`\n=============================================`);
    console.log(`PROSES SELESAI`);
    console.log(`Berhasil dipindahkan : ${successCount} file`);
    console.log(`Gagal dipindahkan    : ${failCount} file`);
    console.log(`Riwayat disimpan di  : .rapikan-history.json`);
    console.log(`Untuk membatalkan    : rapikan ${targetPathArg || "."} --undo`);
    console.log(`=============================================\n`);
  } else {
    console.log("\nProses dibatalkan. Tidak ada file yang dipindahkan.");
  }

  rl.close();
}

main().catch((err) => {
  console.error("Terjadi error tak terduga:", err);
  rl.close();
});