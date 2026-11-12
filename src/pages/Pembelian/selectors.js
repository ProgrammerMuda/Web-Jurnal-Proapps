// Turunan data untuk menu "Buat baru" (dokumen siap dilanjutkan) dan halaman Ringkasan.
import { TODAY } from './data.js';
import { blockedBySoD, canApprove, canCreate, prBlockedBySoD, receiptDoc } from './permissions.js';
import {
  canReturn,
  poAllBarang,
  receiptConfirmed,
  poAllJasa,
  invTotals,
  poStatus,
  receiptsOf,
  remainingQty,
  uninvoicedLines,
} from './utils.js';

export function readiness(pb) {
  const c = pb.calc;
  // PO yang dibatalkan atau ditutup tidak lagi menunggu penerimaan maupun DP.
  const sentPos = pb.pos.filter((p) => p.sent && !p.closedAs);
  const r = {
    // Penawaran: permintaan terverifikasi / dalam pengadaan jalur bidding yang belum disetujui.
    quotes: pb.fpbj.filter(
      (f) =>
        (f.status === 'diverifikasi' || (f.status === 'dalam_pengadaan' && f.route === 'bidding')) &&
        f.procurement?.status !== 'disetujui',
    ),
    // PO: pengadaan sudah disetujui dan belum dibuat PO.
    po: pb.fpbj.filter(
      (f) => f.status !== 'dibatalkan' && f.procurement?.status === 'disetujui' && !pb.pos.some((p) => p.fpbjId === f.id),
    ),
    receipt: sentPos.filter((p) => p.items.some((i) => remainingQty(p, i.id, pb.receipts) > 0)),
    invoice: pb.receipts.filter((r) => uninvoicedLines(r, pb.invoices).length > 0),
    prDp: sentPos.filter(
      (p) => p.term?.type !== 'cad' && !pb.prs.some((x) => x.kind === 'dp' && x.poId === p.id && x.status !== 'ditolak'),
    ),
    prPay: pb.invoices.filter((i) => invTotals(i, c).free > 0),
    returns: pb.invoices.filter((i) => {
      return canReturn(i, pb.posById[i.poId], pb.returns);
    }),
    repeat: pb.pos.filter((p) => poStatus(p, c) === 'selesai'),
  };
  // Payment Request gabungan DP/CBD + pelunasan.
  r.pr = [...r.prDp, ...r.prPay];
  return r;
}

export const daysLate = (dueIso) => Math.floor((Date.parse(TODAY) - Date.parse(dueIso)) / 864e5);

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
  // Approver pengadaan: hanya bidding / pesan ulang (spesifikasi 2.2).
  if (canApprove(role, 'procurement')) {
    pb.fpbj
      .filter((f) => f.procurement?.status === 'diajukan' && !blockedBySoD(role, f))
      .forEach((f) =>
        add({
          id: `ap-${f.id}`,
          title: `Approval ${f.route === 'bidding' ? 'bidding' : 'pesan ulang'}`,
          sub: `${f.number} · ${f.purpose}`,
          cta: 'Tinjau',
          to: { name: 'fpbj', id: f.id },
        }),
      );
  }
  // Approval Payment Request ada di Finance Manager, bukan approver pengadaan.
  if (canApprove(role, 'pr')) {
    pb.prs
      .filter((p) => p.status === 'diajukan' && !prBlockedBySoD(role, p))
      .forEach((p) =>
        add({ id: `ar-${p.id}`, title: `Approval Payment Request ${p.kind === 'dp' ? 'DP' : 'pelunasan'}`, sub: p.number, cta: 'Tinjau', to: { name: 'tab', tab: 'payments' } }),
      );
  }
  if (canCreate(role, 'pv')) {
    pb.prs
      .filter((p) => p.status === 'disetujui')
      .forEach((p) =>
        add({ id: `fp-${p.id}`, title: 'Bayar Payment Request', sub: `${p.number} · ${pb.vendorsById[p.vendorId]?.name}`, cta: 'Bayar', to: { name: 'tab', tab: 'payments' } }),
      );
  }
  if (canCreate(role, 'po')) {
    pb.fpbj.filter((f) => f.status === 'diajukan').forEach((f) => add({ id: `v-${f.id}`, title: 'Verifikasi Permintaan & IOM', sub: `${f.number} · ${f.purpose}`, cta: 'Verifikasi', to: { name: 'fpbj', id: f.id } }));
    pb.fpbj.filter((f) => f.status === 'diverifikasi').forEach((f) => add({ id: `j-${f.id}`, title: 'Pilih jalur pengadaan', sub: `${f.number} · ${f.purpose}`, cta: 'Pilih jalur', to: { name: 'fpbj', id: f.id } }));
    pb.fpbj
      .filter((f) => f.status === 'dalam_pengadaan' && ['draf', 'ditolak', undefined].includes(f.procurement?.status))
      .forEach((f) => add({ id: `p-${f.id}`, title: f.procurement?.status === 'ditolak' ? 'Revisi pengadaan (ditolak)' : 'Lengkapi pengadaan', sub: `${f.number} · ${f.route === 'bidding' ? `${f.quotes.length}/3 penawaran` : 'pesan ulang'}`, cta: 'Buka', to: { name: 'fpbj', id: f.id } }));
    r.po.forEach((f) => add({ id: `g-${f.id}`, title: 'Buat PO', sub: `${f.number} · ${f.purpose}`, cta: 'Buat', to: { name: 'fpbj', id: f.id } }));
    pb.pos.filter((p) => !p.sent).forEach((p) => add({ id: `s-${p.id}`, title: 'Kirim ke vendor', sub: `${p.number} · ${pb.vendorsById[p.vendorId]?.name}`, cta: 'Buka', to: { name: 'po', id: p.id } }));
    r.prDp.forEach((p) => add({ id: `d-${p.id}`, title: 'Ajukan DP / CBD', sub: `${p.number} · ${pb.vendorsById[p.vendorId]?.name}`, cta: 'Buka', to: { name: 'po', id: p.id } }));
    r.invoice.forEach((x) => add({ id: `f-${x.id}`, title: 'Buat faktur dari penerimaan', sub: `${x.number} · ${pb.vendorsById[x.vendorId]?.name}`, cta: 'Buka', to: { name: 'po', id: x.poId } }));
    r.prPay
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .forEach((i) => add({ id: `b-${i.id}`, title: 'Ajukan pembayaran faktur', sub: `${i.number} · jatuh tempo ${i.dueDate}`, cta: 'Buka', to: { name: 'po', id: i.poId } }));
  }
  // FPB untuk barang ke Gudang, BAST untuk jasa ke PIC jasa.
  r.receipt
    .filter((p) => canCreate(role, receiptDoc(poAllJasa(p))))
    .forEach((p) => add({ id: `r-${p.id}`, title: poAllJasa(p) ? 'Catat BAST' : poAllBarang(p) ? 'Catat penerimaan barang' : 'Catat penerimaan (FPB/BAST)', sub: `${p.number} · ${pb.vendorsById[p.vendorId]?.name}`, cta: 'Catat', to: { name: 'po', id: p.id } }));
  // Atasan: BAST jasa yang menunggu persetujuannya.
  if (canApprove(role, 'bast')) {
    pb.receipts
      .filter((x) => !receiptConfirmed(x))
      .forEach((x) => add({ id: `ba-${x.id}`, title: 'Setujui BAST', sub: `${x.number} · ${pb.vendorsById[x.vendorId]?.name}`, cta: 'Tinjau', to: { name: 'receipt', id: x.id } }));
  }
  if (canCreate(role, 'fpbj')) {
    pb.fpbj.filter((f) => f.status === 'dikembalikan').forEach((f) => add({ id: `k-${f.id}`, title: 'Permintaan dikembalikan', sub: `${f.number} · ${f.returnNote}`, cta: 'Buka', to: { name: 'fpbj', id: f.id } }));
    pb.fpbj.filter((f) => f.status === 'draft').forEach((f) => add({ id: `dr-${f.id}`, title: 'Draf permintaan belum diajukan', sub: f.number, cta: 'Buka', to: { name: 'fpbj', id: f.id } }));
  }
  return out;
}

// Pipeline: jumlah dokumen yang masih berjalan per tahap.
export function pipeline(pb) {
  const r = readiness(pb);
  return [
    { key: 'fpbj', label: 'Permintaan Pembelian', tab: 'fpbj', count: pb.fpbj.filter((f) => ['diajukan', 'diverifikasi', 'dalam_pengadaan', 'draft', 'dikembalikan'].includes(f.status) && !pb.pos.some((p) => p.fpbjId === f.id)).length },
    { key: 'po', label: 'PO', tab: 'orders', count: pb.pos.filter((p) => poStatus(p, pb.calc) !== 'selesai').length },
    { key: 'receipt', label: 'Penerimaan', tab: 'receipts', count: r.receipt.length },
    { key: 'invoice', label: 'Faktur', tab: 'bills', count: pb.invoices.filter((i) => invTotals(i, pb.calc).balance > 0).length },
    { key: 'pay', label: 'Pembayaran', tab: 'payments', count: pb.prs.filter((p) => ['diajukan', 'disetujui'].includes(p.status)).length },
  ];
}

export { receiptsOf };
