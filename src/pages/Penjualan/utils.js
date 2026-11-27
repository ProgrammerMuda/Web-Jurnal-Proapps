import { useData } from '@/lib/store.jsx';
import { toCustomer } from '@/pages/Kontak/utils.js';
import { taxes, TODAY } from './data.js';

// Format akuntan: dua angka di belakang koma, mis. Rp 1.234.000,00.
const number = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const rupiah = (n) => `${n < 0 ? '-' : ''}Rp ${number.format(Math.abs(n))}`;

// Ringkas untuk kartu statistik: Rp 14,4 jt / Rp 1,2 M.
const short = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
export function rupiahShort(n) {
  // Besarannya diukur dari nilai mutlak, tandanya dipasang kembali di depan — kalau
  // tidak, angka negatif lolos semua perbandingan dan tercetak panjang.
  const tanda = n < 0 ? '-' : '';
  const x = Math.abs(n);
  if (x >= 1e9) return `${tanda}Rp ${short.format(x / 1e9)} M`;
  if (x >= 1e6) return `${tanda}Rp ${short.format(x / 1e6)} jt`;
  if (x >= 1e3) return `${tanda}Rp ${short.format(x / 1e3)} rb`;
  return rupiah(n);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
export const formatDateTime = (iso) => `${formatDate(iso)}, ${iso.slice(11, 16).replace(':', '.')}`;

export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function nowIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${TODAY}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Pola penomoran faktur. Nantinya diambil dari Pengaturan → Penomoran Dokumen;
// sementara dikunci di sini supaya nomor otomatis konsisten.
export const INVOICE_PREFIX = 'PRO/INV';

// Nomor berjalan per bulan: PRO/INV/202611/00007.
export function nextInvoiceNumber(sales = [], date = TODAY) {
  const prefix = `${INVOICE_PREFIX}/${date.slice(0, 4)}${date.slice(5, 7)}/`;
  const last = sales
    .filter((s) => s.number?.startsWith(prefix))
    .map((s) => Number(s.number.slice(prefix.length)) || 0)
    .reduce((a, b) => Math.max(a, b), 0);
  return `${prefix}${String(last + 1).padStart(5, '0')}`;
}

// #1: nomor dokumen tidak boleh dipakai dua kali. Dipakai form dan daftar.
export const numberTaken = (docs, number, selfId) =>
  docs.some((d) => d.id !== selfId && d.number?.trim().toLowerCase() === number.trim().toLowerCase());

// Pelanggan faktur diambil dari data Kontak (store bersama).
export const useCustomer = (id) => toCustomer(useData().contactsById[id]);
export const taxRate = (value) => taxes.find((t) => t.value === value)?.rate ?? 0;
export const taxLabel = (value) => taxes.find((t) => t.value === value)?.label;
export const lineAmount = (line) => (Number(line.qty) || 0) * (Number(line.price) || 0);

// Subtotal = DPP (harga sebelum pajak). Jika harga termasuk pajak, DPP diambil mundur.
// Diskon memotong subtotal; pajak ikut dikurangi proporsional diskon.
// Potongan (withholding) mengurangi total yang harus dibayar pelanggan.
export function computeTotals(sale) {
  let subtotal = 0;
  let taxBeforeDiscount = 0;
  for (const line of sale.items) {
    const amount = lineAmount(line);
    const rate = taxRate(line.tax);
    const net = sale.taxInclusive && rate ? amount / (1 + rate) : amount;
    subtotal += net;
    taxBeforeDiscount += net * rate;
  }

  const dv = Number(sale.discountValue) || 0;
  const discount = Math.min(sale.discountType === 'percent' ? (subtotal * dv) / 100 : dv, subtotal);
  const afterDiscount = subtotal - discount;
  const tax = subtotal ? taxBeforeDiscount * (afterDiscount / subtotal) : 0;

  const wv = Number(sale.withholdingValue) || 0;
  const withholding = sale.withholdingType === 'percent' ? (afterDiscount * wv) / 100 : wv;

  const total = Math.round(afterDiscount + tax - withholding);
  // Penawaran dan pesanan tidak punya pembayaran sama sekali, jadi kolomnya memang
  // tidak ada di dokumen itu — bukan berarti datanya rusak.
  // B3: pembayaran yang dibatalkan tetap tersimpan sebagai jejak, tapi berhenti
  // menutup tagihan — sisa tagihannya kembali seperti sebelum uang itu dicatat.
  const paid = activePayments(sale).reduce((s, p) => s + p.amount, 0);
  // Satu retur bisa terbagi: sebagian memotong tagihan, sisanya jadi kredit pelanggan.
  // Yang mengurangi piutang hanya porsi yang memotong tagihan.
  const daftarRetur = sale.returns ?? [];
  const returned = daftarRetur.reduce(
    (s, r) => s + (r.deducted ?? (r.settlement === 'deduct' ? r.amount : 0)),
    0,
  );
  // Seluruh nilai retur, apa pun penyelesaiannya: dipakai laporan penjualan neto.
  const returnedTotal = daftarRetur.reduce((s, r) => s + r.amount, 0);
  // B4: faktur yang dibatalkan berhenti menagih, jadi sisanya nol — bukan nilai penuh.
  const cancelled = !!sale.cancelledAt;
  return {
    subtotal: Math.round(subtotal),
    discount: Math.round(discount),
    tax: Math.round(tax),
    withholding: Math.round(withholding),
    total,
    paid,
    returned,
    returnedTotal,
    // Tagihan yang tersisa setelah retur memotongnya — dasar progres pembayaran (B7).
    billed: Math.max(total - returned, 0),
    balance: cancelled ? 0 : Math.max(total - paid - returned, 0),
  };
}

// B3: pembayaran yang masih berlaku. Yang dibatalkan tidak dihapus — ia tetap terbaca
// di riwayat dan jurnalnya ikut dibalik — tapi tidak dihitung lagi di mana pun.
export const paymentVoided = (p) => !!p.cancelledAt;
export const activePayments = (sale) => (sale.payments ?? []).filter((p) => !paymentVoided(p));

// Status faktur: Draf → Terbit → Dibayar Sebagian → Lunas (Dibatalkan menyusul di Tahap 2).
// Jatuh tempo BUKAN status, melainkan penanda tambahan — lihat isOverdue.
export const STATUS = {
  draft: { label: 'DRAF', color: 'gray' },
  issued: { label: 'BELUM LUNAS', color: 'orange' },
  // Biru: sudah ada uang masuk, jadi bedanya terlihat dari yang belum dibayar sama sekali.
  partial: { label: 'DIBAYAR SEBAGIAN', color: 'blue' },
  paid: { label: 'LUNAS', color: 'green' },
  // Tagihannya habis karena diretur, bukan karena dibayar — dibedakan supaya tidak
  // terbaca sebagai uang masuk.
  returned: { label: 'DIRETUR', color: 'orange' },
  cancelled: { label: 'DIBATALKAN', color: 'red' },
};

export function statusOf(sale) {
  if (sale.draft) return 'draft';
  // #8: faktur yang dibatalkan berhenti di situ — tidak lagi menagih apa pun.
  if (sale.cancelledAt) return 'cancelled';
  // B6: seluruh barisnya sudah diretur — tagihannya gugur, bukan terbayar.
  if (fullyReturned(sale)) return 'returned';
  const t = computeTotals(sale);
  if (t.balance <= 0) return t.paid > 0 || t.returned === 0 ? 'paid' : 'returned';
  return t.paid > 0 ? 'partial' : 'issued';
}

// Seluruh qty tiap baris sudah diretur. Faktur tanpa baris tidak terhitung.
export const fullyReturned = (sale) =>
  (sale.returns ?? []).length > 0 &&
  sale.items.length > 0 &&
  sale.items.every((l) => (l.returnedQty ?? 0) >= l.qty);

// Faktur terbit yang masih bersisa dan tanggalnya sudah lewat.
export const isOverdue = (sale) =>
  ['issued', 'partial'].includes(statusOf(sale)) && sale.dueDate < TODAY;

// Lencana memakai status apa adanya; jatuh tempo ditampilkan sebagai penanda terpisah.
export const badgeOf = statusOf;

// Aturan aksi, mengikuti aplikasi asli: faktur yang sudah terkirim tidak bisa diubah
// atau dihapus lagi — koreksinya lewat retur atau faktur pengganti.
export const canEdit = (sale) => statusOf(sale) === 'draft';
export const canDelete = (sale) => statusOf(sale) === 'draft';
export const canSend = (sale) => statusOf(sale) === 'draft';
export const canPay = (sale) => ['issued', 'partial'].includes(statusOf(sale));
// Faktur yang sudah terbit boleh dikirim ulang ke email pelanggan.
export const canResend = (sale) => !['draft', 'cancelled'].includes(statusOf(sale));
// #8: hanya faktur terbit yang belum menerima pembayaran sama sekali yang boleh
// dibatalkan. Yang sudah dibayar dikoreksi lewat retur, bukan dibatalkan.
export const canVoid = (sale) => statusOf(sale) === 'issued';

// #29: denda keterlambatan = sisa tagihan × tarif × bulan keterlambatan (minimal 1).
export function lateFeeAmount(sale, rate) {
  const bulan = Math.max(Math.ceil((new Date(TODAY) - new Date(sale.dueDate)) / 86400000 / 30), 1);
  return { bulan, amount: Math.round(computeTotals(sale).balance * rate * bulan) };
}

// #31: jejak aktivitas dokumen. Ditambahkan, tidak pernah diubah atau dihapus,
// supaya riwayatnya bisa dipercaya sebagai jejak audit.
export const ACTIVITY = {
  created: 'Dibuat',
  updated: 'Diubah',
  issued: 'Diterbitkan',
  sent: 'Dikirim ke pelanggan',
  resent: 'Dikirim ulang',
  reminded: 'Pengingat tagihan dikirim',
  paid: 'Pembayaran dicatat',
  paymentVoided: 'Pembayaran dibatalkan',
  cancelled: 'Dibatalkan',
  converted: 'Jadi dokumen lanjutan',
  accepted: 'Diterima pelanggan',
  rejected: 'Ditolak pelanggan',
  confirmed: 'Dikonfirmasi pelanggan',
};

export const logActivity = (doc, type, note = '', by = 'Finance') => ({
  ...doc,
  activity: [...(doc.activity ?? []), { at: nowIso(), type, note, by }],
});

// Pengiriman terakhir (null bila belum pernah dikirim atau data lama tanpa riwayat).
export const lastSend = (sale) => sale.sends?.[sale.sends.length - 1] ?? null;

// Salinan faktur sebagai draf baru: nomor, tanggal, pembayaran, tautan, dan riwayat
// kirim direset. Jatuh tempo dihitung ulang dari termin yang sama.
export function duplicateOf(sale, termDays) {
  const now = nowIso();
  return {
    ...sale,
    id: `s${Date.now()}`,
    number: nextInvoiceNumber(),
    date: TODAY,
    dueDate: termDays == null ? TODAY : addDays(TODAY, termDays),
    draft: true,
    payments: [],
    sends: [],
    invoiceLink: null,
    createdAt: now,
    updatedAt: now,
  };
}
