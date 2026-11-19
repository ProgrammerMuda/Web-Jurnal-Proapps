// Susun FPB (barang) / BAPP (jasa) menjadi PDF satu halaman untuk diarsipkan dan
// ditandatangani. Bentuknya sengaja sejajar dengan poPdf.js supaya dokumen pembelian
// terlihat satu keluarga.
import { TODAY } from './data.js';
import { buildPdf, line, PAGE, rect, saveBlob, text, wrap } from '@/lib/pdf.js';
import { formatDate, rangeLabel } from './utils.js';

const M = 48; // margin kiri/kanan
const RIGHT = PAGE.w - M;
const COL = { no: M, desc: M + 24, ordered: 330, received: 410, rejected: RIGHT };

const C = {
  primary: '#053079',
  primaryTint: '#eef4ff',
  onPrimary: '#ffffff',
  onPrimarySoft: '#b0c8f4',
  danger: '#b42318',
};
const BAND = 92;

export function receiptPdfBlob(r, { vendor, po } = {}) {
  const isJasa = r.kind === 'jasa';
  const label = isJasa ? 'BAPP' : 'FPB';
  const judul = isJasa ? 'BERITA ACARA PEMERIKSAAN PEKERJAAN' : 'FORMULIR PENERIMAAN BARANG';
  const itemOf = (id) => po?.items.find((i) => i.id === id);
  const totalOrdered = r.lines.reduce((n, l) => n + (itemOf(l.itemId)?.qty ?? 0), 0);
  const totalReceived = r.lines.reduce((n, l) => n + l.qty, 0);
  const totalRejected = r.lines.reduce((n, l) => n + (l.rejected || 0), 0);
  let c = '';

  // --- kepala dokumen ---
  c += rect(0, PAGE.h - BAND, PAGE.w, BAND, C.primary);
  c += text(judul, M, PAGE.h - 46, { size: 15, bold: true, color: C.onPrimary });
  c += text('Jurnal Accounting', M, PAGE.h - 64, { size: 9, color: C.onPrimarySoft });
  c += text(r.number, RIGHT, PAGE.h - 45, { size: 14, bold: true, align: 'right', color: C.onPrimary });
  c += text(r.status === 'draf' ? 'Menunggu persetujuan' : 'Disetujui', RIGHT, PAGE.h - 64, {
    size: 9,
    align: 'right',
    color: C.onPrimarySoft,
  });

  let y = PAGE.h - BAND - 30;

  // --- identitas vendor (kiri) dan data dokumen (kanan) ---
  const mid = M + 250;
  c += text('Vendor', M, y, { size: 8, bold: true, color: C.primary });
  c += text(vendor?.name ?? '-', M, y - 16, { size: 11, bold: true });
  const vendorRows = [vendor?.npwp && `NPWP ${vendor.npwp}`, vendor?.pic && `PIC ${vendor.pic}`, vendor?.phone].filter(Boolean);
  vendorRows.forEach((row, i) => { c += text(row, M, y - 31 - i * 13, { size: 9, gray: 0.3 }); });

  const docRows = [
    [`Tanggal ${label}`, formatDate(r.date)],
    [isJasa ? 'No. BAPP vendor' : 'No. surat jalan', r.doNumber || '-'],
    ...(po ? [['Dari pesanan', po.number]] : []),
    ...(r.journalDate && r.journalDate !== r.date ? [['Tanggal jurnal', formatDate(r.journalDate)]] : []),
    ['Dicatat oleh', r.createdBy ?? '-'],
  ];
  docRows.forEach(([k, v], i) => {
    const ry = y - i * 14;
    c += text(k, mid, ry, { size: 9, gray: 0.45 });
    c += text(v, RIGHT, ry, { size: 9, bold: true, align: 'right' });
  });

  y -= Math.max(31 + vendorRows.length * 13, docRows.length * 14) + 18;
  c += line(M, RIGHT, y);
  y -= 24;

  // --- tabel baris ---
  c += rect(M - 8, y - 7, RIGHT - M + 16, 21, C.primaryTint);
  c += text('No', COL.no + 2, y, { size: 8, bold: true, color: C.primary });
  c += text(isJasa ? 'Pekerjaan' : 'Barang', COL.desc, y, { size: 8, bold: true, color: C.primary });
  c += text('Dipesan', COL.ordered, y, { size: 8, bold: true, color: C.primary, align: 'right' });
  c += text('Diterima', COL.received, y, { size: 8, bold: true, color: C.primary, align: 'right' });
  c += text('Ditolak', COL.rejected, y, { size: 8, bold: true, color: C.primary, align: 'right' });
  y -= 24;

  r.lines.forEach((l, i) => {
    const it = itemOf(l.itemId);
    const desc = it?.desc ?? l.itemId;
    const rows = wrap(desc, COL.ordered - COL.desc - 40, 9.5);
    c += text(String(i + 1), COL.no + 2, y, { size: 9.5 });
    rows.forEach((row, n) => { c += text(row, COL.desc, y - n * 12, { size: 9.5 }); });
    let h = rows.length * 12;
    // Termin berkala: rentang periodenya ikut dicetak supaya dokumen berdiri sendiri.
    const periode = it?.periodFrom ? rangeLabel({ from: it.periodFrom, to: it.periodTo }) : it?.spec;
    if (periode) {
      wrap(periode, COL.ordered - COL.desc - 40, 8.5).forEach((row, n) => {
        c += text(row, COL.desc, y - h - n * 11, { size: 8.5, gray: 0.45 });
      });
      h += wrap(periode, COL.ordered - COL.desc - 40, 8.5).length * 11;
    }
    const unit = it?.unit ?? '';
    c += text(`${it?.qty ?? '-'} ${unit}`.trim(), COL.ordered, y, { size: 9.5, align: 'right' });
    c += text(`${l.qty} ${unit}`.trim(), COL.received, y, { size: 9.5, bold: true, align: 'right' });
    c += text(String(l.rejected || 0), COL.rejected, y, { size: 9.5, align: 'right', color: l.rejected ? C.danger : undefined });
    y -= h + 10;
    c += line(M, RIGHT, y + 4, 0.9);
  });

  // --- ringkasan ---
  y -= 16;
  const bandLeft = COL.ordered - 150;
  c += rect(bandLeft, y - 7, RIGHT - bandLeft + 8, 24, C.primaryTint);
  c += text('Total', bandLeft + 10, y, { size: 10, bold: true, color: C.primary });
  c += text(String(totalOrdered), COL.ordered, y, { size: 10, bold: true, color: C.primary, align: 'right' });
  c += text(String(totalReceived), COL.received, y, { size: 10, bold: true, color: C.primary, align: 'right' });
  c += text(String(totalRejected), COL.rejected, y, { size: 10, bold: true, color: totalRejected ? C.danger : C.primary, align: 'right' });
  y -= 10;
  if (totalRejected > 0) {
    y -= 14;
    c += text('Qty ditolak tidak dihitung sebagai diterima; sisa pesanan tetap terbuka.', RIGHT, y, { size: 8, gray: 0.45, align: 'right' });
  }

  // --- catatan ---
  y -= 34;
  if (r.note) {
    c += text('Catatan', M, y, { size: 8, bold: true, color: C.primary });
    wrap(r.note, RIGHT - M, 9).forEach((row, n) => { c += text(row, M, y - 14 - n * 12, { size: 9 }); });
  }

  // --- tanda tangan ---
  const signY = M + 118;
  [
    [isJasa ? 'Diperiksa oleh' : 'Diterima oleh', r.createdBy ?? ''],
    ['Diserahkan oleh', vendor?.pic ?? ''],
  ].forEach(([k, v], i) => {
    const x = i === 0 ? M : mid;
    c += text(k, x, signY, { size: 8, bold: true, color: C.primary });
    c += line(x, x + 170, signY - 46, 0.75);
    c += text(v, x, signY - 58, { size: 9, gray: 0.3 });
  });

  // --- kaki halaman ---
  c += line(M, RIGHT, M + 14, '#d9e5fb');
  c += text(`Dicetak ${formatDate(TODAY)} dari Dashboard Jurnal`, M, M, { size: 8, gray: 0.55 });
  c += text(r.number, RIGHT, M, { size: 8, gray: 0.55, align: 'right' });
  return buildPdf(c, { title: `${label} ${r.number}` });
}

// Unduh FPB / BAPP sebagai PDF, mis. BAPP-2026-11-0004.pdf
export function downloadReceipt(r, meta) {
  saveBlob(receiptPdfBlob(r, meta), `${r.number.replace(/\//g, '-')}.pdf`);
}
