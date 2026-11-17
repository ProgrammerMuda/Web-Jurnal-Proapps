// Pembayaran Masuk: daftar gabungan semua penerimaan dari seluruh faktur.
// Pembayaran tidak disimpan sebagai koleksi tersendiri — ia bagian dari fakturnya,
// jadi halaman ini membacanya dari sana supaya tidak ada dua sumber kebenaran.
import { depositAccounts, paymentMethods } from './data.js';
import { withholdingType } from './journal.js';

// Satu baris pembayaran = satu penerimaan pada satu faktur.
// Kuncinya "<id faktur>#<urutan>" karena pembayaran tidak punya id sendiri.
export function allPayments(sales) {
  return sales
    .flatMap((sale) =>
      (sale.payments ?? []).map((p, index) => ({
        key: `${sale.id}#${index}`,
        index,
        saleId: sale.id,
        saleNumber: sale.number,
        customerId: sale.customerId,
        ...p,
      })),
    )
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// Nilai yang benar-benar masuk ke kas, setelah pelanggan memotong pajak.
// Pemakaian saldo kredit tidak membawa uang masuk, jadi nilainya nol di sini.
export const cashReceived = (p) => {
  if (p.fromCredit) return 0;
  const pph = withholdingType(p.withholdingType);
  return p.amount - (pph?.rate ? Math.round(p.amount * pph.rate) : 0);
};
export const withheld = (p) => (p.fromCredit ? 0 : p.amount - cashReceived(p));

export const accountLabelOf = (code) =>
  depositAccounts.find((a) => a.value === code)?.label ?? code ?? '—';

export const methodOptions = paymentMethods.map((m) => ({ value: m, label: m }));
export const accountOptions = depositAccounts;

// Bulan berjalan menurut tanggal aplikasi, mis. "2026-11".
export const monthOf = (iso) => (iso ?? '').slice(0, 7);
