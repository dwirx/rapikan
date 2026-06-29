import { readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  bold, green, yellow, red, cyan, magenta, blue, gray, dim
} from "../utils/colors.js";
import { IGNORED_FILES } from "../utils/fs.js";

// ─────────────────────────────────────────────
// Format Bytes
// ─────────────────────────────────────────────
function fmtBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1_024)         return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

// ─────────────────────────────────────────────
// Get file icon based on extension
// ─────────────────────────────────────────────
function getFileIcon(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if ([".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"].includes(ext)) return "🎬";
  if ([".jpg", ".jpeg", ".png", ".gif", ".heic", ".heif", ".webp", ".tiff", ".tif"].includes(ext)) return "🖼️";
  if ([".mp3", ".wav", ".flac", ".m4a", ".aac"].includes(ext)) return "🎵";
  if ([".zip", ".tar", ".gz", ".rar", ".7z", ".dmg", ".iso"].includes(ext)) return "📦";
  if ([".txt", ".md", ".json", ".xml", ".yaml", ".yml", ".pdf", ".doc", ".docx", ".xls", ".xlsx"].includes(ext)) return "📝";
  if ([".ts", ".js", ".tsx", ".jsx", ".html", ".css", ".py", ".go", ".rs", ".cpp", ".c", ".sh", ".bat", ".ps1"].includes(ext)) return "💻";
  return "📄";
}

interface FileInfo {
  name: string;
  fullPath: string;
  size: number;
  date: string;
  ext: string;
}

interface DirInfo {
  name: string;
  fullPath: string;
  files: FileInfo[];
  subdirs: DirInfo[];
}

// ─────────────────────────────────────────────
// Recursive tree scan & build
// ─────────────────────────────────────────────
async function buildTree(
  dir: string,
  recursive: boolean,
  extFilter: Set<string> | null,
  stats: { totalFiles: number; totalDirs: number; totalSize: number; exts: Record<string, { count: number; size: number }> }
): Promise<DirInfo | null> {
  if (!existsSync(dir)) return null;

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: FileInfo[] = [];
    const subdirs: DirInfo[] = [];

    for (const entry of entries) {
      if (IGNORED_FILES.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        stats.totalDirs++;
        if (recursive) {
          const subTree = await buildTree(fullPath, recursive, extFilter, stats);
          if (subTree) {
            subdirs.push(subTree);
          }
        } else {
          subdirs.push({
            name: entry.name,
            fullPath,
            files: [],
            subdirs: []
          });
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extFilter && !extFilter.has(ext)) continue;

        let size = 0;
        let dateStr = "-";
        try {
          const s = await stat(fullPath);
          size = s.size;
          const d = s.mtime || s.birthtime;
          if (d) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            dateStr = `${y}-${m}-${dd}`;
          }
        } catch {}

        files.push({
          name: entry.name,
          fullPath,
          size,
          date: dateStr,
          ext
        });

        // Update global stats
        stats.totalFiles++;
        stats.totalSize += size;
        if (!stats.exts[ext]) {
          stats.exts[ext] = { count: 0, size: 0 };
        }
        stats.exts[ext].count++;
        stats.exts[ext].size += size;
      }
    }

    // Sort alphabetically
    files.sort((a, b) => a.name.localeCompare(b.name));
    subdirs.sort((a, b) => a.name.localeCompare(b.name));

    return {
      name: path.basename(dir) || dir,
      fullPath: dir,
      files,
      subdirs
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Print Tree representation to console
// ─────────────────────────────────────────────
function printTree(dirInfo: DirInfo, prefix = "") {
  const numDirs = dirInfo.subdirs.length;
  const numFiles = dirInfo.files.length;
  const totalItems = numDirs + numFiles;

  // Print subdirectories first
  for (let i = 0; i < numDirs; i++) {
    const subdir = dirInfo.subdirs[i];
    const isLast = (i === numDirs - 1 && numFiles === 0);
    const branch = isLast ? "└── " : "├── ";
    console.log(`${gray(prefix)}${cyan(branch)}📁 ${bold(cyan(subdir.name))}/`);
    
    const nextPrefix = prefix + (isLast ? "    " : "│   ");
    printTree(subdir, nextPrefix);
  }

  // Print files
  for (let i = 0; i < numFiles; i++) {
    const file = dirInfo.files[i];
    const isLast = (i === numFiles - 1);
    const branch = isLast ? "└── " : "├── ";
    
    const icon = getFileIcon(file.name);
    const sizeStr = yellow(fmtBytes(file.size));
    const dateStr = gray(file.date);
    
    console.log(`${gray(prefix)}${green(branch)}${icon} ${green(file.name)} ${dim(`(${sizeStr} | ${dateStr})`)}`);
  }
}

// ─────────────────────────────────────────────
// main entry for listing
// ─────────────────────────────────────────────
export async function listDirectory(
  targetDir: string,
  recursive: boolean,
  extFilter: Set<string> | null
): Promise<void> {
  const stats = {
    totalFiles: 0,
    totalDirs: 0,
    totalSize: 0,
    exts: {} as Record<string, { count: number; size: number }>
  };

  console.log(bold(cyan(`\n  🔎 Memindai & mendaftar berkas di: ${cyan(targetDir)}`)));
  if (extFilter) {
    console.log(dim(`     Filter ekstensi: ${[...extFilter].join(", ")}`));
  }
  console.log("");

  const tree = await buildTree(targetDir, recursive, extFilter, stats);

  if (!tree || (tree.files.length === 0 && tree.subdirs.length === 0)) {
    console.log(yellow("  ⚠ Direktori kosong atau tidak ditemukan berkas yang cocok.\n"));
    return;
  }

  // Display folder header
  console.log(bold(cyan(`📁 ${tree.name}/`)));
  printTree(tree, "");

  // Display Statistics Footer
  console.log("");
  console.log(bold(cyan("  📊 STATISTIK DIREKTORI:")));
  console.log(`  ${gray("•")} Total File       : ${bold(green(String(stats.totalFiles)))} file`);
  console.log(`  ${gray("•")} Total Folder     : ${bold(cyan(String(stats.totalDirs)))} folder`);
  console.log(`  ${gray("•")} Total Ukuran     : ${bold(yellow(fmtBytes(stats.totalSize)))}`);

  // Breakdown by extensions
  const extList = Object.entries(stats.exts).sort((a, b) => b[1].size - a[1].size);
  if (extList.length > 0) {
    console.log("");
    console.log(bold(magenta("  🧬 DISTRIBUSI TIPE BERKAS (berdasarkan ukuran):")));
    for (const [ext, data] of extList) {
      const displayExt = ext ? ext : "(tanpa ekstensi)";
      const icon = getFileIcon(`file${ext}`);
      console.log(
        `    ${icon} ${bold(magenta(displayExt.padEnd(8)))} : ${bold(green(String(data.count).padStart(3)))} file ${gray("│")} ${bold(yellow(fmtBytes(data.size).padStart(10)))}`
      );
    }
  }
  console.log("");
}
