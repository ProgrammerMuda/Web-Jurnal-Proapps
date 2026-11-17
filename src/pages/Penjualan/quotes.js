// Penawaran: harga yang diajukan ke pelanggan sebelum ada kesepakatan.
// Tidak menagih, tidak berjurnal, dan punya masa berlaku. Yang diterima
// dilanjutkan menjadi Pesanan Penjualan.
import { products, TODAY } from './data.js';
import { addDays } from './utils.js';

const item = (productId, qty = 1, price, tax = null) => {
  const p = products.find((x) => x.id === productId);
  return { productId, description: p.description, qty, price: price ?? p.price, tax };
};

// Masa berlaku bawaan penawaran baru.
export const QUOTE_VALID_DAYS = 14;

const base = {
  ref: '',
  term: 'net30',
  taxInclusive: false,
  discountType: 'percent',
  discountValue: 0,
  withholdingType: 'nominal',
  withholdingValue: 0,
  withholdingAccount: null,
  message: '',
  memo: '',
  // Syarat yang mengikat harga yang ditawarkan.
  terms: '',
  draft: false,
  sends: [],
  acceptedAt: null,
  rejectedAt: null,
  // Alasan penolakan pelanggan (P8) dan alasan pembatalan dari pihak kita (P4).
  rejectReason: null,
  cancelledAt: null,
  cancelReason: null,
  // Revisi: versi lama menunjuk penggantinya, versi baru menunjuk induknya (P4).
  revisedToId: null,
  revisionOf: null,
  // Dokumen lanjutan. Jejak baliknya ada di order.fromQuote / sale.fromQuote (P1).
  orderId: null,
  invoiceId: null,
};

export const seedQuotes = [
  {
    ...base,
    id: 'q1',
    number: 'PNW/2026/11/0001',
    customerId: 'aldi',
    date: '2026-11-01',
    dueDate: '2026-11-15', // berlaku sampai
    items: [item('sewa', 1), item('parkir', 2)],
    terms:
      'Harga berlaku sampai tanggal di atas.\nPembayaran mengikuti termin yang tercantum di atas.\nWaktu pengerjaan 14 hari kerja sejak pesanan dikonfirmasi.',
    sends: [{ at: '2026-11-01T09:30', to: 'aldimdiansyah@gmail.com' }],
    createdAt: '2026-11-01T09:00',
    updatedAt: '2026-11-01T09:30',
  },
  {
    ...base,
    id: 'q2',
    number: 'PNW/2026/10/0001',
    customerId: 'aag1007',
    date: '2026-10-20',
    dueDate: '2026-11-03',
    items: [item('fitout', 1)],
    sends: [{ at: '2026-10-20T15:10', to: 'ghani.gunarto@proapps.id' }],
    acceptedAt: '2026-10-28T10:00',
    createdAt: '2026-10-20T15:00',
    updatedAt: '2026-10-28T10:00',
  },
  {
    ...base,
    id: 'q3',
    number: 'PNW/2026/10/0002',
    customerId: 'aaljooz',
    date: '2026-10-05',
    dueDate: '2026-10-19', // sudah lewat → kedaluwarsa
    items: [item('drain-ac', 3)],
    sends: [{ at: '2026-10-05T11:00', to: 'ijooz@gmail.com' }],
    createdAt: '2026-10-05T10:40',
    updatedAt: '2026-10-05T11:00',
  },
  {
    ...base,
    id: 'q4',
    number: 'PNW/2026/11/0002',
    customerId: 'firman',
    date: '2026-11-04',
    dueDate: '2026-11-18',
    items: [item('ipl', 12)],
    draft: true,
    createdAt: '2026-11-04T08:20',
    updatedAt: '2026-11-04T08:20',
  },
];

export const QUOTE_STATUS = {
  draft: { label: 'DRAF', color: 'gray' },
  sent: { label: 'MENUNGGU JAWABAN', color: 'blue' },
  accepted: { label: 'DITERIMA', color: 'green' },
  rejected: { label: 'DITOLAK', color: 'red' },
  expired: { label: 'KEDALUWARSA', color: 'orange' },
  cancelled: { label: 'DIBATALKAN', color: 'red' },
  revised: { label: 'DIREVISI', color: 'gray' },
  converted: { label: 'JADI PESANAN', color: 'primary' },
  invoiced: { label: 'JADI FAKTUR', color: 'primary' },
};

// Status tersimpan: draf / terkirim / diterima / ditolak / dikonversi.
export function quoteStatus(quote) {
  if (quote.draft) return 'draft';
  if (quote.revisedToId) return 'revised';
  if (quote.cancelledAt) return 'cancelled';
  if (quote.invoiceId) return 'invoiced';
  if (quote.orderId) return 'converted';
  if (quote.rejectedAt) return 'rejected';
  if (quote.acceptedAt) return 'accepted';
  return 'sent';
}

// Kedaluwarsa dihitung dari tanggal, bukan disimpan — sama seperti jatuh tempo faktur.
// Penawaran yang sudah dijawab atau dikonversi tidak lagi dianggap kedaluwarsa.
export const isExpired = (quote) =>
  ['sent'].includes(quoteStatus(quote)) && quote.dueDate < TODAY;

export const quoteBadge = (quote) => (isExpired(quote) ? 'expired' : quoteStatus(quote));

// P15: penawaran yang masa berlakunya tinggal beberapa hari, supaya sempat ditindaklanjuti.
export const EXPIRING_DAYS = 3;
export function isExpiring(quote) {
  if (quoteStatus(quote) !== 'sent' || isExpired(quote)) return false;
  const sisa = (new Date(quote.dueDate) - new Date(TODAY)) / 86400000;
  return sisa >= 0 && sisa <= EXPIRING_DAYS;
}

// Penawaran yang sudah ditutup: tidak menunggu jawaban dan tidak bisa diproses lagi.
export const isClosed = (q) =>
  ['converted', 'invoiced', 'rejected', 'cancelled', 'revised'].includes(quoteStatus(q)) ||
  isExpired(q);

// Aturan aksi.
export const canEditQuote = (q) => quoteStatus(q) === 'draft';
export const canDeleteQuote = (q) => quoteStatus(q) === 'draft';
export const canSendQuote = (q) => quoteStatus(q) === 'draft';
export const canResendQuote = (q) => quoteStatus(q) !== 'draft';
// Jawaban pelanggan hanya bisa dicatat selama penawaran masih berlaku.
export const canAnswerQuote = (q) => quoteStatus(q) === 'sent' && !isExpired(q);
// Penawaran kedaluwarsa tidak bisa dikonversi: harga lama tidak boleh dipakai diam-diam.
// P1: sekali jadi pesanan atau faktur, tidak bisa diproses ulang lewat jalur lain.
export const canConvertQuote = (q) => quoteStatus(q) === 'accepted';
// P4: penawaran yang menunggu jawaban boleh direvisi atau dibatalkan.
export const canReviseQuote = (q) => quoteStatus(q) === 'sent';
export const canCancelQuote = (q) => quoteStatus(q) === 'sent';

export function nextQuoteNumber(quotes, date = TODAY) {
  const [y, m] = date.split('-');
  const prefix = `PNW/${y}/${m}/`;
  const last = quotes
    .filter((q) => q.number?.startsWith(prefix))
    .map((q) => Number(q.number.slice(prefix.length)) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(last + 1).padStart(4, '0')}`;
}

// P4: nomor revisi adalah nomor induk + akhiran R1, R2, ... supaya hubungannya
// terbaca langsung dari nomornya.
export function revisionNumber(number) {
  const base = number.replace(/-R\d+$/, '');
  const prev = Number(number.match(/-R(\d+)$/)?.[1] ?? 0);
  return `${base}-R${prev + 1}`;
}

// Revisi: versi baru berupa draf dengan isi yang sama dan masa berlaku baru.
export function reviseQuote(quote) {
  return {
    ...quote,
    id: `q${Date.now()}`,
    number: revisionNumber(quote.number),
    date: TODAY,
    dueDate: addDays(TODAY, QUOTE_VALID_DAYS),
    draft: true,
    sends: [],
    acceptedAt: null,
    rejectedAt: null,
    rejectReason: null,
    cancelledAt: null,
    cancelReason: null,
    revisedToId: null,
    revisionOf: quote.id,
    orderId: null,
    invoiceId: null,
  };
}

// Salinan penawaran sebagai draf baru dengan masa berlaku baru. Inilah jalan keluar
// untuk penawaran yang sudah kedaluwarsa.
export function duplicateQuote(quote, number) {
  return {
    ...quote,
    id: `q${Date.now()}`,
    number,
    date: TODAY,
    dueDate: addDays(TODAY, QUOTE_VALID_DAYS),
    draft: true,
    sends: [],
    acceptedAt: null,
    rejectedAt: null,
    orderId: null,
  };
}

// P12/S1: isian awal form faktur dari penawaran yang diterima.
// P16: alamat penagihan dari profil kontak, karena penawaran tidak memuatnya.
export function invoicePrefillFromQuote(quote, { billingAddress, dueDate }) {
  return {
    customerId: quote.customerId,
    billingAddress: billingAddress || '',
    ref: quote.ref,
    term: quote.term,
    date: TODAY,
    dueDate,
    taxInclusive: quote.taxInclusive,
    items: quote.items.map((it) => ({ ...it })),
    discountType: quote.discountType,
    discountValue: quote.discountValue,
    message: quote.message,
    memo: quote.memo,
    fromQuote: quote.id,
  };
}

// S5: isian awal form pesanan dari penawaran, termasuk syarat & ketentuannya (S13).
export function orderPrefillFromQuote(quote) {
  return {
    customerId: quote.customerId,
    ref: quote.ref,
    term: quote.term,
    date: TODAY,
    // Target selesai pesanan bukan warisan masa berlaku penawaran — dua hal berbeda.
    // Dibiarkan hari ini supaya diisi sadar oleh penggunanya.
    dueDate: TODAY,
    taxInclusive: quote.taxInclusive,
    items: quote.items.map((it) => ({ ...it, invoicedQty: 0 })),
    discountType: quote.discountType,
    discountValue: quote.discountValue,
    terms: quote.terms,
    message: quote.message,
    memo: quote.memo,
    fromQuote: quote.id,
  };
}
