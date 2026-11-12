import { useData } from '@/lib/store.jsx';
import { toCustomer } from '@/pages/Kontak/utils.js';
import { taxes, TODAY } from './data.js';

// Format akuntan: dua angka di belakang koma, mis. Rp 1.234.000,00.
const number = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const rupiah = (n) => `${n < 0 ? '-' : ''}Rp ${number.format(Math.abs(n))}`;

// Ringkas untuk kartu statistik: Rp 14,4 jt / Rp 1,2 M.
const short = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
export function rupiahShort(n) {
  if (n >= 1e9) return `Rp ${short.format(n / 1e9)} M`;
  if (n >= 1e6) return `Rp ${short.format(n / 1e6)} jt`;
  if (n >= 1e3) return `Rp ${short.format(n / 1e3)} rb`;
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

export function generateInvoiceNumber() {
  const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `INV-${Date.now()}-${rand}`;
}

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
  const paid = sale.payments.reduce((s, p) => s + p.amount, 0);
  return {
    subtotal: Math.round(subtotal),
    discount: Math.round(discount),
    tax: Math.round(tax),
    withholding: Math.round(withholding),
    total,
    paid,
    balance: Math.max(total - paid, 0),
  };
}

export const STATUS = {
  draft: { label: 'DRAFT', color: 'gray' },
  sent: { label: 'TERKIRIM', color: 'blue' },
  paid: { label: 'LUNAS', color: 'green' },
};

export function statusOf(sale) {
  if (sale.draft) return 'draft';
  return computeTotals(sale).balance <= 0 ? 'paid' : 'sent';
}

export const isOverdue = (sale) => statusOf(sale) === 'sent' && sale.dueDate < TODAY;
