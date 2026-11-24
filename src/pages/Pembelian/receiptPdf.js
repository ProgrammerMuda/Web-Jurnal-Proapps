// Susun FPB (barang) / BAPP (jasa) menjadi PDF satu halaman untuk diarsipkan dan
// ditandatangani. Kerangkanya dipakai bersama PO/SPK dan FPPBJ — lihat docPdf.js.
//
// Dua dokumen ini berbagi berkas karena alurnya sama, tapi tabelnya sengaja berbeda,
// mengikuti cara form pencatatnya bekerja:
//
//   FPB barang — dicatat per qty. Berapa dipesan, berapa diterima, berapa ditolak;
//     penerimaan sebagian itu wajar, jadi ketiga angka itu memang informasi.
//   BAPP jasa  — dicatat per lingkup kerja atau per termin, dengan centang. Tidak ada
//     "separuh termin": satu pekerjaan diterima atau belum. Form "Catat BAPP" pun tidak
//     punya kolom qty maupun kolom ditolak. Jadi mencetak "Dipesan / Diterima / Ditolak"
//     di BAPP itu menyalin bentuk FPB ke dokumen yang tidak bekerja seperti itu —
//     angkanya selalu sama dan kolom ditolaknya selalu nol.
import { buildPdf, line, roundRect, saveBlob, text, wrap } from '@/lib/pdf.js';
import {
  C,
  docHeader,
  M,
  metaStrip,
  pageFooter,
  panels,
  RIGHT,
  rp,
  signatures,
  tableHead,
  W,
} from './docPdf.js';
import { COMPANY } from '@/lib/company.js';
import { personName, personTitle, roleOf } from './data.js';
import { approvalState } from './permissions.js';
import { formatDate, rangeLabel, receiptConfirmed, vendorEmail } from './utils.js';

const COL_JASA = { no: M, desc: M + 26, value: 440, status: 460 };
const COL_BARANG = { no: M, desc: M + 26, ordered: 350, received: 430, rejected: RIGHT };

export function receiptPdfBlob(r, { vendor, po } = {}) {
  const isJasa = r.kind === 'jasa';
  const label = isJasa ? 'BAPP' : 'FPB';
  const confirmed = receiptConfirmed(r);
  const itemOf = (id) => po?.items.find((i) => i.id === id);
  let c = '';

  // --- kepala surat ---
  // BAPP yang belum disetujui wajib terlihat berbeda: selama approval belum genap,
  // dokumennya belum bisa difaktur.
  const kepala = docHeader({
    title: isJasa
      ? ['BERITA ACARA', 'PEMERIKSAAN PEKERJAAN']
      : 'FORMULIR PENERIMAAN BARANG',
    number: r.number,
    subtitle: `NPWP ${COMPANY.npwp} - Telp ${COMPANY.phone}`,
    status: confirmed
      ? { label: 'Disetujui', bg: C.okBg, ink: C.okInk }
      : { label: 'Draf - menunggu persetujuan', bg: C.warnBg, ink: C.warnInk },
  });
  c += kepala.c;
  let y = kepala.y - 18;

  // --- pita data ---
  // Tanggal jurnal hanya disebut kalau memang beda dari tanggal dokumen. Itu terjadi pada
  // termin berkala: bebannya milik periode yang di-BAPP, bukan hari dokumennya diketik.
  const bedaJurnal = r.journalDate && r.journalDate !== r.date;
  const pita = metaStrip(
    [
      { label: isJasa ? 'TANGGAL BAPP' : 'TANGGAL TERIMA', value: formatDate(r.date) },
      {
        label: isJasa ? 'NO. BAPP VENDOR' : 'NO. SURAT JALAN',
        value: r.doNumber || 'Tidak ada',
        muted: !r.doNumber,
      },
      {
        label: 'DARI PESANAN',
        value: po?.number ?? 'Tidak ada',
        muted: !po,
      },
      bedaJurnal
        ? { label: 'TANGGAL JURNAL', value: formatDate(r.journalDate), sub: 'Periode pengakuan beban' }
        : { label: 'DICATAT OLEH', value: (r.createdBy ?? '-').split(' · ')[0] },
    ],
    y,
  );
  c += pita.c;
  y = pita.y - 18;

  // --- panel vendor & pemeriksaan ---
  const ap = approvalState(r, isJasa ? 'bapp' : 'fpb', { settled: confirmed });
  const penyetuju = ap.chain
    .map((peran) => (ap.got[peran] ? `${roleOf(peran)?.label} (sudah)` : `${roleOf(peran)?.label} (menunggu)`))
    .join(', ');
  const blok = panels(
    [
      {
        label: 'VENDOR',
        title: vendor?.name ?? '-',
        rows: [
          ['PIC', vendor?.pic],
          ['Email', vendorEmail(vendor)],
          ['Telepon', vendor?.phone],
        ],
      },
      {
        label: isJasa ? 'PEMERIKSAAN' : 'PENERIMAAN',
        title: `${r.lines.length} ${isJasa ? 'lingkup pekerjaan' : 'baris barang'}`,
        rows: [
          ['Dicatat oleh', r.createdBy],
          ['Persetujuan', penyetuju],
          ['Berkas', r.file || (isJasa ? 'Belum dilampirkan' : 'Tidak ada')],
        ],
      },
    ],
    y,
  );
  c += blok.c;
  y = blok.y - 30;

  // --- tabel ---
  const kolom = isJasa
    ? [
        { label: 'NO', x: COL_JASA.no },
        { label: 'LINGKUP PEKERJAAN', x: COL_JASA.desc },
        { label: 'NILAI', x: COL_JASA.value, align: 'right' },
        { label: 'STATUS', x: COL_JASA.status },
      ]
    : [
        { label: 'NO', x: COL_BARANG.no },
        { label: 'BARANG', x: COL_BARANG.desc },
        { label: 'DIPESAN', x: COL_BARANG.ordered, align: 'right' },
        { label: 'DITERIMA', x: COL_BARANG.received, align: 'right' },
        { label: 'DITOLAK', x: COL_BARANG.rejected, align: 'right' },
      ];
  const kepalaTabel = tableHead(kolom, y);
  c += kepalaTabel.c;
  y = kepalaTabel.y;

  const lebarDesc = (isJasa ? COL_JASA.value : COL_BARANG.ordered) - (M + 26) - 30;
  let nilaiTotal = 0;
  let qtyDiterima = 0;
  let qtyDitolak = 0;

  r.lines.forEach((l, i) => {
    const it = itemOf(l.itemId);
    const desc = wrap(it?.desc ?? l.itemId, lebarDesc, 9.5);
    // Termin berkala membawa rentang periodenya; lingkup biasa membawa spesifikasinya.
    const sub = it?.periodFrom ? rangeLabel({ from: it.periodFrom, to: it.periodTo }) : it?.spec;
    const subRows = sub ? wrap(sub, lebarDesc, 8) : [];
    const unit = it?.unit ?? '';

    c += text(String(i + 1), COL_JASA.no, y, { size: 9.5, color: C.label });
    if (isJasa) {
      const nilai = (it?.qty ?? 0) * (it?.price ?? 0);
      nilaiTotal += nilai;
      c += text(rp(nilai), COL_JASA.value, y, { size: 9.5, align: 'right', color: C.ink });
      c += text('Diterima', COL_JASA.status + 18, y, { size: 9.5, bold: true, color: C.okInk });
    } else {
      qtyDiterima += l.qty;
      qtyDitolak += l.rejected || 0;
      c += text(`${it?.qty ?? '-'} ${unit}`.trim(), COL_BARANG.ordered, y, { size: 9.5, align: 'right', color: C.label });
      c += text(`${l.qty} ${unit}`.trim(), COL_BARANG.received, y, { size: 9.5, bold: true, align: 'right', color: C.ink });
      c += text(String(l.rejected || 0), COL_BARANG.rejected, y, {
        size: 9.5,
        align: 'right',
        color: l.rejected ? C.stopInk : C.label,
      });
    }

    let dasar = y;
    desc.forEach((row, n) => {
      c += text(row, COL_JASA.desc, y - n * 12, { size: 9.5, bold: true, color: C.ink });
    });
    dasar -= (desc.length - 1) * 12;
    subRows.forEach((row, n) => {
      c += text(row, COL_JASA.desc, dasar - 11 - n * 10, { size: 8, color: C.label });
    });
    if (subRows.length) dasar -= 11 + (subRows.length - 1) * 10;

    // Garis pemisah diukur dari baris teks terakhir, lalu baris berikutnya diberi jarak
    // lagi di bawah garis — kalau dibalik, hurufnya memotong garisnya sendiri.
    y = dasar - 14;
    c += line(M, RIGHT, y, C.border);
    y -= 20;
  });

  // --- ringkasan ---
  if (isJasa) {
    const bandLeft = 330;
    c += roundRect(bandLeft, y - 20, RIGHT - bandLeft, 30, 6, C.primary);
    c += text('Nilai pekerjaan diterima', bandLeft + 14, y - 4, { size: 9.5, bold: true, color: C.onPrimary });
    c += text(rp(nilaiTotal), RIGHT - 14, y - 4, { size: 11.5, bold: true, align: 'right', color: C.onPrimary });
    y -= 20;
  } else {
    c += text('Total diterima', COL_BARANG.ordered, y, { size: 9.5, bold: true, color: C.label, align: 'right' });
    c += text(String(qtyDiterima), COL_BARANG.received, y, { size: 9.5, bold: true, align: 'right', color: C.ink });
    c += text(String(qtyDitolak), COL_BARANG.rejected, y, {
      size: 9.5,
      bold: true,
      align: 'right',
      color: qtyDitolak ? C.stopInk : C.ink,
    });
    y -= 8;
    if (qtyDitolak > 0) {
      y -= 14;
      c += text('Qty ditolak tidak dihitung sebagai diterima; sisa pesanan tetap terbuka.', RIGHT, y, {
        size: 8,
        color: C.muted,
        align: 'right',
      });
    }
  }

  // --- catatan ---
  y -= 26;
  if (r.note) {
    const baris = wrap(r.note, W - 40, 8.5);
    const tinggi = baris.length * 12 + 18;
    c += roundRect(M, y - tinggi + 13, W, tinggi, 4, C.panelSoft);
    c += roundRect(M, y - tinggi + 13, 3, tinggi, 1.5, C.primary);
    baris.forEach((row, n) => {
      c += text(row, M + 18, y - n * 12, { size: 8.5, color: C.ink });
    });
    y -= tinggi + 6;
  }

  // --- tanda tangan & kaki halaman ---
  // Nama penyetuju hanya dicetak kalau approval-nya memang sudah dibubuhkan. Pada BAPP
  // itu penting: dokumen yang belum disetujui tidak boleh terbaca seolah sudah.
  const pemeriksa = (r.createdBy ?? '').split(' · ');
  const kolomTtd = isJasa
    ? [
        { label: 'DIPERIKSA OLEH', name: pemeriksa[0] ?? '', role: pemeriksa[1] ?? '' },
        {
          label: 'DISETUJUI OLEH',
          name: ap.complete ? personName('bm') : '',
          role: personTitle('bm'),
        },
        { label: 'DISERAHKAN VENDOR', name: vendor?.pic ?? '', role: vendor?.name ?? '' },
      ]
    : [
        { label: 'DITERIMA OLEH', name: pemeriksa[0] ?? '', role: pemeriksa[1] ?? '' },
        { label: 'DISETUJUI OLEH', name: ap.complete ? personName('bm') : '', role: personTitle('bm') },
        { label: 'DISERAHKAN VENDOR', name: vendor?.pic ?? '', role: vendor?.name ?? '' },
      ];
  const signY = Math.max(172, Math.min(196, y - 22));
  c += signatures(kolomTtd, { y: signY });
  c += pageFooter(r.number);
  return buildPdf(c, { title: `${label} ${r.number}` });
}

// Unduh FPB / BAPP sebagai PDF, mis. BAPP-2026-11-0004.pdf
export function downloadReceipt(r, meta) {
  saveBlob(receiptPdfBlob(r, meta), `${r.number.replace(/\//g, '-')}.pdf`);
}
