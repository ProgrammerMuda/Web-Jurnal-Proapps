# Spesifikasi Laporan Laba Rugi

Dokumen ini menjelaskan fitur **Laba Rugi** (Laporan Laba Rugi / Income Statement / Profit & Loss) seperti yang sudah jadi di prototype Dashboard Jurnal, supaya tim BE dan FE bisa membangunnya di aplikasi produksi. Prototype adalah acuan perilaku dan tampilan; angka di prototype dihitung di browser, sedangkan di produksi hitungannya pindah ke BE.

Bahasa antarmuka: **Indonesia**, huruf kapital hanya di awal kalimat (contoh "Laba kotor", bukan "Laba Kotor"), kecuali nama akun.

| Bagian | Pemilik |
|---|---|
| Aturan hitung (§3), API (§4) | BE |
| Halaman, interaksi, ekspor (§5) | FE |
| Kriteria selesai (§6) | BE + FE, diuji QA |

---

## 1. Tujuan

Menjawab pertanyaan: **"Dalam periode ini, bisnis untung atau rugi berapa, dan dari mana asalnya?"**

- Disajikan untuk **rentang tanggal** (dari s.d. sampai), bukan satu tanggal seperti Neraca.
- Bisa dibandingkan dengan periode lain (kolom pembanding, perubahan, dan %).
- Angkanya dihitung dari **jurnal otomatis semua modul** (Penjualan, Pembelian, Gudang, Kas & Bank, jurnal umum). Tidak ada input manual di laporan ini.
- Setiap akun bisa ditelusuri ke jurnal pembentuknya.
- **Syarat kebenaran:** Laba bersih setelah pajak periode 1 Jan s.d. X = **Laba tahun berjalan** di Neraca per X.

---

## 2. Acuan di prototype

| File | Isi |
|---|---|
| `src/pages/LaporanKeuangan/LabaRugi.jsx` | Halaman: kartu periode, statistik, rasio, toolbar, tabel, ekspor |
| `src/pages/LaporanKeuangan/ledger.js` | `buildLedger` (semua jurnal), `incomeStatement(ledger, from, to)`, `profitBreakdown`, `PL_SECTIONS`, `INCOME_TAX_CODES` |
| `src/pages/LaporanKeuangan/PeriodFilter.jsx` | Filter periode + pembanding yang dipakai bersama semua laporan |
| `src/pages/LaporanKeuangan/StatementParts.jsx` | `Stat`, `Ratio`, `NumCells`, format angka |
| `src/pages/LaporanKeuangan/statementExport.js` | Ekspor PDF / Excel / CSV |
| `docs/Spesifikasi-Laporan-Neraca.md` | Laporan pasangan; Laba Rugi dan Neraca harus cocok (§3.4) |

Rute prototype: `#laporan/laba-rugi`.

---

## 3. Aturan hitung (BE)

### 3.1 Sumber data

- Semua baris jurnal terposting dengan tanggal **dari ≤ tanggal ≤ sampai**. Jurnal draft/batal tidak ikut.
- Hanya akun berkategori laba rugi: Pendapatan, Harga Pokok Penjualan, Beban, Pendapatan Lainnya, Beban Lainnya.
- Nilai dasar per akun = Σ kredit − Σ debit di rentang itu (positif = menambah laba).

### 3.2 Susunan seksi

| Urutan | Seksi | Kategori / akun | Tampil sebagai |
|---|---|---|---|
| 1 | Pendapatan usaha | Pendapatan | kredit − debit |
| 2 | Harga pokok penjualan | Harga Pokok Penjualan | debit − kredit |
| | **Laba kotor** | = 1 − 2 | |
| 3 | Beban operasional | Beban | debit − kredit |
| | **Laba operasional** | = laba kotor − 3 | |
| 4 | Pendapatan lain-lain | Pendapatan Lainnya | kredit − debit |
| 5 | Beban lain-lain | Beban Lainnya, **kecuali** 8-20002 dan 8-20003 | debit − kredit |
| | **Laba sebelum pajak penghasilan** | = laba operasional + 4 − 5 | |
| 6 | Beban pajak penghasilan | 8-20002 Beban Pajak Kini, 8-20003 Beban Pajak Tangguhan | debit − kredit |
| | **Laba bersih setelah pajak** | = laba sebelum pajak − 6 | |

- Akun bersaldo normal debit (HPP, beban, pajak) tampil positif, jadi "Beban gaji 5.000.000", bukan "(5.000.000)". Angka dalam kurung berarti saldonya berlawanan dari normal (mis. retur lebih besar dari penjualan).
- Seksi selalu tampil walau kosong (totalnya "–"), supaya susunan laporan tetap.

### 3.3 Beban pajak penghasilan (PSAK 46)

- Pajak penghasilan badan (pajak kini dan tangguhan) disajikan **sesudah** "Laba sebelum pajak penghasilan", bukan di beban lain-lain. Di Daftar Akun keduanya tetap sub-akun Beban Lainnya; ini hanya penyajian.
- **PPh final** (8-20004 Beban Pajak Final - PPh 4 (2)) dan pajak lain bukan pajak penghasilan menurut PSAK 46, jadi tetap di Beban lain-lain.
- Daftar kode akun pajak penghasilan sebaiknya bisa diatur (konfigurasi), bukan ditulis mati, karena kode bisa beda per perusahaan.

### 3.4 Kecocokan dengan laporan lain

- Laba bersih setelah pajak (1 Jan s.d. X) = Laba tahun berjalan di Neraca per X. Gunakan **fungsi hitung yang sama** (rincian laba per akun) untuk keduanya supaya tidak bisa berbeda.
- Total tiap akun = mutasi akun yang sama di Neraca Saldo / Buku Besar untuk rentang yang sama.
- Laba bersih = titik awal rekonsiliasi metode tidak langsung di Laporan Arus Kas.

### 3.5 Pembulatan

Pembulatan ke 2 desimal; nilai −0 dinormalkan jadi 0.

---

## 4. Usulan API (BE)

Nama dan bentuk boleh disesuaikan dengan konvensi BE; isi datanya yang wajib.

### 4.1 `GET /reports/income-statement`

| Parameter | Wajib | Isi |
|---|---|---|
| `from` | ya | Tanggal mulai `YYYY-MM-DD` |
| `to` | ya | Tanggal akhir `YYYY-MM-DD` |
| `compare_from`, `compare_to` | tidak | Rentang pembanding |

Respons (satu objek per rentang; bila ada pembanding, kirim `current` dan `compare` dengan bentuk sama):

```json
{
  "from": "2026-01-01",
  "to": "2026-11-04",
  "sections": [
    {
      "key": "pendapatan", "label": "Pendapatan usaha", "normal": "credit", "total": 0,
      "accounts": [
        { "code": "4-10001", "name": "Pend. IPL Ruang Apartemen - Town House", "category": "Pendapatan", "balance": 0 }
      ]
    }
  ],
  "totals": {
    "pendapatan": 0, "hpp": 0, "beban": 0, "lain_masuk": 0, "lain_keluar": 0, "pajak": 0,
    "laba_kotor": 0, "laba_operasional": 0, "laba_sebelum_pajak": 0, "laba_bersih": 0
  },
  "journal_count": 64,
  "modules": { "Penjualan": 20, "Pembelian": 30, "Gudang": 14 }
}
```

- `key` seksi: `pendapatan`, `hpp`, `beban`, `lainMasuk`, `lainKeluar`, `pajak` (urutan §3.2).
- `balance` sudah bertanda sesuai cara tampil (§3.2).
- Akun yang ada di salah satu rentang saja tetap dikirim di keduanya dengan nilai 0, atau FE yang menggabungkan; sepakati salah satu.
- Akun bersaldo nol boleh dikirim (FE yang menyembunyikan).

### 4.2 Rincian

Klik akun membuka detail akun dengan rentang periode laporan. Pakai endpoint mutasi akun / Buku Besar yang sudah ada: `GET /accounts/{code}/mutations?from=&to=`.

### 4.3 Ekspor

Ekspor bisa dibuat di FE dari data §4.1 (seperti prototype) atau di BE. Jika di BE: `GET /reports/income-statement/export?format=pdf|xlsx|csv&from=&to=&compare_from=&compare_to=&mode=rinci|ringkas&hide_zero=true|false`. Isi dan bentuk file mengikuti §5.6.

### 4.4 Kinerja

Hitungan memakai agregasi di database per akun (bukan mengambil semua baris jurnal ke aplikasi); respons < 2 detik untuk rentang satu tahun.

---

## 5. Halaman (FE)

Urutan dari atas: tombol kembali → judul dan aksi → kartu periode → kartu statistik → kartu tabel.

### 5.1 Judul dan aksi

- Judul **Laba Rugi**, deskripsi "Pendapatan dikurangi beban dari jurnal Penjualan, Pembelian, dan Gudang. Klik akun untuk melihat jurnal pembentuknya."
- Kanan: tombol ikon **Cetak** (cetak browser; filter/toolbar disembunyikan saat cetak) dan menu **Ekspor** (PDF, Excel, CSV).

### 5.2 Kartu periode

Komponen yang sama dengan Neraca dan laporan lain.

- **Periode**: Bulan ini (default), Bulan lalu, Kuartal ini, Tahun ini, Tahun lalu, Tanggal lain (rentang bebas).
- **Dibandingkan dengan**: Tanpa pembanding (default), Periode sebelumnya, Periode sama tahun lalu, Tanggal lain.
- Periode sebelumnya: pilihan cepat bergeser sebesar satuannya (bulan → bulan sebelumnya, kuartal → 3 bulan, tahun → 12 bulan); rentang bebas memakai rentang sepanjang periode itu, tepat sebelum tanggal mulainya. Rentang bulan penuh tetap jadi bulan penuh (Mar → Feb s.d. 28/29).
- "Dari" setelah "sampai" ditukar untuk hitungan dan isiannya diberi pesan.

### 5.3 Kartu statistik

Baris pertama, empat sel dengan bentuk sama (label, angka singkat, perubahan terhadap pembanding, lalu dua rincian label-angka):

| Sel | Angka | Rincian |
|---|---|---|
| Pendapatan | pendapatan usaha + pendapatan lain-lain | Pendapatan usaha; Pendapatan lain-lain |
| Laba kotor | laba kotor | Pendapatan usaha; Harga pokok penjualan |
| Beban | beban operasional + beban lain-lain | Beban operasional; Beban lain-lain |
| Laba bersih | laba bersih setelah pajak | Laba sebelum pajak; Beban pajak penghasilan |

Perubahan hanya tampil bila ada pembanding: "Naik/Turun Rp… dari periode pembanding" atau "Tetap". Angka minus berwarna merah.

Baris kedua, tiga rasio dengan catatan singkat:

| Rasio | Rumus | Catatan |
|---|---|---|
| Margin kotor | laba kotor ÷ pendapatan usaha | "Sisa pendapatan setelah harga pokok" |
| Margin bersih | laba bersih ÷ (pendapatan usaha + lain-lain) | "Untung dari setiap rupiah pendapatan"; "Bisnis merugi di periode ini" bila laba bersih < 0 |
| Rasio beban | beban operasional ÷ pendapatan usaha | "Bagian pendapatan yang habis untuk beban operasional" |

- Penyebut ≤ 0 → tampil "–" dengan catatan "Belum ada pendapatan di periode ini".
- Rasio di luar ±1.000% dipotong jadi "> 1.000%" / "(> 1.000%)".

### 5.4 Kartu tabel

**Toolbar** (tidak ikut dicetak):
- Kiri: kotak cari "Cari nama atau kode akun…" (saat mencari, tampilan dipaksa Rinci).
- Kanan: switch **Sembunyikan saldo nol** (default aktif; akun disembunyikan bila nol di kedua periode) dan segmented **Rinci / Ringkas**.

**Kepala laporan** di tengah: nama perusahaan, "Laba Rugi", baris periode ("<dari> s.d. <sampai>" + "dibandingkan …" bila ada pembanding).

**Kolom:** Kode | Akun | <label periode> | bila ada pembanding: <label pembanding> | Perubahan | %. Label periode singkat: "Nov 2026", "2026", "1–4 Nov 2026", atau rentang lengkap.

**Baris, mode Rinci:**
- Judul seksi → baris akun (kode, nama akun biru dengan kategori kecil di bawahnya, angka) → "Total <seksi>".
- Baris hasil tebal disisipkan setelah seksinya: **Laba kotor** (setelah HPP), **Laba operasional** (setelah beban operasional), **Laba sebelum pajak penghasilan** (setelah beban lain-lain).
- Baris akhir (grand): **Laba bersih setelah pajak**.
- Saat mencari dan satu seksi tidak punya akun yang cocok: "Tidak ada akun yang cocok dengan pencarian."

**Baris, mode Ringkas:** satu baris total per seksi + baris hasil + Laba bersih setelah pajak.

**Format angka:** tanpa "Rp" (mata uang tertulis di kepala), pemisah ribuan titik, angka dalam kurung dan merah bila berlawanan dari saldo normal, nol ditulis "–". Perubahan = periode − pembanding; % = perubahan ÷ |pembanding|, "–" bila pembanding 0.

**Catatan kaki:** "Dihitung dari N jurnal antara <dari> dan <sampai>: <modul> <jumlah> · …. Angka dalam kurung berarti berlawanan dari saldo normal, tanda – berarti nol." Bila beban pajak penghasilan = 0, tambahkan: "Beban pajak penghasilan (pajak kini dan tangguhan) belum ada di periode ini: biasanya dicatat lewat jurnal penyesuaian akhir periode, jadi laba bersih setelah pajak masih sama dengan laba sebelum pajak."

**Klik akun:** baris atau nama akun membuka halaman detail akun dengan rentang periode laporan (prototype: `#daftar-akun/<kode>?from=<dari>&to=<sampai>`).

**Ponsel (< 768px):** tabel bisa digulir horizontal; kolom pertama digabung supaya nama akun tetap terbaca.

### 5.5 Cetak

Cetak browser hanya menampilkan kepala laporan, tabel, dan catatan kaki.

### 5.6 Ekspor

Isi file mengikuti layar: mode Rinci/Ringkas dan saldo nol ikut, **filter cari diabaikan**. Nama file `laba-rugi-<dari>_<sampai>.<ext>`.

| Format | Isi |
|---|---|
| PDF | A4 portrait, kop biru tua (nama perusahaan, "Laba Rugi", baris periode), tabel dengan header biru, seksi/total/hasil berlatar, Laba bersih setelah pajak sebagai grand total, catatan kaki, "Halaman x dari y". Bisa banyak halaman; header tabel diulang |
| Excel (.xlsx) | Kop 3 baris (merge), header beku, angka sebagai angka dengan format `#,##0.00;[Red](#,##0.00);"-"`, kolom Kode, Akun, periode (+ pembanding, Perubahan, %) |
| CSV | Baris kop, header, satu baris per baris laporan, angka mentah 2 desimal, catatan kaki |

Catatan kaki ekspor: "Dihitung dari N jurnal antara <dari> dan <sampai>. Angka dalam kurung berarti berlawanan dari saldo normal. Diekspor <tanggal hari ini>."

---

## 6. Kriteria selesai

**Hitungan (BE)**
- [ ] Laba bersih setelah pajak 1 Jan s.d. X = Laba tahun berjalan di Neraca per X, untuk X mana pun.
- [ ] Laba kotor, laba operasional, laba sebelum pajak, dan laba bersih sesuai rumus §3.2.
- [ ] 8-20002 dan 8-20003 masuk Beban pajak penghasilan, bukan Beban lain-lain; 8-20004 (PPh final) tetap di Beban lain-lain.
- [ ] Total tiap akun = mutasi akun yang sama di Neraca Saldo / Buku Besar untuk rentang yang sama.
- [ ] Jurnal di luar rentang, draft, dan batal tidak ikut.
- [ ] Pembanding dihitung dengan aturan yang sama untuk rentangnya sendiri.

**Halaman (FE)**
- [ ] Ganti periode/pembanding memperbarui tabel, statistik, rasio, dan kepala laporan.
- [ ] Kolom pembanding, Perubahan, dan % hanya muncul bila ada pembanding.
- [ ] Rinci/Ringkas, saldo nol, dan cari bekerja seperti §5.4; baris hasil dan grand total selalu tampil.
- [ ] Rasio "–" bila belum ada pendapatan; tidak ada angka rasio yang meledak.
- [ ] Klik akun membuka detail akun dengan rentang periode laporan.
- [ ] Catatan pajak muncul hanya bila beban pajak penghasilan = 0.
- [ ] Tidak ada "Rp -0,00" atau "(0,00)"; nol tampil "–".
- [ ] Ekspor PDF, Excel, CSV sesuai §5.6 dan angkanya sama dengan layar.
- [ ] Tampilan ponsel tidak terpotong; cetak hanya menampilkan laporan.

---

## 7. Catatan data contoh (prototype, 1 Jan s.d. 4 Nov 2026)

| Angka | Nilai |
|---|---|
| Laba sebelum pajak | Rp40.060.122 |
| Beban pajak penghasilan | 0 (belum ada jurnal pajak, catatan pajak muncul) |
| Laba bersih setelah pajak | Rp40.060.122, sama dengan Laba tahun berjalan di Neraca per 4 Nov 2026 |

Angka ini hanya untuk mencocokkan perilaku dengan prototype; data produksi tentu berbeda.
