// Penelusuran pemakaian produk di modul Penjualan dan Pembelian.
// Inilah yang menghubungkan master Produk & Jasa dengan transaksi: dari halaman
// rincian produk bisa terlihat dokumen mana saja yang memakainya, berapa jumlah,
// dan berapa nilainya — lalu dibuka langsung ke modul yang bersangkutan.

const norm = (v) => (v ?? '').toString().trim().toLowerCase();

// Baris dokumen Pembelian pada data contoh belum menyimpan productId (dulu diketik
// bebas), jadi pencocokan juga melihat nama baris — sama seperti cara form permintaan
// mengenali produk yang sudah pernah dipakai.
const matches = (line, product) =>
  line.productId === product.id ||
  (!line.productId && norm(line.desc ?? line.description) === norm(product.name));

const sumBy = (arr, fn) => arr.reduce((n, x) => n + fn(x), 0);

const salesDoc = (doc, product, kind) => {
  const lines = (doc.items ?? []).filter((l) => matches(l, product));
  if (!lines.length) return null;
  return {
    kind,
    id: doc.id,
    number: doc.number,
    date: doc.date,
    partyId: doc.customerId,
    qty: sumBy(lines, (l) => Number(l.qty) || 0),
    amount: sumBy(lines, (l) => (Number(l.qty) || 0) * (Number(l.price) || 0)),
  };
};

const purchaseDoc = (doc, product, kind, lines) => {
  const hit = lines.filter((l) => matches(l, product));
  if (!hit.length) return null;
  return {
    kind,
    id: doc.id,
    number: doc.number,
    date: doc.date,
    partyId: doc.vendorId,
    qty: sumBy(hit, (l) => Number(l.qty) || 0),
    amount: sumBy(hit, (l) => (Number(l.qty) || 0) * (Number(l.price) || 0)),
  };
};

/**
 * Semua dokumen yang memakai produk ini.
 * @returns {{ penjualan: object[], pembelian: object[] }}
 */
export function productUsage(product, { sales = [], quotes = [], orders = [], pb }) {
  if (!product) return { penjualan: [], pembelian: [] };

  const penjualan = [
    ...quotes.map((d) => salesDoc(d, product, 'quote')),
    ...orders.map((d) => salesDoc(d, product, 'order')),
    ...sales.map((d) => salesDoc(d, product, 'invoice')),
  ].filter(Boolean);

  const pembelian = [
    ...(pb?.fppbj ?? []).map((d) => purchaseDoc(d, product, 'fppbj', d.items ?? [])),
    ...(pb?.pos ?? []).map((d) => purchaseDoc(d, product, 'po', d.items ?? [])),
    ...(pb?.invoices ?? [])
      .filter((d) => !d.cancelled)
      .map((d) => purchaseDoc(d, product, 'tagihan', d.lines ?? [])),
  ].filter(Boolean);

  const byDate = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  return { penjualan: penjualan.sort(byDate), pembelian: pembelian.sort(byDate) };
}

export const USAGE_LABEL = {
  quote: 'Penawaran',
  order: 'Pesanan',
  invoice: 'Faktur Penjualan',
  fppbj: 'Permintaan',
  po: 'Pesanan Pembelian',
  tagihan: 'Tagihan Vendor',
};

// Menu sidebar yang dituju saat baris pemakaian diklik.
export const USAGE_NAV = {
  quote: 'penjualan:quotes',
  order: 'penjualan:orders',
  invoice: 'penjualan:invoices',
  fppbj: 'pembelian:fppbj',
  po: 'pembelian:orders',
  tagihan: 'pembelian:bills',
};

/** Produk yang dipakai paling tidak di satu dokumen — tidak boleh dihapus begitu saja. */
export const usageCount = (u) => u.penjualan.length + u.pembelian.length;
