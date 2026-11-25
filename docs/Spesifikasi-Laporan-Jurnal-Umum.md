# Spesifikasi Laporan Jurnal Umum

Dokumen ini menjelaskan fitur **Jurnal Umum** (Journal Entry Log / General Journal) seperti yang sudah jadi di prototype Dashboard Jurnal, supaya tim BE dan FE bisa membangunnya di aplikasi produksi. Prototype adalah acuan perilaku dan tampilan; angka di prototype dihitung di browser, sedangkan di produksi datanya diambil dari BE.

Bahasa antarmuka: **Indonesia**, huruf kapital hanya di awal kalimat, kecuali nama akun.

| Bagian | Pemilik |
|---|---|
| Aturan data (§3), API (§4) | BE |
| Halaman, interaksi, ekspor (§5) | FE |
| Kriteria selesai (§6) | BE + FE, diuji QA |

---

## 1. Tujuan

Menjawab pertanyaan: **"Jurnal apa saja yang tercatat di periode ini, akun apa yang didebit dan dikredit, dan apakah setiap jurnal seimbang?"**

- Semua jurnal di **rentang tanggal**, urut kronologis, tanpa pembanding.
- Per jurnal: baris judul (tanggal, nomor, keterangan, modul), baris akun **debit dulu lalu kredit**, dan baris **Total jurnal**.
- Datanya **jurnal otomatis semua modul** (Penjualan, Pembelian, Gudang, Kas & Bank, jurnal umum manual bila ada).
- Setiap jurnal bisa dibuka ke halaman jurnal transaksinya, setiap akun ke detail akunnya.
- **Syarat kebenaran:** setiap jurnal debit = kredit; total debit/kredit periode = total mutasi di **Buku Besar** dan **Neraca Saldo** untuk rentang yang sama.

---

## 2. Acuan di prototype

| File | Isi |
|---|---|
| `src/pages/LaporanKeuangan/JurnalUmum.jsx` | Halaman: kartu periode, callout, statistik, cari + filter modul, tabel per jurnal, "Tampilkan N lagi", ekspor |
| `src/pages/LaporanKeuangan/ledger.js` | `buildLedger(data)`: daftar jurnal `{ id, module, date, title, ref, no, journalHref, lines: [{ code, name, debit, credit, memo }] }` |
| `src/pages/LaporanKeuangan/journalExport.js` | Ekspor PDF / Excel / CSV khusus Jurnal Umum |
| `src/pages/LaporanKeuangan/BukuBesar.jsx` | `describe(e)`: cara menyusun keterangan jurnal (dipakai bersama) |
| `docs/Spesifikasi-Laporan-Buku-Besar.md`, `docs/Spesifikasi-Laporan-Neraca-Saldo.md` | Laporan yang totalnya harus sama |

Rute prototype: `#laporan/jurnal-umum`.

---

## 3. Aturan data (BE)

### 3.1 Jurnal yang ikut

- Semua jurnal **terposting** dengan **dari ≤ tanggal ≤ sampai**. Draft/batal tidak ikut.
- Tidak ada saldo awal; laporan ini hanya daftar jurnal di rentang.

### 3.2 Urutan

- Jurnal urut **tanggal transaksi**, lalu nomor jurnal.
- Di dalam satu jurnal: **semua baris debit dulu, lalu baris kredit** (urutan buku jurnal), masing-masing mempertahankan urutan aslinya.
- Akun kredit **tidak diberi indentasi**; sejajar dengan akun debit.

### 3.3 Isi per jurnal

| Field | Isi |
|---|---|
| Nomor jurnal | Nomor urut jurnal (mis. 17009), ditampilkan "#17009" |
| Tanggal | Tanggal transaksi |
| Modul | Penjualan, Pembelian, Gudang, Kas & Bank, dll. |
| Judul + nomor dokumen | Jenis transaksi dan nomor dokumen sumber (mis. "Pembayaran Vendor" + "PV-0003") |
| Baris | Kode akun, nama akun (dari Daftar Akun), debit, kredit, catatan baris |
| Tautan | ID jurnal untuk membuka halaman jurnal transaksi |

**Keterangan jurnal** (dipakai di layar dan ekspor): judul tanpa tanggal di belakangnya (tanggal sudah ada di kolomnya), ditambah nomor dokumen bila belum tercantum di judul.

### 3.4 Total dan keseimbangan

- Total jurnal = Σ debit dan Σ kredit baris jurnal itu; harus sama.
- Total periode = Σ seluruh jurnal di rentang.
- Jurnal yang debit ≠ kredit dikembalikan dalam daftar `unbalanced` (nomor jurnal) untuk peringatan.
- Pembulatan 2 desimal; nilai −0 dinormalkan jadi 0.

---

## 4. Usulan API (BE)

Nama dan bentuk boleh disesuaikan dengan konvensi BE; isi datanya yang wajib.

### 4.1 `GET /reports/journal`

| Parameter | Wajib | Isi |
|---|---|---|
| `from` | ya | Tanggal mulai `YYYY-MM-DD` |
| `to` | ya | Tanggal akhir `YYYY-MM-DD` |
| `module` | tidak | Filter satu modul |
| `q` | tidak | Pencarian (§5.4) |
| `page`, `page_size` | tidak | Paging; bawaan 50 jurnal per halaman |

Respons:

```json
{
  "from": "2026-01-01",
  "to": "2026-11-04",
  "entries": [
    {
      "id": "…", "no": 17009, "date": "2026-06-01", "module": "Pembelian",
      "title": "Pembayaran Vendor", "ref": "PV-0003",
      "lines": [
        { "code": "2-10001", "name": "Hutang Vendor Lift", "debit": 0, "credit": 0, "memo": "Pelunasan FKT/2026/06/0011" },
        { "code": "1-10004", "name": "BCA A/C", "debit": 0, "credit": 0, "memo": null }
      ],
      "total_debit": 0, "total_credit": 0
    }
  ],
  "page": 1, "page_size": 50, "total_entries": 64,
  "summary": {
    "journal_count": 64,
    "modules": { "Penjualan": 20, "Pembelian": 30, "Gudang": 14 },
    "debit": 266758600, "credit": 266758600,
    "unbalanced": []
  },
  "filtered_summary": { "journal_count": 64, "debit": 266758600, "credit": 266758600 }
}
```

- `lines` sudah diurutkan debit dulu lalu kredit (§3.2).
- `summary` = seluruh jurnal di rentang (dasar statistik dan jumlah per modul di filter); `filtered_summary` = jurnal yang cocok dengan `module`/`q` (dasar baris total tabel), **termasuk yang belum ada di halaman ini**.

### 4.2 Kinerja dan ekspor

- Jurnal satu tahun bisa ribuan; wajib paging di BE. Ringkasan (`summary`, `filtered_summary`) dihitung dengan agregasi database.
- Ekspor sebaiknya di BE karena harus memuat **semua** jurnal sesuai filter, bukan hanya halaman yang tampil: `GET /reports/journal/export?format=pdf|xlsx|csv&from=&to=&module=&q=`. Isi file mengikuti §5.6.

---

## 5. Halaman (FE)

Urutan dari atas: tombol kembali → judul dan aksi → kartu periode → callout (jika ada) → kartu statistik → kartu tabel.

### 5.1 Judul dan aksi

- Judul **Jurnal Umum**, deskripsi "Semua jurnal Penjualan, Pembelian, dan Gudang secara kronologis, lengkap dengan akun debit dan kreditnya. Klik nomor jurnal untuk rinciannya, klik nama akun untuk detail akun."
- Kanan: tombol ikon **Cetak** dan menu **Ekspor** (PDF, Excel, CSV). Bila ada filter aktif, label menu berubah jadi "Ekspor jurnal sesuai filter".

### 5.2 Kartu periode dan callout

- Kartu periode yang sama dengan laporan lain, **tanpa** isian pembanding: Bulan ini (default), Bulan lalu, Kuartal ini, Tahun ini, Tahun lalu, Tanggal lain.
- Callout **peringatan** bila total debit ≠ kredit: "Debit dan kredit tidak sama", sebut selisihnya dan nomor jurnal yang tidak seimbang (#17001, #17005, …).

### 5.3 Kartu statistik

Selalu menghitung **seluruh** jurnal di periode (tidak terpengaruh cari/filter modul):

| Sel | Angka | Baris bawah |
|---|---|---|
| Jumlah jurnal | "N jurnal" | jumlah per modul, mis. "Penjualan 20 · Pembelian 30 · Gudang 14"; "Belum ada jurnal" bila kosong |
| Total debit | Rp… | <periode> |
| Total kredit | Rp… | <periode> |
| Keseimbangan | "Seimbang" (hijau) atau "Selisih Rp…" (merah) | "Setiap jurnal debit = kredit" / "N jurnal tidak seimbang" |

### 5.4 Toolbar

Tidak ikut dicetak.
- Kiri: kotak cari "Cari no. jurnal, dokumen, akun, atau keterangan…". Mencocokkan nomor jurnal (dengan atau tanpa "#"), keterangan, nomor dokumen, kode dan nama akun, dan catatan baris. Jurnal yang cocok tampil **utuh** (semua barisnya).
- Kanan: pilihan modul "Semua modul (N)", "Penjualan (N)", "Pembelian (N)", "Gudang (N)" dengan jumlah jurnal per modul di periode.
- Mengubah cari atau modul mengembalikan daftar ke 50 jurnal pertama.

### 5.5 Tabel

**Kepala laporan** di tengah: nama perusahaan, "Jurnal Umum", "<dari> s.d. <sampai>" (+ " · Modul <nama>" bila difilter).

**Kolom:** Tanggal | No. Jurnal | Akun | Keterangan | Debit | Kredit.

**Per jurnal:**
- **Baris judul** (latar biru muda, bisa diklik ke jurnal transaksi): tanggal (tebal), nomor jurnal biru "#17009", keterangan jurnal (satu baris, terpotong bila panjang) dengan badge modul berwarna.
- **Baris akun**, debit dulu lalu kredit, **sejajar tanpa indentasi**: kode akun (abu) + nama akun biru (ke detail akun dengan rentang laporan; teks biasa bila akun tidak dikenal), catatan baris di kolom Keterangan ("–" bila kosong), debit, kredit.
- **Baris total**: label "Total jurnal #17009" **di kolom Keterangan**, lalu total debit dan total kredit jurnal itu (tebal).

**Baris akhir:** "Total N jurnal" atau "Total N jurnal sesuai filter" (rata kanan di empat kolom pertama) dengan total debit dan kredit seluruh jurnal yang cocok, termasuk yang belum ditampilkan.

**Paging:** tampil 50 jurnal pertama. Di bawah tabel: "Menampilkan 50 dari N jurnal" + tombol "Tampilkan 50 lagi" (atau sisa jumlahnya). Tidak ikut dicetak.

**Kosong:** "Belum ada jurnal di periode ini." atau "Tidak ada jurnal yang cocok dengan filter ini."

**Format angka:** tanpa "Rp", pemisah ribuan titik, nol ditulis "–" (abu).

**Catatan kaki:** "Jurnal diurutkan menurut tanggal transaksi. Di setiap jurnal, akun debit ditulis lebih dulu, lalu akun kredit, dan ditutup total debit dan kredit jurnal itu. Total di bawah tabel menjumlah semua jurnal yang cocok dengan filter, termasuk yang belum ditampilkan."

**Ponsel (< 768px):** tabel (±980px) bisa digulir horizontal.

### 5.6 Ekspor

Memuat **semua** jurnal yang cocok dengan filter (cari + modul), bukan hanya yang sudah ditampilkan; tanpa filter = semua jurnal di periode. Nama file `jurnal-umum-<dari>_<sampai>.<ext>`. Baris periode di kop ditambah " · Modul <nama>" bila difilter.

| Format | Isi |
|---|---|
| PDF | A4 portrait, kop biru tua (nama perusahaan, "Jurnal Umum", periode), header tabel biru diulang tiap halaman. Per jurnal: pita judul (tanggal, #nomor, keterangan, [modul] di kanan), baris akun, baris "Total jurnal #…" di kolom Keterangan. Satu jurnal tidak dipotong antarhalaman bila masih muat. Total akhir "Total N jurnal". "Halaman x dari y" |
| Excel (.xlsx) | Kop 3 baris, header beku. Baris judul jurnal (tanggal, #nomor, keterangan + [modul] di-merge sampai kolom Kredit), baris akun (kolom Akun, Keterangan, Debit, Kredit), baris total jurnal dengan label di kolom Keterangan. Angka sebagai angka dengan format `#,##0.00;[Red](#,##0.00);"-"` |
| CSV | Satu baris per baris jurnal: Tanggal, No. jurnal, Modul, Keterangan jurnal, Dokumen, Kode akun, Nama akun, Catatan, Debit, Kredit (tanggal, nomor, dan keterangan diulang di setiap baris supaya mudah difilter). Baris total di akhir |

Catatan kaki ekspor: "N jurnal antara <dari> dan <sampai> (sesuai filter). Diekspor <tanggal hari ini>."

---

## 6. Kriteria selesai

**Data (BE)**
- [ ] Hanya jurnal terposting di rentang; draft/batal tidak ikut.
- [ ] Urut tanggal lalu nomor; baris debit dulu lalu kredit.
- [ ] Setiap jurnal debit = kredit; yang tidak seimbang muncul di `unbalanced`.
- [ ] Total debit/kredit periode = total mutasi Buku Besar dan Neraca Saldo untuk rentang yang sama.
- [ ] `filtered_summary` menjumlah semua jurnal yang cocok, bukan hanya halaman aktif.
- [ ] Paging dan ekspor bekerja untuk ribuan jurnal.

**Halaman (FE)**
- [ ] Ganti periode memperbarui tabel, statistik, dan kepala laporan.
- [ ] Statistik tetap menghitung seluruh periode walau ada filter.
- [ ] Cari dan filter modul bekerja seperti §5.4; jumlah per modul tampil di pilihan.
- [ ] Akun kredit sejajar dengan akun debit; "Total jurnal #…" berada di kolom Keterangan.
- [ ] Klik nomor jurnal atau baris judul membuka jurnal transaksi; klik nama akun membuka detail akun.
- [ ] "Tampilkan N lagi" menambah 50 jurnal; total di bawah tabel tidak berubah saat menambah.
- [ ] Callout hanya muncul bila debit ≠ kredit dan menyebut nomor jurnalnya.
- [ ] Ekspor PDF, Excel, CSV sesuai §5.6, memuat semua jurnal sesuai filter, angkanya sama dengan layar.
- [ ] Tampilan ponsel bisa digulir; cetak hanya menampilkan laporan.

---

## 7. Catatan data contoh (prototype, 1 Jan s.d. 4 Nov 2026)

| Angka | Nilai |
|---|---|
| Jumlah jurnal | 64 |
| Total debit = kredit | Rp266.758.600 (sama dengan Buku Besar dan Neraca Saldo) |
| Keseimbangan | Seimbang, tidak ada jurnal tidak seimbang |

Angka ini hanya untuk mencocokkan perilaku dengan prototype; data produksi tentu berbeda.
