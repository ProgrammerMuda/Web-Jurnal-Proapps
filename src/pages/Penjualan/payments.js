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
  // B3: pembayaran yang dibatalkan tidak pernah jadi kas, jadi nilainya nol di
  // seluruh rekap — sama perlakuannya dengan pemakaian saldo kredit.
  if (p.fromCredit || p.cancelledAt) return 0;
  const pph = withholdingType(p.withholdingType);
  return p.amount - (pph?.rate ? Math.round(p.amount * pph.rate) : 0);
};
export const withheld = (p) => (p.fromCredit || p.cancelledAt ? 0 : p.amount - cashReceived(p));

// B3: alasan pembatalan dibuat tetap supaya bisa dihitung, bukan teks bebas.
export const PAYMENT_VOID_REASONS = [
  'Salah faktur',
  'Salah nominal',
  'Salah akun setor',
  'Dobel catat',
  'Dana ditarik kembali',
  'Lainnya',
];

// B3: pembatalan tidak menghapus pembayaran. Jejaknya tetap terbaca di riwayat dan
// jurnalnya dibalik — pola yang sama dengan pembatalan faktur dan retur.
export const voidPayment = (payment, reason, at) => ({
  ...payment,
  cancelledAt: at,
  cancelReason: reason || null,
});

// B3: kredit pelanggan yang dipakai pembayaran ini dikembalikan ke retur asalnya.
// Urutannya kebalikan dari pemakaian — yang terakhir memakai dikembalikan lebih dulu —
// supaya retur lama tidak "hidup lagi" sementara retur baru tetap tercatat terpakai.
export function releaseCredit(returns, customerId, amount, at) {
  let sisa = amount;
  const hasil = [...returns];
  for (let i = hasil.length - 1; i >= 0 && sisa > 0; i -= 1) {
    const r = hasil[i];
    if (r.customerId !== customerId) continue;
    const terpakai = r.creditUsed ?? 0;
    if (terpakai <= 0) continue;
    const kembali = Math.min(terpakai, sisa);
    sisa -= kembali;
    hasil[i] = { ...r, creditUsed: terpakai - kembali, updatedAt: at };
  }
  return hasil;
}

export const accountLabelOf = (code) =>
  depositAccounts.find((a) => a.value === code)?.label ?? code ?? '—';

export const methodOptions = paymentMethods.map((m) => ({ value: m, label: m }));
export const accountOptions = depositAccounts;

// Bulan berjalan menurut tanggal aplikasi, mis. "2026-11".
export const monthOf = (iso) => (iso ?? '').slice(0, 7);
