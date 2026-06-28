# 🚀 Referensi Flag CLI — Rapikan

Daftar lengkap semua flag/opsi yang tersedia di `rapikan`.

---

## Sinopsis

```
rapikan [path] [flags...]
```

---

## Flag Lengkap

| Flag | Alias | Nilai | Default | Deskripsi |
|------|-------|-------|---------|-----------|
| *(posisi 1)* | | `./path` | *(interaktif)* | Folder target yang akan dirapikan |
| `--yes` | `-y` | — | `false` | Lewati konfirmasi, langsung eksekusi |
| `--dry-run` | `-d` | — | `false` | Mode simulasi — preview tanpa memindah file |
| `--recursive` | `-r` | — | `false` | Pindai file hingga ke subfolder terdalam |
| `--format` | `-f` | `string` | `YYYY-MM-DD` | Format struktur folder tujuan |
| `--ext` | | `string` | *(semua)* | Filter ekstensi file, pisah koma |
| `--dedup` | | — | `false` | Lewati file dengan isi identik (MD5 hash check) |
| `--undo` | | — | `false` | Kembalikan file ke lokasi asal (butuh riwayat) |
| `--copy` | | — | `false` | **Baru v1.0.6** — Salin file (tidak menghapus asli) |
| `--clean` | | — | `false` | **Baru v1.0.6** — Hapus semua subfolder yang kosong |
| `--delete-dupes` | | — | `false` | **Baru v1.0.6** — Hapus file duplikat, simpan yang tertua |
| `--delete-where` | | `criteria` | — | **Baru v1.0.6** — Hapus file berdasarkan kriteria (ukuran/umur/ekstensi) |

---

## Detail Setiap Flag

### `--format` / `-f`

Mengatur struktur folder tujuan pemindahan file.

**Nilai yang didukung:**

| Nilai | Contoh Folder | Keterangan |
|-------|---------------|------------|
| `YYYY-MM-DD` | `2026-06-22/` | Default — flat, mudah diurutkan |
| `YYYY/MM/DD` | `2026/06/22/` | Hierarkis — cocok untuk arsip panjang |
| `YYYY/MM` | `2026/06/` | Per bulan — ringkas |
| `YYYY` | `2026/` | Per tahun — sangat ringkas |

**Contoh:**
```bash
rapikan ./media --format YYYY/MM/DD
rapikan ./media -f YYYY/MM
rapikan ./media -f YYYY
```

---

### `--ext`

Filter file berdasarkan ekstensi. Hanya file dengan ekstensi yang disebutkan yang akan diproses.

**Format:** Pisahkan dengan koma, dengan atau tanpa titik di depan.

```bash
# Hanya video
rapikan ./media --ext mp4,mov,avi

# Hanya foto
rapikan ./media --ext jpg,jpeg,png,heic

# Kombinasi foto dan video
rapikan ./media --ext mp4,mov,jpg,jpeg,heic

# Dengan titik di depan (juga valid)
rapikan ./media --ext .mp4,.jpg
```

---

### `--recursive` / `-r`

Memindai file tidak hanya di root folder target, tetapi juga ke dalam **semua subfolder** secara rekursif.

```bash
rapikan ./media -r
rapikan ./media --recursive

# Kombinasi dengan filter ekstensi
rapikan ./media -r --ext mp4,jpg
```

> **Catatan:** Folder yang namanya berformat tanggal (seperti `2026-06-22/`, `2026/06/`) akan **dilewati otomatis** agar tidak terjadi pemindahan berulang.

---

### `--dry-run` / `-d`

Menampilkan rencana pemindahan lengkap **tanpa benar-benar memindahkan** file apapun. 
Sangat berguna untuk memverifikasi hasil sebelum eksekusi nyata.

```bash
rapikan ./media --dry-run
rapikan ./media -d

# Kombinasi: simulasi rekursif dengan filter
rapikan ./media -r --ext mp4 --dry-run
```

**Contoh output:**
```
  ▸ 2026-06-20/   (2 file)
    • DJI_20260620_123015.mp4     [Nama File]
    • DJI_20260620_154522.mp4     [Nama File]
  ▸ 2026-06-22/   (1 file)
    • liburan.jpg                 [EXIF Foto]

  ✔ SIMULASI SELESAI — Tidak ada file yang dipindahkan.
```

---

### `--dedup`

Mengaktifkan deduplikasi berbasis **hash MD5**. Sebelum dipindahkan, setiap file akan
dihitung hash-nya. Jika dua atau lebih file memiliki **isi yang 100% identik** (meski nama berbeda),
hanya satu yang akan dipindahkan. File duplikat dilewati.

```bash
rapikan ./media --dedup
rapikan ./media --dedup -r

# Simulasi dedup dulu sebelum eksekusi
rapikan ./media --dedup --dry-run
```

**Contoh output:**
```
  🧬 Duplikat Terdeteksi (1 grup):
  ▸ Hash: a1b2c3d4e5f6...
    • DJI_0001.mp4
    • DJI_0001_copy.mp4       ← akan dilewati

  1 file duplikat dilewati
```

> **Catatan:** Pengecekan hash membutuhkan waktu lebih lama untuk file berukuran besar.

---

### `--undo`

Membatalkan hasil proses merapikan dan **mengembalikan semua file ke lokasi asalnya**.

Setiap kali `rapikan` berhasil memindahkan file, ia menyimpan log di `.rapikan-history.json`
di dalam folder target. Flag `--undo` membaca log tersebut untuk membalik proses.

```bash
# Undo di folder saat ini
rapikan --undo

# Undo di folder tertentu
rapikan ./media --undo
```

> **Batasan:**
> - Undo hanya tersedia untuk **sesi terakhir** saja.
> - Setelah `--undo` berhasil, riwayat akan direset.
> - Jika folder asal tidak ada lagi, rapikan akan membuatnya kembali.

---

### `-y` / `--yes`

Melewati konfirmasi interaktif dan langsung memulai pemindahan.

```bash
rapikan ./media -y
rapikan ./media --yes

# Kombinasi umum untuk automation/script
rapikan ./media -y -r --ext mp4,jpg
```

---

## Kombinasi Flag Populer

```bash
# Preview rekursif semua video
rapikan ./DCIM -r --ext mp4,mov --dry-run

# Rapikan foto saja ke struktur hierarkis, tanpa konfirmasi
rapikan ./foto -r --ext jpg,jpeg,heic -f YYYY/MM/DD -y

# Rapikan dan cek duplikat
rapikan ./media --dedup -y

# Simulasi dedup rekursif
rapikan ./media -r --dedup --dry-run

# Full: rekursif + filter + format + dedup + auto-confirm
rapikan ./DCIM -r --ext mp4,mov,jpg,heic -f YYYY/MM --dedup -y

# v1.0.6 delete operations
rapikan ./media --clean                            # hapus folder kosong
rapikan ./media --delete-dupes                     # hapus duplikat
rapikan ./media --delete-where "size<1MB"          # hapus file kecil
rapikan ./media --delete-where "age>30d"           # hapus file lama
rapikan ./media --delete-where "ext=.tmp,.log"     # hapus ekstensi tertentu
```

---

## Flag Baru v1.0.6

### `--copy`

Menyalin file ke folder tanggal **tanpa menghapus** file asli. Berguna untuk backup terstruktur.

```bash
rapikan ./DCIM --copy -f YYYY/MM/DD -y
rapikan ./DCIM --copy -r --ext mp4,jpg -y
```

> **Catatan:** Mode `--copy` tidak memengaruhi `--undo` (undo hanya membalik move, bukan copy).

---

### `--clean`

Mencari dan menghapus semua **subfolder kosong** di dalam folder target secara rekursif.

```bash
# Preview dulu (aman)
rapikan ./media --clean --dry-run

# Hapus tanpa konfirmasi
rapikan ./media --clean -y

# Hapus dengan konfirmasi (default)
rapikan ./media --clean
```

**Contoh output:**
```
  🗂  Mencari folder kosong...

  🗑  3 folder kosong ditemukan:

    ✗ 2025/06/15/
    ✗ 2025/07/
    ✗ 2026-01-01/

  Hapus 3 folder kosong? (y/n): y

  ✓ 2025/06/15/
  ✓ 2025/07/
  ✓ 2026-01-01/

  ✔ CLEAN SELESAI
  ✓ Folder dihapus : 3
  Log: .rapikan-delete-log.json
```

> Semua operasi hapus tercatat di `.rapikan-delete-log.json` sebagai audit trail.

---

### `--delete-dupes`

Menghapus **file duplikat** berdasarkan hash MD5. Untuk setiap grup duplikat, file dengan **tanggal pembuatan tertua** dipertahankan; sisanya dihapus.

```bash
# Preview duplikat (aman)
rapikan ./media --delete-dupes --dry-run

# Hapus duplikat rekursif
rapikan ./media --delete-dupes -r

# Hapus tanpa konfirmasi
rapikan ./media --delete-dupes -y
```

**Contoh output:**
```
  🧬 Memindai duplikat (MD5 hash)...

  🔍 1 grup duplikat ditemukan:

  ▸ Hash: a1b2c3d4e5f6...
    ✓ SIMPAN  DJI_0001.mp4       (125.40 MB)
    ✗ HAPUS   DJI_0001_copy.mp4  (125.40 MB)

  💾 Total potensi ruang terbebas: 125.40 MB

  Hapus 1 file duplikat? (y/n): y

  ✔ DELETE DUPES SELESAI
  ✓ File dihapus       : 1
  ✓ Ruang terbebas     : 125.40 MB
```

---

### `--delete-where <criteria>`

Menghapus file berdasarkan **kriteria** yang ditentukan. Mendukung 3 jenis kriteria:

| Kriteria | Contoh | Keterangan |
|----------|--------|------------|
| `size<N` | `size<1MB` | File lebih kecil dari N (KB/MB/GB) |
| `size>N` | `size>10MB` | File lebih besar dari N |
| `age>Nd` | `age>30d` | File lebih lama dari N hari |
| `age>Nm` | `age>6m` | File lebih lama dari N bulan |
| `age>Ny` | `age>1y` | File lebih lama dari N tahun |
| `ext=...` | `ext=.tmp,.log` | File dengan ekstensi tertentu |

```bash
# Hapus file kecil (< 1MB) — simulasi dulu
rapikan ./media --delete-where "size<1MB" --dry-run

# Hapus file lebih besar dari 100MB
rapikan ./media --delete-where "size>100MB" -y

# Hapus file lebih tua dari 1 tahun
rapikan ./media --delete-where "age>1y"

# Hapus file temp/log
rapikan ./media --delete-where "ext=.tmp,.log,.DS_Store" -y

# Rekursif + auto-confirm
rapikan ./archive -r --delete-where "age>30d" -y
```

> **Penting:** Selalu gunakan `--dry-run` dulu sebelum eksekusi nyata pada folder penting!
