# Backlog Modul Pembelian — Dashboard Jurnal

Repo: https://github.com/ProgrammerMuda/Web-Jurnal-Proapps
Commit acuan: `594c64c`
Disusun: 12 November 2026

Status aplikasi saat ini adalah **prototipe front-end**. Semua data disimpan di
`localStorage` (key `proapps.pembelian.v1`), belum ada backend, dan **belum ada mesin jurnal
sama sekali** — panel "Jurnal kas keluar" di halaman Payment Voucher masih bertanda contoh.
Banyak item di bawah ini bergantung pada dua hal itu.

Prioritas: **P0** = bug yang membuat angka salah, kerjakan dulu · **P1** = fitur inti yang belum
lengkap · **P2** = penyempurnaan · **P3** = cakupan spesifikasi yang belum disentuh.

---

## EPIC 1 — Perbaikan perhitungan uang muka (P0)

Tiga bug ini membuat nominal yang dibayar ke vendor salah. Dua yang pertama satu akar masalah.

### PB-001 · Uang muka terpotong dua kali pada termin "DP + termin progres"
**Prioritas:** P0 · **Estimasi:** ±15 baris

Saat SPK dibuat, item dipecah menjadi baris-baris termin yang nilainya **sudah dikurangi uang
muka** (lihat `expandSchedule` di `src/pages/Pembelian/utils.js`). Nilai kontrak asli tidak
disimpan di mana pun. Akibatnya `poTotal()` membaca nilai yang sudah dipotong, lalu
`poDpAmount()` menghitung uang muka dari angka itu — jadi DP terpotong dua kali.

**Langkah reproduksi**
1. Buat permintaan jasa, upload penawaran dengan termin **DP + termin progres**
2. Nilai penawaran Rp 100.000.000, PPN 11%, uang muka 20%, 4 termin
3. Setujui pengadaan sampai SPK terbit, buka detail SPK

**Hasil sekarang vs seharusnya**

| | Sekarang | Seharusnya |
|---|---|---|
| Total SPK | Rp 88.800.000 | Rp 111.000.000 |
| Uang muka | Rp 17.760.000 | Rp 22.200.000 |
| Total diterima vendor | Rp 106.560.000 | Rp 111.000.000 |

Vendor kurang dibayar Rp 4.440.000.

**Acceptance criteria**
- [ ] Nilai kontrak asli (sebelum dipecah jadi termin) tersimpan di dokumen PO/SPK
- [ ] Uang muka dihitung dari nilai kontrak asli, bukan dari total baris jadwal
- [ ] Ringkasan biaya SPK menampilkan **Nilai kontrak** agar cocok dengan nilai penawaran
- [ ] Jumlah seluruh pembayaran (uang muka + semua termin) = nilai kontrak, diuji untuk
      2, 3, 4, dan 7 termin dengan bobot rata maupun tidak rata
- [ ] PO/SPK lama yang sudah tersimpan tidak rusak

**Berkas:** `src/pages/Pembelian/utils.js` (`poDpAmount`, `expandSchedule`, `createPOs`),
`src/pages/Pembelian/PoDetail.jsx`

---

### PB-002 · Uang muka Rp 0 pada "Bayar penuh di muka" dan "Berkala di muka"
**Prioritas:** P0 · **Estimasi:** ±5 baris (satu paket dengan PB-001)

`poDpAmount()` membaca `po.term.dpPct`, padahal kedua tipe termin itu tidak menyimpan `dpPct` —
persentasenya tersirat 100% dari jenis terminnya. Tombol "Buat Payment Request bayar di muka"
muncul, tapi nominal yang terisi nol.

Dampak lanjutan: karena DP-nya nol, faktur tidak terpotong apa pun, sehingga **"Berkala di muka"
berperilaku sama persis dengan "Berkala" biasa** — tiap periode punya PR sendiri, padahal
seharusnya hanya ada satu pembayaran di depan.

**Acceptance criteria**
- [ ] `poDpAmount()` memakai `advancePct(term)`, bukan `term.dpPct` langsung
- [ ] *Bayar penuh di muka*: PR DP = 100% nilai kontrak; faktur setelah BAST berstatus **Lunas**
      tanpa PR baru
- [ ] *Berkala di muka* 12 periode: 1 PR + 1 PV, 12 BAST, 12 faktur yang semuanya **Lunas**

**Berkas:** `src/pages/Pembelian/utils.js` baris 51

---

### PB-003 · Angka DPP salah di form bidding saat harga termasuk PPN atau ada diskon
**Prioritas:** P0 · **Estimasi:** ±5 baris

`vendorTotals()` menghitung `dpp` dengan benar tetapi **tidak mengembalikannya**; yang
dikembalikan `base` (nilai sebelum diskon dan sebelum PPN dikeluarkan). Kartu vendor pemenang
menampilkan `t.base` sebagai "DPP".

Salah ketika: penawaran bertanda *harga sudah termasuk PPN*, atau ada diskon hasil negosiasi.

**Acceptance criteria**
- [ ] `vendorTotals()` mengembalikan `dpp` yang sudah dikali rasio diskon
- [ ] Kartu pemenang memakai `t.dpp`
- [ ] Diuji untuk empat kombinasi: PPN terpisah / termasuk PPN × ada diskon / tanpa diskon
- [ ] DPP + PPN = Total penawaran di semua kombinasi

**Berkas:** `src/pages/Pembelian/utils.js` (`vendorTotals`),
`src/pages/Pembelian/BiddingSheet.jsx` baris 278

---

## EPIC 2 — Retensi (P1)

### PB-010 · Retensi tidak boleh ditagih sebelum masa pemeliharaan selesai
**Prioritas:** P1 · **Estimasi:** sedang

Baris retensi di SPK saat ini bisa di-BAST dan ditagih kapan saja. Tidak ada penjaga tanggal,
jadi uang jaminan bisa cair sebelum masa pemeliharaan lewat.

**Acceptance criteria**
- [ ] Tanggal mulai masa pemeliharaan tercatat (dari BAST termin terakhir)
- [ ] BAST untuk baris retensi ditolak sebelum `tanggal BAST akhir + masa pemeliharaan`
- [ ] Pesan jelas: "Retensi baru bisa ditagih setelah DD MMM YYYY"
- [ ] Building Manager bisa melepas lebih awal, wajib isi alasan, tercatat di dokumen

---

### PB-011 · Jaminan pemeliharaan sebagai pengganti retensi
**Prioritas:** P2 · **Estimasi:** sedang

Di praktiknya vendor sering memilih menyerahkan bank garansi senilai persentase retensi dan
dibayar penuh, alih-alih uangnya ditahan. Belum ada sama sekali.

**Acceptance criteria**
- [ ] Pilihan pada termin: retensi ditahan **atau** jaminan pemeliharaan
- [ ] Jika jaminan: unggah dokumen garansi, catat nomor dan tanggal berakhir
- [ ] Jika jaminan: tidak ada baris retensi di SPK, pembayaran penuh tiap termin
- [ ] Pengingat menjelang jaminan berakhir

---

## EPIC 3 — Termin untuk barang (P1)

### PB-020 · Jadwal pembayaran bertermin untuk PO barang
**Prioritas:** P1 · **Estimasi:** besar

PO barang hanya punya CAD, DP, dan CBD. Pembelian barang bernilai besar di praktiknya pakai
termin — misalnya beli mesin: DP 30%, 60% saat barang tiba, 10% setelah instalasi dan uji coba.

**Catatan desain penting.** Cara yang dipakai untuk jasa **tidak bisa disalin**. Untuk jasa,
termin dipecah menjadi baris item (`Termin 1 dari 4`, qty 1). Baris barang punya qty asli yang
harus dicocokkan saat penerimaan — gudang menerima 10 unit, bukan "termin 1". Jadi untuk barang,
termin harus berupa **jadwal pembayaran terpisah** dari baris item: penerimaan tetap mengikuti
qty, pembayaran mengikuti persentase.

**Keputusan yang perlu diambil sebelum mulai:** untuk mesin yang dibayar 60% saat tiba,
apakah fakturnya dibuat 60% dari nilai PO, atau penuh senilai barang lalu DP dan retensi
menjadi potongan? Jawabannya menentukan seluruh struktur data.

---

## EPIC 4 — Peran dan persetujuan (P2)

Peran saat ini enam: Peminta, Accounting, Building Manager, Gudang / PIC Jasa, Finance,
Superadmin. Semua pengecekan ada di satu berkas: `src/pages/Pembelian/permissions.js`.

### PB-030 · Chief per departemen
**Prioritas:** P2

Penyetuju BAST saat ini selalu Building Manager. Di gedung yang lebih besar, verifikasi teknis
(lift, AC, genset, listrik, plumbing, sipil) ada di Chief Engineering, sedangkan layanan rutin
(cleaning, security, pest control) di chief seksi yang memakainya.

Pernah dibuat lalu dicabut saat peran disederhanakan — lihat riwayat commit kalau perlu acuan.

**Acceptance criteria**
- [ ] Item punya bidang: teknis / layanan / umum
- [ ] Pemetaan departemen → chief, diatur di Pengaturan (butuh PB-050)
- [ ] BAST pekerjaan teknis diarahkan ke Chief Engineering, sisanya ke chief seksi peminta
- [ ] Satu baris teknis sudah cukup mengarahkan seluruh BAST ke Engineering

---

### PB-031 · Ambang nilai untuk persetujuan BAST
**Prioritas:** P2

Servis AC Rp 350.000 dan renovasi Rp 500 juta sama-sama menunggu tanda tangan. Persetujuan
pengadaan sudah berjenjang menurut nilai; BAST belum.

**Acceptance criteria**
- [ ] BAST di bawah ambang langsung terkonfirmasi tanpa persetujuan
- [ ] Ambang diatur di Pengaturan (butuh PB-050)

---

### PB-032 · Opex / capex dan peran Pemilik
**Prioritas:** P2 · **Estimasi:** besar

Khas pengelolaan gedung: belanja operasional diambil dari service charge penghuni dan jadi
kewenangan Building Manager, sedangkan belanja modal adalah beban pemilik dan perlu persetujuan
pemilik berapa pun nilainya. Pada gedung strata title, ada P3SRS yang berwenang atas belanja
besar.

Menyentuh jurnal: capex masuk aset, bukan beban. Sebaiknya dikerjakan setelah EPIC 7.

---

### PB-033 · Log audit untuk Superadmin
**Prioritas:** P2

Superadmin melewati pemisahan tugas — bisa mengajukan PR, menyetujui, dan membayarnya sendiri.
Setiap aksi yang melewati aturan harus tercatat: siapa, kapan, dokumen apa, aturan mana yang
dilewati.

---

## EPIC 5 — Alur dokumen yang belum lengkap (P2)

### PB-040 · Satu Payment Voucher untuk beberapa Payment Request
**Prioritas:** P2 · **Estimasi:** kecil

Struktur data sudah siap (`voucher.prIds` berupa array), tapi layar pembayaran baru menangani
satu PR per transfer. Satu transfer yang menutup DP dan termin 1 sekaligus belum bisa.

**Acceptance criteria**
- [ ] Modal bayar punya pemilih PR (vendor sama, status *Siap dibayar*)
- [ ] Nominal PV = jumlah PR terpilih
- [ ] Semua PR terpilih berubah jadi *Dibayar* dan menunjuk PV yang sama

---

### PB-041 · Retur dibuat dari FPB, bukan dari faktur
**Prioritas:** P2

Spesifikasi menyebut retur dibuat dari FPB, dan perannya Gudang. Di aplikasi, retur masih dibuat
dari faktur, sehingga Accounting tetap diberi akses — kalau perannya dipindah ke Gudang tanpa
memindahkan titik awalnya, fiturnya jadi tidak terjangkau.

**Acceptance criteria**
- [ ] Retur dibuat dari FPB
- [ ] Sebelum faktur: mengurangi Hutang Belum Ditagih
- [ ] Sesudah faktur: menjadi nota debit
- [ ] Hak buat dipindah ke Gudang saja

---

### PB-042 · Halaman detail Retur Pembelian
**Prioritas:** P3 · **Estimasi:** kecil

Retur satu-satunya dokumen yang detailnya masih berupa modal (`DetailModal` di `Dialogs.jsx`).
Permintaan, PO/SPK, penerimaan, faktur, PR, dan PV semuanya sudah punya halaman sendiri.
Setelah ini, `DetailModal` bisa dihapus.

---

### PB-043 · Status "Dikonfirmasi vendor" pada PO
**Prioritas:** P2

Spesifikasi: `TERBIT → DIKIRIM → DIKONFIRMASI_VENDOR → ...`. Status tengah belum ada. Perlu
unggah PO bertanda tangan vendor dan tanggal kirim janji. Tidak dikonfirmasi dalam 3 hari →
pengingat, dan PO bisa dibatalkan untuk memilih pemenang lain.

---

## EPIC 6 — Pengaturan (P1)

### PB-050 · Halaman Pengaturan modul Pembelian
**Prioritas:** P1 · **Estimasi:** sedang

Semua ambang masih dikunci di kode (`RULES` di `src/pages/Pembelian/data.js`). Spesifikasi
menyebut semuanya harus bisa diubah. Beberapa item lain memblokir di sini.

Yang perlu bisa diatur: batas kenaikan pesan ulang tanpa alasan (5%), batas kenaikan wajib
bidding (15%), umur harga acuan (12 bulan), minimal penawaran (2 / 3 dengan ambang Rp 10 juta),
matriks persetujuan pengadaan, batas konfirmasi vendor, toleransi qty penerimaan, saklar skor
bidding, saklar "PR otomatis membuat PV", pelonggaran pemisahan tugas, serta pemetaan
departemen → chief (PB-030) dan ambang BAST (PB-031).

---

## EPIC 7 — Mesin jurnal (P1)

### PB-060 · Pembentukan jurnal otomatis
**Prioritas:** P1 · **Estimasi:** besar

Belum ada sama sekali. Acuan lengkap sudah ada di
`docs/Spesifikasi-Jurnal-Pembelian.pdf` di repo ini — aturan posting, akun yang dipakai,
dan contoh angka per peristiwa.

Dokumen yang membentuk jurnal: PV DP, PV bayar di muka jasa berkala, amortisasi bulanan, FPB,
BAST, faktur, tagihan non-PO, PV pelunasan/retensi, dan retur. FPPBJ, penawaran, bidding,
pesan ulang, PO/SPK, dan PR **tidak** membentuk jurnal.

**Syarat dari spesifikasi:** idempoten, tanpa hapus (koreksi lewat jurnal balik), selalu
seimbang, menolak posting ke periode tertutup, dan tiap baris jurnal bisa ditelusuri ke
dokumen asalnya.

---

### PB-061 · Amortisasi untuk "Berkala di muka"
**Prioritas:** P2 · Bergantung pada PB-060

Sewa gedung tahunan atau langganan software dibayar di depan masuk ke Biaya Dibayar di Muka,
lalu disusutkan per bulan. Satu aturan posting di dalam PB-060, bukan fitur terpisah.

---

## EPIC 8 — Jalur khusus dari spesifikasi (P3)

Belum disentuh sama sekali.

| ID | Item | Catatan |
|---|---|---|
| PB-070 | Tagihan biaya non-PO | Listrik, sewa, langganan. Hanya akun beban. Wajib persetujuan, label `NON_PO`, bisa template berulang |
| PB-071 | Kontrak harga / PO payung | Persetujuan sekali di muka, pesanan dari kontrak tanpa FPPBJ selama harga sama dan sisa nilai cukup |
| PB-072 | PO darurat | Label "Darurat – FPPBJ menyusul", FPPBJ susulan wajib lengkap ≤ 3 hari kerja, PR pelunasan terkunci sampai lengkap |
| PB-073 | Buat PO tanpa FPPBJ (form gabungan) | Satu form, sistem membuat FPPBJ + pengadaan di belakang |
| PB-074 | Petty cash | Batas per transaksi, deteksi pemecahan transaksi |

---

## EPIC 9 — Penyempurnaan kecil (P3)

| ID | Item | Catatan |
|---|---|---|
| PB-080 | Redesain pemilih termin bayar | Satu dropdown 9 opsi dipecah jadi dimensi terpisah: uang muka (tidak ada / sebagian / lunas di muka) + penagihan (sekali / bertahap) + dasar tahapan + saklar retensi. Kombinasi "DP + berkala" saat ini tidak bisa dipilih sama sekali |
| PB-081 | Estimasi harga wajib saat mengajukan | Sekarang opsional dan default Rp 0, sehingga permintaan tanpa estimasi jatuh ke jalur paling longgar: 2 penawaran dan persetujuan tingkat terendah, berapa pun nilai aslinya. Boleh kosong saat simpan draf |
| PB-082 | Email vendor di pemilih vendor | Agar vendor tanpa email ketahuan sebelum PO dikirim |
| PB-083 | Unduh PDF dari baris daftar Pesanan | Sekarang hanya ada di halaman detail |
| PB-084 | PDF untuk dokumen selain PO/SPK | Faktur, PR, PV. Pembuat PDF tanpa pustaka luar sudah ada di `src/pages/Pembelian/pdf.js` |
| PB-085 | Tutup sebagian PO | Sekarang hanya bisa ditutup kalau belum ada penerimaan sama sekali |
| PB-086 | Buka kembali PO yang sudah ditutup | Belum ada |
| PB-087 | Blokir pembatalan PO kalau DP sudah dibayar | Sekarang masih bisa dibatalkan |
| PB-088 | Panel jurnal di halaman penerimaan dan faktur | Setelah PB-060 |
| PB-089 | Statistik vendor dari data nyata | `vendor.stats` masih angka contoh |
| PB-090 | Termin net-15 / net-30 untuk barang | Sekarang jatuh tempo faktur dipatok 30 hari kecuali diatur di penawaran jasa |

---

## Catatan teknis untuk developer

**Tempat yang sering disentuh**

| Berkas | Isi |
|---|---|
| `src/pages/Pembelian/utils.js` | Semua perhitungan. Fungsi murni, tidak menyentuh state |
| `src/pages/Pembelian/permissions.js` | Semua aturan hak akses. Layar tidak membandingkan string peran langsung |
| `src/pages/Pembelian/data.js` | Data contoh, daftar peran, ambang `RULES` |
| `src/lib/store.jsx` | Penyimpanan localStorage dan penggabungan dengan data contoh |

**Kompatibilitas data tersimpan.** State lama digabung dengan data contoh saat dimuat. Vendor
digabung per-record agar kolom baru terisi pada data lama. Peran lama dipetakan ke peran baru
lewat `normalizeRole`. Pola ini harus dipertahankan saat menambah kolom baru — kalau tidak,
data pengguna yang sudah ada akan kehilangan kolomnya.

**Konvensi**
- Komentar kode dalam bahasa Indonesia, menjelaskan **kenapa**, bukan apa
- Warna memakai token tema (`slate.0`, `primary.0`), bukan nilai hex
- Semua nominal format akuntan: `Rp 1.234.000,00`
- Aturan warna status terdokumentasi di komentar `utils.js` di atas `FPPBJ_STATUS`
- Ikon Phosphor duotone lewat `@/components/Icon.jsx`
- Wajib bersih di `npx eslint src` sebelum commit
