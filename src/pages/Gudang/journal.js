// Jurnal otomatis dari mutasi stok. Akun persediaan/beban diambil dari produknya
// (yang di aplikasi ini mewakili kategori produk).
//
// Semua yang dibutuhkan jurnal sudah menempel di mutasinya sendiri — rincian harga
// perolehan (DPP, ongkir, PPN) disimpan saat mutasi dibuat. Jadi jurnal tidak perlu
// membaca ulang dokumen sumber, dan tidak bisa berbeda dengan nilai persediaannya.
import { accounts } from '@/pages/DaftarAkun/accounts.js';
import { AKUN_ONGKIR } from '@/pages/Pengaturan/settings.js';
import { MOVE_TYPE } from './stock.js';

export const AKUN = {
  persediaan: '1-10300', // Persediaan
  saldoAwal: '3-10000', // Ekuitas Saldo Awal
  belumDitagih: '2-10150', // Barang Diterima Belum Ditagih
  hutangUsaha: '2-10200', // Hutang Lainnya
  ppnMasukan: '1-10407', // PPN Masukan
  // COA ini belum punya akun "Selisih Harga Pembelian" tersendiri; Penyesuaian
  // Persediaan dipakai untuk selisih penilaian, termasuk sisa nilai saat qty habis.
  selisih: '8-10001',
  ongkir: AKUN_ONGKIR, // 5-10005 Pengiriman & Pengangkutan
  uangMuka: '1-10403', // Uang Muka Pembelian — juga menampung kredit vendor dari retur
  piutangLain: '1-10108', // Piutang Lainnya — refund retur yang ditunggu dari vendor
};

export const accountName = (code) => accounts.find((a) => a.code === code)?.name ?? code;
export const accountLabel = (code) => (code ? `${code} · ${accountName(code)}` : '—');

const inventoryAccountOf = (product) => product?.inventoryAccount || AKUN.persediaan;
const expenseAccountOf = (product) => product?.buyAccount || AKUN.selisih;
const r = (n) => Math.round(n);

/**
 * Baris jurnal satu mutasi. Pindah barang tidak berjurnal karena akun
 * persediaannya sama di kedua gudang.
 *
 * @param amount nilai mutasi = qty × harga satuan efektif
 * @param opts   { residual } sisa nilai saat qty produk habis (H15)
 * @returns [{ account, debit, credit }]
 */
export function moveJournal(move, product, amount, opts = {}) {
  const persediaan = inventoryAccountOf(product);
  const nilai = r(amount);
  const qty = (move.qtyIn || 0) + (move.qtyOut || 0);
  const cb = move.costBreakdown;
  const dr = (account, v = nilai) => ({ account, debit: r(v), credit: 0 });
  const cr = (account, v = nilai) => ({ account, debit: 0, credit: r(v) });

  const lines = (() => {
    switch (move.type) {
      case 'opening':
        return [dr(persediaan), cr(AKUN.saldoAwal)];

      case 'receipt': {
        // Ongkir yang TIDAK dikapitalisasi tetap ditagih vendor, jadi ia masuk
        // sebagai beban tersendiri sementara utangnya tetap sebesar total tagihan.
        const ongkir = cb && !cb.freightCapitalized ? qty * (cb.freight ?? 0) : 0;
        return [
          dr(persediaan),
          ...(r(ongkir) ? [dr(AKUN.ongkir, ongkir)] : []),
          cr(AKUN.belumDitagih, nilai + ongkir),
        ];
      }

      case 'purchase_return': {
        // Retur yang dokumennya dibaca Pembelian (returnMoveFacts) membawa nilai tagihannya
        // sendiri: harga faktur + PPN faktur (+ ongkir yang dikembalikan), sama persis dengan
        // potongan hutang / kredit vendor di dokumen retur. Persediaan tetap keluar sebesar harga
        // perolehannya; bedanya (ongkir hangus, selisih harga) dibukukan terbuka.
        if (move.billedValue != null) {
          const akun = { kredit: AKUN.uangMuka, refund: AKUN.piutangLain }[move.settlement] ?? AKUN.hutangUsaha;
          const ongkirHangus = cb?.freightCapitalized && !move.freightRefunded ? qty * (cb.freight ?? 0) : 0;
          // PPN yang dulu dikapitalisasi (non-PKP) ikut keluar di nilai persediaan, bukan PPN Masukan.
          const ppn = (cb?.vat ?? 0) > 0 ? 0 : move.billedPpn ?? 0;
          const selisih = r(move.billedValue) + r(ongkirHangus) - nilai - r(ppn);
          return [
            dr(akun, move.billedValue),
            ...(r(ongkirHangus) ? [dr(AKUN.ongkir, ongkirHangus)] : []),
            ...(selisih < 0 ? [dr(AKUN.selisih, -selisih)] : []),
            cr(persediaan),
            ...(r(ppn) ? [cr(AKUN.ppnMasukan, ppn)] : []),
            ...(selisih > 0 ? [cr(AKUN.selisih, selisih)] : []),
          ];
        }
        if (!cb) return [dr(AKUN.belumDitagih), cr(persediaan)];
        // Ongkir yang tidak ikut dikembalikan vendor menjadi beban: barangnya pulang,
        // ongkirnya sudah terlanjur dibayar.
        const ongkirHangus =
          cb.freightCapitalized && !move.freightRefunded ? qty * (cb.freight ?? 0) : 0;
        // PPN Masukan hanya dikoreksi bila ia memang pernah dikreditkan: fakturnya
        // sudah ada (kalau belum, PPN-nya belum pernah dibukukan) dan PPN-nya tidak
        // dikapitalisasi (perusahaan PKP).
        const ppnKredit = move.billed && !cb.vat ? qty * (cb.dpp ?? 0) * (cb.vatRate ?? 0) : 0;
        const tagihan = nilai - r(ongkirHangus) + r(ppnKredit);
        const akunTagihan = move.billed ? AKUN.hutangUsaha : AKUN.belumDitagih;
        return [
          dr(akunTagihan, tagihan),
          ...(r(ongkirHangus) ? [dr(AKUN.ongkir, ongkirHangus)] : []),
          cr(persediaan),
          ...(r(ppnKredit) ? [cr(AKUN.ppnMasukan, ppnKredit)] : []),
        ];
      }

      case 'issue':
      case 'sale':
        return [dr(expenseAccountOf(product)), cr(persediaan)];
      case 'sale_return':
        return [dr(persediaan), cr(expenseAccountOf(product))];
      // Akun selisih opname ditentukan alasannya dan dikunci di mutasinya saat
      // posting (O10), jadi mengubah pemetaan di Pengaturan tidak menulis ulang
      // jurnal yang sudah terbit. Penyesuaian Persediaan hanya jaring pengaman.
      case 'opname_gain':
        return [dr(persediaan), cr(move.adjustmentAccount || AKUN.selisih)];
      case 'opname_loss':
        return [dr(move.adjustmentAccount || AKUN.selisih), cr(persediaan)];
      default:
        return []; // transfer_in / transfer_out
    }
  })();

  // H15: qty habis tapi masih ada sisa nilai — dibukukan ke akun selisih, bukan
  // dihapus diam-diam, supaya subledger tetap cocok dengan buku besar.
  const sisa = r(opts.residual ?? 0);
  if (lines.length && sisa) {
    lines.push(
      sisa > 0
        ? { account: AKUN.selisih, debit: sisa, credit: 0 }
        : { account: AKUN.selisih, debit: 0, credit: -sisa },
      sisa > 0
        ? { account: persediaan, debit: 0, credit: sisa }
        : { account: persediaan, debit: -sisa, credit: 0 },
    );
  }
  return lines;
}

export const hasJournal = (type) => !['transfer_in', 'transfer_out'].includes(type);
export const moveLabel = (type) => MOVE_TYPE[type]?.label ?? type;
