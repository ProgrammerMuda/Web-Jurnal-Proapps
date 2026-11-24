# Revisi: Harga Perolehan Persediaan (ongkir, PPN non-PKP, retur pembelian)

> Revisi untuk fitur yang **sudah dibangun**: Mutasi Stok (`mutasi-stok-spec.md`) dan Pembelian. Ini bukan fitur baru. Tujuannya agar nilai persediaan sesuai PSAK 14 (Persediaan) dan hutang ke vendor tidak selisih.
>
> Ada tiga revisi:
> 1. Ongkir pembelian ikut menjadi harga perolehan.
> 2. PPN masuk harga perolehan bila tidak bisa dikreditkan.
> 3. Retur pembelian dinilai dengan harga beli aslinya, bukan harga rata-rata.

---

## 0. Aturan wajib

1. **Pakai style, komponen, dan helper yang sudah ada.** Jangan membuat komponen baru.
2. **Jangan mengubah cara menghitung saldo qty.** Yang direvisi hanya **harga satuan** mutasi masuk dan mutasi retur.
3. Semua harga di mutasi tetap dalam **satuan dasar** (M9).
4. **Prasyarat (bug no 8):** jurnal di revisi ini memakai akun **Barang Diterima Belum Ditagih (BDBD)**. Kalau akunnya belum ada:
   - Tambahkan **2-10150 Barang Diterima Belum Ditagih** (kewajiban lancar) di `DaftarAkun/accounts.js`.
   - Arahkan `AKUN.belumDitagih` di `Gudang/journal.js` ke akun itu, menggantikan 2-10200 Hutang Lainnya.

---

## 1. Ongkir pembelian masuk harga perolehan

### Aturan
| No | Aturan |
|---|---|
| H1 | Ongkir yang ditagih vendor untuk **pembelian barang** (PO) adalah bagian dari harga perolehan persediaan (PSAK 14) |
| H2 | Ongkir dialokasikan ke setiap baris barang **secara proporsional terhadap nilai DPP baris** (setelah diskon) |
| H3 | Ongkir per unit = ongkir baris ÷ qty pesanan baris. Setiap penerimaan (FPB), termasuk penerimaan sebagian, memakai ongkir per unit yang sama |
| H4 | Harga satuan mutasi masuk = **DPP per unit + ongkir per unit** (+ PPN per unit bila H6 berlaku) |
| H5 | Kebijakan perusahaan bisa mengubah perlakuan ini. Di **Pengaturan › Pembelian** (atau Pengaturan yang ada), tambahkan "Ongkir pembelian barang" dengan dua pilihan: **Masuk harga perolehan (default)** atau **Dibebankan langsung** ke akun **5-10005 Pengiriman & Pengangkutan**. Pilihan kedua untuk perusahaan yang ongkirnya kecil atau tidak material |
| H5a | PO jasa (SPK) tidak terpengaruh, karena tidak membuat mutasi stok |
| H5b | Selisih ongkir antara PO dan faktur vendor diperlakukan sama seperti selisih harga (M13): masuk ke akun Selisih Harga Pembelian, dan nilai persediaan tidak diubah |

### Jurnal penerimaan barang (FPB)
| Kebijakan | Jurnal |
|---|---|
| Masuk harga perolehan | Dr Persediaan (DPP + ongkir) / Cr BDBD (DPP + ongkir) |
| Dibebankan langsung | Dr Persediaan (DPP) + Dr 5-10005 Pengiriman & Pengangkutan (ongkir) / Cr BDBD (DPP + ongkir) |

Faktur pembelian kemudian menutup BDBD: Dr BDBD (DPP + ongkir) + Dr PPN Masukan / Cr Hutang Usaha.

### UI
- **Form dan detail PO:** setiap baris menampilkan keterangan kecil "Termasuk ongkir Rp x/unit" bila kebijakannya Masuk harga perolehan.
- **Detail penerimaan (FPB):** kolom harga menampilkan harga perolehan per unit, dengan tooltip "DPP Rp a + ongkir Rp b".
- **Riwayat mutasi dan Kartu stok:** harga satuan mutasi masuk adalah harga perolehan. Tooltip-nya sama dengan di FPB.

### Contoh uji
PO dengan ongkir **Rp 91.000**:
| Barang | Qty | Harga | DPP | Porsi | Ongkir | Ongkir/unit | Harga perolehan/unit |
|---|---|---|---|---|---|---|---|
| Map plastik | 100 pcs | 3.500 | 350.000 | 38,46% | 35.000 | 350 | **3.850** |
| Kertas A4 80 gsm | 10 rim | 56.000 | 560.000 | 61,54% | 56.000 | 5.600 | **61.600** |
| **Total** | | | **910.000** | | **91.000** | | |

- Penerimaan penuh: Dr Persediaan 1.001.000 / Cr BDBD 1.001.000.
- Penerimaan sebagian (Map plastik 40 pcs saja): mutasi masuk 40 × 3.850 = 154.000.
- Dengan kebijakan "Dibebankan langsung": Dr Persediaan 910.000 + Dr 5-10005 91.000 / Cr BDBD 1.001.000, dan harga satuan mutasi 3.500 dan 56.000.

---

## 2. PPN masuk harga perolehan bila tidak bisa dikreditkan

### Aturan
| No | Aturan |
|---|---|
| H6 | Untuk perusahaan **PKP**, PPN Masukan dicatat sebagai pajak dan **tidak** masuk harga perolehan (M5 tetap) |
| H7 | Untuk perusahaan **non-PKP**, PPN tidak bisa dikreditkan, jadi **PPN masuk harga perolehan**. Tidak ada akun PPN Masukan di jurnalnya |
| H8 | Perusahaan PKP juga bisa menandai satu faktur atau penerimaan sebagai **"PPN tidak dapat dikreditkan"** (misalnya faktur pajak cacat atau pembelian untuk penyerahan yang dibebaskan). Untuk dokumen itu, perlakuannya sama seperti H7 |
| H9 | Status PKP diatur di **Pengaturan › Perusahaan** (atau Pengaturan › Pajak): pilihan **PKP (default)** / **Non-PKP**. Mengubah status hanya berlaku untuk dokumen berikutnya |
| H10 | Penawaran dengan PPN termasuk (`ppn_incl`): DPP dan PPN dipisahkan dulu seperti yang sudah dilakukan `vendorTotals`, lalu H6/H7 diterapkan |

### Jurnal
| Status | Penerimaan (FPB) | Faktur pembelian |
|---|---|---|
| PKP | Dr Persediaan (DPP + ongkir) / Cr BDBD | Dr BDBD + Dr PPN Masukan / Cr Hutang Usaha |
| Non-PKP / tidak dapat dikreditkan | Dr Persediaan (DPP + PPN + ongkir) / Cr BDBD | Dr BDBD / Cr Hutang Usaha (tanpa PPN Masukan) |

### UI
- Pengaturan: pilihan Status PKP dengan keterangan "Non-PKP: PPN pembelian dimasukkan ke harga barang."
- Form penerimaan dan faktur (khusus perusahaan PKP): checkbox "PPN tidak dapat dikreditkan" beserta tooltip penjelasannya.
- Detail FPB: tooltip harga menjadi "DPP Rp a + PPN Rp c + ongkir Rp b" bila PPN dimasukkan.

### Contoh uji
Perusahaan **non-PKP**, membeli Map plastik 100 pcs @ 3.500 + PPN 11%, tanpa ongkir:
- Harga perolehan/unit = 3.500 + 385 = **3.885**.
- FPB: Dr Persediaan 388.500 / Cr BDBD 388.500.
- Faktur: Dr BDBD 388.500 / Cr Hutang Usaha 388.500. Tidak ada baris PPN Masukan.

---

## 3. Retur pembelian memakai harga beli asli

### Masalah sekarang
`productLedger()` di `Gudang/stock.js` (sekitar baris 178–183) memberi **semua mutasi keluar** harga rata-rata, termasuk `purchase_return`. Akibatnya, kalau harga rata-rata sudah berubah sejak barang diterima, nilai persediaan yang dikurangi berbeda dengan nilai hutang atau BDBD yang dikurangi. Selisihnya tidak tercatat di mana pun.

### Aturan
| No | Aturan |
|---|---|
| H11 | Mutasi `purchase_return` dinilai dengan **harga perolehan dari mutasi penerimaan aslinya** (FPB yang diretur), bukan harga rata-rata |
| H12 | Mutasi retur wajib menyimpan `sourceReceiptMoveId` (id mutasi FPB yang diretur), dan `unitCost` diambil dari mutasi itu |
| H13 | Di `productLedger`, mutasi keluar berjenis `purchase_return` **tidak ditimpa** dengan harga rata-rata, tetapi memakai `move.unitCost`. Harga rata-rata sesudahnya dihitung ulang dari sisa qty dan sisa nilai |
| H14 | **Ongkir yang tidak dikembalikan vendor:** vendor hanya mengurangi tagihan sebesar DPP (+ PPN). Porsi ongkir dari barang yang diretur dibebankan ke 5-10005 Pengiriman & Pengangkutan. Kalau vendor ikut mengembalikan ongkir, centang "Ongkir ikut dikembalikan" di form retur |
| H15 | Kalau setelah retur qty produk menjadi 0 tetapi masih ada sisa nilai (karena pembulatan atau rata-rata), sisa nilai itu dijurnal ke akun Selisih Harga Pembelian. **Jangan dinolkan diam-diam** seperti guard pembulatan yang sekarang |
| H16 | Qty retur ≤ qty diterima − qty yang sudah diretur untuk FPB itu. Stok di gudang FPB tidak boleh minus (M3). Gudang retur = gudang FPB |

### Jurnal retur pembelian
| Kondisi | Jurnal |
|---|---|
| Faktur vendor **belum** ada | Dr BDBD (nilai tagihan yang dikurangi) + Dr 5-10005 (porsi ongkir tidak dikembalikan, bila ada) / Cr Persediaan (harga perolehan asli × qty) |
| Faktur vendor **sudah** ada, PKP | Dr Hutang Usaha (DPP + PPN) + Dr 5-10005 (porsi ongkir, bila ada) / Cr Persediaan (harga perolehan asli × qty) + Cr PPN Masukan (PPN atas DPP retur, nota retur) |
| Faktur vendor sudah ada, non-PKP | Dr Hutang Usaha (DPP + PPN) + Dr 5-10005 (porsi ongkir, bila ada) / Cr Persediaan (harga perolehan asli × qty, yang sudah termasuk PPN) |

Jurnal selalu seimbang, karena harga perolehan asli = DPP + ongkir (+ PPN bila non-PKP).

### UI
- Form retur pembelian: setiap baris menampilkan "Harga perolehan Rp x/unit (dari FPB/…)". Harga ini terkunci dan tidak bisa diedit.
- Checkbox "Ongkir ikut dikembalikan vendor" muncul bila FPB-nya punya ongkir.
- Riwayat mutasi: baris retur menampilkan harga asli, dan no. dokumennya menautkan ke retur dan ke FPB asal.

### Contoh uji (perusahaan PKP, tanpa ongkir)
1. **Saldo awal:** Kertas A4 50 rim @ 56.000 (nilai 2.800.000).
2. **Terima** FPB baru 10 rim @ 60.000: qty 60, nilai 3.400.000, rata-rata 56.666,67.
3. **Retur 2 rim** dari FPB itu, sebelum faktur:
   - **Benar (revisi ini):** Cr Persediaan 2 × 60.000 = **120.000**, Dr BDBD 120.000. Sisa: qty 58, nilai 3.280.000, rata-rata 56.551,72.
   - **Salah (sekarang):** Cr Persediaan 2 × 56.666,67 = 113.333. Ada **selisih Rp 6.667** dengan BDBD yang tidak tercatat di mana pun.

Variasi dengan ongkir (memakai contoh bagian 1): retur 20 pcs Map plastik @ 3.850, dengan ongkir tidak dikembalikan:
- Cr Persediaan 77.000.
- Dr BDBD 70.000.
- Dr 5-10005 7.000.

---

## 4. Yang perlu diubah di prototipe (perkiraan lokasi)

| Area | File | Perubahan |
|---|---|---|
| Akun BDBD | `DaftarAkun/accounts.js`, `Gudang/journal.js` | Prasyarat bagian 0 |
| Pengaturan | halaman Pengaturan (baru atau yang sudah ada) | Kebijakan ongkir (H5) dan status PKP (H9) |
| Alokasi ongkir | `Pembelian/utils.js` (`vendorTotals` sudah menghitung `ship`) | Fungsi baru `landedUnitCost(po, itemId, settings)` yang mengembalikan DPP/unit, ongkir/unit, PPN/unit (bila H7/H8), dan total per unit. Satu fungsi, dipakai PO, FPB, retur, dan mutasi |
| Mutasi masuk dari FPB | tempat FPB membuat mutasi `receipt` | `unitCost` = `landedUnitCost(...).total`, dan simpan rinciannya (`costBreakdown`) di mutasi untuk tooltip |
| Retur | form retur pembelian + pembuatan mutasi `purchase_return` | Simpan `sourceReceiptMoveId`, `unitCost` asli, dan flag ongkir dikembalikan |
| Penilaian | `Gudang/stock.js` → `productLedger` | H13 (retur tidak ditimpa rata-rata) dan H15 (sisa nilai saat qty 0 tidak dinolkan diam-diam) |
| Jurnal | `Gudang/journal.js` → `moveJournal` | Baris ongkir dibebankan (H5), PPN masuk persediaan (H7), dan jurnal retur 3 kondisi (bagian 3) |
| Seed | `Gudang/stock.js` | Seed lama tidak perlu diubah (tidak ada ongkir dan PKP). Tambahkan 1 PO + FPB + retur sesuai contoh uji bila perlu data demo |

Model data tambahan:
```ts
type StockMove = {
  // ...field yang sudah ada
  costBreakdown?: { dpp: number; freight: number; vat: number }; // per unit, hanya mutasi masuk dari FPB
  sourceReceiptMoveId?: string;                                   // hanya purchase_return
  freightRefunded?: boolean;                                      // hanya purchase_return
};

type CompanySettings = {
  isPkp: boolean;                                   // default true
  freightPolicy: "capitalize" | "expense";          // default "capitalize"
};
```

---

## 5. Kriteria penerimaan

- [ ] Prasyarat: akun 2-10150 Barang Diterima Belum Ditagih ada, dan jurnal penerimaan barang mengkredit akun itu.
- [ ] **Ongkir:** contoh uji bagian 1 menghasilkan harga perolehan 3.850 dan 61.600, dan jurnal FPB Rp 1.001.000. Penerimaan sebagian memakai ongkir per unit yang sama.
- [ ] Kebijakan "Dibebankan langsung" menghasilkan harga 3.500 dan 56.000 serta baris Dr 5-10005 Rp 91.000.
- [ ] **Non-PKP:** contoh uji bagian 2 menghasilkan harga 3.885 dan tidak ada PPN Masukan di jurnal penerimaan maupun faktur.
- [ ] Perusahaan PKP dengan centang "PPN tidak dapat dikreditkan" diperlakukan seperti non-PKP untuk dokumen itu saja.
- [ ] **Retur:** contoh uji bagian 3 mengurangi persediaan Rp 120.000 (bukan 113.333) dan rata-rata menjadi 56.551,72.
- [ ] Retur dengan ongkir tidak dikembalikan membebankan porsi ongkir ke 5-10005, dan jurnalnya seimbang.
- [ ] Retur yang membuat qty 0 tidak meninggalkan nilai persediaan. Sisa nilainya terjurnal ke Selisih Harga Pembelian.
- [ ] Setelah semua contoh uji, indikator rekonsiliasi di Mutasi Stok tetap "Cocok dengan buku besar".
- [ ] Tooltip harga di FPB, Riwayat mutasi, dan Kartu stok menampilkan rincian DPP, PPN, dan ongkir.
- [ ] Gudang, Produk (Stok per gudang), dan Stok Opname memakai harga baru ini secara otomatis, karena semuanya membaca `getAverageCost` yang sama.
