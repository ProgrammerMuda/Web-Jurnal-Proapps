# Backlog Modul Kas & Bank — Dashboard Jurnal

Repo: https://github.com/ProgrammerMuda/Web-Jurnal-Proapps
Commit acuan: `594c64c`
Disusun: 16 November 2026
Acuan perilaku: `docs/Alur-Kas-Bank.md`

Modulnya **belum ada sama sekali** — yang tersedia hanya menu sidebar tanpa halaman dan akun
bertanda `bankCash: true` di `src/pages/DaftarAkun/accounts.js`. Jadi backlog ini urutan
pembangunan, bukan daftar perbaikan.

Prioritas: **P0** = fondasi, tanpa ini yang lain tidak bisa jalan · **P1** = cakupan yang
disepakati tahap ini (akun + mutasi + kas kecil) · **P2** = penyempurnaan · **P3** = tahap
berikutnya.

Urutan kerja yang disarankan: EPIC 1 → 2 → 3 → 4 → 5, lalu P2 menyusul.

---

## EPIC 1 — Fondasi data dan navigasi (P0)

### KB-001 · State, seed, dan localStorage
**Prioritas:** P0

Tambah state `kb` di `src/lib/store.jsx` dengan key `proapps.kasbank.v1`, mengikuti pola
`loadPb()` yang sudah ada: seed digabung dengan data tersimpan agar koleksi baru tidak merusak
state lama.

Koleksi: `cashAccounts` (data tambahan per akun COA), `txns` (mutasi), `pettyVouchers`,
`replenishments`, `opnames`.

**Acceptance criteria**
- [ ] `kb` tersimpan dan terbaca ulang setelah halaman dimuat ulang
- [ ] Data tersimpan versi lama yang belum punya koleksi baru tetap bisa dibuka
- [ ] Seed berisi minimal: saldo awal untuk 1-10003 (Mandiri), 1-10004 (BCA), 1-10001 dan
      1-10002 (kas kecil), serta ±15 mutasi contoh tersebar 3 bulan terakhir
- [ ] Akun induk 1-10000 ditandai tidak bisa bertransaksi

**Berkas:** `src/lib/store.jsx`, `src/pages/KasBank/data.js`

---

### KB-002 · Shell halaman, rute hash, dan submenu sidebar
**Prioritas:** P0

Halaman `KasBank.jsx` dengan tiga tab, rute hash seperti modul Pembelian
(`src/pages/Pembelian/routes.js`), dan `key` pada submenu sidebar yang sekarang masih kosong.

**Acceptance criteria**
- [ ] `kasbank:accounts`, `kasbank:mutations`, `kasbank:petty` bisa dibuka dari sidebar
- [ ] Menu `Mutasi Kas & Bank` ditambahkan di antara dua submenu yang sudah ada
- [ ] Judul header dan menu aktif mengikuti hash (pola `pembelianNavKey`/`pembelianTitle`)
- [ ] Tombol back/forward browser berpindah tab dengan benar
- [ ] Rute detail dokumen (`#kasbank/txn/<id>`) bisa dibuka langsung dari URL

**Berkas:** `src/app/App.jsx`, `src/components/layout/Sidebar.jsx`,
`src/pages/KasBank/KasBank.jsx`, `src/pages/KasBank/routes.js`

---

### KB-003 · `utils.js` — saldo, penomoran, validasi
**Prioritas:** P0

Fungsi murni, tidak menyentuh state, mengikuti disiplin `src/pages/Pembelian/utils.js`.

**Acceptance criteria**
- [ ] `balanceOf(accountCode, asOfDate)` = saldo awal + mutasi diposting sampai tanggal itu
- [ ] Mutasi draf dan dibatalkan tidak ikut dihitung
- [ ] `nextNumber(kind, date, txns)` menghasilkan `BKM/2026/11/0001` dan urut per jenis per bulan
- [ ] `validateTxn()` menolak: akun nonaktif, akun induk 1-10000, tanggal kosong,
      baris tanpa akun, nominal ≤ 0, dan total baris ≠ nominal transaksi
- [ ] Saldo akun induk = jumlah saldo anak-anaknya, tidak dihitung ganda

**Berkas:** `src/pages/KasBank/utils.js`

---

### KB-004 · `permissions.js` — hak akses dan pemisahan tugas
**Prioritas:** P0

**Acceptance criteria**
- [ ] Finance membuat mutasi; Accounting mengelola master akun, saldo awal, dan opname
- [ ] Pengeluaran > Rp 5.000.000 tidak bisa diposting tanpa persetujuan Building Manager
- [ ] Pembuat pengeluaran tidak bisa menyetujui pengeluarannya sendiri — dicek di tingkat
      **orang** (`createdBy`), bukan peran, sama seperti modul Pembelian
- [ ] Pemegang kas kecil tidak bisa menjadi pelaksana opname kas kecilnya sendiri
- [ ] Superadmin melewati semua pembatasan
- [ ] Tidak ada perbandingan string peran di luar berkas ini

**Berkas:** `src/pages/KasBank/permissions.js`

---

## EPIC 2 — Akun Kas & Bank (P1)

### KB-005 · Daftar akun + kartu saldo
**Prioritas:** P1

**Acceptance criteria**
- [ ] Menampilkan semua akun `bankCash: true` dari `accounts.js`, dikelompokkan per `kind`
- [ ] Tiap kartu: nama, no. rekening, saldo kini, saldo tersedia (dikurangi mutasi draf)
- [ ] Total saldo seluruh kas & bank di atas daftar
- [ ] Akun nonaktif tampil di bagian terpisah dan tidak bisa dipilih di transaksi baru
- [ ] Akun ayat silang bersaldo ≠ 0 memunculkan peringatan dengan tautan ke mutasinya

**Berkas:** `src/pages/KasBank/Accounts.jsx`

---

### KB-006 · Form data rekening + saldo awal
**Prioritas:** P1

Melengkapi akun COA dengan data perbankan. Tidak membuat akun COA baru dari sini — kalau akun
belum ada, pengguna diarahkan ke Daftar Akun.

**Acceptance criteria**
- [ ] Isi: `kind`, nama bank, no. rekening, nama pemilik, saldo awal, tanggal saldo awal, aktif
- [ ] Kas kecil: `isPettyCash`, plafon, pemegang
- [ ] Hanya Accounting (dan Superadmin) yang bisa mengubah saldo awal
- [ ] Saldo awal tidak bisa diubah bila sudah ada mutasi diposting sebelum tanggalnya,
      kecuali lewat jurnal penyesuaian
- [ ] Nomor rekening ditampilkan tersamar kecuali saat diedit

**Berkas:** `src/pages/KasBank/AccountForm.jsx`

---

### KB-007 · Buku besar per akun
**Prioritas:** P1

**Acceptance criteria**
- [ ] Kolom: tanggal, nomor, jenis, keterangan, pihak, masuk, keluar, saldo berjalan
- [ ] Saldo berjalan dihitung berurutan dari saldo awal, bukan dari kolom tersimpan
- [ ] Filter rentang tanggal, jenis, dan status
- [ ] Baris mutasi tarikan menampilkan nomor dokumen asal dan tertaut ke modul asalnya
- [ ] Ekspor CSV

**Berkas:** `src/pages/KasBank/AccountLedger.jsx`

---

## EPIC 3 — Mutasi (P1)

### KB-008 · Form penerimaan dan pengeluaran
**Prioritas:** P1

Satu form, dua arah, baris lawan akun bisa lebih dari satu.

**Acceptance criteria**
- [ ] Isi: tanggal, akun kas/bank, pihak (opsional, dari Kontak), no. referensi, catatan,
      lampiran, dan baris lawan akun (akun, keterangan, nominal)
- [ ] Nominal transaksi = jumlah baris; selisih diblokir dengan pesan jelas
- [ ] Pemilih akun lawan tidak menampilkan akun `bankCash` — itu urusan transfer
- [ ] Simpan sebagai draf, atau langsung posting bila berhak
- [ ] Pengeluaran di atas ambang masuk status menunggu persetujuan, bukan langsung diposting
- [ ] Nomor dokumen terbit saat posting, bukan saat draf dibuat

**Berkas:** `src/pages/KasBank/TxnForm.jsx`

---

### KB-009 · Daftar mutasi lintas akun
**Prioritas:** P1

**Acceptance criteria**
- [ ] Filter: jenis, akun, rentang tanggal, status, pencarian nomor/keterangan/pihak
- [ ] Ringkasan atas: total masuk, total keluar, arus bersih untuk filter aktif
- [ ] Penanda visual untuk mutasi tarikan dari modul lain
- [ ] Urutan default: tanggal terbaru, lalu nomor

**Berkas:** `src/pages/KasBank/Mutations.jsx`

---

### KB-010 · Posting, persetujuan, dan pembatalan
**Prioritas:** P1

**Acceptance criteria**
- [ ] Posting mengunci dokumen: tidak bisa diedit lagi
- [ ] Pembatalan hanya untuk yang sudah diposting, wajib isi alasan, membentuk jurnal balik
      bertanggal tanggal pembatalan
- [ ] Dokumen dibatalkan tetap tersimpan dan terbaca, bertanda jelas, tidak dihitung di saldo
- [ ] Mutasi tarikan tidak punya tombol edit, hapus, maupun batalkan
- [ ] Draf bisa dihapus permanen; diposting tidak pernah bisa dihapus
- [ ] Posting ke periode tertutup ditolak (siapkan kaitnya walau penutupan periode belum ada)

**Berkas:** `src/pages/KasBank/utils.js`, `src/pages/KasBank/TxnDetail.jsx`

---

### KB-011 · Transfer antar akun + ayat silang
**Prioritas:** P1

**Acceptance criteria**
- [ ] Akun asal ≠ akun tujuan
- [ ] Nominal tidak boleh melebihi saldo tersedia akun asal — peringatan, bukan blokir keras
- [ ] Biaya transfer sebagai baris terpisah ke akun beban administrasi bank, membebani akun asal
- [ ] Saklar **transfer dua langkah** memakai akun Ayat Silang Bank (1-10099) bila tanggal
      keluar dan masuk berbeda
- [ ] Langkah kedua yang belum dicatat muncul sebagai "perlu tindakan" bagi Finance
- [ ] Satu dokumen transfer tampil di buku besar kedua akun dengan arah yang benar

**Berkas:** `src/pages/KasBank/TransferForm.jsx`

---

## EPIC 4 — Kas kecil (P1)

### KB-012 · Halaman kas kecil
**Prioritas:** P1

**Acceptance criteria**
- [ ] Per kas kecil: saldo kini, plafon, terpakai, meteran saldo terhadap plafon
- [ ] Peringatan bila saldo < 30% plafon, dengan tombol buat pengisian
- [ ] Daftar voucher periode berjalan dan riwayat pengisian

**Berkas:** `src/pages/KasBank/PettyCash.jsx`

---

### KB-013 · Voucher kas kecil (VKK)
**Prioritas:** P1

**Acceptance criteria**
- [ ] Isi: tanggal, penerima, keperluan, akun beban, nominal, lampiran struk
- [ ] Nominal > Rp 1.000.000 ditolak, dengan pesan yang mengarahkan ke alur Pembelian
- [ ] Nominal melebihi saldo kas kecil ditolak
- [ ] Voucher membentuk jurnal saat diposting, tidak menunggu pengisian ulang
- [ ] Beberapa voucher dengan penerima + keperluan sama dalam 7 hari yang totalnya melewati
      batas ditandai sebagai dugaan pemecahan pembelian

**Berkas:** `src/pages/KasBank/PettyVoucherForm.jsx`

---

### KB-014 · Pengisian kas kecil (PKK)
**Prioritas:** P1

**Acceptance criteria**
- [ ] Nominal default = plafon − saldo kini, dan tidak boleh melebihi angka itu
- [ ] Wajib pilih akun sumber (bank atau kas besar)
- [ ] Perlu persetujuan Building Manager sebelum diposting
- [ ] Setelah diposting, saldo kas kecil kembali ke plafon
- [ ] Rekap voucher yang dipertanggungjawabkan tercetak di dokumen pengisian

**Berkas:** `src/pages/KasBank/ReplenishForm.jsx`

---

### KB-015 · Opname kas (BAO)
**Prioritas:** P1

**Acceptance criteria**
- [ ] Input hitungan fisik per pecahan (100.000 … 100), total terhitung otomatis
- [ ] Menampilkan saldo buku dan selisihnya
- [ ] Selisih ≠ 0 wajib isi alasan dan membentuk transaksi penyesuaian ke akun Selisih Kas
- [ ] Penyesuaian selisih perlu persetujuan Building Manager
- [ ] Pelaksana opname tidak boleh pemegang kas kecil itu sendiri
- [ ] Riwayat opname tersimpan dan bisa dibuka ulang

**Berkas:** `src/pages/KasBank/OpnameForm.jsx`

---

## EPIC 5 — Sambungan ke modul lain (P1)

### KB-016 · Rekening sumber Payment Voucher jadi kode akun
**Prioritas:** P1 · **Prasyarat KB-017**

`vouchersSeed` menyimpan rekening sumber sebagai teks bebas
(`'BCA 288-123-9001 · Kas Operasional'`). Harus menjadi kode akun kas/bank.

**Acceptance criteria**
- [ ] Form Payment Voucher memilih akun dari daftar akun `bankCash` yang aktif
- [ ] Voucher menyimpan `sourceAccount` berupa kode akun; `source` lama tetap ditampilkan
      untuk data tersimpan yang belum punya kode
- [ ] Data tersimpan versi lama tidak rusak

**Berkas:** `src/pages/Pembelian/data.js`, `src/pages/Pembelian/VoucherDetail.jsx`

---

### KB-017 · Tarikan mutasi dari Pembelian dan Penjualan
**Prioritas:** P1

**Acceptance criteria**
- [ ] Payment Voucher muncul sebagai pengeluaran di buku besar akun sumbernya
- [ ] Pembayaran faktur penjualan muncul sebagai penerimaan di akun setornya
- [ ] Mutasi tarikan ditandai `source: { module, docId, number }` dan read-only
- [ ] Mengklik baris membuka dokumen aslinya
- [ ] Membatalkan dokumen di modul asal menghilangkannya dari saldo Kas & Bank

**Berkas:** `src/pages/KasBank/selectors.js`

---

### KB-018 · Ringkasan kas di halaman Ringkasan
**Prioritas:** P2

**Acceptance criteria**
- [ ] Kartu total saldo kas & bank dengan rincian per akun
- [ ] Arus masuk/keluar bulan berjalan
- [ ] Tautan ke halaman Kas & Bank

**Berkas:** `src/pages/Ringkasan/Ringkasan.jsx`

---

## P2 — Penyempurnaan

### KB-019 · "Perlu tindakan" per peran
Daftar tindakan tertunda: pengeluaran menunggu persetujuan (BM), langkah kedua ayat silang
belum dicatat (Finance), kas kecil di bawah ambang (Finance), selisih opname belum disetujui
(BM). Mengikuti pola `selectors.js` modul Pembelian.

### KB-020 · Cetak bukti kas (PDF)
Bukti kas masuk/keluar dan voucher kas kecil dalam PDF, memakai pembuat PDF tanpa pustaka luar
yang sudah ada (`src/pages/Pembelian/pdf.js`).

### KB-021 · Transaksi berulang
Template untuk pengeluaran rutin (biaya admin bank, langganan) yang bisa dibuat ulang dengan
satu klik.

### KB-022 · Tag transaksi
Mengaitkan mutasi ke tag (gedung, unit, proyek) agar laporan bisa dipotong per dimensi. Menu
`Tag Transaksi` sudah ada di Pengaturan sidebar.

### KB-023 · Ambang pindah ke Pengaturan
`RULES` (ambang persetujuan, batas VKK, ambang kas kecil, jendela deteksi pemecahan) bisa
diatur dari menu Pengaturan, bukan dikunci di kode. Masalah yang sama dengan modul Pembelian.

---

## P3 — Tahap berikutnya

### KB-024 · Rekonsiliasi bank
Impor/paste rekening koran, cocokkan otomatis berdasarkan tanggal + nominal + referensi,
tandai `reconciled`, laporan rekonsiliasi dengan daftar item yang belum cocok.
Kolom `reconciled` dan `statementRef` sudah disiapkan sejak KB-001.

### KB-025 · Giro dan cek mundur
Status antara *diserahkan → cair/ditolak*, dengan akun penampung sendiri.

### KB-026 · Mesin jurnal
Belum ada di aplikasi mana pun. Tabel jurnal di `docs/Alur-Kas-Bank.md` bagian 8 dan
`docs/Spesifikasi-Jurnal-Pembelian.pdf` adalah spesifikasinya. Syarat: idempoten, tanpa hapus,
selalu seimbang, menolak periode tertutup, tiap baris tertelusur ke dokumen asal.

### KB-027 · Penutupan periode
Mengunci tanggal agar posting mundur ditolak. Dibutuhkan Kas & Bank maupun Pembelian.
