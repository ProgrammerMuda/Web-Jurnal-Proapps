// Pembuat PDF sederhana tanpa pustaka luar, dipakai untuk mengunduh PO / SPK dari prototype.
// Hanya teks Helvetica dan garis kotak; cukup untuk dokumen satu halaman yang rapi.

const A4 = { w: 595.28, h: 841.89 };

// Lebar karakter Helvetica (per 1000 unit) secukupnya untuk rata kanan nominal dan judul kolom.
const WIDTH = { ' ': 278, '.': 278, ',': 278, ':': 278, '/': 278, '-': 333, '(': 333, ')': 333, '%': 889 };
const charWidth = (c) => WIDTH[c] ?? (/[0-9]/.test(c) ? 556 : /[A-Z]/.test(c) ? 667 : 500);
export const textWidth = (s, size) => [...String(s)].reduce((n, c) => n + charWidth(c), 0) * (size / 1000);

// PDF memakai encoding WinAnsi: karakter di luar ASCII (mis. · atau —) diganti agar tidak rusak.
const ascii = (s) =>
  String(s ?? '')
    .replace(/[·•]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[^\x20-\x7E]/g, '');
const esc = (s) => ascii(s).replace(/[\\()]/g, (c) => `\\${c}`);

// Warna boleh ditulis sebagai hex token tema ('#053079') atau angka abu 0–1 (0 = hitam).
const toRgb = (c) => {
  if (typeof c === 'string') {
    const h = c.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  }
  const g = c ?? 0;
  return [g, g, g];
};
const fill = (c) => `${toRgb(c).map((n) => n.toFixed(3)).join(' ')} rg `;

// Satu baris teks. align: 'left' (bawaan), 'right', atau 'center'.
export function text(str, x, y, { size = 10, bold = false, align = 'left', gray = 0, color } = {}) {
  const s = ascii(str);
  if (!s) return '';
  const w = textWidth(s, size);
  const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  return `${fill(color ?? gray)}BT /${bold ? 'F2' : 'F1'} ${size} Tf ${left.toFixed(2)} ${y.toFixed(2)} Td (${esc(s)}) Tj ET\n`;
}

// Kotak terisi; dipakai untuk garis (tinggi tipis), latar baris tabel, dan band berwarna.
export const rect = (x, y, w, h, color = 0.85) => `${fill(color)}${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\n`;
export const line = (x1, x2, y, color = 0.8) => rect(x1, y, x2 - x1, 0.6, color);

// Bungkus teks panjang jadi beberapa baris agar tidak melewati lebar kolom.
export function wrap(str, width, size) {
  const words = ascii(str).split(/\s+/).filter(Boolean);
  const rows = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (textWidth(next, size) > width && cur) {
      rows.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) rows.push(cur);
  return rows;
}

// Rangkai isi halaman menjadi berkas PDF utuh.
export function buildPdf(content, { title = 'Dokumen', page = A4 } = {}) {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.w} ${page.h}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Title (${esc(title)}) /Producer (Dashboard Jurnal) >>`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { pdf += `${String(o).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${objs.length} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

// Simpan blob sebagai berkas unduhan.
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const PAGE = A4;
