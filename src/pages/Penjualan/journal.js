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

// #23/#24: tiap produk punya akun pendapatan (atau liabilitas) dan akun piutangnya.
// Deposit Fit Out sengaja ke liabilitas: uang titipan yang dikembalikan, bukan pendapatan.
const PRODUCT_ACCOUNTS = {
  'drain-ac': { revenue: '4-20005', receivable: '1-10108' },
  pameran: { revenue: '4-20003', receivable: '1-10108' },
  ipl: { revenue: '4-10001', receivable: '1-10101' },
  sewa: { revenue: '2-20001', receivable: '1-10108' },
  listrik: { revenue: '4-10002', receivable: '1-10104' },
  air: { revenue: '4-10003', receivable: '1-10103' },
  fitout: { revenue: '2-30001', receivable: '1-10108' },
  parkir: { revenue: '4-20007', receivable: '1-10106' },
  // #29: denda keterlambatan masuk pendapatan di luar usaha.
  denda: { revenue: '7-10002', receivable: '1-10105' },
};
const FALLBACK = { revenue: '4-20000', receivable: PIUTANG_UMUM };

export const productAccounts = (productId) => PRODUCT_ACCOUNTS[productId] ?? FALLBACK;
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
export function paymentJournal(sale, payment, index = 0) {
  const akunPiutang = Object.keys(
    sale.items.reduce((acc, l) => {
      acc[productAccounts(l.productId).receivable] = true;
      return acc;
    }, {}),
  );
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
  // Pelunasan mengurangi piutang. Bila fakturnya memakai lebih dari satu akun piutang,
  // pembayaran dibagi rata — pembagian per baris baru mungkin setelah ada buku besar.
  const porsi = round(payment.amount / akunPiutang.length);
  akunPiutang.forEach((code, i) => {
    const nilai = i === akunPiutang.length - 1 ? payment.amount - porsi * (akunPiutang.length - 1) : porsi;
    lines.push({ code, debit: 0, credit: round(nilai), note: 'Pelunasan piutang' });
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
export function paymentReversalJournal(sale, payment, index = 0) {
  if (!payment.cancelledAt) return null;
  const asli = paymentJournal(sale, payment, index);
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
export function returnJournal(ret, sale) {
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
    // Piutang dikurangi di akun piutang produk-produk yang diretur.
    const akunPiutang = [
      ...new Set(
        ret.lines
          .filter((l) => Number(l.qty) > 0)
          .map((l) => productAccounts(sale.items[l.index].productId).receivable),
      ),
    ];
    const porsi = Math.round(dipotong / akunPiutang.length);
    akunPiutang.forEach((code, i) => {
      const nilai =
        i === akunPiutang.length - 1 ? dipotong - porsi * (akunPiutang.length - 1) : porsi;
      lines.push({ code, debit: 0, credit: nilai, note: 'Tagihan dipotong' });
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
export function returnReversal(ret, sale) {
  const asli = returnJournal(ret, sale);
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

export function returnJournals(ret, sale) {
  const out = [];
  const j = returnJournal(ret, sale);
  if (j) out.push(j);
  const v = returnReversal(ret, sale);
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
    jurnal.push(paymentJournal(sale, p, i));
    const balikBayar = paymentReversalJournal(sale, p, i);
    if (balikBayar) jurnal.push(balikBayar);
  });
  returns
    .filter((r) => r.invoiceId === sale.id && !r.draft)
    .forEach((r) => jurnal.push(...returnJournals(r, sale)));
  const balik = reversalJournal(sale);
  if (balik) jurnal.push(balik);
  // Urut menurut tanggal supaya terbaca sebagai riwayat, bukan daftar acak.
  return jurnal.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export const journalTotals = (lines) => ({
  debit: lines.reduce((n, l) => n + l.debit, 0),
  credit: lines.reduce((n, l) => n + l.credit, 0),
});
