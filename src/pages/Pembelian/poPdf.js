// Susun PO / SPK menjadi PDF satu halaman yang bisa diunduh dan dikirim ke vendor.
import { TODAY } from './data.js';
import { buildPdf, line, PAGE, rect, saveBlob, text, wrap } from '@/lib/pdf.js';
import { advancePct, bankLine, formatDate, poAllJasa, poDpAmount, poDocLabel, poPpn, poSubtotal, poTotal, ppnLabel, rupiah, termText } from './utils.js';

const M = 48; // margin kiri/kanan
const RIGHT = PAGE.w - M;
// Kolom tabel item.
const COL = { no: M, desc: M + 24, qty: 352, price: 452, amount: RIGHT };

// Warna tema (lihat src/theme/colors.js) supaya PDF sewarna dengan aplikasi.
const C = {
  primary: '#053079',
  primaryTint: '#eef4ff',
  onPrimary: '#ffffff',
  onPrimarySoft: '#b0c8f4',
};
const BAND = 92; // tinggi band kepala dokumen

export function poPdfBlob(po, { vendor, fppbj } = {}) {
  const label = poDocLabel(po);
  const pph = Math.round(po.items.reduce((n, i) => n + i.qty * i.price * (i.pphRate ?? 0), 0));
  let c = '';

  // --- kepala dokumen: band primary mentok kiri-kanan halaman ---
  c += rect(0, PAGE.h - BAND, PAGE.w, BAND, C.primary);
  c += text(label === 'SPK' ? 'SURAT PERINTAH KERJA' : 'PURCHASE ORDER', M, PAGE.h - 46, { size: 17, bold: true, color: C.onPrimary });
  c += text('Jurnal Accounting', M, PAGE.h - 64, { size: 9, color: C.onPrimarySoft });
  c += text(po.number, RIGHT, PAGE.h - 45, { size: 14, bold: true, align: 'right', color: C.onPrimary });
  c += text(po.sent ? 'Sudah dikirim ke vendor' : 'Draf - belum dikirim', RIGHT, PAGE.h - 64, {
    size: 9,
    align: 'right',
    color: C.onPrimarySoft,
  });

  let y = PAGE.h - BAND - 30;

  // --- identitas vendor (kiri) dan data dokumen (kanan) ---
  const mid = M + 250;
  c += text('Kepada vendor', M, y, { size: 8, bold: true, color: C.primary });
  c += text(vendor?.name ?? '-', M, y - 16, { size: 11, bold: true });
  const vendorRows = [vendor?.npwp && `NPWP ${vendor.npwp}`, vendor?.pic && `PIC ${vendor.pic}`, vendor?.phone, vendor && bankLine(vendor)].filter(Boolean);
  vendorRows.forEach((row, i) => { c += text(row, M, y - 31 - i * 13, { size: 9, gray: 0.3 }); });

  // SPK (jasa) tidak dikirim ke gudang, dan tanggalnya target selesai — bukan perkiraan tiba.
  const isJasa = poAllJasa(po);
  const docRows = [
    [`Tanggal ${label}`, formatDate(po.date)],
    [isJasa ? 'Target selesai' : 'Perkiraan tiba', formatDate(po.expectedAt)],
    ...(isJasa ? [] : [['Gudang tujuan', po.warehouse ?? '-']]),
    ['Termin bayar', termText(po.term)],
    ...(fppbj ? [['Dari permintaan', fppbj.number]] : []),
  ];
  docRows.forEach(([k, v], i) => {
    const ry = y - i * 14;
    c += text(k, mid, ry, { size: 9, gray: 0.45 });
    c += text(v, RIGHT, ry, { size: 9, bold: true, align: 'right' });
  });

  y -= Math.max(31 + vendorRows.length * 13, docRows.length * 14) + 18;
  c += line(M, RIGHT, y);
  y -= 24;

  // --- tabel item ---
  c += rect(M - 8, y - 7, RIGHT - M + 16, 21, C.primaryTint);
  c += text('No', COL.no + 2, y, { size: 8, bold: true, color: C.primary });
  c += text('Barang atau jasa', COL.desc, y, { size: 8, bold: true, color: C.primary });
  c += text('Jumlah', COL.qty, y, { size: 8, bold: true, color: C.primary, align: 'right' });
  c += text('Harga satuan', COL.price, y, { size: 8, bold: true, color: C.primary, align: 'right' });
  c += text('Jumlah harga', COL.amount, y, { size: 8, bold: true, color: C.primary, align: 'right' });
  y -= 24;

  po.items.forEach((it, i) => {
    const rows = wrap(it.desc, COL.qty - COL.desc - 50, 9.5);
    c += text(String(i + 1), COL.no + 2, y, { size: 9.5 });
    rows.forEach((row, n) => { c += text(row, COL.desc, y - n * 12, { size: 9.5 }); });
    let h = rows.length * 12;
    if (it.spec) {
      wrap(it.spec, COL.qty - COL.desc - 50, 8.5).forEach((row, n) => { c += text(row, COL.desc, y - h - n * 11, { size: 8.5, gray: 0.45 }); });
      h += wrap(it.spec, COL.qty - COL.desc - 50, 8.5).length * 11;
    }
    c += text(`${it.qty} ${it.unit ?? ''}`.trim(), COL.qty, y, { size: 9.5, align: 'right' });
    c += text(rupiah(it.price), COL.price, y, { size: 9.5, align: 'right' });
    c += text(rupiah(it.qty * it.price), COL.amount, y, { size: 9.5, bold: true, align: 'right' });
    y -= h + 10;
    c += line(M, RIGHT, y + 4, 0.9);
  });

  // --- ringkasan biaya ---
  y -= 16;
  const totals = [
    ['DPP', rupiah(poSubtotal(po))],
    [ppnLabel(po.items), rupiah(poPpn(po))],
    ...(pph > 0 ? [['Potongan PPh (saat bayar)', `-${rupiah(pph)}`]] : []),
    ...(advancePct(po.term) > 0
      ? [[advancePct(po.term) >= 100 ? 'Dibayar di muka' : `Uang muka ${advancePct(po.term)}%`, rupiah(poDpAmount(po))]]
      : []),
  ];
  totals.forEach(([k, v], i) => {
    const ry = y - i * 14;
    c += text(k, COL.price, ry, { size: 9, gray: 0.35, align: 'right' });
    c += text(v, COL.amount, ry, { size: 9, align: 'right' });
  });
  y -= totals.length * 14 + 12;
  // Total ditegaskan dengan band primary muda, sejajar kolom nominal.
  const bandLeft = COL.price - 150;
  c += rect(bandLeft, y - 7, RIGHT - bandLeft + 8, 24, C.primaryTint);
  c += text(`Total ${label}`, bandLeft + 10, y, { size: 10, bold: true, color: C.primary });
  c += text(rupiah(poTotal(po)), COL.amount, y, { size: 11, bold: true, color: C.primary, align: 'right' });
  y -= 10;
  if (po.ppnIncluded) {
    y -= 14;
    c += text('Harga penawaran sudah termasuk PPN.', RIGHT, y, { size: 8, gray: 0.45, align: 'right' });
  }

  // --- catatan ---
  y -= 34;
  if (po.note) {
    c += text('Catatan', M, y, { size: 8, bold: true, color: C.primary });
    wrap(po.note, RIGHT - M, 9).forEach((row, n) => { c += text(row, M, y - 14 - n * 12, { size: 9 }); });
  }

  // --- tanda tangan: dipaku di bawah halaman supaya posisinya sama di tiap dokumen ---
  const signY = M + 118;
  [['Dibuat oleh', 'Accounting'], ['Disetujui vendor', vendor?.pic ?? '']].forEach(([k, v], i) => {
    const x = i === 0 ? M : mid;
    c += text(k, x, signY, { size: 8, bold: true, color: C.primary });
    c += line(x, x + 170, signY - 46, 0.75);
    c += text(v, x, signY - 58, { size: 9, gray: 0.3 });
  });

  // --- kaki halaman ---
  c += line(M, RIGHT, M + 14, '#d9e5fb');
  c += text(`Dicetak ${formatDate(TODAY)} dari Dashboard Jurnal`, M, M, { size: 8, gray: 0.55 });
  c += text(po.number, RIGHT, M, { size: 8, gray: 0.55, align: 'right' });
  return buildPdf(c, { title: `${label} ${po.number}` });
}

// Unduh PO / SPK sebagai PDF, mis. PO-2026-11-0001.pdf
export function downloadPo(po, meta) {
  saveBlob(poPdfBlob(po, meta), `${po.number.replace(/\//g, '-')}.pdf`);
}
