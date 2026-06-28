# Rapikan - File Organizer Tool

Tool sederhana berbasis TypeScript dan Bun untuk merapikan file di dalam folder target dengan cara mengelompokkannya secara otomatis ke dalam subfolder berdasarkan tanggal (`YYYY-MM-DD`).

Tool ini sangat berguna untuk merapikan file media seperti hasil rekaman drone (misalnya DJI), kamera, atau handphone.

---

## 🚀 Fitur Utama

- **Deteksi Tanggal Pintar (4 Lapisan Prioritas)**:
  1. 📋 **Nama File** — Pola seperti `DJI_20260622_...` langsung dideteksi.
  2. 📷 **EXIF Metadata Foto** *(Baru!)* — Baca tanggal asli rekaman dari header file JPEG/TIFF/HEIC. Akurat meski file sudah dikopi atau dikompresi.
  3. 🎬 **Metadata Video** *(Baru!)* — Baca `creation_time` dari header atom MP4/MOV/M4V. Tanggal asli drone/kamera, bukan tanggal file.
  4. 🗓️ **Metadata Sistem** — Fallback ke `birthtime`/`mtime` dari sistem operasi.
- **Mode Simulasi / Dry-Run** *(Baru!)*:
  - Tampilkan rencana pemindahan lengkap **tanpa benar-benar memindahkan** satu file pun. Aman untuk preview sebelum eksekusi.
- **Fitur Undo / Pembatalan** *(Baru!)*:
  - Setiap proses merapikan menyimpan log riwayat `.rapikan-history.json`. Jalankan `--undo` untuk memindahkan semua file kembali ke lokasi asalnya.
- **Pencegahan Overwrite (Deduplikasi)**:
  - Jika nama file sama di folder tujuan, otomatis direname menjadi `nama_(1).ext`, `nama_(2).ext`, dst.
- **Kompatibel Lintas OS (Multi-Platform)**:
  - Berjalan di **Windows** (PowerShell/CMD) maupun **Linux/macOS** dengan normalisasi path otomatis.
- **Keamanan File Proyek**:
  - Secara otomatis mengabaikan `index.ts`, `package.json`, `.git`, `.agents`, dll.

---

## 📦 Instalasi

### 🚀 One-line Install (Recommended for Linux/macOS)
```bash
curl -fsSL https://raw.githubusercontent.com/dwirx/rapikan/main/install-curl.sh | bash
```

### 📦 Package Managers

#### **NPM / Yarn / PNPM**
```bash
npm install -g rapikan
# Atau menggunakan Yarn
yarn global add rapikan
# Atau menggunakan PNPM
pnpm add -g rapikan
```

#### **Bun (Recommended)**
```bash
bun install -g rapikan
```

---

### 🪟 Windows Support
Tool ini sepenuhnya kompatibel dengan **PowerShell, CMD, Git Bash, dan WSL**.

```powershell
npm install -g rapikan
# Atau dengan Bun
bun install -g rapikan
```

#### **Scoop (Windows)**
```powershell
scoop bucket add dwirx https://github.com/dwirx/scoop-rapikan
scoop install rapikan
```

---

### 🍎 macOS & Linux Alternative (Homebrew / AUR)

#### **Homebrew (macOS/Linux)**
```bash
brew tap dwirx/rapikan
brew install rapikan
```

#### **Arch Linux (AUR)**
```bash
yay -S rapikan-bin
```

---

### 📥 Manual Download
Unduh standalone binary langsung dari rilis GitHub:
- **Linux x64**: [rapikan-linux-x64](https://github.com/dwirx/rapikan/releases/latest/download/rapikan-linux-x64)
- **Linux ARM64**: [rapikan-linux-arm64](https://github.com/dwirx/rapikan/releases/latest/download/rapikan-linux-arm64)
- **Windows x64**: [rapikan-windows-x64.exe](https://github.com/dwirx/rapikan/releases/latest/download/rapikan-windows-x64.exe)
- **macOS Intel**: [rapikan-darwin-x64](https://github.com/dwirx/rapikan/releases/latest/download/rapikan-darwin-x64)
- **macOS Apple Silicon**: [rapikan-darwin-arm64](https://github.com/dwirx/rapikan/releases/latest/download/rapikan-darwin-arm64)

**Setelah diunduh (macOS/Linux):**
```bash
chmod +x rapikan-linux-x64
sudo mv rapikan-linux-x64 /usr/local/bin/rapikan
```

---

## 💻 Cara Penggunaan

### Perintah Dasar

#### Jalankan di folder saat ini (Menu Interaktif)
```bash
rapikan
```

#### Jalankan pada folder tertentu
```bash
rapikan ./path/ke/folder
```

#### Jalankan tanpa konfirmasi (Auto-Confirm)
```bash
rapikan ./path/ke/folder -y
```

---

### 🔍 Mode Simulasi (Dry-Run) *(Fitur Baru)*

Tampilkan rencana lengkap pemindahan file **tanpa benar-benar memindahkan** file apapun.
Sangat berguna untuk memverifikasi hasil sebelum benar-benar mengeksekusi.

```bash
# Simulasi di folder saat ini
rapikan --dry-run

# Simulasi pada folder tertentu
rapikan ./folder-drone --dry-run

# Bisa dikombinasikan dengan path
rapikan /mnt/sdcard/DCIM --dry-run
```

**Contoh Output:**
```
🔍 MODE SIMULASI (DRY-RUN) AKTIF - Tidak ada file yang akan dipindahkan.

Ditemukan 5 file untuk dirapikan:

 - DJI_20260620_123015.mp4               -> /2026-06-20/ [Nama File]
 - DJI_20260620_154522.mp4               -> /2026-06-20/ [Nama File]
 - liburan.jpg                           -> /2026-06-22/ [EXIF Foto]
 - video_trip.mov                        -> /2026-06-21/ [Metadata Video]
 - IMG_3421.jpg                          -> /2026-06-18/ [EXIF Foto]

✅ Simulasi selesai. Tidak ada file yang dipindahkan (mode --dry-run).
   Hapus flag --dry-run untuk benar-benar merapikan file.
```

---

### ↩️ Fitur Undo (Pembatalan) *(Fitur Baru)*

Setiap kali `rapikan` memindahkan file, ia secara otomatis menyimpan riwayat pemindahan
ke file `.rapikan-history.json` di dalam folder target.

Gunakan `--undo` untuk **mengembalikan semua file ke lokasi asalnya** sebelum dirapikan.

```bash
# Batalkan hasil rapikan di folder saat ini
rapikan --undo

# Batalkan hasil rapikan di folder tertentu
rapikan ./folder-drone --undo
```

**Contoh Output:**
```
Ditemukan 5 file dalam riwayat terakhir:
Dicatat pada: 2026-06-28T11:00:00.000Z

 - /2026-06-20/DJI_20260620_123015.mp4  -> kembali ke /DJI_20260620_123015.mp4
 - /2026-06-20/DJI_20260620_154522.mp4  -> kembali ke /DJI_20260620_154522.mp4
 - /2026-06-22/liburan.jpg              -> kembali ke /liburan.jpg

Kembalikan semua file ke lokasi semula? (y/n, default n): y

[OK] Dikembalikan: 2026-06-20/DJI_20260620_123015.mp4
...

UNDO SELESAI
Berhasil dikembalikan : 5 file
```

> **Catatan**: File `.rapikan-history.json` akan direset setelah `--undo` berhasil dijalankan.
> Undo hanya bisa dilakukan **sekali** untuk setiap sesi merapikan.

---

### 📷 Deteksi Tanggal dari EXIF & Video *(Fitur Baru)*

Rapikan kini mampu membaca tanggal asli rekaman dari dalam file media, **tanpa menggunakan
library pihak ketiga apapun** — semua diproses secara native.

**Mengapa ini penting?**
Ketika file foto atau video dikopi ke komputer lain, tanggal sistem file (`mtime`/`birthtime`)
sering kali berubah menjadi tanggal hari ini. Dengan membaca metadata internal file, rapikan
mendapatkan tanggal asli saat foto/video diambil.

**Format yang didukung:**
| Tipe | Format | Sumber Data |
|------|--------|-------------|
| Foto | `.jpg`, `.jpeg`, `.tiff`, `.heic`, `.heif` | EXIF `DateTimeOriginal` |
| Video | `.mp4`, `.mov`, `.m4v`, `.m4a`, `.3gp` | QuickTime `creation_time` atom |

**Contoh Output (terlihat di preview/dry-run):**
```
 - foto_liburan.jpg    -> /2026-05-14/ [EXIF Foto]
 - DJI_clip.mp4        -> /2026-06-20/ [Metadata Video]
 - old_photo.jpg       -> /2023-12-25/ [EXIF Foto]
```

---

## 📋 Referensi Flag Lengkap

| Flag | Alias | Deskripsi |
|------|-------|-----------|
| (tidak ada) | | Mode interaktif — tampilkan menu pilihan folder |
| `./path` | | Tentukan folder target langsung |
| `-y` | `--yes` | Auto-konfirmasi, tidak perlu tekan `y` |
| `-d` | `--dry-run` | Mode simulasi — preview saja, tidak ada file dipindah |
| `--undo` | | Kembalikan file ke lokasi semula berdasarkan riwayat terakhir |

---

## 📝 Contoh Ilustrasi Struktur Folder

**Sebelum dirapikan:**
```text
📂 folder-media/
 ┣ 📄 DJI_20260620_123015.mp4
 ┣ 📄 DJI_20260620_154522.mp4
 ┣ 📄 DJI_20260621_091500.mp4
 ┗ 📄 liburan.jpg  (EXIF: diambil 25 Juni 2026)
```

**Setelah dijalankan:**
```text
📂 folder-media/
 ┣ 📂 2026-06-20/
 ┃ ┣ 📄 DJI_20260620_123015.mp4
 ┃ ┗ 📄 DJI_20260620_154522.mp4
 ┣ 📂 2026-06-21/
 ┃ ┗ 📄 DJI_20260621_091500.mp4
 ┗ 📂 2026-06-25/
   ┗ 📄 liburan.jpg
 ┗ 📄 .rapikan-history.json  (riwayat untuk --undo)
```

---

## 🛠️ Pengembangan (Development / Clone)

Jika Anda men-clone repositori ini untuk mengembangkannya secara lokal:
1. Pasang dependensi: `bun install`
2. Lakukan build: `bun run build`
3. Jalankan TypeScript: `bun run index.ts`

```bash
# Contoh penggunaan saat development
bun run index.ts ./folder-test --dry-run
bun run index.ts ./folder-test -y
bun run index.ts ./folder-test --undo
```
