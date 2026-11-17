// Retur / Nota Kredit: koreksi tagihan atas faktur yang sudah terbit.
// Selalu lahir dari faktur — tidak ada retur tanpa faktur sumber.
import { CLOSED_BEFORE, TODAY } from './data.js';
import { computeTotals, lineAmount, statusOf, taxRate } from './utils.js';

export const CREDIT_ACCOUNT = '2-30008';

export const RETURN_REASONS = [
  { value: 'salah_tagih', label: 'Salah tagih' },
  { value: 'batal_jasa', label: 'Jasa tidak jadi dilaksanakan' },
  { value: 'komplain', label: 'Komplain kualitas' },
  { value: 'barang_kembali', label: 'Barang dikembalikan' },
  { value: 'lainnya', label: 'Lainnya' },
];
export const reasonLabel = (v) => RETURN_REASONS.find((r) => r.value === v)?.label ?? v;

// R1: refund tunai belum dibuka — penyelesaian baru potong tagihan dan kredit pelanggan.
export const SETTLEMENTS = [
  {
    value: 'deduct',
    label: 'Potong tagihan',
    hint: 'Mengurangi sisa tagihan faktur sumber; kelebihannya jadi kredit pelanggan',
  },
  {
    value: 'credit',
    label: 'Kredit pelanggan',
    hint: 'Masuk saldo kredit, bisa dipakai di faktur lain',
  },
];
export const settlementLabel = (v) => SETTLEMENTS.find((s) => s.value === v)?.label ?? v;

export const RETURN_STATUS = {
  draft: { label: 'DRAF', color: 'gray' },
  issued: { label: 'TERBIT', color: 'blue' },
  completed: { label: 'SELESAI', color: 'green' },
  void: { label: 'DIBATALKAN', color: 'red' },
};

export function returnStatus(ret) {
  if (ret.draft) return 'draft';
  if (ret.cancelledAt) return 'void';
  // Porsi yang memotong tagihan tuntas begitu terbit. Yang tersisa adalah kredit,
  // dan retur baru selesai ketika kredit itu habis dipakai.
  const kredit = creditPart(ret);
  if (kredit <= 0) return 'completed';
  return (ret.creditUsed ?? 0) >= kredit ? 'completed' : 'issued';
}

// B1: satu retur bisa terbagi dua — memotong sisa tagihan sampai habis, lalu
// kelebihannya menjadi kredit pelanggan. Dokumen lama tanpa kolom ini dibaca
// dari penyelesaiannya, supaya data yang sudah ada tetap terbaca benar.
export const deductPart = (ret) =>
  ret.deducted ?? (ret.settlement === 'deduct' ? ret.total : 0);
export const creditPart = (ret) =>
  ret.credited ?? (ret.settlement === 'credit' ? ret.total : 0);

// Pembagian nilai retur terhadap satu faktur. `balance` adalah sisa tagihan faktur
// SEBELUM retur ini menempel, jadi pemanggilnya menghitungnya lebih dulu.
export function splitSettlement(total, settlement, balance) {
  if (settlement !== 'deduct') return { deducted: 0, credited: total };
  const deducted = Math.min(total, Math.max(balance, 0));
  return { deducted, credited: total - deducted };
}

export const canEditReturn = (r) => returnStatus(r) === 'draft';
export const canDeleteReturn = (r) => returnStatus(r) === 'draft';
export const canIssueReturn = (r) => returnStatus(r) === 'draft';
// Hanya boleh dibatalkan selama kreditnya belum dipakai sama sekali.
export const canVoidReturn = (r) =>
  ['issued', 'completed'].includes(returnStatus(r)) && !(r.creditUsed > 0);

// R2: faktur yang bisa diretur — sudah terbit, belum dibatalkan.
export const canReturnInvoice = (sale) =>
  ['issued', 'partial', 'paid'].includes(statusOf(sale));

// Sisa yang masih bisa diretur per baris faktur.
export const returnableQty = (line) => Math.max((line.qty ?? 0) - (line.returnedQty ?? 0), 0);

// Harga netto per unit setelah diskon faktur dibagi proporsional (bagian 5.5).
export function netUnitPrice(sale, line) {
  const t = computeTotals(sale);
  const bruto = sale.items.reduce((n, l) => {
    const rate = taxRate(l.tax);
    const amount = lineAmount(l);
    return n + (sale.taxInclusive && rate ? amount / (1 + rate) : amount);
  }, 0);
  const faktor = bruto > 0 ? (bruto - t.discount) / bruto : 1;
  const rate = taxRate(line.tax);
  const satuan = sale.taxInclusive && rate ? line.price / (1 + rate) : line.price;
  return satuan * faktor;
}

// Nilai retur dari baris yang diisi qty-nya.
export function returnTotals(sale, lines) {
  let subtotal = 0;
  let tax = 0;
  lines.forEach((l) => {
    const qty = Number(l.qty) || 0;
    if (!qty) return;
    const asal = sale.items[l.index];
    const net = netUnitPrice(sale, asal) * qty;
    subtotal += net;
    tax += net * taxRate(asal.tax);
  });
  return {
    subtotal: Math.round(subtotal),
    tax: Math.round(tax),
    total: Math.round(subtotal + tax),
  };
}

export function nextReturnNumber(returns, date = TODAY) {
  const prefix = `PRO/RTR/${date.slice(0, 4)}${date.slice(5, 7)}/`;
  const last = returns
    .filter((r) => r.number?.startsWith(prefix))
    .map((r) => Number(r.number.slice(prefix.length)) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(last + 1).padStart(5, '0')}`;
}

export const periodLockedReturn = (date) => !!date && date < CLOSED_BEFORE;

// Retur baru dari sebuah faktur, baris-barisnya mengikuti faktur dengan qty 0.
export function newReturnFrom(sale, number) {
  return {
    id: `r${Date.now()}`,
    number,
    invoiceId: sale.id,
    invoiceNumber: sale.number,
    customerId: sale.customerId,
    // Retur tidak boleh mendahului fakturnya: faktur bertanggal maju ikut menggeser
    // tanggal bawaan retur, supaya formnya tidak terbuka dalam keadaan salah.
    date: sale.date > TODAY ? sale.date : TODAY,
    reason: 'salah_tagih',
    note: '',
    // B2: selama faktur masih punya sisa tagihan, retur memotong tagihan itu dulu.
    // Kredit pelanggan hanya menjadi bawaan untuk faktur yang sudah lunas.
    settlement: computeTotals(sale).balance > 0 ? 'deduct' : 'credit',
    lines: sale.items.map((it, index) => ({ index, qty: 0 })),
    draft: true,
    cancelledAt: null,
    cancelReason: null,
    creditUsed: 0,
    subtotal: 0,
    tax: 0,
    total: 0,
    deducted: 0,
    credited: 0,
    activity: [],
    createdAt: null,
    updatedAt: null,
  };
}

// Retur yang terbit menempel ke fakturnya: qty per baris berkurang dan nilainya
// masuk daftar retur faktur. Dipakai saat diterbitkan, dibalik saat dibatalkan.
export function applyReturnToSale(sale, ret) {
  return {
    ...sale,
    items: sale.items.map((it, i) => {
      const l = ret.lines.find((x) => x.index === i);
      return l ? { ...it, returnedQty: (it.returnedQty ?? 0) + Number(l.qty) } : it;
    }),
    returns: [
      ...(sale.returns ?? []).filter((x) => x.id !== ret.id),
      {
        id: ret.id,
        number: ret.number,
        date: ret.date,
        amount: ret.total,
        settlement: ret.settlement,
        // Yang memotong tagihan hanya porsi ini; sisanya kredit pelanggan.
        deducted: deductPart(ret),
        credited: creditPart(ret),
      },
    ],
  };
}

export function revertReturnFromSale(sale, ret) {
  return {
    ...sale,
    items: sale.items.map((it, i) => {
      const l = ret.lines.find((x) => x.index === i);
      return l ? { ...it, returnedQty: Math.max((it.returnedQty ?? 0) - Number(l.qty), 0) } : it;
    }),
    returns: (sale.returns ?? []).filter((x) => x.id !== ret.id),
  };
}

// Belum ada retur contoh: retur selalu lahir dari faktur yang dibuat pengguna sendiri,
// jadi data awalnya kosong supaya tidak ada retur yang menggantung tanpa riwayat.
export const seedReturns = [];

// Saldo kredit pelanggan yang belum terpakai.
export const customerCredit = (returns, customerId) =>
  returns
    .filter(
      (r) =>
        r.customerId === customerId &&
        creditPart(r) > 0 &&
        ['issued', 'completed'].includes(returnStatus(r)),
    )
    .reduce((n, r) => n + creditPart(r) - (r.creditUsed ?? 0), 0);
