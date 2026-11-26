// Tugas "Perlu tindakan" Penjualan, diturunkan langsung dari dokumen. Dipakai Ringkasan
// Penjualan dan badge angka di sidebar, supaya keduanya selalu menunjukkan angka yang sama.
import { TODAY } from './data.js';
import { orderStatus } from './orders.js';
import { isExpired, isExpiring, quoteStatus } from './quotes.js';
import { returnStatus } from './returns.js';
import { computeTotals, rupiah, statusOf } from './utils.js';

export const days = (from, to = TODAY) => Math.round((new Date(to) - new Date(from)) / 86400000);
export const sum = (list, f) => list.reduce((n, x) => n + f(x), 0);

// Lewat batas lebih dari 30 hari = berlarut.
const levelOf = (late) => (late > 30 ? 'stale' : late > 0 ? 'warn' : 'ok');

// Tugas yang menunggu tim penjualan / finance, diturunkan langsung dari dokumen.
export function actionsOf({ sales, quotes, orders, salesReturns }, nameOf) {
  const list = [];
  const push = (a) => {
    const late = a.due ? days(a.due) : 0;
    list.push({ ...a, late, level: a.due ? levelOf(late) : levelOf((a.waiting ?? 0) - 7) });
  };
  sales.forEach((s) => {
    const st = statusOf(s);
    const sub = `${s.number || 'Draf'} · ${nameOf(s.customerId)}`;
    if (st === 'draft') {
      push({ id: `d-${s.id}`, title: 'Terbitkan faktur draf', sub, waiting: days(s.date), to: { name: 'invoice', id: s.id } });
    } else if (['issued', 'partial'].includes(st) && s.dueDate <= TODAY) {
      const t = computeTotals(s);
      push({ id: `t-${s.id}`, title: `Tagih sisa ${rupiah(t.balance)}`, sub, due: s.dueDate, to: { name: 'invoice', id: s.id } });
    }
  });
  quotes.forEach((q) => {
    const sub = `${q.number} · ${nameOf(q.customerId)}`;
    if (quoteStatus(q) === 'accepted') {
      push({ id: `qa-${q.id}`, title: 'Buat pesanan / faktur dari penawaran diterima', sub, waiting: days(q.acceptedAt?.slice(0, 10) ?? q.date), to: { name: 'quote', id: q.id } });
    } else if (isExpired(q) || isExpiring(q)) {
      push({ id: `qe-${q.id}`, title: isExpired(q) ? 'Penawaran kedaluwarsa tanpa jawaban' : 'Penawaran hampir kedaluwarsa', sub, due: q.dueDate, to: { name: 'quote', id: q.id } });
    }
  });
  orders.forEach((o) => {
    const st = orderStatus(o);
    const sub = `${o.number} · ${nameOf(o.customerId)}`;
    if (st === 'sent') push({ id: `os-${o.id}`, title: 'Pesanan menunggu konfirmasi pelanggan', sub, waiting: days(o.date), to: { name: 'order', id: o.id } });
    if (['confirmed', 'partial'].includes(st)) push({ id: `oc-${o.id}`, title: st === 'partial' ? 'Fakturkan sisa pesanan' : 'Fakturkan pesanan', sub, due: o.dueDate, to: { name: 'order', id: o.id } });
  });
  salesReturns.forEach((r) => {
    if (returnStatus(r) === 'draft') push({ id: `r-${r.id}`, title: 'Terbitkan retur draf', sub: `${r.number} · ${nameOf(r.customerId)}`, waiting: days(r.date), to: { name: 'return', id: r.id } });
  });
  // Yang paling lama terlambat di atas; yang belum punya batas diurutkan dari lama menunggu.
  return list.sort((a, b) => (b.late || b.waiting || 0) - (a.late || a.waiting || 0));
}


// Halaman pemilik tiap tugas → tab di sidebar.
const TAB_OF = { invoice: 'invoices', quote: 'quotes', order: 'orders', return: 'returns' };

// Jumlah tugas per tab, mis. { invoices: 3, quotes: 2 }.
export function actionCountsByTab(data, nameOf = () => '') {
  const out = {};
  actionsOf(data, nameOf).forEach((a) => {
    const tab = TAB_OF[a.to.name];
    out[tab] = (out[tab] ?? 0) + 1;
  });
  return out;
}
