// Rute modul Pembelian (disimpan di hash): #pembelian[/tab/<tab> | /fppbj/new | /fppbj/<id>[/edit] | /po/<id> | /receipt/<id> | /invoice/new[?from=<id,id>] | /invoice/<id> | /pr/new[?inv=<id,id>|?po=<id>] | /pr/<id> | /pv/<id>[/jurnal]].
// Tiap tab = satu menu di sidebar (submenu Pembelian), seperti di produksi.
export const pembelianTabs = [
  { value: 'overview', label: 'Ringkasan Pembelian', title: 'Ringkasan Pembelian' },
  { value: 'fppbj', label: 'Permintaan', title: 'Permintaan' },
  { value: 'orders', label: 'Pesanan', title: 'Pesanan' },
  { value: 'receipts', label: 'Penerimaan Barang/Jasa', title: 'Penerimaan Barang/Jasa' },
  { value: 'bills', label: 'Tagihan Vendor', title: 'Tagihan Vendor' },
  { value: 'payments', label: 'Pembayaran', title: 'Pembayaran' },
  { value: 'returns', label: 'Retur Pembelian', title: 'Retur Pembelian' },
  { value: 'payables', label: 'Hutang Usaha', title: 'Hutang Usaha' },
];
const tabKeys = pembelianTabs.map((t) => t.value);

export function parseHash(h) {
  const [path, query = ''] = h.replace(/^#/, '').split('?');
  const [, a, b, c] = path.split('/');
  const q = new URLSearchParams(query);
  // Penerimaan yang sudah dipilih saat form faktur dibuka dari detail FPB/BAPP atau PO/SPK.
  const from = q.get('from');
  // Pesanan yang sudah dipilih, untuk PO/SPK yang memang tanpa serah terima.
  const poFrom = q.get('po');
  // Faktur yang sudah dipilih saat form Payment Request dibuka dari detail faktur.
  const invFrom = q.get('inv');
  if (a === 'fppbj' && b === 'new') return { tab: 'fppbj', view: { name: 'fppbj-new' } };
  if (a === 'fppbj' && b) return { tab: 'fppbj', view: { name: c === 'edit' ? 'fppbj-edit' : 'fppbj', id: b } };
  if (a === 'po' && b) return { tab: 'orders', view: { name: 'po', id: b } };
  if (a === 'receipt' && b) return { tab: 'receipts', view: { name: 'receipt', id: b } };
  if (a === 'invoice' && b === 'new') return { tab: 'bills', view: { name: 'invoice-new', receiptIds: from ? from.split(',').filter(Boolean) : [], poId: poFrom || null } };
  if (a === 'invoice' && b) return { tab: 'bills', view: { name: 'invoice', id: b } };
  if (a === 'pr' && b === 'new') return { tab: 'payments', view: { name: 'pr-new', invoiceIds: invFrom ? invFrom.split(',').filter(Boolean) : [], poId: poFrom || null } };
  if (a === 'pr' && b) return { tab: 'payments', view: { name: 'pr', id: b } };
  if (a === 'pv' && b && c === 'jurnal') return { tab: 'payments', view: { name: 'journal', id: b } };
  if (a === 'pv' && b) return { tab: 'payments', view: { name: 'voucher', id: b } };
  if (a === 'laporan-hutang') return { tab: 'payables', view: { name: 'home' } };
  return { tab: a === 'tab' && tabKeys.includes(b) ? b : 'overview', view: { name: 'home' } };
}

export function formatHash(v) {
  switch (v.name) {
    case 'tab': return v.tab === 'overview' ? '#pembelian' : `#pembelian/tab/${v.tab}`;
    case 'fppbj-new': return '#pembelian/fppbj/new';
    case 'fppbj': return `#pembelian/fppbj/${v.id}`;
    case 'fppbj-edit': return `#pembelian/fppbj/${v.id}/edit`;
    case 'po': return `#pembelian/po/${v.id}`;
    case 'receipt': return `#pembelian/receipt/${v.id}`;
    case 'invoice-new': return `#pembelian/invoice/new${v.poId ? `?po=${v.poId}` : v.receiptIds?.length ? `?from=${v.receiptIds.join(',')}` : ''}`;
    case 'invoice': return `#pembelian/invoice/${v.id}`;
    case 'pr-new': return `#pembelian/pr/new${v.poId ? `?po=${v.poId}` : v.invoiceIds?.length ? `?inv=${v.invoiceIds.join(',')}` : ''}`;
    case 'pr': return `#pembelian/pr/${v.id}`;
    case 'voucher': return `#pembelian/pv/${v.id}`;
    case 'journal': return `#pembelian/pv/${v.id}/jurnal`;
    default: return '#pembelian';
  }
}

// Kunci menu sidebar yang aktif untuk hash saat ini, mis. "pembelian:orders".
export const pembelianNavKey = (hash) => `pembelian:${parseHash(hash).tab}`;
export const pembelianTitle = (hash) => pembelianTabs.find((t) => t.value === parseHash(hash).tab).title;
