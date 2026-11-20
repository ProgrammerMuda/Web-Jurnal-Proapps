// Kerangka bersama PDF dokumen pembelian: kepala surat, pita data, panel, kepala tabel,
// blok tanda tangan, dan kaki halaman.
//
// Dikumpulkan di sini karena PO/SPK dan FPPBJ memakai tata letak yang sama persis. Saat
// geometrinya masih disalin per dokumen, satu cacat jarak baris ikut tersalin ke tiga
// berkas sekaligus — itu yang ingin dicegah file ini.
import { COMPANY, companyInitials } from '@/lib/company.js';
import { framedRect, line, PAGE, rect, roundRect, text, textWidth, wrap } from '@/lib/pdf.js';
import { formatDate } from './utils.js';
import { TODAY } from './data.js';

export const M = 48; // margin kiri/kanan
export const RIGHT = PAGE.w - M;
export const W = RIGHT - M;
export const TOP = PAGE.h - 44;

// Warna mengikuti tema aplikasi (src/theme/colors.js) supaya cetakan sewarna layar.
export const C = {
  primary: '#053079',
  onPrimary: '#ffffff',
  ink: '#0f172a',
  label: '#64748b',
  muted: '#94a3b8',
  border: '#e2e8f0',
  rule: '#cbd5e1',
  panel: '#f1f5f9',
  panelSoft: '#f8fafc',
  warnBg: '#fef3c7',
  warnInk: '#92400e',
  okBg: '#dcfce7',
  okInk: '#166534',
  stopBg: '#fee2e2',
  stopInk: '#991b1b',
};

// Rupiah tanpa angka di belakang koma. Nilai dokumen pembelian selalu rupiah bulat,
// jadi ",00" hanya menambah panjang kolom tanpa menambah informasi.
export const rp = (n) => `Rp ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;

// --- kepala surat --------------------------------------------------------------------
// title boleh satu string atau beberapa baris. Mengembalikan { c, y } dengan y = garis
// alas tepat di bawah garis tebal pemisah kepala.
export function docHeader({ title, number, status, subtitle }) {
  const judul = Array.isArray(title) ? title : [title];
  let c = '';

  // Kotak logo dengan inisial perusahaan.
  const sisi = 36;
  c += roundRect(M, TOP - sisi, sisi, sisi, 8, C.primary);
  c += text(companyInitials(), M + sisi / 2, TOP - 23, {
    size: 13,
    bold: true,
    align: 'center',
    color: C.onPrimary,
  });

  const kiri = M + sisi + 12;
  c += text(COMPANY.name, kiri, TOP - 12, { size: 12.5, bold: true, color: C.ink });
  c += text(COMPANY.address, kiri, TOP - 25, { size: 8, color: C.label });
  c += text(subtitle, kiri, TOP - 36, { size: 8, color: C.label });

  judul.forEach((baris, i) => {
    c += text(baris, RIGHT, TOP - 12 - i * 18, { size: 17, bold: true, align: 'right', color: C.primary });
  });
  let y = TOP - 12 - (judul.length - 1) * 18;
  c += text(number, RIGHT, y - 21, { size: 11, bold: true, align: 'right', color: C.ink });
  y -= 21;

  if (status) {
    const lebar = textWidth(status.label, 7.5) + 20;
    c += roundRect(RIGHT - lebar, y - 26, lebar, 16, 4, status.bg);
    c += text(status.label, RIGHT - 10, y - 21, { size: 7.5, bold: true, align: 'right', color: status.ink });
    y -= 26;
  }

  // Garis tebal pemisah: alasnya mengikuti blok mana pun yang paling panjang.
  const alas = Math.min(y - 14, TOP - sisi - 16);
  c += rect(M, alas, W, 1.6, C.primary);
  return { c, y: alas };
}

// --- pita data ringkas ---------------------------------------------------------------
// cells: [{ label, value, sub, muted }]. y = tepi atas pita, kembaliannya tepi bawah.
export function metaStrip(cells, y) {
  const w = W / cells.length;
  // Isi dibungkus mengikuti lebar selnya. Tanpa ini, nilai panjang seperti nama termin
  // meluber ke sel sebelahnya dan menimpa isinya.
  const isi = cells.map((cell) => ({
    ...cell,
    nilai: wrap(cell.value, w - 28, 10),
    sub: cell.sub ? wrap(cell.sub, w - 28, 7.5) : [],
  }));
  const barisNilai = Math.max(...isi.map((x) => x.nilai.length));
  const barisSub = Math.max(...isi.map((x) => x.sub.length));
  const tinggi = 35 + (barisNilai - 1) * 13 + (barisSub ? barisSub * 11 : 0) + 10;

  let c = framedRect(M, y - tinggi, W, tinggi, { r: 6, border: C.border, fill: C.panelSoft });
  isi.forEach((cell, i) => {
    const x = M + i * w;
    if (i) c += rect(x, y - tinggi + 10, 0.6, tinggi - 20, C.border);
    c += text(cell.label, x + 14, y - 19, { size: 7, bold: true, color: C.label });
    cell.nilai.forEach((baris, n) => {
      c += text(baris, x + 14, y - 35 - n * 13, {
        size: 10,
        bold: true,
        color: cell.muted ? C.muted : C.ink,
      });
    });
    const subY = y - 35 - (barisNilai - 1) * 13 - 11;
    cell.sub.forEach((baris, n) => {
      c += text(baris, x + 14, subY - n * 11, { size: 7.5, color: C.muted });
    });
  });
  return { c, y: y - tinggi };
}

// --- panel berisi label/nilai ----------------------------------------------------------
// Tinggi dihitung dulu tanpa menggambar, supaya dua panel bersebelahan bisa disamakan.
const panelLines = ({ title, rows }, w) => ({
  judul: wrap(title ?? '-', w - 32, 12.5),
  baris: (rows ?? []).filter(([, v]) => v).map(([k, v]) => [k, wrap(v, w - 32 - 68, 8.5)]),
});

export function panelHeight(isi, w) {
  const { judul, baris } = panelLines(isi, w);
  const tinggiBaris = baris.reduce((n, [, b]) => n + b.length * 12 + 2, 0);
  return 40 + judul.length * 15 + (tinggiBaris ? tinggiBaris + 8 : 0) + 12;
}

export function panelBox(x, y, w, h, isi) {
  const { judul, baris } = panelLines(isi, w);
  let c = roundRect(x, y - h, w, h, 8, C.panel);
  c += text(isi.label, x + 16, y - 20, { size: 7, bold: true, color: C.label });
  judul.forEach((row, i) => {
    c += text(row, x + 16, y - 38 - i * 15, { size: 12.5, bold: true, color: C.ink });
  });
  let ry = y - 40 - judul.length * 15 - 2;
  baris.forEach(([k, isiBaris]) => {
    c += text(k, x + 16, ry, { size: 8.5, color: C.label });
    isiBaris.forEach((row, n) => {
      c += text(row, x + 16 + 68, ry - n * 12, { size: 8.5, color: C.ink });
    });
    ry -= isiBaris.length * 12 + 2;
  });
  return c;
}

// Dua panel bersebelahan dengan tinggi sama; satu panel memakai lebar penuh.
export function panels(daftar, y) {
  const gap = 15;
  const w = daftar.length > 1 ? (W - gap) / daftar.length : W;
  const h = Math.max(...daftar.map((isi) => panelHeight(isi, w)));
  let c = '';
  daftar.forEach((isi, i) => { c += panelBox(M + i * (w + gap), y, w, h, isi); });
  return { c, y: y - h };
}

// --- tabel ------------------------------------------------------------------------------
// cols: [{ label, x, align }]. Mengembalikan garis alas baris pertama isi tabel.
export function tableHead(cols, y) {
  let c = '';
  cols.forEach((col) => {
    c += text(col.label, col.x, y, { size: 7, bold: true, color: C.label, align: col.align });
  });
  c += line(M, RIGHT, y - 10, C.rule);
  return { c, y: y - 26 };
}

// --- tanda tangan & kaki halaman ---------------------------------------------------------
// Dipaku di bawah halaman supaya posisinya sama di tiap dokumen.
export function signatures(kolom, { y = 196 } = {}) {
  const gap = 20;
  const w = (W - gap * (kolom.length - 1)) / kolom.length;
  let c = '';
  kolom.forEach((k, i) => {
    const x = M + i * (w + gap);
    c += text(k.label, x, y, { size: 7.5, bold: true, color: C.label });
    c += line(x, x + w - 10, y - 54, 0.65);
    c += text(k.name || '', x, y - 68, { size: 9.5, bold: true, color: C.ink });
    c += text(k.role || '', x, y - 80, { size: 8, color: C.label });
    c += text('Tgl: ____________', x, y - 92, { size: 8, color: C.label });
  });
  return c;
}

export function pageFooter(number) {
  let c = line(M, RIGHT, 70, C.border);
  c += text(`Dicetak ${formatDate(TODAY)} dari Jurnal Accounting`, M, 56, { size: 8, color: C.muted });
  c += text(`${number} - Halaman 1 dari 1`, RIGHT, 56, { size: 8, align: 'right', color: C.muted });
  return c;
}
