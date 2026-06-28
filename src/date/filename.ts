// ─────────────────────────────────────────────
// Date from Filename
// ─────────────────────────────────────────────
export function extractDateFromFilename(filename: string): string | null {
  const regex =
    /(?:^|[^0-9])(19\d{2}|20\d{2})[-_]?(0[1-9]|1[0-2])[-_]?(0[1-9]|[12]\d|3[01])/;
  const match = filename.match(regex);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return null;
}
