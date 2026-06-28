import { bold, cyan, magenta, blue, gray, dim } from "../utils/colors.js";

// ─────────────────────────────────────────────
// Banner & UI helpers
// ─────────────────────────────────────────────
export function printBanner(): void {
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

export type SourceKind =
  | "filename"
  | "exif"
  | "video_metadata"
  | "creation_date"
  | "modification_date";

export function sourceLabel(s: SourceKind): string {
  switch (s) {
    case "filename":          return cyan("  [Nama File]  ");
    case "exif":              return magenta("  [EXIF Foto]  ");
    case "video_metadata":    return blue("  [Meta Video] ");
    case "creation_date":     return gray("  [Tgl Dibuat] ");
    case "modification_date": return gray("  [Tgl Diubah] ");
  }
}
