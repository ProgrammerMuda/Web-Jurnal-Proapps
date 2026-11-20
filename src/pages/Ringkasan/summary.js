// B4: angka Ringkasan dihitung dari data yang sama dengan halaman Faktur Penjualan,
// bukan dari daftar dummy tersendiri. Sebelumnya dua halaman itu punya sumbernya
// masing-masing, jadi "95 faktur / piutang Rp131 jt" di sini tidak pernah cocok dengan
// "11 faktur / Rp15 jt" di sana.
//
// Yang belum bisa dihitung dari store — posisi keuangan dan jejak audit buku besar —
// masih memakai contoh di data.js, karena buku besarnya memang belum ada.
import { useMemo } from 'react';
import { useData } from '@/lib/store.jsx';
import { accounts } from '@/pages/DaftarAkun/accounts.js';
import { isPostable, TODAY } from '@/pages/Penjualan/data.js';
import { allPayments, cashReceived } from '@/pages/Penjualan/payments.js';
import { toCustomer } from '@/pages/Kontak/utils.js';
import {
  computeTotals,
  formatDate,
  isOverdue,
  rupiah,
  rupiahShort,
  statusOf,
} from '@/pages/Penjualan/utils.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const monthKey = (iso) => (iso ?? '').slice(0, 7);
const pct = (bagian, total) => (total > 0 ? Math.round((bagian / total) * 100) : 0);
const sum = (list, f) => list.reduce((n, x) => n + f(x), 0);

// Enam bulan terakhir sampai bulan berjalan, mis. ["2026-06", … , "2026-11"].
function lastSixMonths(today = TODAY) {
  const [y, m] = today.split('-').map(Number);
  const keys = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    keys.push(d.toISOString().slice(0, 7));
  }
  return keys;
}

const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
};

// Umur piutang dihitung dari jatuh tempo ke tanggal aplikasi.
const daysLate = (dueDate) =>
  Math.floor((new Date(`${TODAY}T00:00:00Z`) - new Date(`${dueDate}T00:00:00Z`)) / 86400000);

const AGING_BUCKETS = [
  { label: 'Belum jatuh tempo', max: 0, color: 'primary.3' },
  { label: 'Terlambat 1–30 hari', max: 30, color: 'yellow.5' },
  { label: 'Terlambat 31–60 hari', max: 60, color: 'orange.6' },
  { label: 'Terlambat > 60 hari', max: Infinity, color: 'red.6' },
];

export function buildSummary(sales, contactsById) {
  // Dasar yang sama dengan kartu statistik di halaman Faktur: draf belum menagih,
  // faktur batal berhenti menagih.
  const terbit = sales.filter((s) => !['draft', 'cancelled'].includes(statusOf(s)));
  const draf = sales.filter((s) => statusOf(s) === 'draft');
  const totals = new Map(terbit.map((s) => [s.id, computeTotals(s)]));
  const t = (s) => totals.get(s.id);

  const belumLunas = terbit.filter((s) => t(s).balance > 0);
  const piutang = sum(belumLunas, (s) => t(s).balance);
  const ditagihkan = sum(terbit, (s) => t(s).billed);
  const diterima = sum(terbit, (s) => t(s).paid);

  const telat = terbit.filter(isOverdue);
  const piutangTelat = sum(telat, (s) => t(s).balance);

  const bulanIni = terbit.filter((s) => monthKey(s.date) === monthKey(TODAY));
  const penjualanBulanIni = sum(bulanIni, (s) => t(s).total);

  // --- enam bulan: ditagihkan vs kas yang benar-benar diterima -------------------
  const pembayaran = allPayments(sales);
  const keys = lastSixMonths();
  const months = keys.map((k) => ({
    key: k,
    m: monthLabel(k),
    billed: sum(terbit.filter((s) => monthKey(s.date) === k), (s) => t(s).total),
    paid: sum(pembayaran.filter((p) => monthKey(p.date) === k), cashReceived),
  }));
  const puncak = Math.max(...months.map((d) => Math.max(d.billed, d.paid)), 0);
  // Sumbu dibulatkan ke atas supaya batang tertinggi tidak menempel ke tepi.
  const maxJuta = puncak > 0 ? Math.ceil(puncak / 1e6 / 4) * 4 : 4;

  // --- umur piutang --------------------------------------------------------------
  const agingRows = AGING_BUCKETS.map((b, i) => {
    const bawah = i === 0 ? -Infinity : AGING_BUCKETS[i - 1].max;
    const anggota = belumLunas.filter((s) => {
      const hari = daysLate(s.dueDate);
      return i === 0 ? hari <= 0 : hari > bawah && hari <= b.max;
    });
    const amount = sum(anggota, (s) => t(s).balance);
    return { label: b.label, color: b.color, invoices: anggota.length, amount, pct: pct(amount, piutang) };
  });

  // --- penagihan: per pelanggan, terbesar lebih dulu ------------------------------
  const perPelanggan = new Map();
  belumLunas.forEach((s) => {
    const k = s.customerId ?? '—';
    const ada = perPelanggan.get(k) ?? { key: k, count: 0, amount: 0, due: s.dueDate, late: false };
    ada.count += 1;
    ada.amount += t(s).balance;
    // Jatuh tempo yang ditampilkan adalah yang paling mendesak dari pelanggan itu.
    if (s.dueDate < ada.due) ada.due = s.dueDate;
    ada.late = ada.late || isOverdue(s);
    perPelanggan.set(k, ada);
  });
  const namaPelanggan = (id) => toCustomer(contactsById[id])?.name ?? '—';
  const priority = [...perPelanggan.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((r) => ({ ...r, name: namaPelanggan(r.key), due: formatDate(r.due) }));

  const recentInvoices = [...terbit]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 5)
    .map((s) => ({
      key: s.id,
      name: `${namaPelanggan(s.customerId)} · ${s.number}`,
      count: s.items.length,
      countLabel: `${s.items.length} baris`,
      due: formatDate(s.dueDate),
      amount: t(s).balance > 0 ? t(s).balance : t(s).total,
      late: isOverdue(s),
    }));

  // --- kas & bank dari COA (akun induk tidak ikut, lihat B5) ----------------------
  const kas = accounts.filter((a) => a.bankCash && isPostable(a));
  const kasPositif = sum(kas.filter((a) => a.balance > 0), (a) => a.balance);
  const cashAccounts = [...kas]
    .sort((a, b) => b.balance - a.balance)
    .map((a) => ({
      name: a.name,
      code: a.code,
      amount: a.balance,
      pct: a.balance > 0 ? pct(a.balance, kasPositif) : 0,
    }));
  const saldoKas = sum(kas, (a) => a.balance);

  const kpis = [
    {
      key: 'kas',
      label: 'Saldo Kas & Bank',
      value: rupiahShort(saldoKas),
      sub: `${kas.length} rekening kas & bank aktif`,
      kind: 'bars',
      caption: saldoKas >= 0 ? 'Saldo positif' : 'Saldo negatif',
      bars: cashAccounts.slice(0, 5).map((a) => (kasPositif > 0 ? pct(Math.max(a.amount, 0), kasPositif) : 0)),
    },
    {
      key: 'piutang',
      label: 'Piutang Berjalan',
      value: rupiahShort(piutang),
      sub: `${belumLunas.length} faktur belum lunas`,
      kind: 'ring',
      ring: pct(diterima, ditagihkan),
      caption: 'Tertagih',
    },
    {
      key: 'tempo',
      label: 'Piutang Jatuh Tempo',
      value: rupiahShort(piutangTelat),
      sub: `${telat.length} faktur melewati tempo`,
      kind: 'meter',
      meter: pct(piutangTelat, piutang),
      caption: 'Dari piutang',
    },
    {
      key: 'penjualan',
      label: 'Penjualan Bulan Ini',
      value: rupiahShort(penjualanBulanIni),
      sub: `${bulanIni.length} faktur terbit · ${draf.length} draf`,
      kind: 'bars',
      caption: '6 bulan',
      bars: months.map((d) => (puncak > 0 ? pct(d.billed, puncak) : 0)),
    },
  ];

  return {
    kpis,
    billing: {
      koleksi: pct(diterima, ditagihkan),
      totals: [
        { label: 'Total Ditagihkan (6 Bln)', value: rupiahShort(sum(months, (d) => d.billed)) },
        { label: 'Total Kas Diterima', value: rupiahShort(sum(months, (d) => d.paid)) },
        { label: 'Sisa Belum Tertagih', value: rupiahShort(piutang) },
      ],
      max: maxJuta,
      ticks: [4, 3, 2, 1, 0].map((i) => rupiahShort((maxJuta * i * 1e6) / 4)),
      // Grafiknya memakai satuan juta supaya tinggi batang sebanding dengan sumbunya.
      months: months.map((d) => ({ m: d.m, billed: d.billed / 1e6, paid: d.paid / 1e6 })),
    },
    workToday: [
      { label: 'Faktur Jatuh Tempo', count: String(telat.length), icon: 'shield' },
      { label: 'Faktur Berstatus Draf', count: String(draf.length), icon: 'file' },
      { label: 'Periode Pembukuan', count: 'OPEN', icon: 'calendar', badge: true },
    ],
    priority,
    recentInvoices,
    aging: {
      total: rupiah(piutang),
      invoices: belumLunas.length,
      rows: agingRows,
    },
    cashAccounts,
  };
}

export const useSummary = () => {
  const { sales, contactsById } = useData();
  return useMemo(() => buildSummary(sales, contactsById), [sales, contactsById]);
};
