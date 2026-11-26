// Perhitungan & aturan modul Pembelian (murni fungsi; state ada di store.jsx).
import { periodOptions, personLabel, RULES, TODAY } from './data.js';
import { defaultWarehouseId } from '@/pages/Gudang/data.js';
import { dueFromLabel, termFields, termMechanics } from './paymentTerms.js';

import { addDays, formatDate, rupiah } from '@/pages/Penjualan/utils.js';

export { rupiahShort } from '@/pages/Penjualan/utils.js';
export { rupiah };
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
// DPP uang muka (model PDF): persen DP x nilai pesanan sebelum PPN.
export const poDpDpp = (po) => {
  const pct = advancePct(po?.term) / 100;
  if (pct <= 0) return 0;
  const sub = poSubtotal(po);
  return Math.round(scheduleExcludesDp(po?.term) && pct < 1 ? (sub * pct) / (1 - pct) : sub * pct);
};
// Tarif PPN pesanan (baris pertama); dipakai untuk faktur uang muka.
export const poPpnRate = (po) => lineRate(po?.items?.[0]);
// Persen PPh yang biasa dipotong untuk pesanan ini, dari tarif PPh per item.
export const poPphPct = (po) => {
  const sub = poSubtotal(po);
  return sub ? Math.round((sum(po.items, (i) => i.qty * i.price * (i.pphRate ?? 0)) / sub) * 10000) / 100 : 0;
};
// Pesanan yang isinya jasa semua dikirim sebagai SPK, bukan PO. Campuran barang + jasa tetap PO.
export const poDocLabel = (po) => (po && poAllJasa(po) ? 'SPK' : 'PO');
// Jenis item (barang / jasa) ditentukan per baris, bukan per PO.
export const itemKind = (po, itemId) => po?.items.find((i) => i.id === itemId)?.kind ?? 'barang';
export const poAllJasa = (po) => po.items.length > 0 && po.items.every((i) => i.kind === 'jasa');
// Dokumen yang membuka pelepasan retensi. Bukan penerimaan (FPB/BAPP): tidak ada barang/jasa
// baru, hanya bukti masa pemeliharaan atau garansi selesai tanpa cacat tersisa.
// Jasa (SPK): BAST akhir (BAST II / FHO). Barang (PO): berita acara akhir garansi.
export const retentionDocName = (po) => (po && !poAllJasa(po) ? 'Berita acara akhir garansi' : 'BAST akhir');
export const poAllBarang = (po) => po.items.every((i) => i.kind !== 'jasa');
// Faktur masih punya baris barang yang bisa diretur (jasa tidak diretur).
export const canReturn = (inv, po, returns) =>
  !!po && !isDpInvoice(inv) && !inv.cancelled && inv.lines.some((l) => itemKind(po, l.itemId) === 'barang' && l.qty > returnedQty(inv.id, l.itemId, returns));

export const receiptsOf = (po, receipts) => receipts.filter((r) => r.poId === po.id);
// FPB/BAPP yang ditolak tetap memegang qty-nya (akan diajukan ulang); hanya yang dibatalkan
// yang melepaskan qty supaya bisa dicatat di penerimaan lain.
export const receiptLive = (r) => r?.status !== 'dibatalkan';
export const receivedQty = (po, itemId, receipts) =>
  sum(receiptsOf(po, receipts).filter(receiptLive), (r) => sum(r.lines.filter((l) => l.itemId === itemId), (l) => l.qty));
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
// Kunci periode: termin berkala baru bisa di-BAPP setelah periodenya lewat, dan retensi baru
// bisa dilepas setelah masa pemeliharaan selesai. Matikan (false) hanya untuk uji coba lokal.
export const KUNCI_PERIODE = true;

export function scheduleRows(po, receipts, today, picked = []) {
  const rows = po.items.map((it) => {
    const received = remainingQty(po, it.id, receipts) === 0;
    const lockedUntil = KUNCI_PERIODE && it.periodTo && it.periodTo > today ? it.periodTo : null;
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
// Pesanan yang dibatalkan atau ditutup tidak menyisakan apa pun untuk ditagih.
export const uninvoicedPoLines = (po, invoices) =>
  !po || po.closedAs || poPending(po) || poHasReceipt(po)
    ? []
    : po.items
      .map((it) => ({ ...it, open: it.qty - invoicedQtyOfPo(po.id, it.id, invoices) }))
      .filter((l) => l.open > 0);

// Penerimaan baru bisa difaktur setelah terkonfirmasi. Data lama tanpa kolom status
// dianggap sudah terkonfirmasi.
export const receiptConfirmed = (r) => (r?.status ?? 'dikonfirmasi') === 'dikonfirmasi';
// Kunci RECEIPT_STATUS untuk satu penerimaan: status approval selama belum sah,
// lalu status penagihannya.
export const receiptStatus = (r, invoices) => {
  if (!receiptConfirmed(r)) return r.status;
  return uninvoicedLines(r, invoices).length > 0 ? 'belum_difaktur' : 'sudah_difaktur';
};
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
export const isManualInvoice = (inv) => !!inv && !isDpInvoice(inv) && !isRetentionRelease(inv) && inv.lines.every((l) => !l.receiptId);
// Faktur uang muka: tagihan DP/CBD dari vendor atas satu PO/SPK, sebelum barang/jasanya
// diterima. Dicatat lebih dulu, baru diajukan Payment Request dan dibayar lewat PV.
export const isDpInvoice = (inv) => inv?.type === 'dp';
// Faktur uang muka yang masih hidup untuk satu pesanan.
export const dpInvoiceOf = (poId, invoices) => liveInvoices(invoices).find((i) => isDpInvoice(i) && i.poId === poId);

// Status uang muka satu pesanan, dibaca bertahap. null bila terminnya tidak menagih di muka.
//   belum_faktur — vendor belum menagih DP (faktur uang muka belum dicatat)
//   belum_bayar  — faktur uang muka ada, belum lunas
//   lunas        — sudah dibayar
//   dibatalkan   — uang muka dibatalkan resmi (disetujui Chief Finance), ditagih penuh di akhir
// PR DP lama tanpa faktur uang muka tetap dikenali supaya data lama tidak ikut terkunci.
export function dpState(po, { invoices = [], prs = [], pos = [], returns = [] } = {}) {
  if (!po || advancePct(po.term) <= 0) return null;
  if (po.dpWaiver?.status === 'disetujui') return { state: 'dibatalkan', waiver: po.dpWaiver };
  const lama = prs.find((p) => p.kind === 'dp' && p.poId === po.id && !(p.invoiceIds ?? []).length && p.status !== 'ditolak');
  if (lama) return { state: lama.status === 'dibayar' ? 'lunas' : 'belum_bayar', pr: lama };
  const inv = dpInvoiceOf(po.id, invoices);
  if (!inv) return { state: 'belum_faktur', waiver: po.dpWaiver };
  const pr = prs.find((p) => p.kind === 'dp' && p.invoiceIds?.includes(inv.id) && p.status !== 'ditolak');
  const t = invTotals(inv, { pos, prs, returns, invoices });
  return { state: t.balance <= 0 ? 'lunas' : 'belum_bayar', inv, pr };
}
// Faktur pelunasan menunggu uang muka beres: lunas, atau dibatalkan resmi.
export const dpBlocks = (s) => !!s && (s.state === 'belum_faktur' || s.state === 'belum_bayar');
// Alasan satu kalimat, dipakai di baris yang dinonaktifkan dan di tooltip tombol.
export function dpBlockReason(s) {
  if (!dpBlocks(s)) return null;
  if (s.state === 'belum_faktur') {
    return s.waiver?.status === 'diajukan'
      ? 'Pembatalan uang muka menunggu approval Chief Finance'
      : 'Menunggu faktur uang muka dicatat';
  }
  const doc = s.inv?.number ?? s.pr?.number;
  if (!s.pr) return `Menunggu PR uang muka ${doc} diajukan`;
  return `Menunggu uang muka ${doc} dibayar · ${PR_STATUS[s.pr.status]?.label ?? s.pr.status}`;
}
// Label status untuk ditampilkan di detail PO dan callout.
export const DP_STATE = {
  belum_faktur: { label: 'Faktur uang muka belum dicatat', color: 'orange' },
  belum_bayar: { label: 'Uang muka belum dibayar', color: 'orange' },
  lunas: { label: 'Uang muka lunas', color: 'green' },
  dibatalkan: { label: 'Uang muka dibatalkan', color: 'gray' },
};
// Nama baris faktur: dari item pesanan bila bersandar penerimaan, atau deskripsi yang diketik.
export const invLineDesc = (l, item) => item?.desc ?? l.desc ?? '—';

// --- Retensi -------------------------------------------------------------------------------
// Pelepasan retensi: dokumen setelah masa pemeliharaan selesai (BAST akhir). Bukan faktur baru —
// PPN-nya sudah ikut di faktur termin — tapi disimpan di koleksi faktur supaya Payment Request
// dan PV memakai jalur yang sama.
export const isRetentionRelease = (inv) => inv?.type === 'retensi';

// Persen retensi yang ditahan dari faktur pesanan ini. SPK lama yang retensinya masih berupa
// baris jadwal tersendiri ("Retensi 5%") tetap memakai cara lama: tidak ada potongan di faktur.
export const retentionPctOf = (po) =>
  po && termMechanics(po.term).retention && !po.items.some((i) => i.unit === 'retensi') ? po.term.retentionPct ?? 0 : 0;

// Retensi dihitung dari nilai termin kotor: 5% x nilai termin. Pada jadwal yang uang mukanya
// sudah dikeluarkan (DP + termin), baris termin hanya berisi sisa setelah DP, jadi nilai
// kotornya dipulihkan dulu (termin / (1 - DP%)). Totalnya selalu persen retensi x nilai kontrak.
const retentionOfDpp = (po, dpp) => {
  const pct = retentionPctOf(po);
  if (!pct) return 0;
  const dpPct = scheduleExcludesDp(po.term) ? Math.min(advancePct(po.term), 99) : 0;
  return (dpp * pct) / (100 - dpPct);
};
export const poRetentionTarget = (po) => Math.round(retentionOfDpp(po, poSubtotal(po)));

// Retensi yang ditahan oleh satu faktur, per pesanan. Faktur yang menutup pesanan menyerap
// sisa pembulatan supaya saldo Hutang Retensi persis persen retensi x nilai kontrak.
export function invRetention(inv, pos, invoices = []) {
  if (!inv || isDpInvoice(inv) || isRetentionRelease(inv)) return 0;
  const bills = liveInvoices(invoices).filter((i) => !isDpInvoice(i) && !isRetentionRelease(i));
  const linesOf = (i, poId) => i.lines.filter((l) => (l.poId ?? i.poId) === poId);
  const dppOf = (i, poId) => sum(linesOf(i, poId), (l) => l.qty * l.price);
  let total = 0;
  for (const poId of [...new Set(inv.lines.map((l) => l.poId ?? inv.poId))]) {
    const po = pos.find((p) => p.id === poId);
    if (!retentionPctOf(po)) continue;
    const idx = bills.findIndex((i) => i.id === inv.id);
    const before = (idx >= 0 ? bills.slice(0, idx) : bills.filter((i) => i.id !== inv.id)).filter((i) => linesOf(i, poId).length);
    const own = dppOf(inv, poId);
    const prevDpp = sum(before, (i) => dppOf(i, poId));
    const prevRet = sum(before, (i) => Math.round(retentionOfDpp(po, dppOf(i, poId))));
    const target = poRetentionTarget(po);
    const closes = prevDpp + own >= poSubtotal(po) - 1;
    total += closes ? Math.max(target - prevRet, 0) : Math.round(retentionOfDpp(po, own));
  }
  return total;
}

// Ringkasan retensi satu pesanan: ditahan dari faktur termin, sudah dilepas, dan saldonya.
export function poRetention(po, invoices = []) {
  const pct = retentionPctOf(po);
  if (!pct) return null;
  const live = liveInvoices(invoices);
  const bills = live.filter((i) => !isDpInvoice(i) && !isRetentionRelease(i) && i.lines.some((l) => (l.poId ?? i.poId) === po.id));
  const held = sum(bills, (i) => invRetention(i, [po], invoices));
  const releases = live.filter((i) => isRetentionRelease(i) && i.poId === po.id);
  const released = sum(releases, (i) => i.amount ?? 0);
  const target = poRetentionTarget(po);
  const billedAll = sum(bills, (i) => sum(i.lines.filter((l) => (l.poId ?? i.poId) === po.id), (l) => l.qty * l.price)) >= poSubtotal(po) - 1;
  // Masa pemeliharaan dihitung dari faktur termin terakhir (serah terima pekerjaan selesai).
  const lastBill = bills.map((i) => i.date).sort().at(-1) ?? null;
  const maintenanceEnd = billedAll && lastBill ? addMonths(lastBill, po.term.retentionMonths ?? 0) : null;
  return { pct, months: po.term.retentionMonths ?? 0, target, held, released, balance: held - released, billedAll, maintenanceEnd, releases, bills };
}

export const invDpp = (inv) => sum(inv.lines, (l) => l.qty * l.price);
export const invPpn = (inv) => Math.round(sum(inv.lines, (l) => l.qty * l.price * lineRate(l)));
export const invPph = (inv) => Math.round((invDpp(inv) * (inv.pphPct || 0)) / 100);

// Uang muka PO yang sudah DIAKUI, dipotongkan proporsional ke tiap faktur (per PO).
//
// Dasarnya faktur uang muka yang tercatat, bukan pembayarannya: hutang uang muka sudah lahir
// saat fakturnya dicatat. Kalau dasarnya pembayaran, faktur pelunasan yang dibuat sebelum DP
// dibayar akan berubah nilainya diam-diam begitu DP-nya lunas. Faktur pelunasan sendiri baru
// bisa dibuat setelah DP lunas (dpBlocks), jadi kedua dasar itu memberi angka yang sama.
// PR DP lama tanpa faktur uang muka tetap dihitung dari yang sudah dibayar.
// Faktur uang muka model PDF: DPP dan PPN-nya dipisah (faktur pajak uang muka terbit saat DP
// ditagih). Potongannya di faktur termin lalu dihitung dari DPP, dan PPN termin hanya atas
// (nilai termin - potongan DP). Faktur uang muka lama menyimpan satu baris bruto tanpa PPN;
// pesanan seperti itu tetap dipotong bruto seperti sebelumnya.
export const dpSplitsPpn = (inv) => isDpInvoice(inv) && inv.lines.some((l) => lineRate(l) > 0);

// Potongan uang muka satu faktur, dipecah per model:
//   gross - model lama: bagian bruto (DPP + PPN) uang muka, dipotong dari total
//   dpp   - model PDF: bagian DPP uang muka, dipotong sebelum PPN dihitung
// Faktur yang menutup pesanan menyerap sisa pembulatan supaya saldo Uang Muka habis tepat nol.
export function invDpParts(inv, pos, prs, invoices = []) {
  const out = { gross: 0, dpp: 0 };
  // Faktur uang muka dan pelepasan retensi tidak memotong uang muka.
  if (isDpInvoice(inv) || isRetentionRelease(inv)) return out;
  const bills = liveInvoices(invoices).filter((i) => !isDpInvoice(i) && !isRetentionRelease(i));
  const linesOf = (i, poId) => i.lines.filter((l) => (l.poId ?? i.poId) === poId);
  const dppOf = (i, poId) => sum(linesOf(i, poId), (l) => l.qty * l.price);
  const grossOf = (i, poId) => sum(linesOf(i, poId), (l) => l.qty * l.price * (1 + lineRate(l)));
  for (const poId of [...new Set(inv.lines.map((l) => l.poId ?? inv.poId))]) {
    const po = pos.find((p) => p.id === poId);
    if (!po) continue;
    // Jadwal lama yang sudah mengeluarkan DP dari nilai termin: tidak dipotong lagi.
    if (scheduleExcludesDp(po.term)) continue;
    // Uang muka yang dibatalkan resmi tidak pernah ditagih, jadi tidak ada yang dipotong.
    if (po.dpWaiver?.status === 'disetujui') continue;
    const dpInvs = liveInvoices(invoices).filter((i) => isDpInvoice(i) && i.poId === po.id);
    const idx = bills.findIndex((i) => i.id === inv.id);
    const before = (idx >= 0 ? bills.slice(0, idx) : bills.filter((i) => i.id !== inv.id)).filter((i) => linesOf(i, poId).length);
    const closes = sum(before, (i) => dppOf(i, poId)) + dppOf(inv, poId) >= poSubtotal(po) - 1;
    if (dpInvs.some(dpSplitsPpn)) {
      const dpDpp = sum(dpInvs, (i) => invDpp(i));
      const share = (i) => Math.round((dpDpp * dppOf(i, poId)) / poSubtotal(po));
      const used = Math.min(sum(before, share), dpDpp);
      out.dpp += closes ? dpDpp - used : Math.min(share(inv), dpDpp - used);
      continue;
    }
    const dpLama = sum(
      prs.filter((p) => p.kind === 'dp' && p.poId === po.id && p.status === 'dibayar' && !(p.invoiceIds ?? []).length),
      (p) => p.amount,
    );
    const dpPaid = sum(dpInvs, (i) => invDpp(i) + invPpn(i)) + dpLama;
    if (dpPaid) out.gross += Math.min(Math.round((dpPaid * grossOf(inv, poId)) / poTotal(po)), dpPaid);
  }
  return out;
}
export function invDpDeduct(inv, pos, prs, invoices = []) {
  const p = invDpParts(inv, pos, prs, invoices);
  return p.gross + p.dpp;
}

// Pemakaian uang muka pada termin yang jadwalnya SUDAH mengeluarkan DP (DP + termin progres,
// DP + berkala). Fakturnya tidak dipotong DP (lihat invDpDeduct), tapi uang muka yang sudah
// dibayar tetap harus keluar dari akun Uang Muka dan diakui sebagai biaya — kalau tidak, ia
// menggantung selamanya dan biaya kontrak tercatat kurang sebesar DP.
//
// Porsinya proporsional terhadap nilai termin: termin Rp 26,64 jt dari jadwal Rp 106,56 jt
// memakai 25% dari DP. Faktur yang menutup jadwal menyerap sisa pembulatan, jadi saldo uang
// mukanya habis tepat nol. Hutang ke vendor tidak berubah.
export function dpAmortization(inv, pos, prs = [], invoices = []) {
  if (!inv || isDpInvoice(inv)) return [];
  const bills = liveInvoices(invoices).filter((i) => !isDpInvoice(i));
  const linesOf = (i, poId) => i.lines.filter((l) => (l.poId ?? i.poId) === poId);
  const grossOf = (i, poId) => sum(linesOf(i, poId), (l) => l.qty * l.price * (1 + lineRate(l)));
  const out = [];
  for (const poId of [...new Set(inv.lines.map((l) => l.poId ?? inv.poId))]) {
    const po = pos.find((p) => p.id === poId);
    if (!po || !scheduleExcludesDp(po.term) || po.dpWaiver?.status === 'disetujui') continue;
    const dpGross =
      sum(liveInvoices(invoices).filter((i) => isDpInvoice(i) && i.poId === poId), (i) => invDpp(i) + invPpn(i))
      + sum(prs.filter((p) => p.kind === 'dp' && p.poId === poId && p.status === 'dibayar' && !(p.invoiceIds ?? []).length), (p) => p.amount);
    const total = poTotal(po);
    if (!dpGross || !total) continue;
    // Faktur sebelumnya menurut urutan pencatatan; faktur yang belum tersimpan dianggap paling akhir.
    const idx = bills.findIndex((i) => i.id === inv.id);
    const before = (idx >= 0 ? bills.slice(0, idx) : bills.filter((i) => i.id !== inv.id)).filter((i) => linesOf(i, poId).length);
    const shareOf = (g) => Math.round((dpGross * g) / total);
    const consumed = Math.min(sum(before, (i) => shareOf(grossOf(i, poId))), dpGross);
    const gross = grossOf(inv, poId);
    const lunas = sum(before, (i) => grossOf(i, poId)) + gross >= total - 1;
    const amount = lunas ? dpGross - consumed : Math.min(shareOf(gross), dpGross - consumed);
    if (amount <= 0) continue;
    const dppBase = sum(linesOf(inv, poId), (l) => l.qty * l.price);
    const rate = dppBase ? gross / dppBase - 1 : 0;
    const dpp = Math.round(amount / (1 + rate));
    out.push({ poId, amount, dpp, ppn: amount - dpp });
  }
  return out;
}

export const returnValue = (ret) => sum(ret.lines, (l) => l.qty * l.price);
// Nilai retur yang diselesaikan sebagai "kredit vendor": tidak memotong faktur asalnya,
// tapi jadi saldo yang bisa dialokasikan ke faktur lain milik vendor yang sama.
// Nilai satu retur yang mengurangi tagihan: harga faktur + PPN faktur per baris, ditambah ongkir
// bila vendor ikut mengembalikannya (`freight` per unit disimpan di baris retur). Dibulatkan per
// baris, sama dengan jurnal retur (Pembelian/journal.js), supaya sub-buku dan buku besar satu angka.
export const returnBilled = (r, inv) =>
  sum(r.lines, (l) => {
    const dpp = l.qty * l.price;
    const il = inv?.lines.find((x) => x.itemId === l.itemId && (!l.receiptId || x.receiptId === l.receiptId))
      ?? inv?.lines.find((x) => x.itemId === l.itemId);
    return Math.round(dpp) + Math.round(dpp * lineRate(il)) + Math.round(r.freightRefunded ? l.qty * (l.freight ?? 0) : 0);
  });
export const returnGross = (r, invoices) => returnBilled(r, invoices.find((x) => x.id === r.invoiceId));
// Saldo kredit vendor = kredit dari retur - yang sudah dipakai di faktur mana pun (kecuali yang dibatalkan).
export function vendorCredit(vendorId, { returns, invoices }) {
  const earned = sum(
    returns.filter((r) => r.settlement === 'kredit' && invoices.find((x) => x.id === r.invoiceId)?.vendorId === vendorId),
    (r) => returnGross(r, invoices),
  );
  const used = sum(liveInvoices(invoices).filter((i) => i.vendorId === vendorId), (i) => i.credit ?? 0);
  return Math.max(earned - used, 0);
}

// Sisa kredit vendor milik satu retur. Pemakaian kredit dicatat per faktur (inv.credit), bukan per
// retur, jadi dibagi ke retur vendor itu urut dari yang paling lama: retur lama habis lebih dulu.
export function returnCreditLeft(ret, { returns = [], invoices = [] }) {
  if (ret?.settlement !== 'kredit') return 0;
  const vendorOf = (r) => invoices.find((x) => x.id === r.invoiceId)?.vendorId;
  const vendorId = vendorOf(ret);
  let used = sum(liveInvoices(invoices).filter((i) => i.vendorId === vendorId), (i) => i.credit ?? 0);
  const urut = returns
    .filter((r) => r.settlement === 'kredit' && vendorOf(r) === vendorId)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.number).localeCompare(String(b.number))));
  for (const r of urut) {
    const nilai = returnGross(r, invoices);
    const pakai = Math.min(nilai, Math.max(used, 0));
    used -= pakai;
    if (r.id === ret.id) return nilai - pakai;
  }
  return 0;
}

// Status retur yang dilihat orang, dari penyelesaiannya:
//   potong : hutang faktur langsung berkurang → Selesai
//   kredit : saldo kredit vendor menunggu dipakai di faktur berikutnya → Selesai setelah habis
//   refund : menunggu uang dari vendor (bolanya di vendor) → Selesai setelah refund dicatat
export const RETURN_STATUS = {
  menunggu_refund: { label: 'Menunggu refund', color: 'blue' },
  kredit_tersedia: { label: 'Kredit tersedia', color: 'cyan' },
  selesai: { label: 'Selesai', color: 'green' },
};
export function returnState(ret, ctx) {
  if (ret?.settlement === 'refund') return ret.refund ? 'selesai' : 'menunggu_refund';
  if (ret?.settlement === 'kredit') return returnCreditLeft(ret, ctx) > 0 ? 'kredit_tersedia' : 'selesai';
  return 'selesai';
}
export const SETTLEMENT_LABEL = { potong: 'Potong hutang', kredit: 'Kredit vendor', refund: 'Refund dari vendor' };

export const invReturns = (inv, returns) =>
  sum(returns.filter((r) => r.invoiceId === inv.id && r.settlement === 'potong'), (r) => returnBilled(r, inv));

// Pembayaran pelunasan yang menunjuk faktur ini. committed = termasuk yang belum dibayar.
export function prAllocated(inv, prs, { onlyPaid }) {
  return sum(
    prs.filter(
      (p) =>
        // PR uang muka yang menunjuk faktur uang muka juga melunasi faktur itu.
        (p.kind === 'pelunasan' || (p.kind === 'dp' && p.invoiceIds?.includes(inv.id)))
        && (onlyPaid ? p.status === 'dibayar' : p.status !== 'ditolak'),
    ),
    (p) => p.alloc?.[inv.id] ?? (p.invoiceIds.length === 1 && p.invoiceIds[0] === inv.id ? p.amount : 0),
  );
}

export function invTotals(inv, { pos, prs, returns, invoices = [] }) {
  // Faktur batal bernilai nol di mana pun ia muncul (hutang, sisa, daftar pembayaran).
  if (inv.cancelled) return { dpp: 0, ppn: 0, pph: 0, dp: 0, ret: 0, retensi: 0, credit: 0, total: 0, paid: 0, balance: 0, free: 0 };
  if (isRetentionRelease(inv)) {
    // Pelepasan retensi: saldo Hutang Retensi pindah ke Hutang Usaha, dipotong PPh-nya
    // (PPh atas porsi retensi dipotong saat retensi dibayar). Tanpa PPN.
    const amount = inv.amount ?? 0;
    const pph = Math.round((amount * (inv.pphPct || 0)) / 100);
    const total = Math.max(amount - pph, 0);
    const paid = prAllocated(inv, prs, { onlyPaid: true });
    const committed = prAllocated(inv, prs, { onlyPaid: false });
    return { dpp: amount, ppn: 0, pph, dp: 0, ret: 0, retensi: 0, credit: 0, total, paid, balance: Math.max(total - paid, 0), free: Math.max(total - committed, 0) };
  }
  const dpp = invDpp(inv);
  const parts = invDpParts(inv, pos, prs, invoices);
  // Model PDF: PPN termin = tarif x (nilai termin - potongan DP), karena PPN atas porsi DP sudah
  // ada di faktur uang muka.
  const ppn = invPpn(inv) - Math.round(parts.dpp * lineRate(inv.lines[0]));
  // Retensi ditahan dari faktur termin; PPh hanya atas uang yang benar-benar dibayar sekarang
  // (nilai termin - potongan DP - retensi). PPh atas porsi retensi dipotong saat dilepas.
  const retensi = invRetention(inv, pos, invoices);
  const pph = Math.round(((dpp - parts.dpp - retensi) * (inv.pphPct || 0)) / 100);
  const dp = parts.gross + parts.dpp;
  const ret = invReturns(inv, returns);
  const credit = inv.credit ?? 0; // kredit vendor yang dialokasikan ke faktur ini
  const total = Math.max(dpp + ppn - pph - dp - ret - retensi - credit, 0);
  const paid = prAllocated(inv, prs, { onlyPaid: true });
  const committed = prAllocated(inv, prs, { onlyPaid: false });
  return {
    dpp,
    ppn,
    pph,
    dp,
    dpDpp: parts.dpp,
    ret,
    retensi,
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
  if (poPending(po)) return 'menunggu_approval';
  // PO/SPK berlaku sejak dibuat (dari pengadaan yang sudah disetujui). Mengirim dokumennya
  // ke vendor opsional, jadi bukan bagian dari status: tidak ada lagi "draft"/"dikirim".
  const invs = liveInvoices(invoices).filter((i) => i.poId === po.id);
  // Pesanan ber-DP yang uang mukanya belum beres (faktur DP belum dicatat / belum lunas, dan
  // tidak dibatalkan resmi): vendor biasanya baru bergerak setelah DP dibayar, jadi yang
  // ditunggu adalah pembayaran kita. Begitu ada penerimaan/tagihan, status ikut itu.
  const dpPending = dpBlocks(dpState(po, { invoices, prs, pos, returns }));
  let allInvoiced;
  if (poHasReceipt(po)) {
    const full = po.items.every((i) => remainingQty(po, i.id, receipts) === 0);
    const any = po.items.some((i) => receivedQty(po, i.id, receipts) > 0);
    if (!any) return dpPending ? 'menunggu_dp' : 'menunggu';
    if (!full) return 'sebagian';
    // FPB/BAPP yang masih menunggu approval atau ditolak belum bisa difaktur, jadi belum
    // "beres difaktur": tanpa syarat konfirmasi, pesanan seperti itu terbaca Selesai.
    allInvoiced = receiptsOf(po, receipts)
      .filter(receiptLive)
      .every((r) => receiptConfirmed(r) && uninvoicedLines(r, invoices).length === 0);
  } else {
    // Pesanan tanpa FPB/BAPP (CBD, jasa per termin tanpa berita acara) tidak pernah punya
    // penerimaan: yang ditunggu adalah tagihannya, ditagih langsung dari PO/SPK.
    allInvoiced = po.items.every((i) => invoicedQtyOfPo(po.id, i.id, invoices) >= i.qty);
    const anyBilled = po.items.some((i) => invoicedQtyOfPo(po.id, i.id, invoices) > 0);
    if (!anyBilled && dpPending) return 'menunggu_dp';
    if (!allInvoiced) return 'menunggu_tagihan';
  }
  const paidOff = (i) => invTotals(i, { pos, prs, returns, invoices }).balance <= 0;
  if (allInvoiced && invs.filter((i) => !isRetentionRelease(i)).every(paidOff)) {
    // Termin sudah lunas tapi retensinya masih ditahan: pesanan belum tuntas, menunggu masa
    // pemeliharaan selesai dan retensinya dilepas. Faktur pelepasan yang sudah dicatat tapi
    // belum dibayar juga masih masa pemeliharaan; tanpa ini status mundur ke "Diterima penuh".
    const rt = poRetention(po, invoices);
    if (rt && (rt.balance > 0 || !rt.releases.every(paidOff))) return 'pemeliharaan';
    return 'selesai';
  }
  // Barang/jasa beres (atau, tanpa serah terima, semua sudah ditagih): tinggal faktur & bayar.
  return poHasReceipt(po) ? 'diterima' : 'ditagih';
}

// Langkah stepper permintaan (indeks aktif).
export const fppbjSteps = ['Permintaan', 'Pengadaan', 'PO', 'Penerimaan', 'Faktur', 'Pelunasan'];
export function fppbjStep(f, ctx) {
  if (f.status === 'dibatalkan') return -1;
  if (['draft', 'dikembalikan', 'diajukan'].includes(f.status)) return 0;
  if (f.status === 'diverifikasi') return 1;
  // Pesan ulang yang ditolak tidak pernah berlaku, jadi tidak ikut menentukan tahap.
  const pos = ctx.pos.filter((p) => p.fppbjId === f.id && p.closedAs !== 'ditolak');
  if (!pos.length) return f.procurement?.status === 'disetujui' ? 2 : 1;
  const st = pos.map((p) => poStatus(p, ctx));
  if (st.every((s) => s === 'selesai')) return 6;
  if (st.includes('menunggu_dp') || st.includes('menunggu_approval')) return 2;
  if (st.some((s) => ['menunggu', 'sebagian'].includes(s))) return 3;
  if (st.includes('menunggu_tagihan')) return 4;
  const allInv = pos.every((p) =>
    receiptsOf(p, ctx.receipts).filter(receiptLive).every((r) => uninvoicedLines(r, ctx.invoices).length === 0),
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

// Ongkos kirim yang ditagih vendor pada penawarannya. Opsional: penawaran tanpa
// kolom ini (termasuk data lama) berarti ongkir sudah termasuk harga barang.
export const quoteShipping = (q) => Math.max(0, Number(q?.shipping) || 0);
// Diskon penawaran dalam rupiah. Disimpan sebagai { mode: 'rp' | 'pct', value }
// supaya diskon persen ikut menyesuaikan kalau harga item dinegosiasi ulang.
// Tidak pernah melebihi nilai dasarnya.
export function quoteDiscount(q, base) {
  const d = q?.discount;
  const v = Number(d?.value) || 0;
  if (!d || v <= 0 || base <= 0) return 0;
  return Math.min(d.mode === 'pct' ? Math.round((base * Math.min(v, 100)) / 100) : Math.round(v), base);
}
// Cara diskon ditulis di layar, mis. "5%" atau "Rp250.000".
export const quoteDiscountLabel = (q) => {
  const d = q?.discount;
  const v = Number(d?.value) || 0;
  if (!d || v <= 0) return '';
  return d.mode === 'pct' ? `${v}%`.replace('.', ',') : rupiah(v);
};
// Nilai penawaran apa adanya (sebelum negosiasi): harga item, dikurangi diskon,
// ditambah ongkir. Dipakai tabel pembanding dan detail penawaran.
export function quoteTotals(q, items) {
  const base = sum(items, (it) => (quoteLine(q, it.id)?.price ?? 0) * it.qty);
  const disc = quoteDiscount(q, base);
  const ship = quoteShipping(q);
  return { base, disc, ship, total: base - disc + ship };
}

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
  // Tanpa pecahan termin (mis. bayar penuh + retensi): satu tagihan utama, lalu retensinya.
  if (termMechanics(t).split === 'none') return 'Pembayaran utama';
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

// Nilai yang dibagi ke termin: nilai pekerjaan dikurangi uang muka (bila DP di luar jadwal).
// Retensi TIDAK dikeluarkan dari jadwal: ia ditahan dari setiap faktur termin (Cr Hutang
// Retensi) lalu dilepas sekaligus setelah masa pemeliharaan (lihat invRetention).
export const scheduleBase = (gross, term) => {
  const dpPct = scheduleExcludesDp(term) ? advancePct(term) : 0;
  return gross - Math.round((gross * dpPct) / 100);
};

export function expandSchedule(items, term, startIso) {
  const n = scheduleCount(term);
  if (n <= 1) return items;
  const periodic = termMechanics(term).split === 'periods';
  const single = termMechanics(term).split === 'none';
  const pcts = termPcts(term);
  return items.flatMap((it) => {
    const gross = it.qty * it.price;
    const work = scheduleBase(gross, term);
    let used = 0;
    const rows = pcts.map((pct, k) => {
      // Baris terakhir menyerap pembulatan supaya jumlahnya persis sama dengan nilai jadwal.
      // Tagihan berkala dibagi rata per periode (Rp 72 jt / 6 = Rp 12 jt tiap bulan), bukan
      // lewat persen yang sudah dibulatkan (16,6%) — itu membuat lima bulan pertama kurang
      // sedikit dan bulan terakhir menanggung selisihnya.
      const share = periodic ? Math.round(work / n) : Math.round((work * pct) / 100);
      const price = k === n - 1 ? work - used : share;
      used += price;
      // Termin berkala terikat kalender: rentangnya dihitung dari tanggal mulai kontrak,
      // dan dipakai untuk label, kunci tanggal pencatatan, serta tanggal jurnal.
      const range = periodic && startIso ? periodRange(startIso, term.period, k + 1) : null;
      return {
        ...it,
        id: `${it.id}-s${k + 1}`,
        desc: `${it.desc} — ${slotLabel(term, k + 1, n)}${periodic || single ? '' : ` · ${pct}%`}`,
        qty: 1,
        unit: periodic ? 'periode' : 'termin',
        slot: k + 1,
        slotOf: n,
        pct: periodic || single ? undefined : pct,
        ...(range && { periodFrom: range.from, periodTo: range.to }),
        price,
      };
    });
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
  // Diskon dan ongkir datang dari penawaran vendor; angka hasil negosiasi di
  // pengadaan (kalau ada) menimpanya.
  const disc = Math.min(p.discounts?.[vendorId] ?? quoteDiscount(q, base), base);
  const r = base > 0 ? 1 - disc / base : 1;
  const ship = p.shipping?.[vendorId] ?? quoteShipping(q);
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
  // Diskon vendor dibagi rata ke semua harga itemnya agar total PO sama dengan form bidding.
  // Sumbernya penawaran vendor, ditimpa angka hasil negosiasi bila pengadaan mengisinya.
  // Berlaku untuk kedua jalur: vendor tunggal juga bisa menawarkan diskon.
  const vendorOf = (it) => (f.route === 'bidding' ? winnerOf(f, it.id) : f.quotes[0]?.vendorId);
  const ratio = {};
  for (const v of new Set(f.items.map(vendorOf).filter(Boolean))) {
    const qv = f.quotes.find((x) => x.vendorId === v);
    const base = f.items.filter((it) => vendorOf(it) === v).reduce((n, it) => n + it.qty * offerPrice(f, v, it.id), 0);
    const disc = Math.min(p.discounts?.[v] ?? quoteDiscount(qv, base), base);
    ratio[v] = base > 0 ? 1 - disc / base : 1;
  }
  for (const it of f.items) {
    const vendorId = vendorOf(it);
    const q = f.quotes.find((x) => x.vendorId === vendorId);
    // offerPrice memakai harga final hasil negosiasi bila ada, selain itu harga penawaran.
    let price = Math.round(offerPrice(f, vendorId, it.id) * (ratio[vendorId] ?? 1));
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
    // Ongkir yang ditagih vendor ikut ke PO: ia bagian dari harga perolehan barang,
    // jadi harus tersimpan di dokumen yang kelak menghasilkan mutasi stok.
    shipping: f.procurement?.shipping?.[g.vendorId] ?? quoteShipping(g.q),
  }));
}

// Harga perolehan persediaan ada di landedCost.js (modul murni, tanpa ketergantungan
// dokumen) dan di-ekspor ulang dari sini supaya pemanggil lama tetap jalan.
export { freightOf, freightShare, landedUnitCost, totalFreight } from './landedCost.js';

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
//   biru         = berjalan, bolanya di pihak luar (vendor mengirim atau menagih)
//   cyan         = beres di lapangan, tinggal urusan administrasi (buat PO, faktur, tagih).
//                  Secara aturan "siapa bertindak" ini tim sendiri, tapi sengaja tidak oranye
//                  supaya yang benar-benar macet tetap menonjol. Pengecualian: langkah yang
//                  mengeluarkan uang (Menunggu PV, Menunggu pembayaran) tetap oranye karena
//                  ada tenggat bayar ke vendor.
//   hijau        = tuntas
//   merah        = tidak akan berjalan (ditolak, dibatalkan)
//   slate        = dihentikan setelah sebagian berjalan (ditutup)
// Kata "Menunggu" di label menyebut APA yang ditunggu; warnanya menyebut SIAPA yang bertindak.
// Oranye sengaja dibatasi supaya "ada yang perlu saya kerjakan" tetap menonjol di daftar.
export const FPPBJ_STATUS = {
  draft: { label: 'Draf', color: 'gray' },
  diajukan: { label: 'Menunggu verifikasi', color: 'orange' }, // lihat VERIFY di permissions.js
  // Dikembalikan bukan akhir: peminta memperbaiki lalu mengajukan ulang, jadi oranye (perlu tindakan).
  dikembalikan: { label: 'Dikembalikan', color: 'orange' },
  dibatalkan: { label: 'Dibatalkan', color: 'red' },
  // Lolos verifikasi, tim pengadaan belum memilih jalur. Label menyebut apa yang sedang ditunggu,
  // bukan tahap yang sudah lewat; oranye karena bolanya di tim sendiri (tugas "Pilih jalur pengadaan").
  diverifikasi: { label: 'Menunggu pengadaan', color: 'orange' },
  dalam_pengadaan: { label: 'Dalam pengadaan', color: 'blue' },
  selesai: { label: 'Selesai', color: 'green' },
};
export const PO_STATUS = {
  // Pesan ulang dengan harga naik: belum berlaku sampai approval genap (lihat reorder).
  menunggu_approval: { label: 'Menunggu approval', color: 'orange', pending: true },
  menunggu_dp: { label: 'Menunggu uang muka', color: 'orange' }, // DP belum dicatat/dibayar, belum ada penerimaan/tagihan
  menunggu: { label: 'Menunggu penerimaan', color: 'blue' }, // PO berlaku, vendor belum mengirim
  menunggu_tagihan: { label: 'Menunggu tagihan', color: 'blue' }, // tanpa FPB/BAPP: vendor belum menagih
  sebagian: { label: 'Diterima sebagian', color: 'blue' },
  diterima: { label: 'Diterima penuh', color: 'cyan' }, // barang beres, tinggal faktur & bayar
  ditagih: { label: 'Ditagih penuh', color: 'cyan' }, // tanpa FPB/BAPP: semua sudah ditagih, tinggal bayar
  pemeliharaan: { label: 'Masa pemeliharaan', color: 'violet' }, // termin lunas, retensi masih ditahan
  selesai: { label: 'Selesai', color: 'green' },
  dibatalkan: { label: 'Dibatalkan', color: 'red' },
  // Pesan ulang yang tidak disetujui: PO tidak pernah berlaku.
  ditolak: { label: 'Ditolak', color: 'red' },
  ditutup: { label: 'Ditutup', color: 'slate' },
};
// SPK jasa: yang diterima adalah pekerjaan, jadi "Diterima" diganti bahasa pekerjaan.
// Kuncinya sama, hanya labelnya; filter dan logika tetap memakai PO_STATUS.
export const SPK_STATUS = {
  ...PO_STATUS,
  sebagian: { ...PO_STATUS.sebagian, label: 'Dikerjakan sebagian' },
  diterima: { ...PO_STATUS.diterima, label: 'Selesai dikerjakan' },
};
export const poStatusMap = (po) => (poAllJasa(po) ? SPK_STATUS : PO_STATUS);
// Alur sesudah faktur: PR -> approval -> Payment Voucher -> pembayaran -> jurnal.
// Dulu PV terbit bersamaan dengan transfer, jadi tidak ada dokumen perintah bayar yang
// mendahului uang keluar. Sekarang PV diterbitkan lebih dulu sebagai perintah bayar, dan
// transfernya dicatat terhadap PV itu.
export const PR_STATUS = {
  diajukan: { label: 'Menunggu approval', color: 'orange', pending: true },
  // Lolos approval; Finance sendiri yang harus menerbitkan PV, jadi oranye (perlu tindakan).
  disetujui: { label: 'Menunggu PV', color: 'orange' },
  // Perintah bayar ada, uang belum keluar; Finance sendiri yang membayar, jadi oranye.
  diproses: { label: 'Menunggu pembayaran', color: 'orange' },
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
  dibatalkan: { label: 'Dibatalkan', color: 'red' },
};
// Status FPB/BAPP yang dilihat orang: satu siklus hidup, bukan status approval mentah.
// "Dikonfirmasi" sendiri tidak pernah tampil, karena begitu sah pertanyaannya tinggal
// sudah atau belum ditagih. Urutan kunci = urutan di filter.
export const RECEIPT_STATUS = {
  draf: { label: 'Menunggu approval', color: 'orange', pending: true },
  ditolak: { label: 'Ditolak', color: 'red' }, // sama dengan penolakan approval di Payment Request
  // Sudah sah, tinggal satu langkah (faktur): cyan, bukan oranye, supaya tidak tertukar
  // dengan yang masih macet di approval.
  belum_difaktur: { label: 'Belum difaktur', color: 'cyan' },
  sudah_difaktur: { label: 'Sudah difaktur', color: 'green' },
  dibatalkan: { label: 'Dibatalkan', color: 'red' },
};
// Menunggu tanda tangan approver (bukan ditolak / dibatalkan).
export const receiptPending = (r) => r?.status === 'draf';
export const PROC_STATUS = {
  draf: { label: 'Draf', color: 'gray' },
  diajukan: { label: 'Menunggu approval', color: 'orange', pending: true },
  disetujui: { label: 'Disetujui', color: 'cyan' }, // PO masih harus dibuat, jadi belum hijau (tuntas)
  ditolak: { label: 'Ditolak', color: 'red' },
};

// Kenapa pesanan tidak bisa dihentikan (dibatalkan/ditutup), atau null bila boleh.
// Sesudah ada penerimaan, tagihan, atau pembayaran yang sedang berjalan, menghentikan
// pesanan akan meninggalkan dokumen turunan yang menggantung (faktur atas pesanan batal,
// PR yang tetap bisa dibayar). Dokumen itu harus dibereskan dulu.
export const PR_ACTIVE = ['diajukan', 'disetujui', 'diproses'];
export function poStopBlock(po, { receipts, invoices, prs }) {
  if (receiptsOf(po, receipts).some(receiptLive)) return 'Sudah ada penerimaan (FPB/BAPP) yang dicatat.';
  const invs = liveInvoices(invoices).filter((i) => i.poId === po.id || i.lines.some((l) => l.poId === po.id));
  if (invs.length) return `Sudah ada ${invs.length} faktur. Batalkan fakturnya dulu.`;
  const invIds = new Set(invs.map((i) => i.id));
  const aktif = prs.filter((p) => PR_ACTIVE.includes(p.status) && (p.poId === po.id || (p.invoiceIds ?? []).some((id) => invIds.has(id))));
  if (aktif.length) return `Payment Request ${aktif[0].number} masih berjalan.`;
  return null;
}
// --- Pesan ulang (repeat order) -------------------------------------------------------------------
// Barang/jasa yang sama dipesan lagi dari PO/SPK yang sudah Selesai, memakai permintaan yang sama
// tanpa FPPBJ baru. Harga dan jumlah boleh disesuaikan. Setiap pesan ulang adalah uang keluar
// baru, jadi PO-nya selalu menunggu approval (rantai `reorder`) sebelum bisa dikirim, diterima,
// atau ditagih. Bedanya hanya alasan: wajib bila harga atau total naik. Kontrak bertermin tidak didukung: baris terminnya terikat tanggal kontrak lama.
export const poPending = (po) => po?.reorder?.status === 'diajukan';

// --- Ubah harga PO ------------------------------------------------------------------------------
// Diajukan dari form faktur saat harga di invoice vendor berbeda dari harga PO. Selama
// menunggu approval (Chief Finance lalu Building Manager), sisa pesanan belum bisa difaktur.
// Disetujui: harga item PO diganti dan berlaku untuk qty yang belum difaktur; faktur yang
// sudah ada tidak berubah. Selisih terhadap nilai penerimaan dibukukan jurnal faktur ke
// akun selisih (lihat invoiceJournal).
export const priceChangePending = (po) => po?.priceChange?.status === 'diajukan';
export const priceChangeOf = (po, itemId) => po?.priceChange?.items?.find((c) => c.itemId === itemId);
export function buildPriceChange(po, prices, { reason, invoiceNo, file, by }) {
  return {
    status: 'diajukan',
    items: po.items
      .filter((i) => prices[i.id] != null && prices[i.id] !== i.price)
      .map((i) => ({ itemId: i.id, oldPrice: i.price, price: prices[i.id] })),
    reason,
    invoiceNo,
    file,
    by,
    at: TODAY,
  };
}
// Harga disetujui: item PO memakai harga baru. Penerimaan yang sudah tercatat dikunci di harga
// lama oleh pemanggilnya (PoDetail) supaya jurnalnya tidak ikut berubah ke belakang.
export const applyPriceChange = (po) => ({
  ...po,
  items: po.items.map((i) => {
    const c = priceChangeOf(po, i.id);
    return c ? { ...i, price: c.price } : i;
  }),
});
export const reorderBlock = (po) => (po.items.some((i) => i.slot)
  ? 'Kontrak bertermin atau berkala dipesan ulang lewat permintaan baru.'
  : null);
// Harga satuan naik, atau total pesanan baru melebihi pesanan lama (qty ditambah): keduanya
// mengeluarkan uang lebih dari yang dulu disetujui, jadi alasannya wajib dan ditandai.
export const reorderPriceUp = (changes) => changes.some((c) => c.price > c.oldPrice);
export const reorderIncreased = (po, draft) =>
  reorderPriceUp(draft.reorder.changes) || poTotal(draft) > poTotal(po);
// Permintaan asal sebuah PO. PO pesan ulang menumpang permintaan PO lamanya; kalau dirinya
// tidak menyimpan fppbjId (data lama), rantai reorderOf ditelusuri sampai ketemu.
export function poOriginFppbj(po, posById, fppbjById) {
  const seen = new Set();
  for (let p = po; p && !seen.has(p.id); p = posById[p.reorderOf]) {
    seen.add(p.id);
    if (p.fppbjId && fppbjById[p.fppbjId]) return fppbjById[p.fppbjId];
  }
  return null;
}
// Pesanan yang lahir dari PO ini lewat pesan ulang (yang ditolak tidak dihitung).
export const reordersOf = (po, pos) => pos.filter((p) => p.reorderOf === po.id && p.closedAs !== 'ditolak');
// lines: { [itemId]: { qty, price } }. Item yang tidak ada di lines (tidak dicentang) atau
// qty-nya 0 tidak ikut dipesan. Vendor, termin, gudang, dan item lain tidak bisa diubah.
export function buildReorder(po, lines, pos, { reason = '', by } = {}) {
  // Jejak pengiriman, penutupan, dan approval milik PO lama tidak ikut terbawa.
  const DROP = ['id', 'number', 'date', 'sent', 'sentAt', 'sentBy', 'sentCc', 'sentNote', 'resentAt', 'resentBy',
    'closedAs', 'closeNote', 'closedBy', 'dpWaiver', 'reorder', 'reorderOf', 'note', 'expectedAt'];
  const keep = Object.fromEntries(Object.entries(po).filter(([k]) => !DROP.includes(k)));
  const lead = Math.max(0, Math.round((Date.parse(po.expectedAt) - Date.parse(po.date)) / 864e5)) || 0;
  const picked = po.items.filter((it) => (lines[it.id]?.qty ?? 0) > 0);
  const changes = picked.map((it) => ({
    itemId: it.id, desc: it.desc, unit: it.unit,
    oldQty: it.qty, qty: lines[it.id].qty, oldPrice: it.price, price: lines[it.id].price,
  }));
  const draft = {
    ...keep,
    id: uid('po'),
    number: nextNumber(poAllJasa(po) ? 'SPK' : 'PO', pos),
    date: TODAY,
    sent: false,
    expectedAt: new Date(Date.parse(TODAY) + lead * 864e5).toISOString().slice(0, 10),
    items: picked.map((it) => ({ ...it, qty: lines[it.id].qty, price: lines[it.id].price })),
    note: '',
    reorderOf: po.id,
    reorder: { status: 'diajukan', fromId: po.id, changes, reason, by, at: TODAY },
  };
  draft.reorder.increased = reorderIncreased(po, draft);
  return draft;
}

// PO batal di balik sebuah Payment Request (langsung untuk DP, atau lewat fakturnya).
// Pembatalan PO sudah dicegah selama ada PR berjalan (poStopBlock); ini menjaga data lama
// supaya PR atas pesanan yang batal tidak bisa disetujui atau dibayar.
export const prCancelledPo = (pr, { pos, invoices }) => {
  const ids = new Set([pr.poId, ...invoices.filter((i) => (pr.invoiceIds ?? []).includes(i.id)).map((i) => i.poId)]);
  return pos.find((p) => ids.has(p.id) && p.closedAs === 'dibatalkan') ?? null;
};
// PO turunan permintaan yang masih dihitung: yang dibatalkan tidak, karena barangnya
// memang tidak jadi dipesan dan permintaannya harus bisa dipesan ulang.
export const activePosOf = (f, pos) => pos.filter((p) => p.fppbjId === f.id && !['dibatalkan', 'ditolak'].includes(p.closedAs));

// Status permintaan untuk tampilan (daftar dan detail sama): Selesai bila semua pesanannya
// selesai/ditutup; permintaan yang sudah selesai tapi dipesan ulang kembali Dalam pengadaan
// selama PO barunya berjalan.
export function fppbjStatus(f, ctx) {
  const aktif = activePosOf(f, ctx.pos);
  if (aktif.length && aktif.every((p) => ['selesai', 'ditutup'].includes(poStatus(p, ctx)))) return 'selesai';
  return f.status === 'selesai' ? 'dalam_pengadaan' : f.status;
}

// Buat PO (draf) dari pengadaan yang disetujui: satu PO per vendor.
// Vendor yang PO-nya masih berjalan dilewati, jadi fungsi ini juga dipakai untuk memesan
// ulang setelah PO dibatalkan.
export const pendingPOs = (f, pb) => {
  const aktif = activePosOf(f, pb.pos);
  return buildPOs(f, pb.pos, pb.vendors).filter((b) => !aktif.some((p) => p.vendorId === b.vendorId));
};
export function createPOs(f, pb) {
  const built = pendingPOs(f, pb);
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
      shipping: b.shipping ?? 0,
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
