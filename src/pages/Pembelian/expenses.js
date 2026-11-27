// Aturan menu Biaya: pengeluaran operasional tanpa PO (listrik, air, internet, jasa rutin, sewa).
//
// Alur: Ajukan (siapa saja, bukti wajib) → Verifikasi Accounting (akun beban, PPN, PPh) →
// Persetujuan berjenjang menurut nilai → Dibukukan. Setelah dibukukan, biaya yang ditagih
// menjadi hutang ke penerimanya dan dibayar lewat Payment Request + Payment Voucher yang sama
// dengan faktur pembelian. Biaya yang sudah dibayar perusahaan langsung lunas saat dibukukan.
//
// Dokumen Biaya disimpan di koleksi `invoices` dengan `type: 'biaya'` supaya Hutang Usaha,
// umur hutang, dan Payment Request membacanya tanpa jalur kedua.
import { accounts } from '@/pages/DaftarAkun/accounts.js';
import { RULES, TODAY } from './data.js';
import { approvalState } from './permissions.js';
import { addDays, invOverdue, isExpense } from './utils.js';

// Di atas batas ini persetujuannya dua tanda tangan (Chief Finance lalu Building Manager).
export const EXPENSE_LIMIT = 5_000_000;

// Kategori yang dipilih pengaju. Pengaju tidak perlu tahu kode akun; kategori membawa akun
// beban bawaan yang bisa diganti Accounting saat verifikasi.
export const CATEGORIES = [
  { value: 'listrik', label: 'Listrik', account: '5-10001' },
  { value: 'air', label: 'Air PAM', account: '5-10002' },
  { value: 'internet', label: 'Internet & telepon', account: '6-20003' },
  { value: 'kebersihan', label: 'Kebersihan & chemical', account: '6-40001' },
  { value: 'keamanan', label: 'Keamanan', account: '6-40002' },
  { value: 'pest', label: 'Pest control', account: '6-40004' },
  { value: 'sampah', label: 'Pembuangan sampah', account: '6-40005' },
  { value: 'perbaikan', label: 'Perbaikan fasilitas gedung', account: '6-30012' },
  { value: 'konsultan', label: 'Konsultan, notaris, perizinan', account: '6-40006' },
  { value: 'sewa', label: 'Sewa peralatan', account: '6-60000' },
  { value: 'software', label: 'Langganan software', account: '6-60001' },
  { value: 'atk', label: 'ATK & perlengkapan kantor', account: '6-60003' },
  { value: 'transport', label: 'Transport (BBM, parkir, tol)', account: '6-20005' },
  { value: 'konsumsi', label: 'Konsumsi & rumah tangga kantor', account: '6-20006' },
  { value: 'pajak', label: 'Retribusi & pajak lainnya', account: '6-60005' },
];
export const categoryOf = (v) => CATEGORIES.find((c) => c.value === v);

// Akun beban yang boleh dipilih Accounting: akun daun kelompok 5 dan 6, tanpa akun penyusutan
// (penyusutan dibuat modul Aset, bukan diajukan sebagai biaya) dan tanpa diskon/retur pembelian.
const isLeaf = (code) => !accounts.some((a) => a.parent === code);
export const EXPENSE_ACCOUNTS = accounts
  .filter((a) => /^[56]-/.test(a.code) && isLeaf(a.code))
  .filter((a) => !/Peny\.|Amortisasi|Diskon Pembelian|Retur Pembelian/i.test(a.name))
  .map((a) => ({ value: a.code, label: `${a.code} · ${a.name}` }));

// PPh yang dipotong dari pembayaran ke penerima. Nilainya dikreditkan ke Hutang PPh, jadi yang
// dibayar ke penerima berkurang sebesar itu.
export const PPH_OPTIONS = [
  { value: 'none', label: 'Tidak ada PPh', pct: 0 },
  { value: 'pph23', label: 'PPh 23 · 2% (jasa badan)', pct: 2, account: '2-50003' },
  { value: 'pph21', label: 'PPh 21 · 2,5% (orang pribadi)', pct: 2.5, account: '2-50001' },
];
export const pphOf = (v) => PPH_OPTIONS.find((p) => p.value === v) ?? PPH_OPTIONS[0];

// Nilai sesuai tagihan (yang dilihat pengaju) dan DPP setelah PPN dipisahkan.
export const lineGross = (l) => l.gross ?? Math.round(l.qty * l.price * (1 + (l.ppnRate ?? 0)));
export const expenseGross = (exp) => exp.lines.reduce((n, l) => n + lineGross(l), 0);
export const splitPpn = (gross, withPpn) => {
  if (!withPpn) return { price: gross, ppnRate: 0 };
  return { price: Math.round(gross / (1 + RULES.ppn)), ppnRate: RULES.ppn };
};

// Rantai persetujuan menurut nilai tagihan.
export const expenseApprovalKind = (exp) => (expenseGross(exp) > EXPENSE_LIMIT ? 'expenseBig' : 'expense');
export const expenseApproval = (exp) => approvalState(exp, expenseApprovalKind(exp));

// Tahap dokumen sebelum dibukukan.
export const STAGES = ['verifikasi', 'dikembalikan', 'persetujuan', 'ditolak', 'dibukukan'];

export const EXPENSE_STATUS = {
  verifikasi: { label: 'Menunggu verifikasi', color: 'orange' },
  dikembalikan: { label: 'Dikembalikan', color: 'red' },
  persetujuan: { label: 'Menunggu persetujuan', color: 'orange' },
  ditolak: { label: 'Ditolak', color: 'red' },
  belum: { label: 'Belum dibayar', color: 'blue' },
  sebagian: { label: 'Dibayar sebagian', color: 'cyan' },
  tempo: { label: 'Jatuh tempo', color: 'red' },
  lunas: { label: 'Lunas', color: 'green' },
  dibatalkan: { label: 'Dibatalkan', color: 'gray' },
};

// Status yang dibaca pengguna: tahap persetujuan dulu, lalu keadaan bayarnya.
export function expenseStatus(exp, t) {
  if (exp.cancelled) return 'dibatalkan';
  if (exp.stage !== 'dibukukan') return exp.stage;
  if (t.balance <= 0) return 'lunas';
  if (invOverdue(exp, t)) return 'tempo';
  return t.paid > 0 ? 'sebagian' : 'belum';
}

// Nomor berikutnya: EXP/YYYY/MM/NNNN, urut per bulan.
export function nextExpenseNumber(invoices, date = TODAY) {
  const prefix = `EXP/${date.slice(0, 4)}/${date.slice(5, 7)}/`;
  const used = invoices.filter((i) => isExpense(i) && i.number.startsWith(prefix)).map((i) => Number(i.number.slice(prefix.length)) || 0);
  return `${prefix}${String(Math.max(0, ...used) + 1).padStart(4, '0')}`;
}

export const defaultDue = (date) => addDays(date || TODAY, 14);

// Daftar dokumen Biaya, terbaru di atas.
export const expensesOf = (invoices) => invoices.filter(isExpense).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
