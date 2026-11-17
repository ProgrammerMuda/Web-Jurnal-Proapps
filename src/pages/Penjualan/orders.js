// Pesanan Penjualan: kesepakatan dengan pelanggan sebelum faktur terbit.
// Tidak membentuk piutang dan tidak berjurnal — yang berjurnal tetap fakturnya.
import { products, TODAY } from './data.js';
import { addDays, computeTotals } from './utils.js';

const item = (productId, qty = 1, price, tax = null) => {
  const p = products.find((x) => x.id === productId);
  return { productId, description: p.description, qty, price: price ?? p.price, tax };
};

// Tiap baris pesanan menyimpan berapa yang sudah difakturkan (S4), supaya sisa
// yang boleh ditagih bisa dihitung dan dikembalikan saat faktur dibatalkan.
const line = (it) => ({ ...it, invoicedQty: 0 });

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
  draft: false,
  sends: [],
  confirmedAt: null,
  cancelledAt: null,
  // S13: syarat yang terbawa dari penawaran dan ikut ke faktur.
  terms: '',
  // S4: satu pesanan bisa menurunkan beberapa faktur. Jejak baliknya di sale.fromOrder.
  invoiceIds: [],
  // Penawaran asalnya, bila pesanan ini lahir dari sana (S5).
  fromQuote: null,
};

export const seedOrders = [
  {
    ...base,
    id: 'so1',
    number: 'SO/2026/11/0002',
    customerId: 'aag0808',
    billingAddress: 'Kl. Muwardi No. 455, Padangpanjang 80378, Jateng',
    date: '2026-11-03',
    dueDate: '2026-11-17',
    items: [line(item('drain-ac', 4))],
    sends: [{ at: '2026-11-03T10:15', to: 'shakila.samosir@proapps.id' }],
    confirmedAt: '2026-11-04T09:30',
    createdAt: '2026-11-03T10:00',
    updatedAt: '2026-11-04T09:30',
  },
  {
    ...base,
    id: 'so2',
    number: 'SO/2026/11/0001',
    customerId: 'aag1109',
    date: '2026-11-02',
    dueDate: '2026-11-20',
    items: [line(item('sewa', 1)), line(item('listrik', 2))],
    sends: [{ at: '2026-11-02T14:00', to: 'karen.marpaung@proapps.id' }],
    createdAt: '2026-11-02T13:40',
    updatedAt: '2026-11-02T14:00',
  },
  {
    ...base,
    id: 'so3',
    number: 'SO/2026/10/0001',
    // S6: sebelumnya tertulis aab2606, padahal isinya sama dengan penawaran milik aag1007.
    customerId: 'aag1007',
    date: '2026-10-28',
    dueDate: '2026-11-11',
    items: [line(item('fitout', 1))],
    draft: true,
    createdAt: '2026-10-28T11:20',
    updatedAt: '2026-10-28T11:20',
  },
];

// Lencana status; dipakai daftar dan rincian.
export const ORDER_STATUS = {
  draft: { label: 'DRAF', color: 'gray' },
  // S7: "Dikirim" terdengar seperti barangnya yang dikirim, padahal yang terkirim dokumennya.
  sent: { label: 'MENUNGGU KONFIRMASI', color: 'blue' },
  confirmed: { label: 'DIKONFIRMASI', color: 'green' },
  partial: { label: 'SEBAGIAN DIFAKTURKAN', color: 'orange' },
  invoiced: { label: 'SELESAI', color: 'primary' },
  cancelled: { label: 'DIBATALKAN', color: 'red' },
};

// S4: sisa yang masih boleh ditagih per baris dan untuk seluruh pesanan.
export const remainingQty = (it) => Math.max((it.qty ?? 0) - (it.invoicedQty ?? 0), 0);
export const orderRemaining = (order) =>
  order.items.reduce((n, it) => n + remainingQty(it), 0);
export const orderInvoices = (order) => order.invoiceIds ?? [];

// B9: nilai pesanan terbagi dua — yang sudah difakturkan dan yang masih tersisa.
// Pembagiannya proporsional terhadap qty, jadi diskon dan pajaknya ikut terbagi.
export function orderValueSplit(order) {
  const { total } = computeTotals(order);
  const bruto = order.items.reduce((n, it) => n + (it.qty ?? 0) * (it.price ?? 0), 0);
  const sudah = order.items.reduce((n, it) => n + (it.invoicedQty ?? 0) * (it.price ?? 0), 0);
  const invoiced = bruto > 0 ? Math.round((total * sudah) / bruto) : 0;
  return { invoiced, remaining: total - invoiced };
}

// Status dihitung dari jejak yang tersimpan, bukan disimpan sebagai kolom sendiri,
// supaya tidak pernah berselisih dengan dokumen turunannya.
export function orderStatus(order) {
  if (order.draft) return 'draft';
  if (order.cancelledAt) return 'cancelled';
  const faktur = orderInvoices(order).length;
  if (faktur > 0) return orderRemaining(order) > 0 ? 'partial' : 'invoiced';
  if (order.confirmedAt) return 'confirmed';
  return 'sent';
}

// Aturan aksi. Pesanan yang sudah punya faktur atau dibatalkan tidak bisa diubah lagi.
const open = (o) => !orderInvoices(o).length && !o.cancelledAt;
// S12-A: koreksi masih boleh selama belum ada faktur yang terbit dari pesanan ini.
export const canEditOrder = (o) => ['draft', 'sent', 'confirmed'].includes(orderStatus(o));
export const canDeleteOrder = (o) => orderStatus(o) === 'draft';
export const canSendOrder = (o) => orderStatus(o) === 'draft';
export const canResendOrder = (o) => orderStatus(o) !== 'draft';
export const canConfirmOrder = (o) => orderStatus(o) === 'sent';
// Faktur hanya dari pesanan yang sudah dikonfirmasi, dan hanya selama masih ada sisa (S4).
export const canInvoiceOrder = (o) =>
  ['confirmed', 'partial'].includes(orderStatus(o)) && orderRemaining(o) > 0;
export const canCancelOrder = (o) => open(o) && orderStatus(o) !== 'draft';

// Nomor berjalan per bulan: SO/2026/11/0004.
export function nextOrderNumber(orders, date = TODAY) {
  const [y, m] = date.split('-');
  const prefix = `SO/${y}/${m}/`;
  const last = orders
    .filter((o) => o.number?.startsWith(prefix))
    .map((o) => Number(o.number.slice(prefix.length)) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(last + 1).padStart(4, '0')}`;
}

// Salinan pesanan sebagai draf baru; jejak kirim, konfirmasi, dan faktur direset.
export function duplicateOrder(order, number, termDays) {
  return {
    ...order,
    id: `so${Date.now()}`,
    number,
    date: TODAY,
    dueDate: termDays == null ? TODAY : addDays(TODAY, termDays),
    draft: true,
    sends: [],
    confirmedAt: null,
    cancelledAt: null,
    invoiceIds: [],
    items: order.items.map((it) => ({ ...it, invoicedQty: 0 })),
  };
}

// S1/S4: isian awal form faktur dari pesanan — hanya baris yang masih bersisa, dengan
// qty sisa. S2: tanggalnya hari ini, bukan target kirim. S11: alamat penagihan dari
// kontak, alamat pengiriman pesanan ikut sebagai catatan.
export function invoicePrefillFromOrder(order, { billingAddress, dueDate }) {
  return {
    customerId: order.customerId,
    billingAddress: billingAddress || '',
    shippingNote: order.billingAddress || '',
    ref: order.ref,
    term: order.term,
    date: TODAY,
    dueDate,
    taxInclusive: order.taxInclusive,
    items: order.items
      .filter((it) => remainingQty(it) > 0)
      .map((it) => ({ ...it, qty: remainingQty(it), invoicedQty: undefined })),
    discountType: order.discountType,
    discountValue: order.discountValue,
    withholdingType: order.withholdingType,
    withholdingValue: order.withholdingValue,
    withholdingAccount: order.withholdingAccount,
    message: order.message,
    memo: order.memo,
    fromOrder: order.id,
  };
}

// Jumlah yang difakturkan dikembalikan ke baris pesanan, dipakai saat faktur tersimpan.
export function applyInvoicedQty(order, saleItems) {
  const dipakai = {};
  saleItems.forEach((it) => {
    dipakai[it.productId] = (dipakai[it.productId] ?? 0) + (Number(it.qty) || 0);
  });
  return order.items.map((it) => {
    const sisa = remainingQty(it);
    const ambil = Math.min(dipakai[it.productId] ?? 0, sisa);
    dipakai[it.productId] = (dipakai[it.productId] ?? 0) - ambil;
    return { ...it, invoicedQty: (it.invoicedQty ?? 0) + ambil };
  });
}
