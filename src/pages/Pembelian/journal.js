// Jurnal kas keluar untuk Payment Voucher.
//
// Lingkupnya SENGAJA sempit: hanya PV. Dokumen pembelian lain (FPB, BAPP, faktur) juga
// berjurnal, tapi aturan akunnya ada di docs/Spesifikasi-Jurnal-Pembelian.pdf yang belum
// bisa dibaca di lingkungan ini — lihat bagian 9 docs/Alur-Pembelian.md.
//
// Seperti jurnal modul Penjualan, barisnya dibentuk ulang setiap kali dibaca dan tidak
// disimpan: belum ada buku besar. Yang disimpan di dokumen hanya KAPAN jurnalnya diposting.
import { accounts } from '@/pages/DaftarAkun/accounts.js';
import { invTotals, rupiah } from './utils.js';

// Akun dicari lewat namanya di daftar akun, bukan ditulis kodenya di sini: kode akun milik
// daftar akun, dan menyalinnya ke modul lain membuat keduanya bisa berbeda diam-diam.
const byName = (name) => accounts.find((a) => a.name.toLowerCase() === name.toLowerCase());
export const accountOf = (name) => {
  const a = byName(name);
  return a ? { code: a.code, name: a.name } : { code: null, name };
};
export const accountLabel = (name) => {
  const a = accountOf(name);
  return a.code ? `${a.code} · ${a.name}` : a.name;
};

export const AKUN = {
  uangMuka: 'Uang Muka Pembelian',
  ppnMasukan: 'PPN Masukan',
  hutangPph: 'Hutang PPh Pasal 23',
  hutangUsaha: 'Hutang Lainnya',
  kas: 'Kas dan Setara Kas',
};

// Baris jurnal satu Payment Voucher.
//
// PV uang muka  : belum ada faktur, jadi uangnya masuk ke Uang Muka Pembelian — bukan
//                 mengurangi hutang, karena hutangnya belum pernah diakui.
// PV pelunasan  : hutang yang sudah diakui saat faktur dicatat, kini dilunasi.
export function voucherJournal(v, pb) {
  if (!v) return [];
  const pr = pb.prsById?.[(v.prIds ?? [])[0]];
  const isDp = pr?.kind === 'dp';
  const lines = isDp
    ? [
      { account: AKUN.uangMuka, debit: v.amount, credit: 0 },
      { account: AKUN.kas, debit: 0, credit: v.amount, cash: true },
    ]
    : [
      { account: AKUN.hutangUsaha, debit: v.amount, credit: 0 },
      { account: AKUN.kas, debit: 0, credit: v.amount, cash: true },
    ];
  // Kode dan nama dipisah supaya layar bisa menatanya sendiri — menempel jadi satu string
  // memaksa tampilan ikut bentuk yang dipilih di sini.
  //
  // Jurnal hanya menyebut AKUN. Rekening banknya ("BCA 288-123-9001 · Kas Operasional")
  // bukan akun buku besar dan sudah tertera di kartu Informasi pembayaran, jadi tidak
  // diulang di sini.
  return lines.map((l) => {
    const akun = l.cash ? AKUN.kas : l.account;
    const a = accountOf(akun);
    return { ...l, code: a.code, name: a.name, label: accountLabel(akun) };
  });
}

export const journalTotals = (lines) => ({
  debit: lines.reduce((n, l) => n + l.debit, 0),
  credit: lines.reduce((n, l) => n + l.credit, 0),
});
export const journalBalanced = (lines) => {
  const t = journalTotals(lines);
  return t.debit === t.credit;
};

// Keterangan singkat jurnalnya, untuk ringkasan satu baris.
export function journalNote(v, pb) {
  const pr = pb.prsById?.[(v?.prIds ?? [])[0]];
  const vendor = pb.vendorsById?.[v?.vendorId]?.name ?? 'vendor';
  if (!pr) return `Pembayaran ke ${vendor} ${rupiah(v?.amount ?? 0)}`;
  if (pr.kind === 'dp') return `Uang muka ke ${vendor} atas ${pb.posById?.[pr.poId]?.number ?? 'pesanan'}`;
  const inv = (pr.invoiceIds ?? []).map((id) => pb.invoicesById?.[id]).filter(Boolean);
  const sisa = inv.length === 1 && pb.calc ? invTotals(inv[0], pb.calc).balance : null;
  return `Pelunasan ${inv.map((i) => i.number).join(', ') || 'faktur'} ke ${vendor}`
    + (sisa != null && sisa > 0 ? ` · sisa hutang ${rupiah(sisa)}` : '');
}
