// Rute menu Persediaan (disimpan di hash):
// #gudang                         daftar gudang
// #gudang/item/<id>               detail gudang
// #gudang/tab/moves               Mutasi Stok
// #gudang/tab/opname              Stok Opname
// #gudang/kartu?produk=&gudang=   kartu stok satu produk
// #gudang/jurnal?mutasi=<id>      jurnal transaksi satu mutasi
// #gudang/pindah/new?asal=&isi=   form pindah barang
// #gudang/pindah/<id>             detail pindah barang
export const gudangTabs = [
  { value: 'warehouses', label: 'Gudang', title: 'Gudang' },
  { value: 'moves', label: 'Mutasi Stok', title: 'Mutasi Stok' },
  { value: 'opname', label: 'Stok Opname', title: 'Stok Opname' },
];
const tabKeys = gudangTabs.map((t) => t.value);

export function parseHash(h) {
  const [path, query = ''] = h.replace(/^#/, '').split('?');
  const [, a, b] = path.split('/');
  const q = new URLSearchParams(query);
  const filter = {
    productId: q.get('produk'),
    warehouseId: q.get('gudang'),
    view: q.get('view'),
    fill: q.get('isi'),
    moveId: q.get('mutasi'),
  };
  if (a === 'item' && b) return { tab: 'warehouses', view: { name: 'detail', id: b }, filter };
  if (a === 'kartu') return { tab: 'moves', view: { name: 'card' }, filter };
  if (a === 'jurnal') return { tab: 'moves', view: { name: 'journal' }, filter };
  if (a === 'pindah' && b === 'new') return { tab: 'moves', view: { name: 'transfer-new' }, filter };
  if (a === 'pindah' && b) return { tab: 'moves', view: { name: 'transfer', id: b }, filter };
  if (a === 'tab' && tabKeys.includes(b)) return { tab: b, view: { name: 'home' }, filter };
  return { tab: 'warehouses', view: { name: 'home' }, filter };
}

const qs = (v) => {
  const p = new URLSearchParams();
  if (v.productId) p.set('produk', v.productId);
  if (v.warehouseId) p.set('gudang', v.warehouseId);
  if (v.view) p.set('view', v.view);
  if (v.fill) p.set('isi', v.fill);
  if (v.moveId) p.set('mutasi', v.moveId);
  const t = p.toString();
  return t ? `?${t}` : '';
};

export function formatHash(v) {
  switch (v.name) {
    case 'tab':
      return `${v.tab === 'warehouses' ? '#gudang' : `#gudang/tab/${v.tab}`}${qs(v)}`;
    case 'detail':
      return `#gudang/item/${v.id}`;
    case 'card':
      return `#gudang/kartu${qs(v)}`;
    case 'journal':
      return `#gudang/jurnal${qs(v)}`;
    case 'transfer-new':
      return `#gudang/pindah/new${qs(v)}`;
    case 'transfer':
      return `#gudang/pindah/${v.id}`;
    default:
      return '#gudang';
  }
}

export const gudangNavKey = (hash) => `gudang:${parseHash(hash).tab}`;
export const gudangTitle = (hash) => {
  const { tab, view } = parseHash(hash);
  if (view.name === 'card') return 'Kartu Stok';
  if (view.name === 'journal') return 'Jurnal Transaksi';
  if (view.name === 'transfer' || view.name === 'transfer-new') return 'Pindah Barang';
  return gudangTabs.find((t) => t.value === tab).title;
};
