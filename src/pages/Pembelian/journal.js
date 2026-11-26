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
import { listMoves } from '@/pages/Gudang/stock.js';
import {
  dpAmortization,
  invDpDeduct,
  invDpp,
  invPpn,
  isRetentionRelease,
  invTotals,
  isDpInvoice,
  lineRate,
  poDocLabel,
  pvPaid,
  returnGross,
  rupiah,
  retentionDocName,
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
  hutangRetensi: 'Hutang Retensi',
  kas: 'Kas dan Setara Kas',
};

// Rekening sumber pembayaran PV dan akun Kas & Bank-nya. Kas keluar dijurnal ke akun rekening
// yang benar-benar dipakai, bukan ke induk "Kas dan Setara Kas", supaya saldo per rekening dan
// rekonsiliasi bank cocok.
export const SOURCE_ACCOUNTS = [
  { label: 'BCA 288-123-9001 · Kas Operasional', account: '1-10004' },
  { label: 'Mandiri 101-00-5577 · Kas Proyek', account: '1-10003' },
  { label: 'Kas kecil', account: '1-10001' },
];
// PV lama hanya menyimpan label rekeningnya; cocokkan dari situ, kalau tidak dikenal pakai induk.
export const sourceAccountOf = (v) => v?.sourceAccount ?? SOURCE_ACCOUNTS.find((x) => x.label === v?.source)?.account ?? AKUN.kas;

const r = (n) => Math.round(n || 0);
const dr = (account, v, memo) => ({ account, debit: r(v), credit: 0, memo });
const cr = (account, v, memo) => ({ account, debit: 0, credit: r(v), memo });

// Gabungkan baris akun + sisi yang sama, buang yang nol, lalu beri kode & nama akun.
// byMemo: baris dengan akun sama tapi keterangan berbeda tetap terpisah (mis. pelunasan per
// faktur di PV), supaya buku besar hutang bisa ditelusuri ke fakturnya.
function finish(lines, { byMemo = false } = {}) {
  const map = new Map();
  for (const l of lines) {
    if (!r(l.debit) && !r(l.credit)) continue;
    const side = l.debit ? 'd' : 'c';
    const key = `${accountOf(l.account).code ?? l.account}|${side}${byMemo ? `|${l.memo ?? ''}` : ''}`;
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
  // Harga yang dikunci di baris penerimaan (`line.price`, diisi saat harga PO diubah) menang,
  // supaya penerimaan lama tidak ikut berubah nilainya.
  const unit = line.price ?? item.price ?? 0;
  const nilai = line.qty * unit;
  const akun = item.kind === 'jasa' || !product?.tracked ? expenseOf(product) : AKUN.persediaan;
  const memo = `${item.desc} · ${line.qty} ${item.unit ?? ''}`.trim();
  return { lines: [dr(akun, nilai, memo), cr(AKUN.belumDitagih, nilai, memo)], unitCredit: unit, vatCapitalized: false };
}

// Penyesuaian harga penerimaan: ubah harga PO disetujui sesudah BAPP/FPB dijurnal. BAPP/FPB
// tidak dibatalkan; qty yang belum difaktur saat approval dinilai ulang dengan jurnal terpisah
// bertanggal approval. Jasa dan barang yang tidak dilacak stoknya ke akun bebannya; barang
// stok ke Penyesuaian Persediaan, karena nilai stok di Gudang tidak ikut dinilai ulang.
// Satu jurnal per penerimaan per pengajuan (tanggal + nomor PO).
export function priceAdjustJournals(receipt, pb, ctx = {}) {
  const po = pb.posById?.[receipt.poId];
  const groups = new Map();
  for (const l of receipt.lines) {
    const item = po?.items.find((i) => i.id === l.itemId);
    const product = productOfItem(ctx.products, item ?? { desc: l.desc });
    const akun = item?.kind === 'jasa' || !product?.tracked ? expenseOf(product) : AKUN.selisih;
    for (const a of l.priceAdjs ?? []) {
      const key = `${a.at}|${a.ref}`;
      if (!groups.has(key)) groups.set(key, { date: a.at, ref: a.ref, kind: a.kind ?? 'ubah', lines: [] });
      const v = r(a.qty * a.delta);
      const memo = `${item?.desc ?? 'Item'} · ${a.qty} ${item?.unit ?? ''} × ${a.delta > 0 ? '+' : '−'}${rupiah(Math.abs(a.delta))}`.replace(/\s+×/, ' ×');
      const g = groups.get(key);
      if (v > 0) g.lines.push(dr(akun, v, memo), cr(AKUN.belumDitagih, v, memo));
      if (v < 0) g.lines.push(dr(AKUN.belumDitagih, -v, memo), cr(akun, -v, memo));
    }
  }
  return [...groups.values()].map((g) => ({ ...g, lines: finish(g.lines, { byMemo: true }) })).filter((g) => g.lines.length);
}

export function receiptJournal(receipt, pb, ctx = {}) {
  if (!receipt) return [];
  const po = pb.posById?.[receipt.poId];
  return finish(receipt.lines.flatMap((l) => receiptLineEntry(receipt, l, po, ctx)?.lines ?? []));
}

// --- Faktur pembelian ---------------------------------------------------------------------------
export function invoiceJournal(inv, pb, ctx = {}) {
  if (!inv) return [];
  // Faktur batal tetap punya jurnal aslinya (dibalik di tanggal pembatalan, lihat
  // invoiceReversal). Hitungannya memakai faktur itu seolah masih hidup — invTotals menolkan
  // faktur batal, dan potongan uang muka hanya membaca faktur yang hidup.
  if (inv.cancelled) {
    const live = { ...inv, cancelled: false };
    const invoices = (pb.invoices ?? []).map((i) => (i.id === inv.id ? live : i));
    return invoiceJournal(live, { ...pb, invoices, invoicesById: { ...pb.invoicesById, [inv.id]: live } }, ctx);
  }
  const vendor = pb.vendorsById?.[inv.vendorId]?.name ?? 'vendor';

  // Faktur uang muka: hak tagih ke vendor lahir, hutangnya juga. Kas belum keluar.
  // Model PDF: DPP uang muka ke Uang Muka Pembelian, PPN-nya langsung jadi PPN Masukan (faktur
  // pajak uang muka), dan PPh dipotong atas uang yang dibayar. Faktur uang muka lama hanya
  // punya satu baris bruto tanpa PPN, jadi hasilnya sama dengan sebelumnya.
  if (isDpInvoice(inv)) {
    const dpp = invDpp(inv);
    const ppn = invPpn(inv);
    const pph = Math.round((dpp * (inv.pphPct || 0)) / 100);
    return finish([
      dr(AKUN.uangMuka, dpp, `Uang muka ke ${vendor}`),
      ...(ppn ? [dr(AKUN.ppnMasukan, ppn, 'PPN atas uang muka')] : []),
      ...(pph ? [cr(AKUN.hutangPph, pph, `PPh ${inv.pphPct}% atas uang muka`)] : []),
      cr(AKUN.hutangUsaha, dpp + ppn - pph, `Hutang uang muka ${inv.number}`),
    ]);
  }

  // Pelepasan retensi: saldo yang ditahan dari faktur termin pindah ke Hutang Usaha, dipotong
  // PPh atas porsi retensi. Tanpa PPN — sudah ikut di faktur termin.
  if (isRetentionRelease(inv)) {
    const t = invTotals(inv, { pos: pb.pos ?? [], prs: pb.prs ?? [], returns: [], invoices: pb.invoices ?? [] });
    return finish([
      dr(AKUN.hutangRetensi, inv.amount, `Pelepasan retensi ${pb.posById?.[inv.poId]?.number ?? ''}`.trim()),
      ...(t.pph ? [cr(AKUN.hutangPph, t.pph, `PPh ${inv.pphPct}% atas retensi`)] : []),
      cr(AKUN.hutangUsaha, t.total, `Hutang ke ${vendor}`),
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
      // `priceAdj`: penyesuaian harga per unit yang sudah dijurnal sebelum faktur ini dicatat
      // (ubah harga PO disetujui sesudah BAPP/FPB). Disimpan di baris faktur saat dibuat, jadi
      // faktur lama tidak ikut berubah.
      const tutup = e ? (e.unitCredit + (l.priceAdj ?? 0)) * l.qty : dpp;
      lines.push(dr(AKUN.belumDitagih, tutup, memo));
      didebit += tutup;
      // Harga faktur beda dari nilai penerimaan (mis. ubah harga PO): untuk jasa dan barang yang
      // tidak dilacak stoknya, selisihnya bagian dari biaya, jadi masuk akun bebannya sendiri.
      // Barang stok tetap ke akun penyesuaian persediaan lewat selisih di bawah.
      const product = productOfItem(ctx.products, item ?? { productId: l.productId, desc: l.desc });
      const beban = (item?.kind ?? l.kind) === 'jasa' || !product?.tracked;
      const beda = r(dpp - tutup);
      if (beban && beda && !e?.vatCapitalized) {
        lines.push(beda > 0 ? dr(expenseOf(product), beda, `Selisih harga · ${memo}`) : cr(expenseOf(product), -beda, `Selisih harga · ${memo}`));
        didebit += beda;
      }
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
  const dpp = invDpp(inv);
  const tot = invTotals(inv, { pos: pb.pos ?? [], prs: pb.prs ?? [], returns: [], invoices: pb.invoices ?? [] });
  // PPN atas porsi uang muka sudah diakui di faktur uang muka (model PDF): yang diakui di sini
  // hanya PPN atas (nilai termin - potongan DP).
  const ppnCut = invPpn(inv) - tot.ppn;
  ppnMasukan -= ppnCut;
  didebit -= ppnCut;
  const ppn = tot.ppn;
  if (r(ppnMasukan)) lines.push(dr(AKUN.ppnMasukan, ppnMasukan, 'PPN atas faktur'));

  const pph = tot.pph;
  const retensi = tot.retensi;
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

  if (retensi) lines.push(cr(AKUN.hutangRetensi, retensi, 'Retensi ditahan sampai masa pemeliharaan selesai'));
  if (pph) lines.push(cr(AKUN.hutangPph, pph, `PPh ${inv.pphPct}%`));
  if (dp) lines.push(cr(AKUN.uangMuka, dp, 'Potongan uang muka'));
  if (credit) lines.push(cr(AKUN.uangMuka, credit, 'Alokasi kredit vendor'));
  lines.push(cr(AKUN.hutangUsaha, dpp + ppn - pph - dp - credit - retensi, `Hutang ke ${vendor}`));
  return finish(lines);
}

// Jurnal pembalik faktur yang dibatalkan: baris jurnal aslinya dengan debit dan kredit ditukar,
// dibukukan di tanggal pembatalan. Periode sebelum pembatalan tetap memperlihatkan fakturnya.
export const invoiceReversal = (inv, pb, ctx = {}) =>
  invoiceJournal(inv, pb, ctx).map((l) => ({ ...l, debit: l.credit, credit: l.debit, memo: `Pembatalan · ${l.memo ?? ''}`.replace(/ · $/, '') }));

// --- Retur pembelian ------------------------------------------------------------------------------
// Satu jurnal per dokumen retur. Sisi tagihan mengikuti penyelesaiannya dan nilainya sama dengan
// yang dipakai sub-buku hutang (invReturns / returnGross): harga faktur + PPN faktur, ditambah
// ongkir bila vendor ikut mengembalikannya.
//   potong : Dr Hutang Usaha       kredit : Dr Uang Muka Pembelian (kredit vendor)
//   refund : Dr Piutang Lainnya (uang yang ditunggu dari vendor)
// Barang yang dilacak stoknya: sisi persediaannya dari mutasi retur di Gudang (harga perolehan
// FPB asalnya). Barang yang tidak dilacak tidak punya mutasi, jadi akun pembeliannya dikredit langsung.
const returnAccountOf = (ret) => ({ kredit: AKUN.uangMuka, refund: GUDANG.piutangLain }[ret?.settlement] ?? AKUN.hutangUsaha);

function returnLineFacts(ret, line, pb) {
  const inv = pb.invoicesById?.[ret.invoiceId] ?? (pb.invoices ?? []).find((i) => i.id === ret.invoiceId);
  const il = inv?.lines.find((x) => x.itemId === line.itemId && (!line.receiptId || x.receiptId === line.receiptId))
    ?? inv?.lines.find((x) => x.itemId === line.itemId);
  const dpp = line.qty * line.price;
  const ppn = r(dpp * lineRate(il));
  const ongkir = ret.freightRefunded ? line.qty * (line.freight ?? 0) : 0;
  return { inv, dpp, ppn, billed: r(dpp) + ppn + r(ongkir) };
}

// Mutasi retur di Gudang dilengkapi nilai tagihan dari dokumen returnya (lihat Gudang/journal.js),
// supaya jurnal mutasi dan jurnal retur di Pembelian selalu satu angka.
export function returnMoveFacts(move, pb, products) {
  if (move?.type !== 'purchase_return') return move;
  const ret = (pb?.returns ?? []).find((x) => x.id === move.sourceId);
  if (!ret) return move;
  const inv = (pb.invoices ?? []).find((i) => i.id === ret.invoiceId);
  const po = (pb.pos ?? []).find((p) => p.id === inv?.poId);
  const kandidat = ret.lines.filter((l) => productOfItem(products, po?.items.find((i) => i.id === l.itemId))?.id === move.productId);
  const line = kandidat.find((l) => l.qty === move.qtyOut) ?? kandidat[0];
  if (!line) return move;
  const f = returnLineFacts(ret, { ...line, qty: move.qtyOut || line.qty }, pb);
  return { ...move, billedValue: f.billed, billedPpn: f.ppn, settlement: ret.settlement ?? 'potong', freightRefunded: !!ret.freightRefunded };
}

export function returnJournal(ret, pb, ctx = {}) {
  if (!ret) return [];
  const inv = pb.invoicesById?.[ret.invoiceId];
  const po = pb.posById?.[inv?.poId];
  const moves = ctx.pricedMoves ?? listMoves(ctx.stockMoves ?? []);
  const akun = returnAccountOf(ret);
  const used = new Set();
  const lines = ret.lines.flatMap((l) => {
    if (!(l.qty > 0)) return [];
    const item = po?.items.find((i) => i.id === l.itemId);
    const product = productOfItem(ctx.products, item);
    const memo = `Retur ${item?.desc ?? 'barang'} · ${l.qty} ${item?.unit ?? ''}`.trim();
    const move = product && moves.find((m) => m.type === 'purchase_return' && m.sourceId === ret.id && m.productId === product.id && !used.has(m.id) && m.qtyOut === l.qty)
      || (product && moves.find((m) => m.type === 'purchase_return' && m.sourceId === ret.id && m.productId === product.id && !used.has(m.id)));
    if (move) {
      used.add(move.id);
      return moveJournal(returnMoveFacts(move, pb, ctx.products), product, move.amount ?? move.qtyOut * (move.unitCost ?? 0), { residual: move.residual })
        .map((x) => ({ ...x, memo }));
    }
    const f = returnLineFacts(ret, l, pb);
    const keluar = item?.kind === 'jasa' || !product?.tracked ? expenseOf(product) : AKUN.persediaan;
    return [dr(akun, f.billed, memo), cr(keluar, f.billed - f.ppn, memo), ...(f.ppn ? [cr(AKUN.ppnMasukan, f.ppn, 'PPN atas retur')] : [])];
  });
  return finish(lines);
}

// Refund retur yang diterima dari vendor: uangnya masuk ke rekening yang dipilih, menutup
// Piutang Lainnya yang dibentuk jurnal returnya. Sebelum dicatat, tidak ada jurnal.
export function refundJournal(ret, pb) {
  if (ret?.settlement !== 'refund' || !ret.refund) return [];
  const nilai = returnGross(ret, pb.invoices ?? []);
  const memo = `Refund ${ret.number}`;
  return finish([dr(ret.refund.account || AKUN.kas, nilai, memo), cr(GUDANG.piutangLain, nilai, memo)]);
}

// --- Payment Voucher ------------------------------------------------------------------------------
// PV uang muka LAMA (tanpa faktur uang muka): uangnya masuk ke Uang Muka Pembelian, karena
// hutangnya belum pernah diakui. PV yang membayar faktur — termasuk faktur uang muka —
// melunasi hutang yang sudah diakui saat fakturnya dicatat.
// Kas baru keluar saat pembayaran PV dicatat; sebelum itu PV hanya perintah bayar, belum ada jurnal.
export function voucherJournal(v, pb) {
  if (!v || !pvPaid(v)) return [];
  const prs = (v.prIds ?? []).map((id) => pb.prsById?.[id]).filter(Boolean);
  const pr = prs[0];
  const dpTanpaFaktur = pr?.kind === 'dp' && !(pr.invoiceIds ?? []).length;
  const kas = cr(sourceAccountOf(v), v.amount, v.source ? `Dibayar dari ${v.source}` : undefined);
  if (dpTanpaFaktur) return finish([dr(AKUN.uangMuka, v.amount, `Uang muka ${pb.posById?.[pr.poId]?.number ?? ''}`.trim()), kas]);
  // Satu baris debit per faktur yang dilunasi, sebesar alokasinya di PR. PR multi-vendor
  // menerbitkan satu PV per vendor, jadi hanya faktur vendor PV ini yang diambil.
  const bagian = prs.flatMap((p) => (p.invoiceIds ?? [])
    .map((id) => pb.invoicesById?.[id])
    .filter((i) => i && (!v.vendorId || i.vendorId === v.vendorId))
    .map((i) => ({ inv: i, amount: p.alloc?.[i.id] ?? ((p.invoiceIds ?? []).length === 1 ? p.amount : 0) })))
    .filter((x) => x.amount > 0);
  const cocok = bagian.length > 0 && Math.abs(bagian.reduce((n, x) => n + x.amount, 0) - v.amount) <= 1;
  const debit = cocok
    ? bagian.map((x) => dr(AKUN.hutangUsaha, x.amount, `${isDpInvoice(x.inv) ? 'Uang muka' : 'Pelunasan'} ${x.inv.number}`))
    : [dr(AKUN.hutangUsaha, v.amount)];
  return finish([...debit, kas], { byMemo: true });
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
    if (isRetentionRelease(doc)) {
      return {
        kind,
        typeLabel: 'Pelepasan retensi',
        date: doc.date,
        lines: invoiceJournal(doc, pb, ctx),
        note: `Pelepasan retensi ${po?.number ?? ''} ke ${vendor}`,
        source: { label: doc.number, view: { name: 'invoice', id: doc.id } },
        party: vendor,
        basisLabel: 'Atas pesanan',
        basis: po ? [{ label: po.number, view: { name: 'po', id: po.id } }] : [],
        extra: [[`No. ${retentionDocName(po)}`, doc.bastNo || '—']],
        by: doc.createdBy || 'Staff Accounting',
        files: (doc.files ?? []).filter(Boolean),
        filesLabel: `Berkas ${retentionDocName(po)}`,
        back: { name: 'invoice', id: doc.id },
      };
    }
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
