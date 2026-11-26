// Daftar Penawaran. Alurnya: draf → dikirim → diterima/ditolak → jadi pesanan.
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  SimpleGrid,
  Stack,
  Table,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { StatCard } from '@/components/StatCards.jsx';
import { notifications } from '@mantine/notifications';
import { useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  CheckCircle,
  ClipboardText,
  Copy,
  DotsThreeVertical,
  EnvelopeSimple,
  Eye,
  FileText,
  Invoice,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  Prohibit,
  Trash,
  TrendUp,
} from '@/components/Icon.jsx';
import { useData } from '@/lib/store.jsx';
import { ListShell, TabBar } from '@/pages/Pembelian/components.jsx';
import { toCustomer } from '@/pages/Kontak/utils.js';
import { CopyIcon, PageIntro, StatusBadge } from './components.jsx';
import { DeleteModal, ReasonModal, SendModal } from './Dialogs.jsx';
import { DOC } from './docTypes.js';
import QuoteDetail from './QuoteDetail.jsx';
import { formatHash } from './routes.js';
import {
  canAnswerQuote,
  canConvertQuote,
  canDeleteQuote,
  canEditQuote,
  canCancelQuote,
  canResendQuote,
  canReviseQuote,
  canSendQuote,
  duplicateQuote,
  isClosed,
  isExpired,
  isExpiring,
  reviseQuote,
  nextQuoteNumber,
  QUOTE_STATUS,
  quoteBadge,
  quoteStatus,
} from './quotes.js';
import { computeTotals, formatDate, nowIso, rupiah, rupiahShort, useCustomer } from './utils.js';

// P2: tab mengikuti status. Kedaluwarsa masuk "Selesai" karena sudah tidak
// menunggu jawaban siapa pun.
const tabs = [
  {
    value: 'open',
    label: 'Berjalan',
    match: (q) => ['draft', 'sent'].includes(quoteStatus(q)) && !isExpired(q),
  },
  { value: 'accepted', label: 'Diterima', match: (q) => quoteStatus(q) === 'accepted' },
  { value: 'closed', label: 'Selesai', match: isClosed },
];

// P8: pilihan alasan dibuat tetap supaya bisa dihitung, bukan teks bebas.
const REJECT_REASONS = [
  'Harga',
  'Waktu pengerjaan',
  'Pindah ke kompetitor',
  'Kebutuhan batal',
  'Lainnya',
];
const CANCEL_REASONS = ['Salah input', 'Harga berubah', 'Kebutuhan pelanggan berubah', 'Lainnya'];

// P13: rincian dan form penawaran punya alamatnya sendiri, bukan state lokal.
const goForm = (v) => {
  window.location.hash = formatHash(v);
  window.scrollTo({ top: 0 });
};

const toast = (title, message, color = 'green') =>
  notifications.show({
    color,
    icon: color === 'red' ? <Prohibit size={18} /> : <CheckCircle size={18} />,
    title,
    message,
    autoClose: 5000,
    withBorder: true,
    radius: 'md',
  });


function QuoteRow({ quote, onOpen, actions }) {
  const t = computeTotals(quote);
  const customer = useCustomer(quote.customerId);
  const expired = isExpired(quote);
  const expiring = isExpiring(quote);

  return (
    <Table.Tr>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <UnstyledButton onClick={onOpen}>
            <Text fz="sm" fw={700} c="primary.9" style={{ whiteSpace: 'nowrap' }}>
              {quote.number}
            </Text>
          </UnstyledButton>
          <CopyIcon value={quote.number} />
        </Group>
        {quote.ref && (
          <Text fz={11} c="slate.6">
            Ref: {quote.ref}
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
        {formatDate(quote.date)}
      </Table.Td>
      <Table.Td fz="sm" style={{ whiteSpace: 'nowrap' }}>
        <Text fz="sm" c={expired ? 'orange.8' : 'slate.8'} fw={expired ? 600 : 400}>
          {formatDate(quote.dueDate)}
        </Text>
        {expiring && (
          <Badge size="xs" radius="sm" variant="light" color="orange" fw={700} mt={2}>
            SEGERA BERAKHIR
          </Badge>
        )}
      </Table.Td>
      <Table.Td ta="right">
        <Text fz="sm" fw={700} c="slate.9" style={{ whiteSpace: 'nowrap' }}>
          {rupiah(t.total)}
        </Text>
      </Table.Td>
      <Table.Td ta="center">
        <StatusBadge status={quoteBadge(quote)} map={QUOTE_STATUS} size="xs" />
      </Table.Td>
      <Table.Td ta="center">
        <Menu position="bottom-end" withinPortal shadow="md" width={220}>
          <Menu.Target>
            <ActionIcon variant="subtle" color="slate" aria-label={`Aksi ${quote.number}`}>
              <DotsThreeVertical size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item fz="xs" leftSection={<Eye size={14} />} onClick={onOpen}>
              Lihat Rincian
            </Menu.Item>
            {canEditQuote(quote) && (
              <Menu.Item
                fz="xs"
                leftSection={<PencilSimple size={14} />}
                onClick={() => actions.edit(quote)}
              >
                Ubah Penawaran
              </Menu.Item>
            )}
            {canSendQuote(quote) && (
              <Menu.Item
                fz="xs"
                leftSection={<PaperPlaneTilt size={14} />}
                onClick={() => actions.send(quote)}
              >
                Kirim Penawaran
              </Menu.Item>
            )}
            {canAnswerQuote(quote) && (
              <>
                <Menu.Item
                  fz="xs"
                  leftSection={<CheckCircle size={14} />}
                  onClick={() => actions.accept(quote)}
                >
                  Tandai Diterima
                </Menu.Item>
                <Menu.Item
                  fz="xs"
                  leftSection={<Prohibit size={14} />}
                  onClick={() => actions.reject(quote)}
                >
                  Tandai Ditolak
                </Menu.Item>
              </>
            )}
            {canConvertQuote(quote) && (
              <>
                <Menu.Item
                  fz="xs"
                  leftSection={<ClipboardText size={14} />}
                  onClick={() => actions.convert(quote)}
                >
                  Buat Pesanan
                </Menu.Item>
                <Menu.Item
                  fz="xs"
                  leftSection={<Invoice size={14} />}
                  onClick={() => actions.invoice(quote)}
                >
                  Buat Faktur Langsung
                </Menu.Item>
              </>
            )}
            {canReviseQuote(quote) && (
              <Menu.Item
                fz="xs"
                leftSection={<PencilSimple size={14} />}
                onClick={() => actions.revise(quote)}
              >
                Revisi Penawaran
              </Menu.Item>
            )}
            {canResendQuote(quote) && (
              <Menu.Item
                fz="xs"
                leftSection={<EnvelopeSimple size={14} />}
                onClick={() => actions.resend(quote)}
              >
                Kirim Ulang Email
              </Menu.Item>
            )}
            <Menu.Item
              fz="xs"
              leftSection={<Copy size={14} />}
              onClick={() => actions.duplicate(quote)}
            >
              {expired ? 'Tawarkan Ulang (salin)' : 'Duplikat Penawaran'}
            </Menu.Item>
            {(canCancelQuote(quote) || canDeleteQuote(quote)) && <Menu.Divider />}
            {canCancelQuote(quote) && (
              <Menu.Item
                fz="xs"
                color="red"
                leftSection={<Prohibit size={14} />}
                onClick={() => actions.cancel(quote)}
              >
                Batalkan Penawaran
              </Menu.Item>
            )}
            {canDeleteQuote(quote) && (
              <>
                <Menu.Item
                  fz="xs"
                  color="red"
                  leftSection={<Trash size={14} />}
                  onClick={() => actions.remove(quote)}
                >
                  Hapus Penawaran
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  );
}

export default function Quotes({ params }) {
  const { quotes, setQuotes, orders, sales, contactsById } = useData();
  const detailId = params?.quoteId ?? null;
  const [dialog, setDialog] = useState(null);
  const [tab, setTab] = useState('open');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  const update = (id, fn) =>
    setQuotes((list) => list.map((q) => (q.id === id ? { ...fn(q), updatedAt: nowIso() } : q)));
  const closeDialog = () => setDialog(null);
  const openDetail = (id) => goForm({ name: 'quote', id });
  const closeDetail = () => goForm({ name: 'tab', tab: 'quotes' });

  const sendQuote = (quote, { to, note }, resend) => {
    update(quote.id, (q) => ({
      ...q,
      draft: resend ? q.draft : false,
      number: q.number || nextQuoteNumber(quotes),
      message: note || q.message,
      sends: [...(q.sends ?? []), { at: nowIso(), to }],
    }));
    closeDialog();
    toast(
      resend ? 'Penawaran dikirim ulang' : 'Penawaran terkirim',
      `${quote.number} dikirim ke ${to}.`,
    );
  };

  const accept = (quote) => {
    update(quote.id, (q) => ({ ...q, acceptedAt: nowIso(), rejectedAt: null }));
    toast('Penawaran diterima', `${quote.number} bisa dilanjutkan menjadi pesanan.`);
  };

  // P8: penolakan selalu disertai alasan, supaya ada datanya untuk laporan kalah-menang.
  const reject = (quote, reason) => {
    update(quote.id, (q) => ({
      ...q,
      rejectedAt: nowIso(),
      rejectReason: reason,
      acceptedAt: null,
    }));
    closeDialog();
    toast('Penawaran ditolak', `${quote.number} ditutup — ${reason}.`, 'red');
  };

  // P4: pembatalan dari pihak kita (beda dengan ditolak pelanggan).
  const cancel = (quote, reason) => {
    update(quote.id, (q) => ({ ...q, cancelledAt: nowIso(), cancelReason: reason }));
    closeDialog();
    toast('Penawaran dibatalkan', `${quote.number} — ${reason}.`, 'red');
  };

  // P4: revisi membuat versi baru bernomor turunan; versi lama ditutup sebagai Direvisi.
  const revise = (quote) => {
    const next = reviseQuote(quote);
    setQuotes((list) => [next, ...list]);
    update(quote.id, (q) => ({ ...q, revisedToId: next.id }));
    toast('Penawaran direvisi', `${next.number} dibuat dari ${quote.number}.`);
    goForm({ name: 'quote-edit', id: next.id });
  };

  // P12: faktur langsung dari penawaran, juga lewat form yang sudah terisi.
  const toInvoice = (quote) => goForm({ name: 'sale-new', from: `quote:${quote.id}` });

  const deleteQuote = (quote) => {
    setQuotes((list) => list.filter((q) => q.id !== quote.id));
    closeDialog();
    if (detailId === quote.id) closeDetail();
    toast('Penawaran dihapus', `Draf ${quote.number} dihapus permanen.`, 'red');
  };

  const duplicate = (quote) => {
    const copy = duplicateQuote(quote, nextQuoteNumber(quotes));
    setQuotes((list) => [copy, ...list]);
    toast(
      'Penawaran disalin',
      `${copy.number} dibuat sebagai draf dengan masa berlaku sampai ${formatDate(copy.dueDate)}.`,
    );
    goForm({ name: 'quote', id: copy.id });
  };

  // S1/S5: konversi membuka form yang sudah terisi; penautan terjadi saat disimpan.
  const convert = (quote) => goForm({ name: 'order-new', from: `quote:${quote.id}` });

  const actions = {
    edit: (quote) => goForm({ name: 'quote-edit', id: quote.id }),
    send: (quote) => setDialog({ type: 'send', id: quote.id }),
    resend: (quote) => setDialog({ type: 'resend', id: quote.id }),
    remove: (quote) => setDialog({ type: 'delete', id: quote.id }),
    accept,
    reject: (quote) => setDialog({ type: 'reject', id: quote.id }),
    cancel: (quote) => setDialog({ type: 'cancel', id: quote.id }),
    revise,
    convert,
    invoice: toInvoice,
    duplicate,
  };

  const stats = useMemo(() => {
    const total = (q) => computeTotals(q).total;
    const waiting = quotes.filter((q) => quoteStatus(q) === 'sent' && !isExpired(q));
    const accepted = quotes.filter((q) =>
      ['accepted', 'converted', 'invoiced'].includes(quoteStatus(q)),
    );
    // P3: kedaluwarsa dihitung sebagai gagal — pelanggan tidak pernah menjawab.
    const lost = quotes.filter((q) => quoteStatus(q) === 'rejected' || isExpired(q));
    const decided = accepted.length + lost.length;
    const rate = decided ? Math.round((accepted.length / decided) * 100) : 0;
    const sum = (list) => list.reduce((n, q) => n + total(q), 0);
    return [
      {
        label: 'Menunggu jawaban',
        value: rupiahShort(sum(waiting)),
        hint: `${waiting.length} menunggu jawaban`,
        icon: PaperPlaneTilt,
        color: 'blue',
      },
      {
        label: 'Diterima pelanggan',
        value: rupiahShort(sum(accepted)),
        hint: `${accepted.length} penawaran disetujui`,
        icon: CheckCircle,
        color: 'green',
      },
      {
        // Angka yang paling dicari dari modul penawaran: berapa yang jadi.
        label: 'Tingkat konversi',
        value: `${rate}%`,
        hint: `${accepted.length} diterima dari ${decided} yang selesai`,
        icon: TrendUp,
        color: 'primary',
      },
    ];
  }, [quotes]);

  const tabCounts = useMemo(
    () => Object.fromEntries(tabs.map((t) => [t.value, quotes.filter(t.match).length])),
    [quotes],
  );

  const filtered = useMemo(() => {
    const match = tabs.find((t) => t.value === tab).match;
    const q = query.trim().toLowerCase();
    return quotes.filter((quote) => {
      if (!match(quote)) return false;
      if (!q) return true;
      const c = toCustomer(contactsById[quote.customerId]);
      return [quote.number, quote.ref, c?.name, c?.email].some((v) => v?.toLowerCase().includes(q));
    });
  }, [quotes, contactsById, tab, query]);

  const detail = quotes.find((q) => q.id === detailId);
  const dialogQuote = dialog && quotes.find((q) => q.id === dialog.id);

  const modals = (
    <>
      {dialogQuote && (dialog.type === 'send' || dialog.type === 'resend') && (
        <SendModal
          key={dialogQuote.id}
          sale={dialogQuote}
          doc={DOC.quote}
          resend={dialog.type === 'resend'}
          onClose={closeDialog}
          onSend={(data) => sendQuote(dialogQuote, data, dialog.type === 'resend')}
        />
      )}
      {dialogQuote && dialog.type === 'reject' && (
        <ReasonModal
          title="Tandai Penawaran Ditolak"
          subtitle={`${dialogQuote.number} ditutup dan tidak bisa dilanjutkan.`}
          label="Alasan penolakan"
          options={REJECT_REASONS}
          notePlaceholder="Opsional, misalnya nama kompetitor atau selisih harganya..."

          confirmLabel="Tandai ditolak"
          onClose={closeDialog}
          onConfirm={(reason) => reject(dialogQuote, reason)}
        />
      )}
      {dialogQuote && dialog.type === 'cancel' && (
        <ReasonModal
          title="Batalkan Penawaran"
          subtitle={`${dialogQuote.number} ditarik kembali sebelum pelanggan menjawab.`}
          label="Alasan pembatalan"
          options={CANCEL_REASONS}
          confirmLabel="Batalkan penawaran"
          onClose={closeDialog}
          onConfirm={(reason) => cancel(dialogQuote, reason)}
        />
      )}
      {dialogQuote && dialog.type === 'delete' && (
        <DeleteModal
          sale={dialogQuote}
          doc={DOC.quote}
          onClose={closeDialog}
          onDelete={() => deleteQuote(dialogQuote)}
        />
      )}
    </>
  );

  if (detail) {
    return (
      <>
        <QuoteDetail
          quote={detail}
          order={orders.find((o) => o.id === detail.orderId)}
          invoice={sales.find((x) => x.id === detail.invoiceId)}
          revisedTo={quotes.find((x) => x.id === detail.revisedToId)}
          onBack={closeDetail}
          actions={actions}
        />
        {modals}
      </>
    );
  }

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro
        icon={FileText}
        title="Penawaran"
        description="Harga yang diajukan ke pelanggan sebelum ada kesepakatan. Penawaran yang diterima dilanjutkan menjadi pesanan penjualan."
        actions={
          <>
            <ActionIcon
              variant="default"
              size="lg"
              radius="md"
              aria-label="Segarkan data penawaran"
            >
              <ArrowsClockwise size={16} />
            </ActionIcon>
            <Button
              radius="md"
              leftSection={<Plus size={16} />}
              onClick={() => goForm({ name: 'quote-new' })}
            >
              Buat Penawaran
            </Button>
          </>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </SimpleGrid>

      <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
        <TabBar
          tabs={tabs.map((t) => ({ ...t, label: `${t.label} (${tabCounts[t.value]})` }))}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
          }}
        />
        <ListShell
          query={query}
          onQuery={(v) => {
            setQuery(v);
            setPage(1);
          }}
          placeholder="Cari nomor penawaran, pelanggan, atau referensi..."
          head={[
            { label: 'No. Penawaran' },
            { label: 'Pelanggan' },
            { label: 'Tanggal' },
            { label: 'Berlaku sampai' },
            { label: 'Nilai Penawaran', align: 'right' },
            { label: 'Status', align: 'center' },
            { label: 'Aksi', align: 'center', w: 60 },
          ]}
          rows={filtered.map((q) => (
            <QuoteRow key={q.id} quote={q} onOpen={() => openDetail(q.id)} actions={actions} />
          ))}
          noun="penawaran"
          minWidth={980}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
        />
      </Card>

      {modals}
    </Stack>
  );
}
