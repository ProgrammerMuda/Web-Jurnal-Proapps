// Ekspor Buku Besar ke PDF, Excel (.xlsx), dan CSV. Bentuknya sama dengan layar: per kategori,
// per akun (judul akun, saldo awal, jurnal dengan saldo berjalan, saldo akhir). Warna dan kop
// mengikuti ekspor laporan lain (statementExport.js); kolomnya berbeda (tiga kolom teks), jadi
// dibuat terpisah.
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
const accountTitle = (a) => `${a.code ? `${a.code}  ` : ''}${a.name}`;

// ---------------- Excel ----------------
export function exportLedgerXlsx({ filename, title, company, period, headers, openingLabel, groups, describe, formatDate, footnote }) {
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
  rows.push({ height: 22, cells: headers.map((h, i) => ({ v: h, s: hs(i >= 3 ? 'right' : 'left') })) });
  const headRows = rows.length;
  const merges = ['A1:F1', 'A2:F2', 'A3:F3'];
  const mergeRow = (from, to) => merges.push(`${from}${rows.length}:${to}${rows.length}`);
  const n = (v, s) => ({ v: round2(v), s: { ...s, numFmt: NUM, align: 'right' } });

  groups.forEach((g) => {
    const sec = { fill: TINT, color: NAVY, bold: true, size: 11 };
    rows.push({ height: 22, cells: head(g.label.toUpperCase(), sec) });
    mergeRow('A', 'F');
    g.accounts.forEach((a) => {
      const acc = { fill: PALE, color: NAVY, bold: true, border: { top: 'thin' }, borderColor: BLUE };
      rows.push({ height: 20, cells: head(accountTitle(a), acc) });
      mergeRow('A', 'F');
      const op = { color: MUTED, italic: true };
      rows.push({ cells: [{ v: openingLabel, s: op }, { s: op }, { s: op }, { s: op }, { s: op }, n(a.opening, { color: INK, bold: true })] });
      mergeRow('A', 'E');
      a.rows.forEach(({ entry: e, line: l, saldo }) => {
        const s = { color: INK, border: { bottom: 'thin' }, borderColor: 'E2E8F0' };
        rows.push({
          cells: [
            { v: formatDate(e.date), s },
            { v: `#${e.no}`, s: { ...s, color: NAVY } },
            { v: l.memo ? `${describe(e)} - ${l.memo}` : describe(e), s },
            n(l.debit, s),
            n(l.credit, s),
            n(saldo, s),
          ],
        });
      });
      const tot = { bold: true, color: NAVY, fill: PALE, border: { top: 'thin', bottom: 'thin' }, borderColor: BLUE };
      rows.push({ height: 20, cells: [{ v: `Saldo akhir ${a.name}`, s: { ...tot, align: 'right' } }, { s: tot }, { s: tot }, n(a.debit, tot), n(a.credit, tot), n(a.closing, tot)] });
      mergeRow('A', 'C');
      rows.push({ height: 8, cells: [] });
    });
  });
  rows.push({ cells: [{ v: footnote, s: { italic: true, color: MUTED, size: 9 } }] });

  downloadXlsx(filename, {
    sheet: title,
    title: `${title} ${company}`,
    columns: [12, 13, 60, 18, 18, 20].map((width) => ({ width })),
    rows,
    merges,
    freezeRows: headRows,
  });
}

// ---------------- PDF ----------------
const MARGIN = 40;
const ROW = 16;

export function exportLedgerPdf({ filename, title, company, period, headers, openingLabel, groups, describe, formatDate, num, footnote }) {
  const W = PAGE.w - MARGIN * 2;
  const widths = [54, 44, 193, 74, 74, 76];
  const xs = widths.reduce((acc, w, i) => [...acc, acc[i] + w], [MARGIN]);
  const right = (i) => xs[i + 1] - 5;
  const fit = (s, width, size) => {
    let t = String(s ?? '');
    if (textWidth(t, size) <= width) return t;
    while (t.length > 1 && textWidth(`${t}...`, size) > width) t = t.slice(0, -1);
    return `${t}...`;
  };
  const red = (v) => ((v ?? 0) < -0.005 ? '#b91c1c' : undefined);
  const dash = (v) => (Math.round(v ?? 0) === 0 ? '-' : num(v));

  const pages = [];
  let c = '';
  let y = 0;
  const tableHead = () => {
    c += rect(MARGIN, y - 6, W, ROW + 2, `#${BLUE}`);
    headers.forEach((h, i) => {
      const opt = { size: 8, bold: true, color: '#ffffff' };
      c += i >= 3 ? text(h, right(i), y, { ...opt, align: 'right' }) : text(h, xs[i] + 5, y, opt);
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
  groups.forEach((g) => {
    ensure(ROW * 4);
    y -= 4;
    c += rect(MARGIN, y - 6, W, ROW + 2, `#${TINT}`);
    c += text(g.label.toUpperCase(), MARGIN + 5, y, { size: 8.5, bold: true, color: `#${NAVY}` });
    y -= ROW + 2;
    g.accounts.forEach((a) => {
      // Judul akun tidak ditinggal sendirian di kaki halaman: minimal saldo awal ikut.
      ensure(ROW * 3);
      c += rect(MARGIN, y - 6, W, ROW, `#${PALE}`);
      c += rect(MARGIN, y - 6 + ROW - 0.8, W, 0.8, `#${BLUE}`);
      c += text(fit(accountTitle(a), W - 10, 8.5), MARGIN + 5, y, { size: 8.5, bold: true, color: `#${NAVY}` });
      y -= ROW;
      c += text(openingLabel, MARGIN + 5, y, { size: 8, italic: true, color: `#${MUTED}` });
      c += text(num(a.opening), right(5), y, { size: 8, bold: true, align: 'right', color: red(a.opening) });
      c += line(MARGIN, MARGIN + W, y - 6, '#e2e8f0');
      y -= ROW;
      a.rows.forEach(({ entry: e, line: l, saldo }) => {
        ensure(ROW);
        c += text(formatDate(e.date), xs[0] + 5, y, { size: 7.5, color: `#${INK}` });
        c += text(`#${e.no}`, xs[1] + 5, y, { size: 7.5, bold: true, color: `#${NAVY}` });
        c += text(fit(l.memo ? `${describe(e)} - ${l.memo}` : describe(e), widths[2] - 10, 7.5), xs[2] + 5, y, { size: 7.5, color: `#${INK}` });
        c += text(dash(l.debit), right(3), y, { size: 7.5, align: 'right' });
        c += text(dash(l.credit), right(4), y, { size: 7.5, align: 'right' });
        c += text(num(saldo), right(5), y, { size: 7.5, align: 'right', color: red(saldo) });
        c += line(MARGIN, MARGIN + W, y - 6, '#eef2f7');
        y -= ROW;
      });
      ensure(ROW);
      c += rect(MARGIN, y - 6, W, ROW, `#${PALE}`);
      c += text(fit(`Saldo akhir ${a.name}`, xs[3] - MARGIN - 10, 8), xs[3] - 5, y, { size: 8, bold: true, color: `#${NAVY}`, align: 'right' });
      c += text(dash(a.debit), right(3), y, { size: 8, bold: true, align: 'right', color: `#${NAVY}` });
      c += text(dash(a.credit), right(4), y, { size: 8, bold: true, align: 'right', color: `#${NAVY}` });
      c += text(num(a.closing), right(5), y, { size: 8, bold: true, align: 'right', color: red(a.closing) ?? `#${NAVY}` });
      y -= ROW + 8;
    });
  });
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
// Satu baris per jurnal dengan kode & nama akun di setiap baris, supaya mudah difilter di spreadsheet.
export function exportLedgerCsv({ filename, title, company, period, groups, describe, footnote }) {
  const head = ['Kategori', 'Kode akun', 'Nama akun', 'Tanggal', 'No. jurnal', 'Keterangan', 'Catatan', 'Debit', 'Kredit', 'Saldo'];
  const body = [];
  groups.forEach((g) => g.accounts.forEach((a) => {
    const base = [g.label, a.code ?? '', a.name];
    body.push([...base, '', '', 'Saldo awal', '', '', '', round2(a.opening)]);
    a.rows.forEach(({ entry: e, line: l, saldo }) => {
      body.push([...base, e.date, e.no, describe(e), l.memo ?? '', round2(l.debit), round2(l.credit), round2(saldo)]);
    });
    body.push([...base, '', '', 'Saldo akhir', '', round2(a.debit), round2(a.credit), round2(a.closing)]);
  }));
  downloadCsv(filename, [[company], [title], [period], [], head, ...body, [], [footnote]]);
}
