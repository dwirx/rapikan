import path from "node:path";

// ─────────────────────────────────────────────
// Date from EXIF (JPEG/TIFF/HEIC)
// ─────────────────────────────────────────────
export async function extractDateFromExif(filePath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (![".jpg", ".jpeg", ".tiff", ".tif", ".heic", ".heif"].includes(ext)) return null;
  try {
    const fd  = await Bun.file(filePath).arrayBuffer();
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
    const isLE      = byteOrder === "II";
    const r16 = (o: number) => (isLE ? buf.readUInt16LE(exifStart + o) : buf.readUInt16BE(exifStart + o));
    const r32 = (o: number) => (isLE ? buf.readUInt32LE(exifStart + o) : buf.readUInt32BE(exifStart + o));

    const parseDate = (offset: number): string | null => {
      const s = buf.slice(exifStart + offset, exifStart + offset + 19).toString("ascii");
      if (/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
        const [dp]   = s.split(" ");
        const [y, m, d] = dp.split(":");
        if (!isNaN(new Date(`${y}-${m}-${d}`).getTime()) && parseInt(y) > 1900)
          return `${y}-${m}-${d}`;
      }
      return null;
    };

    const targetTags = [0x9003, 0x9004, 0x0132];
    const ifd0 = r32(4);
    const n    = r16(ifd0);

    for (let i = 0; i < n && i < 64; i++) {
      const eo = ifd0 + 2 + i * 12;
      if (eo + 12 > buf.length - exifStart) break;
      const tag = r16(eo);
      if (tag === 0x8769) {
        const subOff = r32(eo + 8);
        const sn     = r16(subOff);
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
