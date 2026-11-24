// Jurnal modul Pembelian — model tiga titik:
//
//   Penerimaan (FPB/BAPP) : Dr Persediaan / Beban        Cr Barang Diterima Belum Ditagih
//   Faktur                : Dr Belum Ditagih + PPN Masukan  Cr Hutang Usaha, Hutang PPh,
//                                                            Uang Muka Pembelian
//   Faktur uang muka      : Dr Uang Muka Pembelian         Cr Hutang Usaha
//   Payment Voucher       : Dr Hutang Usaha                Cr Kas
//
// Seperti jurnal modul Penjualan, barisnya dibentuk ulang setiap kali dibaca dan tidak
// disimpan: belum ada buku besar. Yang disimpan di dokumen hanya KAPAN jurnalnya diposting.
//
// Jurnal FPB untuk barang yang dilacak stoknya TIDAK dihitung ulang di sini: ia sudah
// terbentuk dari mutasi stoknya (Gudang/journal.js), lengkap dengan harga perolehan,
// ongkir, dan PPN yang dikapitalisasi. Modul ini membaca jurnal yang sama supaya
// persediaan di Gudang dan di Pembelian tidak pernah berbeda angka.
import { accounts } from '@/pages/DaftarAkun/accounts.js';
import { AKUN as GUDANG, moveJournal } from '@/pages/Gudang/journal.js';
import {
  dpAmortization,
  invDpDeduct,
  invDpp,
  invPph,
  invPpn,
  invTotals,
  isDpInvoice,
  lineRate,
  poDocLabel,
  pvPaid,
  rupiah,
} from './utils.js';

// Akun dicari lewat kode atau namanya di daftar akun, bukan disalin ke modul ini: kode akun
// milik daftar akun, dan menyalinnya ke modul lain membuat keduanya bisa berbeda diam-diam.
const find = (key) => accounts.find((a) => a.code === key || a.name.toLowerCase() === String(key).toLowerCase());
export const accountOf = (key) => {
  const a = find(key);
  return a ? { code: a.code, name: a.name } : { code: null, name: key };
};
export const accountLabel = (key) => {
  const a = accountOf(key);
  return a.code ? `${a.code} · ${a.name}` : a.name;
};

export const AKUN = {
  persediaan: GUDANG.persediaan, // 1-10300 Persediaan
  belumDitagih: GUDANG.belumDitagih, // 2-10150 Barang Diterima Belum Ditagih
  hutangUsaha: GUDANG.hutangUsaha, // 2-10200 Hutang Lainnya
  ppnMasukan: GUDANG.ppnMasukan, // 1-10407 PPN Masukan
  selisih: GUDANG.selisih, // 8-10001 Penyesuaian Persediaan
  beban: '6-10000', // Beban Operasional — cadangan bila produk tidak menyebut akun pembeliannya
  uangMuka: 'Uang Muka Pembelian',
  hutangPph: 'Hutang PPh Pasal 23',
  kas: 'Kas dan Setara Kas',
};

const r = (n) => Math.round(n || 0);
const dr = (account, v, memo) => ({ account, debit: r(v), credit: 0, memo });
const cr = (account, v, memo) => ({ account, debit: 0, credit: r(v), memo });

// Gabungkan baris akun + sisi yang sama, buang yang nol, lalu beri kode & nama akun.
function finish(lines) {
  const map = new Map();
  for (const l of lines) {
    if (!r(l.debit) && !r(l.credit)) continue;
    const side = l.debit ? 'd' : 'c';
    const key = `${accountOf(l.account).code ?? l.account}|${side}`;
    const cur = map.get(key);
    if (cur) {
      cur.debit += r(l.debit);
      cur.credit += r(l.credit);
      // Beberapa baris digabung jadi satu pos: keterangan per baris tidak lagi mewakili.
      if (cur.memo !== l.memo && !cur.memo?.endsWith(' dan lainnya')) cur.memo = cur.memo ? `${cur.memo.split(' · ')[0]} dan lainnya` : null;
    } else map.set(key, { ...l, debit: r(l.debit), credit: r(l.credit) });
  }
  return [...map.values()]
    .sort((a, b) => (b.debit > 0) - (a.debit > 0))
    .map((l) => {
      const a = accountOf(l.account);
      return { ...l, code: a.code, name: a.name, label: accountLabel(l.account) };
    });
}

export const journalTotals = (lines) => ({
  debit: lines.reduce((n, l) => n + l.debit, 0),
  credit: lines.reduce((n, l) => n + l.credit, 0),
});
export const journalBalanced = (lines) => {
  const t = journalTotals(lines);
  return t.debit === t.credit;
};

// Baris PO lama belum menyimpan productId, jadi dicocokkan juga lewat namanya.
export const productOfItem = (products, item) => {
  const nama = (item?.desc ?? '').trim().toLowerCase();
  return (products ?? []).find((p) => p.id === item?.productId) ?? (products ?? []).find((p) => p.name.toLowerCase() === nama);
};

// Akun debit untuk barang/jasa yang tidak masuk persediaan: akun pembelian produknya,
// kalau tidak ada ke Beban Operasional.
const expenseOf = (product) => product?.buyAccount || AKUN.beban;

// --- Penerimaan (FPB / BAPP) ---------------------------------------------------------------------
// Satu baris penerimaan -> baris jurnal, plus nilai yang dikreditkan ke Belum Ditagih per unit
// (dipakai faktur untuk menutupnya dengan angka yang persis sama).
function receiptLineEntry(receipt, line, po, ctx) {
  const item = po?.items.find((i) => i.id === line.itemId);
  if (!item || !(line.qty > 0)) return null;
  const product = productOfItem(ctx.products, item);
  const move = (ctx.stockMoves ?? []).find(
    (m) => m.type === 'receipt' && m.sourceId === receipt.id && !!product && m.productId === product.id,
  );
  if (move) {
    const qty = move.qtyIn || line.qty;
    const lines = moveJournal(move, product, qty * (move.unitCost ?? 0));
    const kredit = lines.filter((l) => l.account === AKUN.belumDitagih).reduce((n, l) => n + l.credit, 0);
    return {
      lines: lines.map((l) => ({ ...l, memo: `${item.desc} · ${qty} ${item.unit ?? ''}`.trim() })),
      unitCredit: kredit / qty,
      // PPN yang ikut jadi harga perolehan sudah tertampung di Belum Ditagih.
      vatCapitalized: (move.costBreakdown?.vat ?? 0) > 0,
    };
  }
  // Jasa, atau barang yang tidak dilacak stoknya: langsung jadi beban sebesar DPP PO.
  const nilai = line.qty * (item.price ?? 0);
  const akun = item.kind === 'jasa' || !product?.tracked ? expenseOf(product) : AKUN.persediaan;
  const memo = `${item.desc} · ${line.qty} ${item.unit ?? ''}`.trim();
  return { lines: [dr(akun, nilai, memo), cr(AKUN.belumDitagih, nilai, memo)], unitCredit: item.price ?? 0, vatCapitalized: false };
}

export function receiptJournal(receipt, pb, ctx = {}) {
  if (!receipt) return [];
  const po = pb.posById?.[receipt.poId];
  return finish(receipt.lines.flatMap((l) => receiptLineEntry(receipt, l, po, ctx)?.lines ?? []));
}

// --- Faktur pembelian ---------------------------------------------------------------------------
export function invoiceJournal(inv, pb, ctx = {}) {
  if (!inv) return [];
  const vendor = pb.vendorsById?.[inv.vendorId]?.name ?? 'vendor';

  // Faktur uang muka: hak tagih ke vendor lahir, hutangnya juga. Kas belum keluar.
  if (isDpInvoice(inv)) {
    const nilai = invDpp(inv) + invPpn(inv);
    return finish([
      dr(AKUN.uangMuka, nilai, `Uang muka ke ${vendor}`),
      cr(AKUN.hutangUsaha, nilai, `Hutang uang muka ${inv.number}`),
    ]);
  }

  const lines = [];
  let ppnMasukan = 0;
  let didebit = 0;
  for (const l of inv.lines) {
    const po = pb.posById?.[l.poId ?? inv.poId];
    const item = po?.items.find((i) => i.id === l.itemId);
    const dpp = l.qty * l.price;
    const ppn = dpp * lineRate(l);
    const memo = `${item?.desc ?? l.desc ?? 'Baris faktur'} · ${l.qty} ${item?.unit ?? l.unit ?? ''}`.trim();
    const receipt = l.receiptId ? pb.receiptsById?.[l.receiptId] : null;
    if (receipt) {
      // Tutup Belum Ditagih sebesar yang dulu dikreditkan penerimaannya untuk qty ini.
      const rl = receipt.lines.find((x) => x.itemId === l.itemId);
      const e = rl ? receiptLineEntry(receipt, rl, po, ctx) : null;
      const tutup = e ? e.unitCredit * l.qty : dpp;
      lines.push(dr(AKUN.belumDitagih, tutup, memo));
      didebit += tutup;
      if (!e?.vatCapitalized) {
        ppnMasukan += ppn;
        didebit += ppn;
      }
    } else {
      // Tanpa penerimaan (langsung dari PO/SPK atau faktur manual): langsung ke akunnya.
      const product = productOfItem(ctx.products, item ?? { productId: l.productId, desc: l.desc });
      const kind = item?.kind ?? l.kind;
      const akun = kind === 'jasa' || !product?.tracked ? expenseOf(product) : AKUN.persediaan;
      lines.push(dr(akun, dpp, memo));
      didebit += dpp;
      ppnMasukan += ppn;
      didebit += ppn;
    }
  }
  if (r(ppnMasukan)) lines.push(dr(AKUN.ppnMasukan, ppnMasukan, 'PPN atas faktur'));

  const dpp = invDpp(inv);
  const ppn = invPpn(inv);
  const pph = invPph(inv);
  const dp = invDpDeduct(inv, pb.pos ?? [], pb.prs ?? [], pb.invoices ?? []);
  const credit = inv.credit ?? 0;

  // Selisih harga faktur terhadap nilai penerimaan (ongkir, pembulatan, harga berubah):
  // dibukukan terbuka ke akun selisih, bukan diserap diam-diam.
  const selisih = r(dpp + ppn - didebit);
  if (selisih > 0) lines.push(dr(AKUN.selisih, selisih, 'Selisih faktur terhadap penerimaan'));
  if (selisih < 0) lines.push(cr(AKUN.selisih, -selisih, 'Selisih faktur terhadap penerimaan'));

  // Termin yang jadwalnya sudah tanpa DP: porsi uang mukanya diakui di sini sebagai biaya
  // (dan PPN-nya sebagai PPN Masukan), lalu dikeluarkan dari akun Uang Muka. Debit dan
  // kreditnya sama besar, jadi hutang ke vendor tidak berubah.
  for (const a of dpAmortization(inv, pb.pos ?? [], pb.prs ?? [], pb.invoices ?? [])) {
    const po = pb.posById?.[a.poId];
    const l = inv.lines.find((x) => (x.poId ?? inv.poId) === a.poId);
    const item = po?.items.find((i) => i.id === l?.itemId);
    const product = productOfItem(ctx.products, item ?? { productId: l?.productId, desc: l?.desc });
    const kind = item?.kind ?? l?.kind;
    // Barang yang dilacak stoknya tidak ditambah ke Persediaan di sini: nilai stoknya milik
    // mutasi Gudang. Porsinya masuk akun penyesuaian persediaan.
    const akun = kind === 'jasa' || !product?.tracked ? expenseOf(product) : AKUN.selisih;
    lines.push(dr(akun, a.dpp, `Porsi uang muka ${po?.number ?? ''}`.trim()));
    lines.push(dr(AKUN.ppnMasukan, a.ppn, 'PPN atas porsi uang muka'));
    lines.push(cr(AKUN.uangMuka, a.amount, 'Pemakaian uang muka'));
  }

  if (pph) lines.push(cr(AKUN.hutangPph, pph, `PPh 23 ${inv.pphPct}%`));
  if (dp) lines.push(cr(AKUN.uangMuka, dp, 'Kompensasi uang muka'));
  if (credit) lines.push(cr(AKUN.uangMuka, credit, 'Alokasi kredit vendor'));
  lines.push(cr(AKUN.hutangUsaha, dpp + ppn - pph - dp - credit, `Hutang ke ${vendor}`));
  return finish(lines);
}

// --- Payment Voucher ------------------------------------------------------------------------------
// PV uang muka LAMA (tanpa faktur uang muka): uangnya masuk ke Uang Muka Pembelian, karena
// hutangnya belum pernah diakui. PV yang membayar faktur — termasuk faktur uang muka —
// melunasi hutang yang sudah diakui saat fakturnya dicatat.
// Kas baru keluar saat pembayaran PV dicatat; sebelum itu PV hanya perintah bayar, belum ada jurnal.
export function voucherJournal(v, pb) {
  if (!v || !pvPaid(v)) return [];
  const pr = pb.prsById?.[(v.prIds ?? [])[0]];
  const dpTanpaFaktur = pr?.kind === 'dp' && !(pr.invoiceIds ?? []).length;
  return finish([
    dr(dpTanpaFaktur ? AKUN.uangMuka : AKUN.hutangUsaha, v.amount),
    cr(AKUN.kas, v.amount),
  ]);
}

// Keterangan singkat jurnalnya, untuk ringkasan satu baris.
export function journalNote(v, pb) {
  const pr = pb.prsById?.[(v?.prIds ?? [])[0]];
  const vendor = pb.vendorsById?.[v?.vendorId]?.name ?? 'vendor';
  if (!pr) return `Pembayaran ke ${vendor} ${rupiah(v?.amount ?? 0)}`;
  const inv = (pr.invoiceIds ?? []).map((id) => pb.invoicesById?.[id]).filter(Boolean);
  if (pr.kind === 'dp') {
    const po = pb.posById?.[pr.poId];
    return `Uang muka ke ${vendor} atas ${inv[0]?.number ?? po?.number ?? 'pesanan'}`;
  }
  const sisa = inv.length === 1 && pb.calc ? invTotals(inv[0], pb.calc).balance : null;
  return `Pelunasan ${inv.map((i) => i.number).join(', ') || 'faktur'} ke ${vendor}`
    + (sisa != null && sisa > 0 ? ` · sisa hutang ${rupiah(sisa)}` : '');
}

// --- Satu bentuk untuk halaman detail jurnal ------------------------------------------------------
// kind: 'pv' | 'invoice' | 'receipt'. Mengembalikan null bila dokumennya belum berjurnal.
export function journalEntry(kind, doc, pb, ctx = {}) {
  if (!doc) return null;
  const vendor = pb.vendorsById?.[doc.vendorId]?.name ?? '—';
  if (kind === 'pv') {
    const prs = (doc.prIds ?? []).map((id) => pb.prsById?.[id]).filter(Boolean);
    return {
      kind,
      typeLabel: 'Kas keluar',
      date: doc.journalPostedAt || doc.paidAt || doc.date,
      lines: voucherJournal(doc, pb),
      note: journalNote(doc, pb),
      source: { label: doc.number, view: { name: 'voucher', id: doc.id } },
      party: vendor,
      basisLabel: 'Dasar pembayaran',
      basis: prs.map((p) => ({ label: p.number, view: { name: 'pr', id: p.id } })),
      extra: [['Rekening sumber', doc.source || '—']],
      by: doc.journalBy || doc.paidBy || '—',
      files: doc.proofs ?? [],
      filesLabel: 'Bukti transfer',
      back: { name: 'voucher', id: doc.id },
    };
  }
  if (kind === 'invoice') {
    const po = pb.posById?.[doc.poId];
    const dp = isDpInvoice(doc);
    return {
      kind,
      typeLabel: dp ? 'Faktur uang muka' : 'Faktur pembelian',
      date: doc.date,
      lines: invoiceJournal(doc, pb, ctx),
      note: dp
        ? `Faktur uang muka ${doc.vendorNo || doc.number} dari ${vendor}`
        : `Faktur ${doc.vendorNo || doc.number} dari ${vendor}`,
      source: { label: doc.number, view: { name: 'invoice', id: doc.id } },
      party: vendor,
      basisLabel: dp ? 'Atas pesanan' : 'Dasar tagihan',
      basis: dp
        ? (po ? [{ label: po.number, view: { name: 'po', id: po.id } }] : [])
        : [...new Set(doc.lines.map((l) => l.receiptId).filter(Boolean))]
          .map((id) => pb.receiptsById?.[id])
          .filter(Boolean)
          .map((rc) => ({ label: rc.number, view: { name: 'receipt', id: rc.id } })),
      extra: [['No. invoice vendor', doc.vendorNo || '—']],
      by: doc.createdBy || 'Staff Accounting',
      files: (doc.files ?? []).filter(Boolean),
      filesLabel: 'Berkas faktur',
      back: { name: 'invoice', id: doc.id },
    };
  }
  if (kind === 'receipt') {
    const po = pb.posById?.[doc.poId];
    const jasa = doc.kind === 'jasa';
    return {
      kind,
      typeLabel: jasa ? 'Penerimaan jasa' : 'Penerimaan barang',
      date: doc.journalDate || doc.date,
      lines: receiptJournal(doc, pb, ctx),
      note: `${jasa ? 'BAPP' : 'FPB'} ${doc.number} atas ${po?.number ?? 'pesanan'} dari ${vendor}`,
      source: { label: doc.number, view: { name: 'receipt', id: doc.id } },
      party: vendor,
      basisLabel: po ? poDocLabel(po) : 'Pesanan',
      basis: po ? [{ label: po.number, view: { name: 'po', id: po.id } }] : [],
      extra: [[jasa ? 'No. BAPP vendor' : 'No. surat jalan', doc.doNumber || '—']],
      by: doc.approvedBy || doc.createdBy || '—',
      files: [doc.file].filter(Boolean),
      filesLabel: jasa ? 'BAPP' : 'Surat jalan',
      back: { name: 'receipt', id: doc.id },
    };
  }
  return null;
}
