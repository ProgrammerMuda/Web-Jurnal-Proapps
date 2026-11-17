// Susun faktur penjualan menjadi PDF satu halaman: dipratinjau sebelum dikirim,
// dan dipakai juga oleh tombol "Unduh PDF". Tanpa pustaka luar (lihat src/lib/pdf.js).
import { buildPdf, line, PAGE, rect, saveBlob, text, wrap } from '@/lib/pdf.js';
import { DOC } from './docTypes.js';
import { paymentTerms, products, TODAY } from './data.js';
import { computeTotals, formatDate, lineAmount, rupiah, taxLabel } from './utils.js';

const M = 48; // margin kiri/kanan
const RIGHT = PAGE.w - M;
const COL = { no: M, desc: M + 24, qty: 330, price: 430, amount: RIGHT };

// Warna tema (lihat src/theme/colors.js) supaya PDF sewarna dengan aplikasi.
const C = {
  primary: '#053079',
  primaryTint: '#eef4ff',
  onPrimary: '#ffffff',
  onPrimarySoft: '#b0c8f4',
};
const BAND = 92; // tinggi band kepala dokumen

const productName = (l) => products.find((p) => p.id === l.productId)?.name ?? l.description ?? '-';

export function invoicePdfBlob(sale, { customer, doc = DOC.invoice } = {}) {
  const D = doc.pdf;
  const t = computeTotals(sale);
  const term = paymentTerms.find((p) => p.value === sale.term)?.label;
  let c = '';

  // --- kepala dokumen ---
  c += rect(0, PAGE.h - BAND, PAGE.w, BAND, C.primary);
  c += text(D.heading, M, PAGE.h - 46, { size: 17, bold: true, color: C.onPrimary });
  c += text('Jurnal Accounting', M, PAGE.h - 64, { size: 9, color: C.onPrimarySoft });
  c += text(sale.number, RIGHT, PAGE.h - 45, { size: 13, bold: true, align: 'right', color: C.onPrimary });
  const headNote = D.showBalance
    ? t.balance <= 0
      ? 'Lunas'
      : `Sisa tagihan ${rupiah(t.balance)}`
    : `Nilai ${doc.word} ${rupiah(t.total)}`;
  c += text(headNote, RIGHT, PAGE.h - 64, { size: 9, align: 'right', color: C.onPrimarySoft });

  let y = PAGE.h - BAND - 30;
  const mid = M + 250;

  // --- pelanggan (kiri) dan data faktur (kanan) ---
  c += text('Ditagihkan kepada', M, y, { size: 8, bold: true, color: C.primary });
  c += text(customer?.name ?? '-', M, y - 16, { size: 11, bold: true });
  const custRows = [
    customer?.email,
    ...(doc.fields?.billing ? wrap(sale.billingAddress ?? '', 230, 9) : []),
  ].filter(Boolean);
  custRows.forEach((row, i) => {
    c += text(row, M, y - 31 - i * 13, { size: 9, gray: 0.3 });
  });

  const docRows = [
    [doc.pdfDateLabel ?? 'Tanggal faktur', formatDate(sale.date)],
    [doc.pdfDueLabel ?? 'Jatuh tempo', formatDate(sale.dueDate)],
    ...(sale.unit ? [['Unit / Tower', sale.unit]] : []),
    ...(sale.taxInvoiceNumber ? [['No. faktur pajak', sale.taxInvoiceNumber]] : []),
    ...(term ? [['Termin pembayaran', term]] : []),
    ...(sale.ref ? [['Referensi pelanggan', sale.ref]] : []),
  ];
  docRows.forEach(([k, v], i) => {
    const ry = y - i * 14;
    c += text(k, mid, ry, { size: 9, gray: 0.45 });
    c += text(v, RIGHT, ry, { size: 9, bold: true, align: 'right' });
  });

  y -= Math.max(31 + custRows.length * 13, docRows.length * 14) + 18;
  c += line(M, RIGHT, y);
  y -= 24;

  // --- tabel baris tagihan ---
  c += rect(M - 8, y - 7, RIGHT - M + 16, 21, C.primaryTint);
  c += text('No', COL.no + 2, y, { size: 8, bold: true, color: C.primary });
  c += text('Barang atau jasa', COL.desc, y, { size: 8, bold: true, color: C.primary });
  c += text('Jumlah', COL.qty, y, { size: 8, bold: true, color: C.primary, align: 'right' });
  c += text('Harga satuan', COL.price, y, { size: 8, bold: true, color: C.primary, align: 'right' });
  c += text('Jumlah harga', COL.amount, y, { size: 8, bold: true, color: C.primary, align: 'right' });
  y -= 24;

  sale.items.forEach((it, i) => {
    const width = COL.qty - COL.desc - 50;
    const rows = wrap(productName(it), width, 9.5);
    c += text(String(i + 1), COL.no + 2, y, { size: 9.5 });
    rows.forEach((row, n) => {
      c += text(row, COL.desc, y - n * 12, { size: 9.5 });
    });
    let h = rows.length * 12;
    // Deskripsi baris hanya dicetak kalau berbeda dari nama produknya.
    if (it.description && it.description !== productName(it)) {
      const sub = wrap(it.description, width, 8.5);
      sub.forEach((row, n) => {
        c += text(row, COL.desc, y - h - n * 11, { size: 8.5, gray: 0.45 });
      });
      h += sub.length * 11;
    }
    c += text(String(it.qty), COL.qty, y, { size: 9.5, align: 'right' });
    c += text(rupiah(it.price), COL.price, y, { size: 9.5, align: 'right' });
    c += text(rupiah(lineAmount(it)), COL.amount, y, { size: 9.5, bold: true, align: 'right' });
    if (it.tax) c += text(taxLabel(it.tax), COL.price, y - 12, { size: 8, gray: 0.45, align: 'right' });
    y -= h + 10;
    c += line(M, RIGHT, y + 4, 0.9);
  });

  // --- ringkasan tagihan ---
  y -= 16;
  const hasTax = sale.items.some((l) => l.tax);
  const totals = [
    ['Subtotal', rupiah(t.subtotal)],
    ...(t.discount > 0 ? [['Diskon', `-${rupiah(t.discount)}`]] : []),
    ...(hasTax ? [['PPN', `+${rupiah(t.tax)}`]] : []),
    ...(t.withholding > 0 ? [['Potongan (PPh)', `-${rupiah(t.withholding)}`]] : []),
  ];
  totals.forEach(([k, v], i) => {
    const ry = y - i * 14;
    c += text(k, COL.price, ry, { size: 9, gray: 0.35, align: 'right' });
    c += text(v, COL.amount, ry, { size: 9, align: 'right' });
  });
  y -= totals.length * 14 + 12;

  const bandLeft = COL.price - 150;
  c += rect(bandLeft, y - 7, RIGHT - bandLeft + 8, 24, C.primaryTint);
  c += text(D.totalLabel, bandLeft + 10, y, { size: 10, bold: true, color: C.primary });
  c += text(rupiah(t.total), COL.amount, y, { size: 11, bold: true, color: C.primary, align: 'right' });

  // Pembayaran yang sudah masuk hanya dicetak kalau memang ada.
  if (D.showBalance && t.paid > 0) {
    y -= 24;
    c += text('Sudah dibayar', COL.price, y, { size: 9, gray: 0.35, align: 'right' });
    c += text(`-${rupiah(t.paid)}`, COL.amount, y, { size: 9, align: 'right' });
    y -= 14;
    c += text('Sisa tagihan', COL.price, y, { size: 9, bold: true, align: 'right' });
    c += text(rupiah(t.balance), COL.amount, y, { size: 10, bold: true, align: 'right' });
  }
  if (sale.taxInclusive) {
    y -= 16;
    c += text('Harga satuan sudah termasuk pajak.', RIGHT, y, { size: 8, gray: 0.45, align: 'right' });
  }

  // --- syarat & ketentuan (penawaran) ---
  if (doc.fields?.terms && sale.terms) {
    y -= 30;
    c += text(doc.fields.terms, M, y, { size: 8, bold: true, color: C.primary });
    let n = 0;
    sale.terms.split('\n').forEach((para) => {
      wrap(para, RIGHT - M, 9).forEach((row) => {
        c += text(row, M, y - 14 - n * 12, { size: 9 });
        n += 1;
      });
    });
    y -= n * 12;
  }

  // --- pesan untuk pelanggan ---
  y -= 34;
  if (sale.message) {
    c += text('Pesan', M, y, { size: 8, bold: true, color: C.primary });
    wrap(sale.message, RIGHT - M, 9).forEach((row, n) => {
      c += text(row, M, y - 14 - n * 12, { size: 9 });
    });
  }

  // --- kaki halaman ---
  c += line(M, RIGHT, M + 14, '#d9e5fb');
  c += text(`Dicetak ${formatDate(TODAY)} dari Dashboard Jurnal`, M, M, { size: 8, gray: 0.55 });
  c += text(sale.number, RIGHT, M, { size: 8, gray: 0.55, align: 'right' });
  return buildPdf(c, { title: `${D.heading} ${sale.number}` });
}

// Unduh faktur sebagai PDF, mis. PRO-INV-202610-40685.pdf
export function downloadInvoice(sale, meta) {
  saveBlob(invoicePdfBlob(sale, meta), `${sale.number.replace(/\//g, '-')}.pdf`);
}
