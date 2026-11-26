// Jurnal otomatis modul Penjualan (#20–#21). Fungsi murni: dari dokumen → baris jurnal.
// Belum ada buku besar, jadi jurnal dibentuk ulang setiap kali dibaca — tidak disimpan.
// Syaratnya tetap dijaga: selalu seimbang, dan tiap baris bisa ditelusuri ke dokumennya.
import { accounts } from '@/pages/DaftarAkun/accounts.js';
import { products, taxes } from './data.js';
import { creditPart, CREDIT_ACCOUNT, deductPart, netUnitPrice } from './returns.js';
import { computeTotals, formatDate, lineAmount, taxRate } from './utils.js';

export const PPN_KELUARAN = '2-50006';
export const DISKON_PENJUALAN = '4-30000';
export const RETUR_PENJUALAN = '4-30001';
export const PIUTANG_UMUM = '1-10206';

// #25: jenis potongan yang biasa dipotong pelanggan saat membayar.
export const WITHHOLDING_TYPES = [
  { value: 'none', label: 'Tanpa potongan', rate: 0, account: null },
  { value: 'pph23', label: 'PPh 23 (2% · jasa)', rate: 0.02, account: '1-10405' },
  {
    value: 'pph4a2',
    label: 'PPh 4 ayat 2 (10% · sewa tanah/bangunan)',
    rate: 0.1,
    // PPh final tidak bisa dikreditkan, jadi masuk beban — bukan pajak dibayar di muka.
    account: '8-20004',
  },
];
export const withholdingType = (v) => WITHHOLDING_TYPES.find((t) => t.value === v);

export const accountName = (code) =>
  accounts.find((a) => a.code === code)?.name ?? 'Akun tidak dikenal';
export const accountLabel = (code) => `${code} · ${accountName(code)}`;

// #23/#24: tiap produk punya akun pendapatan (atau liabilitas) dan akun piutangnya. Keduanya
// milik katalog Produk (saleAccount / arAccount) — satu sumber, jadi mengubahnya di halaman
// Produk ikut mengubah jurnal, dan produk baru langsung memakai akunnya sendiri. Cadangan hanya
// untuk produk yang sudah dihapus dari katalog.
const FALLBACK = { revenue: '4-20000', receivable: PIUTANG_UMUM };

export const productAccounts = (productId) => {
  const p = products.find((x) => x.id === productId);
  return { revenue: p?.saleAccount || FALLBACK.revenue, receivable: p?.arAccount || FALLBACK.receivable };
};

// --- Pembagian piutang per akun ------------------------------------------------------------------
// Faktur bisa memakai beberapa akun piutang (mis. IPL dan Listrik). Pelunasan dan retur harus
// mengurangi akun yang benar, supaya saldo tiap akun piutang habis tepat nol saat fakturnya lunas.
// Urutan kejadian (tanggal, lalu urutan catat) dijalankan ulang dari piutang awal faktur:
//   pembayaran : dibagi menurut sisa piutang tiap akun saat itu
//   retur      : ke akun baris yang diretur, paling banyak sisa akun itu; lebihnya ke akun lain
// Pembayaran / retur yang dibatalkan tidak mengubah sisa (jurnal dan pembaliknya saling
// meniadakan); bagiannya dihitung dari piutang awal / baris returnya.
function splitBy(amount, weights) {
  const codes = Object.keys(weights).filter((c) => weights[c] > 0);
  const total = codes.reduce((n, c) => n + weights[c], 0);
  const out = {};
  if (!codes.length || total <= 0) return out;
  let sisa = round(amount);
  codes.forEach((c, i) => {
    const v = i === codes.length - 1 ? sisa : round((amount * weights[c]) / total);
    out[c] = v;
    sisa -= v;
  });
  return out;
}
const addTo = (a, b) => Object.entries(b).forEach(([c, v]) => { a[c] = (a[c] ?? 0) + v; });

function receivableBase(sale) {
  const j = invoiceJournal(sale);
  const codes = new Set(sale.items.map((l) => productAccounts(l.productId).receivable));
  const base = {};
  (j?.lines ?? []).forEach((l) => { if (codes.has(l.code)) base[l.code] = (base[l.code] ?? 0) + l.debit - l.credit; });
  // Faktur tanpa nilai (atau belum terbit): tetap ada akun tujuannya.
  if (!Object.keys(base).length) codes.forEach((c) => { base[c] = 0; });
  return base;
}

// Nilai retur per akun piutang: nilai bersih baris + PPN-nya.
function returnWeights(ret, sale) {
  const w = {};
  ret.lines.forEach((l) => {
    const qty = Number(l.qty) || 0;
    const asal = sale.items[l.index];
    if (!qty || !asal) return;
    const net = netUnitPrice(sale, asal) * qty;
    const code = productAccounts(asal.productId).receivable;
    w[code] = (w[code] ?? 0) + net * (1 + (taxRate(asal.tax) || 0));
  });
  return w;
}

export function receivableAllocation(sale, returns = []) {
  const base = receivableBase(sale);
  const sisa = { ...base };
  const pay = {};
  const ret = {};
  const events = [
    ...(sale.payments ?? []).map((p, i) => ({ kind: 'pay', key: i, date: p.date, order: i, doc: p })),
    ...returns
      .filter((r) => r.invoiceId === sale.id && !r.draft)
      .map((r, i) => ({ kind: 'ret', key: r.id, date: r.date, order: 1000 + i, doc: r })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.order - b.order));

  for (const e of events) {
    if (e.kind === 'pay') {
      const amount = e.doc.amount ?? 0;
      if (e.doc.cancelledAt) { pay[e.key] = splitBy(amount, base); continue; }
      const terbuka = Object.fromEntries(Object.entries(sisa).map(([c, v]) => [c, Math.max(v, 0)]));
      const dalam = Math.min(amount, Object.values(terbuka).reduce((n, v) => n + v, 0));
      const out = splitBy(dalam, terbuka);
      // Kelebihan bayar (di atas sisa tagihan) dibagi menurut piutang awal.
      if (amount - dalam > 0) addTo(out, splitBy(amount - dalam, base));
      if (!Object.keys(out).length) addTo(out, splitBy(amount, Object.fromEntries(Object.keys(base).map((c) => [c, 1]))));
      Object.entries(out).forEach(([c, v]) => { sisa[c] = (sisa[c] ?? 0) - v; });
      pay[e.key] = out;
    } else {
      const dipotong = deductPart(e.doc);
      if (!(dipotong > 0)) { ret[e.key] = {}; continue; }
      const w = returnWeights(e.doc, sale);
      if (e.doc.cancelledAt) { ret[e.key] = splitBy(dipotong, w); continue; }
      // Ke akun baris yang diretur, dibatasi sisanya; yang tidak muat ke akun lain yang masih terbuka.
      const ingin = splitBy(dipotong, w);
      const out = {};
      let lebih = 0;
      Object.entries(ingin).forEach(([c, v]) => {
        const muat = Math.min(v, Math.max(sisa[c] ?? 0, 0));
        out[c] = muat;
        lebih += v - muat;
      });
      if (lebih > 0) {
        const terbuka = Object.fromEntries(Object.entries(sisa).map(([c, v]) => [c, Math.max(v - (out[c] ?? 0), 0)]));
        const tambahan = splitBy(lebih, terbuka);
        const masuk = Object.values(tambahan).reduce((n, v) => n + v, 0);
        addTo(out, tambahan);
        if (lebih - masuk > 0) addTo(out, splitBy(lebih - masuk, w));
      }
      Object.entries(out).forEach(([c, v]) => { sisa[c] = (sisa[c] ?? 0) - v; });
      ret[e.key] = Object.fromEntries(Object.entries(out).filter(([, v]) => v));
    }
  }
  return { base, pay, ret };
}
export const productName = (productId) =>
  products.find((p) => p.id === productId)?.name ?? productId;

const round = (n) => Math.round(n);

// Jurnal saat faktur terbit (#20). Piutang dipecah per jenis produk sesuai keputusan #24.
export function invoiceJournal(sale) {
  if (sale.draft) return null;
  // Faktur yang dibatalkan tetap punya jurnal aslinya — yang dibalik, bukan dihapus.
  const t = computeTotals(sale);
  const lines = [];

  // Dasar proporsi diskon: diskon memotong seluruh baris secara merata.
  const bruto = sale.items.reduce((n, l) => {
    const rate = taxRate(l.tax);
    const amount = lineAmount(l);
    return n + (sale.taxInclusive && rate ? amount / (1 + rate) : amount);
  }, 0);
  const faktorDiskon = bruto > 0 ? (bruto - t.discount) / bruto : 1;

  // Debit: piutang per jenis produk, sudah dikurangi porsi diskonnya.
  const piutang = {};
  sale.items.forEach((l) => {
    const rate = taxRate(l.tax);
    const amount = lineAmount(l);
    const dpp = sale.taxInclusive && rate ? amount / (1 + rate) : amount;
    const net = dpp * faktorDiskon;
    const ppn = net * rate;
    const akun = productAccounts(l.productId).receivable;
    piutang[akun] = (piutang[akun] ?? 0) + net + ppn;
  });
  Object.entries(piutang).forEach(([code, nilai]) => {
    lines.push({ code, debit: round(nilai), credit: 0, note: 'Tagihan ke pelanggan' });
  });

  // Diskon dicatat sebagai akun tersendiri, bukan mengurangi pendapatan diam-diam.
  if (t.discount > 0) {
    lines.push({
      code: DISKON_PENJUALAN,
      debit: round(t.discount),
      credit: 0,
      note: 'Diskon yang diberikan',
    });
  }

  // Kredit: pendapatan per produk, dicatat kotor sebelum diskon.
  const pendapatan = {};
  sale.items.forEach((l) => {
    const rate = taxRate(l.tax);
    const amount = lineAmount(l);
    const dpp = sale.taxInclusive && rate ? amount / (1 + rate) : amount;
    const akun = productAccounts(l.productId).revenue;
    pendapatan[akun] = (pendapatan[akun] ?? 0) + dpp;
  });
  Object.entries(pendapatan).forEach(([code, nilai]) => {
    // B11: produk yang akunnya liabilitas (deposit, sewa diterima di muka) belum
    // menjadi pendapatan, jadi keterangannya mengikuti jenis akunnya.
    const note = code.startsWith('2-') ? 'Diterima di muka (belum jadi pendapatan)' : 'Pendapatan diakui';
    lines.push({ code, debit: 0, credit: round(nilai), note });
  });

  if (t.tax > 0) {
    lines.push({
      code: PPN_KELUARAN,
      debit: 0,
      credit: round(t.tax),
      note: taxes[0]?.label ?? 'PPN',
    });
  }

  return {
    id: `inv-${sale.id}`,
    title: `Faktur ${sale.number}`,
    date: sale.date,
    source: `Faktur ${sale.number}`,
    lines: balance(lines),
  };
}

// Jurnal saat pembayaran dicatat (#21). PPh yang dipotong pelanggan ikut di sini,
// karena pemotongan terjadi saat membayar — bukan saat faktur terbit.
export function paymentJournal(sale, payment, index = 0, returns = []) {
  const pph = withholdingType(payment.withholdingType);
  // B3: pemakaian kredit pelanggan bukan penerimaan kas, jadi tidak ada PPh di sini —
  // yang terjadi hanya kewajiban kredit ditutup lawan piutang.
  const potongan = payment.fromCredit || !pph?.rate ? 0 : round(payment.amount * pph.rate);
  const lines = [
    {
      code: payment.fromCredit ? CREDIT_ACCOUNT : payment.account,
      debit: round(payment.amount - potongan),
      credit: 0,
      note: payment.fromCredit ? 'Kredit pelanggan dipakai' : (payment.method ?? 'Penerimaan'),
    },
  ];
  if (potongan > 0) {
    lines.push({ code: pph.account, debit: potongan, credit: 0, note: pph.label });
  }
  // Pelunasan mengurangi piutang per akun menurut sisanya (receivableAllocation).
  const bagian = receivableAllocation(sale, returns).pay[index] ?? {};
  Object.entries(bagian).forEach(([code, nilai]) => {
    if (nilai) lines.push({ code, debit: 0, credit: nilai, note: 'Pelunasan piutang' });
  });

  return {
    id: `pay-${sale.id}-${index}`,
    title: `${payment.fromCredit ? 'Pemakaian kredit' : 'Pembayaran'} ${formatDate(payment.date)}`,
    date: payment.date,
    source: `Faktur ${sale.number}`,
    lines: balance(lines),
  };
}

// Selisih pembulatan dibebankan ke baris terakhir supaya jurnal selalu seimbang.
function balance(lines) {
  const debit = lines.reduce((n, l) => n + l.debit, 0);
  const credit = lines.reduce((n, l) => n + l.credit, 0);
  const selisih = debit - credit;
  if (selisih !== 0 && lines.length) {
    const last = lines[lines.length - 1];
    if (last.credit > 0) last.credit += selisih;
    else last.debit -= selisih;
  }
  return lines;
}

// #8: pembatalan tidak menghapus jurnal, melainkan membalikkannya pada tanggal
// pembatalan. Jejak faktur aslinya tetap utuh untuk audit.
export function reversalJournal(sale) {
  const asli = invoiceJournal(sale);
  if (!asli || !sale.cancelledAt) return null;
  return {
    id: `void-${sale.id}`,
    title: `Pembatalan ${sale.number}`,
    date: sale.cancelledAt.slice(0, 10),
    source: sale.cancelReason ? `Alasan: ${sale.cancelReason}` : `Faktur ${sale.number}`,
    lines: asli.lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit, note: `Balik: ${l.note}` })),
  };
}

// B3: pembatalan pembayaran juga tidak menghapus jurnalnya, melainkan membalikkannya
// pada tanggal pembatalan — pola yang sama dengan pembatalan faktur di atas.
export function paymentReversalJournal(sale, payment, index = 0, returns = []) {
  if (!payment.cancelledAt) return null;
  const asli = paymentJournal(sale, payment, index, returns);
  return {
    id: `void-pay-${sale.id}-${index}`,
    title: `Pembatalan pembayaran ${formatDate(payment.date)}`,
    date: payment.cancelledAt.slice(0, 10),
    source: payment.cancelReason ? `Alasan: ${payment.cancelReason}` : `Faktur ${sale.number}`,
    lines: asli.lines.map((l) => ({ ...l, debit: l.credit, credit: l.debit, note: `Balik: ${l.note}` })),
  };
}

// Jurnal retur (bagian 5). Akun debitnya mengikuti akun baris faktur: produk yang
// akunnya liabilitas (mis. Deposit Fit Out) didebit ke akun itu, bukan ke Retur Penjualan.
export function returnJournal(ret, sale, returns = [ret]) {
  if (!sale || ret.draft) return null;
  const lines = [];
  const perAkun = {};
  ret.lines.forEach((l) => {
    const qty = Number(l.qty) || 0;
    if (!qty) return;
    const asal = sale.items[l.index];
    const akunProduk = productAccounts(asal.productId);
    // Pendapatan dikoreksi lewat Retur Penjualan; liabilitas dikoreksi di akunnya sendiri.
    const debit = akunProduk.revenue.startsWith('4-') ? RETUR_PENJUALAN : akunProduk.revenue;
    const net = netUnitPrice(sale, asal) * qty;
    perAkun[debit] = (perAkun[debit] ?? 0) + net;
  });
  Object.entries(perAkun).forEach(([code, nilai]) => {
    lines.push({ code, debit: Math.round(nilai), credit: 0, note: 'Koreksi atas retur' });
  });
  if (ret.tax > 0) {
    lines.push({
      code: PPN_KELUARAN,
      debit: Math.round(ret.tax),
      credit: 0,
      note: 'Koreksi PPN keluaran',
    });
  }

  // B1: nilai retur bisa terbagi — sebagian memotong piutang, sisanya jadi kredit.
  const dipotong = deductPart(ret);
  const jadiKredit = creditPart(ret);

  if (dipotong > 0) {
    // Piutang dikurangi di akun baris yang diretur, sebesar sisanya (receivableAllocation).
    const daftar = returns.some((r) => r.id === ret.id) ? returns : [...returns, ret];
    const bagian = receivableAllocation(sale, daftar).ret[ret.id] ?? {};
    Object.entries(bagian).forEach(([code, nilai]) => {
      if (nilai) lines.push({ code, debit: 0, credit: nilai, note: 'Tagihan dipotong' });
    });
  }
  if (jadiKredit > 0) {
    lines.push({
      code: CREDIT_ACCOUNT,
      debit: 0,
      credit: Math.round(jadiKredit),
      note: 'Kredit untuk pelanggan',
    });
  }

  return {
    id: `ret-${ret.id}`,
    title: `Retur ${ret.number}`,
    date: ret.date,
    source: `Faktur ${sale.number}`,
    lines: balance(lines),
  };
}

// Pembatalan retur: jurnalnya dibalik, dokumennya tetap ada.
export function returnReversal(ret, sale, returns = [ret]) {
  const asli = returnJournal(ret, sale, returns);
  if (!asli || !ret.cancelledAt) return null;
  return {
    id: `ret-void-${ret.id}`,
    title: `Pembatalan retur ${ret.number}`,
    date: ret.cancelledAt.slice(0, 10),
    source: ret.cancelReason ? `Alasan: ${ret.cancelReason}` : `Retur ${ret.number}`,
    lines: asli.lines.map((l) => ({
      ...l,
      debit: l.credit,
      credit: l.debit,
      note: `Balik: ${l.note}`,
    })),
  };
}

export function returnJournals(ret, sale, returns = [ret]) {
  const out = [];
  const j = returnJournal(ret, sale, returns);
  if (j) out.push(j);
  const v = returnReversal(ret, sale, returns);
  if (v) out.push(v);
  return out;
}

// Semua jurnal yang berkaitan dengan satu faktur (#22): faktur, pembayaran, retur,
// dan pembatalan. Retur dikirim dari pemanggil karena dokumennya berdiri sendiri.
export function saleJournals(sale, returns = []) {
  const jurnal = [];
  const faktur = invoiceJournal(sale);
  if (faktur) jurnal.push(faktur);
  (sale.payments ?? []).forEach((p, i) => {
    jurnal.push(paymentJournal(sale, p, i, returns));
    const balikBayar = paymentReversalJournal(sale, p, i, returns);
    if (balikBayar) jurnal.push(balikBayar);
  });
  returns
    .filter((r) => r.invoiceId === sale.id && !r.draft)
    .forEach((r) => jurnal.push(...returnJournals(r, sale, returns)));
  const balik = reversalJournal(sale);
  if (balik) jurnal.push(balik);
  // Urut menurut tanggal supaya terbaca sebagai riwayat, bukan daftar acak.
  return jurnal.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export const journalTotals = (lines) => ({
  debit: lines.reduce((n, l) => n + l.debit, 0),
  credit: lines.reduce((n, l) => n + l.credit, 0),
});
