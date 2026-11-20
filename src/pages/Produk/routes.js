// Rute modul Persediaan (disimpan di hash):
// #produk[/tab/<tab> | /item/<id>]. Tiap tab = satu menu di submenu Persediaan.
export const produkTabs = [
  { value: 'items', label: 'Produk & Jasa', title: 'Produk & Jasa' },
  { value: 'categories', label: 'Kategori Produk', title: 'Kategori Produk' },
  { value: 'units', label: 'Satuan', title: 'Satuan' },
];
const tabKeys = produkTabs.map((t) => t.value);

export function parseHash(h) {
  const [, a, b] = h.replace(/^#/, '').split('?')[0].split('/');
  if (a === 'item' && b) return { tab: 'items', view: { name: 'detail', id: b } };
  if (a === 'tab' && tabKeys.includes(b)) return { tab: b, view: { name: 'home' } };
  return { tab: 'items', view: { name: 'home' } };
}

export function formatHash(v) {
  switch (v.name) {
    case 'tab':
      return v.tab === 'items' ? '#produk' : `#produk/tab/${v.tab}`;
    case 'detail':
      return `#produk/item/${v.id}`;
    default:
      return '#produk';
  }
}

export const produkNavKey = (hash) => `produk:${parseHash(hash).tab}`;
export const produkTitle = (hash) => produkTabs.find((t) => t.value === parseHash(hash).tab).title;
