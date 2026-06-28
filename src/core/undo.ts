import { readdir, readFile, writeFile, mkdir, rename, rmdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { bold, green, yellow, red, dim } from "../utils/colors.js";
import { getUniqueDest } from "../utils/fs.js";

export interface HistoryEntry {
  from:      string;
  to:        string;
  timestamp: string;
}

// ─────────────────────────────────────────────
// UNDO last organize operation
// ─────────────────────────────────────────────
export async function undoLastOperation(targetDir: string, rl: readline.Interface): Promise<void> {
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
    const to   = green(path.basename(e.from));
    console.log(`  ${yellow("←")} ${from}  →  ${to}`);
  }

  const confirm = await new Promise<string>((resolve) =>
    rl.question(bold(`\n  Kembalikan semua? (y/n): `), resolve)
  );
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
