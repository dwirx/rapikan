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
