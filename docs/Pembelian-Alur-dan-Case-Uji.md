# Modul Pembelian: Alur dan Case Uji

Untuk: **Riski** dan **Aldi**
Kondisi per: 25 Nov 2026 (prototipe front-end, branch `main`)

Dokumen ini menjelaskan modul Pembelian **sebagaimana yang sudah berjalan sekarang**: urutan
dokumen, siapa mengerjakan apa, aturan yang dijaga sistem, jurnal yang terbentuk, lalu **case uji
per flow** yang bisa langsung dicoba di aplikasi.

> `docs/Alur-Pembelian.md` adalah spesifikasi lama untuk backend. Beberapa bagiannya sudah tidak
> berlaku (mis. FPB dulu langsung terkonfirmasi, satu PR dulu hanya satu vendor, belum ada
> retensi). Kalau ada yang bertentangan, **ikuti dokumen ini**.

---

## 0. Cara menjalankan dan menguji

- Data tersimpan di `localStorage` browser (key `proapps.pembelian.v21`), belum ada backend.
  Tombol **Reset data contoh** di kaki halaman Pembelian mengembalikan data awal.
- **Ganti peran** lewat dropdown **Lihat sebagai** di kaki halaman (Peminta, Accounting,
  Gudang, Chief Finance, Building Manager, Finance, Superadmin). Semua tombol dan tugas
  menyesuaikan peran yang aktif.
- Tanggal "hari ini" prototipe dikunci **4 Nov 2026**. Jam di log approval memakai jam asli
  saat tombol diklik.
- Setiap tombol **Setujui / Verifikasi** memunculkan modal konfirmasi dulu. Setiap **Tolak /
  Kembalikan** membuka modal yang mewajibkan alasan.

---

## 1. Alur ringkas

```
Permintaan (FPPBJ)            Peminta
   ↓ verifikasi                Accounting
Pengadaan                      Accounting: pilih jalur (bidding / vendor tunggal), isi penawaran
   ↓ approval 2 jenjang        Chief Finance → Building Manager
PO (barang) / SPK (jasa)       terbit otomatis, satu per vendor pemenang
   ↓ kirim ke vendor           Accounting
   ├─ [kalau termin ada DP]    Faktur uang muka → PR → PV
   ↓
Penerimaan                     Gudang
   ├─ FPB  (barang)            approval 2 jenjang: Chief Finance → Building Manager
   └─ BAPP (jasa)              approval 2 jenjang: Chief Finance → Building Manager
   ↓
Faktur pembelian (Tagihan)     Accounting: harga & qty otomatis dari PO + FPB/BAPP
   ↓
Payment Request (PR)           Accounting: boleh beberapa faktur, boleh beberapa vendor
   ↓ approval 2 jenjang        Chief Finance → Building Manager
Payment Voucher (PV)           Finance: terbit SATU PV PER VENDOR
   ↓ catat pembayaran          Finance: per PV, jurnal kas keluar terposting
Selesai
   └─ [kalau ada retensi]      Masa pemeliharaan → BAST akhir → Lepas retensi → PR → PV
```

**Aturan pokok yang dijaga sistem**

1. Tidak ada PO/SPK tanpa pengadaan yang disetujui penuh (2 tanda tangan).
2. Tidak ada faktur tanpa penerimaan (FPB/BAPP) yang sudah disetujui penuh. Pengecualian:
   faktur uang muka, yang ditagih langsung dari PO/SPK.
3. Tidak ada PV tanpa PR yang sudah disetujui penuh.
4. Pembuat dokumen tidak boleh menyetujui dokumennya sendiri (pemisahan tugas). Pengecualian:
   Superadmin.

---

## 2. Peran

| Peran | Membuat | Menyetujui / memverifikasi |
|---|---|---|
| **Peminta** | Permintaan (FPPBJ) | — |
| **Accounting** | Penawaran, pengadaan, PO/SPK, kirim ke vendor, faktur, PR, lepas retensi, retur | Verifikasi permintaan |
| **Gudang** | FPB (barang), BAPP (jasa), retur | — |
| **Chief Finance** | — | Pengadaan, FPB/BAPP, PR: **tanda tangan ke-1**. Pembatalan uang muka (sendirian). |
| **Building Manager** | — | Pengadaan, FPB/BAPP, PR: **tanda tangan ke-2** |
| **Finance** | Payment Voucher, catat pembayaran | — |
| **Superadmin** | Semua | Semua slot (tercatat "sebagai <peran>") |

Approval selalu **berurutan**: Building Manager baru bisa menyetujui setelah Chief Finance.
Tombolnya berbunyi *Setujui (1/2)* lalu *Setujui (2/2)*. Dokumen baru berubah status setelah
tanda tangan **kedua**.

---

## 3. Status dokumen

| Dokumen | Status |
|---|---|
| Permintaan | Draf → Menunggu verifikasi → Menunggu pengadaan → Dalam pengadaan → Selesai · (Dikembalikan, Dibatalkan) |
| Pengadaan | Draf → Menunggu approval → Disetujui · (Ditolak) |
| PO / SPK | Draf → Dikirim ke vendor → Diterima sebagian → Diterima penuh → **Masa pemeliharaan** → Selesai · (Dibatalkan, Ditutup) |
| FPB / BAPP | Menunggu approval → Dikonfirmasi · (Ditolak → diajukan ulang / Dibatalkan) |
| Faktur | Belum dibayar → Jatuh tempo → Lunas · (Dibatalkan) |
| Payment Request | Menunggu approval → Menunggu PV → **Menunggu pembayaran** → Dibayar · (Ditolak) |
| Payment Voucher | Belum dibayar → Dibayar |

"Masa pemeliharaan" = semua termin sudah difaktur dan dibayar, tapi retensinya masih ditahan.
"PV terbit" pada PR = minimal satu PV sudah terbit, dan **belum semua** PV-nya dibayar.

---

## 4. Syarat pembayaran (termin)

Dipilih saat pengadaan dan ikut ke PO/SPK. Daftarnya bisa diatur di pengaturan syarat
pembayaran.

| Kode | Nama | Untuk | Cara tagih |
|---|---|---|---|
| `cad` | CAD: bayar setelah diterima | Barang | Satu faktur setelah FPB |
| `dp-30` | DP + pelunasan | Barang | Faktur uang muka dulu, sisanya setelah FPB (dipotong DP) |
| `cbd` | CBD: bayar sebelum kirim | Barang | Faktur di muka 100% dari PO |
| `net-30` | Bayar penuh di akhir | Jasa | Satu faktur setelah BAPP, tempo 30 hari |
| `progres-3` | Termin progres | Jasa | Satu BAPP + faktur per termin (mis. 3 termin) |
| `dp-progres` | DP + termin progres | Jasa | Faktur uang muka, lalu tiap termin dipotong DP proporsional |
| `retensi-5` / `retensi-10` | Termin progres + retensi | Jasa | Tiap termin menahan retensi 5% / 10% |
| `penuh-retensi` | Bayar penuh di akhir + retensi | Jasa | Satu faktur, retensi ditahan |
| `dp-progres-retensi` | DP + termin progres + retensi | Jasa | Gabungan DP dan retensi |
| `bulanan-12` | Berkala per periode | Jasa | BAPP per periode, baru bisa dicatat setelah periodenya lewat |

Jatuh tempo dihitung dari **tanggal penerimaan** atau **tanggal faktur vendor**, sesuai
pengaturan termin.

---

## 5. Jurnal yang terbentuk

Akun utama: `2-10150` Barang Diterima Belum Ditagih, `2-10200` Hutang Lainnya (dipakai sebagai
hutang usaha), `2-10160` Hutang Retensi, `1-10407` PPN Masukan, Hutang PPh Pasal 23, Uang Muka
Pembelian, akun bank sesuai rekening sumber.

| Peristiwa | Debit | Kredit |
|---|---|---|
| FPB barang (stok dilacak) | Persediaan | Barang Diterima Belum Ditagih |
| BAPP jasa / barang tidak dilacak | Beban (akun produknya) | Barang Diterima Belum Ditagih |
| Faktur dari penerimaan | Belum Ditagih (DPP), PPN Masukan | Hutang PPh*, Hutang Retensi*, Uang Muka* (potongan DP), **Hutang Lainnya** |
| Faktur uang muka | Uang Muka Pembelian (DPP), PPN Masukan | Hutang PPh*, Hutang Lainnya |
| Lepas retensi | Hutang Retensi | Hutang PPh*, Hutang Lainnya |
| **Payment Voucher dibayar** | Hutang Lainnya, **satu baris per faktur** | **Akun bank yang dipilih** |

\* hanya muncul kalau nilainya ada.

Rekening sumber PV dan akunnya:

| Dibayar dari | Akun yang dikredit |
|---|---|
| BCA 288-123-9001 · Kas Operasional | 1-10004 BCA A/C |
| Mandiri 101-00-5577 · Kas Proyek | 1-10003 Bank Mandiri A/C |
| Kas kecil | 1-10001 Kas Kecil Badan Pengelola |

Selisih harga faktur terhadap penerimaan dibukukan terbuka ke akun selisih, tidak diserap diam-diam.

---

## 6. Case uji per flow

Format: **ID · Judul**, lalu peran, langkah, dan hasil yang diharapkan. Angka contoh memakai
data contoh bawaan bila ada.

### A. Permintaan (FPPBJ) dan verifikasi

**A1 · Ajukan permintaan**
- Peran: Peminta
- Langkah: Buat baru → Buat Permintaan → isi barang/jasa, tanggal dibutuhkan → Ajukan.
- Harapan: status *Diajukan*; muncul tugas "Verifikasi permintaan" di dashboard Accounting;
  log approval mencatat "Diajukan oleh <nama>" beserta jam.

**A2 · Verifikasi**
- Peran: Accounting
- Langkah: buka permintaan → Verifikasi.
- Harapan: muncul **modal konfirmasi** ("Verifikasi FPPBJ/…?"). Batal = tidak ada yang berubah.
  Ya = status *Diverifikasi*, tercatat di log.

**A3 · Kembalikan permintaan**
- Peran: Accounting
- Langkah: buka permintaan → Kembalikan → isi alasan.
- Harapan: alasan wajib diisi; status *Dikembalikan*; Peminta mendapat tugas "Permintaan
  dikembalikan" dengan alasannya; Peminta bisa revisi dan mengajukan ulang.

**A4 · Pemisahan tugas**
- Langkah: orang yang sama dengan pembuat permintaan mencoba memverifikasi.
- Harapan: tombol verifikasi tidak tersedia (kecuali Superadmin).

### B. Pengadaan

**B1 · Jalur bidding**
- Peran: Accounting
- Langkah: dari permintaan terverifikasi → pilih jalur **Bidding** → isi penawaran 2–3 vendor
  (ongkir & diskon opsional) → pilih pemenang → Ajukan.
- Harapan: tidak bisa diajukan sebelum jumlah penawaran minimum terpenuhi; status *Menunggu
  approval*; tugas muncul di dashboard Chief Finance.

**B2 · Jalur vendor tunggal**
- Langkah: pilih **Vendor tunggal** → isi 1 penawaran dan alasan → Ajukan.
- Harapan: cukup 1 penawaran.

**B3 · Approval 2 jenjang**
- Peran: Chief Finance, lalu Building Manager
- Langkah: Setujui (1/2) → konfirmasi; ganti peran → Setujui (2/2) → konfirmasi.
- Harapan:
  - Setelah tanda tangan ke-1: modal menyebut "Approval 1 dari 2. Setelah ini menunggu Building
    Manager"; status masih *Menunggu approval*; PO belum terbit.
  - Building Manager **tidak** bisa menyetujui sebelum Chief Finance.
  - Setelah tanda tangan ke-2: modal menyebut "approval terakhir"; PO/SPK terbit otomatis,
    **satu per vendor pemenang**.

**B4 · Tolak pengadaan**
- Langkah: Tolak → isi alasan.
- Harapan: alasan wajib; status *Ditolak*; Accounting mendapat tugas "Revisi pengadaan
  (ditolak)"; bisa diperbaiki lalu diajukan ulang.

### C. PO / SPK

**C1 · Kirim ke vendor**
- Peran: Accounting
- Langkah: buka PO draf → Kirim ke vendor → konfirmasi.
- Harapan: status *Dikirim ke vendor*; tanggal kirim pertama dipertahankan walau dikirim ulang;
  tugas "Kirim ke vendor" hilang.

**C2 · Unduh PDF PO/SPK**
- Harapan: PDF memuat item, termin, dan nilai yang sama dengan layar.

### D. Penerimaan (FPB / BAPP)

**D1 · Catat FPB barang**
- Peran: Gudang
- Langkah: dari PO terkirim → Catat penerimaan → isi qty diterima (boleh sebagian), no. surat
  jalan → Simpan.
- Harapan: status *Menunggu approval*; PO jadi *Diterima sebagian / penuh*; tugas approval
  muncul di Chief Finance. **Belum** bisa difaktur.

**D2 · Approval FPB/BAPP**
- Peran: Chief Finance → Building Manager
- Harapan: tiap klik Setujui ada modal konfirmasi. Setelah tanda tangan ke-2: status
  *Dikonfirmasi*, jurnal penerimaan terbentuk (lihat bagian 5), stok masuk (barang), dan
  penerimaan **baru bisa difaktur**.

**D3 · Tolak lalu ajukan ulang**
- Langkah: approver Tolak dengan alasan → Gudang membuka FPB → **Ajukan ulang** (boleh ubah qty).
- Harapan: tanda tangan lama dihapus, approval mulai lagi dari Chief Finance; riwayat tolak dan
  ajukan ulang tetap ada di log.

**D4 · Tolak lalu batalkan**
- Langkah: Gudang membuka FPB yang ditolak → **Batalkan FPB**.
- Harapan: status *Dibatalkan*; qty-nya kembali jadi "belum diterima" di PO.

**D5 · BAPP termin progres**
- Langkah: SPK `progres-3` → catat BAPP termin 1 saja.
- Harapan: termin 2 baru bisa dipilih setelah termin 1 diterima (berurutan). Beberapa termin
  yang selesai bersamaan boleh dicentang dalam satu BAPP.

**D6 · BAPP termin berkala (kunci periode)**
- Langkah: SPK `bulanan-12` → coba catat BAPP periode yang belum lewat.
- Harapan: periode yang belum berakhir terkunci dan tidak bisa dicentang.

### E. Faktur (Tagihan Vendor)

**E1 · Faktur dari penerimaan: harga otomatis**
- Peran: Accounting
- Langkah: Buat Tagihan Vendor → Dari penerimaan → pilih vendor dan FPB/BAPP → isi no. invoice
  vendor, tanggal, unggah invoice & faktur pajak → Rincian item.
- Harapan: qty dan harga **terisi otomatis** dari PO dan penerimaan, tidak perlu diketik.
  Qty tidak bisa melebihi yang diterima.

**E2 · Cek total dengan invoice vendor (opsional)**
- Langkah: di langkah 3, isi kolom "Cek dengan invoice vendor (opsional)".
- Harapan: angka sama → "Cocok dengan invoice vendor". Beda → "Selisih Rp …" beserta arah
  selisihnya. Dikosongkan pun faktur tetap bisa disimpan.

**E3 · Contoh angka (data contoh)**

| Faktur | Asal | DPP | PPN 11% | Hutang |
|---|---|---|---|---|
| FKT/2026/11/0003 | PO/2026/11/0002 (barang, CAD) | 3.350.000 | 368.500 | **3.718.500** |
| FKT/2026/11/0004 | SPK/2026/11/0001 (jasa, bayar di akhir) | 8.400.000 | 924.000 | **9.324.000** |
| FKT/2026/11/0005 | SPK/2026/11/0004 (termin 1 dari 3) | 6.493.500 | 714.285 | **7.207.785** |

Jurnal FKT/2026/11/0005:

| Akun | Debit | Kredit |
|---|---|---|
| 2-10150 Barang Diterima Belum Ditagih | 6.493.500 | |
| 1-10407 PPN Masukan | 714.285 | |
| 2-10200 Hutang Lainnya | | 7.207.785 |

**E4 · Penerimaan yang belum disetujui**
- Harapan: FPB/BAPP yang masih *Menunggu approval* tidak muncul di pilihan sumber faktur.

**E5 · Jatuh tempo**
- Harapan: dihitung otomatis dari termin (mis. tempo 30 hari dari tanggal penerimaan).
  Faktur yang lewat tempo berstatus *Jatuh tempo* dan masuk umur hutang.

### F. Uang muka (DP)

**F1 · Faktur uang muka**
- Langkah: PO `dp-30` terkirim → Buat Tagihan Vendor → Dari PO/SPK → pilih PO bertanda uang muka.
- Harapan: DPP uang muka, PPN, dan PPh terisi dari PO. Jurnal: Dr Uang Muka Pembelian + PPN
  Masukan / Cr Hutang PPh + Hutang Lainnya.

**F2 · Faktur pelunasan dipotong DP**
- Harapan: faktur pelunasan menampilkan "Potongan uang muka"; PPN hanya atas (nilai − potongan
  DP); jurnalnya Cr Uang Muka sebesar potongan.

**F3 · Faktur pelunasan tertahan**
- Harapan: selama uang muka belum difaktur/dibayar, faktur pelunasan tertahan dan tugas
  terkait naik prioritas di dashboard.

**F4 · Batalkan uang muka**
- Langkah: Accounting mengajukan pembatalan DP dengan alasan → Chief Finance menyetujui.
- Harapan: cukup 1 approval (Chief Finance); seluruh nilai ditagih di faktur pelunasan.

### G. Retensi

Contoh dari spesifikasi jurnal retensi: kontrak Rp1 M, DP 20%, termin 30/40/30, retensi 5%,
PPh 2,65%.

| Dokumen | DPP | Potong DP | PPN | Retensi | PPh | Hutang Lainnya |
|---|---|---|---|---|---|---|
| Faktur uang muka | 200.000.000 | — | 22.000.000 | — | 5.300.000 | 216.700.000 |
| Termin 1 (30%) | 300.000.000 | 60.000.000 | 26.400.000 | 15.000.000 | 5.962.500 | 245.437.500 |
| Termin 2 (40%) | 400.000.000 | 80.000.000 | 35.200.000 | 20.000.000 | 7.950.000 | 327.250.000 |
| Termin 3 (30%) | 300.000.000 | 60.000.000 | 26.400.000 | 15.000.000 | 5.962.500 | 245.437.500 |
| Lepas retensi | — | — | — | 50.000.000 | 1.325.000 | 48.675.000 |

PPh termin = tarif × (DPP − potongan DP − retensi). PPN tidak ditagih lagi saat retensi
dilepas karena sudah ikut di faktur termin.

**G1 · Retensi ditahan di tiap termin**
- Harapan: faktur termin punya baris "Retensi x% ditahan"; jurnal Cr Hutang Retensi.

**G2 · Diberi tahu saat termin terakhir lunas**
- Langkah: Finance membayar PV untuk termin terakhir.
- Harapan: di detail PV muncul info "Termin … lunas, retensi Rp … masih ditahan" beserta
  tanggal bisa dilepas; status PO jadi *Masa pemeliharaan*.

**G3 · Dipantau selama masa pemeliharaan**
- Harapan:
  - Ringkasan Pembelian: kartu **Retensi ditahan** (total + hitung mundur per SPK).
  - Hutang Usaha: tabel **Hutang Retensi** (tidak ikut total hutang usaha).
  - Daftar Pesanan: filter status *Masa pemeliharaan*.
  - Detail PO/SPK: bagian Retensi hanya info (saldo, tanggal bisa dilepas), **tanpa** tombol.

**G4 · Pengingat H-30**
- Harapan: 30 hari sebelum masa pemeliharaan selesai, tugas "Minta BAST akhir" muncul di
  Accounting (barang: "Minta berita acara akhir garansi").

**G5 · Lepas retensi**
- Langkah: hari H → tugas **Lepas retensi** → tombol *Lepas* (atau Buat baru → Lepas Retensi) →
  isi No. BAST akhir, tanggal, unggah berkas → Lepas retensi.
- Harapan: sebelum masa pemeliharaan selesai, tanggalnya ditolak. Terbentuk dokumen pelepasan
  yang masuk Tagihan Vendor dan bisa dibuatkan PR seperti faktur biasa. Jurnal: Dr Hutang
  Retensi / Cr Hutang PPh + Hutang Lainnya. Setelah dibayar, PO jadi *Selesai*.

### H. Payment Request dan Payment Voucher

**H1 · PR satu faktur**
- Peran: Accounting → Chief Finance → Building Manager → Finance
- Langkah: Buat Pembayaran → pilih faktur → Ajukan → approval 2 jenjang → Terbitkan PV → Catat
  pembayaran (tanggal, no. referensi transfer, bukti transfer).
- Harapan: status PR berjalan *Menunggu approval → Menunggu PV → Menunggu pembayaran → Dibayar*;
  faktur jadi *Lunas*.

**H2 · PR beberapa faktur, satu vendor**
- Harapan: terbit **1 PV**. Jurnal PV punya **satu baris debit per faktur**.

**H3 · PR beberapa faktur, beberapa vendor (data contoh: PR/2026/11/0003)**
- Isi: FKT/0003 + FKT/0005 (PT Alfa Sejahtera) dan FKT/0004 (CV Delta Elektronik), total
  Rp 20.250.285.
- Harapan:
  - Detail PR: Vendor "2 vendor"; Rekening tujuan dua-duanya; Ringkasan memecah per vendor
    (Alfa Rp 10.926.285, Delta Rp 9.324.000); tabel faktur punya kolom Vendor.
  - Terbitkan PV → terbit **2 PV**, satu per vendor, ke rekening masing-masing.
  - Detail PR punya section **Payment Voucher** (nomor, vendor + rekening, dibayar dari, status,
    nominal).
  - Daftar Pembayaran: kolom Vendor "2 vendor", kolom Payment Voucher menampilkan kedua PV
    dengan statusnya; menu aksi punya "Catat pembayaran PV/… (vendor)" per PV.
  - Bayar PV Alfa saja → PR **tetap** *PV terbit*, notifikasi menyebut PV yang masih menunggu.
  - Bayar PV Delta → PR jadi *Dibayar*.

Jurnal PV Alfa (dibayar dari BCA):

| Akun | Debit | Kredit | Keterangan |
|---|---|---|---|
| 2-10200 Hutang Lainnya | 3.718.500 | | Pelunasan FKT/2026/11/0003 |
| 2-10200 Hutang Lainnya | 7.207.785 | | Pelunasan FKT/2026/11/0005 |
| 1-10004 BCA A/C | | 10.926.285 | Dibayar dari BCA 288-123-9001 |

**H4 · Rekening sumber menentukan akun kredit**
- Langkah: saat Terbitkan PV, ganti "Dibayar dari".
- Harapan: keterangan di bawahnya berubah "Dijurnal ke 1-1000x …"; jurnal PV mengkredit akun itu.

**H5 · Rekening vendor kosong**
- Harapan: kalau salah satu vendor di PR belum punya rekening di data kontak, PV tidak bisa
  diterbitkan dan pesan menyebut vendor mana.

**H6 · Tolak PR**
- Harapan: alasan wajib; status *Ditolak*; faktur kembali bisa diajukan.

**H7 · Pemisahan tugas PR**
- Harapan: pembuat PR tidak bisa menyetujui PR-nya sendiri (kecuali Superadmin).

### I. Retur pembelian

**I1 · Retur dari faktur barang**
- Peran: Gudang / Accounting
- Langkah: Buat Retur Pembelian → pilih faktur barang → isi qty dan alasan → pilih penyelesaian.
- Harapan: hanya faktur barang yang bisa diretur. Barang yang ditolak **sebelum** difaktur
  cukup dicatat di FPB, bukan lewat retur.

### J. Log approval dan konfirmasi

**J1 · Modal konfirmasi**
- Harapan: setiap Setujui / Verifikasi (detail dokumen maupun menu titik tiga di daftar)
  memunculkan modal dulu. Isinya: approval ke berapa, siapa berikutnya, atau apa yang terjadi
  di approval terakhir. Batal = tidak ada perubahan.

**J2 · Log approval**
- Harapan: kartu Log approval menampilkan urutan langkah (Selesai / Menunggu / Ditolak /
  Belum) dan Riwayat terbaru di atas: aksi, nama, peran, tanggal **dan jam**, serta alasan
  bila ditolak. Superadmin tercatat "sebagai <peran>". Dokumen lama tanpa jam tertulis
  "jam tidak tercatat".

### K. Dashboard dan laporan

**K1 · Perlu tindakan**
- Harapan: tiap peran hanya melihat tugasnya; yang lewat batas wajar (SLA) naik ke atas dan
  berwarna merah. Angka di sidebar = jumlah tugas per menu.

**K2 · Laporan Hutang Usaha**
- Harapan: sisa hutang per vendor menurut umur jatuh tempo, rincian faktur, ekspor Excel, dan
  tabel Hutang Retensi terpisah.

---

## 7. Batas waktu wajar (SLA) tugas

| Tahap | Batas |
|---|---|
| Permintaan diajukan → diverifikasi | 14 hari |
| Diverifikasi → jalur pengadaan dipilih | 7 hari |
| Jalur dipilih → penawaran lengkap & diajukan | 14 hari |
| Pengadaan diajukan → disetujui | 7 hari |
| Pengadaan disetujui → PO/SPK dibuat | 3 hari |
| PO dibuat → dikirim ke vendor | 3 hari |
| FPB/BAPP dicatat → disetujui | 5 hari |
| Penerimaan dikonfirmasi → faktur dicatat | 7 hari |
| PO dengan uang muka → PR diajukan | 5 hari |
| PR diajukan → disetujui | 5 hari |
| PR disetujui → PV terbit | 2 hari |

---

## 8. Catatan terbuka

- Akun hutang usaha masih memakai `2-10200 Hutang Lainnya` (bawaan modul Gudang). Bagan akun
  belum punya akun "Hutang Usaha" umum; perlu dikonfirmasi ke tim akuntansi.
- Nama akun bank di bagan akun masih placeholder (mis. "BCA A/C …..") karena disalin apa
  adanya dari produksi.
- Tugas retensi yang belum terlambat bisa tertimbun di bawah 8 tugas teratas di Ringkasan;
  angka di sidebar tetap menghitungnya.
- Belum ada backend: semua data di `localStorage` per browser.
