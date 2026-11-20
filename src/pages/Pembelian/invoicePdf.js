// Susun faktur pembelian (tagihan vendor) menjadi PDF satu halaman. Kerangkanya dipakai
// bersama PO/SPK, FPPBJ, dan FPB/BAPP — lihat docPdf.js.
//
// Dokumen ini tidak dikirim ke vendor: invoice-nya justru datang DARI vendor. Yang dicetak
// di sini adalah catatan hutangnya — apa yang ditagih, potongan apa saja yang diambil, dan
// berapa sisanya — untuk dilampirkan ke berkas hutang usaha. Karena itu nilai yang paling
// menentukan bukan nilai kotor tagihan, melainkan sisa hutang setelah semua potongan.
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
import { personName, personTitle, TODAY } from './data.js';
import {
  bankLine,
  formatDate,
  INV_STATUS,
  invDpp,
  invLineDesc,
  invPpn,
  invStatus,
  poDocLabel,
  PR_STATUS,
  ppnLabel,
  termParts,
  vendorEmail,
} from './utils.js';

// Sama persis dengan tabel PO/SPK: faktur dibaca berdampingan dengan pesanannya, jadi
// kolomnya tidak boleh bergeser-geser antar dokumen.
const COL = { no: M, desc: M + 26, qty: 352, unit: 362, price: 468, amount: RIGHT };
const KANAN = 330; // tepi kiri kolom ringkasan biaya

// Warna lencana mengikuti arti statusnya: lunas hijau, lewat tempo merah, sisanya kuning.
const statusTone = (status) =>
  status === 'lunas'
    ? { bg: C.okBg, ink: C.okInk }
    : ['tempo', 'dibatalkan'].includes(status)
      ? { bg: C.stopBg, ink: C.stopInk }
      : { bg: C.warnBg, ink: C.warnInk };

const hariLewat = (iso) => Math.floor((Date.parse(TODAY) - Date.parse(iso)) / 864e5);

export function invoicePdfBlob(inv, { vendor, po, posById = {}, receiptsById = {}, prs = [], totals } = {}) {
  const t = totals;
  const status = invStatus(inv, t);
  const lewat = t.balance > 0 && inv.dueDate < TODAY ? hariLewat(inv.dueDate) : 0;
  const itemOf = (l) => (posById[l.poId ?? inv.poId] ?? po)?.items.find((i) => i.id === l.itemId);
  const noPenerimaan = [...new Set(inv.lines.map((l) => receiptsById[l.receiptId]?.number).filter(Boolean))];
  let c = '';

  // --- kepala surat ---
  const kepala = docHeader({
    title: 'FAKTUR PEMBELIAN',
    number: inv.number,
    subtitle: `NPWP ${COMPANY.npwp} - Telp ${COMPANY.phone}`,
    status: { label: INV_STATUS[status]?.label ?? status, ...statusTone(status) },
  });
  c += kepala.c;
  let y = kepala.y - 18;

  // --- pita data ---
  const pita = metaStrip(
    [
      { label: 'TANGGAL FAKTUR', value: formatDate(inv.date) },
      {
        label: 'JATUH TEMPO',
        value: formatDate(inv.dueDate),
        sub: lewat > 0 ? `Lewat ${lewat} hari` : '',
      },
      { label: 'NO. INVOICE VENDOR', value: inv.vendorNo || 'Tidak ada', muted: !inv.vendorNo },
      po
        ? { label: `NO. ${poDocLabel(po).toUpperCase()}`, value: po.number }
        : { label: 'NO. PESANAN', value: 'Tanpa pesanan', muted: true },
    ],
    y,
  );
  c += pita.c;
  y = pita.y - 18;

  // --- panel vendor & dasar tagihan ---
  // Nomor rekening ikut dicetak karena dokumen inilah yang dipakai menyiapkan pembayaran.
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
  // Baris manual tidak merujuk penerimaan mana pun — biaya non-PO seperti listrik atau sewa
  // memang tidak lewat gudang. Keadaan itu disebut apa adanya, bukan dikosongkan.
  const panelDasar = {
    label: 'DASAR TAGIHAN',
    title: `${inv.lines.length} baris difaktur`,
    rows: [
      ['Dari penerimaan', noPenerimaan.join(', ') || 'Tanpa penerimaan'],
      ['Termin bayar', po ? termParts(po.term).label : ''],
      ['Berkas', (inv.files ?? []).join(', ')],
    ],
  };
  const blok = panels([panelVendor, panelDasar], y);
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
  inv.lines.forEach((l, i) => {
    const it = itemOf(l);
    const desc = wrap(invLineDesc(l, it), lebarDesc, 9.5);
    // Asal barisnya: nomor FPB/BAPP kalau lewat penerimaan, keterangan baris kalau manual.
    const sub = [l.spec, receiptsById[l.receiptId]?.number].filter(Boolean).join(' · ');
    const subRows = sub ? wrap(sub, lebarDesc, 8) : [];

    c += text(String(i + 1), COL.no, y, { size: 9.5, color: C.label });
    c += text(String(l.qty), COL.qty, y, { size: 9.5, align: 'right', color: C.ink });
    c += text(it?.unit ?? l.unit ?? '', COL.unit, y, { size: 9.5, color: C.ink });
    c += text(rp(l.price), COL.price, y, { size: 9.5, align: 'right', color: C.ink });
    c += text(rp(l.qty * l.price), COL.amount, y, { size: 9.5, bold: true, align: 'right', color: C.ink });

    let dasar = y;
    desc.forEach((row, n) => {
      c += text(row, COL.desc, y - n * 12, { size: 9.5, bold: true, color: C.ink });
    });
    dasar -= (desc.length - 1) * 12;
    subRows.forEach((row, n) => {
      c += text(row, COL.desc, dasar - 11 - n * 10, { size: 8, color: C.label });
    });
    if (subRows.length) dasar -= 11 + (subRows.length - 1) * 10;

    // Garis pemisah diukur dari baris teks terakhir, lalu baris berikutnya diberi jarak
    // lagi di bawah garis — kalau dibalik, hurufnya memotong garisnya sendiri.
    y = dasar - 14;
    c += line(M, RIGHT, y, C.border);
    y -= 20;
  });

  // --- ringkasan biaya (kanan) ---
  // Potongan hanya dicetak kalau memang ada. Baris nol di dokumen hutang mengundang
  // pertanyaan yang tidak ada jawabannya.
  const atas = y + 6;
  // Faktur yang dibatalkan bernilai nol di mana pun ia dihitung — itu benar untuk buku
  // besar, tapi sederet "Rp 0" di lembar cetak membaca seolah vendor menagih nol. Yang
  // dicetak di sini nilai asalnya, dengan keterangan bahwa fakturnya sudah dibatalkan.
  const rows = inv.cancelled
    ? [['Nilai sebelum dibatalkan', rp(invDpp(inv) + invPpn(inv))]]
    : [
        ['DPP', rp(t.dpp)],
        [ppnLabel(inv.lines), rp(t.ppn)],
        ...(t.pph > 0 ? [[`Potongan PPh ${inv.pphPct}%`, `-${rp(t.pph)}`]] : []),
        ...(t.dp > 0 ? [['Potongan uang muka', `-${rp(t.dp)}`]] : []),
        ...(t.ret > 0 ? [['Potongan retur', `-${rp(t.ret)}`]] : []),
        ...(t.credit > 0 ? [['Alokasi kredit vendor', `-${rp(t.credit)}`]] : []),
        ['Nilai tagihan', rp(t.total)],
        ...(t.paid > 0 ? [['Sudah dibayar', `-${rp(t.paid)}`]] : []),
      ];
  let ry = atas;
  rows.forEach(([k, v]) => {
    c += text(k, KANAN + 16, ry, { size: 9, color: C.label });
    c += text(v, RIGHT, ry, { size: 9, align: 'right', color: C.ink });
    ry -= 16;
  });
  ry -= 2;
  // Pita penutup memuat sisa hutang, bukan nilai kotornya: itu angka yang dipakai saat
  // menyiapkan pembayaran, dan satu-satunya yang berubah setelah ada pelunasan.
  c += roundRect(KANAN, ry - 24, RIGHT - KANAN, 32, 6, C.primary);
  c += text('Sisa hutang', KANAN + 16, ry - 7, { size: 10.5, bold: true, color: C.onPrimary });
  c += text(inv.cancelled ? 'Dibatalkan' : rp(t.balance), RIGHT - 16, ry - 7, {
    size: 12,
    bold: true,
    align: 'right',
    color: C.onPrimary,
  });
  const bawahRingkasan = ry - 24;

  // --- terbilang & pembayaran (kiri) ---
  const lebarKiri = KANAN - M - 20;
  let ly = atas;
  // Terbilang hanya untuk nilai yang masih ditagih; mengeja nilai faktur batal itu
  // mengesahkan angka yang sudah tidak berlaku.
  if (!inv.cancelled) {
    c += text('TERBILANG NILAI TAGIHAN', M, ly, { size: 7, bold: true, color: C.label });
    ly -= 16;
    wrap(terbilang(t.total), lebarKiri, 9.5).forEach((row) => {
      c += text(row, M, ly, { size: 9.5, italic: true, color: C.ink });
      ly -= 13;
    });
    ly -= 10;
  }

  c += text('PEMBAYARAN', M, ly, { size: 7, bold: true, color: C.label });
  ly -= 15;
  if (prs.length === 0) {
    c += text('Belum ada Payment Request atas faktur ini.', M, ly, { size: 8.5, color: C.muted });
    ly -= 13;
  } else {
    prs.forEach((p) => {
      const nominal = p.alloc?.[inv.id] ?? p.amount;
      const ket = `${p.kind === 'dp' ? 'Di muka' : 'Pelunasan'} · ${PR_STATUS[p.status]?.label ?? p.status}`;
      c += text(p.number, M, ly, { size: 8.5, bold: true, color: C.ink });
      c += text(rp(nominal), KANAN - 20, ly, { size: 8.5, align: 'right', color: C.ink });
      c += text(ket, M, ly - 10, { size: 7.5, color: C.label });
      ly -= 24;
    });
  }

  // --- faktur yang dibatalkan ---
  // Lembar yang sudah beredar tidak boleh terbaca seolah masih menagih.
  y = Math.min(ly, bawahRingkasan) - 18;
  if (inv.cancelled) {
    c += text('FAKTUR DIBATALKAN', M, y, { size: 7, bold: true, color: C.stopInk });
    const alasan = [inv.cancelNote, inv.cancelledBy].filter(Boolean).join(' — ');
    wrap(alasan || 'Tanpa alasan tercatat.', W, 8.5).forEach((row, n) => {
      c += text(row, M, y - 13 - n * 11, { size: 8.5, color: C.stopInk });
    });
    y -= 30;
  }

  // --- tanda tangan & kaki halaman ---
  // Persetujuan pembayarannya ada di Payment Request, berjenjang dan bertanggal; mencetak
  // nama penyetuju di sini akan mengulanginya tanpa dasar. Yang tersisa di lembar ini
  // adalah pencatatan dan pemeriksaannya.
  const signY = Math.max(172, Math.min(196, y - 10));
  c += signatures(
    [
      { label: 'DICATAT OLEH', name: personName('accounting'), role: personTitle('accounting') },
      { label: 'DIPERIKSA OLEH', name: '', role: personTitle('cfo') },
    ],
    { y: signY },
  );
  c += pageFooter(inv.number);
  return buildPdf(c, { title: `Faktur ${inv.number}` });
}

// Unduh faktur pembelian sebagai PDF, mis. FKT-2026-11-0024.pdf
export function downloadInvoice(inv, meta) {
  saveBlob(invoicePdfBlob(inv, meta), `${inv.number.replace(/\//g, '-')}.pdf`);
}
