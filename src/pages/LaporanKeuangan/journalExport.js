// Ekspor Jurnal Umum ke PDF, Excel (.xlsx), dan CSV. Bentuknya sama dengan layar: per jurnal satu
// baris judul (tanggal, nomor, keterangan, modul), baris akun debit lalu kredit, total jurnal,
// dan total semua jurnal di akhir. Warna dan kop mengikuti ekspor Buku Besar (ledgerExport.js).
import { buildPdf, line, PAGE, rect, saveBlob, text, textWidth } from '@/lib/pdf.js';
import { downloadXlsx } from '@/lib/xlsx.js';
import { downloadCsv } from '@/pages/Kontak/utils.js';

const NAVY = '053079';
const BLUE = '1B4399';
const TINT = 'D9E5FB';
const PALE = 'EEF4FF';
const INK = '0F172A';
const MUTED = '64748B';
const round2 = (n) => Math.round((n ?? 0) * 100) / 100;
const accountText = (l) => `${l.code ? `${l.code}  ` : ''}${l.name}`;
const sumOf = (e, k) => e.lines.reduce((n, l) => n + l[k], 0);

// ---------------- Excel ----------------
export function exportJournalXlsx({ filename, title, company, period, headers, entries, totals, describe, formatDate, footnote }) {
  const NUM = '#,##0.00;[Red](#,##0.00);"-"';
  const ncol = headers.length;
  const rows = [];
  const band = (fill) => Array.from({ length: ncol }, () => ({ s: { fill } }));
  const head = (v, s) => { const r = band(s.fill); r[0] = { v, s }; return r; };
  rows.push({ height: 30, cells: head(company, { fill: NAVY, color: 'FFFFFF', bold: true, size: 15 }) });
  rows.push({ height: 22, cells: head(title, { fill: NAVY, color: 'FFFFFF', size: 12 }) });
  rows.push({ height: 20, cells: head(period, { fill: TINT, color: NAVY, italic: true }) });
  rows.push({ height: 8, cells: [] });
  const hs = (align) => ({ fill: BLUE, color: 'FFFFFF', bold: true, align, border: { bottom: 'medium' }, borderColor: NAVY });
  rows.push({ height: 22, cells: headers.map((h, i) => ({ v: h, s: hs(i >= 4 ? 'right' : 'left') })) });
  const headRows = rows.length;
  const merges = ['A1:F1', 'A2:F2', 'A3:F3'];
  const mergeRow = (from, to) => merges.push(`${from}${rows.length}:${to}${rows.length}`);
  const n = (v, s) => ({ v: round2(v), s: { ...s, numFmt: NUM, align: 'right' } });

  entries.forEach((e) => {
    const jh = { fill: PALE, color: NAVY, bold: true, border: { top: 'thin' }, borderColor: BLUE };
    rows.push({ height: 20, cells: [{ v: formatDate(e.date), s: jh }, { v: `#${e.no}`, s: jh }, { v: `${describe(e)}  [${e.module}]`, s: jh }, { s: jh }, { s: jh }, { s: jh }] });
    mergeRow('C', 'F');
    e.lines.forEach((l) => {
      const s = { color: INK, border: { bottom: 'thin' }, borderColor: 'E2E8F0' };
      rows.push({ cells: [{ s }, { s }, { v: accountText(l), s }, { v: l.memo ?? '', s: { ...s, color: MUTED } }, n(l.debit, s), n(l.credit, s)] });
    });
    const st = { bold: true, color: NAVY, border: { bottom: 'thin' }, borderColor: BLUE };
    rows.push({ cells: [{ s: st }, { s: st }, { s: st }, { v: `Total jurnal #${e.no}`, s: st }, n(sumOf(e, 'debit'), st), n(sumOf(e, 'credit'), st)] });
  });
  const tot = { bold: true, color: NAVY, fill: PALE, border: { top: 'medium', bottom: 'medium' }, borderColor: NAVY };
  rows.push({ height: 22, cells: [{ v: `Total ${entries.length} jurnal`, s: { ...tot, align: 'right' } }, { s: tot }, { s: tot }, { s: tot }, n(totals.debit, tot), n(totals.credit, tot)] });
  mergeRow('A', 'D');
  rows.push({ height: 8, cells: [] });
  rows.push({ cells: [{ v: footnote, s: { italic: true, color: MUTED, size: 9 } }] });

  downloadXlsx(filename, {
    sheet: title,
    title: `${title} ${company}`,
    columns: [12, 11, 48, 40, 18, 18].map((width) => ({ width })),
    rows,
    merges,
    freezeRows: headRows,
  });
}

// ---------------- PDF ----------------
const MARGIN = 40;
const ROW = 16;

export function exportJournalPdf({ filename, title, company, period, headers, entries, totals, describe, formatDate, num, footnote }) {
  const W = PAGE.w - MARGIN * 2;
  const widths = [52, 44, 175, 102, 71, 71];
  const xs = widths.reduce((acc, w, i) => [...acc, acc[i] + w], [MARGIN]);
  const right = (i) => xs[i + 1] - 5;
  const fit = (s, width, size) => {
    let t = String(s ?? '');
    if (textWidth(t, size) <= width) return t;
    while (t.length > 1 && textWidth(`${t}...`, size) > width) t = t.slice(0, -1);
    return `${t}...`;
  };
  const dash = (v) => (Math.round(v ?? 0) === 0 ? '-' : num(v));

  const pages = [];
  let c = '';
  let y = 0;
  const tableHead = () => {
    c += rect(MARGIN, y - 6, W, ROW + 2, `#${BLUE}`);
    headers.forEach((h, i) => {
      const opt = { size: 8, bold: true, color: '#ffffff' };
      c += i >= 4 ? text(h, right(i), y, { ...opt, align: 'right' }) : text(h, xs[i] + 5, y, opt);
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

  newPage(true);
  entries.forEach((e) => {
    // Satu jurnal tidak dipotong di tengah kalau masih muat satu halaman.
    ensure(ROW * Math.min(e.lines.length + 2, 12));
    c += rect(MARGIN, y - 6, W, ROW, `#${PALE}`);
    c += rect(MARGIN, y - 6 + ROW - 0.8, W, 0.8, `#${BLUE}`);
    c += text(formatDate(e.date), xs[0] + 5, y, { size: 8, bold: true, color: `#${INK}` });
    c += text(`#${e.no}`, xs[1] + 5, y, { size: 8, bold: true, color: `#${NAVY}` });
    const tag = `[${e.module}]`;
    const tagW = textWidth(tag, 7.5);
    c += text(fit(describe(e), xs[6] - xs[2] - tagW - 18, 8), xs[2] + 5, y, { size: 8, bold: true, color: `#${NAVY}` });
    c += text(tag, xs[6] - 5, y, { size: 7.5, color: `#${MUTED}`, align: 'right' });
    y -= ROW;
    e.lines.forEach((l) => {
      ensure(ROW);
      c += text(fit(accountText(l), widths[2] - 10, 7.5), xs[2] + 5, y, { size: 7.5, color: `#${INK}` });
      c += text(fit(l.memo ?? '', widths[3] - 10, 7), xs[3] + 5, y, { size: 7, color: `#${MUTED}` });
      c += text(dash(l.debit), right(4), y, { size: 7.5, align: 'right' });
      c += text(dash(l.credit), right(5), y, { size: 7.5, align: 'right' });
      c += line(MARGIN, MARGIN + W, y - 6, '#eef2f7');
      y -= ROW;
    });
    ensure(ROW);
    c += text(`Total jurnal #${e.no}`, xs[3] + 5, y, { size: 7.5, bold: true, color: `#${NAVY}` });
    c += text(num(sumOf(e, 'debit')), right(4), y, { size: 7.5, bold: true, align: 'right', color: `#${NAVY}` });
    c += text(num(sumOf(e, 'credit')), right(5), y, { size: 7.5, bold: true, align: 'right', color: `#${NAVY}` });
    y -= ROW + 4;
  });
  ensure(ROW * 2);
  c += rect(MARGIN, y - 6, W, ROW + 2, `#${TINT}`);
  c += text(`Total ${entries.length} jurnal`, xs[4] - 5, y, { size: 8.5, bold: true, color: `#${NAVY}`, align: 'right' });
  c += text(num(totals.debit), right(4), y, { size: 8.5, bold: true, align: 'right', color: `#${NAVY}` });
  c += text(num(totals.credit), right(5), y, { size: 8.5, bold: true, align: 'right', color: `#${NAVY}` });
  y -= ROW + 10;
  ensure(ROW);
  c += text(fit(footnote, W, 7.5), MARGIN, y, { size: 7.5, italic: true, color: `#${MUTED}` });
  pages.push(c);

  const total = pages.length;
  const done = pages.map((p, i) => p
    + line(MARGIN, PAGE.w - MARGIN, MARGIN - 4, `#${TINT}`)
    + text(company, MARGIN, MARGIN - 16, { size: 7.5, color: `#${MUTED}` })
    + text(`Halaman ${i + 1} dari ${total}`, PAGE.w - MARGIN, MARGIN - 16, { size: 7.5, color: `#${MUTED}`, align: 'right' }));
  saveBlob(buildPdf(done, { title: `${title} ${company}` }), filename);
}

// ---------------- CSV ----------------
// Satu baris per baris jurnal, dengan tanggal, nomor, dan keterangan jurnal di setiap baris.
export function exportJournalCsv({ filename, title, company, period, entries, totals, describe, footnote }) {
  const head = ['Tanggal', 'No. jurnal', 'Modul', 'Keterangan jurnal', 'Dokumen', 'Kode akun', 'Nama akun', 'Catatan', 'Debit', 'Kredit'];
  const body = entries.flatMap((e) => e.lines.map((l) => [
    e.date, e.no, e.module, describe(e), e.ref ?? '', l.code ?? '', l.name, l.memo ?? '', round2(l.debit), round2(l.credit),
  ]));
  const foot = ['', '', '', `Total ${entries.length} jurnal`, '', '', '', '', round2(totals.debit), round2(totals.credit)];
  downloadCsv(filename, [[company], [title], [period], [], head, ...body, foot, [], [footnote]]);
}
