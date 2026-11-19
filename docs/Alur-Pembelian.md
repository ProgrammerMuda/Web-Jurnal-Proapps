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
   ↓ 2 approval                  Chief Finance -> Building Manager
PO (barang) / SPK (jasa)         Accounting — terbit otomatis setelah disetujui
   ↓ kirim ke vendor             Accounting
   ├─ [opsional] PR uang muka → persetujuan BM → PV      Accounting · BM · Finance
   ↓
Penerimaan                       Gudang / PIC Jasa
   ├─ FPB (barang)               langsung terkonfirmasi
   └─ BAPP (jasa)                perlu 2 approval: Chief Finance -> BM
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
2. Tidak ada faktur tanpa penerimaan (FPB/BAPP) yang sudah dikonfirmasi
3. Tidak ada Payment Voucher tanpa Payment Request yang sudah disetujui

---

## 2. Peran

| Peran | Membuat | Menyetujui |
|---|---|---|
| **Peminta** | Permintaan (FPPBJ) | — |
| **Accounting** | Penawaran, pengadaan, PO/SPK, faktur, Payment Request, retur | Verifikasi permintaan |
| **Chief Finance** | — | Pengadaan, BAPP, Payment Request — **tanda tangan ke-1** |
| **Building Manager** | — | Pengadaan, BAPP, Payment Request — **tanda tangan ke-2** |
| **Finance** | Payment Voucher, pembayaran | — |
| **Gudang / PIC Jasa** | FPB, BAPP, retur | — |
| **Superadmin** | semuanya | semuanya |

### 2.1 Approval berjenjang dua

Setiap approval butuh **dua tanda tangan, berurutan**: Chief Finance lebih dulu, lalu Building
Manager. Dua sudut pandang yang berbeda — Chief Finance menimbang anggaran dan kasnya, Building
Manager menimbang kebutuhan operasional gedungnya — jadi urutannya bermakna, bukan sekadar dua
orang menekan tombol yang sama.

Berlaku untuk **pengadaan**, **BAPP**, dan **Payment Request**. Dokumen baru pindah status
(mis. pengadaan jadi *Disetujui* dan PO/SPK terbit) setelah tanda tangan **kedua**.

Satu dokumen hanya muncul di dashboard peran yang sedang giliran, dan tombolnya berbunyi
*Setujui (1/2)* lalu *Setujui (2/2)*. Siapa yang menandatangani dan kapan tercatat per slot di
`doc.approvals`, dan terbaca di kartu informasi dokumennya. Dokumen lama yang sudah disetujui
tanpa kolom itu tetap dibaca genap — kalau tidak, semuanya akan terlihat mundur jadi menunggu
approval lagi.

**Verifikasi FPPBJ tidak berjenjang** dan cukup **Accounting**: itu pemeriksaan kelengkapan
berkas, bukan keputusan membelanjakan uang.

Semua pengecekan hak akses ada di satu berkas: `src/pages/Pembelian/permissions.js`. Layar
tidak pernah membandingkan string peran secara langsung.

**Verifikasi permintaan sengaja dibuat lentur.** Di lapangan langkah ini kadang dipegang
Procurement, kadang AP, kadang dua-duanya, tergantung pembagian kerja tiap gedung. Jadi
daftarnya berdiri sendiri di konstanta `VERIFY` dan dibaca lewat `canVerify(role)` — untuk
menambah atau mencabut peran yang boleh memverifikasi, ubah satu baris itu saja, tidak ada
layar yang perlu disentuh:

```js
const VERIFY = { fppbj: ['accounting'] };
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
| Penerimaan | FPB | BAPP |
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

Termin bayar **tidak lagi ditulis di kode**. Katalognya datang dengan delapan termin sebagai
isi awal — bukan termin bawaan yang terkunci: semuanya bisa diubah, dinonaktifkan, dan dihapus
selama belum dipakai dokumen. Katalognya tersimpan di store (`pb.paymentTerms`,
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
penerimaannya (FPB/BAPP) dikonfirmasi. Tidak ada jadwal tanggal yang menerbitkan tagihan sendiri,
dan itu disengaja — aturan pokok nomor 2 melarang faktur tanpa penerimaan.

Yang dihitung dari tanggal hanyalah **jatuh tempo faktur**: `dueDays` hari sejak titik yang
ditentukan `dueFrom`.

| `dueFrom` | Artinya | Dipakai saat |
|---|---|---|
| `receipt` | Sejak tanggal FPB / BAPP | "30 hari setelah barang diterima" — default semua termin bawaan |
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

| Tipe | BAPP | Faktur | PR | PV |
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
- **Retensi menambah satu BAPP sekaligus satu faktur.** Baris retensi diperlakukan seperti
  termin biasa: ada BAPP pemeliharaan setelah masa pemeliharaan lewat, lalu faktur, PR, PV.
- **Bayar di muka 100% menghasilkan faktur bernilai nol.** BAPP dan faktur tetap dibuat karena
  itu yang mencatat jasa sudah diterima dan memunculkan PPN masukan, tapi seluruh nilainya
  terpotong uang muka sehingga faktur langsung Lunas tanpa PR baru.

### 6.3 Cara jadwal termin diwujudkan

Termin progres dan layanan berkala **dipecah menjadi baris SPK**, satu baris per termin atau
periode, plus satu baris retensi bila ada. Dengan begitu BAPP, faktur, PR, dan PV per termin
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

Barang lewat **FPB**, jasa lewat **BAPP**. Keduanya dibuat Gudang / PIC Jasa.

**Isi:** tanggal, nomor surat jalan atau nomor BAPP vendor, catatan kondisi, dan per item qty
diterima + qty ditolak.

**Aturan qty:** jumlah diterima + ditolak tidak boleh melebihi sisa pesanan. Keduanya saling
membatasi secara langsung — kalau sisa 2 dan diterima diisi 2, kolom ditolak otomatis
terkunci sampai angka diterima dikurangi. Qty ditolak tidak dihitung sebagai diterima,
sehingga sisa pesanan tetap terbuka.

Untuk SPK bertermin, baris penerimaan **mulai kosong** — PIC mengisi termin yang selesai saja.
Pesanan biasa tetap terisi penuh karena umumnya diterima sekaligus.

**Status:** FPB langsung `Dikonfirmasi`. BAPP terbit `Menunggu approval atasan` dan baru bisa
difaktur setelah disetujui Building Manager.

---


### 7.1 Tiga cara mencatat penerimaan

| Pesanan | Cara mencatat |
|---|---|
| **PO barang** (FPB) | isian qty diterima dan qty ditolak per item |
| **SPK jasa bertermin** | centang per termin |
| **SPK jasa tanpa jadwal termin** | centang per lingkup kerja |

Dua yang terakhir sama-sama tidak memakai qty. Pekerjaan jasa dinilai lolos atau tidak, bukan
dihitung sebagiannya; memaksa angka "12 dari 20" di situ meniru FPB barang untuk sesuatu yang
penilaiannya memang bukan angka.

Pada SPK jasa tanpa jadwal termin, tiap lingkup kerja punya satu kotak centang: dicentang berarti
diterima seluruhnya. Yang tidak dicentang tidak ikut BAPP itu dan tetap terbuka untuk BAPP
berikutnya — sama seperti termin yang belum selesai pada SPK bertermin. Tidak ada kolom
*ditolak*: menolak berarti belum menerima, dan sisa SPK-nya memang tetap terbuka sampai
pekerjaannya diterima.

### 7.2 BAPP untuk SPK bertermin

SPK yang terminnya lebih dari satu **dicentang per termin**: satu termin adalah satu pekerjaan
yang selesai atau belum, tidak ada separuh termin. Satu BAPP boleh memuat beberapa termin
sekaligus.

**Dua watak jadwal, dua aturan:**

| | Termin berkala (periode) | Termin persen (milestone) |
|---|---|---|
| Label baris | `Termin 3 · Jul–Sep 2026` | `Termin 3 · 30%` |
| Kunci | Baru bisa dicatat setelah periodenya berakhir | Tidak terkunci tanggal |
| Urutan | Berurutan | Berurutan |
| Tanggal jurnal | **Akhir periode** yang di-BAPP | **Tanggal BAPP** |

Rentang periode dihitung dari tanggal pesanan terbit ditambah panjang periode (`periodRange`
di `utils.js`), dan ikut tersimpan pada baris SPK sebagai `periodFrom`/`periodTo`.

**Kenapa tanggal jurnalnya berbeda.** Beban termin berkala milik periode yang dikerjakan, bukan
milik hari dokumennya diketik: BAPP yang ditandatangani 5 Oktober untuk periode Jul–Sep tetap
diakui 30 September. Milestone tidak punya periode, jadi diakui pada tanggal BAPP.

**Aturan berurutan** memperhitungkan centang pada BAPP yang sama. Termin 4 terbuka begitu termin 3
dicentang, tanpa harus disimpan dulu — kalau tidak, milestone yang selesai bersamaan tidak akan
pernah bisa dicatat sekaligus. Melepas centang satu termin ikut melepas termin sesudahnya, supaya
tidak tersisa termin 4 tercentang tanpa termin 3.

**Berkas penerimaan.** BAPP bertanda tangan **wajib** diunggah — berlaku untuk semua SPK jasa,
bertermin maupun tidak. Pada FPB barang unggahannya **opsional**: surat jalan tidak selalu discan,
dan mewajibkannya hanya akan menghambat pencatatan gudang. Berkasnya tersimpan di `file` pada
dokumen penerimaan dan ditampilkan kembali di halaman detailnya. Nomor dan tanggal BAPP tetap diisi manual mengikuti
dokumen fisiknya.

Ringkasan hasil ditampilkan sebelum disimpan: nilai yang dicatat, progres pesanan (`3 dari 4
periode` atau `100%`), sisa pesanan, dan tanggal jurnalnya.

> **Catatan:** jurnalnya sendiri belum terbentuk — modul ini belum punya mesin jurnal (bagian 9).
> Yang disimpan baru `journalDate` pada dokumen BAPP, yaitu tanggal pengakuan bebannya.

## 8. Faktur, Payment Request, Payment Voucher

### 8.1 Faktur pembelian
Dicatat Accounting di **halaman penuh** `#pembelian/invoice/new`, bukan modal — polanya sama
dengan form faktur di modul Penjualan. Isinya dibagi tiga langkah: **Sumber Tagihan → Data
Faktur → Rincian Item**. Nomor, tanggal, dan berkas disalin dari lembar invoice yang ada di
tangan, jadi diketik sekalian sebelum masuk ke penyesuaian qty baris per baris. Ringkasan nilai
tagihan menempel di bawah form pada langkah rincian, tempat angkanya sudah lengkap.

**Isi:** nomor invoice vendor, tanggal faktur, jatuh tempo, potongan PPh, berkas invoice dan
faktur pajak, serta baris qty yang difaktur.

#### Tiga jalur
| Jalur | Dasar tagihan | Pencocokan |
|---|---|---|
| **Dari penerimaan** | satu atau beberapa FPB/BAPP vendor yang sama dan sudah dikonfirmasi | 3 arah: qty dibatasi penerimaan, harga dikunci PO |
| **Dari PO/SPK** | pesanan yang memang tidak melewati gudang | 2 arah: qty dibatasi pesanan, harga dikunci PO/SPK |
| **Tanpa penerimaan** | baris diketik sendiri; untuk tagihan non-PO (listrik, sewa, jasa berulang) | tidak ada |

Jalur **Dari PO/SPK** dipakai bila pesanannya memang tidak melewati serah terima. Itu
**disepakati di penawaran vendor**, bukan ditebak belakangan: bagian *Ketentuan* pada form
penawaran punya saklar berlabel **Serah terima barang / jasa**, bawaannya menyala. Keterangan di
bawahnya berganti mengikuti posisinya, jadi akibatnya terbaca sebelum disimpan.

Penandanya tersimpan di penawaran (`withReceipt`), lalu ikut ke PO/SPK saat pengadaan disetujui.
Penawaran dan pesanan lama tanpa kolom itu dianggap memakai serah terima.

| `withReceipt` | Rantai dokumennya |
|---|---|
| `true` (bawaan) | PO/SPK → FPB/BAPP → faktur dari penerimaan |
| `false` | PO/SPK → faktur langsung dari pesanan |

Konsekuensinya berlaku di dua arah: pesanan `withReceipt: false` **tidak muncul** di daftar
"siap diterima", dan sebaliknya pesanan `withReceipt: true` tidak bisa ditagih lewat jalur
PO/SPK.

Halaman detail pesanan ikut menyesuaikan. Pada pesanan tanpa serah terima:

- tombol *Catat penerimaan / Catat BAPP* tidak ditampilkan;
- kolom **Diterima** pada tabel item dihilangkan — tanpa FPB/BAPP kolom itu akan selalu 0 dan
  terbaca seperti barang yang tak kunjung datang. Qty **Difaktur** dihitung per pesanan
  (`invoicedQtyOfPo`), bukan dijumlah dari penerimaan;
- kartu **Penerimaan barang (FPB) / Serah terima (BAPP)** tidak ditampilkan sama sekali, bukan
  ditampilkan kosong — kartu kosong mengundang pertanyaan "kenapa belum ada penerimaannya?"
  yang tidak ada jawabannya;
- kartu **Faktur pembelian** menyebut bahwa fakturnya dibuat langsung dari PO/SPK.

Pemisahan itu pengaman, bukan kerapian. Sisa penerimaan dihitung per FPB/BAPP (`invoicedQty`)
sedangkan sisa pesanan dihitung per PO (`invoicedQtyOfPo`). Kalau satu pesanan boleh ditagih
dari dua jalur sekaligus, qty yang sudah ditagih lewat PO tidak terlihat oleh jalur penerimaan —
dan vendor bisa tertagih dua kali untuk barang yang sama.

Tanpa FPB/BAPP tidak ada tanggal penerimaan untuk dijadikan acuan, jadi tempo apa pun yang
disepakati dihitung dari **tanggal faktur vendor**, apa pun `dueFrom` terminnya.

Dokumen sumbernya dipilih **di dalam halaman** (langkah 1); tidak ada modal pemilih di depannya —
tombol "Buat Tagihan Vendor" dan "Catat faktur" membuka halaman ini langsung, karena langkah 1
sudah memuat pemilihan vendor dan penerimaan. Vendor dipilih
lebih dulu dan daftar penerimaannya menyusul: satu faktur hanya untuk satu vendor, dan mengganti
vendor mengosongkan pilihan — tanpa itu, penerimaan vendor A bisa tertagih ke vendor B tanpa
terlihat. Tombol "Catat faktur" di detail PO/SPK dan detail FPB/BAPP membuka halaman yang sama
dengan penerimaannya sudah terpilih (`?from=<id,id>`).

#### Satu faktur = satu termin
Beberapa FPB/BAPP boleh digabung jadi satu faktur selama **vendor dan termin bayarnya sama**.
Satu faktur hanya punya satu jatuh tempo dan satu aturan potongan uang muka, jadi mencampur
termin berarti salah satu pesanan ditagih dengan syarat yang tidak pernah disepakati untuknya.

Penerimaan yang dipilih pertama **mengunci** termin sisanya: yang berbeda tetap tampil di tabel
tapi kotak centangnya mati, dengan alasannya tertulis di barisnya. Kesetaraan termin dihitung
`termKey()` di `utils.js` — nama, mekanisme, dan seluruh parameternya (`dpPct`, `terms`,
`period`, `retentionPct`, `dueDays`, `dueFrom`) harus sama, bukan cuma namanya.

Tabel pilihan menyebut **termin bayar** dan **jatuh tempo** tiap penerimaan, supaya alasan
terkuncinya terbaca tanpa harus membuka pesanannya. Jatuh tempo yang titik hitungnya `receipt`
sudah pasti dan dicetak sebagai tanggal; yang `invoice` ditulis sebagai rumusnya ("30 hari sejak
tgl faktur"), karena tanggal fakturnya baru diisi di langkah 2.

Pilihan awal dari alamat halaman (`?from=...`) disaring dengan aturan yang sama, jadi gabungan
terlarang tidak bisa diselundupkan lewat URL.

Kepala kartu langkah menyebut vendor yang ditagih dan penerimaan yang masuk: nama vendor sebagai
teks utama, nomor FPB/BAPP sebagai badge di bawahnya. Lebih dari lima penerimaan, deretan
nomornya lebih panjang daripada judul langkahnya sendiri — jadi diringkas jadi satu badge
berisi jumlahnya (mis. *6 FPB/BAPP*) yang bila diklik membuka daftar lengkapnya: nomor, pesanan
asal, tanggal terima, jatuh tempo, dan sisa baris yang belum difaktur.

#### Kalau tanggal penerimaannya berbeda
Termin boleh sama sementara tanggal penerimaannya tidak — kiriman bertahap atas satu PO,
misalnya. Satu faktur hanya punya satu jatuh tempo, dan yang dipakai adalah **penerimaan
terakhir**: kewajiban bayarnya baru genap setelah kiriman terakhir datang. Memakai yang paling
awal akan membuat sebagian faktur lahir sudah lewat tempo.

Aturan itu tidak dijalankan diam-diam. Penguncian termin dan pemilihan jatuh tempo diterangkan
dalam **satu** callout, karena keduanya berangkat dari premis yang sama — satu faktur hanya punya
satu syarat bayar. Premisnya ditulis sekali, lalu akibatnya menyusul: penerimaan bertermin lain
dinonaktifkan, dan (bila tanggalnya berbeda) jatuh tempo diambil dari penerimaan terakhir,
disebut tanggal dan nomornya. Langkah 2 tidak mengulanginya: kolom jatuh tempo di sana sudah
terisi tanggal hasil hitungannya, dan tetap bisa diubah.

Jatuh tempo tiap penerimaan sudah tertera di kolomnya sendiri di tabel, jadi tidak diulang
sebagai daftar kedua di dalam callout. Tanggalnya tetap bisa diubah di langkah Data Faktur, dan
begitu disentuh ia berhenti ikut bergerak.

Baris faktur manual menyimpan keterangannya sendiri dan tidak merujuk penerimaan mana pun, jadi
tidak mengurangi sisa FPB/BAPP dan tidak bisa diretur. Barangnya dianggap sudah diterima —
tagihan non-PO dicatat setelah jasanya terpakai atau barangnya ada, jadi tidak ada kolom status
penerimaan di barisnya.

Barisnya **dipilih dari katalog produk**, bukan diketik bebas: satu dropdown untuk jenis
(barang / jasa) dan satu untuk itemnya, disaring menurut jenis itu. Di bawahnya ada **deskripsi
baris**, persis seperti baris produk di faktur penjualan: terisi otomatis dari deskripsi katalog
saat item dipilih, lalu boleh disesuaikan. Nama katalog menyebut *apa* yang ditagih, deskripsi
menyebut *yang mana* — periode, lokasi, nomor meteran. Deskripsinya ikut tampil di halaman detail
faktur di bawah nama itemnya.

Karena itu tiap entri `productCatalog` membawa `description` selain `name`, `kind`, `unit`, dan
`price`. Satuan dan harga acuan ikut
terisi dari katalog; harganya tetap bisa diubah karena tagihan vendor belum tentu sama dengan
harga acuan. Nama yang seragam menjaga laporan per barang tidak pecah hanya karena ejaan.

Karena itu katalog produk (`productCatalog` di `data.js`) memuat juga tagihan rutin non-PO —
listrik, air, internet, sewa ruang, cleaning service, security — semuanya berjenis jasa dengan
satuan `bulan`. Tanpa entri itu, jalur manual tidak punya apa pun untuk dipilih.

Angka fakturnya ditutup satu pita rata kanan di kaki form: DPP, PPN, potongan PPh, potongan uang
muka, lalu **Hutang Usaha** sebagai angka terakhir yang dibaca — bentuknya sama dengan kaki
faktur di modul Penjualan. Baris bernilai nol tidak dicetak, karena "-Rp 0,00" menambah baris
tanpa menambah keterangan.

**Pencocokan 3 arah:** qty faktur dibatasi qty yang diterima, harga dikunci sama dengan PO/SPK.

**Potongan otomatis:** PPN, PPh, uang muka (proporsional terhadap nilai faktur), retur, dan
alokasi kredit vendor.

Jatuh tempo mengikuti termin pesanan bila diatur di penawaran, kalau tidak 30 hari.

**Status:** `Belum dibayar`, `Jatuh tempo`, `Lunas` — plus `Dibatalkan` untuk faktur yang
dihentikan.

*Dibayar sebagian* dihapus sebagai status tersendiri. Yang penting dari faktur yang baru dibayar
separuh adalah bahwa ia **masih punya sisa hutang**, sama seperti yang belum dibayar sama sekali;
nominal yang sudah masuk tetap terbaca di kolom sisa hutang dan di halaman detailnya. *Jatuh
tempo* menggantikannya: faktur yang masih bersisa dan tanggalnya sudah lewat. Faktur lunas tidak
pernah berstatus jatuh tempo walau dibayarnya terlambat.

Karena jatuh tempo kini salah satu status, saringan terpisah "Hanya yang jatuh tempo" di daftar
Tagihan Vendor dibuang, dan badge "Lewat jatuh tempo" di halaman detail ikut hilang — keduanya
mengulang hal yang sama.

Faktur bisa dibatalkan selama belum ada pembayaran dan belum ada retur. Qty-nya kembali
terbuka untuk difaktur ulang, dan status PO ikut mundur.

### 8.2 Payment Request
Dibuat Accounting, disetujui Building Manager. **Tidak membentuk jurnal.**

Dua jenis: **DP** (dari PO/SPK, lampirkan invoice proforma) dan **pelunasan** (dari satu atau
beberapa faktur vendor yang sama, dengan alokasi nominal per faktur).

Dibuat di **halaman penuh** `#pembelian/pr/new`, pola sama dengan form Catat Faktur: dokumen
sumbernya dipilih di dalam halaman, tiga langkah — **Sumber Pembayaran → Nominal → Data
Pengajuan**.

Langkah 1 memilih jalur (pelunasan faktur atau uang muka), lalu **vendornya**, baru dokumennya.
Untuk pelunasan vendornya **bisa lebih dari satu** (MultiSelect); tabel di bawahnya lalu memuat
faktur terbuka milik vendor-vendor itu, dan tinggal dicentang mana saja yang dibayar. Uang muka
selalu satu vendor dan satu PO/SPK, karena uang mukanya milik satu pesanan.

Tabel fakturnya menyebut **vendor**, jatuh tempo, **status** (*Belum dibayar* / *Jatuh tempo*),
dan sisa hutang per faktur. Melepas satu vendor dari pilihan ikut membuang fakturnya dari
centang — kalau tidak, ada faktur tercentang yang tidak terlihat di tabel mana pun tapi tetap
ikut ditagihkan.

Satu transfer tetap hanya bisa ke satu rekening. Jadi PR lintas vendor menerbitkan **satu
Payment Voucher per vendor**, masing-masing sebesar subtotal vendor itu — langkah 3 menampilkan
rekening tujuan dan subtotalnya per vendor, dan memberi tahu berapa PV yang akan terbit.

Langkah 2 menampilkan **nominal per faktur**: sisa hutang, berapa yang dibayar sekarang (bisa
sebagian), dan sisa setelah PR ini — dengan pintasan *Bayar penuh* dan *Kosongkan*. Pita di kaki
form menjumlahkannya jadi **Total diajukan**. Langkah 3 memuat rekening tujuan, berkas, dan
catatan; invoice proforma wajib untuk uang muka.

Tanggal pengajuan **bukan isian**: PR lahir saat tombol *Ajukan* diklik, jadi tanggalnya dicap
saat itu juga. Membiarkannya diketik berarti membolehkan pengajuan dibelakang-tanggalkan, dan
batas waktu approval pun ikut bisa digeser.

**Status:** `Menunggu approval → Siap diterbitkan PV → PV terbit → Dibayar`, plus `Ditolak`.

### 8.3 Payment Voucher, pembayaran, dan jurnal

Sesudah faktur, rantainya lima tahap:

| | Tahap | Dokumen / jejak | Peran |
|---|---|---|---|
| 1 | Buat Payment Request | PR | Accounting |
| 2 | Approval | PR *disetujui* | Building Manager |
| 3 | **Terbitkan Payment Voucher** | PV *belum dibayar* | Finance |
| 4 | **Catat pembayaran** | PV *dibayar* + jurnal kas keluar | Finance |

Jurnal kas keluar **terposting otomatis** saat pembayaran dicatat, bukan tahap tersendiri: uang
keluar dan pencatatannya satu peristiwa, dan memisahkannya hanya menyisakan keadaan "sudah
dibayar tapi belum dijurnal" yang gampang terlupa.

Tahap 3 dan 4 **dipisah**. PV adalah perintah bayar: terbit lebih dulu, baru uangnya keluar.
Sebelumnya PV terbit bersamaan dengan transfer, sehingga tidak ada dokumen perintah bayar yang
mendahului kas keluar, dan "siapa memerintahkan" tidak terbedakan dari "siapa mentransfer".

**PV saat terbit (tahap 3)** memuat rekening tujuan, rekening sumber, tanggal PV, dan catatan.
Kas belum berkurang. **Saat pembayaran dicatat (tahap 4)** barulah ada tanggal bayar, nomor
referensi transfer, dan bukti transfer; PR menjadi *Dibayar* dan faktur terkait menjadi *Lunas*
atau *Dibayar sebagian*. Tanggal bayar tidak boleh mendahului tanggal PV.

**Status PV:** `Belum dibayar → Dibayar`. PV lama berstatus `dijurnal`, dan PV lama tanpa kolom
status sama sekali, sama-sama dibaca sebagai *Dibayar* — data lama tidak berubah artinya.
`pvJournalDate()` memakai `journalPostedAt` bila ada, kalau tidak jatuh ke tanggal bayarnya.

**Jurnal kas keluar** dibentuk `src/pages/Pembelian/journal.js`, mengikuti pola modul
Penjualan: fungsi murni, dibentuk ulang tiap kali dibaca, tidak disimpan — belum ada buku besar.
Yang disimpan di dokumen hanya `journalPostedAt` dan siapa yang memposting. Akun dicari lewat
namanya di `DaftarAkun/accounts.js`, bukan ditulis ulang kodenya di modul ini.

| PV | Debit | Kredit |
|---|---|---|
| Uang muka | Uang Muka Pembelian | Kas dan Setara Kas |
| Pelunasan | Hutang Usaha | Kas dan Setara Kas |

Jurnalnya hanya menyebut akun. Rekening banknya — mis. *BCA 288-123-9001 · Kas Operasional* —
bukan akun buku besar dan sudah tertera di kartu Informasi pembayaran, jadi tidak diulang.

Kartu **Jurnal Transaksi** di halaman PV memuat ringkasannya dan tombol *Lihat detail* yang
membuka halaman `#pembelian/pv/<id>/jurnal`: tabel berlajur **Kode akun · Nama akun · Debit ·
Kredit** dengan baris total, ditambah dokumen sumber, tanggal jurnal, vendor, PR dasarnya,
rekening sumber, dan siapa yang membukukan.

> **Cakupannya baru PV.** FPB, BAPP, dan faktur juga berjurnal, tapi aturan akunnya ada di
> `docs/Spesifikasi-Jurnal-Pembelian.pdf` yang belum terbaca — lihat bagian 9.

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
| Pilih jalur pengadaan | 7 hari | Setujui BAPP | 5 hari |
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
| BAPP | Beban / Aset | Hutang Belum Ditagih |
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
BAPP atau potongan di faktur. Barang yang ditolak sebelum difaktur cukup dicatat di FPB; sisa
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
