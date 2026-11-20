// Susun FPPBJ (permintaan pembelian barang/jasa) menjadi PDF satu halaman untuk
// dilampirkan ke IOM dan ditandatangani. Kerangkanya dipakai bersama PO/SPK — lihat
// docPdf.js — supaya dokumen pembelian terlihat satu keluarga.
//
// Dokumen ini sengaja tanpa kolom harga: di tahap permintaan harganya memang belum ada,
// baru muncul dari penawaran vendor saat pengadaan. Halaman detailnya menyatakan hal yang
// sama, jadi PDF-nya tidak boleh memunculkan angka yang belum pernah disepakati.
import { buildPdf, line, roundRect, saveBlob, text, wrap } from '@/lib/pdf.js';
import {
  C,
  docHeader,
  M,
  metaStrip,
  pageFooter,
  panels,
  RIGHT,
  signatures,
  tableHead,
  W,
} from './docPdf.js';
import { personName, personTitle } from './data.js';
import { formatDate, FPPBJ_STATUS, iomFiles, requesterOf, routeLabel } from './utils.js';

const COL = { no: M, desc: M + 26, kind: 330, qty: 410, unit: 424 };

// Warna lencana mengikuti arti statusnya, bukan sekadar hiasan: yang berhenti merah,
// yang tuntas hijau, yang masih berjalan kuning.
const statusTone = (status) =>
  ['dibatalkan', 'dikembalikan'].includes(status)
    ? { bg: C.stopBg, ink: C.stopInk }
    : status === 'selesai'
      ? { bg: C.okBg, ink: C.okInk }
      : { bg: C.warnBg, ink: C.warnInk };

export function fppbjPdfBlob(f, { pos = [] } = {}) {
  const status = FPPBJ_STATUS[f.status]?.label ?? f.status;
  const berkas = iomFiles(f.iom);
  const peminta = requesterOf(f);
  // Peminta disimpan sebagai "Nama · Jabatan".
  const [pemintaNama, pemintaJabatan] = peminta.split(' · ');
  const adaJalur = !!(f.route || f.single?.on);
  let c = '';

  // --- kepala surat ---
  const kepala = docHeader({
    title: ['FORMULIR PERMINTAAN', 'PEMBELIAN BARANG / JASA'],
    number: f.number,
    subtitle: 'Dokumen internal',
    status: { label: status, ...statusTone(f.status) },
  });
  c += kepala.c;
  let y = kepala.y - 18;

  // --- pita data ---
  const pita = metaStrip(
    [
      { label: 'TANGGAL PERMINTAAN', value: formatDate(f.date) },
      {
        label: 'DIBUTUHKAN PADA',
        value: f.neededBy ? formatDate(f.neededBy) : 'Belum ditentukan',
        muted: !f.neededBy,
      },
      {
        label: 'JALUR PENGADAAN',
        value: adaJalur ? routeLabel(f) : 'Belum ditentukan',
        muted: !adaJalur,
      },
      {
        label: 'REFERENSI IOM',
        value: f.iom?.no || 'Tidak ada',
        muted: !f.iom?.no,
        sub: f.iom?.date ? formatDate(f.iom.date) : '',
      },
    ],
    y,
  );
  c += pita.c;
  y = pita.y - 18;

  // --- panel peminta & keperluan ---
  const blok = panels(
    [
      {
        label: 'PEMINTA',
        title: pemintaNama || '-',
        rows: [
          ['Jabatan', pemintaJabatan],
          ['Departemen', f.dept],
          ['Lampiran IOM', berkas.join(', ')],
        ],
      },
      {
        label: 'KEPERLUAN',
        title: f.purpose || '-',
        rows: [
          ['Alasan jalur', f.single?.on ? f.single.reason : ''],
          ['PO terkait', pos.map((p) => p.number).join(', ')],
          ['Catatan', f.note],
        ],
      },
    ],
    y,
  );
  c += blok.c;
  y = blok.y - 30;

  // --- tabel item ---
  const kepalaTabel = tableHead(
    [
      { label: 'NO', x: COL.no },
      { label: 'BARANG ATAU JASA', x: COL.desc },
      { label: 'JENIS', x: COL.kind },
      { label: 'QTY', x: COL.qty, align: 'right' },
      { label: 'SATUAN', x: COL.unit },
    ],
    y,
  );
  c += kepalaTabel.c;
  y = kepalaTabel.y;

  const lebarDesc = COL.kind - COL.desc - 24;
  f.items.forEach((it, i) => {
    const desc = wrap(it.desc, lebarDesc, 9.5);
    const spec = it.spec ? wrap(it.spec, lebarDesc, 8) : [];

    c += text(String(i + 1), COL.no, y, { size: 9.5, color: C.label });
    c += text(it.kind === 'jasa' ? 'Jasa' : 'Barang', COL.kind, y, { size: 9.5, color: C.ink });
    c += text(String(it.qty), COL.qty, y, { size: 9.5, align: 'right', color: C.ink });
    c += text(it.unit ?? '', COL.unit, y, { size: 9.5, color: C.ink });

    let dasar = y;
    desc.forEach((row, n) => {
      c += text(row, COL.desc, y - n * 12, { size: 9.5, bold: true, color: C.ink });
    });
    dasar -= (desc.length - 1) * 12;
    spec.forEach((row, n) => {
      c += text(row, COL.desc, dasar - 11 - n * 10, { size: 8, color: C.label });
    });
    if (spec.length) dasar -= 11 + (spec.length - 1) * 10;

    // Garis pemisah diukur dari baris teks terakhir, lalu baris berikutnya diberi jarak
    // lagi di bawah garis — kalau dibalik, hurufnya memotong garisnya sendiri.
    y = dasar - 14;
    c += line(M, RIGHT, y, C.border);
    y -= 20;
  });

  c += text(`${f.items.length} item diminta`, COL.desc, y, { size: 9.5, bold: true, color: C.ink });
  y -= 26;

  // --- keterangan harga ---
  const catatan =
    'Harga belum ditentukan pada tahap permintaan. Nilainya mengikuti penawaran vendor saat pengadaan.';
  const barisCatatan = wrap(catatan, W - 40, 8.5);
  const tinggi = barisCatatan.length * 12 + 18;
  c += roundRect(M, y - tinggi + 13, W, tinggi, 4, C.panelSoft);
  c += roundRect(M, y - tinggi + 13, 3, tinggi, 1.5, C.primary);
  barisCatatan.forEach((row, n) => {
    c += text(row, M + 18, y - n * 12, { size: 8.5, color: C.ink });
  });
  y -= tinggi + 6;

  // --- alasan berhenti ---
  // Permintaan yang dikembalikan atau dibatalkan dicetak dengan alasannya, supaya
  // lembar yang beredar tidak terbaca seolah masih berjalan.
  const stopNote =
    f.status === 'dikembalikan' ? f.returnNote : f.status === 'dibatalkan' ? f.cancelNote : null;
  if (stopNote) {
    y -= 14;
    const judul =
      f.status === 'dikembalikan' ? 'DIKEMBALIKAN OLEH ACCOUNTING' : 'PERMINTAAN DIBATALKAN';
    c += text(judul, M, y, { size: 7, bold: true, color: C.stopInk });
    wrap(stopNote, W, 8.5).forEach((row, n) => {
      c += text(row, M, y - 14 - n * 11, { size: 8.5, color: C.stopInk });
    });
  }

  // --- tanda tangan & kaki halaman ---
  // Nama penyetuju dan verifikator hanya dicetak kalau tahapnya memang sudah dilewati.
  // Baris itu untuk diisi tangan; mencetak nama yang belum menyetujui itu menyesatkan.
  const terverifikasi = ['diverifikasi', 'dalam_pengadaan', 'selesai'].includes(f.status);
  c += signatures([
    { label: 'DIAJUKAN OLEH', name: pemintaNama ?? '', role: pemintaJabatan ?? '' },
    {
      label: 'DISETUJUI OLEH',
      name: '',
      role: f.dept ? `Kepala Departemen ${f.dept}` : 'Atasan peminta',
    },
    {
      label: 'DIVERIFIKASI OLEH',
      name: terverifikasi ? personName('accounting') : '',
      role: personTitle('accounting'),
    },
  ]);
  c += pageFooter(f.number);
  return buildPdf(c, { title: `FPPBJ ${f.number}` });
}

// Unduh FPPBJ sebagai PDF, mis. FPPBJ-2026-11-0001.pdf
export function downloadFppbj(f, meta) {
  saveBlob(fppbjPdfBlob(f, meta), `${f.number.replace(/\//g, '-')}.pdf`);
}
