// Turunan data untuk menu "Buat baru" (dokumen siap dilanjutkan) dan halaman Ringkasan.
import { TODAY } from './data.js';
import { blockedBySoD, approvalState, canApprove, isApproverTurn, canCreate, canVerify, prBlockedBySoD, receiptDoc, receiptKind, receiptName } from './permissions.js';
import {
  canReturn,
  poAllBarang,
  receiptPending,
  poAllJasa,
  advancePct,
  dpInvoiceOf,
  isDpInvoice,
  dpBlocks,
  dpState,
  invTotals,
  poStatus,
  receiptsOf,
  remainingQty,
  poHasReceipt,
  pvPaid,
  uninvoicedLines,
  uninvoicedPoLines,
  poRetention,
  addDays,
  retentionDocName,
  rupiahShort,
  poPending,
  reorderBlock,
  priceChangePending,
  receiptConfirmed,
  liveInvoices,
  isRetentionRelease,
  returnGross,
  returnState,
  vendorCredit,
} from './utils.js';
import { accountOf, AKUN, invoiceJournal, receiptJournal, returnJournal } from './journal.js';

export function readiness(pb) {
  const c = pb.calc;
  // Penerimaan dan faktur uang muka tidak menunggu dokumen terkirim: barang bisa datang
  // lebih dulu, dan tagihan DP vendor sering terbit begitu pesanan disepakati, sebelum
  // PO/SPK-nya sempat dikirim resmi.
  // PO pesan ulang yang menunggu approval harga belum berlaku: belum bisa diterima atau ditagih.
  const livePos = pb.pos.filter((p) => !p.closedAs && !poPending(p));
  const r = {
    // Penawaran: permintaan terverifikasi / dalam pengadaan jalur bidding yang belum disetujui.
    quotes: pb.fppbj.filter(
      (f) =>
        (f.status === 'diverifikasi' || (f.status === 'dalam_pengadaan' && f.route === 'bidding')) &&
        f.procurement?.status !== 'disetujui',
    ),
    // PO: pengadaan sudah disetujui dan belum dibuat PO.
    po: pb.fppbj.filter(
      (f) => f.status !== 'dibatalkan' && f.procurement?.status === 'disetujui' && !pb.pos.some((p) => p.fppbjId === f.id),
    ),
    // Pesanan tanpa serah terima tidak pernah menghasilkan FPB/BAPP: fakturnya langsung dari PO/SPK.
    receipt: livePos.filter((p) => poHasReceipt(p) && p.items.some((i) => remainingQty(p, i.id, pb.receipts) > 0)),
    // Penerimaan yang uang muka pesanannya belum beres tidak dihitung siap difaktur:
    // faktur pelunasannya ditahan sampai DP lunas atau dibatalkan resmi.
    invoice: pb.receipts.filter((r) => uninvoicedLines(r, pb.invoices).length > 0 && !dpBlocks(dpState(pb.posById[r.poId], c))),
    // Pesanan tanpa FPB/BAPP (CBD, jasa per termin tanpa berita acara) ditagih langsung dari
    // PO/SPK-nya (mengirim ke vendor opsional); uang muka yang belum beres tetap menahannya.
    invoicePo: livePos.filter((p) => uninvoicedPoLines(p, pb.invoices).length > 0 && !dpBlocks(dpState(p, c))),
    // Pesanan beruang muka yang faktur uang mukanya belum dicatat (PR DP lama tanpa faktur
    // tetap dihitung sudah diajukan).
    prDp: livePos.filter(
      (p) => advancePct(p.term) > 0
        && !dpInvoiceOf(p.id, pb.invoices)
        && !pb.prs.some((x) => x.kind === 'dp' && x.poId === p.id && x.status !== 'ditolak'),
    ),
    prPay: pb.invoices.filter((i) => invTotals(i, c).free > 0),
    returns: pb.invoices.filter((i) => {
      return canReturn(i, pb.posById[i.poId], pb.returns);
    }),
  };
  // Payment Request gabungan DP/CBD + pelunasan.
  r.pr = [...r.prDp, ...r.prPay];
  // Pesan ulang: PO/SPK yang sudah Selesai, terbaru di atas. `reorderAll` ikut memuat kontrak
  // bertermin supaya tetap terlihat di daftar (nonaktif, dengan alasannya); angka di menu
  // hanya menghitung yang memang bisa dipesan ulang.
  r.reorderAll = pb.pos
    .filter((p) => poStatus(p, c) === 'selesai')
    .sort((a, b) => b.date.localeCompare(a.date));
  r.reorder = r.reorderAll.filter((p) => !reorderBlock(p));
  // Retensi yang masih ditahan setelah semua termin difaktur, urut dari yang paling dulu
  // selesai masa pemeliharaannya. `due`: yang sudah boleh dilepas hari ini.
  r.retention = pb.pos
    .map((p) => ({ po: p, rt: poRetention(p, pb.invoices) }))
    .filter(({ rt }) => rt && rt.balance > 0 && rt.billedAll && rt.maintenanceEnd)
    .sort((a, b) => a.rt.maintenanceEnd.localeCompare(b.rt.maintenanceEnd));
  r.retentionDue = r.retention.filter(({ rt }) => rt.maintenanceEnd <= TODAY);
  return r;
}

export const daysLate = (dueIso) => Math.floor((Date.parse(TODAY) - Date.parse(dueIso)) / 864e5);

// --- Batas wajar tiap langkah (hari) --------------------------------------------------------------
// Berapa lama sebuah tugas boleh menggantung sebelum dianggap terlambat dan ditandai di dashboard
// peran yang harus mengerjakannya. Angkanya ada di satu tempat supaya gampang disetel.
export const SLA = {
  verify: 14, // permintaan diajukan -> diverifikasi
  route: 7, // diverifikasi -> jalur pengadaan dipilih
  quotes: 14, // jalur dipilih -> penawaran lengkap dan pengadaan diajukan
  approve: 7, // pengadaan diajukan -> disetujui approver
  po: 3, // pengadaan disetujui -> PO/SPK dibuat
  receipt: 14, // PO/SPK dikirim -> barang/jasa diterima (dipakai kalau PO tidak punya perkiraan tiba)
  bapp: 5, // BAPP dicatat -> disetujui Building Manager
  invoice: 7, // penerimaan dikonfirmasi -> faktur dicatat
  prDp: 5, // PO dengan uang muka -> PR diajukan
  dpReceived: 1, // barang/jasa SUDAH diterima tapi uang mukanya belum beres -> faktur pelunasan tertahan
  prApprove: 5, // PR diajukan -> disetujui
  pv: 2, // PR disetujui -> Payment Voucher terbit
  pay: 3, // PV terbit -> uang ditransfer
  returned: 7, // permintaan dikembalikan -> diperbaiki peminta
  draft: 14, // draf permintaan tidak diajukan-ajukan
};

// Umur satu tugas. Tugas boleh menyebut batasnya lewat `since` + `limit` (dihitung dari kejadian)
// atau lewat `due` (tanggal janji yang sudah ada, mis. perkiraan tiba atau jatuh tempo faktur).
// Dokumen lama belum punya stempel waktu, jadi tanggal dokumen dipakai sebagai perkiraan.
//
// `level` dipakai untuk warna baris di dashboard:
//   ok    masih dalam batas wajar
//   warn  oranye: sudah lewat batas wajar
//   stale merah: berlarut, lewat batas lagi sepanjang batasnya sendiri (min. 3 hari, atau
//         7 hari untuk tugas yang acuannya tanggal janji seperti jatuh tempo)
export function taskAge(a) {
  const anchor = a.since ?? null;
  const due = a.due ?? (anchor && a.limit != null ? isoPlus(anchor, a.limit) : null);
  if (!due) return { waiting: anchor ? daysLate(anchor) : null, late: 0, due: null, level: 'ok' };
  const late = daysLate(due);
  const stretch = a.due ? 7 : Math.max(a.limit ?? 7, 3);
  const level = late <= 0 ? 'ok' : late > stretch ? 'stale' : 'warn';
  return { waiting: anchor ? daysLate(anchor) : null, late, due, level };
}
const isoPlus = (iso, days) => new Date(Date.parse(iso) + days * 864e5).toISOString().slice(0, 10);

export function aging(pb) {
  const buckets = [
    { key: 'cur', label: 'Belum jatuh tempo', value: 0, color: 'green.6' },
    { key: '30', label: '1–30 hari', value: 0, color: 'yellow.6' },
    { key: '60', label: '31–60 hari', value: 0, color: 'orange.6' },
    { key: '90', label: '61–90 hari', value: 0, color: 'red.5' },
    { key: '91', label: 'Lebih dari 90 hari', value: 0, color: 'red.8' },
  ];
  for (const i of pb.invoices) {
    const bal = invTotals(i, pb.calc).balance;
    if (bal <= 0) continue;
    const d = daysLate(i.dueDate);
    const idx = d <= 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : d <= 90 ? 3 : 4;
    buckets[idx].value += bal;
  }
  return buckets;
}

// Daftar "Perlu tindakan" untuk satu peran. Urutan: keputusan, pembayaran, verifikasi, tindak lanjut.
export function actionsFor(role, pb) {
  const r = readiness(pb);
  const out = [];
  const add = (a) => out.push(a);
  // Uang muka yang menahan faktur pelunasan karena barang/jasanya SUDAH diterima: tugas
  // pembuka blokirnya dinaikkan prioritasnya di dashboard orang yang bisa membukanya,
  // supaya fakturnya tidak tertahan diam-diam berhari-hari.
  const dpHot = (poId) => {
    const po = pb.posById[poId];
    if (!dpBlocks(dpState(po, pb.calc))) return null;
    const terima = pb.receipts.filter((x) => x.poId === poId).map((x) => x.date).sort();
    return terima[0] ?? null;
  };
  const prPo = (p) => p.poId ?? pb.invoicesById[(p.invoiceIds ?? [])[0]]?.poId;
  const hotTask = (base, poId) => {
    const since = dpHot(poId);
    return since ? { ...base, since, limit: SLA.dpReceived, due: undefined } : base;
  };
  // Pembatalan uang muka menunggu Chief Finance.
  if (canApprove(role, 'dpWaiver')) {
    pb.pos
      .filter((p) => p.dpWaiver?.status === 'diajukan')
      .forEach((p) => add(hotTask({ id: `dw-${p.id}`, title: 'Approval pembatalan uang muka', sub: `${p.number}`, cta: 'Tinjau', to: { name: 'po', id: p.id }, since: p.dpWaiver.at, limit: SLA.approve }, p.id)));
  }
  // Approver pengadaan (spesifikasi 2.2).
  if (canApprove(role, 'procurement')) {
    pb.fppbj
      // Hanya muncul bagi peran yang sedang giliran, supaya satu dokumen tidak nongol di
      // dua dashboard sekaligus padahal urutannya memang berjenjang.
      .filter((f) => f.procurement?.status === 'diajukan' && isApproverTurn(role, f.procurement, 'procurement') && !blockedBySoD(role, f))
      .forEach((f) =>
        add({
          id: `ap-${f.id}`,
          title: `Approval ${f.single?.on ? 'vendor tunggal' : 'bidding'} (${approvalState(f.procurement, 'procurement').done.length + 1}/${approvalState(f.procurement, 'procurement').total})`,
          sub: f.number,
          cta: 'Tinjau',
          to: { name: 'fppbj', id: f.id },
          since: f.procurement?.submittedAt ?? f.routedAt ?? f.date,
          limit: SLA.approve,
        }),
      );
  }
  // Approval Payment Request berjenjang sama: Chief Finance lalu Building Manager.
  if (canApprove(role, 'pr')) {
    pb.prs
      .filter((p) => p.status === 'diajukan' && isApproverTurn(role, p, 'pr') && !prBlockedBySoD(role, p))
      .forEach((p) =>
        add(hotTask({ id: `ar-${p.id}`, title: `Approval Payment Request ${p.kind === 'dp' ? 'DP' : 'pelunasan'} (${approvalState(p, 'pr').done.length + 1}/${approvalState(p, 'pr').total})`, sub: p.number, cta: 'Tinjau', to: { name: 'pr', id: p.id }, since: p.submittedAt ?? p.date, limit: SLA.prApprove }, p.kind === 'dp' ? prPo(p) : null)),
      );
  }
  if (canCreate(role, 'pv')) {
    // Dua tahap sesudah approval: terbitkan PV, lalu catat pembayarannya.
    // Jurnal kas keluar ikut terposting saat pembayaran dicatat, jadi tidak jadi tugas sendiri.
    pb.prs
      .filter((p) => p.status === 'disetujui')
      .forEach((p) =>
        add(hotTask({ id: `fp-${p.id}`, title: 'Terbitkan Payment Voucher', sub: `${p.number}`, cta: 'Terbitkan', to: { name: 'pr', id: p.id }, since: p.approvedAt ?? p.date, limit: SLA.pv, due: p.dueDate }, p.kind === 'dp' ? prPo(p) : null)),
      );
    pb.vouchers
      .filter((v) => !pvPaid(v))
      .forEach((v) =>
        add(hotTask({ id: `pv-${v.id}`, title: 'Catat pembayaran', sub: `${v.number}`, cta: 'Bayar', to: { name: 'voucher', id: v.id }, since: v.date, limit: SLA.pay }, (() => { const p = pb.prsById[(v.prIds ?? [])[0]]; return p?.kind === 'dp' ? prPo(p) : null; })())),
      );
  }
  // Verifikasi permintaan: hanya memeriksa kelayakan, belum menyentuh jalur pengadaan.
  if (canVerify(role)) {
    pb.fppbj.filter((f) => f.status === 'diajukan').forEach((f) => add({ id: `v-${f.id}`, title: 'Verifikasi permintaan', sub: f.number, cta: 'Verifikasi', to: { name: 'fppbj', id: f.id }, since: f.submittedAt ?? f.date, limit: SLA.verify }));
  }
  // Langkah berikutnya, dan ini pekerjaan pengadaan: tentukan jalurnya.
  if (canCreate(role, 'procurement')) {
    pb.fppbj.filter((f) => f.status === 'diverifikasi').forEach((f) => add({ id: `j-${f.id}`, title: 'Pilih jalur pengadaan', sub: f.number, cta: 'Pilih jalur', to: { name: 'fppbj', id: f.id }, since: f.verifiedAt ?? f.submittedAt ?? f.date, limit: SLA.route }));
  }
  if (canCreate(role, 'po')) {
    pb.fppbj
      .filter((f) => f.status === 'dalam_pengadaan' && ['draf', 'ditolak', undefined].includes(f.procurement?.status))
      .forEach((f) => add({ id: `p-${f.id}`, title: f.procurement?.status === 'ditolak' ? 'Revisi pengadaan (ditolak)' : 'Lengkapi pengadaan', sub: f.number, cta: 'Buka', to: { name: 'fppbj', id: f.id }, since: f.routedAt ?? f.verifiedAt ?? f.date, limit: SLA.quotes }));
    r.po.forEach((f) => add({ id: `g-${f.id}`, title: 'Buat PO', sub: f.number, cta: 'Buat', to: { name: 'fppbj', id: f.id }, since: f.procurement?.submittedAt ?? f.routedAt ?? f.date, limit: SLA.po }));
    r.prDp
      .filter((p) => p.dpWaiver?.status !== 'diajukan' && p.dpWaiver?.status !== 'disetujui')
      .forEach((p) => add(hotTask({ id: `d-${p.id}`, title: 'Catat faktur uang muka', sub: `${p.number}`, cta: 'Buka', to: { name: 'po', id: p.id }, since: p.sentAt ?? p.date, limit: SLA.prDp }, p.id)));
    r.invoice.forEach((x) => add({ id: `f-${x.id}`, title: 'Catat faktur dari penerimaan', sub: `${x.number}`, cta: 'Buka', to: { name: 'po', id: x.poId }, since: x.date, limit: SLA.invoice }));
    r.invoicePo.forEach((p) => add({ id: `fo-${p.id}`, title: 'Catat faktur pelunasan', sub: `${p.number}`, cta: 'Buka', to: { name: 'po', id: p.id }, since: p.sentAt ?? p.date, limit: SLA.invoice }));
    r.prPay
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .forEach((i) => add(hotTask({ id: `b-${i.id}`, title: isDpInvoice(i) ? 'Ajukan pembayaran uang muka' : 'Ajukan pembayaran faktur', sub: i.number, cta: 'Buka', to: { name: isDpInvoice(i) ? 'invoice' : 'po', id: isDpInvoice(i) ? i.id : i.poId }, due: i.dueDate }, isDpInvoice(i) ? i.poId : null)));
    // Retensi dua tahap. H-30: minta dokumen serah terima akhir ke vendor/PIC supaya sudah
    // di tangan saat jatuh waktu. Hari H dan sesudahnya: lepas retensinya — tombol tugas ini
    // langsung membuka modal pelepasan, tidak perlu mencari PO-nya.
    r.retention
      .filter(({ rt }) => rt.maintenanceEnd > TODAY && addDays(rt.maintenanceEnd, -30) <= TODAY)
      .forEach(({ po: p, rt }) => add({ id: `rb-${p.id}`, title: `Minta ${retentionDocName(p)}`, sub: p.number, cta: 'Buka', to: { name: 'po', id: p.id }, due: rt.maintenanceEnd }));
    r.retentionDue.forEach(({ po: p, rt }) => add({ id: `rl-${p.id}`, title: `Lepas retensi ${rupiahShort(rt.balance)}`, sub: p.number, cta: 'Lepas', to: { name: 'po', id: p.id }, dialog: { type: 'retention-release', poId: p.id }, since: rt.maintenanceEnd, limit: SLA.invoice }));
  }
  // FPB untuk barang ke Gudang, BAPP untuk jasa ke PIC jasa.
  r.receipt
    .filter((p) => canCreate(role, receiptDoc(poAllJasa(p))))
    .forEach((p) => add({ id: `r-${p.id}`, title: poAllJasa(p) ? 'Catat BAPP' : poAllBarang(p) ? 'Catat penerimaan barang' : 'Catat penerimaan (FPB/BAPP)', sub: `${p.number}`, cta: 'Catat', to: { name: 'po', id: p.id }, since: p.sentAt ?? p.date, due: p.expectedAt || undefined, limit: SLA.receipt }));
  // FPB dan BAPP yang menunggu approval berjenjang.
  if (canApprove(role, 'bapp') || canApprove(role, 'fpb')) {
    pb.receipts
      .filter((x) => receiptPending(x) && canApprove(role, receiptKind(x)) && isApproverTurn(role, x, receiptKind(x)))
      .forEach((x) => add({ id: `ba-${x.id}`, title: `Setujui ${receiptName(x)} (${approvalState(x, receiptKind(x)).done.length + 1}/${approvalState(x, receiptKind(x)).total})`, sub: `${x.number}`, cta: 'Tinjau', to: { name: 'receipt', id: x.id }, since: x.date, limit: SLA.bapp }));
  }
  // Pesan ulang dengan harga naik menunggu approval berjenjang sebelum PO-nya berlaku.
  if (canApprove(role, 'reorder')) {
    pb.pos
      .filter((p) => poPending(p) && isApproverTurn(role, p.reorder, 'reorder'))
      .forEach((p) => add({ id: `ro-${p.id}`, title: `${p.reorder.increased === false ? 'Setujui pesan ulang' : 'Setujui pesan ulang, harga naik'} (${approvalState(p.reorder, 'reorder').done.length + 1}/${approvalState(p.reorder, 'reorder').total})`, sub: p.number, cta: 'Tinjau', to: { name: 'po', id: p.id }, since: p.date, limit: SLA.bapp }));
  }
  // Ubah harga PO dari invoice vendor yang beda harga: fakturnya ditahan sampai diputuskan.
  if (canApprove(role, 'priceChange')) {
    pb.pos
      .filter((p) => priceChangePending(p) && isApproverTurn(role, p.priceChange, 'priceChange'))
      .forEach((p) => add({ id: `pc-${p.id}`, title: `Setujui ubah harga (${approvalState(p.priceChange, 'priceChange').done.length + 1}/${approvalState(p.priceChange, 'priceChange').total})`, sub: p.number, cta: 'Tinjau', to: { name: 'po', id: p.id }, since: p.priceChange.at, limit: SLA.bapp }));
  }
  // FPB/BAPP yang ditolak kembali ke pencatatnya untuk diajukan ulang atau dibatalkan.
  pb.receipts
    .filter((x) => x.status === 'ditolak' && canCreate(role, receiptDoc(receiptKind(x) === 'bapp')))
    .forEach((x) => add({ id: `rt-${x.id}`, title: `${receiptName(x)} ditolak`, sub: x.number, cta: 'Buka', to: { name: 'receipt', id: x.id }, since: x.rejectedAt?.slice(0, 10) ?? x.date, limit: SLA.returned }));
  if (canCreate(role, 'fppbj')) {
    pb.fppbj.filter((f) => f.status === 'dikembalikan').forEach((f) => add({ id: `k-${f.id}`, title: 'Permintaan dikembalikan', sub: f.number, cta: 'Buka', to: { name: 'fppbj', id: f.id }, since: f.returnedAt ?? f.date, limit: SLA.returned }));
    pb.fppbj.filter((f) => f.status === 'draft').forEach((f) => add({ id: `dr-${f.id}`, title: 'Draf permintaan belum diajukan', sub: f.number, cta: 'Buka', to: { name: 'fppbj', id: f.id }, since: f.date, limit: SLA.draft }));
  }
  // Merah (berlarut) paling atas, lalu oranye, lalu yang paling lama menggantung. Tugas tanpa
  // batas waktu (belum punya acuan tanggal) ditaruh paling bawah tanpa mengubah urutan aslinya.
  const rank = { stale: 2, warn: 1, ok: 0 };
  return out
    .map((a, i) => ({ ...a, ...taskAge(a), seq: i }))
    .sort((x, y) => rank[y.level] - rank[x.level] || (y.late ?? -Infinity) - (x.late ?? -Infinity) || x.seq - y.seq);
}

// Pipeline: jumlah dokumen yang masih berjalan per tahap.
// Alur dokumen yang masih berjalan. Tiap tahap menghitung satu keadaan saja, jadi satu dokumen
// tidak terhitung di dua kotak: permintaan tanpa PO → PO yang masih menunggu barang/jasa →
// FPB/BAPP (atau PO tanpa serah terima) yang belum difaktur → faktur yang belum diajukan bayar →
// Payment Request yang sedang diproses. Draf belum masuk alur.
export function pipeline(pb) {
  const r = readiness(pb);
  const unbilled = pb.receipts.filter((x) => receiptConfirmed(x) && uninvoicedLines(x, pb.invoices).length > 0);
  return [
    { key: 'fppbj', label: 'Permintaan', hint: 'belum jadi PO', tab: 'fppbj', count: pb.fppbj.filter((f) => ['diajukan', 'diverifikasi', 'dalam_pengadaan', 'dikembalikan'].includes(f.status) && !pb.pos.some((p) => p.fppbjId === f.id)).length },
    { key: 'po', label: 'Menunggu barang/jasa', hint: 'PO/SPK belum diterima penuh', tab: 'orders', count: r.receipt.length },
    { key: 'receipt', label: 'Menunggu faktur', hint: 'FPB/BAPP & PO belum ditagih', tab: 'receipts', count: unbilled.length + r.invoicePo.filter((p) => !poHasReceipt(p)).length },
    { key: 'invoice', label: 'Faktur belum diajukan', hint: 'belum masuk Payment Request', tab: 'bills', count: r.prPay.length },
    { key: 'pay', label: 'Pembayaran diproses', hint: 'Payment Request berjalan', tab: 'payments', count: pb.prs.filter((p) => ['diajukan', 'disetujui', 'diproses'].includes(p.status)).length },
  ];
}

// Saldo satu akun dari jurnal dokumen Pembelian (debit − kredit), dihitung dengan fungsi jurnal
// yang sama dengan buku besar supaya angkanya tidak bisa berbeda. Faktur batal tidak ikut:
// jurnal aslinya dan jurnal pembaliknya saling menghapus.
function pbBalance(pb, ctx, account, { receipts = false, returns = false } = {}) {
  const lines = [
    ...(receipts ? pb.receipts.filter(receiptConfirmed).flatMap((x) => receiptJournal(x, pb, ctx)) : []),
    ...liveInvoices(pb.invoices).flatMap((i) => invoiceJournal(i, pb, ctx)),
    ...(returns ? pb.returns.flatMap((x) => returnJournal(x, pb, ctx)) : []),
  ];
  const code = accountOf(account).code;
  return lines.filter((l) => l.code === code).reduce((n, l) => n + l.debit - l.credit, 0);
}

// Barang/jasa sudah diterima tapi fakturnya belum dicatat (akun Belum Ditagih).
export function unbilled(pb, ctx) {
  const docs = pb.receipts.filter((x) => receiptConfirmed(x) && uninvoicedLines(x, pb.invoices).length > 0);
  return { value: -pbBalance(pb, ctx, AKUN.belumDitagih, { receipts: true }), count: docs.length };
}

// Uang muka yang sudah ditagih vendor tapi belum dipotong ke faktur pelunasan, dan kredit retur
// yang belum terpakai. Keduanya hak kita atas vendor (akun Uang Muka Pembelian).
export function vendorClaims(pb, ctx) {
  const vendors = [...new Set(pb.invoices.map((i) => i.vendorId))];
  const kredit = vendors.reduce((n, v) => n + vendorCredit(v, pb.calc), 0);
  const dp = pbBalance(pb, ctx, AKUN.uangMuka);
  const open = pb.returns.map((x) => ({ ret: x, state: returnState(x, pb.calc) })).filter((x) => x.state !== 'selesai');
  return {
    dp: Math.max(dp, 0),
    kredit,
    refund: open.filter((x) => x.state === 'menunggu_refund').reduce((n, x) => n + returnGross(x.ret, pb.invoices), 0),
    openReturns: open,
  };
}

// Hutang usaha per vendor, terbesar di atas.
export function debtByVendor(pb) {
  const map = {};
  for (const i of pb.invoices) {
    const bal = invTotals(i, pb.calc).balance;
    if (bal <= 0) continue;
    map[i.vendorId] = map[i.vendorId] ?? { id: i.vendorId, name: pb.vendorsById[i.vendorId]?.name ?? 'Vendor', value: 0, count: 0 };
    map[i.vendorId].value += bal;
    map[i.vendorId].count += 1;
  }
  return Object.values(map).sort((a, b) => b.value - a.value);
}

// Nilai pembelian (DPP faktur, tanpa faktur uang muka dan pelepasan retensi) per bulan "YYYY-MM",
// opsional hanya sampai tanggal ke-`untilDay` supaya awal bulan bisa dibanding periode yang sama.
export function purchasesInMonth(pb, ym, untilDay = 31) {
  return liveInvoices(pb.invoices)
    .filter((i) => !isDpInvoice(i) && !isRetentionRelease(i) && i.date?.startsWith(ym) && Number(i.date.slice(8, 10)) <= untilDay)
    .reduce((n, i) => n + invTotals(i, pb.calc).dpp, 0);
}

// Faktur yang jatuh tempo dalam n hari ke depan (belum lewat), untuk rencana kas.
export function dueSoon(pb, n = 7) {
  const until = addDays(TODAY, n);
  return pb.invoices
    .map((i) => ({ i, bal: invTotals(i, pb.calc).balance }))
    .filter((x) => x.bal > 0 && x.i.dueDate >= TODAY && x.i.dueDate <= until)
    .sort((a, b) => a.i.dueDate.localeCompare(b.i.dueDate));
}

// Permintaan yang masih berjalan menurut jalurnya. Vendor tunggal disimpan sebagai route
// 'bidding' + single.on, jadi bidding murni = route bidding tanpa single.on.
export function procurementMix(pb) {
  const aktif = pb.fppbj.filter((f) => ['diajukan', 'diverifikasi', 'dalam_pengadaan', 'dikembalikan'].includes(f.status) && !pb.pos.some((p) => p.fppbjId === f.id));
  return {
    aktif: aktif.length,
    bidding: aktif.filter((f) => f.route === 'bidding' && !f.single?.on).length,
    single: aktif.filter((f) => f.single?.on).length,
    belumJalur: aktif.filter((f) => !f.route && !f.single?.on).length,
    late: aktif.filter((f) => f.neededBy && f.neededBy < TODAY).sort((a, b) => a.neededBy.localeCompare(b.neededBy)),
  };
}

export { receiptsOf };

// Menu sidebar tempat tiap tugas "Perlu tindakan" dikerjakan. Dipetakan dari awalan id
// tugas di actionsFor, supaya badge angka di sidebar menunjuk ke daftar yang benar.
const ACTION_MENU = {
  v: 'fppbj', j: 'fppbj', p: 'fppbj', g: 'fppbj', ap: 'fppbj', k: 'fppbj', dr: 'fppbj',
  s: 'orders', d: 'orders', dw: 'orders', rl: 'orders', rb: 'orders',
  r: 'receipts', ba: 'receipts', rt: 'receipts',
  f: 'bills', fo: 'bills', b: 'bills',
  ar: 'payments', fp: 'payments', pv: 'payments',
};
// Jumlah tugas peran ini per menu Pembelian: { fppbj: 2, receipts: 1, ... }.
export function actionCountsByMenu(role, pb) {
  const out = {};
  for (const a of actionsFor(role, pb)) {
    const m = ACTION_MENU[a.id.split('-')[0]];
    if (m) out[m] = (out[m] ?? 0) + 1;
  }
  return out;
}
