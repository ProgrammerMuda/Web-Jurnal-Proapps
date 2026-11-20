// Perhitungan & aturan modul Pembelian (murni fungsi; state ada di store.jsx).
import { periodOptions, personLabel, RULES, TODAY } from './data.js';
import { defaultWarehouseId } from '@/pages/Gudang/data.js';
import { dueFromLabel, termFields, termMechanics } from './paymentTerms.js';

import { addDays, formatDate } from '@/pages/Penjualan/utils.js';

export { rupiah, rupiahShort } from '@/pages/Penjualan/utils.js';
export { formatDate, addDays };

export const sum = (arr, fn) => arr.reduce((n, x) => n + fn(x), 0);
export const uid = (p) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

// Nomor berikutnya: urutan tertinggi di antara dokumen berawalan sama + 1.
export function nextNumber(prefix, list) {
  const max = list
    .filter((d) => d.number.startsWith(`${prefix}/`))
    .reduce((m, d) => Math.max(m, parseInt(d.number.split('/').pop(), 10) || 0), 0);
  return `${prefix}/2026/11/${String(max + 1).padStart(4, '0')}`;
}

// Panjang satu periode dalam bulan.
export const PERIOD_MONTHS = { bulan: 1, triwulan: 3, semester: 6, tahun: 12 };

// Tambah n bulan, dengan menjaga akhir bulan tetap akhir bulan (31 Jan + 1 bln = 28/29 Feb).
export function addMonths(iso, n) {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const lastDay = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, lastDay));
  return t.toISOString().slice(0, 10);
}
const dayBefore = (iso) => new Date(Date.parse(iso) - 864e5).toISOString().slice(0, 10);

// Rentang periode ke-i (1-based) dihitung dari tanggal mulai kontrak.
export function periodRange(startIso, period, i) {
  const m = PERIOD_MONTHS[period] ?? 1;
  const from = addMonths(startIso, (i - 1) * m);
  return { from, to: dayBefore(addMonths(startIso, i * m)) };
}

const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
// "Jul–Sep 2026", atau "Des 2026–Feb 2027" kalau menyeberang tahun.
export function rangeLabel({ from, to }) {
  const a = new Date(from);
  const b = new Date(to);
  const ma = BULAN_PENDEK[a.getUTCMonth()];
  const mb = BULAN_PENDEK[b.getUTCMonth()];
  const ya = a.getUTCFullYear();
  const yb = b.getUTCFullYear();
  if (ya !== yb) return `${ma} ${ya}–${mb} ${yb}`;
  return ma === mb ? `${ma} ${ya}` : `${ma}–${mb} ${ya}`;
}

export const monthsBetween = (fromIso, toIso) => {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
};

// --- PO ---------------------------------------------------------------------------------
// Satu pajak per item pada penawaran vendor: PPN atau PPh yang dipotong. Apakah harga sudah termasuk PPN diatur satu saklar untuk seluruh penawaran.
export const TAX_OPTIONS = [
  { value: 'none', label: 'Tanpa pajak' },
  { value: 'ppn', label: 'PPN 11%' },
  { value: 'pph23', label: 'PPh 23 (2%)' },
  { value: 'pph4', label: 'PPh 4(2) (10%)' },
];
export const PPH_RATE = { pph23: 0.02, pph4: 0.1 };
export const TAX_SHORT = { ppn: 'Belum PPN', ppn_incl: 'Sudah PPN', pph23: 'PPh 23', pph4: 'PPh 4(2)' };
export const taxSummary = (taxes) => (taxes.length ? taxes.map((t) => TAX_SHORT[t]).join(' · ') : 'tanpa pajak');
// Pajak baris penawaran; data lama memakai isian PPN (exclude / include / none) atau, bila kosong, PPN 11% belum termasuk.
export const lineTaxes = (q, l) => {
  if (Array.isArray(l?.taxes)) return l.taxes;
  const old = l?.ppn ?? q?.ppn ?? 'exclude';
  return old === 'include' ? ['ppn_incl'] : old === 'none' ? [] : ['ppn'];
};
// Tarif PPN per baris (item PO / baris faktur); data lama tanpa isian memakai 11%.
export const lineRate = (l) => l?.ppnRate ?? RULES.ppn;
// Label PPN untuk daftar baris: "PPN 11%", "Tanpa PPN", atau "PPN" bila tarifnya campur.
export const ppnLabel = (list) => {
  const rates = [...new Set(list.map((x) => lineRate(x)))];
  if (rates.length !== 1) return 'PPN';
  return rates[0] > 0 ? `PPN ${Math.round(rates[0] * 100)}%` : 'Tanpa PPN';
};
export const poSubtotal = (po) => sum(po.items, (i) => i.qty * i.price);
export const poPpn = (po) => Math.round(sum(po.items, (i) => i.qty * i.price * lineRate(i)));
export const poTotal = (po) => poSubtotal(po) + poPpn(po);
// Uang muka dalam rupiah.
//
// Dua hal yang gampang salah di sini:
//  1. Persentasenya diambil dari advancePct(), bukan term.dpPct. Termin jasa "bayar penuh di
//     muka" dan "berkala di muka" tidak pernah mengisi dpPct, padahal keduanya 100% di muka.
//  2. Pada termin yang baris jadwalnya memang sudah dikurangi uang muka (dp_progress), total
//     PO hanya mewakili sisa yang ditagih per termin. Nilai kontrak penuhnya dipulihkan dulu,
//     kalau tidak uang mukanya terpotong dua kali dan vendor kurang dibayar.
export const poDpAmount = (po) => {
  const pct = advancePct(po?.term) / 100;
  if (pct <= 0) return 0;
  const total = poTotal(po);
  if (scheduleExcludesDp(po?.term) && pct < 1) return Math.round((total * pct) / (1 - pct));
  return Math.round(total * pct);
};
// Pesanan yang isinya jasa semua dikirim sebagai SPK, bukan PO. Campuran barang + jasa tetap PO.
export const poDocLabel = (po) => (po && poAllJasa(po) ? 'SPK' : 'PO');
// Jenis item (barang / jasa) ditentukan per baris, bukan per PO.
export const itemKind = (po, itemId) => po?.items.find((i) => i.id === itemId)?.kind ?? 'barang';
export const poAllJasa = (po) => po.items.length > 0 && po.items.every((i) => i.kind === 'jasa');
export const poAllBarang = (po) => po.items.every((i) => i.kind !== 'jasa');
// Faktur masih punya baris barang yang bisa diretur (jasa tidak diretur).
export const canReturn = (inv, po, returns) =>
  !!po && !inv.cancelled && inv.lines.some((l) => itemKind(po, l.itemId) === 'barang' && l.qty > returnedQty(inv.id, l.itemId, returns));

export const receiptsOf = (po, receipts) => receipts.filter((r) => r.poId === po.id);
export const receivedQty = (po, itemId, receipts) =>
  sum(receiptsOf(po, receipts), (r) => sum(r.lines.filter((l) => l.itemId === itemId), (l) => l.qty));
export const remainingQty = (po, itemId, receipts) => {
  const it = po.items.find((i) => i.id === itemId);
  return Math.max(it.qty - receivedQty(po, itemId, receipts), 0);
};

// --- Jadwal termin pada form Catat BAPP ---------------------------------------------------------
// Tiap baris jadwal SPK (Termin 1..N, lalu Retensi) punya tiga keadaan:
//   diterima  — sudah pernah di-BAPP, tidak bisa dipilih lagi
//   terkunci  — termin berkala yang periodenya belum berakhir; baru boleh dicatat setelah
//               tanggal akhir periode, karena yang di-BAPP adalah pekerjaan yang sudah lewat
//   terbuka   — bisa dicentang
//
// Termin persen (milestone) tidak terkunci tanggal: milestone bisa tercapai kapan saja, dan
// beberapa sekaligus boleh dicatat dalam satu BAPP asal berurutan.
export function scheduleRows(po, receipts, today, picked = []) {
  const rows = po.items.map((it) => {
    const received = remainingQty(po, it.id, receipts) === 0;
    const lockedUntil = it.periodTo && it.periodTo > today ? it.periodTo : null;
    return { item: it, received, lockedUntil, slot: it.slot ?? 0 };
  });
  // Berurutan: satu termin baru bisa dipilih kalau semua termin sebelumnya sudah diterima
  // ATAU ikut dicentang pada BAPP yang sama. Tanpa bagian kedua, beberapa milestone yang
  // selesai bersamaan tidak akan pernah bisa dicatat sekaligus.
  let blocked = false;
  return rows.map((r) => {
    const beres = r.received || picked.includes(r.item.id);
    const out = { ...r, blockedByOrder: blocked && !beres };
    if (!beres) blocked = true;
    return out;
  });
}

// Tanggal jurnal satu BAPP. Termin berkala diakui pada akhir periode yang di-BAPP — bebannya
// milik periode itu, bukan milik hari dokumennya diketik. Termin milestone diakui pada tanggal
// BAPP, karena saat itulah pekerjaannya dinyatakan selesai.
export function bappJournalDate(po, pickedItemIds, bappDate) {
  const picked = po.items.filter((i) => pickedItemIds.includes(i.id));
  const ends = picked.map((i) => i.periodTo).filter(Boolean);
  return ends.length ? ends.sort().at(-1) : bappDate;
}

// Progres pesanan sesudah BAPP ini: dipakai di ringkasan hasil.
export function bappProgress(po, receipts, pickedItemIds) {
  const done = po.items.filter((i) => remainingQty(po, i.id, receipts) === 0 || pickedItemIds.includes(i.id));
  const periodic = po.items.some((i) => i.unit === 'periode');
  const totalValue = sum(po.items, (i) => i.qty * i.price);
  const doneValue = sum(done, (i) => i.qty * i.price);
  return {
    periodic,
    done: done.length,
    total: po.items.length,
    pct: totalValue > 0 ? Math.round((doneValue / totalValue) * 100) : 0,
    remaining: totalValue - doneValue,
  };
}

// Qty pada baris penerimaan yang sudah masuk faktur.
// Faktur yang dibatalkan tidak lagi menghitung apa pun: qty-nya kembali terbuka untuk difaktur ulang.
export const liveInvoices = (invoices) => invoices.filter((i) => !i.cancelled);
export const invoicedQty = (receiptId, itemId, invoices) =>
  sum(
    liveInvoices(invoices).flatMap((i) => i.lines),
    (l) => (l.receiptId === receiptId && l.itemId === itemId ? l.qty : 0),
  );
// Pesanan ini melewati serah terima (FPB/BAPP) atau tidak. Ditetapkan di penawaran vendor;
// pesanan lama tanpa kolom ini dianggap memakai serah terima.
export const poHasReceipt = (po) => po?.withReceipt !== false;

// Qty satu item PO yang sudah difaktur, dari jalur mana pun — lewat penerimaan maupun
// langsung dari PO/SPK. Dihitung per pesanan, bukan per penerimaan, supaya dua jalur itu
// tidak saling menagih qty yang sama.
export const invoicedQtyOfPo = (poId, itemId, invoices) =>
  sum(
    liveInvoices(invoices).flatMap((i) => i.lines.map((l) => ({ ...l, poId: l.poId ?? i.poId }))),
    (l) => (l.poId === poId && l.itemId === itemId ? l.qty : 0),
  );

// Baris PO/SPK yang masih bisa ditagih langsung, tanpa lewat FPB/BAPP. Dipakai untuk pesanan
// yang memang tidak melewati gudang: dibayar di muka (CBD), jasa yang ditagih per termin
// tanpa berita acara, atau pesanan lama yang penerimaannya tidak pernah dicatat.
export const uninvoicedPoLines = (po, invoices) =>
  !po?.sent || poHasReceipt(po)
    ? []
    : po.items
      .map((it) => ({ ...it, open: it.qty - invoicedQtyOfPo(po.id, it.id, invoices) }))
      .filter((l) => l.open > 0);

// Penerimaan baru bisa difaktur setelah terkonfirmasi. Data lama tanpa kolom status
// dianggap sudah terkonfirmasi.
export const receiptConfirmed = (r) => (r?.status ?? 'dikonfirmasi') === 'dikonfirmasi';
export const uninvoicedLines = (receipt, invoices) =>
  !receiptConfirmed(receipt)
    ? []
    : receipt.lines
      .map((l) => ({ ...l, open: l.qty - invoicedQty(receipt.id, l.itemId, invoices) }))
      .filter((l) => l.open > 0);

// --- Faktur -----------------------------------------------------------------------------------
// Faktur manual: ditagih vendor tanpa bersandar pada FPB/BAPP. Barisnya menyimpan deskripsi
// sendiri (tanpa receiptId / itemId), jadi tidak mengurangi sisa penerimaan mana pun dan tidak
// ikut pencocokan 3 arah. Dipakai untuk tagihan non-PO: listrik, sewa, jasa berulang.
export const isManualInvoice = (inv) => !!inv && inv.lines.every((l) => !l.receiptId);
// Nama baris faktur: dari item pesanan bila bersandar penerimaan, atau deskripsi yang diketik.
export const invLineDesc = (l, item) => item?.desc ?? l.desc ?? '—';

export const invDpp = (inv) => sum(inv.lines, (l) => l.qty * l.price);
export const invPpn = (inv) => Math.round(sum(inv.lines, (l) => l.qty * l.price * lineRate(l)));
export const invPph = (inv) => Math.round((invDpp(inv) * (inv.pphPct || 0)) / 100);

// Uang muka PO yang sudah dibayar, dipotongkan proporsional ke tiap faktur (per PO).
export function invDpDeduct(inv, pos, prs) {
  const byPo = {}; // nilai kotor (DPP + PPN) baris faktur per PO
  for (const l of inv.lines) {
    const key = l.poId ?? inv.poId;
    byPo[key] = (byPo[key] ?? 0) + l.qty * l.price * (1 + lineRate(l));
  }
  let total = 0;
  for (const [poId, gross] of Object.entries(byPo)) {
    const po = pos.find((p) => p.id === poId);
    if (!po) continue;
    // Jadwal DP + termin progres sudah mengeluarkan uang muka dari nilai tiap termin,
    // jadi fakturnya tidak dipotong DP lagi — kalau dipotong, vendor kurang dibayar.
    if (scheduleExcludesDp(po.term)) continue;
    const dpPaid = sum(
      prs.filter((p) => p.kind === 'dp' && p.poId === po.id && p.status === 'dibayar'),
      (p) => p.amount,
    );
    if (dpPaid) total += Math.min(Math.round((dpPaid * gross) / poTotal(po)), dpPaid);
  }
  return total;
}

export const returnValue = (ret) => sum(ret.lines, (l) => l.qty * l.price);
// Nilai retur yang diselesaikan sebagai "kredit vendor": tidak memotong faktur asalnya,
// tapi jadi saldo yang bisa dialokasikan ke faktur lain milik vendor yang sama.
export const returnGross = (r, invoices) => {
  const inv = invoices.find((x) => x.id === r.invoiceId);
  return Math.round(sum(r.lines, (l) => l.qty * l.price * (1 + lineRate(inv?.lines.find((x) => x.itemId === l.itemId)))));
};
// Saldo kredit vendor = kredit dari retur - yang sudah dipakai di faktur mana pun (kecuali yang dibatalkan).
export function vendorCredit(vendorId, { returns, invoices }) {
  const earned = sum(
    returns.filter((r) => r.settlement === 'kredit' && invoices.find((x) => x.id === r.invoiceId)?.vendorId === vendorId),
    (r) => returnGross(r, invoices),
  );
  const used = sum(liveInvoices(invoices).filter((i) => i.vendorId === vendorId), (i) => i.credit ?? 0);
  return Math.max(earned - used, 0);
}

export const invReturns = (inv, returns) =>
  sum(
    returns.filter((r) => r.invoiceId === inv.id && r.settlement === 'potong'),
    (r) => Math.round(sum(r.lines, (l) => l.qty * l.price * (1 + lineRate(inv.lines.find((x) => x.itemId === l.itemId))))),
  );

// Pembayaran pelunasan yang menunjuk faktur ini. committed = termasuk yang belum dibayar.
export function prAllocated(inv, prs, { onlyPaid }) {
  return sum(
    prs.filter(
      (p) => p.kind === 'pelunasan' && (onlyPaid ? p.status === 'dibayar' : p.status !== 'ditolak'),
    ),
    (p) => p.alloc?.[inv.id] ?? (p.invoiceIds.length === 1 && p.invoiceIds[0] === inv.id ? p.amount : 0),
  );
}

export function invTotals(inv, { pos, prs, returns }) {
  // Faktur batal bernilai nol di mana pun ia muncul (hutang, sisa, daftar pembayaran).
  if (inv.cancelled) return { dpp: 0, ppn: 0, pph: 0, dp: 0, ret: 0, credit: 0, total: 0, paid: 0, balance: 0, free: 0 };
  const dpp = invDpp(inv);
  const ppn = invPpn(inv);
  const pph = invPph(inv);
  const dp = invDpDeduct(inv, pos, prs);
  const ret = invReturns(inv, returns);
  const credit = inv.credit ?? 0; // kredit vendor yang dialokasikan ke faktur ini
  const total = Math.max(dpp + ppn - pph - dp - ret - credit, 0);
  const paid = prAllocated(inv, prs, { onlyPaid: true });
  const committed = prAllocated(inv, prs, { onlyPaid: false });
  return {
    dpp,
    ppn,
    pph,
    dp,
    ret,
    credit,
    total,
    paid,
    balance: Math.max(total - paid, 0),
    free: Math.max(total - committed, 0), // belum tercakup Payment Request
  };
}
export const invOverdue = (inv, t) => t.balance > 0 && inv.dueDate < TODAY;

export function invStatus(inv, t) {
  if (inv.cancelled) return 'dibatalkan';
  if (t.balance <= 0) return 'lunas';
  return invOverdue(inv, t) ? 'tempo' : 'belum';
}

// Nilai retur per qty yang sudah dikembalikan untuk baris faktur.
export const returnedQty = (invId, itemId, returns) =>
  sum(
    returns.filter((r) => r.invoiceId === invId).flatMap((r) => r.lines),
    (l) => (l.itemId === itemId ? l.qty : 0),
  );

// --- Status PO / permintaan -------------------------------------------------------------------------
export function poStatus(po, { receipts, invoices, prs, pos, returns }) {
  // PO yang dibatalkan atau ditutup berhenti di situ; sisa qty-nya tidak lagi ditunggu.
  if (po.closedAs) return po.closedAs;
  const full = po.items.every((i) => remainingQty(po, i.id, receipts) === 0);
  const any = po.items.some((i) => receivedQty(po, i.id, receipts) > 0);
  // Penerimaan boleh dicatat sebelum dokumennya dikirim ke vendor — barang sering datang
  // duluan dengan surat jalan, pekerjaan sering jalan atas dasar kesepakatan lisan. Jadi
  // "draft" hanya berlaku selama belum dikirim DAN belum ada yang diterima; begitu ada
  // penerimaan, statusnya ikut penerimaannya supaya tidak terbaca seperti pesanan mati.
  if (!any) return po.sent ? 'dikirim' : 'draft';
  if (!full) return 'sebagian';
  const invs = liveInvoices(invoices).filter((i) => i.poId === po.id);
  const allInvoiced = receiptsOf(po, receipts).every((r) => uninvoicedLines(r, invoices).length === 0);
  if (allInvoiced && invs.every((i) => invTotals(i, { pos, prs, returns }).balance <= 0)) {
    return 'selesai';
  }
  return 'diterima';
}

// Langkah stepper permintaan (indeks aktif).
export const fppbjSteps = ['Permintaan', 'Pengadaan', 'PO', 'Penerimaan', 'Faktur', 'Pelunasan'];
export function fppbjStep(f, ctx) {
  if (f.status === 'dibatalkan') return -1;
  if (['draft', 'dikembalikan', 'diajukan'].includes(f.status)) return 0;
  if (f.status === 'diverifikasi') return 1;
  const pos = ctx.pos.filter((p) => p.fppbjId === f.id);
  if (!pos.length) return f.procurement?.status === 'disetujui' ? 2 : 1;
  const st = pos.map((p) => poStatus(p, ctx));
  if (st.every((s) => s === 'selesai')) return 6;
  if (st.includes('draft')) return 2;
  if (st.some((s) => ['dikirim', 'sebagian'].includes(s))) return 3;
  const allInv = pos.every((p) =>
    receiptsOf(p, ctx.receipts).every((r) => uninvoicedLines(r, ctx.invoices).length === 0),
  );
  return allInv ? 5 : 4;
}

// Berkas IOM (data lama menyimpan satu berkas di `file`).
export const iomFiles = (iom) => iom?.files ?? (iom?.file ? [iom.file] : []);

// Peminta untuk tampilan (data lama menyimpan 'Anda').
export const requesterOf = (f) => (!f.requester || f.requester === 'Anda' ? personLabel('peminta') : f.requester);

// Nama jalur pengadaan untuk tampilan.
export const routeLabel = (f) => (f.single?.on ? 'Vendor tunggal' : f.route === 'bidding' ? 'Bidding' : '');


// --- Penawaran & bidding ----------------------------------------------------------------------
export const quoteLine = (q, itemId) => q.lines.find((l) => l.itemId === itemId);
export const quoteSum = (q, items) =>
  sum(q.lines, (l) => l.price * (items.find((i) => i.id === l.itemId)?.qty ?? 0));

// Pemenang per item. Pada jalur vendor tunggal, pemenangnya otomatis vendor pada penawaran pertama.
export const winnerOf = (f, itemId) => f.procurement?.winners?.[itemId] ?? (f.single?.on ? f.quotes[0]?.vendorId : undefined);

// Garansi disimpan sebagai teks "12 bulan"; dibaca kembali menjadi angka + satuan.
export function parseWarranty(text) {
  const m = /^\s*(\d+)\s*(hari|bulan|tahun)\s*$/i.exec(text ?? '');
  return m ? { warrantyValue: Number(m[1]), warrantyUnit: m[2].toLowerCase() } : { warrantyValue: 0, warrantyUnit: 'bulan' };
}
// Penilaian vendor (opsional): kriteria, bobot (%), dan patokan nilai 5 vs 1.
export const CRITERIA = [
  { key: 'harga', label: 'Harga', weight: 45, guide: '5 = termurah · 1 = paling mahal di antara penawaran' },
  { key: 'spek', label: 'Spesifikasi', weight: 30, guide: '5 = sesuai penuh dan ada kelebihan · 1 = tidak sesuai' },
  { key: 'waktu', label: 'Waktu penyerahan', weight: 15, guide: '5 = jauh sebelum tanggal dibutuhkan · 1 = lewat tanggal dibutuhkan' },
  { key: 'termin', label: 'Termin', weight: 10, guide: '5 = tempo panjang tanpa DP · 1 = harus lunas di muka' },
];
// Arti angka 1-5 yang dipakai di semua kriteria.
export const SCORE_SCALE = [
  { value: 5, label: 'Sangat baik', text: 'Jauh melampaui kebutuhan' },
  { value: 4, label: 'Baik', text: 'Di atas kebutuhan' },
  { value: 3, label: 'Cukup', text: 'Pas memenuhi kebutuhan' },
  { value: 2, label: 'Kurang', text: 'Di bawah kebutuhan, masih bisa diterima' },
  { value: 1, label: 'Buruk', text: 'Tidak memenuhi kebutuhan' },
];
// Skor akhir vendor: rata-rata tertimbang penilaian 1-5. null bila belum semua kriteria dinilai.
export const vendorScore = (f, vendorId) => {
  const s = f.procurement?.scores?.[vendorId] ?? {};
  if (CRITERIA.some((c) => !s[c.key])) return null;
  const weight = CRITERIA.reduce((n, c) => n + c.weight, 0);
  return CRITERIA.reduce((n, c) => n + s[c.key] * c.weight, 0) / weight;
};
// --- Termin bayar -------------------------------------------------------------------------------
// Persen yang ditagih di muka, sebelum barang/jasa diterima. Jadi dasar Payment Request DP.
export const advancePct = (t) => {
  if (!t) return 0;
  const { advance } = termMechanics(t);
  if (advance === 'full') return 100;
  if (advance === 'partial') return t.dpPct ?? 0;
  return 0;
};
export const termDp = (t) => advancePct(t);
// Judul tombol/bagian pembayaran di muka: "DP" kalau sebagian, "bayar di muka" kalau penuh.
export const advanceLabel = (t) => (advancePct(t) >= 100 ? 'bayar di muka' : 'DP');

// --- Jadwal termin / periode jasa -----------------------------------------------------------------
// Termin progres dan layanan berkala dipecah jadi beberapa baris SPK: satu baris per termin/periode,
// plus satu baris retensi kalau ada. Dengan begitu BAPP, faktur, Payment Request, dan PV per termin
// memakai mesin yang sama dengan barang — tidak perlu entitas jadwal terpisah.
export const scheduleCount = (t) => {
  if (!t) return 1;
  const { split } = termMechanics(t);
  if (split === 'terms') return Math.max(t.terms ?? 1, 1);
  if (split === 'periods') return Math.max(t.periods ?? 1, 1);
  return 1;
};
const slotLabel = (t, i, n) => {
  if (termMechanics(t).split === 'periods') {
    const unit = t.period ? t.period[0].toUpperCase() + t.period.slice(1) : 'Periode';
    return `${unit} ke-${i} dari ${n}`;
  }
  return `Termin ${i} dari ${n}`;
};
// Jadwal yang uang mukanya sudah dikeluarkan dari nilai termin: tiap termin dihitung dari
// sisa setelah DP, jadi faktur termin tidak boleh dipotong DP lagi (lihat invDpDeduct).
export const scheduleExcludesDp = (t) => termMechanics(t).dpOutOfSchedule;

// Bobot tiap termin dalam persen. Kalau belum diatur di penawaran, dibagi rata.
export function termPcts(t) {
  const n = scheduleCount(t);
  const list = Array.isArray(t?.termPcts) ? t.termPcts.slice(0, n) : [];
  if (list.length === n && list.every((p) => p > 0)) return list;
  const base = Math.floor((100 / n) * 10) / 10;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? Math.round((100 - base * (n - 1)) * 10) / 10 : base));
}

// Nilai yang dibagi ke termin: nilai pekerjaan dikurangi uang muka dan retensi.
export const scheduleBase = (gross, term) => {
  const retPct = termMechanics(term).retention ? term.retentionPct ?? 0 : 0;
  const dpPct = scheduleExcludesDp(term) ? advancePct(term) : 0;
  return gross - Math.round((gross * retPct) / 100) - Math.round((gross * dpPct) / 100);
};

export function expandSchedule(items, term, startIso) {
  const n = scheduleCount(term);
  const retPct = termMechanics(term).retention ? term.retentionPct ?? 0 : 0;
  if (n <= 1 && retPct === 0) return items;
  const periodic = termMechanics(term).split === 'periods';
  const pcts = termPcts(term);
  return items.flatMap((it) => {
    const gross = it.qty * it.price;
    const retained = Math.round((gross * retPct) / 100);
    const work = scheduleBase(gross, term);
    let used = 0;
    const rows = pcts.map((pct, k) => {
      // Baris terakhir menyerap pembulatan supaya jumlahnya persis sama dengan nilai jadwal.
      const price = k === n - 1 ? work - used : Math.round((work * pct) / 100);
      used += price;
      // Termin berkala terikat kalender: rentangnya dihitung dari tanggal mulai kontrak,
      // dan dipakai untuk label, kunci tanggal pencatatan, serta tanggal jurnal.
      const range = periodic && startIso ? periodRange(startIso, term.period, k + 1) : null;
      return {
        ...it,
        id: `${it.id}-s${k + 1}`,
        desc: `${it.desc} — ${slotLabel(term, k + 1, n)}${periodic ? '' : ` · ${pct}%`}`,
        qty: 1,
        unit: periodic ? 'periode' : 'termin',
        slot: k + 1,
        slotOf: n,
        pct: periodic ? undefined : pct,
        ...(range && { periodFrom: range.from, periodTo: range.to }),
        price,
      };
    });
    if (retained > 0) {
      rows.push({
        ...it,
        id: `${it.id}-ret`,
        slot: n + 1,
        slotOf: n + 1,
        desc: `${it.desc} — Retensi ${retPct}% (ditagih setelah pemeliharaan ${term.retentionMonths ?? 0} bulan)`,
        qty: 1,
        unit: 'retensi',
        price: retained,
      });
    }
    return rows;
  });
}

// Termin dipecah jadi nama pendek + rincian parameter, supaya tabel bisa menaruhnya di dua
// baris dan teks panjang tidak memaksa kolom sempit membungkus jadi banyak baris.
// Lama tempo faktur dalam hari.
//
//   0  = jatuh tempo pada tanggal acuan itu sendiri (bayar saat barang/pekerjaan diterima)
//   30 = hanya dipakai kalau pesanannya sama sekali tidak punya termin (data lama)
//
// Dulu dihitung `dueDays > 0 ? dueDays : 30`, sehingga termin tanpa tempo (CAD, CBD) dan
// termin yang sengaja diisi 0 hari sama-sama jatuh ke 30 hari — vendor mendapat tempo yang
// tidak pernah disepakati.
export const dueDaysOf = (t) => {
  if (!t) return 30;
  return termMechanics(t).due ? Math.max(t.dueDays ?? 0, 0) : 0;
};

export function termParts(t) {
  if (!t) return { label: '—', detail: '' };
  const mech = termMechanics(t);
  const fields = termFields(mech);
  // Nama termin diambil dari salinan yang ikut tersimpan, jadi dokumen lama tetap terbaca
  // dengan nama saat dokumen itu dibuat walau katalognya sudah diubah.
  const name = (mech.label ?? t.type).split(' (')[0];
  const parts = [];
  if (fields.includes('terms')) parts.push(`${t.terms ?? 0} termin`);
  if (fields.includes('retention')) parts.push(`retensi ${t.retentionPct ?? 0}% · pemeliharaan ${t.retentionMonths ?? 0} bln`);
  if (fields.includes('period')) {
    const unit = periodOptions.find((o) => o.value === t.period)?.label ?? t.period ?? '';
    parts.push(t.periods > 1 ? `${unit} × ${t.periods}` : unit);
  }
  // Kapan harus dibayar selalu disebut, termasuk saat tidak ada tenggat — "bayar saat diterima"
  // itu kesepakatan, bukan ketiadaan informasi. Dikecualikan hanya termin yang dibayar penuh
  // di muka: uangnya sudah keluar sebelum barang datang, jadi tidak ada tempo untuk disebut.
  const days = dueDaysOf(t);
  if (days > 0) parts.push(`tempo ${days} hari sejak ${dueFromLabel(mech.dueFrom)}`);
  else if (mech.advance !== 'full') parts.push('jatuh tempo saat ' + dueFromLabel(mech.dueFrom));
  // Persentase uang muka menyatu dengan nama ("DP 30%"), bukan jadi rincian terpisah.
  const label = fields.includes('dp') ? `${name} ${t.dpPct ?? 0}%` : name;
  return { label, detail: parts.join(' · ') };
}

// Identitas termin, untuk membandingkan dua dokumen. Dua pesanan bertermin sama hanya bila
// nama, mekanisme, dan seluruh parameternya sama.
//
// Dipakai saat menggabungkan beberapa FPB/BAPP ke dalam satu faktur: satu faktur hanya punya
// satu jatuh tempo dan satu aturan potongan uang muka, jadi penerimaan bertermin berbeda tidak
// boleh dicampur. Kalau dipaksa, salah satu vendor akan ditagih dengan syarat yang tidak pernah
// disepakati untuk pesanannya.
export function termKey(t) {
  if (!t) return 'none';
  const m = termMechanics(t);
  return JSON.stringify([
    m.label ?? t.type ?? '',
    m.advance, m.split, m.dpOutOfSchedule, m.retention, m.due, m.dueFrom,
    t.dpPct ?? null, t.terms ?? null, t.period ?? null, t.periods ?? null,
    t.retentionPct ?? null, t.retentionMonths ?? null, dueDaysOf(t),
  ]);
}

// Jatuh tempo satu penerimaan menurut termin pesanannya.
// Titik hitung 'receipt' -> tanggalnya sudah pasti sekarang, jadi bisa ditampilkan.
// Titik hitung 'invoice' -> belum bisa dihitung, karena tanggal fakturnya baru diisi nanti.
export function receiptDue(po, receiptDate) {
  const t = po?.term;
  const m = termMechanics(t);
  const days = dueDaysOf(t);
  if (m.advance === 'full') return { date: null, text: 'Dibayar di muka' };
  if (m.dueFrom === 'invoice') {
    return { date: null, text: days > 0 ? `${days} hari sejak tgl faktur` : 'Saat faktur terbit' };
  }
  const date = days > 0 ? addDays(receiptDate, days) : receiptDate;
  return { date, text: formatDate(date), exact: true };
}

// Jatuh tempo pesanan yang ditagih LANGSUNG, tanpa FPB/BAPP. Tidak ada tanggal penerimaan
// untuk dijadikan acuan, jadi tempo apa pun yang disepakati dihitung dari tanggal faktur —
// tanggal yang baru diisi di langkah berikutnya, maka yang ditampilkan rumusnya.
export function poDue(po) {
  const m = termMechanics(po?.term);
  const days = dueDaysOf(po?.term);
  if (m.advance === 'full') return { date: null, text: 'Dibayar di muka' };
  return { date: null, text: days > 0 ? `${days} hari sejak tgl faktur` : 'Saat faktur terbit' };
}

// Teks termin satu baris, untuk PDF dan kolom informasi yang lebar.
export function termText(t) {
  const { label, detail } = termParts(t);
  return detail ? `${label} · ${detail}` : label;
}
// Minimal peserta bidding: nilai sampai Rp10 juta cukup 2 penawaran, di atasnya 3.
// Permintaan tidak memuat harga, jadi nilainya baru terbaca setelah penawaran masuk; selama
// belum ada penawaran yang lengkap dipakai batas terendah (2) agar bidding tidak terkunci.
export const minQuotesFor = (f) => (procurementValue(f) > 10_000_000 ? 3 : 2);
// Approver menurut nilai pengadaan.
export const approverFor = (total) => (total < 50_000_000 ? 'Manager' : total <= 500_000_000 ? 'General Manager' : 'Direktur');

// Buang atribut non-termin (lead, garansi) dari ketentuan final.
const termOnly = ({ lead, warrantyValue, warrantyUnit, ...t }) => { void lead; void warrantyValue; void warrantyUnit; return t; };

// Ketentuan final vendor: awalnya dari penawaran, lalu ditimpa hasil negosiasi.
export const finalTermOf = (f, vendorId) => {
  const q = f.quotes.find((x) => x.vendorId === vendorId);
  // Seluruh isi term ikut, termasuk parameter jasa (termin, retensi, periode).
  const base = { ...(q?.term ?? {}), lead: q?.lead ?? 0, ...parseWarranty(q?.warranty) };
  return { ...base, ...(f.procurement?.finalTerms?.[vendorId] ?? {}) };
};
// Syarat berubah bila termin, waktu penyerahan, atau garansi berbeda dari penawaran.
export const termChanged = (f, vendorId) => {
  const q = f.quotes.find((x) => x.vendorId === vendorId);
  if (!q) return false;
  const t = finalTermOf(f, vendorId);
  const w = parseWarranty(q.warranty);
  return termText(t) !== termText(q.term) || t.lead !== q.lead || t.warrantyValue !== w.warrantyValue || (t.warrantyValue > 0 && t.warrantyUnit !== w.warrantyUnit);
};
const winnerVendors = (f) => [...new Set(f.items.map((it) => winnerOf(f, it.id)).filter(Boolean))];
// Pemenang bidding: satu vendor untuk seluruh permintaan (semua item jatuh ke vendor yang sama).
export const biddingWinner = (f) => {
  const vs = winnerVendors(f);
  return vs.length === 1 && f.items.every((it) => winnerOf(f, it.id)) ? vs[0] : undefined;
};
// Vendor hanya bisa jadi pemenang kalau menawar semua item.
export const quotesAllItems = (f, vendorId) => {
  const q = f.quotes.find((x) => x.vendorId === vendorId);
  return !!q && f.items.every((it) => quoteLine(q, it.id));
};

// Harga final vendor untuk satu item: hasil negosiasi, atau harga awal bila belum diubah.
export const offerPrice = (f, vendorId, itemId) => {
  const p = f.procurement ?? {};
  const q = f.quotes.find((x) => x.vendorId === vendorId);
  const l = q && quoteLine(q, itemId);
  if (!l) return null;
  // Harga final lama (satu harga per item untuk pemenang) hanya dipakai pada vendor tunggal dan bidding yang sudah diajukan;
  // pada draf bidding, harga mengikuti penawaran sehingga memilih pemenang tidak mengubah harga.
  const legacy = f.single?.on || p.status === 'diajukan' || p.status === 'disetujui';
  return p.offerFinals?.[vendorId]?.[itemId] ?? (legacy && winnerOf(f, itemId) === vendorId ? p.finals?.[itemId] : undefined) ?? l.price;
};
// Subtotal, diskon, PPN, ongkir, dan total satu vendor pada form bidding.
export function vendorTotals(f, vendorId) {
  const p = f.procurement ?? {};
  const q = f.quotes.find((x) => x.vendorId === vendorId);
  let base = 0;
  let dpp = 0;
  let ppn = 0;
  for (const it of f.items) {
    const l = q && quoteLine(q, it.id);
    if (!l) continue;
    const b = it.qty * offerPrice(f, vendorId, it.id);
    const t = lineTaxes(q, l);
    base += b;
    if (t.includes('ppn_incl')) {
      dpp += b / (1 + RULES.ppn);
      ppn += b - b / (1 + RULES.ppn);
    } else {
      dpp += b;
      ppn += t.includes('ppn') ? b * RULES.ppn : 0;
    }
  }
  const disc = Math.min(p.discounts?.[vendorId] ?? 0, base);
  const r = base > 0 ? 1 - disc / base : 1;
  const ship = p.shipping?.[vendorId] ?? 0;
  return { base, dpp: Math.round(dpp * r), disc, ppn: Math.round(ppn * r), ship, total: Math.round((dpp + ppn) * r) + ship };
}
// Nilai pengadaan menurut penawaran: total vendor pemenang, atau penawaran terendah bila
// pemenang belum dipilih. Dipakai untuk aturan jumlah penawaran dan penentuan approver.
// Bernilai 0 selama belum ada vendor yang menawar seluruh item.
export function procurementValue(f) {
  const full = f.quotes.filter((q) => quotesAllItems(f, q.vendorId));
  if (full.length === 0) return 0;
  const w = biddingWinner(f);
  if (w && full.some((q) => q.vendorId === w)) return vendorTotals(f, w).total;
  return Math.min(...full.map((q) => vendorTotals(f, q.vendorId).total));
}

// Akibat yang timbul kalau jalur pengadaan ditukar. Daftar kosong berarti pergantiannya
// tidak mengubah apa pun, jadi tidak perlu dikonfirmasi. Dipakai bersama oleh panel pengadaan
// (untuk memutuskan perlu modal atau tidak) dan oleh modal konfirmasinya (sebagai isi).
// Tidak ada penawaran yang dihapus pada pergantian jalur mana pun.
export function routeSwitchEffects(f, mode, vendorName = (id) => id) {
  const toSingle = mode === 'single';
  const n = f.quotes.length;
  const out = [];
  if (toSingle && n > 0) {
    const w = biddingWinner(f);
    const used = w && f.quotes.some((q) => q.vendorId === w) ? w : f.quotes[0]?.vendorId;
    out.push(`Penawaran ${vendorName(used)} yang dipakai sebagai satu-satunya penawaran.`);
    if (n > 1) out.push(`${n - 1} penawaran lain disembunyikan dari layar, tapi tidak dihapus — kembali ke bidding dan semuanya muncul lagi.`);
    if (w) out.push('Penetapan pemenang dilepas, karena jalur vendor tunggal tidak memilih pemenang.');
  }
  if (!toSingle && n > 0) {
    const need = minQuotesFor(f);
    if (n < need) out.push(`Bidding butuh minimal ${need} penawaran, sekarang baru ada ${n}.`);
    out.push('Pemenang perlu dipilih kembali sebelum pengadaan bisa diajukan.');
  }
  if (f.procurement?.status === 'diajukan') {
    out.push('Pengajuan ke approver ditarik kembali ke draf dan perlu diajukan ulang.');
  }
  return out;
}

// Pemenang bukan vendor dengan total penawaran terendah (hanya vendor yang menawar semua item yang dibandingkan).
export const notCheapest = (f) => {
  const w = biddingWinner(f);
  if (!w) return false;
  const totals = f.quotes.filter((q) => quotesAllItems(f, q.vendorId)).map((q) => vendorTotals(f, q.vendorId).total);
  return totals.length > 0 && vendorTotals(f, w).total > Math.min(...totals);
};

export const needsBiddingNote = (f) => {
  const p = f.procurement;
  if (!p || p.kind !== 'bidding') return false;
  if (winnerVendors(f).some((v) => termChanged(f, v))) return true;
  return f.items.some((it) => {
    const wv = winnerOf(f, it.id);
    const q = f.quotes.find((x) => x.vendorId === wv);
    const l = q && quoteLine(q, it.id);
    if (!l) return false;
    return offerPrice(f, wv, it.id) > l.price;
  });
};


// Satu catatan pengadaan: alasan pemilihan + catatan negosiasi digabung (data lama menyimpannya terpisah).
export const biddingNote = (f) =>
  [f.procurement?.reason, f.procurement?.negotiation].filter((x) => x?.trim()).join('\n\n');
// Berkas bukti negosiasi (data lama menyimpan satu nama berkas).
export const proofFiles = (p) => p?.proofs ?? (p?.proof ? [p.proof] : []);

export function biddingReady(f) {
  const enough = f.quotes.length >= minQuotesFor(f) || (f.single?.on && f.quotes.length >= 1);
  if (!enough) return false;
  if (!f.items.every((it) => winnerOf(f, it.id))) return false;
  const note = biddingNote(f);
  if (!f.single?.on && notCheapest(f) && !note) return false;
  if (needsBiddingNote(f) && !note) return false;
  return true;
}

// --- Bangun PO dari pengadaan yang disetujui ----------------------------------------------
export function buildPOs(f, pos, vendors) {
  const p = f.procurement;
  const groups = {};
  const note = '';
  // Diskon vendor (hasil negosiasi) dibagi rata ke semua harga itemnya agar total PO sama dengan form bidding.
  const ratio = {};
  if (f.route === 'bidding') {
    for (const v of new Set(f.items.map((it) => winnerOf(f, it.id)))) {
      const base = f.items.filter((it) => winnerOf(f, it.id) === v).reduce((n, it) => n + it.qty * offerPrice(f, v, it.id), 0);
      const disc = Math.min(p.discounts?.[v] ?? 0, base);
      ratio[v] = base > 0 ? 1 - disc / base : 1;
    }
  }
  for (const it of f.items) {
    let vendorId;
    let price;
    let q;
    if (f.route === 'bidding') {
      vendorId = winnerOf(f, it.id);
      q = f.quotes.find((x) => x.vendorId === vendorId);
      price = Math.round(offerPrice(f, vendorId, it.id) * (ratio[vendorId] ?? 1));
    } else {
      q = f.quotes[0];
      vendorId = q.vendorId;
      price = quoteLine(q, it.id).price;
    }
    // Pajak per item mengikuti penawaran; harga "sudah termasuk PPN" diubah menjadi DPP agar total PO sama dengan penawaran.
    const taxes = lineTaxes(q, quoteLine(q, it.id));
    const incl = taxes.includes('ppn_incl');
    if (incl) price = Math.round(price / (1 + RULES.ppn));
    const pph = taxes.find((t) => t in PPH_RATE);
    groups[vendorId] ??= { vendorId, q, items: [] };
    groups[vendorId].items.push({
      ...it,
      price,
      ppnRate: incl || taxes.includes('ppn') ? RULES.ppn : 0,
      ppnIncluded: incl,
      pphRate: pph ? PPH_RATE[pph] : 0,
    });
  }
  void vendors;
  return Object.values(groups).map((g) => ({
    vendorId: g.vendorId,
    // Termin dibawa utuh supaya parameter jasa (termin, retensi, periode) ikut ke SPK.
    term: termOnly(finalTermOf(f, g.vendorId) ?? g.q?.term ?? {}),
    items: g.items,
    note,
    lead: (finalTermOf(f, g.vendorId)?.lead ?? g.q?.lead) ?? 7,
    // Ada serah terima atau tidak — disepakati di penawaran, lalu dibawa ke PO/SPK.
    // Penawaran lama tanpa kolom ini dianggap memakai serah terima, seperti sebelumnya.
    withReceipt: g.q?.withReceipt !== false,
  }));
}

// --- Rekening vendor ---------------------------------------------------------------------------
// Data lama menyimpan rekening sebagai satu string ("BCA 123-456-7890"); sekarang terpisah
// bank / cabang / nomor / nama pemilik, mengikuti bentuk rekening di modul Kontak.
export function bankOf(vendor) {
  const b = vendor?.bank;
  if (!b) return null;
  if (typeof b === 'string') {
    const [bank, ...rest] = b.split(' ');
    return { bank, branch: '', number: rest.join(' '), holder: vendor.name ?? '' };
  }
  return { bank: b.bank ?? '', branch: b.branch ?? '', number: b.number ?? '', holder: b.holder ?? vendor.name ?? '' };
}
// Satu baris ringkas untuk tabel dan PDF, mis. "BCA 123-456-7890 a.n. PT Alfa Sejahtera".
// Email vendor; data lama belum punya kolom ini, jadi boleh kosong.
export const vendorEmail = (vendor) => vendor?.email?.trim() || '';

export const bankLine = (vendor) => {
  const b = bankOf(vendor);
  if (!b) return '—';
  return `${b.bank} ${b.number}${b.holder ? ` a.n. ${b.holder}` : ''}`.trim();
};

// --- Statuses (label & warna) -------------------------------------------------------------------
// Aturan warna dibaca dari "siapa yang ditunggu", bukan dari seberapa jauh prosesnya:
//   abu (gray)   = draf, belum berjalan
//   oranye       = menunggu keputusan atau tindakan orang dalam (verifikasi, approval, bayar)
//   biru         = berjalan, bolanya di pihak luar (vendor mengirim, gudang menerima)
//   cyan         = sudah lolos tahap kritis, tinggal langkah terakhir
//   hijau        = tuntas
//   merah        = ditolak atau dikembalikan
//   slate        = dihentikan (dibatalkan, ditutup)
// Oranye sengaja dibatasi supaya "ada yang perlu saya kerjakan" tetap menonjol di daftar.
export const FPPBJ_STATUS = {
  draft: { label: 'Draf', color: 'gray' },
  diajukan: { label: 'Diajukan', color: 'orange' }, // menunggu verifikasi (lihat VERIFY di permissions.js)
  dikembalikan: { label: 'Dikembalikan', color: 'red' },
  dibatalkan: { label: 'Dibatalkan', color: 'slate' },
  diverifikasi: { label: 'Diverifikasi', color: 'blue' }, // lolos verifikasi, jalur pengadaan belum dipilih
  dalam_pengadaan: { label: 'Dalam pengadaan', color: 'blue' },
  selesai: { label: 'Selesai', color: 'green' },
};
export const PO_STATUS = {
  draft: { label: 'Draf', color: 'gray' },
  dikirim: { label: 'Dikirim ke vendor', color: 'blue' }, // menunggu barang dari vendor
  sebagian: { label: 'Diterima sebagian', color: 'blue' },
  diterima: { label: 'Diterima penuh', color: 'cyan' }, // barang beres, tinggal faktur & bayar
  selesai: { label: 'Selesai', color: 'green' },
  dibatalkan: { label: 'Dibatalkan', color: 'slate' },
  ditutup: { label: 'Ditutup', color: 'slate' },
};
// Alur sesudah faktur: PR -> approval -> Payment Voucher -> pembayaran -> jurnal.
// Dulu PV terbit bersamaan dengan transfer, jadi tidak ada dokumen perintah bayar yang
// mendahului uang keluar. Sekarang PV diterbitkan lebih dulu sebagai perintah bayar, dan
// transfernya dicatat terhadap PV itu.
export const PR_STATUS = {
  diajukan: { label: 'Menunggu approval', color: 'orange' },
  disetujui: { label: 'Siap diterbitkan PV', color: 'cyan' }, // lolos approval, menunggu PV
  diproses: { label: 'PV terbit', color: 'blue' }, // perintah bayar ada, uang belum keluar
  dibayar: { label: 'Dibayar', color: 'green' },
  ditolak: { label: 'Ditolak', color: 'red' },
};

// Payment Voucher punya umurnya sendiri: terbit -> dibayar. Jurnal kas keluarnya ikut
// terposting saat pembayaran dicatat, jadi tidak jadi tahap tersendiri: tidak ada keadaan
// "uang sudah keluar tapi belum dijurnal" yang perlu dikejar orang.
export const PV_STATUS = {
  draf: { label: 'Belum dibayar', color: 'orange' },
  dibayar: { label: 'Dibayar', color: 'green' },
};
// 'dijurnal' adalah nama lama dari keadaan yang sekarang cukup disebut 'dibayar'.
// Voucher tanpa kolom status sama sekali berasal dari data lama yang memang sudah tuntas.
export const pvStatus = (v) => (!v?.status || v.status === 'dijurnal' ? 'dibayar' : v.status);
export const pvPaid = (v) => pvStatus(v) === 'dibayar';
// Tanggal posting jurnal; voucher lama yang tidak menyimpannya dianggap terposting saat dibayar.
export const pvJournalDate = (v) => (pvPaid(v) ? v?.journalPostedAt ?? v?.paidAt ?? v?.date ?? null : null);
export const pvPosted = (v) => !!pvJournalDate(v);
// Tiga keadaan yang dilihat orang keuangan: sudah lunas, belum dibayar, atau sudah lewat tempo.
// "Dibayar sebagian" dihapus — yang penting dari faktur yang baru dibayar separuh adalah bahwa
// ia MASIH punya sisa hutang, sama seperti yang belum dibayar sama sekali; nominal yang sudah
// masuk tetap terbaca di kolom sisa hutang dan di halaman detailnya.
export const INV_STATUS = {
  belum: { label: 'Belum dibayar', color: 'orange' },
  tempo: { label: 'Jatuh tempo', color: 'red' }, // masih bersisa dan tanggalnya sudah lewat
  lunas: { label: 'Lunas', color: 'green' },
  // Bukan tahap pembayaran, tapi faktur yang dibatalkan harus tetap bisa dibedakan: tanpa ini
  // ia akan terbaca "Belum dibayar" padahal memang tidak akan pernah dibayar.
  dibatalkan: { label: 'Dibatalkan', color: 'slate' },
};
export const RECEIPT_STATUS = {
  draf: { label: 'Menunggu approval atasan', color: 'orange' },
  dikonfirmasi: { label: 'Dikonfirmasi', color: 'green' },
};
export const PROC_STATUS = {
  draf: { label: 'Draf', color: 'gray' },
  diajukan: { label: 'Menunggu approval', color: 'orange' },
  disetujui: { label: 'Disetujui', color: 'green' },
  ditolak: { label: 'Ditolak', color: 'red' },
};

// Buat PO (draf) dari pengadaan yang disetujui: satu PO per vendor.
export function createPOs(f, pb) {
  const built = buildPOs(f, pb.pos, pb.vendors);
  const created = [];
  let list = pb.pos;
  built.forEach((b) => {
    const doc = {
      id: uid('po'),
      // Nomor ikut jenis dokumen: SPK punya deret sendiri, terpisah dari PO.
      number: nextNumber(poAllJasa({ items: b.items }) ? 'SPK' : 'PO', list),
      date: TODAY,
      fppbjId: f.id,
      vendorId: b.vendorId,
      sent: false,
      term: b.term,
      expectedAt: new Date(Date.parse(TODAY) + b.lead * 864e5).toISOString().slice(0, 10),
      // Gudang tujuan diwarisi dari lokasi kirim pada permintaannya; bila permintaan
      // belum menyebutkannya, dipakai gudang utama. SPK (semua jasa) tidak mengirim
      // barang ke gudang, jadi dikosongkan.
      warehouseId: poAllJasa({ items: b.items })
        ? null
        : (f.warehouseId ?? defaultWarehouseId(pb.warehouses ?? [])),
      ppnIncluded: b.items.some((i) => i.ppnIncluded),
      // Termin progres / layanan berkala langsung dipecah jadi baris per termin di SPK.
      items: expandSchedule(b.items, b.term, TODAY),
      withReceipt: b.withReceipt,
      note: b.note,
    };
    list = [doc, ...list];
    pb.add('pos', doc);
    created.push(doc);
  });
  return created;
}
