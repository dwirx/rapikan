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

## 📦 Instalasi & Cara Penggunaan

### 🚀 One-line Install (Recommended for Linux/macOS)
Unduh dan pasang executable `rapikan` secara otomatis ke path sistem Anda:
```bash
curl -fsSL https://raw.githubusercontent.com/dwirx/rapikan/main/install-curl.sh | bash
```

### 📦 Package Managers

#### **NPM / Yarn / PNPM**
Pasang secara global ke sistem Anda (memerlukan Node.js):
```bash
npm install -g rapikan
# Or using Yarn
yarn global add rapikan
# Or using PNPM
pnpm add -g rapikan
```

#### **Bun (Recommended)**
```bash
bun install -g rapikan
```

---

### 🪟 Windows Support
Tool ini sepenuhnya kompatibel dengan **PowerShell, CMD, Git Bash, dan WSL** (termasuk penanganan path Windows dan normalisasi otomatis).

#### **Windows (PowerShell/CMD)**
```powershell
npm install -g rapikan
# Or with Bun
bun install -g rapikan
```

#### **Scoop (Windows)**
*(Opsional)* Anda dapat memasangnya via Scoop jika bucket terdaftar:
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
# Or using paru
paru -S rapikan-bin
```

---

### 📥 Manual Download
Unduh file binary mandiri (standalone binary) langsung dari rilis terbaru di GitHub:
- **Linux x64**: [rapikan-linux-x64](https://github.com/dwirx/rapikan/releases/latest/download/rapikan-linux-x64)
- **Linux ARM64**: [rapikan-linux-arm64](https://github.com/dwirx/rapikan/releases/latest/download/rapikan-linux-arm64)
- **Windows x64**: [rapikan-windows-x64.exe](https://github.com/dwirx/rapikan/releases/latest/download/rapikan-windows-x64.exe)
- **macOS Intel**: [rapikan-darwin-x64](https://github.com/dwirx/rapikan/releases/latest/download/rapikan-darwin-x64)
- **macOS Apple Silicon**: [rapikan-darwin-arm64](https://github.com/dwirx/rapikan/releases/latest/download/rapikan-darwin-arm64)

**Setelah diunduh (untuk macOS/Linux):**
```bash
# Ubah hak akses agar dapat dieksekusi
chmod +x rapikan-linux-x64

# Pindahkan ke bin path global
sudo mv rapikan-linux-x64 /usr/local/bin/rapikan
```

---

### 🐚 Kompatibilitas Shell & Cara Kerja
- Bekerja baik pada bash, zsh, fish, dan POSIX shell lainnya.
- **Deteksi runtime otomatis**: Jika dipanggil via CLI paket manager, ia akan mendeteksi runtime terbaik di komputer Anda (`Bun` ➔ `Node.js` ➔ `fallback`).
- **Eksekusi langsung (NPX)**: Anda juga bisa menjalankannya tanpa instalasi menggunakan `npx rapikan .\path\ke\folder`.

---

### 💻 Parameter Command Line

Setelah terpasang, gunakan perintah berikut untuk merapikan file:

#### 1. Jalankan di folder saat ini (Menu Interaktif)
```bash
rapikan
```

#### 2. Jalankan pada folder tertentu
```bash
rapikan .\path\ke\folder\
```

#### 3. Jalankan instan tanpa konfirmasi (Auto-Confirm)
```bash
rapikan .\path\ke\folder\ -y
```

---

### 🛠️ Pengembangan (Development / Clone)
Jika Anda men-clone repositori ini untuk mengembangkannya secara lokal:
1. Pasang dependensi: `bun install`
2. Lakukan build: `bun run build`
3. Jalankan typescript: `bun run index.ts`

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
