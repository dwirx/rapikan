# Rapikan - File Organizer Tool

Tool sederhana berbasis TypeScript dan Bun untuk merapikan file di dalam folder target dengan cara mengelompokkannya secara otomatis ke dalam subfolder berdasarkan tanggal (`YYYY-MM-DD`).

Tool ini sangat berguna untuk merapikan file media seperti hasil rekaman drone (misalnya DJI), kamera, atau handphone.

---

## 🚀 Fitur Utama

- **Deteksi Tanggal Pintar**:
  - **Nama File (Prioritas Utama)**: Mencoba mendeteksi pola tanggal dari nama file seperti `YYYYMMDD`, `YYYY-MM-DD`, atau `YYYY_MM_DD` (misal: `DJI_20260622_...` dikelompokkan ke folder `2026-06-22`).
  - **Metadata File (Fallback)**: Jika nama file tidak memiliki pola tanggal, tool akan menggunakan waktu pembuatan (`birthtime`) atau waktu modifikasi (`mtime`) file tersebut.
- **Pencegahan Overwrite (Deduplikasi)**:
  - Jika di folder tujuan sudah ada file dengan nama yang sama, tool akan secara otomatis merubah namanya menjadi `nama_file_(1).ext`, `nama_file_(2).ext`, dst., agar file tidak terhapus atau tertimpa.
- **Kompatibel Lintas OS (Multi-Platform)**:
  - Berjalan lancar di **Windows** maupun **Linux/macOS** dengan penanganan path separator (`\` dan `/`) yang aman.
- **Keamanan File Proyek**:
  - Secara otomatis mengabaikan file konfigurasi proyek seperti `index.ts`, `package.json`, `tsconfig.json`, `bun.lock`, `.git`, `.agents`, dll. sehingga file proyek tidak berantakan.
- **Mode Konfirmasi & Preview**:
  - Menampilkan daftar file dan tujuan pemindahannya sebelum benar-benar memindahkan file, sehingga Anda dapat memverifikasi terlebih dahulu.

---

## 💻 Cara Penggunaan

Pastikan Anda telah menginstal [Bun](https://bun.sh/).

### 1. Install Dependensi
```bash
bun install
```

### 2. Jalankan Tool

#### **A. Mode Interaktif**
Jalankan perintah di bawah ini, lalu pilih folder melalui menu di terminal:
```bash
bun run rapikan
```

#### **B. Mode Parameter Path**
Tentukan folder target langsung saat menjalankan perintah (mendukung path Windows & Linux):
```bash
bun run rapikan .\path\ke\folder\
```

#### **C. Mode Instan (Auto-Confirm)**
Tambahkan flag `-y` atau `--yes` untuk langsung memindahkan file tanpa konfirmasi (`y/n`) terlebih dahulu:
```bash
bun run rapikan .\path\ke\folder\ -y
```

---

## 📝 Contoh Ilustrasi Struktur Folder

**Sebelum dirapikan:**
```text
📂 folder-media/
 ┣ 📄 DJI_20260620_123015.mp4
 ┣ 📄 DJI_20260620_154522.mp4
 ┣ 📄 DJI_20260621_091500.mp4
 ┗ 📄 liburan.jpg  (dibuat pada 25 Juni 2026)
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
```

---

## 🛠️ Pengembangan (Development)

Untuk menjalankan file typescript secara langsung selama proses development:
```bash
bun run index.ts
```
