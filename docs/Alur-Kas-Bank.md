# Alur Kas & Bank — Dashboard Jurnal

Repo: https://github.com/ProgrammerMuda/Web-Jurnal-Proapps · Commit acuan: `594c64c`
Disusun: 16 November 2026

> **Status: rancangan, belum ada kodenya.** Berbeda dengan `docs/Alur-Pembelian.md` yang
> mencatat perilaku yang sudah berjalan, dokumen ini menetapkan perilaku yang **akan**
> dibangun. Yang sudah ada di repo hari ini hanya: menu `Kas & Bank` di sidebar tanpa halaman
> (`src/components/layout/Sidebar.jsx`) dan daftar akun bertanda `bankCash: true` di
> `src/pages/DaftarAkun/accounts.js`.

Cakupan tahap ini: **akun kas & bank, buku mutasi, dan kas kecil**. Rekonsiliasi bank
(pencocokan dengan rekening koran) sengaja ditunda — bagian 11 mencatat apa yang sudah
disiapkan untuk itu.

---

## 1. Alur ringkas

```
Akun Kas & Bank                  Accounting — master, mengikuti COA
   ↓
┌─ Penerimaan (BKM)              Finance — kas/bank masuk
├─ Pengeluaran (BKK)             Finance — kas/bank keluar
├─ Transfer (BTR)                Finance — antar akun sendiri
└─ Mutasi tarikan                otomatis dari Pembelian & Penjualan
   ↓ posting
Buku mutasi + saldo berjalan     terbentuk jurnal

Kas Kecil (imprest)
   Pengisian (PKK)               Finance, plafon per akun
   ↓
   Voucher kas kecil (VKK)       Pemegang kas kecil — pengeluaran kecil harian
   ↓ pertanggungjawaban
   Pengisian ulang sebesar yang terpakai
   ↓
   Opname (BAO)                  Accounting — hitung fisik, catat selisih
```

**Empat aturan pokok:**

1. Satu akun kas/bank = satu akun COA bertanda `bankCash`. Kas & Bank tidak punya daftar
   akun sendiri yang terpisah dari Daftar Akun.
2. Mutasi yang lahir dari modul lain (Payment Voucher pembelian, pembayaran penjualan)
   **tidak bisa diedit atau dihapus** dari Kas & Bank — koreksinya di modul asal.
3. Mutasi yang sudah diposting tidak bisa dihapus. Koreksi lewat pembatalan (void) yang
   membentuk jurnal balik.
4. Kas kecil memakai sistem **imprest**: plafon tetap, pengisian ulang persis sebesar yang
   dipertanggungjawabkan.

---

## 2. Peran

Memakai enam peran yang sudah ada (`roles` di `src/pages/Pembelian/data.js`).

| Peran | Membuat | Menyetujui |
|---|---|---|
| **Finance** | Penerimaan, pengeluaran, transfer, pengisian kas kecil | — |
| **Accounting** | Akun kas & bank, saldo awal, opname, jurnal penyesuaian kas | — |
| **Building Manager** | — | Pengeluaran di atas ambang, pengisian kas kecil, selisih opname |
| **Peminta** | Voucher kas kecil (sebagai pemegang/pengguna kas kecil) | — |
| **Gudang / PIC Jasa** | — | — |
| **Superadmin** | semuanya | semuanya |

**Pemisahan tugas yang dijaga:**

- Pembuat pengeluaran ≠ penyetujunya
- Pemegang kas kecil ≠ pelaksana opname
- Finance memegang mutasi, Accounting memegang master akun dan koreksi jurnal

Semua pengecekan hak akses masuk ke satu berkas, `src/pages/KasBank/permissions.js`, mengikuti
pola modul Pembelian. Layar tidak membandingkan string peran langsung.

---

## 3. Akun Kas & Bank

Master akun kas, bank, dan dompet digital. **Sumber kebenarannya tetap Daftar Akun** — sebuah
akun muncul di Kas & Bank bila `bankCash: true` dan kategorinya `Kas & Bank`. Halaman ini
menambahkan data yang tidak relevan untuk COA umum.

**Kolom tambahan per akun:**

| Kolom | Isi |
|---|---|
| `kind` | `kas` · `bank` · `ewallet` · `ayat-silang` |
| `bankName`, `accountNo`, `accountName` | Hanya untuk `kind: bank` / `ewallet` |
| `currency` | `IDR` (satu mata uang dulu) |
| `openingBalance`, `openingDate` | Saldo awal periode |
| `isPettyCash`, `pettyLimit`, `holder` | Hanya untuk kas kecil |
| `active` | Akun nonaktif tidak bisa dipilih di transaksi baru, riwayatnya tetap terbaca |

**Akun yang sudah ada di seed** (`src/pages/DaftarAkun/accounts.js`):

| Kode | Nama | Rencana `kind` |
|---|---|---|
| 1-10000 | Kas dan Setara Kas | induk (bukan akun transaksi) |
| 1-10001 | Kas Kecil Badan Pengelola | kas · kas kecil |
| 1-10002 | Kas Kecil Kasir | kas · kas kecil |
| 1-10003 | Bank Mandiri A/C …. | bank |
| 1-10004 | BCA A/C …. | bank |
| 1-10005 | Midtrans …. | ewallet |
| 1-10099 | Ayat Silang Bank | ayat-silang |
| 1-10133 | Bank OCBC | bank |
| 1-10134 | Bank BTN | bank |

`1-10000` berperan sebagai induk (`parent: null`, anak-anaknya menunjuk ke sana) sehingga
**tidak boleh dipakai bertransaksi** — kalau dipakai, saldonya dihitung ganda terhadap
anak-anaknya.

**Saldo** = saldo awal + seluruh mutasi yang sudah diposting sampai tanggal tertentu. Tidak
disimpan sebagai angka tunggal, dihitung dari mutasi — pola yang sama dengan status PO di modul
Pembelian. Kolom `balance` di `accounts.js` hanya dipakai sebagai saldo awal.

**Kartu akun** menampilkan: saldo kini, saldo tersedia (saldo kini − mutasi draf), mutasi
30 hari terakhir, dan tombol transaksi cepat.

---

## 4. Buku mutasi

Satu entitas transaksi dengan empat jenis. Semuanya menyimpan `lines` agar lawan akunnya bisa
lebih dari satu.

| Jenis | Dokumen | Arah | Lawan akun |
|---|---|---|---|
| Penerimaan | `BKM/2026/11/0001` | masuk | Pendapatan, piutang, uang muka, titipan |
| Pengeluaran | `BKK/2026/11/0001` | keluar | Beban, hutang, uang muka, titipan |
| Transfer | `BTR/2026/11/0001` | pindah | Akun kas/bank lain |
| Penyesuaian | `ADJ/2026/11/0001` | ± | Selisih kas, biaya admin bank, jasa giro |

Penomoran mengikuti pola modul Pembelian: `PREFIX/tahun/bulan/urut 4 digit`, urut per jenis
per bulan.

**Isi transaksi:** tanggal, akun kas/bank, pihak (kontak — opsional), nomor referensi
(no. transfer / no. cek / no. bilyet giro), catatan, lampiran bukti, dan baris-baris
lawan akun berisi akun COA, nominal, tag, dan keterangan.

**Wajib untuk bisa diposting:** tanggal, akun kas/bank aktif, minimal satu baris dengan akun
dan nominal > 0, serta total baris = nominal transaksi.

**Status:** `Draf → Diposting`, plus `Dibatalkan`.

- *Draf* — belum membentuk jurnal, belum memengaruhi saldo, masih bisa diedit dan dihapus
- *Diposting* — jurnal terbentuk, saldo berubah, tidak bisa diedit
- *Dibatalkan* — hanya untuk yang sudah diposting; membentuk jurnal balik bertanggal
  tanggal pembatalan, dokumen aslinya tetap tersimpan dan terbaca

**Ambang persetujuan.** Pengeluaran (BKK) di atas ambang perlu persetujuan Building Manager
sebelum bisa diposting. Ambang awal **Rp 5.000.000**, disimpan di `RULES` dan nantinya pindah
ke menu Pengaturan. Penerimaan dan transfer tidak perlu persetujuan.

**Tanggal mundur** diperbolehkan selama periodenya belum ditutup. Periode tertutup menolak
posting — syarat ini sudah ditetapkan di `docs/Alur-Pembelian.md` bagian 9 dan berlaku sama
di sini.

---

## 5. Mutasi yang ditarik dari modul lain

Dua modul sudah menghasilkan pergerakan kas. Keduanya **sumber**, bukan tujuan: Kas & Bank
menampilkannya, tidak membuatnya.

| Asal | Dokumen | Jadi mutasi |
|---|---|---|
| Pembelian | Payment Voucher (`PV/...`) | Pengeluaran, otomatis diposting |
| Penjualan | Pembayaran faktur | Penerimaan, otomatis diposting |

Mutasi tarikan ditandai `source: { module, docId, number }`. Di layar ia tampil dengan nomor
dokumen aslinya (bukan BKM/BKK baru) dan tautan ke dokumen itu; tombol edit, hapus, dan
batalkan tidak muncul.

**Yang perlu dirapikan di modul asal.** Payment Voucher menyimpan rekening sumber sebagai teks
bebas (`source: 'BCA 288-123-9001 · Kas Operasional'` di `vouchersSeed`), bukan kode akun.
Sebelum tarikan ini bisa jalan, kolom itu harus menjadi kode akun kas/bank. Pembayaran
penjualan sudah memilih akun lewat dropdown (`PaymentModal.jsx`) — perlu dipastikan nilainya
kode akun, bukan label.

---

## 6. Transfer antar akun

Satu dokumen, dua sisi: akun asal berkurang, akun tujuan bertambah, nominal sama.

**Biaya transfer** dicatat sebagai baris terpisah ke akun beban administrasi bank, dibebankan
ke akun asal. Jadi akun asal berkurang sebesar nominal + biaya, akun tujuan bertambah sebesar
nominal.

**Ayat silang (1-10099)** dipakai bila uang keluar dan masuk tidak pada tanggal yang sama —
misalnya setoran tunai yang baru muncul di rekening koran keesokan harinya. Pola dua langkah:

| Langkah | Debit | Kredit |
|---|---|---|
| 1. Uang keluar dari kas | Ayat Silang Bank | Kas |
| 2. Uang masuk ke bank | Bank | Ayat Silang Bank |

Saldo ayat silang yang tidak nol di akhir periode berarti ada langkah kedua yang belum dicatat
— ini dijadikan **peringatan di halaman ringkasan**, bukan sekadar baris saldo.

---

## 7. Kas kecil

Sistem **imprest**: tiap kas kecil punya plafon tetap, dan pengisian ulang selalu persis
sebesar yang sudah dibelanjakan sehingga saldo kembali ke plafon.

```
Plafon Rp 5.000.000
   ↓ pengisian awal (PKK)                saldo 5.000.000
   ↓ voucher kas kecil (VKK) 1.250.000   saldo 3.750.000
   ↓ voucher kas kecil (VKK)   900.000   saldo 2.850.000
   ↓ pertanggungjawaban 2.150.000
   ↓ pengisian ulang (PKK) 2.150.000     saldo 5.000.000
```

### 7.1 Pengisian (PKK)
Dibuat Finance, disetujui Building Manager. Memindahkan uang dari bank/kas besar ke akun kas
kecil — secara jurnal identik dengan transfer, tapi dokumennya terpisah agar riwayat
pengisian mudah ditelusuri.

Nominal pengisian ulang default = plafon − saldo kini, dan **tidak boleh melebihi** angka itu.
Sistem mengingatkan bila saldo turun di bawah **30% plafon**.

### 7.2 Voucher kas kecil (VKK)
Dibuat pemegang kas kecil untuk pengeluaran kecil harian.

**Isi:** tanggal, penerima, keperluan, akun beban, nominal, lampiran struk/nota.

**Batas nominal per voucher: Rp 1.000.000.** Di atas itu harus lewat alur Pembelian (permintaan
→ pengadaan → PO → faktur → PV), bukan kas kecil. Batas ini menutup celah memecah satu
pembelian besar menjadi banyak voucher kecil, jadi sistem juga menandai beberapa voucher
dengan penerima dan keperluan sama dalam 7 hari yang totalnya melewati batas.

**Status:** `Draf → Diposting`, plus `Dibatalkan`. Voucher membentuk jurnal saat diposting
(beban bertambah, kas kecil berkurang) — tidak menunggu pengisian ulang.

### 7.3 Opname kas (BAO)
Dibuat Accounting. Mencatat hitungan fisik per pecahan uang, dibandingkan dengan saldo buku.

Selisih dicatat ke akun **Selisih Kas** lewat transaksi penyesuaian (`ADJ`), wajib diisi
alasannya, dan perlu persetujuan Building Manager. Selisih tidak boleh dibiarkan menggantung
sampai periode berikutnya.

---

## 8. Jurnal

Mengikuti syarat teknis yang sama dengan modul Pembelian: idempoten, tanpa hapus, selalu
seimbang, menolak periode tertutup, tiap baris bisa ditelusuri ke dokumen asalnya.

| Dokumen | Debit | Kredit |
|---|---|---|
| Penerimaan (BKM) | Kas/Bank | Akun lawan (pendapatan / piutang / titipan) |
| Pengeluaran (BKK) | Akun lawan (beban / hutang / uang muka) | Kas/Bank |
| Transfer (BTR) | Kas/Bank tujuan, Beban adm. bank | Kas/Bank asal |
| Transfer via ayat silang | Ayat Silang Bank → lalu Kas/Bank tujuan | Kas/Bank asal → lalu Ayat Silang Bank |
| Pengisian kas kecil (PKK) | Kas Kecil | Bank / Kas besar |
| Voucher kas kecil (VKK) | Beban | Kas Kecil |
| Penyesuaian (ADJ) — kas kurang | Selisih Kas | Kas/Bank |
| Penyesuaian (ADJ) — kas lebih | Kas/Bank | Selisih Kas |
| Pembatalan | kebalikan dokumen asal | kebalikan dokumen asal |

Draf, pengajuan persetujuan, dan opname yang nihil selisih **tidak** membentuk jurnal.

---

## 9. Status layar

Tiga halaman di bawah menu Kas & Bank, mengikuti pola submenu modul Pembelian
(`pembelian:overview`, dst.).

| Kunci menu | Halaman | Isi |
|---|---|---|
| `kasbank:accounts` | Akun Kas & Bank | Daftar akun + saldo, kartu per akun, buku besar per akun |
| `kasbank:mutations` | Mutasi Kas & Bank | Semua mutasi lintas akun, filter jenis/akun/tanggal/status |
| `kasbank:petty` | Kas Kecil | Saldo vs plafon per kas kecil, voucher, pengisian, opname |

Menu `Akun Kas & Bank` dan `Kas Kecil` sudah ada di sidebar tanpa `key`; `Mutasi` perlu
ditambahkan.

---

## 10. Peta berkas (rencana)

| Berkas | Isi |
|---|---|
| `src/pages/KasBank/KasBank.jsx` | Shell halaman + tab |
| `src/pages/KasBank/routes.js` | Pemetaan hash → tab dan judul header |
| `src/pages/KasBank/data.js` | Data contoh, `RULES` (ambang approval, plafon, batas VKK) |
| `src/pages/KasBank/utils.js` | Saldo, penomoran, validasi, pembentuk jurnal. Fungsi murni |
| `src/pages/KasBank/permissions.js` | Hak akses dan pemisahan tugas |
| `src/pages/KasBank/selectors.js` | "Perlu tindakan" per peran, ringkasan saldo, peringatan |
| `src/lib/store.jsx` | State `kb` + localStorage key `proapps.kasbank.v1` |

**Ambang yang akan dikunci di kode** (`RULES` di `data.js`), semuanya calon pindah ke
Pengaturan: ambang persetujuan pengeluaran Rp 5 juta, batas voucher kas kecil Rp 1 juta,
ambang peringatan kas kecil 30% plafon, jendela deteksi pemecahan 7 hari.

**Kompatibilitas data tersimpan** mengikuti pola `loadPb()`/`mergeVendors()` yang sudah ada:
state tersimpan digabung dengan seed saat dimuat agar koleksi baru tidak merusak data lama.

---

## 11. Di luar cakupan tahap ini

Dicatat supaya struktur datanya tidak menutup pintu:

- **Rekonsiliasi bank.** Tiap mutasi menyimpan `reconciled: false` dan `statementRef: null`
  sejak awal, sehingga layar rekonsiliasi nanti tidak perlu migrasi data.
- **Multi mata uang.** `currency` ada di akun tapi dikunci `IDR`.
- **Giro/cek mundur.** Perlu status antara (*diserahkan → cair*) yang belum ada di sini.
- **Anggaran kas / proyeksi arus kas.** Menu `Perencanaan Anggaran` di sidebar, modul terpisah.
- **Mesin jurnal.** Belum ada di aplikasi mana pun. Tabel bagian 8 adalah spesifikasi untuk
  mesin itu, bukan sesuatu yang sudah jalan.
