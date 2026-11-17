# Alur Pembelian — Dashboard Jurnal

Repo: https://github.com/ProgrammerMuda/Web-Jurnal-Proapps · Commit acuan: `594c64c`

Dokumen ini menjelaskan alur pembelian sebagaimana yang **sudah berjalan di prototipe
front-end**: urutan dokumen, siapa mengerjakan apa, status tiap dokumen, dan aturan yang
dijalankan sistem. Dipakai sebagai acuan saat membangun backend-nya.

Catatan: data masih disimpan di `localStorage` (key `proapps.pembelian.v1`), belum ada
backend, dan **belum ada mesin jurnal** — bagian 9 menjelaskan apa yang harus dibentuk nanti.

---

## 1. Alur ringkas

```
Permintaan (FPBJ) + IOM          Peminta
   ↓ verifikasi                  Accounting
Pengadaan                        Accounting
   ├─ Vendor tunggal             1 penawaran + alasan
   ├─ Bidding                    2–3 penawaran, pilih pemenang
   └─ Pesan ulang                dari PO lama, cek kenaikan harga
   ↓ persetujuan                 Building Manager
PO (barang) / SPK (jasa)         Accounting — terbit otomatis setelah disetujui
   ↓ kirim ke vendor             Accounting
   ├─ [opsional] PR uang muka → persetujuan BM → PV      Accounting · BM · Finance
   ↓
Penerimaan                       Gudang / PIC Jasa
   ├─ FPB (barang)               langsung terkonfirmasi
   └─ BAST (jasa)                perlu persetujuan BM
   ↓
Faktur pembelian                 Accounting — dicocokkan 3 arah
   ↓
Payment Request                  Accounting
   ↓ persetujuan                 Building Manager
Payment Voucher                  Finance — kas keluar
   ↓
Selesai
```

**Tiga aturan pokok yang tidak boleh dilanggar:**

1. Tidak ada PO/SPK tanpa pengadaan yang disetujui
2. Tidak ada faktur tanpa penerimaan (FPB/BAST) yang sudah dikonfirmasi
3. Tidak ada Payment Voucher tanpa Payment Request yang sudah disetujui

---

## 2. Peran

| Peran | Membuat | Menyetujui |
|---|---|---|
| **Peminta** | Permintaan (FPBJ) | — |
| **Accounting** | Penawaran, pengadaan, PO/SPK, faktur, Payment Request, retur | — |
| **Building Manager** | — | Pengadaan, BAST, Payment Request |
| **Gudang / PIC Jasa** | FPB, BAST, retur | — |
| **Finance** | Payment Voucher | — |
| **Superadmin** | semuanya | semuanya |

Semua pengecekan hak akses ada di satu berkas: `src/pages/Pembelian/permissions.js`. Layar
tidak pernah membandingkan string peran secara langsung.

**Pemisahan tugas yang dijaga:**

- Pembuat permintaan ≠ penyetuju pengadaannya
- Pembuat Payment Request ≠ penyetujunya
- Penyetuju Payment Request ≠ pembuat Payment Voucher
- Pemesan (Accounting) ≠ penerima barang (Gudang)

Pengecekan dilakukan di tingkat **orang**, bukan peran — dokumen menyimpan `createdBy` dan
`requester`. Jadi aturan tetap berlaku kalau satu user memegang dua peran. Superadmin sengaja
dikecualikan.

---

## 3. Permintaan (FPBJ)

Titik awal semua pembelian. Dibuat Peminta.

**Isi:** tanggal, departemen, keperluan, tanggal dibutuhkan, catatan, jalur pengadaan,
nomor + tanggal + berkas IOM, dan daftar item.

**Item:** deskripsi, spesifikasi, qty, satuan, estimasi harga, jenis (barang / jasa).

**Wajib untuk bisa diajukan:** tanggal permintaan, tanggal dibutuhkan, departemen, keperluan,
nomor IOM, tanggal IOM, berkas IOM, jalur pengadaan, dan minimal satu item dengan deskripsi
dan qty.

**Estimasi harga tidak wajib dan default Rp 0.** Perlu diperhatikan: estimasi total menentukan
jumlah penawaran minimal dan jenjang persetujuan, sehingga permintaan tanpa estimasi jatuh ke
jalur paling longgar berapa pun nilai sebenarnya.

**Status:** `Draf → Diajukan → Diverifikasi → Dalam pengadaan → Selesai`,
plus `Dikembalikan` dan `Dibatalkan`.

- *Diverifikasi* — Accounting sudah memeriksa, jalur pengadaan belum dipilih
- *Dalam pengadaan* — jalur sudah dipilih, proses berjalan
- *Selesai* — dihitung otomatis: semua PO/SPK turunannya berstatus Selesai
- *Dibatalkan* — hanya selama belum ada PO

---

## 4. Pengadaan

Dijalankan Accounting setelah permintaan diverifikasi. Tiga jalur, dipilih di form permintaan.

### 4.1 Vendor tunggal
Hanya satu vendor yang bisa menyuplai. Cukup satu penawaran, wajib isi alasan dan lampiran.

### 4.2 Bidding
Untuk barang/jasa baru atau vendor baru.

| Aturan | Nilai |
|---|---|
| Minimal penawaran, estimasi ≤ Rp 10 juta | 2 penawaran |
| Minimal penawaran, estimasi > Rp 10 juta | 3 penawaran |

**Isi penawaran vendor:** nomor, masa berlaku, berkas, deskripsi, termin bayar, waktu
pengiriman/pengerjaan, garansi. Per item: harga, pajak, spesifikasi yang ditawarkan, dan
kesesuaian (*Sesuai / Alternatif / Tidak sesuai*).

Pajak diatur per baris: PPN 11%, atau saklar **harga sudah termasuk PPN** yang berlaku untuk
seluruh penawaran. Kalau termasuk PPN, harga dikonversi ke DPP saat PO dibuat agar total PO
sama dengan nilai penawaran.

**Form bidding:** harga final per item (hasil negosiasi di luar sistem), diskon, pemenang per
item. Wajib isi alasan pemilihan bila pemenang bukan yang termurah. Penilaian vendor 1–5
berbobot (harga 45%, spesifikasi 30%, waktu penyerahan 15%, termin 10%) bersifat alat bantu.

**Status:** `Draf → Menunggu approval → Disetujui`, plus `Ditolak`.

### 4.3 Pesan ulang
Dibuat dari PO lama; membentuk permintaan baru yang sudah terisi, IOM baru tetap wajib.
Sistem membandingkan harga penawaran baru dengan harga PO lama per item:

| Kondisi | Tindakan sistem |
|---|---|
| Turun, tetap, atau naik ≤ 5% dan pembelian terakhir ≤ 12 bulan | Lanjut |
| Naik 5–15%, atau pembelian terakhir > 12 bulan | Wajib isi alasan, item ditandai |
| Naik > 15% | Seluruh paket dipaksa ke jalur bidding |
| Ada item baru, total ≤ Rp 10 juta | Cukup 1 pembanding per item |
| Ada item baru, total > Rp 10 juta | Dipaksa ke jalur bidding |

Kalau permintaan memuat item lama dan item baru sekaligus, paketnya bisa **dipecah**: item
baru pindah ke permintaan turunan agar masing-masing diperiksa dengan aturannya sendiri.

### 4.4 Persetujuan pengadaan
Disetujui Building Manager. Setelah disetujui, **PO/SPK langsung terbit sebagai draf** — satu
dokumen per vendor pemenang.

Jenjang nilai sudah dihitung sistem (< Rp 50 juta Manager, Rp 50–500 juta GM, > Rp 500 juta
Direktur) dan ditampilkan di form bidding, tapi **belum menjadi pembatas** — semua persetujuan
jatuh ke Building Manager. Perlu dirapikan saat matriks persetujuan dibuat bisa diatur.

---

## 5. PO dan SPK

Satu dokumen per vendor, harga dan termin terkunci dari hasil pengadaan.

| | PO | SPK |
|---|---|---|
| Untuk | Barang | Jasa (semua itemnya jasa) |
| Penomoran | `PO/2026/11/0001` | `SPK/2026/11/0001` |
| Penerimaan | FPB | BAST |
| Kolom tanggal | Perkiraan tiba, Gudang tujuan | Target selesai |
| Termin bayar | 3 pilihan | 9 pilihan |

Campuran barang + jasa dalam satu dokumen tetap disebut PO.

**Kirim ke vendor.** Ada konfirmasi berisi email tujuan, lampiran PDF, nilai, CC, dan pesan.
Setelah terkirim, dokumen tercatat `sentAt`, `sentBy`, CC, dan catatannya. PDF-nya dibentuk
tanpa pustaka luar (`src/pages/Pembelian/pdf.js`).

**Status:** `Draf → Dikirim ke vendor → Diterima sebagian → Diterima penuh → Selesai`,
plus `Dibatalkan` dan `Ditutup`.

Status dihitung otomatis dari dokumen turunannya, tidak disimpan:

- *Diterima sebagian* — sudah ada penerimaan, qty belum lengkap
- *Diterima penuh* — qty lengkap, masih ada yang belum difaktur atau belum lunas
- *Selesai* — qty lengkap, semua penerimaan sudah difaktur, semua faktur lunas
- *Dibatalkan* / *Ditutup* — hanya selama belum ada penerimaan sama sekali

---

## 6. Termin bayar

### 6.1 Barang

| Termin | Artinya |
|---|---|
| CAD | Bayar setelah barang diterima |
| DP | Uang muka X%, sisanya setelah diterima |
| CBD | Bayar penuh sebelum kirim |

Barang **tidak punya jadwal termin**. Kalau pengiriman bertahap, pembayaran ikut terpecah —
tapi yang memecah adalah **qty yang betul-betul datang**, bukan persentase yang disepakati.

### 6.2 Jasa

Sembilan tipe. Angka dokumen di bawah memakai `N` = jumlah termin, `P` = jumlah periode.

| Tipe | BAST | Faktur | PR | PV |
|---|---|---|---|---|
| Bayar penuh di muka | 1 | 1 | 1 | 1 |
| Bayar penuh di akhir | 1 | 1 | 1 | 1 |
| DP + pelunasan | 1 | 1 | 2 | 2 |
| Termin progres | N | N | N | N |
| DP + termin progres | N | N | N+1 | N+1 |
| Termin progres + retensi | N+1 | N+1 | N+1 | N+1 |
| Berkala (per periode) | P | P | P | P |
| Berkala di muka | P | P | 1 | 1 |
| Berdasarkan pemakaian | sebanyak periode penagihan | sama | sama | sama |

**Tiga pola yang perlu dipahami:**

- **Uang muka menambah satu PR/PV, bukan faktur.** Uang muka dibayar tanpa faktur pembelian;
  vendor melampirkan invoice proforma. Karena itu *DP + pelunasan* punya 1 faktur tapi 2 PR.
- **Retensi menambah satu BAST sekaligus satu faktur.** Baris retensi diperlakukan seperti
  termin biasa: ada BAST pemeliharaan setelah masa pemeliharaan lewat, lalu faktur, PR, PV.
- **Bayar di muka 100% menghasilkan faktur bernilai nol.** BAST dan faktur tetap dibuat karena
  itu yang mencatat jasa sudah diterima dan memunculkan PPN masukan, tapi seluruh nilainya
  terpotong uang muka sehingga faktur langsung Lunas tanpa PR baru.

### 6.3 Cara jadwal termin diwujudkan

Termin progres dan layanan berkala **dipecah menjadi baris SPK**, satu baris per termin atau
periode, plus satu baris retensi bila ada. Dengan begitu BAST, faktur, PR, dan PV per termin
memakai mesin yang sama dengan barang — tidak perlu entitas jadwal terpisah.

Contoh — kontrak Rp 100 juta, DP 20%, 4 termin dengan bobot 20/30/30/20:

| Baris SPK | Bobot | Nilai (DPP) |
|---|---|---|
| Renovasi — Termin 1 dari 4 · 20% | 20% | Rp 16.000.000 |
| Renovasi — Termin 2 dari 4 · 30% | 30% | Rp 24.000.000 |
| Renovasi — Termin 3 dari 4 · 30% | 30% | Rp 24.000.000 |
| Renovasi — Termin 4 dari 4 · 20% | 20% | Rp 16.000.000 |

**Bobot termin boleh tidak rata**, totalnya wajib 100%, dan baris terakhir menyerap pembulatan
agar jumlahnya persis sama dengan nilai jadwal.

**Basis pembagian = nilai kontrak − uang muka − retensi.** Pada contoh di atas, termin dibagi
dari Rp 80 juta, bukan Rp 100 juta. Konsekuensinya: faktur termin **tidak dipotong uang muka
lagi** — kalau dipotong, vendor kurang dibayar.

---

## 7. Penerimaan

Barang lewat **FPB**, jasa lewat **BAST**. Keduanya dibuat Gudang / PIC Jasa.

**Isi:** tanggal, nomor surat jalan atau nomor BAST vendor, catatan kondisi, dan per item qty
diterima + qty ditolak.

**Aturan qty:** jumlah diterima + ditolak tidak boleh melebihi sisa pesanan. Keduanya saling
membatasi secara langsung — kalau sisa 2 dan diterima diisi 2, kolom ditolak otomatis
terkunci sampai angka diterima dikurangi. Qty ditolak tidak dihitung sebagai diterima,
sehingga sisa pesanan tetap terbuka.

Untuk SPK bertermin, baris penerimaan **mulai kosong** — PIC mengisi termin yang selesai saja.
Pesanan biasa tetap terisi penuh karena umumnya diterima sekaligus.

**Status:** FPB langsung `Dikonfirmasi`. BAST terbit `Menunggu approval atasan` dan baru bisa
difaktur setelah disetujui Building Manager.

---

## 8. Faktur, Payment Request, Payment Voucher

### 8.1 Faktur pembelian
Dibuat Accounting dari satu atau beberapa penerimaan vendor yang sama dan sudah dikonfirmasi.

**Isi:** nomor invoice vendor, tanggal faktur, jatuh tempo, potongan PPh, berkas invoice dan
faktur pajak, serta baris qty yang difaktur.

**Pencocokan 3 arah:** qty faktur dibatasi qty yang diterima, harga dikunci sama dengan PO/SPK.

**Potongan otomatis:** PPN, PPh, uang muka (proporsional terhadap nilai faktur), retur, dan
alokasi kredit vendor.

Jatuh tempo mengikuti termin pesanan bila diatur di penawaran, kalau tidak 30 hari.

**Status:** `Belum dibayar → Dibayar sebagian → Lunas`, plus `Dibatalkan`.

Faktur bisa dibatalkan selama belum ada pembayaran dan belum ada retur. Qty-nya kembali
terbuka untuk difaktur ulang, dan status PO ikut mundur.

### 8.2 Payment Request
Dibuat Accounting, disetujui Building Manager. **Tidak membentuk jurnal.**

Dua jenis: **DP** (dari PO/SPK, lampirkan invoice proforma) dan **pelunasan** (dari satu atau
beberapa faktur vendor yang sama, dengan alokasi nominal per faktur).

**Status:** `Menunggu approval → Siap dibayar → Dibayar`, plus `Ditolak`.

### 8.3 Payment Voucher
Dibuat Finance dari Payment Request yang sudah disetujui. Inilah dokumen yang menyatakan kas
benar-benar keluar, dan nomornyalah yang dirujuk jurnal serta arsip audit.

**Isi:** rekening tujuan, rekening sumber, tanggal bayar, nomor referensi transfer, bukti
transfer, catatan.

Saat PV terbit, PR menjadi *Dibayar* dan faktur terkait menjadi *Lunas* atau *Dibayar sebagian*.

Struktur datanya sudah menyiapkan satu PV untuk beberapa PR (`voucher.prIds` berupa array),
tapi layarnya baru menangani satu PR per transfer.

---

## 9. Jurnal

**Belum ada sama sekali.** Aturan lengkapnya — akun yang dipakai, posting per peristiwa, dan
contoh angka — ada di `docs/Spesifikasi-Jurnal-Pembelian.pdf` di repo ini.

Ringkasnya, hanya dokumen berikut yang membentuk jurnal:

| Dokumen | Debit | Kredit |
|---|---|---|
| PV uang muka | Uang Muka Pembelian, PPN Masukan | Kas/Bank, Hutang PPh |
| FPB | Persediaan | Hutang Belum Ditagih |
| BAST | Beban / Aset | Hutang Belum Ditagih |
| Faktur | Hutang Belum Ditagih, PPN Masukan | Hutang Usaha, Hutang PPh, Hutang Retensi, Uang Muka Pembelian |
| PV pelunasan / retensi | Hutang Usaha / Hutang Retensi | Kas/Bank |
| Retur sebelum faktur | Hutang Belum Ditagih | Persediaan |
| Retur sesudah faktur | Hutang Usaha | Persediaan / Beban, PPN Masukan |

Permintaan, penawaran, bidding, pesan ulang, PO/SPK, dan Payment Request **tidak** membentuk
jurnal.

**Syarat teknis:** idempoten, tanpa hapus (koreksi lewat jurnal balik), selalu seimbang,
menolak posting ke periode tertutup, dan tiap baris jurnal bisa ditelusuri ke dokumen asalnya.

---

## 10. Retur

Dibuat dari faktur yang masih punya baris barang. Jasa tidak diretur — koreksinya lewat revisi
BAST atau potongan di faktur. Barang yang ditolak sebelum difaktur cukup dicatat di FPB; sisa
pesanan tetap terbuka dan tidak perlu dokumen retur.

Penyelesaian retur bisa berupa potongan faktur atau kredit vendor. Kredit vendor yang belum
terpakai bisa dialokasikan ke faktur lain dari vendor yang sama.

Catatan: spesifikasi menyebut retur dibuat **dari FPB**, bukan dari faktur. Prototipe belum
mengikuti itu.

---

## 11. Umur hutang

Dihitung dari **faktur**, karena di situlah Hutang Usaha terbentuk.

- Jatuh tempo = tanggal faktur + termin
- Sisa = total faktur − uang muka dipotong − PV diposting − retur
- Kelompok: belum jatuh tempo, 1–30, 31–60, 61–90, > 90 hari

---

## 12. Peta berkas

| Berkas | Isi |
|---|---|
| `src/pages/Pembelian/utils.js` | Semua perhitungan dan aturan. Fungsi murni, tidak menyentuh state |
| `src/pages/Pembelian/permissions.js` | Semua aturan hak akses dan pemisahan tugas |
| `src/pages/Pembelian/data.js` | Data contoh, daftar peran, ambang `RULES` |
| `src/pages/Pembelian/selectors.js` | Daftar "Perlu tindakan" per peran, pipeline, umur hutang |
| `src/lib/store.jsx` | Penyimpanan localStorage dan penggabungan dengan data contoh |
| `src/pages/Pembelian/pdf.js`, `poPdf.js` | Pembuat PDF tanpa pustaka luar |

**Ambang yang masih dikunci di kode** (`RULES` di `data.js`): minimal penawaran, batas kenaikan
harga pesan ulang 5% dan 15%, umur harga acuan 12 bulan, batas nilai item baru Rp 10 juta,
tarif PPN 11%. Spesifikasi menghendaki semuanya bisa diatur lewat menu Pengaturan.

**Kompatibilitas data tersimpan.** State lama digabung dengan data contoh saat dimuat; vendor
digabung per-record agar kolom baru terisi pada data lama; peran lama dipetakan lewat
`normalizeRole`. Pola ini harus dipertahankan saat menambah kolom.
