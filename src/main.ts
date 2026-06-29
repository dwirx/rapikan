import path from "node:path";
import readline from "node:readline";
import { parseArgs }          from "./cli/args.js";
import { printBanner }        from "./cli/banner.js";
import { bold, green, yellow, red, cyan, magenta, blue, dim } from "./utils/colors.js";
import { renderProgressBar }  from "./utils/progress.js";
import { formatTargetPath }   from "./utils/fs.js";
import { scanFiles, detectDate } from "./core/scanner.js";
import { groupByHash }         from "./core/dedup.js";
import { undoLastOperation }   from "./core/undo.js";
import {
  organizeFiles,
  buildPreview,
  printPreview,
  saveHistory,
  FileMoveInfo,
} from "./core/organizer.js";
import {
  cleanEmptyFolders,
  deleteDuplicates,
  deleteWhere,
  deleteManual,
} from "./core/deleter.js";
import { listDirectory } from "./core/lister.js";

// ─────────────────────────────────────────────
// Main orchestration
// ─────────────────────────────────────────────
export async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  printBanner();

  // ── Active badges ──
  const badges: string[] = [];
  if (opts.dryRun)        badges.push(yellow("◉ DRY-RUN"));
  if (opts.recursive)     badges.push(cyan("◉ RECURSIVE"));
  if (opts.dedup)         badges.push(magenta("◉ DEDUP-HASH"));
  if (opts.doCopy)        badges.push(green("◉ COPY-MODE"));
  if (opts.doClean)       badges.push(red("◉ CLEAN"));
  if (opts.doDeleteDupes) badges.push(red("◉ DELETE-DUPES"));
  if (opts.deleteWhere)   badges.push(red(`◉ DELETE-WHERE: ${opts.deleteWhere}`));
  if (opts.doRm)          badges.push(bold(red(`◉ HAPUS MANUAL: ${opts.rmTargets.length} target`)));
  if (opts.doLs)          badges.push(bold(cyan("◉ LIST-FILES")));
  if (opts.extFilter)     badges.push(green(`◉ EXT: ${[...opts.extFilter].join(",")}`));
  if (opts.format !== "YYYY-MM-DD") badges.push(blue(`◉ FORMAT: ${opts.format}`));
  if (badges.length) console.log("  " + badges.join("  ") + "\n");

  // ── Readline interface ──
  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
  });
  const question = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  // ── --rm: delete explicit paths — no need for target dir selection ──
  if (opts.doRm) {
    await deleteManual(opts.rmTargets, opts.dryRun, opts.skipConfirm, rl, path.resolve(process.cwd()));
    rl.close();
    return;
  }

  // ── Select target dir ──
  let targetDir = "";
  if (opts.targetPathArg) {
    targetDir = path.resolve(opts.targetPathArg);
  } else {
    const cwd    = path.resolve(process.cwd());
    const parent = path.resolve(cwd, "..");
    console.log(bold("  Pilih folder yang ingin dirapikan:"));
    console.log(`  ${cyan("1.")} Folder Saat Ini  ${dim(cwd)}`);
    console.log(`  ${cyan("2.")} Folder Induk     ${dim(parent)}`);
    console.log(`  ${cyan("3.")} Path Kustom`);
    const ch = await question(bold("\n  Pilih (1/2/3, default 1): "));
    if (ch.trim() === "2")      targetDir = parent;
    else if (ch.trim() === "3") {
      const p = await question("  Path: ");
      targetDir = p.trim() ? path.resolve(p.trim()) : cwd;
    } else targetDir = cwd;
  }

  targetDir = path.normalize(targetDir);

  // ── Route ──

  if (opts.doUndo) {
    await undoLastOperation(targetDir, rl);
    return;
  }

  if (opts.doClean) {
    await cleanEmptyFolders(targetDir, opts.dryRun, opts.skipConfirm, rl);
    rl.close();
    return;
  }

  if (opts.doDeleteDupes) {
    await deleteDuplicates(targetDir, opts.recursive, opts.dryRun, opts.skipConfirm, rl);
    rl.close();
    return;
  }

  if (opts.deleteWhere) {
    await deleteWhere(targetDir, opts.deleteWhere, opts.recursive, opts.dryRun, opts.skipConfirm, rl);
    rl.close();
    return;
  }

  if (opts.doLs) {
    await listDirectory(targetDir, opts.recursive, opts.extFilter);
    rl.close();
    return;
  }


  // ── Default: organize files ──
  console.log(`\n  ${bold("📂 Memindai:")} ${cyan(targetDir)}\n`);

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

  console.log(dim(`  Menganalisis ${filePaths.length} file...\n`));

  const moves: FileMoveInfo[] = [];
  let dedupResult: { dupGroups: Map<string, string[]> } | null = null;

  // Collect candidates (with progress)
  const candidates: string[] = [];
  for (let i = 0; i < filePaths.length; i++) {
    const fp       = filePaths[i];
    const filename = path.basename(fp);

    process.stdout.write(
      `\r  ${renderProgressBar(i + 1, filePaths.length, 30)}  ${dim(filename.slice(0, 30).padEnd(30))}`
    );

    const detected = await detectDate(fp);
    if (!detected) continue;

    candidates.push(fp);
    const tDir = formatTargetPath(targetDir, detected.date, opts.format);
    moves.push({
      originalPath: fp,
      filename,
      detectedDate: detected.date,
      source:       detected.source,
      targetDir:    tDir,
    });
  }

  process.stdout.write("\r" + " ".repeat(80) + "\r");

  // ── Dedup (if --dedup flag) ──
  let filteredMoves = moves;
  if (opts.dedup && moves.length > 0) {
    const paths = moves.map((m) => m.originalPath);
    const result = await groupByHash(paths, (i, total, fp) => {
      process.stdout.write(
        `\r  ${magenta("Hashing")} [${i}/${total}] ${dim(path.basename(fp).slice(0, 40).padEnd(40))}`
      );
    });
    process.stdout.write("\r" + " ".repeat(80) + "\r");

    dedupResult = { dupGroups: result.dupGroups };

    if (result.dupGroups.size > 0) {
      console.log(bold(magenta(`  🧬 Duplikat Terdeteksi (${result.dupGroups.size} grup):\n`)));
      for (const [hash, paths] of result.dupGroups) {
        console.log(`  ${magenta("▸")} Hash: ${dim(hash.slice(0, 12))}...`);
        for (const p of paths) console.log(`    ${dim("•")} ${path.relative(targetDir, p)}`);
      }
      const totalDups = [...result.dupGroups.values()].reduce((s, a) => s + a.length - 1, 0);
      console.log(dim(`\n  ${totalDups} file duplikat dilewati (tidak akan dipindahkan)\n`));
    }

    // Keep only unique moves
    const uniqueSet = new Set(result.unique);
    filteredMoves = moves.filter((m) => uniqueSet.has(m.originalPath));
  }

  if (filteredMoves.length === 0) {
    console.log(yellow("\n  ⚠ Tidak ada file unik yang perlu dirapikan.\n"));
    rl.close();
    return;
  }

  // ── Preview ──
  const byDate = buildPreview(filteredMoves, targetDir, opts.format);
  printPreview(filteredMoves, byDate, targetDir, opts.format, opts.doCopy);

  if (opts.dryRun) {
    const verb = opts.doCopy ? "DISALIN" : "DIPINDAHKAN";
    console.log(bold(yellow(`\n  ✔ SIMULASI SELESAI — Tidak ada file yang ${verb}.`)));
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
    const verb = opts.doCopy ? "salin" : "rapikan";
    const ans  = await question(bold(`\n  ${verb.charAt(0).toUpperCase() + verb.slice(1)} ${filteredMoves.length} file sekarang? (y/n): `));
    confirmed  = ans.toLowerCase().trim() === "y" || ans.toLowerCase().trim() === "ya";
  }

  if (!confirmed) {
    console.log(yellow("\n  Dibatalkan. Tidak ada file yang dipindahkan.\n"));
    rl.close();
    return;
  }

  // ── Execute ──
  console.log("");
  const { ok, fail, history } = await organizeFiles(filteredMoves, targetDir, opts.doCopy);

  // ── Save history ──
  await saveHistory(targetDir, history);

  // ── Summary ──
  const verb = opts.doCopy ? "disalin" : "dipindahkan";
  console.log(`\n  ${bold(green("✔ SELESAI!"))}\n`);
  console.log(`  ${green("✓")} Berhasil ${verb}  : ${bold(green(String(ok)))} file`);
  if (fail > 0) console.log(`  ${red("✗")} Gagal               : ${bold(red(String(fail)))} file`);
  if (opts.dedup && dedupResult && dedupResult.dupGroups.size > 0) {
    const d = [...dedupResult.dupGroups.values()].reduce((s, a) => s + a.length - 1, 0);
    console.log(`  ${magenta("◎")} Duplikat dilewati     : ${bold(magenta(String(d)))} file`);
  }
  console.log(`\n  ${dim("Riwayat:")}  ${dim(".rapikan-history.json")}`);
  console.log(`  ${dim("Undo   :")}  ${dim(`rapikan ${opts.targetPathArg || "."} --undo`)}\n`);

  rl.close();
}
