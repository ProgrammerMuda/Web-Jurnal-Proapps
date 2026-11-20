// Jurnal otomatis dari mutasi stok. Akun persediaan/beban diambil dari produknya
// (yang di aplikasi ini mewakili kategori produk).
import { accounts } from '@/pages/DaftarAkun/accounts.js';
import { MOVE_TYPE } from './stock.js';

export const AKUN = {
  persediaan: '1-10300', // Persediaan
  saldoAwal: '3-10000', // Ekuitas Saldo Awal
  // COA ini belum punya akun "Barang Diterima Belum Ditagih" tersendiri; sementara
  // dipakai Hutang Lainnya, akun yang sama dengan yang dipakai modul Pembelian.
  belumDitagih: '2-10200',
  selisih: '8-10001', // Penyesuaian Persediaan
};

export const accountName = (code) => accounts.find((a) => a.code === code)?.name ?? code;
export const accountLabel = (code) => (code ? `${code} · ${accountName(code)}` : '—');

const inventoryAccountOf = (product) => product?.inventoryAccount || AKUN.persediaan;
const expenseAccountOf = (product) => product?.buyAccount || AKUN.selisih;

/**
 * Baris jurnal satu mutasi. Pindah barang tidak berjurnal karena akun
 * persediaannya sama di kedua gudang.
 * @returns [{ account, debit, credit }]
 */
export function moveJournal(move, product, amount) {
  const persediaan = inventoryAccountOf(product);
  const nilai = Math.round(amount);
  const dr = (account) => ({ account, debit: nilai, credit: 0 });
  const cr = (account) => ({ account, debit: 0, credit: nilai });
  switch (move.type) {
    case 'opening':
      return [dr(persediaan), cr(AKUN.saldoAwal)];
    case 'receipt':
      return [dr(persediaan), cr(AKUN.belumDitagih)];
    case 'purchase_return':
      return [dr(AKUN.belumDitagih), cr(persediaan)];
    case 'issue':
      return [dr(expenseAccountOf(product)), cr(persediaan)];
    case 'sale':
      return [dr(expenseAccountOf(product)), cr(persediaan)];
    case 'sale_return':
      return [dr(persediaan), cr(expenseAccountOf(product))];
    case 'opname_gain':
      return [dr(persediaan), cr(AKUN.selisih)];
    case 'opname_loss':
      return [dr(AKUN.selisih), cr(persediaan)];
    default:
      return []; // transfer_in / transfer_out
  }
}

export const hasJournal = (type) => !['transfer_in', 'transfer_out'].includes(type);
export const moveLabel = (type) => MOVE_TYPE[type]?.label ?? type;
