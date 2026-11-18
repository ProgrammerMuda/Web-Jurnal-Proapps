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
Permintaan (FPPBJ)               Peminta — IOM opsional
   ↓ verifikasi                  Accounting / Finance (lihat VERIFY)
Pengadaan                        Accounting
   ↓ pilih jalur                 Accounting — langkah pertama pengadaan
   ├─ Bidding                    2–3 penawaran, pilih pemenang
   └─ Vendor tunggal             1 penawaran, tanpa pembanding
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
| **Peminta** | Permintaan (FPPBJ) | — |
| **Accounting** | Penawaran, pengadaan, PO/SPK, faktur, Payment Request, retur | Verifikasi permintaan |
| **Finance** | Payment Voucher | Verifikasi permintaan |
| **Building Manager** | — | Pengadaan, BAST, Payment Request |
| **Gudang / PIC Jasa** | FPB, BAST, retur | — |
| **Superadmin** | semuanya | semuanya |

Semua pengecekan hak akses ada di satu berkas: `src/pages/Pembelian/permissions.js`. Layar
tidak pernah membandingkan string peran secara langsung.

**Verifikasi permintaan sengaja dibuat lentur.** Di lapangan langkah ini kadang dipegang
Procurement, kadang AP, kadang dua-duanya, tergantung pembagian kerja tiap gedung. Jadi
daftarnya berdiri sendiri di konstanta `VERIFY` dan dibaca lewat `canVerify(role)` — untuk
menambah atau mencabut peran yang boleh memverifikasi, ubah satu baris itu saja, tidak ada
layar yang perlu disentuh:

```js
const VERIFY = { fppbj: ['accounting', 'finance'] };
```

**Pemisahan tugas yang dijaga:**

- Pembuat permintaan ≠ penyetuju pengadaannya
- Pembuat Payment Request ≠ penyetujunya
- Penyetuju Payment Request ≠ pembuat Payment Voucher
- Pemesan (Accounting) ≠ penerima barang (Gudang)

Pengecekan dilakukan di tingkat **orang**, bukan peran — dokumen menyimpan `createdBy` dan
`requester`. Jadi aturan tetap berlaku kalau satu user memegang dua peran. Superadmin sengaja
dikecualikan.

---

## 3. Permintaan (FPPBJ)

FPPBJ = Formulir Permintaan Pembelian Barang dan Jasa. Titik awal semua pembelian.
Dibuat Peminta.

**Isi:** tanggal, departemen, keperluan, tanggal dibutuhkan, catatan, daftar item, dan
— bila ada — nomor + tanggal + berkas IOM.

**Item:** deskripsi, spesifikasi, qty, satuan, jenis (barang / jasa). Tanpa harga.

**Wajib untuk bisa diajukan:** tanggal permintaan, tanggal dibutuhkan, departemen, keperluan,
dan minimal satu item dengan deskripsi dan qty. Itu saja.

**IOM opsional.** Nomor, tanggal, dan berkas IOM boleh kosong dan permintaan tetap bisa
diajukan. Satu-satunya pemeriksaan yang tersisa: kalau tanggal IOM diisi, ia tidak boleh
lebih baru dari tanggal permintaan.

**Jalur pengadaan tidak dipilih di sini.** Peminta tidak diminta menebak bidding atau bukan.
Jalur baru ditentukan setelah permintaan lolos verifikasi, sebagai langkah pertama pengadaan
(bagian 4).

**Permintaan tidak memuat harga sama sekali.** Peminta menyebut kebutuhan, bukan angka. Nilai
pembelian baru terbaca setelah penawaran vendor masuk di tahap pengadaan, dan dari situlah
jumlah penawaran minimal serta jenjang persetujuan dihitung (`procurementValue` di `utils.js`:
total vendor pemenang, atau penawaran terendah selama pemenang belum dipilih).

Konsekuensinya: selama belum ada vendor yang menawar seluruh item, nilainya 0 dan syarat
minimal jatuh ke angka terendah (2 penawaran). Begitu penawaran lengkap pertama masuk dan
nilainya di atas Rp 10 juta, syaratnya naik jadi 3 — jadi badge "2 / 2" bisa berubah jadi
"2 / 3". Ini disengaja, bukan bug.

**Status:** `Draf → Diajukan → Dalam pengadaan → Selesai`,
plus `Dikembalikan` dan `Dibatalkan`.

- *Diverifikasi* — permintaannya sudah dinyatakan layak, jalur pengadaan belum dipilih
- *Dalam pengadaan* — jalur sudah dipilih, proses berjalan
- *Selesai* — dihitung otomatis: semua PO/SPK turunannya berstatus Selesai
- *Dibatalkan* — hanya selama belum ada PO

---

## 3a. Verifikasi permintaan

Dikerjakan peran yang terdaftar di `VERIFY` (lihat bagian 2). Satu keputusan saja: permintaan
ini layak diteruskan atau tidak.

- **Layak** → status jadi `Diverifikasi`. Jalur pengadaan belum apa-apa; itu urusan langkah
  berikutnya.
- **Tidak layak** → dikembalikan ke peminta dengan catatan (status `Dikembalikan`). Peminta
  memperbaiki lalu mengajukan ulang.

Verifikasi sengaja tidak menyentuh jalur pengadaan. Memeriksa kelayakan permintaan dan memilih
strategi pembelian itu dua pertimbangan berbeda, dan yang kedua milik pengadaan.

---

## 4. Pengadaan

Dijalankan Accounting setelah permintaan diverifikasi.

### 4.0 Pilih jalur — langkah pertama

Permintaan berstatus `Diverifikasi` membuka panel pengadaan dengan satu kartu: **Pilih jalur
pengadaan**. Dua pilihan, dan memilih salah satunya yang memindahkan permintaan ke status
`Dalam pengadaan` sekaligus membuat dokumen pengadaan kosongnya.

Jalur menentukan layar yang muncul sesudahnya — bukan sekadar label. Bidding dan vendor tunggal
punya daftar langkah sendiri (`ProcGuide`) dan komponen layar sendiri (`BiddingSection` dan
`SingleSection`), jadi tidak ada tampilan bidding yang bocor ke jalur tunggal.

Di penyimpanan keduanya memakai `route: 'bidding'`, dibedakan oleh `single.on`. Bentuk data
penawarannya identik, jadi berpindah jalur tidak membuang penawaran yang sudah diunggah.

**Jalur bisa diganti sampai pengadaan disetujui.** Kartu jalur tidak hilang setelah dipilih — ia
tetap ada dalam bentuk ringkas di atas langkah pengadaan, sehingga Accounting bisa pindah dari
bidding ke vendor tunggal atau sebaliknya. Penawaran yang sudah diunggah ikut terbawa.

Satu akibat yang perlu diketahui: **mengganti jalur yang sudah diajukan menarik pengajuannya
kembali ke `Draf`**, dan harus diajukan ulang. Ini disengaja — approver menilai hasil pengadaan
per jalur, jadi jalur tidak boleh berubah di bawah pengajuan yang sedang dinilainya. Setelah
status `Disetujui`, jalur terkunci: PO sudah terbit.

**Konfirmasi pergantian.** Pergantian yang berakibat memunculkan modal konfirmasi lebih dulu;
yang tidak berakibat (belum ada penawaran, status masih draf) langsung jalan. Akibatnya dihitung
oleh `routeSwitchEffects` di `utils.js`, yang dipakai bersama oleh panel (untuk memutuskan perlu
modal atau tidak) dan oleh modalnya (sebagai isi). Modal menyebutkan akibatnya satu per satu —
vendor mana yang dipakai, berapa penawaran yang disembunyikan, apakah pengajuan ditarik — bukan
peringatan umum "data akan hilang", karena **tidak ada penawaran yang dihapus pada pergantian
jalur mana pun**.

**Penyelarasan pemenang.** Jalur vendor tunggal selalu memakai `quotes[0]`, sedangkan `winnerOf`
mendahulukan `procurement.winners`. Kalau keduanya dibiarkan, pindah dari bidding yang pemenangnya
bukan penawaran pertama akan membuat kartu menampilkan satu vendor sementara PO terbit ke vendor
lain. Karena itu `applyRoute` memindahkan penawaran pemenang ke urutan pertama dan mengosongkan
`winners` setiap kali jalur ditukar.

### 4.1 Bidding
Jalur normal untuk sebagian besar pembelian.

| Aturan | Nilai |
|---|---|
| Minimal penawaran, nilai penawaran ≤ Rp 10 juta | 2 penawaran |
| Minimal penawaran, nilai penawaran > Rp 10 juta | 3 penawaran |

**Isi penawaran vendor:** nomor, masa berlaku, berkas, deskripsi, termin bayar, waktu
pengiriman/pengerjaan, garansi. Per item: harga, pajak, dan spesifikasi yang ditawarkan.
Spesifikasi yang ditawarkan itulah yang dipakai pembanding; tidak ada lagi field kesesuaian
terpisah. Item yang tidak ditawar vendor muncul sebagai "Tidak ditawar" di kolom harga.

**Tabel penawaran** memuat vendor, termin, waktu kirim/kerja, garansi, total, dan kolom **Aksi**.
Tabelnya sengaja datar — tidak ada baris yang bisa dibuka-tutup, dan berkas penawaran tidak
ditampilkan di sana. Rincian per item, keterangan vendor, masa berlaku, dan berkasnya dikumpulkan
di **modal detail**, yang dibuka lewat "Lihat detail" pada menu aksi. Detail terbuka untuk semua
peran, termasuk saat pengadaan sudah dikunci.

**Penawaran bisa diubah dan dihapus** selama pengadaan belum diajukan atau sudah ditolak
(`!locked && canCreate(role, 'quote')`), lewat menu aksi yang sama — dua entri itu hilang kalau
syaratnya tidak terpenuhi, menyisakan "Lihat detail". Setelah
diajukan ke approver, menunya hilang; setelah disetujui, penawaran terkunci bersama jalurnya.

Keduanya ikut membersihkan jejak di dokumen pengadaan, supaya tidak ada yang menunjuk data yang
sudah tidak ada:

| | Menghapus penawaran | Mengubah penawaran |
|---|---|---|
| Baris penawaran | dibuang | diganti isinya |
| Pemenang | dilepas kalau menunjuk vendor itu | dikosongkan seluruhnya |
| Harga negosiasi (`offerFinals`) | dibuang untuk vendor itu | dibuang untuk vendor itu |
| Diskon, ongkir, nilai vendor | dibuang untuk vendor itu | tetap |
| Pengajuan berstatus `Diajukan` | ditarik ke `Draf` | ditarik ke `Draf` |

Pembuangan `offerFinals` saat mengubah penawaran itu penting: `offerPrice()` mendahulukan harga
hasil negosiasi, jadi tanpa itu harga penawaran yang baru tidak akan terlihat sama sekali —
layar tetap memakai angka negosiasi yang lama.

Menghapus penawaran **tidak bisa dibatalkan**, jadi selalu lewat modal konfirmasi yang menyebut
vendor, nilai penawarannya, apakah ia sedang jadi pemenang, dan berapa penawaran yang masih
kurang dari syarat minimal setelah dihapus.

Pajak diatur per baris: PPN 11%, atau saklar **harga sudah termasuk PPN** yang berlaku untuk
seluruh penawaran. Kalau termasuk PPN, harga dikonversi ke DPP saat PO dibuat agar total PO
sama dengan nilai penawaran.

**Form bidding:** harga final per item (hasil negosiasi di luar sistem), diskon, pemenang per
item. Wajib isi alasan pemilihan bila pemenang bukan yang termurah. Penilaian vendor 1–5
berbobot (harga 45%, spesifikasi 30%, waktu penyerahan 15%, termin 10%) bersifat alat bantu.

**Status:** `Draf → Menunggu approval → Disetujui`, plus `Ditolak`.

### 4.2 Vendor tunggal
Hanya satu vendor yang bisa menyuplai. Satu penawaran, tanpa pembanding dan tanpa pemilihan
pemenang — vendor pada penawaran itu otomatis jadi pemenang (`winnerOf`).

Layarnya satu kartu **Pengadaan vendor tunggal**: identitas penawaran di atas, lalu tabel harga
penawaran berdampingan dengan harga final yang bisa dinegosiasi, catatan negosiasi, dan baris
persetujuan. Aturan minimal jumlah penawaran di 4.1 tidak berlaku di sini.

### 4.3 Persetujuan pengadaan
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

Termin bayar **tidak lagi ditulis di kode**. Katalognya tersimpan di store (`pb.paymentTerms`,
disemai dari `src/pages/Pembelian/paymentTerms.js`) dan diatur lewat **Pengaturan → Transaksi &
Dokumen → Syarat Pembayaran**. Dropdown "Termin bayar" di form penawaran membaca katalog itu,
disaring menurut jenis permintaan (barang → PO, jasa → SPK) dan hanya yang berstatus aktif.

### 6.0 Cara satu termin didefinisikan

Mesin hitung dulu bercabang pada nama termin (`type === 'dp_progress'` dan seterusnya), sehingga
termin baru mustahil ditambah tanpa mengubah kode. Sekarang satu termin dirakit dari lima saklar
mekanis, dan mesin membaca saklarnya:

| Saklar | Nilai | Pengaruhnya |
|---|---|---|
| `advance` | `none` / `partial` / `full` | Berapa yang dibayar di muka (`advancePct`) |
| `split` | `none` / `terms` / `periods` | Nilai dipecah jadi berapa tagihan (`scheduleCount`) |
| `dpOutOfSchedule` | ya / tidak | Uang muka dikeluarkan dari nilai yang dibagi ke termin |
| `retention` | ya / tidak | Sebagian ditahan sampai masa pemeliharaan habis |
| `due` | ya / tidak | Faktur punya jatuh tempo |
| `dueFrom` | `receipt` / `invoice` | Jatuh tempo dihitung sejak penerimaan atau sejak faktur vendor |

Dua belas termin bawaan adalah kombinasi saklar ini, bukan kasus khusus. Termin baru cukup
memilih kombinasinya — misalnya **"Cicilan 6x"** = `advance: none` + `split: terms` + `due`,
dengan nilai awal `terms: 6`. Isian tambahan yang muncul di form penawaran dihitung dari saklar
tersebut oleh `termFields()`, jadi tidak ada daftar isian yang perlu dirawat terpisah.

### 6.0.1 Kapan tagihan jatuh tempo

Tagihan di modul ini **dipicu kejadian, bukan kalender**: satu termin baru bisa difaktur setelah
penerimaannya (FPB/BAST) dikonfirmasi. Tidak ada jadwal tanggal yang menerbitkan tagihan sendiri,
dan itu disengaja — aturan pokok nomor 2 melarang faktur tanpa penerimaan.

Yang dihitung dari tanggal hanyalah **jatuh tempo faktur**: `dueDays` hari sejak titik yang
ditentukan `dueFrom`.

| `dueFrom` | Artinya | Dipakai saat |
|---|---|---|
| `receipt` | Sejak tanggal FPB / BAST | "30 hari setelah barang diterima" — default semua termin bawaan |
| `invoice` | Sejak tanggal faktur vendor | "net 30 dari tanggal invoice" |

Kalau satu faktur menggabungkan beberapa penerimaan, yang dipakai adalah **penerimaan paling
akhir**, karena kewajiban baru genap setelah kiriman terakhir diterima.

**Tanpa tenggat = jatuh tempo hari itu juga.** Termin yang saklar `due`-nya mati (CAD, DP, CBD)
berarti tidak ada masa kredit: fakturnya jatuh tempo pada tanggal acuan itu sendiri. Lamanya
dibaca lewat satu fungsi, `dueDaysOf()`:

| Keadaan | Hasil |
|---|---|
| `due` mati | 0 hari — bayar pada tanggal penerimaan |
| `due` nyala, `dueDays` diisi 0 | 0 hari — sama, ditulis eksplisit |
| `due` nyala, `dueDays` = N | N hari |
| Pesanan tanpa termin sama sekali (data lama) | 30 hari |

Dulu rumusnya `dueDays > 0 ? dueDays : 30`, sehingga "tidak ada tenggat" dan "0 hari" sama-sama
jatuh ke 30 hari. Akibatnya **setiap** termin memberi vendor tempo 30 hari — termasuk CAD, yang
justru berarti bayar saat barang diterima — dan isian 0 hari mustahil diwujudkan. Hanya kasus
terakhir di tabel yang masih memakai 30, karena di situ memang tidak ada kesepakatan untuk dibaca.

Teks termin pada PO/SPK selalu menyebut kapan harus dibayar, termasuk saat tanpa tenggat
(`CAD · jatuh tempo saat penerimaan`). Pengecualiannya termin yang dibayar penuh di muka:
uangnya sudah keluar sebelum barang datang, jadi tidak ada tempo untuk disebut.

Sebelumnya jatuh tempo selalu dihitung dari `TODAY`, yaitu hari Accounting mengetik fakturnya.
Akibatnya "30 hari sejak barang diterima" meleset sebanyak keterlambatan pencatatan: barang datang
1 November, faktur dicatat 8 November, jatuh tempo jadi 8 Desember alih-alih 1 Desember. Sekarang
titik hitungnya tanggal penerimaan, dan kolom Jatuh tempo menampilkan dasar perhitungannya.

Jatuh tempo tetap bisa ditimpa manual per faktur. Begitu disentuh pengguna, ia berhenti ikut
bergerak saat tanggal faktur diubah.

**Belum ada:** rentang tanggal untuk termin berulang. "Periode ke-3 dari 12" belum terikat ke
bulan kalender mana pun, jadi belum bisa dipakai untuk akrual per bulan. Itu menyentuh
`expandSchedule` dan dikerjakan terpisah.

### 6.0.2 Mengapa termin disalin ke dokumen

Saat penawaran disimpan, termin membawa **salinan saklar dan namanya** (`snapshotTerm`), bukan
hanya id. Salinan itu sengaja dibekukan: kalau bulan depan seseorang mengubah "Cicilan 6x" jadi
12x atau menambahkan uang muka, SPK yang sudah terbit tidak boleh ikut berubah artinya. Dokumen
lama yang belum punya salinan dibaca dari katalog bawaan lewat id-nya, jadi data lama tetap utuh.

Konsekuensinya untuk Pengaturan: mengubah atau menonaktifkan termin **hanya memengaruhi
penawaran berikutnya**. Termin bawaan dan termin yang sudah dipakai dokumen tidak bisa dihapus,
hanya dinonaktifkan.

### 6.1 Barang

| Termin | Artinya |
|---|---|
| CAD | Bayar setelah barang diterima |
| DP | Uang muka X%, sisanya setelah diterima |
| CBD | Bayar penuh sebelum kirim |

Tiga di atas adalah termin barang **bawaan**. Sejak katalognya bisa diatur, termin barang pun
boleh memakai jadwal termin atau periode — cukup buat termin baru dengan `scope` barang.

Pada ketiga termin bawaan itu barang **tidak punya jadwal termin**. Kalau pengiriman bertahap,
pembayaran ikut terpecah — tapi yang memecah adalah **qty yang betul-betul datang**, bukan
persentase yang disepakati.

### 6.2 Jasa

Sembilan tipe bawaan. Angka dokumen di bawah memakai `N` = jumlah termin, `P` = jumlah periode.

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

**Akibatnya `poTotal` pada jadwal DP + termin progres bukan nilai kontrak**, melainkan jumlah
baris termin saja (Rp 88,8 juta dari kontrak Rp 111 juta termasuk PPN). Uang mukanya hidup di
luar baris PO, ditagih lewat PR tersendiri. Karena itu `poDpAmount` memulihkan nilai kontrak
dulu sebelum menghitung persentase:

```
uang muka = poTotal × pct / (1 − pct)        // hanya untuk dp_progress
```

Tanpa itu uang muka terhitung dari nilai yang sudah dipotong, dan vendor kurang dibayar
sebesar `pct²` dari kontrak — pada DP 20% dari Rp 111 juta, selisihnya Rp 4,44 juta.

**Persentase uang muka selalu dibaca lewat `advancePct(term)`, jangan `term.dpPct`.** Termin
jasa "bayar penuh di muka" dan "berkala di muka" 100% dibayar di depan tapi tidak pernah
mengisi `dpPct`; membaca `dpPct` langsung membuat uang mukanya terhitung Rp 0.

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

## 8a. Perlu tindakan & batas wajar

Dashboard tiap peran menampilkan daftar **Perlu tindakan** (`actionsFor(role, pb)`), berisi hanya
dokumen yang menunggu peran itu. Sekarang daftarnya juga tahu **sudah berapa lama** tiap tugas
menggantung, dan menandai yang lewat batas.

**Batas wajar per langkah** ada di satu konstanta, `SLA` di `selectors.js`:

| Langkah | Batas | Langkah | Batas |
|---|---|---|---|
| Verifikasi permintaan | 14 hari | Kirim PO ke vendor | 3 hari |
| Pilih jalur pengadaan | 7 hari | Setujui BAST | 5 hari |
| Kumpulkan penawaran | 14 hari | Catat faktur | 7 hari |
| Approval pengadaan | 7 hari | Ajukan / setujui PR | 5 hari |
| Buat PO/SPK | 3 hari | Bayar PR | 3 hari |

Dua langkah tidak memakai batas hitungan hari karena sudah punya tanggal janji sendiri:
**penerimaan** memakai `expectedAt` pesanan, dan **pembayaran faktur** memakai `dueDate` faktur.

**Dari kapan dihitung.** Tiap perpindahan ke keadaan "menunggu orang lain" kini distempel:
`submittedAt`, `verifiedAt`, `routedAt`, `returnedAt`, `procurement.submittedAt`, dan `sentAt`
pada pesanan. Dokumen lama yang belum punya stempel jatuh ke tanggal dokumennya, jadi daftarnya
tetap jalan tanpa migrasi.

**Tampilannya.** Tugas yang lewat batas naik ke atas (paling lama lebih dulu), diberi garis merah,
label "Terlambat N hari · menunggu M hari", dan tombolnya jadi merah. Di atas daftar ada ringkasan
jumlah yang terlambat, dan kartu statistik "Menunggu tindakan Anda" ikut memberi tahu berapa yang
lewat batas. Tugas yang belum lewat batas tetap menampilkan umurnya ("Menunggu 6 hari") supaya
terlihat mendekat.

Contoh yang diminta: permintaan diajukan 20 hari lalu dan belum diverifikasi akan muncul di
dashboard **Accounting dan Finance** (dua peran yang boleh memverifikasi, lihat `VERIFY`) sebagai
*Verifikasi permintaan — Terlambat 6 hari · menunggu 20 hari*.

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

Permintaan, penawaran, bidding, PO/SPK, dan Payment Request **tidak** membentuk
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

**Ambang yang masih dikunci di kode** (`RULES` di `data.js`): minimal penawaran dan tarif PPN 11%. Spesifikasi menghendaki semuanya bisa diatur lewat menu Pengaturan.

**Kompatibilitas data tersimpan.** State lama digabung dengan data contoh saat dimuat; vendor
digabung per-record agar kolom baru terisi pada data lama; peran lama dipetakan lewat
`normalizeRole`. Pola ini harus dipertahankan saat menambah kolom.
