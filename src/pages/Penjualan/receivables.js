// Piutang usaha: satu sumber angka untuk halaman Piutang, Ringkasan Penjualan, dan Ringkasan
// beranda. Piutang tidak disimpan — ia diturunkan dari faktur (sisa tagihan) supaya tidak ada
// dua sumber kebenaran. Umur dihitung dari tanggal jatuh tempo ke TODAY.
import { accounts } from '@/pages/DaftarAkun/accounts.js';
import { accountBalances, accountFamily, buildLedger } from '@/pages/LaporanKeuangan/ledger.js';
import { TODAY } from './data.js';
import { PIUTANG_UMUM } from './journal.js';
import { orderStatus, orderValueSplit } from './orders.js';
import { customerCredit } from './returns.js';
import { addDays, computeTotals, statusOf } from './utils.js';

// Hari keterlambatan: positif = lewat jatuh tempo, nol/negatif = belum.
export const daysLate = (dueDate, asOf = TODAY) =>
  Math.round((new Date(`${asOf}T00:00:00Z`) - new Date(`${dueDate}T00:00:00Z`)) / 86400000);

// Lima kelompok umur, dipakai semua halaman (keputusan rancangan #1).
export const BUCKETS = [
  { key: 'current', label: 'Belum jatuh tempo', short: 'Belum JT', color: 'green.6', test: (d) => d <= 0 },
  { key: 'd30', label: '1–30 hari', short: '1–30', color: 'yellow.6', test: (d) => d <= 30 },
  { key: 'd60', label: '31–60 hari', short: '31–60', color: 'orange.6', test: (d) => d <= 60 },
  { key: 'd90', label: '61–90 hari', short: '61–90', color: 'red.5', test: (d) => d <= 90 },
  { key: 'old', label: '> 90 hari', short: '> 90', color: 'red.8', test: () => true },
];
export const bucketOf = (late) => BUCKETS.find((b) => b.test(late));

// Faktur yang masih menagih: sudah terbit, tidak batal, dan sisanya di atas nol (keputusan #3).
// Faktur yang diretur sebagai kredit tetap ikut bila sisanya belum tertutup.
export const isOpenSale = (sale) =>
  !['draft', 'cancelled'].includes(statusOf(sale)) && computeTotals(sale).balance > 0;

// Satu baris per faktur terbuka, lengkap dengan angka yang dipakai tabel dan kartu.
export function openSales(sales) {
  return sales.filter(isOpenSale).map((sale) => {
    const t = computeTotals(sale);
    const late = daysLate(sale.dueDate);
    return {
      sale,
      id: sale.id,
      customerId: sale.customerId,
      total: t.billed,
      paid: t.paid,
      balance: t.balance,
      late,
      bucket: bucketOf(late).key,
      future: sale.date > TODAY,
    };
  });
}

const sumBy = (list, f) => list.reduce((n, x) => n + f(x), 0);

// Saringan umur untuk kartu, legend, dan band filter.
export const AGE_FILTERS = [
  { value: 'all', label: 'Semua umur', match: () => true },
  { value: 'overdue', label: 'Lewat jatuh tempo', match: (r) => r.late > 0 },
  { value: 'soon', label: 'Jatuh tempo ≤ 7 hari', match: (r) => r.late <= 0 && r.sale.dueDate <= addDays(TODAY, 7) },
  ...BUCKETS.map((b) => ({ value: b.key, label: b.label, match: (r) => r.bucket === b.key })),
];

// Ringkasan angka kartu: total, lewat jatuh tempo, jatuh tempo 7 hari, dan umur per kelompok.
export function receivableSummary(rows) {
  const total = sumBy(rows, (r) => r.balance);
  const late = rows.filter((r) => r.late > 0);
  const soon = rows.filter(AGE_FILTERS.find((f) => f.value === 'soon').match);
  const buckets = BUCKETS.map((b) => {
    const isi = rows.filter((r) => r.bucket === b.key);
    return { ...b, value: sumBy(isi, (r) => r.balance), count: isi.length };
  });
  return {
    total,
    count: rows.length,
    customers: new Set(rows.map((r) => r.customerId)).size,
    late: { value: sumBy(late, (r) => r.balance), count: late.length, oldest: Math.max(0, ...late.map((r) => r.late)) },
    soon: { value: sumBy(soon, (r) => r.balance), count: soon.length },
    future: rows.filter((r) => r.future),
    buckets,
  };
}

// Rekap per pelanggan: total, per kelompok umur, jumlah faktur, dan kredit yang tersedia.
export function byCustomer(rows, returns = []) {
  const map = new Map();
  rows.forEach((r) => {
    const c = map.get(r.customerId) ?? {
      customerId: r.customerId,
      count: 0,
      lateCount: 0,
      total: 0,
      oldest: 0,
      buckets: Object.fromEntries(BUCKETS.map((b) => [b.key, 0])),
      rows: [],
    };
    c.count += 1;
    c.total += r.balance;
    c.buckets[r.bucket] += r.balance;
    if (r.late > 0) c.lateCount += 1;
    c.oldest = Math.max(c.oldest, r.late);
    c.rows.push(r);
    map.set(r.customerId, c);
  });
  return [...map.values()]
    .map((c) => ({ ...c, credit: customerCredit(returns, c.customerId) }))
    .sort((a, b) => b.total - a.total);
}

// Total kredit pelanggan yang belum terpakai (akun 2-30008). Tidak mengurangi piutang (#5).
export const creditTotal = (returns, customerIds) =>
  sumBy(customerIds, (id) => customerCredit(returns, id));

// Pesanan pelanggan yang belum difakturkan penuh: tagihan yang akan datang, bukan piutang.
export function upcomingOrders(orders, customerId) {
  const list = orders.filter(
    (o) => o.customerId === customerId && ['sent', 'confirmed', 'partial'].includes(orderStatus(o)),
  );
  return { count: list.length, value: sumBy(list, (o) => orderValueSplit(o).remaining) };
}

// Akun piutang di buku besar: keluarga 1-10100 ditambah akun cadangan PIUTANG_UMUM. Hanya akun
// daun yang dijumlahkan, karena saldo akun induk sudah berisi saldo turunannya.
const isLeaf = (code) => !accounts.some((a) => a.parent === code);
export const RECEIVABLE_ACCOUNTS = [...new Set([...accountFamily('1-10100'), PIUTANG_UMUM])].filter(isLeaf);

// Sisa satu faktur per tanggal asOf, memakai aturan yang sama dengan buku besar: hanya faktur,
// pembayaran, retur, dan pembatalan bertanggal <= asOf yang dihitung.
const dayOf = (iso) => (iso ? iso.slice(0, 10) : null);
export function balanceAsOf(sale, asOf = TODAY) {
  if (sale.draft || sale.date > asOf) return 0;
  const batal = dayOf(sale.cancelledAt);
  if (batal && batal <= asOf) return 0;
  const { total } = computeTotals(sale);
  const dibayar = sumBy(
    (sale.payments ?? []).filter((p) => p.date <= asOf && !(dayOf(p.cancelledAt) && dayOf(p.cancelledAt) <= asOf)),
    (p) => p.amount,
  );
  const dipotong = sumBy(
    (sale.returns ?? []).filter((r) => r.date <= asOf),
    (r) => r.deducted ?? (r.settlement === 'deduct' ? r.amount : 0),
  );
  return total - dibayar - dipotong;
}

// Cek ke buku besar per tanggal. Total per faktur (hari ini, termasuk transaksi bertanggal ke
// depan) dikurangi pos rekonsiliasi = sisa faktur per asOf, yang harus sama dengan saldo akun piutang.
export function glCheck(data, rows, asOf = TODAY) {
  const saldo = accountBalances(buildLedger(data), asOf);
  const ledger = sumBy(RECEIVABLE_ACCOUNTS, (code) => saldo[code] ?? 0);
  const perFaktur = sumBy(rows, (r) => r.balance);
  const perTanggal = sumBy(data.sales, (s) => balanceAsOf(s, asOf));
  // Dokumen yang membuat kedua angka berbeda: faktur, pembayaran, retur, atau pembatalan
  // bertanggal setelah asOf.
  const masaDepan = data.sales.filter((s) => !s.draft && Math.round(balanceAsOf(s, asOf)) !== Math.round(s.cancelledAt ? 0 : computeTotals(s).balance));
  return {
    perFaktur,
    future: { count: masaDepan.length, value: perFaktur - perTanggal },
    perTanggal,
    ledger,
    diff: Math.round(perTanggal - ledger),
  };
}
