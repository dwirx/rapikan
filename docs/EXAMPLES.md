# 🎯 Contoh & Resep Penggunaan Rapikan

Kumpulan contoh siap pakai untuk berbagai skenario umum.

---

## Skenario 1: Rapikan Hasil Drone DJI

File video DJI biasanya bernama `DJI_20260620_123015.mp4` — pola tanggal langsung di nama file.

```bash
# Lihat dulu simulasinya
rapikan ./DCIM --dry-run

# Rapikan semua ke struktur YYYY/MM/DD
rapikan ./DCIM -f YYYY/MM/DD -y
```

**Hasil:**
```
DCIM/
├── 2026/
│   ├── 06/
│   │   ├── 20/
│   │   │   ├── DJI_20260620_123015.mp4
│   │   │   └── DJI_20260620_154522.mp4
│   │   └── 21/
│   │       └── DJI_20260621_091500.mp4
```

---

## Skenario 2: Rapikan Foto dari Kamera (EXIF)

Foto dari kamera DSLR/mirrorless biasanya tidak memiliki tanggal di nama file,
tapi memiliki data EXIF `DateTimeOriginal`.

```bash
# Simulasi dulu — cek apakah tanggal EXIF terdeteksi
rapikan ./foto-kamera --ext jpg,jpeg,heic,tiff --dry-run

# Eksekusi dengan format per bulan
rapikan ./foto-kamera --ext jpg,jpeg,heic -f YYYY/MM -y
```

Output preview akan menampilkan:
```
  ▸ 2026/06/   (12 file)
    • IMG_4521.jpg     [EXIF Foto]
    • IMG_4522.jpg     [EXIF Foto]
    • DSC_0042.jpg     [EXIF Foto]
```

---

## Skenario 3: SD Card Import — Rekursif + Multi Tipe File

SD Card dari drone biasanya punya struktur folder `DCIM/100MEDIA/`, `DCIM/101MEDIA/`, dll.

```bash
# Scan semua subfolder, hanya foto dan video
rapikan D:/DCIM -r --ext mp4,mov,jpg,jpeg,heic --dry-run

# Eksekusi setelah yakin
rapikan D:/DCIM -r --ext mp4,mov,jpg,jpeg,heic -f YYYY-MM-DD -y
```

---

## Skenario 4: Bersihkan Duplikat

Anda punya folder yang kemungkinan berisi file yang sama (dikopi dua kali).

```bash
# Simulasi + dedup — lihat berapa duplikat
rapikan ./media --dedup --dry-run

# Eksekusi — duplikat otomatis dilewati
rapikan ./media --dedup -y
```

---

## Skenario 5: Preview Sebelum Eksekusi (Workflow Aman)

Workflow yang direkomendasikan untuk folder penting:

```bash
# Langkah 1: Preview dulu
rapikan ./penting -r --dry-run

# Langkah 2: Jika ok, eksekusi
rapikan ./penting -r -y

# Langkah 3: Jika ada yang salah, undo!
rapikan ./penting --undo
```

---

## Skenario 6: Otomasi via Script (Bash/PowerShell)

**Bash (Linux/macOS):**
```bash
#!/bin/bash
SD_PATH="/Volumes/UNTITLED/DCIM"
DEST_PATH="$HOME/Videos/Drone"

# Import dari SD card dan rapikan langsung
rsync -av "$SD_PATH/" "$DEST_PATH/"
rapikan "$DEST_PATH" -r --ext mp4,mov,jpg -f YYYY/MM/DD -y

echo "✓ Import dan rapikan selesai!"
```

**PowerShell (Windows):**
```powershell
$sdPath = "E:\DCIM"
$destPath = "C:\Users\user\Videos\Drone"

# Copy dari SD card
Copy-Item -Recurse "$sdPath\*" $destPath

# Rapikan
rapikan $destPath -r --ext mp4,mov,jpg -f YYYY/MM/DD -y

Write-Host "✓ Import dan rapikan selesai!"
```

---

## Skenario 7: Format Folder yang Berbeda

```bash
# Flat (default) — paling mudah diurutkan
rapikan ./media
# Hasil: 2026-06-22/, 2026-06-23/, ...

# Hierarkis — cocok untuk arsip jangka panjang
rapikan ./media -f YYYY/MM/DD
# Hasil: 2026/06/22/, 2026/06/23/, ...

# Per bulan — ringkas, cocok untuk foto bulanan
rapikan ./media -f YYYY/MM
# Hasil: 2026/06/, 2026/07/, ...

# Per tahun — sangat ringkas
rapikan ./media -f YYYY
# Hasil: 2026/, 2025/, ...
```

---

## Tips & Trik

### Selalu dry-run dulu untuk folder penting
```bash
rapikan ./important --dry-run
```

### Kombinasikan dedup + recursive untuk folder besar
```bash
rapikan ./archive -r --dedup --dry-run
```

### Gunakan --ext untuk hanya memproses tipe file tertentu
```bash
# Hanya video drone
rapikan ./DCIM --ext mp4,mov,lrf,srt
```

### Jika ada yang salah, gunakan undo segera
```bash
rapikan ./folder --undo
```

---

## Skenario 8: Hapus Folder Kosong Setelah Undo (--clean) *(v1.0.6)*

Setelah undo, beberapa folder tanggal mungkin tersisa dalam keadaan kosong.
`--clean` membersihkan semua folder kosong sekaligus.

```bash
# Undo dulu
rapikan ./media --undo

# Preview folder kosong
rapikan ./media --clean --dry-run

# Hapus folder kosong
rapikan ./media --clean -y
```

---

## Skenario 9: Bebaskan Ruang — Hapus Duplikat (--delete-dupes) *(v1.0.6)*

Setelah mengimpor dari SD card berulang kali, folder sering berisi duplikat.
`--delete-dupes` memastikan hanya satu copy yang disimpan — yang paling lama.

```bash
# Simulasi dulu — lihat berapa duplikat dan ruang yang bisa dihemat
rapikan ./DCIM --delete-dupes --dry-run

# Rekursif + simulasi
rapikan ./DCIM -r --delete-dupes --dry-run

# Eksekusi
rapikan ./DCIM -r --delete-dupes -y
```

---

## Skenario 10: Bersihkan File Sampah (--delete-where) *(v1.0.6)*

### Hapus file thumbnail/cache kecil (< 100KB)
```bash
rapikan ./DCIM --delete-where "size<100KB" --dry-run
rapikan ./DCIM --delete-where "size<100KB" -y
```

### Hapus file log dan temp
```bash
rapikan ./project --delete-where "ext=.tmp,.log,.bak,.DS_Store" -y
```

### Arsip lama — hapus file lebih tua dari 2 tahun
```bash
# Preview dulu
rapikan ./archive -r --delete-where "age>2y" --dry-run

# Eksekusi
rapikan ./archive -r --delete-where "age>2y" -y
```

---

## Skenario 11: Backup Terstruktur (--copy) *(v1.0.6)*

Mode `--copy` menyalin file ke folder tanggal **tanpa menghapus** file asli.
Ideal untuk membuat backup terstruktur sambil mempertahankan folder asli.

```bash
# Salin foto ke backup dengan struktur YYYY/MM/DD
rapikan ./DCIM D:/Backup/Drone --copy -f YYYY/MM/DD -y

# Salin hanya video
rapikan ./DCIM --copy -r --ext mp4,mov -f YYYY/MM -y
```

---

## Workflow Lengkap v1.0.6

```bash
# 1. Import dari SD card
rapikan D:/DCIM ./media -r --ext mp4,mov,jpg,heic -f YYYY/MM/DD -y

# 2. Hapus duplikat yang masuk
rapikan ./media --delete-dupes -y

# 3. Bersihkan folder kosong
rapikan ./media --clean -y

# 4. Hapus file preview kecil yang tidak perlu
rapikan ./media --delete-where "size<500KB" --dry-run
rapikan ./media --delete-where "size<500KB" -y
```

---

## Skenario 12: Visualisasi Struktur & Statistik Berkas (--ls) *(v1.0.8)*

Menampilkan gambaran detail dari apa saja berkas yang ada di dalam media penyimpanan Anda, lengkap dengan struktur folder, ukuran, tanggal, serta ringkasan pembagian jenis berkas.

```bash
# Tampilkan struktur folder saat ini secara interaktif
rapikan --ls

# Tampilkan secara mendalam (rekursif) beserta semua subfoldernya
rapikan ./media --ls -r

# Tampilkan hanya berkas video dengan format mp4/mov secara rekursif
rapikan ./media --ls -r --ext mp4,mov
```

