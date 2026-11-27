// Aksi faktur yang dipakai lebih dari satu halaman (Faktur Penjualan dan Piutang Usaha):
// catat pembayaran, kirim / kirim ulang / pengingat, dan tautan faktur. Satu tempat supaya
// jurnal, kredit pelanggan, dan riwayat aktivitasnya selalu sama dari halaman mana pun.
import { notifications } from '@mantine/notifications';
import { CheckCircle, Trash } from '@/components/Icon.jsx';
import { useData } from '@/lib/store.jsx';
import { creditPart, returnStatus } from './returns.js';
import { invoiceLinkFor } from './routes.js';
import { logActivity, nextInvoiceNumber, nowIso, rupiah } from './utils.js';

export const toast = (title, message, color = 'green') =>
  notifications.show({
    color,
    icon: color === 'red' ? <Trash size={18} /> : <CheckCircle size={18} />,
    title,
    message,
    autoClose: 5000,
    withBorder: true,
    radius: 'md',
  });

export function useSaleActions() {
  const { sales, setSales, setSalesReturns } = useData();

  const updateSale = (id, fn) =>
    setSales((list) => list.map((s) => (s.id === id ? { ...fn(s), updatedAt: nowIso() } : s)));

  // Pembayaran menempel di fakturnya. Saldo kredit yang terpakai dicatat di returnya,
  // diambil dari retur terlama lebih dulu supaya kredit tidak menggantung tanpa pemilik (B3).
  const recordPayment = (sale, payment) => {
    updateSale(sale.id, (s) =>
      logActivity(
        { ...s, payments: [...s.payments, payment] },
        'paid',
        `${rupiah(payment.amount)} · ${payment.method}`,
      ),
    );
    if (payment.fromCredit) {
      let sisa = payment.amount;
      setSalesReturns((list) =>
        list.map((r) => {
          if (sisa <= 0 || r.customerId !== sale.customerId) return r;
          if (!['issued'].includes(returnStatus(r))) return r;
          const tersedia = creditPart(r) - (r.creditUsed ?? 0);
          if (tersedia <= 0) return r;
          const pakai = Math.min(tersedia, sisa);
          sisa -= pakai;
          return { ...r, creditUsed: (r.creditUsed ?? 0) + pakai, updatedAt: nowIso() };
        }),
      );
    }
  };

  // mode: 'send' menerbitkan draf; 'resend' dan 'reminder' hanya menambah catatan kirim.
  const recordSend = (sale, { to, note }, mode = 'send', { quiet = false } = {}) => {
    const ulang = mode !== 'send';
    const entry = { at: nowIso(), to, ...(mode === 'reminder' ? { kind: 'reminder' } : {}) };
    updateSale(sale.id, (s) =>
      logActivity(
        {
          ...s,
          draft: ulang ? s.draft : false,
          number: s.number || nextInvoiceNumber(sales),
          // Pesan pengingat tidak menimpa pesan faktur aslinya.
          message: mode === 'reminder' ? s.message : note || s.message,
          sends: [...(s.sends ?? []), entry],
        },
        mode === 'reminder' ? 'reminded' : ulang ? 'resent' : 'sent',
        to,
      ),
    );
    if (quiet) return;
    toast(
      mode === 'reminder' ? 'Pengingat terkirim' : ulang ? 'Faktur dikirim ulang' : 'Faktur terkirim',
      `${sale.number} dikirim ke ${to}.`,
    );
  };

  // Tautan faktur dibuat sekali, lalu disalin ke clipboard setiap kali diminta. Tautannya
  // mengarah ke halaman faktur pelanggan (#invoice/<id>) di aplikasi ini.
  const copyLink = (id) => {
    const sale = sales.find((s) => s.id === id);
    const link = sale.invoiceLink ?? invoiceLinkFor(id);
    if (!sale.invoiceLink) updateSale(id, (s) => ({ ...s, invoiceLink: link }));
    navigator.clipboard?.writeText(link).catch(() => {});
    toast(
      sale.invoiceLink ? 'Tautan disalin' : 'Tautan faktur dibuat',
      'Tautan sudah ada di papan klip dan bisa dibuka pelanggan.',
    );
  };

  return { updateSale, recordPayment, recordSend, copyLink };
}
