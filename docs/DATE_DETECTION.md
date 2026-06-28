# 🧠 Cara Kerja Deteksi Tanggal

Rapikan menggunakan **4 lapisan prioritas** untuk mendeteksi tanggal file secara akurat.

---

## Urutan Prioritas

```
Prioritas 1 → Nama File      (tercepat, paling akurat untuk drone)
Prioritas 2 → EXIF Metadata  (akurat untuk foto, meski file sudah dikopi)
Prioritas 3 → Video Metadata (akurat untuk video, meski file sudah dikopi)
Prioritas 4 → Metadata OS    (fallback — bisa berubah saat copy antar komputer)
```

---

## 1. Deteksi dari Nama File

Rapikan mencari pola tanggal `YYYYMMDD`, `YYYY-MM-DD`, atau `YYYY_MM_DD` di dalam nama file.

**Contoh pola yang terdeteksi:**

| Nama File | Tanggal Terdeteksi |
|-----------|-------------------|
| `DJI_20260622_123015.mp4` | `2026-06-22` |
| `2026-06-22_liburan.jpg` | `2026-06-22` |
| `VID_20260622_154500.mp4` | `2026-06-22` |
| `IMG_2026_06_22_091500.jpg` | `2026-06-22` |
| `snapshot20260622.png` | `2026-06-22` |

**Pola tidak terdeteksi** (akan lanjut ke lapisan berikutnya):
- `IMG_4521.jpg` — tidak ada pola tanggal
- `video.mp4` — tidak ada tanggal
- `photo.heic` — tidak ada tanggal

---

## 2. Deteksi dari EXIF Metadata (Foto)

Untuk file foto yang tidak punya tanggal di nama file, rapikan membaca langsung
metadata **EXIF** dari dalam file — tanpa library pihak ketiga.

**Tag EXIF yang dibaca (urutan prioritas):**
1. `DateTimeOriginal` (0x9003) — waktu asli foto diambil
2. `DateTimeDigitized` (0x9004) — waktu foto didigitalisasi
3. `DateTime` (0x0132) — waktu file terakhir diubah

**Format file yang didukung:**
- `.jpg` / `.jpeg`
- `.tiff` / `.tif`
- `.heic` / `.heif` (iPhone)

**Mengapa ini penting?**
Ketika foto dikopi dari kamera ke komputer, tanggal sistem (`mtime`) berubah menjadi
tanggal hari ini. Data EXIF di dalam file tidak berubah — sehingga tanggal yang didapat
adalah tanggal **asli saat foto diambil**.

---

## 3. Deteksi dari Metadata Video (MP4/MOV)

Untuk file video, rapikan membaca atom `mvhd` (Movie Header) dari format container
QuickTime/MP4 — format yang digunakan oleh hampir semua drone, kamera, dan iPhone.

**Format file yang didukung:**
- `.mp4`
- `.mov`
- `.m4v`
- `.m4a`
- `.3gp`

**Cara kerja:**
1. Baca file hingga 256KB pertama
2. Cari atom `moov` (container utama)
3. Di dalam `moov`, cari atom `mvhd` (movie header)
4. Baca field `creation_time` (32-bit atau 64-bit tergantung versi)
5. Konversi dari **QuickTime epoch** (1904-01-01) ke tanggal normal

**QuickTime Epoch:**
```
Unix epoch     = 1970-01-01 00:00:00 UTC
QuickTime epoch = 1904-01-01 00:00:00 UTC
Selisih        = 2,082,844,800 detik
```

---

## 4. Fallback: Metadata Sistem (birthtime/mtime)

Jika ketiga metode di atas tidak berhasil, rapikan menggunakan metadata file dari sistem operasi.

**Prioritas dalam metadata OS:**
1. `birthtime` — waktu file pertama kali dibuat (lebih akurat)
2. `mtime` — waktu file terakhir dimodifikasi (fallback)

**Label yang ditampilkan:**
- `[Tgl Dibuat]` — dari `birthtime`
- `[Tgl Diubah]` — dari `mtime`

> ⚠ Metadata OS bisa berubah saat file dikopi antar komputer. Gunakan metode
> EXIF/Video untuk akurasi terbaik.

---

## Label Sumber di Output

Saat menampilkan preview, rapikan menunjukkan dari mana tanggal didapat:

| Label | Warna | Sumber |
|-------|-------|--------|
| `[Nama File]` | Cyan | Pola tanggal di nama file |
| `[EXIF Foto]` | Magenta | Data EXIF di dalam file foto |
| `[Meta Video]` | Biru | Atom `mvhd` di file video |
| `[Tgl Dibuat]` | Abu-abu | `birthtime` dari OS |
| `[Tgl Diubah]` | Abu-abu | `mtime` dari OS |
