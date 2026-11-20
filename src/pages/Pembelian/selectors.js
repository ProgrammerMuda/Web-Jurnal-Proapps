// Turunan data untuk menu "Buat baru" (dokumen siap dilanjutkan) dan halaman Ringkasan.
import { TODAY } from './data.js';
import { blockedBySoD, approvalState, canApprove, isApproverTurn, canCreate, canVerify, prBlockedBySoD, receiptDoc } from './permissions.js';
import {
  canReturn,
  poAllBarang,
  receiptConfirmed,
  poAllJasa,
  advancePct,
  formatDate,
  invTotals,
  minQuotesFor,
  poStatus,
  receiptsOf,
  remainingQty,
  poHasReceipt,
  pvPaid,
  uninvoicedLines,
} from './utils.js';

export function readiness(pb) {
  const c = pb.calc;
  // PO yang dibatalkan atau ditutup tidak lagi menunggu penerimaan maupun DP.
  const sentPos = pb.pos.filter((p) => p.sent && !p.closedAs);
  // Penerimaan tidak menunggu dokumen terkirim: barang bisa datang lebih dulu. Uang muka
  // tetap menunggu, karena menagih DP atas pesanan yang belum dikirim itu tidak berdasar.
  const livePos = pb.pos.filter((p) => !p.closedAs);
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
    invoice: pb.receipts.filter((r) => uninvoicedLines(r, pb.invoices).length > 0),
    prDp: sentPos.filter(
      (p) => advancePct(p.term) > 0 && !pb.prs.some((x) => x.kind === 'dp' && x.poId === p.id && x.status !== 'ditolak'),
    ),
    prPay: pb.invoices.filter((i) => invTotals(i, c).free > 0),
    returns: pb.invoices.filter((i) => {
      return canReturn(i, pb.posById[i.poId], pb.returns);
    }),
  };
  // Payment Request gabungan DP/CBD + pelunasan.
  r.pr = [...r.prDp, ...r.prPay];
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
  send: 3, // PO dibuat -> dikirim ke vendor
  bapp: 5, // BAPP dicatat -> disetujui Building Manager
  invoice: 7, // penerimaan dikonfirmasi -> faktur dicatat
  prDp: 5, // PO dengan uang muka -> PR diajukan
  prApprove: 5, // PR diajukan -> disetujui
  pv: 2, // PR disetujui -> Payment Voucher terbit
  pay: 3, // PV terbit -> uang ditransfer
  returned: 7, // permintaan dikembalikan -> diperbaiki peminta
  draft: 14, // draf permintaan tidak diajukan-ajukan
};

// Umur satu tugas. Tugas boleh menyebut batasnya lewat `since` + `limit` (dihitung dari kejadian)
// atau lewat `due` (tanggal janji yang sudah ada, mis. perkiraan tiba atau jatuh tempo faktur).
// Dokumen lama belum punya stempel waktu, jadi tanggal dokumen dipakai sebagai perkiraan.
export function taskAge(a) {
  const anchor = a.since ?? null;
  const due = a.due ?? (anchor && a.limit != null ? isoPlus(anchor, a.limit) : null);
  if (!due) return { waiting: null, late: 0, due: null };
  return { waiting: anchor ? daysLate(anchor) : null, late: daysLate(due), due };
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
          sub: `${f.number} · ${f.purpose}`,
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
        add({ id: `ar-${p.id}`, title: `Approval Payment Request ${p.kind === 'dp' ? 'DP' : 'pelunasan'} (${approvalState(p, 'pr').done.length + 1}/${approvalState(p, 'pr').total})`, sub: p.number, cta: 'Tinjau', to: { name: 'tab', tab: 'payments' }, since: p.submittedAt ?? p.date, limit: SLA.prApprove }),
      );
  }
  if (canCreate(role, 'pv')) {
    // Dua tahap sesudah approval: terbitkan PV, lalu catat pembayarannya.
    // Jurnal kas keluar ikut terposting saat pembayaran dicatat, jadi tidak jadi tugas sendiri.
    pb.prs
      .filter((p) => p.status === 'disetujui')
      .forEach((p) =>
        add({ id: `fp-${p.id}`, title: 'Terbitkan Payment Voucher', sub: `${p.number} · ${pb.vendorsById[p.vendorId]?.name}`, cta: 'Terbitkan', to: { name: 'tab', tab: 'payments' }, since: p.approvedAt ?? p.date, limit: SLA.pv, due: p.dueDate }),
      );
    pb.vouchers
      .filter((v) => !pvPaid(v))
      .forEach((v) =>
        add({ id: `pv-${v.id}`, title: 'Catat pembayaran', sub: `${v.number} · ${pb.vendorsById[v.vendorId]?.name}`, cta: 'Bayar', to: { name: 'voucher', id: v.id }, since: v.date, limit: SLA.pay }),
      );
  }
  // Verifikasi permintaan: hanya memeriksa kelayakan, belum menyentuh jalur pengadaan.
  if (canVerify(role)) {
    pb.fppbj.filter((f) => f.status === 'diajukan').forEach((f) => add({ id: `v-${f.id}`, title: 'Verifikasi permintaan', sub: `${f.number} · ${f.purpose}`, cta: 'Verifikasi', to: { name: 'fppbj', id: f.id }, since: f.submittedAt ?? f.date, limit: SLA.verify }));
  }
  // Langkah berikutnya, dan ini pekerjaan pengadaan: tentukan jalurnya.
  if (canCreate(role, 'procurement')) {
    pb.fppbj.filter((f) => f.status === 'diverifikasi').forEach((f) => add({ id: `j-${f.id}`, title: 'Pilih jalur pengadaan', sub: `${f.number} · ${f.purpose}`, cta: 'Pilih jalur', to: { name: 'fppbj', id: f.id }, since: f.verifiedAt ?? f.submittedAt ?? f.date, limit: SLA.route }));
  }
  if (canCreate(role, 'po')) {
    pb.fppbj
      .filter((f) => f.status === 'dalam_pengadaan' && ['draf', 'ditolak', undefined].includes(f.procurement?.status))
      .forEach((f) => add({ id: `p-${f.id}`, title: f.procurement?.status === 'ditolak' ? 'Revisi pengadaan (ditolak)' : 'Lengkapi pengadaan', sub: `${f.number} · ${f.single?.on ? `${f.quotes.length}/1 penawaran` : `${f.quotes.length}/${minQuotesFor(f)} penawaran`}`, cta: 'Buka', to: { name: 'fppbj', id: f.id }, since: f.routedAt ?? f.verifiedAt ?? f.date, limit: SLA.quotes }));
    r.po.forEach((f) => add({ id: `g-${f.id}`, title: 'Buat PO', sub: `${f.number} · ${f.purpose}`, cta: 'Buat', to: { name: 'fppbj', id: f.id }, since: f.procurement?.submittedAt ?? f.routedAt ?? f.date, limit: SLA.po }));
    pb.pos.filter((p) => !p.sent).forEach((p) => add({ id: `s-${p.id}`, title: 'Kirim ke vendor', sub: `${p.number} · ${pb.vendorsById[p.vendorId]?.name}`, cta: 'Buka', to: { name: 'po', id: p.id }, since: p.date, limit: SLA.send }));
    r.prDp.forEach((p) => add({ id: `d-${p.id}`, title: 'Ajukan DP / CBD', sub: `${p.number} · ${pb.vendorsById[p.vendorId]?.name}`, cta: 'Buka', to: { name: 'po', id: p.id }, since: p.sentAt ?? p.date, limit: SLA.prDp }));
    r.invoice.forEach((x) => add({ id: `f-${x.id}`, title: 'Catat faktur dari penerimaan', sub: `${x.number} · ${pb.vendorsById[x.vendorId]?.name}`, cta: 'Buka', to: { name: 'po', id: x.poId }, since: x.date, limit: SLA.invoice }));
    r.prPay
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .forEach((i) => add({ id: `b-${i.id}`, title: 'Ajukan pembayaran faktur', sub: `${i.number} · jatuh tempo ${formatDate(i.dueDate)}`, cta: 'Buka', to: { name: 'po', id: i.poId }, due: i.dueDate }));
  }
  // FPB untuk barang ke Gudang, BAPP untuk jasa ke PIC jasa.
  r.receipt
    .filter((p) => canCreate(role, receiptDoc(poAllJasa(p))))
    .forEach((p) => add({ id: `r-${p.id}`, title: poAllJasa(p) ? 'Catat BAPP' : poAllBarang(p) ? 'Catat penerimaan barang' : 'Catat penerimaan (FPB/BAPP)', sub: `${p.number} · ${pb.vendorsById[p.vendorId]?.name}`, cta: 'Catat', to: { name: 'po', id: p.id }, since: p.sentAt ?? p.date, due: p.expectedAt }));
  // BAPP jasa yang menunggu approval berjenjang.
  if (canApprove(role, 'bapp')) {
    pb.receipts
      .filter((x) => !receiptConfirmed(x) && isApproverTurn(role, x, 'bapp'))
      .forEach((x) => add({ id: `ba-${x.id}`, title: `Setujui BAPP (${approvalState(x, 'bapp').done.length + 1}/${approvalState(x, 'bapp').total})`, sub: `${x.number} · ${pb.vendorsById[x.vendorId]?.name}`, cta: 'Tinjau', to: { name: 'receipt', id: x.id }, since: x.date, limit: SLA.bapp }));
  }
  if (canCreate(role, 'fppbj')) {
    pb.fppbj.filter((f) => f.status === 'dikembalikan').forEach((f) => add({ id: `k-${f.id}`, title: 'Permintaan dikembalikan', sub: `${f.number} · ${f.returnNote}`, cta: 'Buka', to: { name: 'fppbj', id: f.id }, since: f.returnedAt ?? f.date, limit: SLA.returned }));
    pb.fppbj.filter((f) => f.status === 'draft').forEach((f) => add({ id: `dr-${f.id}`, title: 'Draf permintaan belum diajukan', sub: f.number, cta: 'Buka', to: { name: 'fppbj', id: f.id }, since: f.date, limit: SLA.draft }));
  }
  // Yang terlambat naik ke atas, lalu yang paling lama menggantung. Tugas tanpa batas waktu
  // (belum punya acuan tanggal) ditaruh paling bawah tanpa mengubah urutan aslinya.
  return out
    .map((a, i) => ({ ...a, ...taskAge(a), seq: i }))
    .sort((x, y) => (y.late > 0) - (x.late > 0) || (y.late ?? -Infinity) - (x.late ?? -Infinity) || x.seq - y.seq);
}

// Pipeline: jumlah dokumen yang masih berjalan per tahap.
export function pipeline(pb) {
  const r = readiness(pb);
  return [
    { key: 'fppbj', label: 'Permintaan Pembelian', tab: 'fppbj', count: pb.fppbj.filter((f) => ['diajukan', 'diverifikasi', 'dalam_pengadaan', 'draft', 'dikembalikan'].includes(f.status) && !pb.pos.some((p) => p.fppbjId === f.id)).length },
    { key: 'po', label: 'PO', tab: 'orders', count: pb.pos.filter((p) => poStatus(p, pb.calc) !== 'selesai').length },
    { key: 'receipt', label: 'Penerimaan', tab: 'receipts', count: r.receipt.length },
    { key: 'invoice', label: 'Faktur', tab: 'bills', count: pb.invoices.filter((i) => invTotals(i, pb.calc).balance > 0).length },
    { key: 'pay', label: 'Pembayaran', tab: 'payments', count: pb.prs.filter((p) => ['diajukan', 'disetujui', 'diproses'].includes(p.status)).length },
  ];
}

export { receiptsOf };
