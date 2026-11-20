import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Menu,
  Pagination,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { notifications } from '@mantine/notifications';
import {
  ArrowCounterClockwise,
  ArrowsClockwise,
  Check,
  CheckCircle,
  ClipboardText,
  Clock,
  Copy,
  DotsThreeVertical,
  DownloadSimple,
  EnvelopeSimple,
  Eye,
  FileText,
  Invoice,
  Link,
  MagnifyingGlass,
  Notebook,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  Prohibit,
  Trash,
  Warning,
} from '@/components/Icon.jsx';
import { CopyIcon, PageIntro, StatusBadge } from './components.jsx';
import {
  BulkBillingModal,
  DeleteModal,
  JournalModal,
  ReasonModal,
  SendModal,
} from './Dialogs.jsx';
import PaymentModal from './PaymentModal.jsx';
import SaleDetail from './SaleDetail.jsx';
import { downloadInvoice } from './invoicePdf.js';
import { formatHash, invoiceLinkFor } from './routes.js';
import { initialSale, paymentTerms, products } from './data.js';
import { canReturnInvoice, creditPart, customerCredit, returnStatus } from './returns.js';
import { PAYMENT_VOID_REASONS, releaseCredit, voidPayment } from './payments.js';
import { saleJournals } from './journal.js';
import {
  badgeOf,
  canDelete,
  canEdit,
  canPay,
  canResend,
  canSend,
  canVoid,
  computeTotals,
  duplicateOf,
  formatDate,
  formatDateTime,
  lastSend,
  logActivity,
  nextInvoiceNumber,
  isOverdue,
  nowIso,
  rupiah,
  rupiahShort,
  statusOf,
  useCustomer,
} from './utils.js';
import { useData } from '@/lib/store.jsx';
import { canBeInvoiced, formatAddress, toCustomer } from '@/pages/Kontak/utils.js';

// Dua tab: belum terbit dan sudah terbit. Tab ini soal status dokumen — status
// kirim email ditampilkan terpisah sebagai penanda di kolom nomor (#6).
const tabs = [
  { value: 'draft', label: 'Draf', icon: FileText, match: (s) => statusOf(s) === 'draft' },
  {
    value: 'sent',
    label: 'Terbit',
    icon: Invoice,
    // B4: faktur yang dibatalkan tidak lagi menagih, jadi tidak ikut dihitung di sini.
    match: (s) => !['draft', 'cancelled'].includes(statusOf(s)),
  },
  {
    value: 'cancelled',
    label: 'Dibatalkan',
    icon: Prohibit,
    match: (s) => statusOf(s) === 'cancelled',
  },
];

const statusFilters = [
  { value: 'all', label: 'Semua status', match: () => true },
  { value: 'issued', label: 'Belum lunas', match: (s) => statusOf(s) === 'issued' },
  { value: 'partial', label: 'Dibayar sebagian', match: (s) => statusOf(s) === 'partial' },
  { value: 'paid', label: 'Lunas', match: (s) => statusOf(s) === 'paid' },
  { value: 'returned', label: 'Diretur', match: (s) => statusOf(s) === 'returned' },
  { value: 'overdue', label: 'Jatuh tempo', match: isOverdue },
];

// #8: alasan pembatalan dibuat tetap supaya bisa dihitung, bukan teks bebas.
const VOID_REASONS = [
  'Salah terbit',
  'Salah pelanggan',
  'Salah nilai',
  'Transaksi batal',
  'Lainnya',
];

const pageSizes = ['10', '20', '50'].map((v) => ({ value: v, label: `${v} / hal` }));

// Dokumen asal faktur, bila ada dan masih ketemu (S5).
const sourceOf = (sale, orders, quotes) => {
  const order = sale.fromOrder && orders.find((o) => o.id === sale.fromOrder);
  if (order) return { kind: 'order', doc: order };
  const quote = sale.fromQuote && quotes.find((q) => q.id === sale.fromQuote);
  return quote ? { kind: 'quote', doc: quote } : null;
};

// Semua perpindahan halaman modul ini lewat alamat, bukan state lokal: rincian dan
// form jadi bisa di-refresh dan dibagikan (#7).
const goForm = (v) => {
  window.location.hash = formatHash(v);
  window.scrollTo({ top: 0 });
};

// Umpan balik aksi, mengikuti gaya notifikasi halaman Kontak.
const toast = (title, message, color = 'green') =>
  notifications.show({
    color,
    icon: color === 'red' ? <Trash size={18} /> : <CheckCircle size={18} />,
    title,
    message,
    autoClose: 5000,
    withBorder: true,
    radius: 'md',
  });

function StatCard({ label, value, hint, icon: Icon, color }) {
  return (
    <Card withBorder radius="md" padding="md" bg="white">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text fz={11} fw={600} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }}>
            {label}
          </Text>
          <Text fz={22} fw={700} c="slate.9" lh={1.3}>
            {value}
          </Text>
          <Text fz={11} c="slate.6">
            {hint}
          </Text>
        </Box>
        <ThemeIcon variant="light" color={color} size={36} radius="md">
          <Icon size={18} />
        </ThemeIcon>
      </Group>
    </Card>
  );
}

function SaleRow({ sale, onOpen, onPay, onCreateLink, actions }) {
  const t = computeTotals(sale);
  const status = badgeOf(sale);
  const sent = lastSend(sale);
  const customer = useCustomer(sale.customerId);

  return (
    <Table.Tr>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <UnstyledButton onClick={onOpen}>
            <Text fz="sm" fw={700} c="primary.9" style={{ whiteSpace: 'nowrap' }}>
              {sale.number}
            </Text>
          </UnstyledButton>
          <CopyIcon value={sale.number} />
          {sent && (
            <Tooltip
              withArrow
              fz="xs"
              label={`Terkirim ${formatDateTime(sent.at)} · ${sent.to}`}
            >
              <span style={{ display: 'inline-flex' }}>
                <PaperPlaneTilt size={13} color="var(--mantine-color-slate-5)" />
              </span>
            </Tooltip>
          )}
        </Group>
        {sale.ref && (
          <Text fz={11} c="slate.6">
            Ref: {sale.ref}
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <Text fz="sm" fw={600} c="slate.9">
          {customer?.name}
        </Text>
        {customer?.email && (
          <Text fz={11} c="slate.6">
            {customer.email}
          </Text>
        )}
      </Table.Td>
      <Table.Td fz="sm" c="slate.8" style={{ whiteSpace: 'nowrap' }}>
        {formatDate(sale.date)}
      </Table.Td>
      <Table.Td
        fz="sm"
        c={isOverdue(sale) ? 'red.7' : 'slate.8'}
        fw={isOverdue(sale) ? 600 : 400}
        style={{ whiteSpace: 'nowrap' }}
      >
        {formatDate(sale.dueDate)}
      </Table.Td>
      <Table.Td ta="right">
        <Text fz="sm" fw={700} c="slate.9" style={{ whiteSpace: 'nowrap' }}>
          {rupiah(t.total)}
        </Text>
        {t.discount > 0 && (
          <Text fz={11} c="slate.6" style={{ whiteSpace: 'nowrap' }}>
            Diskon: -{rupiah(t.discount)}
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="right">
        <Text
          fz="sm"
          fw={700}
          c={t.balance > 0 ? 'red.8' : 'green.8'}
          style={{ whiteSpace: 'nowrap' }}
        >
          {rupiah(t.balance)}
        </Text>
        {t.paid > 0 && (
          <Text fz={11} c="green.8" style={{ whiteSpace: 'nowrap' }}>
            Terbayar: {rupiah(t.paid)}
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="center">
        <Group gap={4} justify="center" wrap="nowrap">
          <StatusBadge status={status} size="xs" />
          {isOverdue(sale) && (
            <Tooltip withArrow fz="xs" label={`Lewat jatuh tempo ${formatDate(sale.dueDate)}`}>
              <Badge size="xs" radius="sm" variant="light" color="red" fw={700}>
                JATUH TEMPO
              </Badge>
            </Tooltip>
          )}
        </Group>
      </Table.Td>
      <Table.Td ta="center">
        <Menu position="bottom-end" withinPortal shadow="md" width={200}>
          <Menu.Target>
            <ActionIcon variant="subtle" color="slate" aria-label={`Aksi ${sale.number}`}>
              <DotsThreeVertical size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item fz="xs" leftSection={<Eye size={14} />} onClick={onOpen}>
              Lihat Rincian
            </Menu.Item>
            {canEdit(sale) && (
              <Menu.Item
                fz="xs"
                leftSection={<PencilSimple size={14} />}
                onClick={() => actions.edit(sale)}
              >
                Ubah Faktur
              </Menu.Item>
            )}
            {canSend(sale) && (
              <Menu.Item
                fz="xs"
                leftSection={<PaperPlaneTilt size={14} />}
                onClick={() => actions.send(sale)}
              >
                Kirim Faktur
              </Menu.Item>
            )}
            {canPay(sale) && (
              <Menu.Item fz="xs" leftSection={<Invoice size={14} />} onClick={onPay}>
                Catat Pembayaran
              </Menu.Item>
            )}
            <Menu.Item
              fz="xs"
              leftSection={<Notebook size={14} />}
              onClick={() => actions.journal(sale)}
            >
              Lihat Jurnal
            </Menu.Item>
            {statusOf(sale) !== 'cancelled' && (
              <Menu.Item fz="xs" leftSection={<Link size={14} />} onClick={onCreateLink}>
                Tautan Invoice
              </Menu.Item>
            )}
            <Menu.Item
              fz="xs"
              leftSection={<DownloadSimple size={14} />}
              onClick={() => downloadInvoice(sale, { customer })}
            >
              Unduh Faktur PDF
            </Menu.Item>
            {canResend(sale) && (
              <Menu.Item
                fz="xs"
                leftSection={<EnvelopeSimple size={14} />}
                onClick={() => actions.resend(sale)}
              >
                Kirim Ulang Email
              </Menu.Item>
            )}
            <Menu.Item
              fz="xs"
              leftSection={<Copy size={14} />}
              onClick={() => actions.duplicate(sale)}
            >
              Duplikat Faktur
            </Menu.Item>
            {isOverdue(sale) && (
              <Menu.Item
                fz="xs"
                leftSection={<Warning size={14} />}
                onClick={() => actions.lateFee(sale)}
              >
                Buat Faktur Denda
              </Menu.Item>
            )}
            {canReturnInvoice(sale) && (
              <Menu.Item
                fz="xs"
                leftSection={<ArrowCounterClockwise size={14} />}
                onClick={() => actions.makeReturn(sale)}
              >
                Buat Retur
              </Menu.Item>
            )}
            {(canVoid(sale) || canDelete(sale)) && <Menu.Divider />}
            {canVoid(sale) && (
              <Menu.Item
                fz="xs"
                color="red"
                leftSection={<Prohibit size={14} />}
                onClick={() => actions.void(sale)}
              >
                Batalkan Faktur
              </Menu.Item>
            )}
            {canDelete(sale) && (
              <>
                <Menu.Item
                  fz="xs"
                  color="red"
                  leftSection={<Trash size={14} />}
                  onClick={() => actions.remove(sale)}
                >
                  Hapus Faktur
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  );
}

// Tab "Faktur Penjualan". Dipasang oleh shell modul (Penjualan.jsx).
// params (dari halaman lain): { saleId } membuka rincian, { createFor } membuka form untuk kontak itu.
export default function Invoices({ params }) {
  const { sales, setSales, orders, quotes, contacts, contactsById, salesReturns, setSalesReturns } =
    useData();
  // Faktur yang sedang dibuka ditentukan alamat halaman, bukan state lokal.
  const detailId = params?.saleId ?? null;
  const [payId, setPayId] = useState(null);
  // Satu dialog aktif pada satu waktu: { type: 'edit' | 'send' | 'resend' | 'delete', id }.
  const [dialog, setDialog] = useState(null);

  const [tab, setTab] = useState('sent');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  const updateSale = (id, fn) =>
    setSales((list) => list.map((s) => (s.id === id ? { ...fn(s), updatedAt: nowIso() } : s)));

  const openDetail = (id) => goForm({ name: 'invoice', id });
  const closeDetail = () => goForm({ name: 'tab', tab: 'invoices' });

  // Tautan faktur dibuat sekali, lalu disalin ke clipboard setiap kali diminta.
  // Tautannya mengarah ke halaman faktur pelanggan (#invoice/<id>) di aplikasi ini,
  // jadi benar-benar bisa dibuka, bukan sekadar alamat contoh.
  const createLink = (id) => {
    const sale = sales.find((s) => s.id === id);
    const link = sale.invoiceLink ?? invoiceLinkFor(id);
    if (!sale.invoiceLink) updateSale(id, (s) => ({ ...s, invoiceLink: link }));
    navigator.clipboard?.writeText(link).catch(() => {});
    toast(
      sale.invoiceLink ? 'Tautan disalin' : 'Tautan faktur dibuat',
      'Tautan sudah ada di papan klip dan bisa dibuka pelanggan.',
    );
  };

  const savePayment = (payment) => {
    updateSale(payId, (s) =>
      logActivity(
        { ...s, payments: [...s.payments, payment] },
        'paid',
        `${rupiah(payment.amount)} · ${payment.method}`,
      ),
    );
    // B3: saldo kredit yang terpakai dicatat di returnya, diambil dari retur terlama
    // lebih dulu supaya kredit tidak menggantung tanpa pemilik.
    if (payment.fromCredit) {
      const pelanggan = paying?.customerId;
      let sisa = payment.amount;
      setSalesReturns((list) =>
        list.map((r) => {
          if (sisa <= 0 || r.customerId !== pelanggan) return r;
          if (!['issued'].includes(returnStatus(r))) return r;
          const tersedia = creditPart(r) - (r.creditUsed ?? 0);
          if (tersedia <= 0) return r;
          const pakai = Math.min(tersedia, sisa);
          sisa -= pakai;
          return { ...r, creditUsed: (r.creditUsed ?? 0) + pakai, updatedAt: nowIso() };
        }),
      );
    }
    setPayId(null);
  };

  // B3: pembayaran yang salah input dibatalkan, bukan dihapus — jurnalnya dibalik dan
  // sisa tagihannya kembali. Kredit pelanggan yang sempat terpakai ikut dikembalikan.
  const voidPaymentAt = (saleId, index, reason) => {
    const sale = sales.find((s) => s.id === saleId);
    const payment = sale?.payments?.[index];
    if (!payment || payment.cancelledAt) return setDialog(null);
    const at = nowIso();
    updateSale(saleId, (s) =>
      logActivity(
        { ...s, payments: s.payments.map((p, i) => (i === index ? voidPayment(p, reason, at) : p)) },
        'paymentVoided',
        `${rupiah(payment.amount)} · ${reason}`,
      ),
    );
    if (payment.fromCredit) {
      setSalesReturns((list) => releaseCredit(list, sale.customerId, payment.amount, at));
    }
    setDialog(null);
    toast(
      'Pembayaran dibatalkan',
      `${rupiah(payment.amount)} pada ${sale.number} tidak lagi menutup tagihan.`,
    );
  };

  // --- aksi faktur ---------------------------------------------------------------
  const closeDialog = () => setDialog(null);

  // Datang dari halaman Kontak lewat "Buat faktur": langsung buka form untuk kontak itu.
  const createFor = params?.createFor;
  useEffect(() => {
    if (createFor) goForm({ name: 'sale-new', customerId: createFor });
  }, [createFor]);

  // Mengirim draf menerbitkan fakturnya: status menjadi Terkirim dan ikut dihitung
  // sebagai piutang. Kirim ulang hanya menambah catatan pengiriman.
  const sendSale = (sale, { to, note }, resend) => {
    const entry = { at: nowIso(), to };
    updateSale(sale.id, (s) =>
      logActivity(
        {
          ...s,
          draft: resend ? s.draft : false,
          number: s.number || nextInvoiceNumber(sales),
          message: note || s.message,
          sends: [...(s.sends ?? []), entry],
        },
        resend ? 'resent' : 'sent',
        to,
      ),
    );
    closeDialog();
    toast(
      resend ? 'Faktur dikirim ulang' : 'Faktur terkirim',
      `${sale.number} dikirim ke ${to}.`,
    );
  };

  // #8: pembatalan tidak menghapus apa pun — fakturnya tetap ada, jurnalnya dibalik.
  const voidSale = (sale, reason) => {
    updateSale(sale.id, (s) =>
      logActivity({ ...s, cancelledAt: nowIso(), cancelReason: reason }, 'cancelled', reason),
    );
    closeDialog();
    toast('Faktur dibatalkan', `${sale.number} dibatalkan — ${reason}.`, 'red');
  };

  // #29: denda ditagih lewat faktur tersendiri supaya nilainya terpisah dari pokok.
  const toLateFeeInvoice = (sale) =>
    goForm({ name: 'sale-new', from: `late:${sale.id}` });

  const deleteSale = (sale) => {
    setSales((list) => list.filter((s) => s.id !== sale.id));
    closeDialog();
    if (detailId === sale.id) closeDetail();
    toast('Faktur dihapus', `Draf ${sale.number} dihapus permanen.`, 'red');
  };

  const duplicateSale = (sale) => {
    const days = paymentTerms.find((t) => t.value === sale.term)?.days;
    const copy = duplicateOf(sale, days);
    setSales((list) => [copy, ...list]);
    setTab('draft');
    setPage(1);
    toast('Faktur diduplikat', `Salinan ${sale.number} dibuat sebagai draf ${copy.number}.`);
    goForm({ name: 'invoice', id: copy.id });
  };

  // #28: satu draf faktur per unit untuk periode yang sama.
  const createBulk = ({ productId, period, date, due, price, customerIds }) => {
    const now = nowIso();
    const produk = products.find((p) => p.id === productId);
    const labelPeriode = formatDate(`${period}-01`).replace(/^\d+ /, '');
    const dibuat = customerIds.map((customerId, i) => {
      const kontak = contactsById[customerId];
      return logActivity(
        {
          ...initialSale(),
          id: `s${Date.now()}${i}`,
          number: nextInvoiceNumber([...sales], date),
          customerId,
          billingAddress: kontak ? formatAddress(kontak.billing) : '',
          date,
          dueDate: due,
          term: 'net30',
          items: [
            {
              productId,
              description: `${produk?.name} periode ${labelPeriode}`,
              qty: 1,
              price,
              tax: produk?.tax ?? null,
            },
          ],
          memo: `Tagihan rutin ${labelPeriode}`,
          draft: true,
          createdAt: now,
          updatedAt: now,
        },
        'created',
        `Tagihan rutin ${labelPeriode}`,
      );
    });
    // Nomor diurutkan ulang supaya tidak kembar: dibuat berurutan dari satu daftar.
    let urut = sales;
    const hasil = dibuat.map((f) => {
      const bernomor = { ...f, number: nextInvoiceNumber(urut, date) };
      urut = [bernomor, ...urut];
      return bernomor;
    });
    setSales((list) => [...hasil, ...list]);
    setDialog(null);
    setTab('draft');
    toast('Tagihan rutin dibuat', `${hasil.length} draf faktur untuk periode ${labelPeriode}.`);
  };

  const actions = {
    edit: (sale) => goForm({ name: 'sale-edit', id: sale.id }),
    send: (sale) => setDialog({ type: 'send', id: sale.id }),
    resend: (sale) => setDialog({ type: 'resend', id: sale.id }),
    remove: (sale) => setDialog({ type: 'delete', id: sale.id }),
    duplicate: duplicateSale,
    journal: (sale) => setDialog({ type: 'journal', id: sale.id }),
    void: (sale) => setDialog({ type: 'void', id: sale.id }),
    lateFee: toLateFeeInvoice,
    // Retur punya formnya sendiri; fakturnya dibawa lewat rute, bukan state lokal.
    makeReturn: (sale) => goForm({ name: 'return-new', from: `invoice:${sale.id}` }),
    // B3: index pembayaran dipakai sebagai kuncinya, karena pembayaran tidak punya id.
    voidPayment: (sale, index) => setDialog({ type: 'void-payment', id: sale.id, index }),
  };

  const stats = useMemo(() => {
    // Draf belum terbit dan faktur batal tidak lagi menagih: dua-duanya di luar hitungan.
    const issued = sales.filter((s) => statusOf(s) !== 'draft' && statusOf(s) !== 'cancelled');
    const active = issued.map(computeTotals);
    const sum = (k) => active.reduce((n, t) => n + t[k], 0);
    const overdue = sales.filter(isOverdue).length;
    return [
      {
        label: 'Total Penjualan',
        // B5: penjualan neto — seluruh retur mengurangi, baik yang memotong tagihan
        // maupun yang menjadi kredit pelanggan, karena dua-duanya ke Retur Penjualan.
        value: rupiahShort(sum('total') - sum('returnedTotal')),
        hint: sum('returnedTotal')
          ? `${issued.length} faktur terbit · setelah retur ${rupiahShort(sum('returnedTotal'))}`
          : `${issued.length} faktur terbit`,
        icon: Invoice,
        color: 'primary',
      },
      {
        label: 'Sisa Tagihan (Piutang)',
        value: rupiahShort(sum('balance')),
        hint: 'Menunggu pelunasan',
        icon: Clock,
        color: 'orange',
      },
      {
        // Isinya total penerimaan kas, termasuk cicilan faktur yang belum lunas.
        label: 'Kas Diterima',
        value: rupiahShort(sum('paid')),
        hint: 'Termasuk cicilan faktur berjalan',
        icon: Check,
        color: 'green',
      },
      {
        label: 'Lewat Jatuh Tempo',
        value: `${overdue} Faktur`,
        hint: overdue ? 'Perlu segera ditagih' : 'Tidak ada tunggakan',
        icon: Warning,
        color: overdue ? 'red' : 'gray',
      },
    ];
  }, [sales]);

  // Jumlah per tab dihitung dari seluruh data, bukan dari hasil pencarian,
  // supaya angkanya tidak berubah-ubah saat mengetik.
  const tabCounts = useMemo(
    () => Object.fromEntries(tabs.map((t) => [t.value, sales.filter(t.match).length])),
    [sales],
  );

  const filtered = useMemo(() => {
    const match = tabs.find((t) => t.value === tab).match;
    // Saringan status hanya berlaku di tab "Sudah Dikirim"; draf belum punya status bayar.
    const byStatus =
      tab === 'sent' ? statusFilters.find((f) => f.value === status).match : () => true;
    const q = query.trim().toLowerCase();
    return sales.filter((s) => {
      if (!match(s) || !byStatus(s)) return false;
      if (!q) return true;
      const c = toCustomer(contactsById[s.customerId]);
      return [s.number, s.ref, c?.name, c?.email].some((v) => v?.toLowerCase().includes(q));
    });
  }, [sales, contactsById, tab, status, query]);

  const size = Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, totalPages);
  const pageRows = filtered.slice((current - 1) * size, current * size);

  const detail = sales.find((s) => s.id === detailId);
  const paying = sales.find((s) => s.id === payId);
  // Dokumen dialog dibaca ulang dari daftar agar isinya ikut perubahan terbaru.
  const dialogSale = dialog && sales.find((s) => s.id === dialog.id);

  const modals = (
    <>
      {dialogSale && (dialog.type === 'send' || dialog.type === 'resend') && (
        <SendModal
          key={dialogSale.id}
          sale={dialogSale}
          resend={dialog.type === 'resend'}
          onClose={closeDialog}
          onSend={(data) => sendSale(dialogSale, data, dialog.type === 'resend')}
        />
      )}
      {dialog?.type === 'bulk' && (
        <BulkBillingModal
          contacts={contacts.filter(canBeInvoiced)}
          onClose={closeDialog}
          onCreate={createBulk}
        />
      )}
      {dialogSale && dialog.type === 'void' && (
        <ReasonModal
          title="Batalkan Faktur"
          subtitle={`${dialogSale.number} dibatalkan dan jurnalnya dibalik. Fakturnya tetap tersimpan.`}
          label="Alasan pembatalan"
          options={VOID_REASONS}
          confirmLabel="Batalkan faktur"
          onClose={closeDialog}
          onConfirm={(reason) => voidSale(dialogSale, reason)}
        />
      )}
      {dialogSale && dialog.type === 'void-payment' && (
        <ReasonModal
          title="Batalkan Pembayaran"
          subtitle={`${rupiah(dialogSale.payments[dialog.index].amount)} pada ${dialogSale.number} dibalik jurnalnya. Catatannya tetap tersimpan sebagai jejak.`}
          label="Alasan pembatalan"
          options={PAYMENT_VOID_REASONS}
          confirmLabel="Batalkan pembayaran"
          onClose={closeDialog}
          onConfirm={(reason) => voidPaymentAt(dialogSale.id, dialog.index, reason)}
        />
      )}
      {dialogSale && dialog.type === 'journal' && (
        <JournalModal
          sale={dialogSale}
          journals={saleJournals(dialogSale, salesReturns)}
          onClose={closeDialog}
        />
      )}
      {dialogSale && dialog.type === 'delete' && (
        <DeleteModal
          sale={dialogSale}
          onClose={closeDialog}
          onDelete={() => deleteSale(dialogSale)}
        />
      )}
      <PaymentModal
        sale={paying}
        credit={paying ? customerCredit(salesReturns, paying.customerId) : 0}
        onClose={() => setPayId(null)}
        onSave={savePayment}
      />
    </>
  );

  if (detail) {
    return (
      <>
        <SaleDetail
          sale={detail}
          source={sourceOf(detail, orders, quotes)}
          onBack={closeDetail}
          onPay={() => setPayId(detail.id)}
          onCreateLink={() => createLink(detail.id)}
          actions={actions}
        />
        {modals}
      </>
    );
  }

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro
        title="Faktur Penjualan"
        description="Kelola seluruh tagihan penjualan, invoice ke pelanggan/unit properti, catat penerimaan kas, dan pantau status jatuh tempo pembayaran secara akurat."
        actions={
          <>
            <ActionIcon
              variant="default"
              size="lg"
              radius="md"
              aria-label="Segarkan data penjualan"
            >
              <ArrowsClockwise size={16} />
            </ActionIcon>
            <Button
              variant="default"
              radius="md"
              leftSection={<ClipboardText size={16} />}
              onClick={() => setDialog({ type: 'bulk' })}
            >
              Tagihan Rutin
            </Button>
            <Button
              radius="md"
              leftSection={<Plus size={16} />}
              onClick={() => goForm({ name: 'sale-new' })}
            >
              Buat Faktur
            </Button>
          </>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </SimpleGrid>

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group gap={4} mb="md">
          {tabs.map((t) => {
            const active = tab === t.value;
            return (
              <Button
                key={t.value}
                size="sm"
                radius="md"
                variant={active ? 'filled' : 'subtle'}
                color={active ? 'primary.9' : 'slate.7'}
                leftSection={<t.icon size={16} />}
                fw={active ? 700 : 500}
                fz="xs"
                onClick={() => {
                  setTab(t.value);
                  setPage(1);
                }}
              >
                {t.label} ({tabCounts[t.value]})
              </Button>
            );
          })}
        </Group>

        <Group gap="sm" mb="md">
          <TextInput
            placeholder="Cari nomor transaksi, pelanggan, atau referensi..."
            size="sm"
            radius="md"
            w={320}
            maw="100%"
            leftSection={<MagnifyingGlass size={14} />}
            value={query}
            onChange={(e) => {
              setQuery(e.currentTarget.value);
              setPage(1);
            }}
          />
          {tab === 'sent' && (
            <Select
              size="sm"
              radius="md"
              w={170}
              allowDeselect={false}
              aria-label="Saring status pembayaran"
              data={statusFilters.map((f) => ({ value: f.value, label: f.label }))}
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            />
          )}
        </Group>

        <Box
          className="table-frame"
          style={{
            border: '1px solid var(--mantine-color-gray-3)',
            borderRadius: 'var(--mantine-radius-md)',
            overflow: 'hidden',
          }}
        >
          <ScrollArea type="auto">
            <Table
              verticalSpacing="sm"
              horizontalSpacing="md"
              miw={1100}
              highlightOnHover
              styles={{
                th: {
                  fontSize: 'var(--mantine-font-size-xs)',
                  color: 'var(--mantine-color-slate-7)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                },
              }}
            >
              <Table.Thead bg="slate.0">
                <Table.Tr>
                  <Table.Th>No. Transaksi</Table.Th>
                  <Table.Th>Pelanggan</Table.Th>
                  <Table.Th>Tanggal</Table.Th>
                  <Table.Th>Jatuh Tempo</Table.Th>
                  <Table.Th ta="right">Total Faktur</Table.Th>
                  <Table.Th ta="right">Sisa Tagihan</Table.Th>
                  <Table.Th ta="center">Status</Table.Th>
                  <Table.Th ta="center" w={60}>
                    Aksi
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {pageRows.map((s) => (
                  <SaleRow
                    key={s.id}
                    sale={s}
                    onOpen={() => openDetail(s.id)}
                    onPay={() => setPayId(s.id)}
                    onCreateLink={() => createLink(s.id)}
                    actions={actions}
                  />
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Box>

        {filtered.length === 0 && (
          <Center py="xl">
            <Text fz="sm" c="slate.6">
              Tidak ada faktur penjualan yang cocok.
            </Text>
          </Center>
        )}

        <Group justify="space-between" mt="md" gap="sm">
          <Text fz="xs" c="slate.7">
            Menampilkan {pageRows.length} dari {filtered.length} data faktur
          </Text>
          <Group gap="sm">
            <Select
              size="xs"
              radius="md"
              w={96}
              allowDeselect={false}
              data={pageSizes}
              value={pageSize}
              onChange={(v) => {
                setPageSize(v);
                setPage(1);
              }}
            />
            <Pagination
              size="sm"
              radius="md"
              total={totalPages}
              value={current}
              onChange={setPage}
            />
          </Group>
        </Group>
      </Card>

      {modals}
    </Stack>
  );
}
