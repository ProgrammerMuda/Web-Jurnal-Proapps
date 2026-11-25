# Spesifikasi Laporan Laba Rugi

Dokumen ini untuk membangun halaman **Laba Rugi** (Income Statement / Profit & Loss) di prototype Dashboard Jurnal. Laporan **Neraca** sudah jadi dan menjadi acuan utama: struktur kode, gaya tampilan, filter, statistik, tabel, modal rincian akun, dan ekspor. Sebisa mungkin **pakai ulang** apa yang ada di Neraca, jangan membuat pola baru.

Bahasa antarmuka: **Indonesia**, huruf kapital hanya di awal kalimat (sentence case), contoh "Laba kotor", bukan "Laba Kotor".

---

## 1. Tujuan

Menjawab pertanyaan: **"Dalam periode ini, bisnis untung atau rugi berapa, dan dari mana asalnya?"**

- Menampilkan pendapatan, harga pokok penjualan, beban, dan laba/rugi untuk **rentang tanggal** (bukan satu tanggal seperti Neraca).
- Bisa dibandingkan dengan periode lain.
- Setiap angka bisa ditelusuri ke jurnal pembentuknya.
- **Laba bersih 1 Jan s.d. tanggal X harus sama persis dengan "Laba tahun berjalan" di Neraca per tanggal X.** Ini syarat utama kebenaran.

---

## 2. Konteks proyek

| Hal | Isi |
|---|---|
| Stack | React 19 + Mantine v9 (`@mantine/core`, `@mantine/hooks`), ikon Phosphor lewat `@/components/Icon.jsx` (wajib lewat wrapper ini, weight duotone) |
| Data | Prototype tanpa backend. State di localStorage lewat `useData()` dari `src/lib/store.jsx` |
| Hari ini | `TODAY` dari `src/pages/Penjualan/data.js` (saat ini `'2026-11-04'`). Jangan pakai `new Date()` untuk "hari ini" |
| Rute | Hash. Neraca di `#laporan/neraca`. Laba Rugi di **`#laporan/laba-rugi`** |
| Format | `formatDate`, `rupiah`, `rupiahShort` dari `src/pages/Penjualan/utils.js` |
| Perusahaan | `COMPANY.name` dari `src/lib/company.js` |
| Lint | `npx eslint <file>` harus lolos |

### File acuan (baca dulu)

| File | Isi yang relevan |
|---|---|
| `src/pages/LaporanKeuangan/Neraca.jsx` | **Template halaman.** PageIntro, kartu periode (`PeriodField`), kartu statistik (`Stat`, `Ratio`), toolbar tabel, tabel laporan (`flatten`, `StatementRow`, `NumCells`, `LeadCell`), `AccountModal`, menu Ekspor |
| `src/pages/LaporanKeuangan/ledger.js` | `buildLedger(data)` (semua jurnal), `profitBreakdown(ledger, from, to)`, `accountMutations(...)`, `PL_CATS`, `accountsByCode` |
| `src/pages/LaporanKeuangan/statementExport.js` | Ekspor PDF / Excel / CSV bertema biru |
| `src/lib/xlsx.js`, `src/lib/pdf.js` | Penulis .xlsx dan .pdf tanpa library (PDF mendukung banyak halaman) |
| `src/pages/LaporanKeuangan/LaporanKeuangan.jsx` | Peta `READY = { neraca: Neraca }` yang menentukan laporan mana yang bisa dibuka |
| `src/pages/LaporanKeuangan/data.js` | Katalog laporan; kartu `laba-rugi` sudah ada |
| `src/pages/DaftarAkun/accounts.js` | Daftar akun (`code`, `name`, `category`). Abaikan field `balance` (salinan prod, tidak seimbang) |
| `src/index.css` | Kelas `.bs-*` untuk tabel & statistik Neraca. Pakai ulang, jangan duplikasi |

---

## 3. Sumber data

### 3.1 Jurnal

`buildLedger(data)` menghasilkan semua entri jurnal dari tiga modul, urut tanggal:

```js
{
  id, module: 'Penjualan' | 'Pembelian' | 'Gudang',
  date: 'YYYY-MM-DD', title, ref, href,      // href = hash ke dokumen sumber
  lines: [{ code, name, debit, credit, memo }]
}
```

Jangan menghitung jurnal sendiri dari data mentah. Selalu lewat `buildLedger`.

### 3.2 Akun laba rugi

Kategori akun yang masuk Laba Rugi (`PL_CATS` di ledger.js):

| Kategori di Daftar Akun | Pos di Laba Rugi | Saldo normal |
|---|---|---|
| `Pendapatan` | Pendapatan usaha | Kredit |
| `Harga Pokok Penjualan` | Harga pokok penjualan | Debit |
| `Beban` | Beban operasional | Debit |
| `Pendapatan Lainnya` | Pendapatan lain-lain | Kredit |
| `Beban Lainnya` | Beban lain-lain | Debit |

Kategori lain (Kas & Bank, Piutang, Hutang, Ekuitas, dst.) **tidak** masuk Laba Rugi. Itu urusan Neraca.

### 3.3 Hitungan

`profitBreakdown(ledger, from, to)` sudah ada dan mengembalikan per akun:

```js
[{ code, name, category, amount }]   // amount = total (kredit − debit) di rentang [from, to]
```

Jadi untuk Pendapatan nilainya positif dan untuk Beban/HPP negatif. Untuk tampilan:

- **Tampilkan setiap akun dengan saldo normalnya positif.** Pendapatan = `amount`, Beban/HPP = `-amount`. Pembaca laporan berharap "Beban gaji 5.000.000", bukan "(5.000.000)".
- Angka dalam kurung hanya muncul kalau saldonya **berlawanan** dari normal (mis. retur pendapatan melebihi pendapatan).
- Subtotal dan laba dihitung dari `amount` mentah (kredit − debit) supaya tandanya benar:

```
Pendapatan usaha          = Σ amount (Pendapatan)
Harga pokok penjualan     = −Σ amount (HPP)
Laba kotor                = Pendapatan usaha − HPP
Beban operasional         = −Σ amount (Beban)
Laba operasional          = Laba kotor − Beban operasional
Pendapatan lain-lain      = Σ amount (Pendapatan Lainnya)
Beban lain-lain           = −Σ amount (Beban Lainnya)
Laba bersih               = Laba operasional + Pendapatan lain-lain − Beban lain-lain
                          = Σ amount semua akun PL_CATS
```

Kalau laba negatif, labelnya tetap "Laba bersih" dengan angka dalam kurung dan merah. Jangan ganti label jadi "Rugi bersih" secara dinamis karena kolom pembanding bisa beda tanda.

Taruh logika ini sebagai fungsi baru di `ledger.js`, misalnya `incomeStatement(ledger, from, to)`, yang mengembalikan struktur seksi seperti `balanceSheet`:

```js
{
  from, to,
  sections: [
    { key: 'pendapatan', label: 'Pendapatan usaha', cats: ['Pendapatan'], normal: 'credit', accounts: [...], total },
    { key: 'hpp', label: 'Harga pokok penjualan', cats: ['Harga Pokok Penjualan'], normal: 'debit', accounts: [...], total },
    { key: 'beban', label: 'Beban operasional', cats: ['Beban'], normal: 'debit', accounts: [...], total },
    { key: 'lainMasuk', label: 'Pendapatan lain-lain', cats: ['Pendapatan Lainnya'], normal: 'credit', accounts: [...], total },
    { key: 'lainKeluar', label: 'Beban lain-lain', cats: ['Beban Lainnya'], normal: 'debit', accounts: [...], total },
  ],
  totals: { pendapatan, hpp, labaKotor, beban, labaOperasional, lainMasuk, lainKeluar, labaBersih },
  count,      // jumlah jurnal di rentang
  modules,    // { Penjualan: n, Pembelian: n, Gudang: n }
}
```

### 3.4 Rincian akun (modal)

`accountMutations(ledger, code, asOf, sign)` saat ini menjumlah **sejak awal** sampai `asOf`. Untuk Laba Rugi butuh rentang. Tambahkan parameter `from` (opsional, supaya Neraca tidak berubah perilaku), misalnya:

```js
accountMutations(ledger, code, asOf, sign = 1, from = null)
```

Mutasi sebelum `from` dilewati, saldo berjalan mulai dari 0.

---

## 4. Halaman

Urutan dari atas, sama seperti Neraca:

1. `BackLink` "Kembali ke Pusat Laporan"
2. `PageIntro`: ikon (mis. `ChartLineUp` / `TrendUp`, tambahkan ke `Icon.jsx` bila belum ada), judul "Laba Rugi", deskripsi "Pendapatan dikurangi beban dari jurnal Penjualan, Pembelian, dan Gudang. Klik akun untuk melihat jurnal pembentuknya.", aksi: tombol Cetak + menu **Ekspor**
3. Kartu periode
4. Kartu statistik
5. Kartu laporan (toolbar + tabel)
6. Modal rincian akun

### 4.1 Kartu periode

Dua isian berdampingan (`SimpleGrid cols={{ base: 1, sm: 2 }}`), bentuk sama dengan `PeriodField` Neraca, tapi isinya **rentang**:

**Periode**

| Pilihan | Rentang (relatif ke `TODAY`) |
|---|---|
| Bulan ini (bawaan) | 1 bulan ini s.d. TODAY |
| Bulan lalu | 1 s.d. akhir bulan lalu |
| Kuartal ini | awal kuartal s.d. TODAY |
| Tahun ini | 1 Jan s.d. TODAY |
| Tahun lalu | 1 Jan s.d. 31 Des tahun lalu |
| Tanggal lain | dua `DateField` (dari, sampai) |

**Dibandingkan dengan** (dihitung dari periode terpilih, bukan dari hari ini)

| Pilihan | Rentang |
|---|---|
| Periode sebelumnya (bawaan) | rentang sepanjang periode, tepat sebelumnya. Bulan ini → bulan lalu; tahun ini (1 Jan s.d. 4 Nov) → tahun lalu 1 Jan s.d. 4 Nov |
| Periode sama tahun lalu | geser 1 tahun |
| Tanpa pembanding | kolom pembanding, perubahan, % disembunyikan |
| Tanggal lain | dua `DateField` |

Validasi: "dari" tidak boleh setelah "sampai". Kalau terjadi, tukar otomatis atau tampilkan pesan error kecil di bawah field (merah, 12px).

### 4.2 Kartu statistik

Pakai komponen `Stat` dan `Ratio` yang sama dengan Neraca (struktur sel identik: label → angka besar → kalimat perubahan → rincian label/angka rata kanan). Grid 4 kolom di desktop (≥62em), 2 kolom di tablet, 1 kolom di ponsel.

| Sel | Angka | Kalimat perubahan | Rincian |
|---|---|---|---|
| Pendapatan | Pendapatan usaha + Pendapatan lain-lain | "Naik Rp X jt sejak <periode pembanding>" | Pendapatan usaha · Pendapatan lain-lain |
| Laba kotor | Laba kotor | perubahan | Pendapatan usaha · Harga pokok penjualan |
| Beban | Beban operasional + Beban lain-lain | perubahan | Beban operasional · Beban lain-lain |
| Laba bersih | Laba bersih (merah kalau negatif) | perubahan | Laba operasional · "N jurnal" |

Baris rasio (3 kolom, sama seperti Neraca):

| Rasio | Rumus | Catatan (berubah sesuai nilai) |
|---|---|---|
| Margin kotor | Laba kotor / Pendapatan usaha | "Sisa pendapatan setelah harga pokok" |
| Margin bersih | Laba bersih / Total pendapatan | "Untung dari setiap rupiah pendapatan" atau "Bisnis merugi di periode ini" |
| Rasio beban | Beban operasional / Pendapatan usaha | "Bagian pendapatan yang habis untuk beban operasional" |

Pendapatan nol → tampilkan "–" dan catatan "Belum ada pendapatan di periode ini". Jangan pernah tampilkan `NaN`, `Infinity`, atau persen ribuan yang menyesatkan.

Kalimat perubahan memakai kata **Naik / Turun / Tetap** + `rupiahShort`, warna netral (`slate.6`). Untuk beban, naik **tidak** diberi warna merah (warna hanya untuk status, bukan untuk "baik/buruk").

### 4.3 Toolbar tabel

Di atas tabel, dalam kartu yang sama, sama persis seperti Neraca:

- Kiri: `TextInput` "Cari nama atau kode akun…"
- Kanan: `Switch` "Sembunyikan saldo nol" (bawaan aktif) + `SegmentedControl` **Rinci / Ringkas**
- Kelas `no-print`

### 4.4 Tabel laporan

Kepala laporan di dalam kartu, rata tengah:

```
Demo Site
Laba Rugi
1 Nov 2026 s.d. 4 Nov 2026 dibandingkan 1 Okt 2026 s.d. 4 Okt 2026
```

(Tanpa "dalam Rupiah". Pakai "s.d.", bukan tanda pisah panjang.)

Kolom: **Kode · Akun · <periode> · <pembanding> · Perubahan · %**. Tanpa pembanding hanya tiga kolom pertama. Header kolom angka memakai label pendek periode (mis. "Nov 2026", "Okt 2026", atau "1–4 Nov 2026" bila bukan sebulan penuh).

Urutan baris:

```
Pendapatan usaha                          (judul seksi)
   4-10001  Pendapatan Service Charge      12.000.000,00
   ...
Total pendapatan usaha                     12.000.000,00
Harga pokok penjualan                     (judul seksi)
   5-10001  HPP Barang                      4.000.000,00
Total harga pokok penjualan                 4.000.000,00
LABA KOTOR                                  8.000.000,00   ← baris hasil
Beban operasional                         (judul seksi)
   6-xxxxx  ...
Total beban operasional                     ...
LABA OPERASIONAL                            ...            ← baris hasil
Pendapatan lain-lain                      (judul seksi)
Total pendapatan lain-lain
Beban lain-lain                           (judul seksi)
Total beban lain-lain
LABA BERSIH                                 ...            ← baris akhir, garis ganda di bawah
```

Label hasil tetap sentence case ("Laba kotor"); huruf besar di atas hanya penanda di dokumen ini.

Gaya baris memakai kelas yang sudah ada:

| Jenis baris | Kelas / gaya |
|---|---|
| Judul seksi | `.bs-section` |
| Akun | `.bs-line` (klik → modal), nama akun + kategori kecil di bawah |
| Total seksi | `.bs-total` |
| Baris hasil (laba kotor, laba operasional) | `.bs-total`, teks tebal |
| Laba bersih | `.bs-total .bs-grand` (garis ganda bawah) |

Aturan tampilan:

- Seksi tanpa akun bersaldo **tetap ditampilkan** dengan totalnya "-" saat "Sembunyikan saldo nol" aktif, supaya susunan laporan selalu sama. Hanya baris akunnya yang hilang.
- Mode **Ringkas**: satu baris per seksi (tanpa akun), hasil tetap tampil.
- Pencarian menyaring baris akun saja; judul, total, dan hasil tetap tampil.
- Format angka sama dengan Neraca (`num()`): 2 desimal, nol = "-", negatif dalam kurung + merah.
- % perubahan: `(a − b) / |b|`, kosong bila `b` = 0.
- Di ponsel (<48em): kolom kode disembunyikan, kolom akun menempel di kiri saat tabel digeser (sudah diatur oleh CSS `.bs-table` / `.bs-cmp`). Halaman sendiri tidak boleh ikut tergeser.

Catatan kaki di bawah tabel: "Dihitung dari N jurnal antara <dari> dan <sampai>: Penjualan n · Pembelian n · Gudang n. Angka dalam kurung berarti berlawanan dari saldo normal, tanda – berarti nol."

### 4.5 Modal rincian akun

Sama seperti `AccountModal` di Neraca (FormModal lebar 920px; header & footer diam, hanya isi yang bergulir):

- Judul: kode + nama akun, kategori sebagai subjudul
- Tabel: Tanggal · Sumber (badge modul + tautan nomor dokumen ke `href`) · Keterangan · Debit · Kredit · Saldo
- Hanya mutasi di dalam periode terpilih; saldo berjalan mulai 0
- Baris total di bawah

### 4.6 Ekspor

Menu **Ekspor** (pola persis Neraca): label "Pilih format ekspor", lalu

- Dokumen PDF (.pdf)
- Spreadsheet Excel (.xlsx)
- Data CSV (.csv)

Nama file: `laba-rugi-<dari>_<sampai>.<ext>`.

Isi file mengikuti tampilan (mode Rinci/Ringkas dan saldo nol ikut; pencarian tidak ikut).

Tema biru sama dengan Neraca: `#053079` (pita judul, baris laba bersih), `#1B4399` (kepala tabel), `#D9E5FB` (baris periode, judul seksi), `#EEF4FF` (baris total/hasil). Angka di Excel tetap angka (bisa dijumlah) dengan format `#,##0.00;[Red](#,##0.00);"-"`.

Implementasi: `neracaExport.js` sudah dijadikan generik menjadi `statementExport.js` (parameter `title` dan jenis baris tambahan `result`); Neraca dan Laba Rugi sama-sama memakainya.

### 4.7 Menyambungkan halaman

Di `LaporanKeuangan.jsx`:

```js
import LabaRugi from './LabaRugi.jsx';
const READY = { neraca: Neraca, 'laba-rugi': LabaRugi };
```

Komponen menerima prop `onBack`, sama seperti Neraca.

---

## 5. Aturan desain (ringkas)

- Ikuti tampilan Neraca. Kalau ragu, samakan dengan Neraca.
- Satu kartu = satu kelompok isi. Kontrol berada di dekat hal yang diaturnya (filter periode di kartu periode, cari/saldo nol/ringkas di atas tabel).
- Teks sentence case, tanpa label kecil huruf besar di atas judul (eyebrow), tanpa tanda pisah panjang di teks UI.
- Hierarki dengan ukuran dan warna abu (slate.9 / slate.7 / slate.6), bukan dengan banyak teks tebal.
- Warna hanya untuk arti: merah untuk angka negatif/berlawanan, hijau hanya untuk status baik yang jelas. Bukan untuk menghias.
- Hover hanya ubah warna, hanya untuk pointer halus, dengan jalur `prefers-reduced-motion`.
- Ponsel: target sentuh ≥ 44px, isian bertumpuk, tidak ada geser horizontal halaman.
- Elemen yang tidak perlu dicetak diberi kelas `no-print`.

---

## 6. Kriteria selesai

- [ ] `#laporan/laba-rugi` membuka halaman; tombol "Buka Laporan" di Pusat Laporan berfungsi; "Kembali ke Pusat Laporan" kembali ke `#laporan`.
- [ ] **Laba bersih periode "Tahun ini" = "Laba tahun berjalan" di Neraca per `TODAY`** (sampai sen).
- [ ] Laba bersih = Σ (kredit − debit) semua akun kategori `PL_CATS` di rentang tersebut.
- [ ] Setiap total seksi = jumlah baris akunnya; laba kotor, laba operasional, laba bersih sesuai rumus §3.3.
- [ ] Ganti periode dan pembanding mengubah tabel, statistik, dan kepala laporan dengan benar; "Tanpa pembanding" menyembunyikan tiga kolom.
- [ ] Rinci/Ringkas, saldo nol, dan pencarian berfungsi tanpa merusak susunan seksi.
- [ ] Klik akun membuka modal berisi mutasi periode itu saja, tautan sumber membuka dokumen.
- [ ] Tidak ada `NaN`, `Infinity`, atau persen tak masuk akal di statistik saat pendapatan nol.
- [ ] Ekspor PDF, Excel, CSV terunduh, tema biru, isi sama dengan layar; PDF lebih dari satu halaman tetap rapi.
- [ ] Cetak (Ctrl/Cmd+P) tidak memuat filter dan toolbar.
- [ ] Rapi di 1440px, 1024px, dan 375px; tidak ada error di console; `npx eslint` lolos.
- [ ] Neraca tetap berfungsi seperti sebelumnya (perubahan di `ledger.js` / ekspor tidak merusaknya).

---

## 7. Catatan data contoh

- Data contoh belum punya saldo awal Kas & Bank, jadi di Neraca BCA terlihat minus. Itu **bukan** urusan Laba Rugi.
- Laba tahun berjalan di data contoh saat ini negatif (sekitar −Rp 148 jt per 4 Nov 2026). Laba Rugi yang benar akan menunjukkan dari akun mana kerugian itu berasal. Pastikan angkanya cocok dengan Neraca, jangan "dirapikan".
- Jangan mengubah atau menghapus data di localStorage untuk keperluan uji. Kalau butuh data tambahan, buat lewat alur aplikasi (Penjualan / Pembelian).
