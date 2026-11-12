// Rute modul Pembelian (disimpan di hash): #pembelian[/tab/<tab> | /fpbj/new | /fpbj/<id>[/edit] | /po/<id> | /receipt/<id> | /invoice/<id> | /pr/<id>].
// Tiap tab = satu menu di sidebar (submenu Pembelian), seperti di produksi.
export const pembelianTabs = [
  { value: 'overview', label: 'Ringkasan Pembelian', title: 'Ringkasan Pembelian' },
  { value: 'fpbj', label: 'Permintaan', title: 'Permintaan' },
  { value: 'orders', label: 'Pesanan', title: 'Pesanan' },
  { value: 'receipts', label: 'Penerimaan Barang', title: 'Penerimaan Barang' },
  { value: 'bills', label: 'Tagihan Vendor', title: 'Tagihan Vendor' },
  { value: 'payments', label: 'Pembayaran', title: 'Pembayaran' },
  { value: 'returns', label: 'Retur Pembelian', title: 'Retur Pembelian' },
  { value: 'payables', label: 'Hutang Usaha', title: 'Hutang Usaha' },
];
const tabKeys = pembelianTabs.map((t) => t.value);

export function parseHash(h) {
  const [path, query = ''] = h.replace(/^#/, '').split('?');
  const [, a, b, c] = path.split('/');
  const po = new URLSearchParams(query).get('po');
  if (a === 'fpbj' && b === 'new') return { tab: 'fpbj', view: { name: 'fpbj-new', prefill: po ? { poId: po } : undefined } };
  if (a === 'fpbj' && b) return { tab: 'fpbj', view: { name: c === 'edit' ? 'fpbj-edit' : 'fpbj', id: b } };
  if (a === 'po' && b) return { tab: 'orders', view: { name: 'po', id: b } };
  if (a === 'receipt' && b) return { tab: 'receipts', view: { name: 'receipt', id: b } };
  if (a === 'invoice' && b) return { tab: 'bills', view: { name: 'invoice', id: b } };
  if (a === 'pr' && b) return { tab: 'payments', view: { name: 'pr', id: b } };
  if (a === 'pv' && b) return { tab: 'payments', view: { name: 'voucher', id: b } };
  if (a === 'laporan-hutang') return { tab: 'payables', view: { name: 'home' } };
  return { tab: a === 'tab' && tabKeys.includes(b) ? b : 'overview', view: { name: 'home' } };
}

export function formatHash(v) {
  switch (v.name) {
    case 'tab': return v.tab === 'overview' ? '#pembelian' : `#pembelian/tab/${v.tab}`;
    case 'fpbj-new': return `#pembelian/fpbj/new${v.prefill?.poId ? `?po=${v.prefill.poId}` : ''}`;
    case 'fpbj': return `#pembelian/fpbj/${v.id}`;
    case 'fpbj-edit': return `#pembelian/fpbj/${v.id}/edit`;
    case 'po': return `#pembelian/po/${v.id}`;
    case 'receipt': return `#pembelian/receipt/${v.id}`;
    case 'invoice': return `#pembelian/invoice/${v.id}`;
    case 'pr': return `#pembelian/pr/${v.id}`;
    case 'voucher': return `#pembelian/pv/${v.id}`;
    default: return '#pembelian';
  }
}

// Kunci menu sidebar yang aktif untuk hash saat ini, mis. "pembelian:orders".
export const pembelianNavKey = (hash) => `pembelian:${parseHash(hash).tab}`;
export const pembelianTitle = (hash) => pembelianTabs.find((t) => t.value === parseHash(hash).tab).title;
