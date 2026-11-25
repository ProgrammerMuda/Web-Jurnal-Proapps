// Buku besar prototype: semua jurnal otomatis dari modul transaksi dikumpulkan di satu tempat,
// lalu dipakai laporan (Neraca, nanti Laba Rugi / Buku Besar).
//
// Jurnalnya tetap dibentuk oleh modul masing-masing — fungsi yang sama dengan yang tampil di
// kartu "Jurnal" tiap dokumen — supaya angka di laporan tidak pernah berbeda dengan angka di
// dokumennya. Modul ini hanya menyeragamkan bentuknya dan menjaga satu jurnal tidak terhitung dua kali.
import { accounts } from '@/pages/DaftarAkun/accounts.js';
import { moveJournal } from '@/pages/Gudang/journal.js';
import { formatHash as gudangHash } from '@/pages/Gudang/routes.js';
import { listMoves, MOVE_TYPE } from '@/pages/Gudang/stock.js';
import { invoiceJournal as pbInvoiceJournal, receiptJournal, voucherJournal } from '@/pages/Pembelian/journal.js';
import { formatHash as pembelianHash } from '@/pages/Pembelian/routes.js';
import { isDpInvoice, receiptConfirmed } from '@/pages/Pembelian/utils.js';
import { saleJournals } from '@/pages/Penjualan/journal.js';
import { formatHash as penjualanHash } from '@/pages/Penjualan/routes.js';

export const accountsByCode = Object.fromEntries(accounts.map((a) => [a.code, a]));

// Satu bentuk baris: { code, debit, credit, memo }. Modul memberi nama field yang berbeda-beda.
const norm = (l) => ({
  code: l.code ?? l.account ?? null,
  name: l.name,
  debit: Math.round(l.debit || 0),
  credit: Math.round(l.credit || 0),
  memo: l.memo ?? l.note ?? null,
  // Bagian baris ini yang membayar pembelian aset tetap (hanya di pelunasan PV), untuk Arus Kas.
  ...(l.invest ? { invest: Math.round(l.invest) } : {}),
});
const entry = (e) => ({ ...e, date: (e.date ?? '').slice(0, 10), lines: e.lines.map(norm).filter((l) => l.debit || l.credit) });

function penjualanEntries({ sales = [], salesReturns = [] }) {
  return sales.flatMap((sale) =>
    saleJournals(sale, salesReturns).map((j) => {
      const retur = j.id.startsWith('ret');
      const ret = retur ? salesReturns.find((r) => j.id.endsWith(r.id)) : null;
      return entry({
        id: `pj-${j.id}`,
        module: 'Penjualan',
        date: j.date,
        title: j.title,
        ref: retur ? ret?.number ?? sale.number : sale.number,
        href: retur && ret ? penjualanHash({ name: 'return', id: ret.id }) : penjualanHash({ name: 'invoice', id: sale.id }),
        lines: j.lines,
      });
    }),
  );
}

// Bentuk `pb` yang dibutuhkan fungsi jurnal Pembelian (sama dengan usePb, tanpa hook).
function pbContext(pb) {
  const byId = (list = []) => Object.fromEntries(list.map((d) => [d.id, d]));
  return {
    ...pb,
    vendorsById: byId(pb.vendors),
    posById: byId(pb.pos),
    receiptsById: byId(pb.receipts),
    invoicesById: byId(pb.invoices),
    prsById: byId(pb.prs),
  };
}

function pembelianEntries(rawPb, ctx) {
  if (!rawPb) return { list: [], receiptIds: new Set() };
  const pb = pbContext(rawPb);
  const receiptIds = new Set();
  const list = [];
  (pb.receipts ?? []).filter(receiptConfirmed).forEach((r) => {
    receiptIds.add(r.id);
    list.push(entry({
      id: `pb-rc-${r.id}`,
      module: 'Pembelian',
      date: r.journalDate || r.date,
      title: r.kind === 'jasa' ? 'Penerimaan jasa' : 'Penerimaan barang',
      ref: r.number,
      href: pembelianHash({ name: 'receipt', id: r.id }),
      lines: receiptJournal(r, pb, ctx),
    }));
  });
  // Faktur yang dibatalkan: jurnal dan pembaliknya saling meniadakan, jadi tidak ikut.
  (pb.invoices ?? []).filter((i) => !i.cancelled).forEach((inv) => {
    list.push(entry({
      id: `pb-inv-${inv.id}`,
      module: 'Pembelian',
      date: inv.date,
      title: isDpInvoice(inv) ? 'Faktur uang muka' : 'Faktur pembelian',
      ref: inv.number,
      href: pembelianHash({ name: 'invoice', id: inv.id }),
      lines: pbInvoiceJournal(inv, pb, ctx),
    }));
  });
  // PV baru berjurnal saat pembayarannya dicatat; voucherJournal mengembalikan [] sebelum itu.
  // Baris pelunasan faktur ditandai bagian asetnya, supaya Arus Kas bisa memisahkan pembayaran
  // aset tetap (investasi) dari pembayaran pemasok biasa (operasi).
  const invByNumber = Object.fromEntries((pb.invoices ?? []).map((i) => [i.number, i]));
  const shares = new Map();
  const shareOf = (inv) => {
    if (!shares.has(inv.id)) shares.set(inv.id, investShare(inv, pb, ctx));
    return shares.get(inv.id);
  };
  (pb.vouchers ?? []).forEach((v) => {
    const lines = voucherJournal(v, pb).map((l) => {
      const inv = l.debit && invByNumber[(l.memo ?? '').match(/^Pelunasan (\S+)$/)?.[1]];
      const share = inv ? shareOf(inv) : 0;
      return share ? { ...l, invest: l.debit * share } : l;
    });
    if (!lines.length) return;
    list.push(entry({
      id: `pb-pv-${v.id}`,
      module: 'Pembelian',
      date: v.journalPostedAt || v.paidAt || v.date,
      title: 'Pembayaran vendor',
      ref: v.number,
      href: pembelianHash({ name: 'voucher', id: v.id }),
      lines,
    }));
  });
  return { list, receiptIds };
}

// Porsi faktur (0–1) yang berasal dari penerimaan aset tetap / aset lainnya: nilai DPP baris
// faktur yang penerimaannya didebit ke akun aset, dibagi DPP seluruh baris. PPN ikut proporsional.
// Faktur uang muka dan pelepasan retensi dianggap pembayaran pemasok biasa.
const INVEST_CATS = ['Aktiva Tetap', 'Aktiva Lainnya'];
function investShare(inv, pb, ctx) {
  if (isDpInvoice(inv) || !inv.lines?.length) return 0;
  let all = 0;
  let aset = 0;
  for (const l of inv.lines) {
    const dpp = (l.qty ?? 0) * (l.price ?? 0);
    all += dpp;
    const receipt = l.receiptId ? pb.receiptsById?.[l.receiptId] : null;
    const rl = receipt?.lines.find((x) => x.itemId === l.itemId);
    if (!rl) continue;
    const debit = receiptJournal({ ...receipt, lines: [rl] }, pb, ctx).filter((x) => x.debit > 0);
    if (debit.some((x) => INVEST_CATS.includes(accountsByCode[x.code ?? x.account]?.category))) aset += dpp;
  }
  return all > 0 ? aset / all : 0;
}

// Mutasi stok. Penerimaan barang yang sudah dijurnal lewat FPB-nya di Pembelian tidak dihitung
// lagi di sini: jurnal FPB memakai mutasi yang sama (lihat Pembelian/journal.js).
function gudangEntries({ stockMoves = [], products = [] }, skipReceipts) {
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  return listMoves(stockMoves)
    .filter((m) => !(m.type === 'receipt' && skipReceipts.has(m.sourceId)))
    .map((m) => entry({
      id: `gd-${m.id}`,
      module: 'Gudang',
      date: m.date,
      title: MOVE_TYPE[m.type]?.label ?? m.type,
      ref: m.sourceNo,
      href: gudangHash({ name: 'journal', moveId: m.id }),
      lines: moveJournal(m, byId[m.productId], m.amount, { residual: m.residual }),
    }))
    .filter((e) => e.lines.length);
}

export function buildLedger(data) {
  const ctx = { stockMoves: data.stockMoves, products: data.products };
  const pb = pembelianEntries(data.pb, ctx);
  const list = [...penjualanEntries(data), ...pb.list, ...gudangEntries(data, pb.receiptIds)]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  // Nomor jurnal ("Jurnal Transaksi #17001") berurutan menurut tanggal jurnal, seperti nomor urut
  // di aplikasi produksi. Tautan memakai `id` (tetap), bukan nomor ini, karena dokumen bertanggal
  // mundur menggeser urutannya.
  return list.map((e, i) => ({ ...e, no: JOURNAL_NO_START + i, journalHref: journalPage(e) }));
}

const JOURNAL_NO_START = 17001;
// Halaman detail jurnal: modul yang punya halaman Jurnal Transaksi sendiri membukanya di sana,
// selebihnya (Penjualan) di halaman jurnal Daftar Akun. Bentuk halamannya sama (JournalView).
function journalPage(e) {
  const pb = e.id.match(/^pb-(rc|inv|pv)-(.+)$/);
  if (pb) return pembelianHash({ name: 'journal', kind: { rc: 'receipt', inv: 'invoice', pv: 'pv' }[pb[1]], id: pb[2] });
  if (e.id.startsWith('gd-')) return gudangHash({ name: 'journal', moveId: e.id.slice(3) });
  return `#daftar-akun/jurnal/${encodeURIComponent(e.id)}`;
}

// --- Neraca -------------------------------------------------------------------------------------
// Pemetaan kategori akun (Daftar Akun) ke pos neraca. Kategori laba rugi tidak tampil per akun:
// selisihnya masuk Ekuitas sebagai Laba Tahun Berjalan (tahun ini) dan Laba Ditahan (tahun lalu).
export const BS_SECTIONS = [
  {
    key: 'aset',
    label: 'Aset (Aktiva)',
    sign: 1,
    groups: [
      { key: 'lancar', label: 'Aset Lancar', cats: ['Kas & Bank', 'Akun Piutang', 'Persediaan', 'Aktiva Lancar Lainnya'] },
      { key: 'tidakLancar', label: 'Aset Tidak Lancar', cats: ['Aktiva Tetap', 'Aktiva Lainnya'] },
      { key: 'penyusutan', label: 'Akumulasi Penyusutan', cats: ['Depresiasi & Amortisasi'] },
    ],
  },
  {
    key: 'liabilitas',
    label: 'Liabilitas (Kewajiban)',
    sign: -1,
    groups: [
      { key: 'pendek', label: 'Jangka Pendek', cats: ['Akun Hutang', 'Kewajiban Lancar Lainnya', 'Cerukan Bank'] },
      { key: 'panjang', label: 'Jangka Panjang', cats: ['Kewajiban Jangka Panjang'] },
    ],
  },
  {
    key: 'ekuitas',
    label: 'Ekuitas (Modal)',
    sign: -1,
    groups: [{ key: 'modal', label: 'Ekuitas', cats: ['Ekuitas'] }],
  },
];
export const PL_CATS = ['Pendapatan', 'Harga Pokok Penjualan', 'Beban', 'Pendapatan Lainnya', 'Beban Lainnya'];
export const LABA_DITAHAN = '3-10002';
// Rekening Kas & Bank yang saldonya kredit (minus) adalah cerukan (overdraft): utang ke bank yang
// harus dibayar sewaktu-waktu. PSAK 1 tidak membolehkan aset dan liabilitas saling hapus, jadi
// di neraca rekening itu pindah ke Liabilitas Jangka Pendek dengan kategori ini. Saldo akunnya
// sendiri tidak berubah; hanya penyajiannya.
export const OVERDRAFT_CAT = 'Cerukan Bank';

const groupOfCat = Object.fromEntries(
  BS_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.cats.map((c) => [c, { section: s, group: g }]))),
);

export function balanceSheet(ledger, asOf) {
  const yearStart = `${asOf.slice(0, 4)}-01-01`;
  const sums = new Map();
  let labaBerjalan = 0;
  let labaLalu = 0;
  let count = 0;
  const modules = {};
  for (const e of ledger) {
    if (!e.date || e.date > asOf) continue;
    count += 1;
    modules[e.module] = (modules[e.module] ?? 0) + 1;
    for (const l of e.lines) {
      const a = accountsByCode[l.code];
      if (a && PL_CATS.includes(a.category)) {
        const laba = l.credit - l.debit;
        if (e.date >= yearStart) labaBerjalan += laba;
        else labaLalu += laba;
        continue;
      }
      const key = l.code ?? `?${l.name}`;
      const cur = sums.get(key) ?? { code: l.code, name: a?.name ?? l.name ?? 'Akun tidak dikenal', category: a?.category ?? null, debit: 0, credit: 0, n: 0 };
      cur.debit += l.debit;
      cur.credit += l.credit;
      cur.n += 1;
      sums.set(key, cur);
    }
  }

  const rows = [...sums.values()].map((r) => (
    r.category === 'Kas & Bank' && Math.round(r.debit - r.credit) < 0 ? { ...r, category: OVERDRAFT_CAT, overdraft: true } : r
  ));
  const unmapped = rows.filter((r) => !groupOfCat[r.category]).map((r) => ({ ...r, balance: r.debit - r.credit }));
  const sections = BS_SECTIONS.map((s) => {
    const groups = s.groups.map((g) => {
      let accts = rows
        .filter((r) => g.cats.includes(r.category))
        .map((r) => ({ ...r, balance: s.sign * (r.debit - r.credit) }));
      if (g.key === 'modal') {
        // Laba Ditahan = saldo akunnya + laba rugi tahun-tahun sebelumnya yang belum ditutup.
        const ld = accts.find((r) => r.code === LABA_DITAHAN);
        accts = accts.filter((r) => r.code !== LABA_DITAHAN);
        accts.push({ code: LABA_DITAHAN, name: accountsByCode[LABA_DITAHAN]?.name ?? 'Laba Ditahan', category: 'Ekuitas', balance: (ld?.balance ?? 0) + labaLalu, derived: !ld, n: ld?.n ?? 0, extra: labaLalu });
        accts.push({ code: null, name: 'Laba Tahun Berjalan', category: 'Ekuitas', balance: labaBerjalan, derived: true, n: 0 });
      }
      accts.sort((a, b) => (a.code ?? '9').localeCompare(b.code ?? '9'));
      return { ...g, accounts: accts, total: accts.reduce((n, r) => n + r.balance, 0) };
    });
    return { ...s, groups, total: groups.reduce((n, g) => n + g.total, 0) };
  });
  const by = Object.fromEntries(sections.map((s) => [s.key, s]));
  const g = (s, k) => by[s].groups.find((x) => x.key === k).total;
  const aset = by.aset.total + unmapped.reduce((n, r) => n + r.balance, 0);
  const liab = by.liabilitas.total;
  const ekuitas = by.ekuitas.total;
  return {
    asOf,
    sections,
    unmapped,
    labaBerjalan,
    labaLalu,
    overdrafts: rows.filter((r) => r.overdraft).map((r) => ({ code: r.code, name: r.name, balance: r.credit - r.debit })),
    count,
    modules,
    totals: {
      aset,
      asetLancar: g('aset', 'lancar'),
      asetTidakLancar: g('aset', 'tidakLancar'),
      penyusutan: g('aset', 'penyusutan'),
      liab,
      liabPendek: g('liabilitas', 'pendek'),
      liabPanjang: g('liabilitas', 'panjang'),
      ekuitas,
      selisih: aset - (liab + ekuitas),
    },
  };
}

// Mutasi satu akun sampai tanggal laporan, dengan saldo berjalan menurut sisi pos neracanya.
// `from` (opsional) membatasi ke satu rentang, dipakai Laba Rugi: mutasi sebelum `from` dilewati
// dan saldo berjalan mulai dari 0. Neraca tidak mengisinya, jadi tetap menjumlah sejak awal.
export function accountMutations(ledger, code, asOf, sign = 1, from = null) {
  let saldo = 0;
  const out = [];
  for (const e of ledger) {
    if (!e.date || e.date > asOf || (from && e.date < from)) continue;
    for (const l of e.lines) {
      if (l.code !== code) continue;
      saldo += sign * (l.debit - l.credit);
      out.push({ entry: e, line: l, saldo });
    }
  }
  return out;
}

// Rincian laba rugi per akun (untuk menjelaskan baris Laba Tahun Berjalan / Laba Ditahan).
export function profitBreakdown(ledger, from, to) {
  const map = new Map();
  for (const e of ledger) {
    if (!e.date || e.date > to || (from && e.date < from)) continue;
    for (const l of e.lines) {
      const a = accountsByCode[l.code];
      if (!a || !PL_CATS.includes(a.category)) continue;
      const cur = map.get(l.code) ?? { code: l.code, name: a.name, category: a.category, amount: 0 };
      cur.amount += l.credit - l.debit;
      map.set(l.code, cur);
    }
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
}

// --- Laba Rugi ----------------------------------------------------------------------------------
// Satu seksi per kategori laba rugi. `normal` menentukan cara tampil: akun bersaldo normal kredit
// (pendapatan) tampil apa adanya, akun bersaldo normal debit (HPP, beban) dibalik tandanya, jadi
// "Beban gaji 5.000.000" dan bukan "(5.000.000)". Angka dalam kurung berarti saldo berlawanan.
export const PL_SECTIONS = [
  { key: 'pendapatan', label: 'Pendapatan usaha', cats: ['Pendapatan'], normal: 'credit' },
  { key: 'hpp', label: 'Harga pokok penjualan', cats: ['Harga Pokok Penjualan'], normal: 'debit' },
  { key: 'beban', label: 'Beban operasional', cats: ['Beban'], normal: 'debit' },
  { key: 'lainMasuk', label: 'Pendapatan lain-lain', cats: ['Pendapatan Lainnya'], normal: 'credit' },
  { key: 'lainKeluar', label: 'Beban lain-lain', cats: ['Beban Lainnya'], normal: 'debit' },
  { key: 'pajak', label: 'Beban pajak penghasilan', cats: ['Beban Lainnya'], normal: 'debit', codes: ['8-20002', '8-20003'] },
];
// Beban pajak penghasilan badan (PSAK 46): pajak kini dan pajak tangguhan. Di Daftar Akun keduanya
// sub-akun Beban Lainnya, tapi di laba rugi disajikan sesudah "Laba sebelum pajak", bukan di
// beban lain-lain. PPh final (8-20004) dan pajak lain bukan pajak penghasilan menurut PSAK 46,
// jadi tetap di beban.
export const INCOME_TAX_CODES = PL_SECTIONS.find((s) => s.key === 'pajak').codes;

// Laba rugi rentang [from, to]. Seluruh hitungan memakai profitBreakdown (kredit − debit per
// akun), fungsi yang sama dengan rincian Laba Tahun Berjalan di Neraca. Dengan begitu laba bersih
// 1 Jan s.d. X selalu sama dengan Laba Tahun Berjalan di Neraca per X.
export function incomeStatement(ledger, from, to) {
  const rows = profitBreakdown(ledger, from, to);
  let count = 0;
  const modules = {};
  for (const e of ledger) {
    if (!e.date || e.date > to || (from && e.date < from)) continue;
    count += 1;
    modules[e.module] = (modules[e.module] ?? 0) + 1;
  }
  const sections = PL_SECTIONS.map((s) => {
    const sign = s.normal === 'credit' ? 1 : -1;
    const accounts = rows
      .filter((r) => (s.codes ? s.codes.includes(r.code) : s.cats.includes(r.category) && !INCOME_TAX_CODES.includes(r.code)))
      .map((r) => ({ ...r, balance: sign * r.amount }));
    return { ...s, sign, accounts, total: accounts.reduce((n, a) => n + a.balance, 0) };
  });
  const t = Object.fromEntries(sections.map((s) => [s.key, s.total]));
  const labaKotor = t.pendapatan - t.hpp;
  const labaOperasional = labaKotor - t.beban;
  const labaSebelumPajak = labaOperasional + t.lainMasuk - t.lainKeluar;
  const labaBersih = labaSebelumPajak - t.pajak;
  return {
    from,
    to,
    sections,
    count,
    modules,
    totals: { ...t, labaKotor, labaOperasional, labaSebelumPajak, labaBersih },
  };
}

// --- Neraca Saldo -------------------------------------------------------------------------------
// Urutan kategori mengikuti Daftar Akun (Kas & Bank … Beban Lainnya).
export const CATEGORY_ORDER = [...new Set(accounts.map((a) => a.category))];
const sideOf = (net) => (net >= 0 ? { debit: net, credit: 0 } : { debit: 0, credit: -net });

// Saldo awal, mutasi, dan saldo akhir setiap akun untuk satu rentang tanggal.
// Saldo awal = semua jurnal sebelum `from`. Akun laba rugi hanya membawa saldo sejak 1 Januari
// tahun `from`; laba rugi tahun-tahun sebelumnya belum ditutup, jadi dipindah ke saldo awal
// Laba Ditahan, sama seperti di Neraca. Saldo awal dan akhir ditulis bersih di satu sisi.
// `all` = tampilkan juga akun Daftar Akun yang tidak punya saldo maupun mutasi.
export function trialBalance(ledger, from, to, { all = false } = {}) {
  const yearStart = `${from.slice(0, 4)}-01-01`;
  const map = new Map();
  const get = (code, name) => {
    const key = code ?? `?${name}`;
    let r = map.get(key);
    if (!r) {
      const a = accountsByCode[code];
      r = { key, code, name: a?.name ?? name ?? 'Akun tidak dikenal', category: a?.category ?? null, open: 0, debit: 0, credit: 0, n: 0 };
      map.set(key, r);
    }
    return r;
  };
  let count = 0;
  const modules = {};
  for (const e of ledger) {
    if (!e.date || e.date > to) continue;
    const inRange = e.date >= from;
    if (inRange) {
      count += 1;
      modules[e.module] = (modules[e.module] ?? 0) + 1;
    }
    for (const l of e.lines) {
      const net = l.debit - l.credit;
      if (inRange) {
        const r = get(l.code, l.name);
        r.debit += l.debit;
        r.credit += l.credit;
        r.n += 1;
      } else if (PL_CATS.includes(accountsByCode[l.code]?.category) && e.date < yearStart) {
        get(LABA_DITAHAN, 'Laba Ditahan').open += net;
      } else {
        get(l.code, l.name).open += net;
      }
    }
  }
  if (all) accounts.forEach((a) => get(a.code, a.name));

  const rank = (c) => { const i = CATEGORY_ORDER.indexOf(c); return i < 0 ? CATEGORY_ORDER.length : i; };
  const rows = [...map.values()]
    .map((r) => {
      const close = r.open + r.debit - r.credit;
      const o = sideOf(r.open);
      const c = sideOf(close);
      return { ...r, close, openDebit: o.debit, openCredit: o.credit, closeDebit: c.debit, closeCredit: c.credit };
    })
    .sort((a, b) => rank(a.category) - rank(b.category) || String(a.code ?? '~').localeCompare(String(b.code ?? '~')));

  const sum = (list) => {
    const t = { openDebit: 0, openCredit: 0, debit: 0, credit: 0, closeDebit: 0, closeCredit: 0 };
    list.forEach((r) => { Object.keys(t).forEach((k) => { t[k] += r[k]; }); });
    return t;
  };
  const groups = [];
  rows.forEach((r) => {
    const label = r.category ?? 'Tanpa kategori';
    let g = groups[groups.length - 1];
    if (!g || g.label !== label) { g = { key: label, label, rows: [] }; groups.push(g); }
    g.rows.push(r);
  });
  groups.forEach((g) => Object.assign(g, sum(g.rows)));
  const totals = sum(rows);
  return {
    from,
    to,
    groups,
    totals,
    count,
    modules,
    selisih: {
      open: totals.openDebit - totals.openCredit,
      move: totals.debit - totals.credit,
      close: totals.closeDebit - totals.closeCredit,
    },
  };
}

// --- Detail akun --------------------------------------------------------------------------------
// Kode akun beserta seluruh sub-akunnya (akun induk menjumlah jurnal anak-anaknya).
export function accountFamily(code) {
  const out = [code];
  for (let i = 0; i < out.length; i += 1) accounts.forEach((a) => { if (a.parent === out[i]) out.push(a.code); });
  return out;
}

// Buku besar satu akun untuk satu rentang: saldo awal, baris mutasi dengan saldo berjalan, dan
// saldo akhir. Saldo mengikuti saldo normal akunnya (kredit untuk kewajiban, ekuitas, pendapatan).
// Akun laba rugi memulai saldo dari 1 Januari tahun `from`, sama seperti Neraca Saldo.
export function accountLedger(ledger, code, from, to) {
  const a = accountsByCode[code];
  const codes = new Set(accountFamily(code));
  const sign = a?.normal === 'kredit' ? -1 : 1;
  const yearStart = `${from.slice(0, 4)}-01-01`;
  const isPL = PL_CATS.includes(a?.category);
  let opening = 0;
  let debit = 0;
  let credit = 0;
  const rows = [];
  const entries = new Set();
  for (const e of ledger) {
    if (!e.date || e.date > to) continue;
    for (const l of e.lines) {
      if (!codes.has(l.code)) continue;
      if (e.date < from) {
        if (!isPL || e.date >= yearStart) opening += sign * (l.debit - l.credit);
        continue;
      }
      debit += l.debit;
      credit += l.credit;
      entries.add(e.id);
      rows.push({ entry: e, line: l });
    }
  }
  let saldo = opening;
  rows.forEach((r) => { saldo += sign * (r.line.debit - r.line.credit); r.saldo = saldo; });
  return { account: a, sign, opening, closing: saldo, debit, credit, rows, count: entries.size, family: codes.size };
}

// --- Buku Besar ---------------------------------------------------------------------------------
// Per akun (urut kategori dan kode, sama dengan Neraca Saldo): saldo awal, setiap baris jurnal di
// rentang tanggal dengan saldo berjalan, dan saldo akhir. Saldo ditulis menurut saldo normal akun
// (akun kredit seperti hutang dan pendapatan bertambah saat dikredit), sama dengan detail akun.
// Saldo awal dan akhir diambil dari trialBalance, jadi selalu sama dengan Neraca Saldo.
export function generalLedger(ledger, from, to) {
  const tb = trialBalance(ledger, from, to);
  const lines = new Map();
  for (const e of ledger) {
    if (!e.date || e.date < from || e.date > to) continue;
    e.lines.forEach((l) => {
      const key = l.code ?? `?${l.name}`;
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key).push({ entry: e, line: l });
    });
  }
  const groups = tb.groups.map((g) => ({
    key: g.key,
    label: g.label,
    accounts: g.rows.map((r) => {
      const sign = accountsByCode[r.code]?.normal === 'kredit' ? -1 : 1;
      let saldo = sign * r.open;
      const rows = (lines.get(r.key) ?? []).map(({ entry, line }) => {
        saldo += sign * (line.debit - line.credit);
        return { entry, line, saldo };
      });
      return { key: r.key, code: r.code, name: r.name, category: r.category, sign, opening: sign * r.open, debit: r.debit, credit: r.credit, closing: sign * r.close, rows };
    }),
  }));
  return { from, to, groups, totals: { debit: tb.totals.debit, credit: tb.totals.credit }, count: tb.count, modules: tb.modules };
}

// --- Saldo Daftar Akun --------------------------------------------------------------------------
// Saldo setiap akun per `asOf`, menurut saldo normalnya (sama dengan saldo akhir di Neraca Saldo
// dan detail akun): akun neraca dari seluruh jurnal, akun laba rugi sejak 1 Januari, laba rugi
// tahun-tahun sebelumnya masuk Laba Ditahan. Akun induk menjumlah semua sub-akunnya.
export function accountBalances(ledger, asOf) {
  const tb = trialBalance(ledger, `${asOf.slice(0, 4)}-01-01`, asOf, { all: true });
  const close = {};
  tb.groups.forEach((g) => g.rows.forEach((r) => { if (r.code) close[r.code] = r.close; }));
  const out = {};
  accounts.forEach((a) => {
    const sign = a.normal === 'kredit' ? -1 : 1;
    const v = sign * accountFamily(a.code).reduce((n, c) => n + (close[c] ?? 0), 0);
    out[a.code] = Math.round(v * 100) / 100 || 0; // || 0: tanpa -0
  });
  return out;
}

// --- Arus Kas -----------------------------------------------------------------------------------
// Laporan arus kas metode langsung (PSAK 2): setiap jurnal yang menyentuh akun Kas & Bank,
// dikelompokkan menurut akun lawannya. Kas dan setara kas = semua akun Kas & Bank, termasuk
// rekening yang bersaldo minus (cerukan yang bisa ditagih sewaktu-waktu adalah bagian dari kas,
// PSAK 2 par. 8). Pindah dana antar rekening sendiri tidak dihitung sebagai arus kas.
export const isCashAccount = (code) => accountsByCode[code]?.category === 'Kas & Bank';

export const CF_SECTIONS = [
  { key: 'operasi', label: 'Arus kas dari aktivitas operasi', result: 'Kas bersih dari aktivitas operasi' },
  { key: 'investasi', label: 'Arus kas dari aktivitas investasi', result: 'Kas bersih dari aktivitas investasi' },
  { key: 'pendanaan', label: 'Arus kas dari aktivitas pendanaan', result: 'Kas bersih dari aktivitas pendanaan' },
];
const CF_ITEMS = [
  { key: 'pelanggan', section: 'operasi', label: 'Penerimaan dari pelanggan' },
  { key: 'pemasok', section: 'operasi', label: 'Pembayaran kepada pemasok' },
  { key: 'beban', section: 'operasi', label: 'Pembayaran beban operasional' },
  { key: 'pajak', section: 'operasi', label: 'Pembayaran pajak' },
  { key: 'lainOp', section: 'operasi', label: 'Penerimaan (pembayaran) lain-lain' },
  { key: 'asetBeli', section: 'investasi', label: 'Perolehan aset tetap dan aset lainnya' },
  { key: 'asetJual', section: 'investasi', label: 'Hasil pelepasan aset tetap dan aset lainnya' },
  { key: 'modalMasuk', section: 'pendanaan', label: 'Setoran modal' },
  { key: 'modalKeluar', section: 'pendanaan', label: 'Pengambilan modal (prive / dividen)' },
  { key: 'pinjamMasuk', section: 'pendanaan', label: 'Penerimaan pinjaman jangka panjang' },
  { key: 'pinjamKeluar', section: 'pendanaan', label: 'Pembayaran pinjaman jangka panjang' },
];
const CF_INVEST = ['Aktiva Tetap', 'Aktiva Lainnya', 'Depresiasi & Amortisasi'];
const CF_FINANCE = ['Ekuitas', 'Kewajiban Jangka Panjang'];
const isTaxCode = (c = '') => INCOME_TAX_CODES.includes(c) || c.startsWith('2-5') || /^1-1040[4-8]$/.test(c) || c.startsWith('8-2');

// Pos arus kas untuk satu baris lawan kas. `amount` = efek ke kas (+ masuk, − keluar).
function cfItem(code, amount) {
  const c = code ?? '';
  if (isTaxCode(c)) return 'pajak';
  switch (accountsByCode[c]?.category) {
    case 'Akun Piutang':
    case 'Pendapatan':
      return 'pelanggan';
    case 'Akun Hutang':
    case 'Persediaan':
    case 'Harga Pokok Penjualan':
      return 'pemasok';
    case 'Beban':
    case 'Aktiva Lancar Lainnya':
      return 'beban';
    // Uang muka & deposit pelanggan (2-2…, 2-3…) atau biaya yang masih harus dibayar (2-4…).
    case 'Kewajiban Lancar Lainnya':
      return c.startsWith('2-4') ? 'beban' : 'pelanggan';
    case 'Aktiva Tetap':
    case 'Aktiva Lainnya':
    case 'Depresiasi & Amortisasi':
      return amount < 0 ? 'asetBeli' : 'asetJual';
    case 'Ekuitas':
      return amount < 0 ? 'modalKeluar' : 'modalMasuk';
    case 'Kewajiban Jangka Panjang':
      return amount < 0 ? 'pinjamKeluar' : 'pinjamMasuk';
    default:
      return 'lainOp';
  }
}

// Rekonsiliasi metode tidak langsung: laba bersih disesuaikan dengan perubahan akun neraca
// operasi sampai ketemu kas bersih operasi.
const CF_ADJ = [
  { cat: 'Akun Piutang', label: '(Kenaikan) penurunan piutang' },
  { cat: 'Persediaan', label: '(Kenaikan) penurunan persediaan' },
  { cat: 'Aktiva Lancar Lainnya', label: '(Kenaikan) penurunan aset lancar lainnya' },
  { cat: 'Akun Hutang', label: 'Kenaikan (penurunan) utang usaha' },
  { cat: 'Kewajiban Lancar Lainnya', label: 'Kenaikan (penurunan) liabilitas lancar lainnya' },
  { cat: null, label: 'Perubahan akun lainnya' },
];

export function cashFlow(ledger, from, to) {
  const items = Object.fromEntries(CF_ITEMS.map((i) => [i.key, { ...i, amount: 0, inflow: 0, outflow: 0, rows: [] }]));
  const accts = new Map();
  const acc = (code) => {
    if (!accts.has(code)) accts.set(code, { code, name: accountsByCode[code]?.name ?? code, opening: 0, inflow: 0, outflow: 0 });
    return accts.get(code);
  };
  const adj = Object.fromEntries(CF_ADJ.map((a) => [a.cat ?? '', 0]));
  const nonCash = { penyusutan: 0, investasi: 0, pendanaan: 0, rows: [] };
  const transfers = [];
  const modules = {};
  let opening = 0;
  let laba = 0;
  let count = 0;
  let investPaid = 0;

  for (const e of ledger) {
    if (!e.date || e.date > to) continue;
    const cash = e.lines.filter((l) => isCashAccount(l.code));
    if (e.date < from) {
      cash.forEach((l) => { const v = l.debit - l.credit; opening += v; acc(l.code).opening += v; });
      continue;
    }
    const other = e.lines.filter((l) => !isCashAccount(l.code));

    // Rekonsiliasi (semua jurnal periode): laba, perubahan akun operasi, transaksi non-kas.
    for (const l of other) {
      const cat = accountsByCode[l.code]?.category;
      const v = l.credit - l.debit;
      if (PL_CATS.includes(cat)) laba += v;
      else if (CF_INVEST.includes(cat) || CF_FINANCE.includes(cat)) {
        if (cash.length) continue;
        if (cat === 'Depresiasi & Amortisasi') nonCash.penyusutan += v;
        else if (CF_INVEST.includes(cat)) nonCash.investasi += v;
        else nonCash.pendanaan += v;
      } else adj[CF_ADJ.some((a) => a.cat === cat) ? cat : ''] += v;
    }
    if (!cash.length) {
      const inv = other.filter((l) => [...CF_INVEST, ...CF_FINANCE].includes(accountsByCode[l.code]?.category) && accountsByCode[l.code]?.category !== 'Depresiasi & Amortisasi');
      if (inv.length) nonCash.rows.push({ entry: e, lines: inv });
      continue;
    }

    count += 1;
    modules[e.module] = (modules[e.module] ?? 0) + 1;
    cash.forEach((l) => { const a = acc(l.code); a.inflow += l.debit; a.outflow += l.credit; });
    if (!other.length) { transfers.push(e); continue; }

    // Baris pajak ikut pos baris operasi terbesar di jurnal yang sama (PPN bagian dari tagihan
    // pelanggan / pemasok); jurnal yang isinya pajak saja masuk "Pembayaran pajak".
    const lines = other.flatMap((l) => {
      const v = l.credit - l.debit;
      if (!l.invest) return [{ l, v, item: cfItem(l.code, v) }];
      // Pelunasan faktur aset tetap: bagian asetnya investasi, sisanya pembayaran pemasok.
      investPaid += l.invest;
      return [{ l, v: -l.invest, item: 'asetBeli' }, { l, v: v + l.invest, item: cfItem(l.code, v) }];
    });
    const main = lines
      .filter((x) => !isTaxCode(x.l.code) && CF_ITEMS.find((i) => i.key === x.item).section === 'operasi')
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))[0];
    const perItem = {};
    lines.forEach((x) => {
      const key = isTaxCode(x.l.code) && main ? main.item : x.item;
      perItem[key] = (perItem[key] ?? 0) + x.v;
    });
    Object.entries(perItem).forEach(([key, v]) => {
      if (!Math.round(v)) return;
      const it = items[key];
      it.amount += v;
      if (v > 0) it.inflow += v; else it.outflow -= v;
      it.rows.push({ entry: e, amount: v });
    });
  }

  const sections = CF_SECTIONS.map((s) => {
    const list = CF_ITEMS.filter((i) => i.section === s.key).map((i) => items[i.key]);
    return { ...s, items: list, total: list.reduce((n, i) => n + i.amount, 0) };
  });
  const t = Object.fromEntries(sections.map((s) => [s.key, s.total]));
  const net = t.operasi + t.investasi + t.pendanaan;
  const accounts = [...accts.values()]
    .map((a) => ({ ...a, closing: a.opening + a.inflow - a.outflow }))
    .sort((a, b) => a.code.localeCompare(b.code));
  const adjustments = [
    { key: 'penyusutan', label: 'Penyusutan dan amortisasi', amount: nonCash.penyusutan },
    ...CF_ADJ.map((a) => ({ key: a.cat ?? 'lain', label: a.label, amount: adj[a.cat ?? ''] })),
    { key: 'nonkasInv', label: 'Perolehan aset tanpa pembayaran tunai', amount: nonCash.investasi },
    { key: 'utangAset', label: 'Pelunasan utang pembelian aset (masuk aktivitas investasi)', amount: investPaid },
    { key: 'nonkasFin', label: 'Transaksi ekuitas / pinjaman tanpa kas (mis. saldo awal)', amount: nonCash.pendanaan },
  ];
  return {
    from,
    to,
    sections,
    opening,
    net,
    closing: opening + net,
    accounts,
    transfers,
    nonCash: nonCash.rows,
    indirect: { laba, adjustments, operasi: laba + adjustments.reduce((n, a) => n + a.amount, 0) },
    count,
    modules,
    totals: { ...t, net, opening, closing: opening + net, inflow: CF_ITEMS.reduce((n, i) => n + items[i.key].inflow, 0), outflow: CF_ITEMS.reduce((n, i) => n + items[i.key].outflow, 0) },
  };
}
