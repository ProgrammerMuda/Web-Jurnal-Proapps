// Rute modul Penjualan (disimpan di hash):
// #penjualan[/tab/<tab> | /invoice/new[?customer=<id>] | /invoice/<id>[/edit]].
// Tiap tab = satu menu di sidebar (submenu Penjualan), pola sama dengan modul Pembelian.
export const penjualanTabs = [
  { value: 'invoices', label: 'Faktur Penjualan', title: 'Faktur Penjualan' },
  { value: 'quotes', label: 'Penawaran', title: 'Penawaran' },
  { value: 'orders', label: 'Pesanan Penjualan', title: 'Pesanan Penjualan' },
  { value: 'payments', label: 'Pembayaran Masuk', title: 'Pembayaran Masuk' },
  { value: 'returns', label: 'Retur Penjualan', title: 'Retur Penjualan' },
  { value: 'receivables', label: 'Piutang Usaha', title: 'Piutang Usaha' },
];
const tabKeys = penjualanTabs.map((t) => t.value);

// Segmen dokumen → tab pemiliknya. Dipakai sebagai jaring pengaman: rute dokumen yang
// bentuknya tidak dikenal tetap mendarat di tabnya sendiri, bukan diam-diam ke Faktur.
const docTab = { invoice: 'invoices', order: 'orders', quote: 'quotes', return: 'returns' };

export function parseHash(h) {
  const [path, query = ''] = h.replace(/^#/, '').split('?');
  const [, a, b, c] = path.split('/');
  const q = new URLSearchParams(query);
  const customer = q.get('customer');
  // Dokumen sumber, mis. "order:so1" — dipakai form untuk mengisi dirinya sendiri (S1/S5).
  const from = q.get('from');
  if (a === 'invoice' && b === 'new') return { tab: 'invoices', view: { name: 'sale-new', customerId: customer || null, from } };
  if (a === 'invoice' && b && c === 'edit') return { tab: 'invoices', view: { name: 'sale-edit', id: b } };
  if (a === 'invoice' && b) return { tab: 'invoices', view: { name: 'invoice', id: b } };
  if (a === 'order' && b === 'new') return { tab: 'orders', view: { name: 'order-new', customerId: customer || null, from } };
  if (a === 'order' && b && c === 'edit') return { tab: 'orders', view: { name: 'order-edit', id: b } };
  if (a === 'order' && b) return { tab: 'orders', view: { name: 'order', id: b } };
  if (a === 'quote' && b === 'new') return { tab: 'quotes', view: { name: 'quote-new', customerId: customer || null } };
  if (a === 'quote' && b && c === 'edit') return { tab: 'quotes', view: { name: 'quote-edit', id: b } };
  if (a === 'quote' && b) return { tab: 'quotes', view: { name: 'quote', id: b } };
  // Retur selalu punya faktur sumber, jadi rute barunya wajib membawa ?from=invoice:<id>.
  if (a === 'return' && b === 'new') return { tab: 'returns', view: { name: 'return-new', from } };
  if (a === 'return' && b && c === 'edit') return { tab: 'returns', view: { name: 'return-edit', id: b } };
  if (a === 'return' && b) return { tab: 'returns', view: { name: 'return', id: b } };
  if (a === 'tab' && tabKeys.includes(b)) return { tab: b, view: { name: 'home' } };
  if (docTab[a]) return { tab: docTab[a], view: { name: 'home' } };
  return { tab: 'invoices', view: { name: 'home' } };
}

// Query string form: ?customer=… dan/atau ?from=order:so1
const qs = (v) => {
  const p = new URLSearchParams();
  if (v.customerId) p.set('customer', v.customerId);
  if (v.from) p.set('from', v.from);
  const t = p.toString();
  return t ? `?${t}` : '';
};

export function formatHash(v) {
  switch (v.name) {
    case 'tab': return v.tab === 'invoices' ? '#penjualan' : `#penjualan/tab/${v.tab}`;
    case 'sale-new': return `#penjualan/invoice/new${qs(v)}`;
    case 'sale-edit': return `#penjualan/invoice/${v.id}/edit`;
    case 'invoice': return `#penjualan/invoice/${v.id}`;
    case 'order-new': return `#penjualan/order/new${qs(v)}`;
    case 'order-edit': return `#penjualan/order/${v.id}/edit`;
    case 'order': return `#penjualan/order/${v.id}`;
    case 'quote-new': return `#penjualan/quote/new${v.customerId ? `?customer=${v.customerId}` : ''}`;
    case 'quote-edit': return `#penjualan/quote/${v.id}/edit`;
    case 'quote': return `#penjualan/quote/${v.id}`;
    case 'return-new': return `#penjualan/return/new${qs(v)}`;
    case 'return-edit': return `#penjualan/return/${v.id}/edit`;
    case 'return': return `#penjualan/return/${v.id}`;
    default: return '#penjualan';
  }
}

// Tautan faktur untuk pelanggan: halaman penuh tanpa sidebar di aplikasi ini.
// Query string dibuang supaya tautannya bersih saat disalin.
export const invoiceLinkFor = (id) =>
  `${window.location.origin}${window.location.pathname}#invoice/${id}`;

// Kunci menu sidebar yang aktif untuk hash saat ini, mis. "penjualan:quotes".
export const penjualanNavKey = (hash) => `penjualan:${parseHash(hash).tab}`;
export const penjualanTitle = (hash) => penjualanTabs.find((t) => t.value === parseHash(hash).tab).title;
