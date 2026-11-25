// Ekspor laporan keuangan (Neraca, Laba Rugi, Neraca Saldo) ke PDF, Excel (.xlsx), dan CSV.
// Ketiganya memakai baris yang sama dengan layar, jadi isi file selalu sama dengan yang tampil.
// Judul laporan datang dari `title`.
//
// Kolom angka: bawaannya satu nilai (`a`) atau, dengan pembanding, nilai + pembanding +
// perubahan + %. Laporan dengan kolom angka sendiri (Neraca Saldo) mengisi `vals` di setiap
// baris dan boleh memberi `groups` (judul di atas beberapa kolom, mis. "Saldo awal") serta
// `pdfWidths` / `xlsxWidths`.
// Warna mengikuti tema biru ProApps: primary-9 #053079, primary-8 #1B4399, primary-0/1.

import { buildPdf, line, PAGE, rect, saveBlob, text, textWidth } from '@/lib/pdf.js';
import { downloadXlsx } from '@/lib/xlsx.js';
import { downloadCsv } from '@/pages/Kontak/utils.js';

const NAVY = '053079';
const BLUE = '1B4399';
const TINT = 'D9E5FB';
const PALE = 'EEF4FF';
const INK = '0F172A';
const MUTED = '64748B';

// Baris laporan → bentuk netral yang dipakai ketiga format.
// type: section | group | account | total | result | grand
// `grand` opsional: baris penutup Neraca (Total liabilitas + ekuitas).
export function statementLines(rows, grand) {
  const out = [];
  rows.forEach((r) => {
    if (r.type === 'section') out.push({ type: 'section', label: r.label });
    else if (r.type === 'group') out.push({ type: 'group', label: r.label, a: r.a, b: r.b });
    else if (r.type === 'account') out.push({ type: 'account', code: r.row.code ?? '', label: r.row.name, sub: r.row.category ?? '', a: r.row.a, b: r.row.b, vals: r.row.vals });
    else if (r.type === 'cat-sum') out.push({ type: 'account', code: '', label: r.label, sub: `${r.count} akun`, a: r.a, b: r.b, vals: r.vals });
    else if (r.type === 'total') out.push({ type: 'total', label: r.label, a: r.a, b: r.b, vals: r.vals });
    else if (r.type === 'result') out.push({ type: 'result', label: r.label, a: r.a, b: r.b, vals: r.vals });
    else if (r.type === 'grand') out.push({ type: 'grand', label: r.label, a: r.a, b: r.b, vals: r.vals });
  });
  if (grand) out.push({ type: 'grand', label: grand.label ?? 'Total liabilitas + ekuitas', a: grand.a, b: grand.b });
  return out;
}

const round2 = (n) => Math.round((n ?? 0) * 100) / 100;
const diffOf = (l) => round2((l.a ?? 0) - (l.b ?? 0));
const ratioOf = (l) => (l.b ? diffOf(l) / Math.abs(l.b) : null);

// ---------------- Excel ----------------
export function exportStatementXlsx({ filename, title, company, period, headers, groups, compare, lines, footnote, xlsxWidths }) {
  const ncol = headers.length;
  const last = String.fromCharCode(64 + ncol);
  const NUM = '#,##0.00;[Red](#,##0.00);"-"';
  const PCT = '+0%;[Red]-0%;"-"';

  const band = (fill, extra = {}) => Array.from({ length: ncol }, () => ({ s: { fill, ...extra } }));
  const fillRow = (cells, base) => Array.from({ length: ncol }, (_, i) => cells[i] ?? { s: base });

  const rows = [];
  const head1 = band(NAVY);
  head1[0] = { v: company, s: { fill: NAVY, color: 'FFFFFF', bold: true, size: 15 } };
  rows.push({ height: 30, cells: head1 });
  const head2 = band(NAVY);
  head2[0] = { v: title, s: { fill: NAVY, color: 'FFFFFF', size: 12 } };
  rows.push({ height: 22, cells: head2 });
  const head3 = band(TINT);
  head3[0] = { v: period, s: { fill: TINT, color: NAVY, italic: true } };
  rows.push({ height: 20, cells: head3 });
  rows.push({ height: 8, cells: [] });

  const hs = (align) => ({ fill: BLUE, color: 'FFFFFF', bold: true, align, border: { bottom: 'medium' }, borderColor: NAVY });
  const merges = ['1', '2', '3'].map((r) => `A${r}:${last}${r}`);
  if (groups) {
    // Judul kelompok kolom di atas kepala tabel, digabung selebar kolomnya.
    const cells = [{ s: hs('left') }, { s: hs('left') }];
    let col = 3;
    groups.forEach((g) => {
      cells.push({ v: g.label, s: hs('center') });
      for (let k = 1; k < g.span; k += 1) cells.push({ s: hs('center') });
      if (g.span > 1) merges.push(`${String.fromCharCode(64 + col)}5:${String.fromCharCode(64 + col + g.span - 1)}5`);
      col += g.span;
    });
    rows.push({ height: 20, cells });
  }
  // Laporan berkelompok kolom (Neraca Saldo): judul Debit/Kredit rata tengah dan garis tegak di
  // kiri setiap kolom angka, lebih tegas di awal kelompok.
  const starts = new Set();
  if (groups) groups.reduce((col, g) => { starts.add(col); return col + g.span; }, 2);
  const colLine = (i, s) => (groups && i >= 2
    ? { ...s, border: { ...(s.border ?? {}), left: 'thin' }, leftColor: starts.has(i) ? '94A3B8' : 'CBD5E1' }
    : s);
  rows.push({ height: 22, cells: headers.map((h, i) => ({ v: h, s: colLine(i, hs(i < 2 ? 'left' : groups ? 'center' : 'right')) })) });
  const headRows = rows.length;

  const nums = (l, s) => {
    if (l.vals) return l.vals.map((v, i) => ({ v: round2(v), s: colLine(i + 2, { ...s, numFmt: NUM, align: 'right' }) }));
    const cells = [{ v: round2(l.a), s: { ...s, numFmt: NUM, align: 'right' } }];
    if (compare) {
      cells.push({ v: round2(l.b), s: { ...s, numFmt: NUM, align: 'right' } });
      cells.push({ v: diffOf(l), s: { ...s, numFmt: NUM, align: 'right' } });
      const r = ratioOf(l);
      cells.push({ v: r == null ? '' : r, s: { ...s, numFmt: PCT, align: 'right', color: s.color ?? MUTED } });
    }
    return cells;
  };

  lines.forEach((l) => {
    if (l.type === 'section') {
      const s = { fill: TINT, color: NAVY, bold: true, size: 11 };
      rows.push({ height: 22, cells: fillRow([{ v: l.label, s }], s) });
    } else if (l.type === 'group') {
      const s = { fill: PALE, color: NAVY, bold: true };
      rows.push({ height: 20, cells: [{ v: l.label, s }, { s }, ...nums(l, s)] });
    } else if (l.type === 'account') {
      const s = { color: INK, border: { bottom: 'thin' }, borderColor: 'E2E8F0' };
      rows.push({
        cells: [
          { v: l.code, s: { ...s, color: MUTED } },
          { v: l.label, s: { ...s, indent: 1 } },
          ...nums(l, s),
        ],
      });
    } else if (l.type === 'total') {
      const s = { bold: true, color: NAVY, fill: PALE, border: { top: 'thin', bottom: 'thin' }, borderColor: BLUE };
      rows.push({ height: 20, cells: [{ v: l.label, s }, { s }, ...nums(l, s)] });
      rows.push({ height: 8, cells: [] });
    } else if (l.type === 'result') {
      // Baris hasil (laba kotor, laba operasional): seperti total, garis atasnya lebih tegas.
      const s = { bold: true, color: NAVY, fill: PALE, border: { top: 'medium', bottom: 'thin' }, borderColor: NAVY };
      rows.push({ height: 22, cells: [{ v: l.label, s }, { s }, ...nums(l, s)] });
      rows.push({ height: 8, cells: [] });
    } else if (l.type === 'grand') {
      const s = { bold: true, color: 'FFFFFF', fill: NAVY, border: { bottom: 'double' }, borderColor: NAVY };
      rows.push({ height: 22, cells: [{ v: l.label, s }, { s }, ...nums(l, s)] });
    }
  });

  rows.push({ height: 8, cells: [] });
  rows.push({ cells: [{ v: footnote, s: { italic: true, color: MUTED, size: 9 } }] });

  // Judul, tanggal, dan baris pos digabung melintasi semua kolom; kelompok & total di A:B.
  rows.forEach((row, i) => {
    const first = row.cells[0]?.s;
    if (!first || i < headRows) return;
    if (first.fill === TINT) merges.push(`A${i + 1}:${last}${i + 1}`);
    else if (first.fill === PALE || first.fill === NAVY) merges.push(`A${i + 1}:B${i + 1}`);
  });

  downloadXlsx(filename, {
    sheet: title,
    title: `${title} ${company}`,
    columns: (xlsxWidths ?? [12, 46, 20, ...(compare ? [20, 20, 9] : [])]).map((width) => ({ width })),
    rows,
    merges,
    freezeRows: headRows,
  });
}

// ---------------- PDF ----------------
const MARGIN = 40;
const ROW = 17;

export function exportStatementPdf({ filename, title, company, period, headers, groups, compare, lines, footnote, num, pdfWidths }) {
  const W = PAGE.w - MARGIN * 2;
  // Lebar kolom: kode, akun, lalu angka; tanpa pembanding akun mendapat ruang lebih.
  const widths = pdfWidths ?? (compare ? [48, 177, 84, 84, 84, 38] : [60, 305, 150]);
  // Kolom angka yang banyak memakai huruf sedikit lebih kecil supaya angka jutaan tetap muat.
  const valSize = (size) => (widths.length > 6 ? size - 1.5 : size);
  const xs = widths.reduce((acc, w, i) => [...acc, acc[i] + w], [MARGIN]);
  const right = (i) => xs[i + 1] - 6;

  const pct = (l) => {
    const r = ratioOf(l);
    if (r == null) return '';
    const v = Math.round(r * 100);
    return v === 0 ? '0%' : `${v > 0 ? '+' : '-'}${Math.abs(v)}%`;
  };
  const fit = (s, width, size) => {
    let t = String(s ?? '');
    if (textWidth(t, size) <= width) return t;
    while (t.length > 1 && textWidth(`${t}...`, size) > width) t = t.slice(0, -1);
    return `${t}...`;
  };

  const pages = [];
  let c = '';
  let y = 0;

  const tableHead = () => {
    if (groups) {
      c += rect(MARGIN, y - 6, W, ROW, `#${NAVY}`);
      let i = 2;
      groups.forEach((g) => {
        c += rect(xs[i], y - 6, 0.8, ROW, '#5b7bc4');
        const x0 = xs[i];
        const x1 = xs[i + g.span];
        c += text(g.label, (x0 + x1) / 2, y, { size: 8, bold: true, color: '#ffffff', align: 'center' });
        i += g.span;
      });
      y -= ROW;
    }
    c += rect(MARGIN, y - 6, W, ROW + 2, `#${BLUE}`);
    if (groups) for (let i = 2; i < headers.length; i += 1) c += rect(xs[i], y - 6, 0.6, ROW + 2, '#5b7bc4');
    headers.forEach((h, i) => {
      const opt = { size: 8, bold: true, color: '#ffffff' };
      if (i < 2) c += text(h, xs[i] + 6, y, opt);
      else if (groups) c += text(h, (xs[i] + xs[i + 1]) / 2, y, { ...opt, align: 'center' });
      else c += text(h, right(i), y, { ...opt, align: 'right' });
    });
    y -= ROW + 4;
  };

  const newPage = (first) => {
    if (c) pages.push(c);
    c = '';
    y = PAGE.h - MARGIN;
    if (first) {
      c += rect(0, PAGE.h - 92, PAGE.w, 92, `#${NAVY}`);
      c += text(company, MARGIN, PAGE.h - 40, { size: 16, bold: true, color: '#ffffff' });
      c += text(title, MARGIN, PAGE.h - 58, { size: 11, color: '#d9e5fb' });
      c += rect(0, PAGE.h - 114, PAGE.w, 22, `#${TINT}`);
      c += text(period, MARGIN, PAGE.h - 106, { size: 9, italic: true, color: `#${NAVY}` });
      y = PAGE.h - 136;
    } else {
      c += text(`${company} - ${title}`, MARGIN, y, { size: 9, bold: true, color: `#${NAVY}` });
      c += text(period, PAGE.w - MARGIN, y, { size: 8, color: `#${MUTED}`, align: 'right' });
      y -= 22;
    }
    tableHead();
  };
  const ensure = (h) => { if (y - h < MARGIN + 20) newPage(false); };

  // Garis tegak di kiri setiap kolom angka untuk satu baris setinggi `h` (laporan berkelompok kolom).
  const starts = new Set();
  if (groups) groups.reduce((col, g) => { starts.add(col); return col + g.span; }, 2);
  const colLines = (top, h) => {
    if (!groups) return;
    for (let i = 2; i < widths.length; i += 1) c += rect(xs[i], top, starts.has(i) ? 0.8 : 0.5, h, starts.has(i) ? '#94a3b8' : '#cbd5e1');
  };
  const numbers = (l, opt) => {
    if (l.vals) {
      l.vals.forEach((v, i) => {
        c += text(num(v), right(2 + i), y, { ...opt, size: valSize(opt.size), align: 'right', color: opt.color ?? ((v ?? 0) < -0.005 ? '#b91c1c' : undefined) });
      });
      return;
    }
    c += text(num(l.a), right(2), y, { ...opt, align: 'right', color: opt.color ?? ((l.a ?? 0) < -0.005 ? '#b91c1c' : undefined) });
    if (compare) {
      c += text(num(l.b), right(3), y, { ...opt, align: 'right', color: opt.color ?? ((l.b ?? 0) < -0.005 ? '#b91c1c' : undefined) });
      c += text(num(diffOf(l)), right(4), y, { ...opt, align: 'right' });
      c += text(pct(l), right(5), y, { ...opt, size: 7, align: 'right', color: opt.color ?? `#${MUTED}` });
    }
  };

  newPage(true);
  lines.forEach((l) => {
    if (l.type === 'section') {
      ensure(ROW * 3);
      y -= 4;
      c += rect(MARGIN, y - 6, W, ROW + 2, `#${TINT}`);
      colLines(y - 6, ROW + 2);
      c += text(l.label, MARGIN + 6, y, { size: 9, bold: true, color: `#${NAVY}` });
      y -= ROW + 2;
    } else if (l.type === 'group') {
      ensure(ROW * 2);
      c += rect(MARGIN, y - 6, W, ROW, `#${PALE}`);
      c += text(l.label, MARGIN + 6, y, { size: 8.5, bold: true, color: `#${NAVY}` });
      numbers(l, { size: 8.5, bold: true, color: `#${NAVY}` });
      y -= ROW;
    } else if (l.type === 'account') {
      ensure(ROW);
      colLines(y - 6, ROW);
      c += text(l.code, xs[0] + 6, y, { size: 8, color: `#${MUTED}` });
      c += text(fit(l.label, widths[1] - 16, 8.5), xs[1] + 10, y, { size: 8.5, color: `#${INK}` });
      numbers(l, { size: 8.5 });
      c += line(MARGIN, MARGIN + W, y - 6, '#e2e8f0');
      y -= ROW;
    } else if (l.type === 'total') {
      ensure(ROW);
      c += rect(MARGIN, y - 6, W, ROW, `#${PALE}`);
      colLines(y - 6, ROW);
      c += rect(MARGIN, y - 6 + ROW - 0.8, W, 0.8, `#${BLUE}`);
      c += text(l.label, MARGIN + 6, y, { size: 8.5, bold: true, color: `#${NAVY}` });
      numbers(l, { size: 8.5, bold: true, color: `#${NAVY}` });
      y -= ROW + 8;
    } else if (l.type === 'result') {
      ensure(ROW + 4);
      c += rect(MARGIN, y - 7, W, ROW + 2, `#${PALE}`);
      c += rect(MARGIN, y - 7 + ROW + 2 - 1.2, W, 1.2, `#${NAVY}`);
      c += text(l.label, MARGIN + 6, y, { size: 9, bold: true, color: `#${NAVY}` });
      numbers(l, { size: 9, bold: true, color: `#${NAVY}` });
      y -= ROW + 10;
    } else if (l.type === 'grand') {
      ensure(ROW + 4);
      c += rect(MARGIN, y - 7, W, ROW + 2, `#${NAVY}`);
      c += rect(MARGIN, y - 10, W, 0.8, `#${NAVY}`);
      c += text(l.label, MARGIN + 6, y, { size: 9, bold: true, color: '#ffffff' });
      numbers(l, { size: 9, bold: true, color: '#ffffff' });
      y -= ROW + 10;
    }
  });
  ensure(ROW);
  c += text(footnote, MARGIN, y, { size: 7.5, italic: true, color: `#${MUTED}` });
  pages.push(c);

  // Nomor halaman di kaki setiap halaman.
  const total = pages.length;
  const done = pages.map((p, i) => p
    + line(MARGIN, PAGE.w - MARGIN, MARGIN - 4, `#${TINT}`)
    + text(company, MARGIN, MARGIN - 16, { size: 7.5, color: `#${MUTED}` })
    + text(`Halaman ${i + 1} dari ${total}`, PAGE.w - MARGIN, MARGIN - 16, { size: 7.5, color: `#${MUTED}`, align: 'right' }));
  saveBlob(buildPdf(done, { title: `${title} ${company}` }), filename);
}

// ---------------- CSV ----------------
export function exportStatementCsv({ filename, title, company, period, headers, groups, compare, lines }) {
  const row = (code, label, l) => (l.vals
    ? [code, label, ...l.vals.map(round2)]
    : [code, label, round2(l.a), ...(compare ? [round2(l.b), diffOf(l), ratioOf(l) == null ? '' : `${Math.round(ratioOf(l) * 100)}%`] : [])]);
  // Judul kelompok kolom ikut ke nama kolom: "Saldo awal - Debit".
  let gi = 0;
  const groupOf = (groups ?? []).flatMap((g) => Array.from({ length: g.span }, () => g.label));
  const head = groups ? headers.map((h, i) => (i < 2 ? h : `${groupOf[gi++]} - ${h}`)) : headers;
  const body = lines.map((l) => {
    if (l.type === 'section') return ['', l.label];
    if (l.type === 'account') return row(l.code, `    ${l.label}`, l);
    return row('', l.label, l);
  });
  downloadCsv(filename, [[company], [title], [period], [], head, ...body]);
}
