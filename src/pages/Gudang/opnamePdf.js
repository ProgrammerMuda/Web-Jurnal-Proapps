// Susun Berita Acara Stok Opname menjadi PDF satu halaman untuk diarsipkan dan
// ditandatangani. Kerangkanya sama persis dengan dokumen pembelian — lihat
// src/pages/Pembelian/docPdf.js — supaya seluruh berkas yang keluar dari aplikasi
// ini terbaca sebagai satu keluarga dokumen, bukan hasil cetak halaman web.
//
// Yang dicetak hanya baris yang SELISIH. Berita acara adalah dokumen pertanggung-
// jawaban atas penyesuaian stok; produk yang hitungannya cocok tidak menimbulkan
// penyesuaian, jadi mencetaknya hanya menambah halaman tanpa menambah bukti.
// Jumlah produk yang dihitung tetap disebut di panel, supaya cakupannya terbukti.
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
} from '@/pages/Pembelian/docPdf.js';
import { COMPANY } from '@/lib/company.js';
import { personTitle } from '@/pages/Pembelian/data.js';
import { formatDate } from '@/pages/Pembelian/utils.js';
import { unitName } from '@/pages/Produk/catalog.js';
import { accountLabel } from './journal.js';
import { picName } from './data.js';
import { accountOfLine, diffQty, diffValue, isCounted, opnameSummary, reasonLabel } from './opname.js';

const num = (n) => Number(n ?? 0).toLocaleString('id-ID');
// Nilai yang bisa minus ditulis seperti di layar: tanda di depan "Rp", bukan di
// dalamnya. rp() bawaan dokumen pembelian hanya dipakai untuk nilai positif.
const rpSigned = (n) => (Number(n) < 0 ? `-${rp(-n)}` : rp(n));
const signed = (n) => (n > 0 ? `+${num(n)}` : num(n));

// Kolom tabel selisih; angkanya = tepi kanan tiap kolom yang rata kanan. Jaraknya
// disetel untuk kasus terburuk yang masuk akal — nilai sampai miliaran rupiah dan qty
// enam digit beserta satuannya — supaya kolom tidak pernah saling menimpa.
const COL = { produk: M, book: 348, count: 412, diff: 460, value: RIGHT };

/**
 * @param opname dokumen stok opname
 * @param ctx    { warehouse, products, units, accountMap, scope }
 */
export function opnamePdfBlob(opname, { warehouse, products = [], units = [], accountMap, scope } = {}) {
  const s = opnameSummary(opname);
  const posted = opname.status === 'posted';
  const cancelled = opname.status === 'cancelled';
  const productOf = (id) => products.find((p) => p.id === id);
  const satuanOf = (id) => {
    const p = productOf(id);
    return unitName(units, p?.baseUnitId ?? p?.buyUnitId);
  };
  const selisih = (opname.lines ?? []).filter((l) => isCounted(l) && diffQty(l) !== 0);
  const eventOf = (action) => (opname.history ?? []).find((h) => h.action === action);
  let c = '';

  // --- kepala surat ---
  // Dokumen yang belum diposting harus terlihat berbeda: penyesuaiannya belum
  // menyentuh stok maupun buku besar, jadi belum boleh terbaca sebagai bukti.
  const kepala = docHeader({
    title: ['BERITA ACARA', 'STOK OPNAME'],
    number: opname.number,
    subtitle: `NPWP ${COMPANY.npwp} - Telp ${COMPANY.phone}`,
    status: posted
      ? { label: 'Diposting', bg: C.okBg, ink: C.okInk }
      : cancelled
        ? { label: 'Dibatalkan', bg: C.stopBg, ink: C.stopInk }
        : { label: 'Belum diposting', bg: C.warnBg, ink: C.warnInk },
  });
  c += kepala.c;
  let y = kepala.y - 18;

  // --- pita data ---
  const pita = metaStrip(
    [
      { label: 'TANGGAL HITUNG', value: formatDate(opname.date) },
      { label: 'GUDANG', value: warehouse?.name ?? opname.warehouseId, sub: warehouse?.code },
      { label: 'CAKUPAN', value: scope ?? 'Semua produk di gudang ini' },
      opname.postedAt
        ? { label: 'TANGGAL POSTING', value: formatDate(opname.postedAt.slice(0, 10)) }
        : { label: 'STATUS', value: 'Penyesuaian belum diposting', muted: true },
    ],
    y,
  );
  c += pita.c;
  y = pita.y - 18;

  // --- panel pelaksanaan & hasil ---
  const blok = panels(
    [
      {
        label: 'PELAKSANAAN',
        title: `${num(s.counted)} dari ${num(s.total)} produk dihitung`,
        rows: [
          ['Petugas hitung', picName(opname.counterUserId) ?? '-'],
          ['Dibuat oleh', opname.createdBy],
          ['Belum dihitung', s.uncounted > 0 ? `${num(s.uncounted)} produk` : 'Tidak ada'],
        ],
      },
      {
        label: 'HASIL',
        title: `${num(s.diffCount)} produk berselisih`,
        rows: [
          ['Lebih', `${num(s.gainQty)} unit - ${rp(s.gainValue)}`],
          ['Kurang', `${num(s.lossQty)} unit - ${rp(s.lossValue)}`],
          ['Net', rpSigned(s.netValue)],
        ],
      },
    ],
    y,
  );
  c += blok.c;
  y = blok.y - 30;

  // --- tabel selisih ---
  const kepalaTabel = tableHead(
    [
      { label: 'PRODUK YANG BERSELISIH', x: COL.produk },
      { label: 'SALDO BUKU', x: COL.book, align: 'right' },
      { label: 'QTY HITUNG', x: COL.count, align: 'right' },
      { label: 'SELISIH', x: COL.diff, align: 'right' },
      { label: 'NILAI', x: COL.value, align: 'right' },
    ],
    y,
  );
  c += kepalaTabel.c;
  y = kepalaTabel.y;

  const lebarProduk = COL.book - M - 60;
  if (selisih.length === 0) {
    c += text('Tidak ada selisih. Seluruh hitungan cocok dengan saldo buku.', M, y, {
      size: 9.5,
      color: C.label,
    });
    y -= 14;
    c += line(M, RIGHT, y, C.border);
    y -= 20;
  }

  selisih.forEach((l) => {
    const unit = satuanOf(l.productId);
    const nama = wrap(productOf(l.productId)?.name ?? l.productId, lebarProduk, 9.5);
    // Alasan, catatan, dan akun penampung jadi baris kecil di bawah nama produknya.
    // Ketiganya keterangan atas satu baris yang sama, bukan kolom yang berdiri sendiri.
    const ket = [
      reasonLabel(l.reason),
      l.note,
      accountMap ? accountLabel(accountOfLine(l, opname, accountMap)) : null,
    ]
      .filter(Boolean)
      .join(' - ');
    const ketRows = ket ? wrap(ket, lebarProduk, 8) : [];
    const d = diffQty(l);

    c += text(`${num(l.bookQty)} ${unit}`.trim(), COL.book, y, { size: 9.5, align: 'right', color: C.label });
    c += text(`${num(l.countedQty)} ${unit}`.trim(), COL.count, y, { size: 9.5, bold: true, align: 'right', color: C.ink });
    c += text(signed(d), COL.diff, y, {
      size: 9.5,
      bold: true,
      align: 'right',
      color: d > 0 ? C.okInk : C.stopInk,
    });
    c += text(rpSigned(diffValue(l)), COL.value, y, { size: 9.5, align: 'right', color: C.ink });

    let dasar = y;
    nama.forEach((row, n) => {
      c += text(row, COL.produk, y - n * 12, { size: 9.5, bold: true, color: C.ink });
    });
    dasar -= (nama.length - 1) * 12;
    ketRows.forEach((row, n) => {
      c += text(row, COL.produk, dasar - 11 - n * 10, { size: 8, color: C.label });
    });
    if (ketRows.length) dasar -= 11 + (ketRows.length - 1) * 10;

    y = dasar - 14;
    c += line(M, RIGHT, y, C.border);
    y -= 20;
  });

  // --- pita nilai penyesuaian ---
  const bandLeft = 300;
  c += roundRect(bandLeft, y - 20, RIGHT - bandLeft, 30, 6, C.primary);
  c += text('Nilai penyesuaian persediaan', bandLeft + 14, y - 4, { size: 9.5, bold: true, color: C.onPrimary });
  c += text(rpSigned(s.netValue), RIGHT - 14, y - 4, { size: 11.5, bold: true, align: 'right', color: C.onPrimary });
  y -= 20;

  // --- catatan ---
  y -= 26;
  if (opname.notes) {
    const baris = wrap(opname.notes, W - 40, 8.5);
    const tinggi = baris.length * 12 + 18;
    c += roundRect(M, y - tinggi + 13, W, tinggi, 4, C.panelSoft);
    c += roundRect(M, y - tinggi + 13, 3, tinggi, 1.5, C.primary);
    baris.forEach((row, n) => {
      c += text(row, M + 18, y - n * 12, { size: 8.5, color: C.ink });
    });
    y -= tinggi + 6;
  }

  // --- tanda tangan ---
  // Dua kolom, sejumlah tindakan yang memang ada di aplikasi: Accounting mengajukan
  // hasil hitungan, Building Manager menyetujui dan memposting. Petugas hitung tidak
  // ikut menandatangani — namanya tercatat sebagai keterangan pelaksanaan di panel,
  // dan aplikasi tidak pernah meminta persetujuan darinya.
  //
  // Nama penyetuju hanya dicetak kalau persetujuannya memang sudah dibubuhkan;
  // dokumen yang belum diposting tidak boleh terbaca seolah sudah.
  const diajukan = eventOf('submitted')?.by ?? opname.createdBy ?? '';
  const disetujui = posted ? (eventOf('approved')?.by ?? '') : '';
  c += signatures(
    [
      { label: 'DIAJUKAN OLEH', name: diajukan, role: personTitle('accounting') },
      { label: 'DISETUJUI OLEH', name: disetujui, role: personTitle('bm') },
    ],
    { y: Math.max(172, Math.min(196, y - 22)) },
  );
  c += pageFooter(opname.number);
  return buildPdf(c, { title: `Berita Acara Stok Opname ${opname.number}` });
}

// Unduh berita acara sebagai PDF, mis. SO-2026-06-0001.pdf
export function downloadOpname(opname, ctx) {
  saveBlob(opnamePdfBlob(opname, ctx), `${opname.number.replace(/\//g, '-')}.pdf`);
}
