// ─────────────────────────────────────────────
// CLI Argument Types & Parser
// ─────────────────────────────────────────────
export interface CLIArgs {
  targetPathArg: string;
  skipConfirm:   boolean;
  dryRun:        boolean;
  doUndo:        boolean;
  recursive:     boolean;
  extFilter:     Set<string> | null; // null = all
  format:        string;
  dedup:         boolean;
  // ── New v1.0.6 flags ──
  doClean:       boolean;         // --clean
  doDeleteDupes: boolean;         // --delete-dupes
  deleteWhere:   string | null;   // --delete-where <criteria>
  doCopy:        boolean;         // --copy (copy instead of move)
  // ── New v1.0.7 flags ──
  doRm:          boolean;         // --rm (delete any file/folder)
  rmTargets:     string[];        // paths after --rm
}

export function parseArgs(argv: string[]): CLIArgs {
  const args = argv.slice(2);

  let skipConfirm:   boolean          = false;
  let dryRun:        boolean          = false;
  let doUndo:        boolean          = false;
  let recursive:     boolean          = false;
  let dedup:         boolean          = false;
  let doClean:       boolean          = false;
  let doDeleteDupes: boolean          = false;
  let doCopy:        boolean          = false;
  let doRm:          boolean          = false;
  let rmTargets:     string[]         = [];
  let deleteWhere:   string | null    = null;
  let targetPathArg: string           = "";
  let format:        string           = "YYYY-MM-DD";
  let extFilter:     Set<string> | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if      (arg === "-y" || arg === "--yes")        skipConfirm   = true;
    else if (arg === "-d" || arg === "--dry-run")    dryRun        = true;
    else if (arg === "--undo")                       doUndo        = true;
    else if (arg === "-r" || arg === "--recursive")  recursive     = true;
    else if (arg === "--dedup")                      dedup         = true;
    else if (arg === "--clean")                      doClean       = true;
    else if (arg === "--delete-dupes")               doDeleteDupes = true;
    else if (arg === "--copy")                       doCopy        = true;
    else if (arg === "--rm") {
      // Collect all subsequent non-flag arguments as paths to delete
      doRm = true;
      while (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        rmTargets.push(args[++i]);
      }
    }
    else if (arg === "--delete-where") {
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        deleteWhere = next;
        i++;
      }
    }
    else if (arg === "-f" || arg === "--format") {
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        format = next;
        i++;
      }
    }
    else if (arg === "--ext") {
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        extFilter = new Set(
          next.split(",").map((e) =>
            e.startsWith(".") ? e.toLowerCase() : `.${e.toLowerCase()}`
          )
        );
        i++;
      }
    }
    else if (!arg.startsWith("-")) {
      targetPathArg = arg;
    }
  }

  return {
    skipConfirm,
    dryRun,
    doUndo,
    recursive,
    dedup,
    targetPathArg,
    format,
    extFilter,
    doClean,
    doDeleteDupes,
    deleteWhere,
    doCopy,
    doRm,
    rmTargets,
  };
}
