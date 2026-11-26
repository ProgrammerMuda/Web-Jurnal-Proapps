// Susun PO / SPK menjadi PDF satu halaman yang bisa diunduh dan dikirim ke vendor.
// Kerangkanya (kepala surat, pita data, panel, tanda tangan, kaki halaman) dipakai
// bersama FPPBJ — lihat docPdf.js.
import { buildPdf, line, roundRect, saveBlob, text, wrap } from '@/lib/pdf.js';
import { terbilang } from '@/lib/terbilang.js';
import { COMPANY } from '@/lib/company.js';
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
import { personName, personTitle } from './data.js';
import {
  advancePct,
  effectivePoTerm,
  approverFor,
  bankLine,
  formatDate,
  poAllJasa,
  poDpAmount,
  poDocLabel,
  poPpn,
  poSubtotal,
  poTotal,
  ppnLabel,
  termParts,
  vendorEmail,
} from './utils.js';

// Kolom tabel. QTY dan SATUAN dipisah supaya angkanya rata kanan sebagai angka,
// sementara satuannya terbaca sebagai kata.
const COL = {
  no: M,
  desc: M + 26,
  qty: 352,
  unit: 362,
  price: 468,
  amount: RIGHT,
};

// Ketentuan baku yang ikut tercetak. Kalimatnya menyesuaikan jenis dokumen: PO
// mengatur pengiriman barang, SPK mengatur penyelesaian pekerjaan.
const ketentuanFor = (isJasa, label) => [
  `Cantumkan nomor ${label} pada surat jalan dan faktur.`,
  isJasa
    ? 'Pekerjaan diselesaikan paling lambat pada tanggal target selesai di atas.'
    : 'Barang dikirim ke gudang tujuan di atas, paling lambat tanggal perkiraan tiba.',
  isJasa
    ? 'Pekerjaan yang tidak sesuai lingkup akan diperbaiki tanpa biaya tambahan.'
    : 'Barang yang tidak sesuai spesifikasi akan dikembalikan.',
  `Faktur pajak atas nama dan NPWP ${COMPANY.name}.`,
];

export function poPdfBlob(po, { vendor, fppbj, warehouse } = {}) {
  const label = poDocLabel(po);
  const isJasa = poAllJasa(po);
  const pph = Math.round(po.items.reduce((n, i) => n + i.qty * i.price * (i.pphRate ?? 0), 0));
  const term = effectivePoTerm(po);
  const termin = termParts(term);
  const dpPct = advancePct(term);
  // Katalog memisahkan nama dan penjelasan termin dengan em dash ("CAD — bayar setelah
  // diterima"); dokumen lama memakai titik tengah. Dua-duanya diterima di sini.
  const [terminUtama, ...terminLain] = termin.label.split(/\s+[\u2014\u2013\u00b7]\s+/);
  const terminSisa = terminLain.join(' \u00b7 ');
  let c = '';

  // --- kepala surat ---
  // PO/SPK berlaku sejak dibuat; mengirimnya ke vendor opsional, jadi tidak ada lencana draf.
  const kepala = docHeader({
    title: label === 'SPK' ? 'SURAT PERINTAH KERJA' : 'PURCHASE ORDER',
    number: po.number,
    subtitle: `NPWP ${COMPANY.npwp} - Telp ${COMPANY.phone}`,
    status: null,
  });
  c += kepala.c;
  let y = kepala.y - 18;

  // --- pita data ---
  const pita = metaStrip(
    [
      { label: `TANGGAL ${label}`, value: formatDate(po.date) },
      { label: isJasa ? 'TARGET SELESAI' : 'PERKIRAAN TIBA', value: formatDate(po.expectedAt) },
      {
        label: 'TERMIN BAYAR',
        // Nama termin di katalog kadang sudah memuat penjelasannya ("CAD · bayar setelah
        // diterima"). Kata kuncinya saja yang jadi nilai; sisanya turun jadi keterangan.
        value: terminUtama,
        sub: [terminSisa, termin.detail].filter(Boolean).join(' \u00b7 '),
      },
      fppbj
        ? { label: 'NO. PERMINTAAN', value: fppbj.number }
        : { label: 'NO. PERMINTAAN', value: 'Tidak ada', muted: true },
    ],
    y,
  );
  c += pita.c;
  y = pita.y - 18;

  // --- panel vendor & tujuan kirim ---
  const panelVendor = {
    label: 'VENDOR',
    title: vendor?.name ?? '-',
    rows: [
      ['PIC', vendor?.pic],
      ['Email', vendorEmail(vendor)],
      ['Telepon', vendor?.phone],
      ['NPWP', vendor?.npwp],
      ['Rekening', vendor && bankLine(vendor)],
    ],
  };
  // SPK tidak dikirim ke gudang, jadi panel keduanya diganti lingkup pekerjaan.
  const panelKanan = isJasa
    ? {
        label: 'PEKERJAAN',
        title: `${po.items.length} lingkup pekerjaan`,
        rows: [
          ['Target selesai', formatDate(po.expectedAt)],
          ['Termin', termin.label],
        ],
      }
    : {
        label: 'KIRIM KE',
        title: warehouse?.name ?? 'Belum ditentukan',
        // Alamat gudang ikut tercetak supaya vendor tahu persis ke mana barang dikirim.
        rows: [
          ['Kode gudang', warehouse?.code],
          ['Alamat', warehouse?.address],
          ['Kota', [warehouse?.city, warehouse?.postalCode].filter(Boolean).join(' ')],
          ['PIC gudang', warehouse?.picName],
          ['Telepon', warehouse?.phone],
          ['Tanggal', formatDate(po.expectedAt)],
        ],
      };
  const blok = panels([panelVendor, panelKanan], y);
  c += blok.c;
  y = blok.y - 30;

  // --- tabel item ---
  const kepalaTabel = tableHead(
    [
      { label: 'NO', x: COL.no },
      { label: 'BARANG ATAU JASA', x: COL.desc },
      { label: 'QTY', x: COL.qty, align: 'right' },
      { label: 'SATUAN', x: COL.unit },
      { label: 'HARGA SATUAN', x: COL.price, align: 'right' },
      { label: 'JUMLAH', x: COL.amount, align: 'right' },
    ],
    y,
  );
  c += kepalaTabel.c;
  y = kepalaTabel.y;

  const lebarDesc = COL.qty - COL.desc - 30;
  po.items.forEach((it, i) => {
    const desc = wrap(it.desc, lebarDesc, 9.5);
    const spec = it.spec ? wrap(it.spec, lebarDesc, 8) : [];

    c += text(String(i + 1), COL.no, y, { size: 9.5, color: C.label });
    c += text(String(it.qty), COL.qty, y, { size: 9.5, align: 'right', color: C.ink });
    c += text(it.unit ?? '', COL.unit, y, { size: 9.5, color: C.ink });
    c += text(rp(it.price), COL.price, y, { size: 9.5, align: 'right', color: C.ink });
    c += text(rp(it.qty * it.price), COL.amount, y, { size: 9.5, bold: true, align: 'right', color: C.ink });

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

  // --- ringkasan biaya (kanan) & terbilang + ketentuan (kiri) ---
  const kananX = 330;
  const atasRingkasan = y + 6;
  const rows = [
    ['DPP', rp(poSubtotal(po))],
    [ppnLabel(po.items), rp(poPpn(po))],
    ...(pph > 0 ? [['Potongan PPh (saat bayar)', `-${rp(pph)}`]] : []),
    ...(dpPct > 0
      ? [[dpPct >= 100 ? 'Dibayar di muka' : `Uang muka ${dpPct}%`, rp(poDpAmount(po))]]
      : []),
  ];
  let ry = atasRingkasan;
  rows.forEach(([k, v]) => {
    c += text(k, kananX + 16, ry, { size: 9, color: C.label });
    c += text(v, RIGHT, ry, { size: 9, align: 'right', color: C.ink });
    ry -= 16;
  });
  ry -= 2;
  c += roundRect(kananX, ry - 24, RIGHT - kananX, 32, 6, C.primary);
  c += text(`Total ${label}`, kananX + 16, ry - 7, { size: 10.5, bold: true, color: C.onPrimary });
  c += text(rp(poTotal(po)), RIGHT - 16, ry - 7, { size: 12, bold: true, align: 'right', color: C.onPrimary });
  const bawahRingkasan = ry - 24;

  // Kiri: terbilang lalu ketentuan.
  let ly = atasRingkasan;
  c += text('TERBILANG', M, ly, { size: 7, bold: true, color: C.label });
  ly -= 16;
  wrap(terbilang(poTotal(po)), kananX - M - 20, 9.5).forEach((row) => {
    c += text(row, M, ly, { size: 9.5, italic: true, color: C.ink });
    ly -= 13;
  });
  ly -= 10;
  c += text('KETENTUAN', M, ly, { size: 7, bold: true, color: C.label });
  ly -= 15;

  // Tinggi daftar ketentuan diukur dulu. Blok tanda tangan dipaku di bawah halaman,
  // jadi dokumen berisi banyak baris bisa menabraknya — itu yang terjadi pada SPK empat
  // termin. Kalau ukuran biasa tidak muat, hurufnya dirapatkan sebelum tata letaknya
  // dibiarkan bertabrakan.
  const ketentuan = ketentuanFor(isJasa, label);
  const lebarKetentuan = kananX - M - 36;
  const ukur = (size, leading) =>
    ketentuan.reduce((n, isi) => n + wrap(isi, lebarKetentuan, size).length * leading + 4, 0);
  const SIGN_MIN = 172; // batas bawah blok tanda tangan sebelum menyentuh kaki halaman
  const muat = (size, leading) => ly - ukur(size, leading) - 22 >= SIGN_MIN;
  const [sizeK, leadingK] = muat(8.5, 11) ? [8.5, 11] : [7.5, 9.5];

  ketentuan.forEach((isi, i) => {
    const baris = wrap(isi, lebarKetentuan, sizeK);
    c += text(`${i + 1}.`, M + 2, ly, { size: sizeK, color: C.label });
    baris.forEach((row, n) => {
      c += text(row, M + 18, ly - n * leadingK, { size: sizeK, color: C.ink });
    });
    ly -= baris.length * leadingK + 4;
  });

  y = Math.min(ly, bawahRingkasan) - 20;
  if (po.ppnIncluded) {
    c += text('Harga penawaran sudah termasuk PPN.', RIGHT, y, { size: 8, color: C.muted, align: 'right' });
    y -= 16;
  }

  // --- catatan ---
  if (po.note) {
    c += roundRect(M, y - 10, W, 4, 2, C.primary);
    const baris = wrap(po.note, W - 28, 8.5);
    baris.forEach((row, n) => {
      c += text(row, M + 14, y - n * 11, { size: 8.5, color: C.ink });
    });
  }

  // --- tanda tangan & kaki halaman ---
  // Nama penyetuju dan penerima sengaja kosong bila belum ada orangnya: baris itu
  // memang untuk diisi tangan, dan mencetak nama yang belum menyetujui itu menyesatkan.
  // Blok tanda tangan turun mengikuti isi bila halamannya longgar, dan berhenti di
  // SIGN_MIN supaya tidak menindih kaki halaman.
  const signY = Math.max(SIGN_MIN, Math.min(196, Math.min(ly, bawahRingkasan) - 22));
  c += signatures(
    [
      { label: 'DIBUAT OLEH', name: personName('accounting'), role: personTitle('accounting') },
      { label: 'DISETUJUI OLEH', name: '', role: approverFor(poTotal(po)) },
      { label: 'DITERIMA VENDOR', name: vendor?.pic ?? '', role: vendor?.name ?? '' },
    ],
    { y: signY },
  );
  c += pageFooter(po.number);
  return buildPdf(c, { title: `${label} ${po.number}` });
}

// Unduh PO / SPK sebagai PDF, mis. PO-2026-11-0001.pdf
export function downloadPo(po, meta) {
  saveBlob(poPdfBlob(po, meta), `${po.number.replace(/\//g, '-')}.pdf`);
}
