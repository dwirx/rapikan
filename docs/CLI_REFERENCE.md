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
```
