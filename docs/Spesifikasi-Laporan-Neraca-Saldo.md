# Spesifikasi Laporan Neraca Saldo

Dokumen ini menjelaskan fitur **Neraca Saldo** (Trial Balance) seperti yang sudah jadi di prototype Dashboard Jurnal, supaya tim BE dan FE bisa membangunnya di aplikasi produksi. Prototype adalah acuan perilaku dan tampilan; angka di prototype dihitung di browser, sedangkan di produksi hitungannya pindah ke BE.

Bahasa antarmuka: **Indonesia**, huruf kapital hanya di awal kalimat, kecuali nama akun.

| Bagian | Pemilik |
|---|---|
| Aturan hitung (§3), API (§4) | BE |
| Halaman, interaksi, ekspor (§5) | FE |
| Kriteria selesai (§6) | BE + FE, diuji QA |

---

## 1. Tujuan

Menjawab pertanyaan: **"Apakah pembukuan seimbang, dan berapa saldo awal, mutasi, serta saldo akhir setiap akun di periode ini?"**

- Disajikan untuk **rentang tanggal**, tanpa pembanding.
- Satu baris per akun dengan enam kolom angka: **saldo awal** (debit, kredit), **mutasi** (debit, kredit), **saldo akhir** (debit, kredit).
- Angkanya dari **jurnal otomatis semua modul** (Penjualan, Pembelian, Gudang, Kas & Bank, jurnal umum).
- Dipakai akuntan sebagai alat cek sebelum menyusun laporan keuangan dan sebagai sumber angka Buku Besar.
- **Syarat kebenaran:** di setiap pasang kolom, **total debit = total kredit**.

---

## 2. Acuan di prototype

| File | Isi |
|---|---|
| `src/pages/LaporanKeuangan/NeracaSaldo.jsx` | Halaman: kartu periode, callout, statistik, toolbar, tabel enam kolom, ekspor |
| `src/pages/LaporanKeuangan/ledger.js` | `buildLedger` (semua jurnal), `trialBalance(ledger, from, to, { all })`, `CATEGORY_ORDER`, `LABA_DITAHAN` |
| `src/pages/LaporanKeuangan/statementExport.js` | Ekspor PDF / Excel / CSV (dengan kepala kolom bertingkat) |
| `src/pages/LaporanKeuangan/PeriodFilter.jsx` | Filter periode bersama (Neraca Saldo memakai mode tanpa pembanding) |
| `docs/Spesifikasi-Laporan-Buku-Besar.md` | Buku Besar memakai saldo awal/akhir dari hitungan yang sama |

Rute prototype: `#laporan/neraca-saldo`.

---

## 3. Aturan hitung (BE)

### 3.1 Sumber data

- Semua baris jurnal terposting. Jurnal draft/batal tidak ikut.
- **Mutasi debit/kredit** = jumlah debit dan kredit baris jurnal dengan **dari ≤ tanggal ≤ sampai**.
- **Saldo awal** = jumlah (debit − kredit) baris jurnal **sebelum** tanggal dari, dengan aturan §3.2.
- **Saldo akhir** = saldo awal + mutasi debit − mutasi kredit.

### 3.2 Saldo awal akun laba rugi

- **Akun neraca** (aset, liabilitas, ekuitas): seluruh jurnal sebelum tanggal dari.
- **Akun laba rugi** (Pendapatan, HPP, Beban, Pendapatan Lainnya, Beban Lainnya): hanya jurnal sejak **1 Januari tahun tanggal dari** sampai sebelum tanggal dari.
- Laba rugi **tahun-tahun sebelumnya** (belum ada jurnal penutup) dipindah ke saldo awal **Laba Ditahan (3-10002)**. Dengan begitu saldo awal tetap seimbang dan sama dengan Neraca.

### 3.3 Penulisan saldo

- Saldo awal dan saldo akhir ditulis **bersih di satu sisi**: bila (debit − kredit) ≥ 0 masuk kolom Debit, bila < 0 nilai mutlaknya masuk kolom Kredit. Satu akun tidak pernah punya angka di kedua sisi saldo.
- Mutasi ditulis apa adanya di kedua sisi.
- Tidak ada reklasifikasi cerukan: rekening bank bersaldo kredit tampil di kolom Kredit pada kategori Kas & Bank (reklasifikasi hanya di Neraca).
- Pembulatan 2 desimal; nilai −0 dinormalkan jadi 0.

### 3.4 Pengelompokan dan urutan

- Akun dikelompokkan per **kategori** Daftar Akun, urut seperti Daftar Akun (Kas & Bank … Beban Lainnya), lalu per kode akun. Akun tanpa kategori masuk kelompok "Tanpa kategori" di akhir.
- Subtotal enam kolom per kategori dan total keseluruhan.

### 3.5 Akun yang ikut

- Bawaan: akun yang punya saldo awal, mutasi, atau saldo akhir ≠ 0.
- Mode "semua akun" (switch Sembunyikan saldo nol dimatikan): **seluruh** akun Daftar Akun ikut, termasuk yang nol semua.

### 3.6 Keseimbangan

| Selisih | Rumus | Harus |
|---|---|---|
| Saldo awal | total saldo awal debit − kredit | 0 |
| Mutasi | total mutasi debit − kredit | 0 |
| Saldo akhir | total saldo akhir debit − kredit | 0 |

Selisih ≠ 0 berarti ada jurnal yang tidak seimbang; BE mengembalikan ketiga selisih supaya FE bisa memperingatkan.

---

## 4. Usulan API (BE)

Nama dan bentuk boleh disesuaikan dengan konvensi BE; isi datanya yang wajib.

### 4.1 `GET /reports/trial-balance`

| Parameter | Wajib | Isi |
|---|---|---|
| `from` | ya | Tanggal mulai `YYYY-MM-DD` |
| `to` | ya | Tanggal akhir `YYYY-MM-DD` |
| `all_accounts` | tidak | `true` = sertakan semua akun Daftar Akun walau nol (bawaan `false`) |

Respons:

```json
{
  "from": "2026-01-01",
  "to": "2026-11-04",
  "groups": [
    {
      "key": "Kas & Bank", "label": "Kas & Bank",
      "rows": [
        {
          "code": "1-10004", "name": "BCA A/C", "category": "Kas & Bank", "lines": 0,
          "open_debit": 0, "open_credit": 0, "debit": 0, "credit": 0, "close_debit": 0, "close_credit": 0
        }
      ],
      "open_debit": 0, "open_credit": 0, "debit": 0, "credit": 0, "close_debit": 0, "close_credit": 0
    }
  ],
  "totals": { "open_debit": 0, "open_credit": 0, "debit": 0, "credit": 0, "close_debit": 0, "close_credit": 0 },
  "selisih": { "open": 0, "move": 0, "close": 0 },
  "journal_count": 64,
  "modules": { "Penjualan": 20, "Pembelian": 30, "Gudang": 14 }
}
```

- `lines` = jumlah baris jurnal akun itu di rentang (ditampilkan "N baris jurnal").
- Saldo awal/akhir sudah ditulis bersih di satu sisi (§3.3).

### 4.2 Pemakaian bersama

Hitungan ini juga dipakai **Buku Besar** (saldo awal/akhir per akun) dan **saldo Daftar Akun**. Sebaiknya satu fungsi/query di BE dipakai ketiganya supaya angkanya tidak bisa berbeda.

### 4.3 Kinerja dan ekspor

- Agregasi di database per akun; respons < 2 detik untuk rentang satu tahun.
- Ekspor bisa di FE dari data §4.1 (seperti prototype) atau di BE: `GET /reports/trial-balance/export?format=pdf|xlsx|csv&from=&to=&mode=rinci|ringkas&hide_zero=true|false`. Isi file mengikuti §5.6.

---

## 5. Halaman (FE)

Urutan dari atas: tombol kembali → judul dan aksi → kartu periode → callout (jika ada) → kartu statistik → kartu tabel.

### 5.1 Judul dan aksi

- Judul **Neraca Saldo**, deskripsi "Saldo awal, mutasi, dan saldo akhir setiap akun dari jurnal Penjualan, Pembelian, dan Gudang. Total debit dan kredit harus selalu sama. Klik akun untuk melihat jurnalnya."
- Kanan: tombol ikon **Cetak** dan menu **Ekspor** (PDF, Excel, CSV).

### 5.2 Kartu periode dan callout

- Kartu periode yang sama dengan laporan lain, **tanpa** isian pembanding: Bulan ini (default), Bulan lalu, Kuartal ini, Tahun ini, Tahun lalu, Tanggal lain.
- Callout **peringatan** bila salah satu selisih ≠ 0: "Debit dan kredit tidak sama", sebut selisih saldo awal, mutasi, dan saldo akhir, minta periksa jurnal dokumen di periode itu.

### 5.3 Kartu statistik

| Sel | Angka | Baris bawah | Rincian |
|---|---|---|---|
| Saldo awal | total saldo awal debit | "Per <sehari sebelum dari>" | Debit; Kredit |
| Mutasi periode | total mutasi debit | "N jurnal" / "Belum ada jurnal" | Debit; Kredit |
| Saldo akhir | total saldo akhir debit | "Per <sampai>" | Debit; Kredit |
| Keseimbangan | "Seimbang" (hijau) atau "Selisih Rp…" (merah, selisih terbesar) | "Total debit = total kredit" / "Debit dan kredit tidak sama" | Selisih saldo awal; Selisih mutasi; Selisih saldo akhir |

### 5.4 Toolbar

Tidak ikut dicetak.
- Kiri: kotak cari "Cari nama atau kode akun…" (saat mencari, tampilan dipaksa Rinci).
- Kanan: switch **Sembunyikan saldo nol** (default aktif; dimatikan = semua akun Daftar Akun tampil, §3.5) dan segmented **Rinci / Ringkas**.

### 5.5 Tabel

**Kepala laporan** di tengah: nama perusahaan, "Neraca Saldo", "<dari> s.d. <sampai>".

**Kepala kolom dua tingkat:**

| | | Saldo awal | | Mutasi | | Saldo akhir | |
|---|---|---|---|---|---|---|---|
| Kode | Akun | Debit | Kredit | Debit | Kredit | Debit | Kredit |

Garis pemisah lebih tegas di awal tiap pasang kolom, tipis di antara Debit dan Kredit.

**Baris, mode Rinci:**
- Judul kategori → baris akun (kode, nama akun biru dengan "N baris jurnal" di bawahnya bila ada, enam angka) → "Total <kategori>".
- Kategori yang semua akunnya tersaring tidak tampil.
- Baris akhir tebal: **Total** (enam kolom).

**Baris, mode Ringkas:** satu baris per kategori (nama kategori, "N akun", enam subtotal) + Total.

**Klik akun:** baris atau nama akun membuka detail akun dengan rentang periode laporan (prototype: `#daftar-akun/<kode>?from=<dari>&to=<sampai>`).

**Format angka:** tanpa "Rp", pemisah ribuan titik, nol ditulis "–" (abu-abu).

**Catatan kaki:** "Saldo awal dari jurnal sebelum <dari>; akun pendapatan dan beban mulai 1 Januari, laba rugi tahun sebelumnya masuk Laba Ditahan. Saldo ditulis bersih di sisi debit atau kredit; tanda – berarti nol."

**Kosong:** saat mencari tanpa hasil: "Tidak ada akun yang cocok dengan "…"."

**Ponsel (< 768px):** tabel lebar (±1080px) bisa digulir horizontal; kolom pertama digabung supaya nama akun tetap terbaca.

### 5.6 Ekspor

Isi file mengikuti mode Rinci/Ringkas dan switch saldo nol; **pencarian diabaikan**. Nama file `neraca-saldo-<dari>_<sampai>.<ext>`.

| Format | Isi |
|---|---|
| PDF | A4, kop biru tua (nama perusahaan, "Neraca Saldo", periode), kepala kolom dua tingkat (Saldo awal / Mutasi / Saldo akhir, lalu Debit / Kredit), kategori/total berlatar, Total akhir, catatan kaki, "Halaman x dari y". Header tabel diulang tiap halaman |
| Excel (.xlsx) | Kop 3 baris, kepala kolom dua tingkat dengan merge, header beku, kolom Kode, Akun, dan enam angka sebagai angka dengan format `#,##0.00;[Red](#,##0.00);"-"` |
| CSV | Baris kop, header, satu baris per baris laporan dengan enam angka mentah 2 desimal, catatan kaki |

Catatan kaki ekspor: "Dihitung dari N jurnal antara <dari> dan <sampai>. Saldo awal dari jurnal sebelum <dari>; akun laba rugi mulai 1 Januari. Diekspor <tanggal hari ini>."

---

## 6. Kriteria selesai

**Hitungan (BE)**
- [ ] Total debit = total kredit untuk saldo awal, mutasi, dan saldo akhir (selisih 0).
- [ ] Saldo akhir tiap akun = saldo akhir akun yang sama di Buku Besar dan saldo di Daftar Akun per tanggal sampai.
- [ ] Total mutasi = total Jurnal Umum untuk rentang yang sama.
- [ ] Saldo awal akun laba rugi mulai 1 Januari; laba rugi tahun lalu masuk saldo awal Laba Ditahan.
- [ ] Saldo awal/akhir ditulis bersih di satu sisi; tidak ada akun dengan angka di kedua sisi saldo.
- [ ] `all_accounts=true` menyertakan semua akun Daftar Akun.
- [ ] Jurnal draft/batal tidak ikut.

**Halaman (FE)**
- [ ] Ganti periode memperbarui tabel, statistik, dan kepala laporan.
- [ ] Rinci/Ringkas, saldo nol (termasuk menampilkan semua akun), dan cari bekerja seperti §5.4–5.5.
- [ ] Kepala kolom dua tingkat tampil di layar, PDF, dan Excel.
- [ ] Klik akun membuka detail akun dengan rentang periode laporan.
- [ ] Callout selisih hanya muncul bila ada selisih.
- [ ] Ekspor PDF, Excel, CSV sesuai §5.6 dan angkanya sama dengan layar.
- [ ] Tampilan ponsel bisa digulir dan tidak terpotong; cetak hanya menampilkan laporan.

---

## 7. Catatan data contoh (prototype, 1 Jan s.d. 4 Nov 2026)

| Angka | Nilai |
|---|---|
| Jumlah jurnal | 64 |
| Total mutasi debit = kredit | Rp266.758.600 (sama dengan Buku Besar dan Jurnal Umum) |
| Keseimbangan | Seimbang di ketiga pasang kolom |

Angka ini hanya untuk mencocokkan perilaku dengan prototype; data produksi tentu berbeda.
