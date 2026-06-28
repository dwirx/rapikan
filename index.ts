import { readdir, mkdir, rename, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";

// Helper to ask questions in the console
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

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
]);

interface FileMoveInfo {
  originalPath: string;
  filename: string;
  detectedDate: string; // YYYY-MM-DD
  source: "filename" | "creation_date" | "modification_date";
  targetDir: string;
  targetPath: string;
}

/**
 * Extracts a date from a filename.
 * Supports patterns like YYYYMMDD, YYYY-MM-DD, YYYY_MM_DD (years 1900-2099).
 */
function extractDateFromFilename(filename: string): string | null {
  // Regex matches:
  // - Start of string or any non-digit character (?:^|[^0-9])
  // - Year (19xx or 20xx)
  // - Optional separator [- _]
  // - Month (01-12)
  // - Optional separator [- _]
  // - Day (01-31)
  const regex = /(?:^|[^0-9])(19\d{2}|20\d{2})[-_]?(0[1-9]|1[0-2])[-_]?(0[1-9]|[12]\d|3[01])/;
  const match = filename.match(regex);
  if (match) {
    const year = match[1];
    const month = match[2];
    const day = match[3];
    return `${year}-${month}-${day}`;
  }
  return null;
}

/**
 * Generates a unique destination path to avoid overwriting existing files.
 * If the file exists, it appends _(1), _(2), etc.
 */
function getUniqueDestPath(destDir: string, filename: string): string {
  let destPath = path.join(destDir, filename);
  if (!existsSync(destPath)) {
    return destPath;
  }

  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);
  let counter = 1;

  while (true) {
    const candidateName = `${baseName}_(${counter})${ext}`;
    const candidatePath = path.join(destDir, candidateName);
    if (!existsSync(candidatePath)) {
      return candidatePath;
    }
    counter++;
  }
}

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let skipConfirm = false;
  let targetPathArg = "";

  for (const arg of args) {
    if (arg === "-y" || arg === "--yes") {
      skipConfirm = true;
    } else if (!arg.startsWith("-")) {
      targetPathArg = arg;
    }
  }

  let targetDir = "";

  console.log("\n=============================================");
  console.log("   TOOL MERAPIKAN FILE BERDASARKAN TANGGAL   ");
  console.log("=============================================\n");

  if (targetPathArg) {
    targetDir = path.resolve(targetPathArg);
  } else {
    // Determine directories for interactive fallback
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
      if (customPath.trim()) {
        targetDir = path.resolve(customPath.trim());
      } else {
        console.log("Path kosong, menggunakan Folder Saat Ini.");
        targetDir = currentDir;
      }
    } else {
      targetDir = currentDir;
    }
  }

  // Cross-platform path normalization
  targetDir = path.normalize(targetDir);
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
    // Only process files, skip directories
    if (!entry.isFile()) continue;

    // Skip ignored files (like configuration files, scripts, etc.)
    if (IGNORED_FILES.has(entry.name)) continue;

    const originalPath = path.join(targetDir, entry.name);
    let detectedDate = "";
    let source: FileMoveInfo["source"] = "filename";

    // 1. Try to extract date from the filename
    const dateFromFilename = extractDateFromFilename(entry.name);
    
    if (dateFromFilename) {
      detectedDate = dateFromFilename;
      source = "filename";
    } else {
      // 2. Fallback to file creation/modification metadata
      try {
        const fileStat = await stat(originalPath);
        
        // Find the oldest timestamp between birthtime and mtime
        const birthTime = fileStat.birthtimeMs || Infinity;
        const mTime = fileStat.mtimeMs || Infinity;
        const timeToUse = Math.min(birthTime, mTime);

        if (timeToUse !== Infinity) {
          const date = new Date(timeToUse);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const day = String(date.getDate()).padStart(2, "0");
          detectedDate = `${year}-${month}-${day}`;
          source = fileStat.birthtimeMs <= fileStat.mtimeMs ? "creation_date" : "modification_date";
        }
      } catch (err) {
        console.warn(`[PERINGATAN] Gagal membaca metadata file: ${entry.name}. File dilewati.`);
        continue;
      }
    }

    if (!detectedDate) {
      console.warn(`[PERINGATAN] Gagal menentukan tanggal untuk file: ${entry.name}. File dilewati.`);
      continue;
    }

    const destDir = path.join(targetDir, detectedDate);
    moves.push({
      originalPath,
      filename: entry.name,
      detectedDate,
      source,
      targetDir: destDir,
      targetPath: "", // will be calculated during run
    });
  }

  if (moves.length === 0) {
    console.log("\nTidak ada file yang perlu dirapikan di folder tersebut.");
    rl.close();
    return;
  }

  console.log(`\nDitemukan ${moves.length} file untuk dirapikan:\n`);
  
  // Display preview
  for (const move of moves) {
    const srcLabel = 
      move.source === "filename" ? "[Nama File]" : 
      move.source === "creation_date" ? "[Tgl Dibuat]" : "[Tgl Diubah]";
    
    console.log(` - ${move.filename.padEnd(45)} -> /${move.detectedDate}/ ${srcLabel}`);
  }

  let confirmed = false;
  if (skipConfirm) {
    console.log("\nAuto-konfirmasi aktif (-y/--yes). Memulai pemindahan...");
    confirmed = true;
  } else {
    const confirm = await question(`\nApakah Anda yakin ingin merapikan file-file ini? (y/n, default n): `);
    if (confirm.toLowerCase().trim() === "y" || confirm.toLowerCase().trim() === "ya") {
      confirmed = true;
    }
  }
  
  if (confirmed) {
    console.log("\nMemulai proses pemindahan...");
    let successCount = 0;
    let failCount = 0;

    for (const move of moves) {
      try {
        // Ensure destination folder exists
        await mkdir(move.targetDir, { recursive: true });
        
        // Find a unique filename if it already exists in the destination
        const uniqueDestPath = getUniqueDestPath(move.targetDir, move.filename);
        const finalFilename = path.basename(uniqueDestPath);

        // Move the file
        await rename(move.originalPath, uniqueDestPath);
        
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

    console.log(`\n=============================================`);
    console.log(`PROSES SELESAI`);
    console.log(`Berhasil dipindahkan : ${successCount} file`);
    console.log(`Gagal dipindahkan    : ${failCount} file`);
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