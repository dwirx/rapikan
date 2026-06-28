import path from "node:path";

// ─────────────────────────────────────────────
// Date from Video (MP4/MOV — reads mvhd atom)
// ─────────────────────────────────────────────
export async function extractDateFromVideo(filePath: string): Promise<string | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (![".mp4", ".mov", ".m4v", ".m4a", ".3gp"].includes(ext)) return null;
  try {
    const fd  = await Bun.file(filePath).arrayBuffer();
    const buf = Buffer.from(fd.slice(0, Math.min(262144, fd.byteLength)));
    const QT_EPOCH = 2082844800;

    let offset = 0;
    while (offset < buf.length - 8) {
      const size = buf.readUInt32BE(offset);
      const type = buf.slice(offset + 4, offset + 8).toString("ascii");
      if (size < 8) break;
      if (type === "moov") {
        let io  = offset + 8;
        const end = offset + size;
        while (io < end - 8) {
          const is = buf.readUInt32BE(io);
          const it = buf.slice(io + 4, io + 8).toString("ascii");
          if (is < 8) break;
          if (it === "mvhd") {
            const ver = buf.readUInt8(io + 8);
            const ct  = ver === 1
              ? buf.readUInt32BE(io + 12) * 0x100000000 + buf.readUInt32BE(io + 16)
              : buf.readUInt32BE(io + 12);
            if (ct > 0) {
              const d = new Date((ct - QT_EPOCH) * 1000);
              if (!isNaN(d.getTime()) && d.getUTCFullYear() > 1970) {
                const y  = d.getUTCFullYear();
                const m  = String(d.getUTCMonth() + 1).padStart(2, "0");
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
