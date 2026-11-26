// Daftar Pesanan Penjualan. Alurnya: draf → dikirim → dikonfirmasi → difakturkan.
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Group,
  Menu,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
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
  Invoice,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  Prohibit,
  Trash,
} from '@/components/Icon.jsx';
import { useData } from '@/lib/store.jsx';
import { ListShell, TabBar } from '@/pages/Pembelian/components.jsx';
import { toCustomer } from '@/pages/Kontak/utils.js';
import { CopyIcon, PageIntro, StatusBadge } from './components.jsx';
import { DeleteModal, SendModal } from './Dialogs.jsx';
import OrderDetail from './OrderDetail.jsx';
import { DOC } from './docTypes.js';
import { formatHash } from './routes.js';
import { paymentTerms } from './data.js';
import {
  canCancelOrder,
  canConfirmOrder,
  canDeleteOrder,
  canEditOrder,
  canInvoiceOrder,
  canResendOrder,
  canSendOrder,
  duplicateOrder,
  nextOrderNumber,
  ORDER_STATUS,
  orderRemaining,
  orderStatus,
  orderValueSplit,
} from './orders.js';
import { computeTotals, formatDate, nowIso, rupiah, rupiahShort, useCustomer } from './utils.js';

const tabs = [
  {
    value: 'open',
    label: 'Berjalan',
    match: (o) => ['draft', 'sent', 'confirmed', 'partial'].includes(orderStatus(o)),
  },
  { value: 'done', label: 'Selesai', match: (o) => orderStatus(o) === 'invoiced' },
  { value: 'cancelled', label: 'Dibatalkan', match: (o) => orderStatus(o) === 'cancelled' },
];

// S14: rincian dan form pesanan punya alamatnya sendiri, bukan state lokal.
const goForm = (v) => {
  window.location.hash = formatHash(v);
  window.scrollTo({ top: 0 });
};

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

function OrderRow({ order, onOpen, actions }) {
  const t = computeTotals(order);
  const customer = useCustomer(order.customerId);
  const status = orderStatus(order);

  return (
    <Table.Tr>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <UnstyledButton onClick={onOpen}>
            <Text fz="sm" fw={700} c="primary.9" style={{ whiteSpace: 'nowrap' }}>
              {order.number}
            </Text>
          </UnstyledButton>
          <CopyIcon value={order.number} />
        </Group>
        {order.ref && (
          <Text fz={11} c="slate.6">
            Ref: {order.ref}
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
        {formatDate(order.date)}
      </Table.Td>
      <Table.Td fz="sm" c="slate.8" style={{ whiteSpace: 'nowrap' }}>
        {formatDate(order.dueDate)}
      </Table.Td>
      <Table.Td ta="right">
        <Text fz="sm" fw={700} c="slate.9" style={{ whiteSpace: 'nowrap' }}>
          {rupiah(t.total)}
        </Text>
        {status === 'partial' && (
          <Text fz={11} c="orange.8" style={{ whiteSpace: 'nowrap' }}>
            Sisa {orderRemaining(order)} belum difaktur
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="center">
        <StatusBadge status={status} map={ORDER_STATUS} size="xs" />
      </Table.Td>
      <Table.Td ta="center">
        <Menu position="bottom-end" withinPortal shadow="md" width={210}>
          <Menu.Target>
            <ActionIcon variant="subtle" color="slate" aria-label={`Aksi ${order.number}`}>
              <DotsThreeVertical size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item fz="xs" leftSection={<Eye size={14} />} onClick={onOpen}>
              Lihat Rincian
            </Menu.Item>
            {canEditOrder(order) && (
              <Menu.Item
                fz="xs"
                leftSection={<PencilSimple size={14} />}
                onClick={() => actions.edit(order)}
              >
                Ubah Pesanan
              </Menu.Item>
            )}
            {canSendOrder(order) && (
              <Menu.Item
                fz="xs"
                leftSection={<PaperPlaneTilt size={14} />}
                onClick={() => actions.send(order)}
              >
                Kirim Pesanan
              </Menu.Item>
            )}
            {canConfirmOrder(order) && (
              <Menu.Item
                fz="xs"
                leftSection={<CheckCircle size={14} />}
                onClick={() => actions.confirm(order)}
              >
                Tandai Dikonfirmasi
              </Menu.Item>
            )}
            {canInvoiceOrder(order) && (
              <Menu.Item
                fz="xs"
                leftSection={<Invoice size={14} />}
                onClick={() => actions.invoice(order)}
              >
                Buat Faktur
              </Menu.Item>
            )}
            {canResendOrder(order) && (
              <Menu.Item
                fz="xs"
                leftSection={<EnvelopeSimple size={14} />}
                onClick={() => actions.resend(order)}
              >
                Kirim Ulang Email
              </Menu.Item>
            )}
            <Menu.Item
              fz="xs"
              leftSection={<Copy size={14} />}
              onClick={() => actions.duplicate(order)}
            >
              Duplikat Pesanan
            </Menu.Item>
            {(canCancelOrder(order) || canDeleteOrder(order)) && <Menu.Divider />}
            {canCancelOrder(order) && (
              <Menu.Item
                fz="xs"
                color="red"
                leftSection={<Prohibit size={14} />}
                onClick={() => actions.cancel(order)}
              >
                Batalkan Pesanan
              </Menu.Item>
            )}
            {canDeleteOrder(order) && (
              <Menu.Item
                fz="xs"
                color="red"
                leftSection={<Trash size={14} />}
                onClick={() => actions.remove(order)}
              >
                Hapus Pesanan
              </Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  );
}

export default function Orders({ params }) {
  const { orders, setOrders, sales, quotes, contactsById } = useData();
  const detailId = params?.orderId ?? null;
  const [dialog, setDialog] = useState(null);
  const [tab, setTab] = useState('open');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  const update = (id, fn) =>
    setOrders((list) => list.map((o) => (o.id === id ? { ...fn(o), updatedAt: nowIso() } : o)));
  const closeDialog = () => setDialog(null);
  const openDetail = (id) => goForm({ name: 'order', id });
  const closeDetail = () => goForm({ name: 'tab', tab: 'orders' });

  // --- aksi pesanan --------------------------------------------------------------
  const sendOrder = (order, { to, note }, resend) => {
    update(order.id, (o) => ({
      ...o,
      draft: resend ? o.draft : false,
      number: o.number || nextOrderNumber(orders),
      message: note || o.message,
      sends: [...(o.sends ?? []), { at: nowIso(), to }],
    }));
    closeDialog();
    toast(
      resend ? 'Pesanan dikirim ulang' : 'Pesanan terkirim',
      `${order.number} dikirim ke ${to}.`,
    );
  };

  const confirmOrder = (order) => {
    update(order.id, (o) => ({ ...o, confirmedAt: nowIso() }));
    toast('Pesanan dikonfirmasi', `${order.number} siap difakturkan.`);
  };

  const cancelOrder = (order) => {
    update(order.id, (o) => ({ ...o, cancelledAt: nowIso() }));
    toast('Pesanan dibatalkan', `${order.number} tidak bisa dilanjutkan lagi.`, 'red');
  };

  const deleteOrder = (order) => {
    setOrders((list) => list.filter((o) => o.id !== order.id));
    closeDialog();
    if (detailId === order.id) closeDetail();
    toast('Pesanan dihapus', `Draf ${order.number} dihapus permanen.`, 'red');
  };

  const duplicate = (order) => {
    const days = paymentTerms.find((t) => t.value === order.term)?.days;
    const copy = duplicateOrder(order, nextOrderNumber(orders), days);
    setOrders((list) => [copy, ...list]);
    toast('Pesanan diduplikat', `Salinan ${order.number} dibuat sebagai draf ${copy.number}.`);
    goForm({ name: 'order', id: copy.id });
  };

  // S1: tombol membuka form faktur yang sudah terisi dari pesanan, bukan langsung
  // menerbitkan. Penautan dan pengurangan sisa qty terjadi saat formnya disimpan.
  const toInvoice = (order) => goForm({ name: 'sale-new', from: `order:${order.id}` });

  const actions = {
    edit: (order) => goForm({ name: 'order-edit', id: order.id }),
    send: (order) => setDialog({ type: 'send', id: order.id }),
    resend: (order) => setDialog({ type: 'resend', id: order.id }),
    remove: (order) => setDialog({ type: 'delete', id: order.id }),
    confirm: confirmOrder,
    cancel: cancelOrder,
    invoice: toInvoice,
    duplicate,
  };

  const stats = useMemo(() => {
    const total = (o) => computeTotals(o).total;
    const waiting = orders.filter((o) => orderStatus(o) === 'sent');
    const ready = orders.filter((o) => ['confirmed', 'partial'].includes(orderStatus(o)));
    const done = orders.filter((o) => ['partial', 'invoiced'].includes(orderStatus(o)));
    const sum = (list) => list.reduce((n, o) => n + total(o), 0);
    // B9: pesanan yang difakturkan sebagian ikut dihitung di dua kartu, masing-masing
    // sebesar porsinya — bukan seluruh nilai pesanan di salah satunya.
    const sumSisa = (list) => list.reduce((n, o) => n + orderValueSplit(o).remaining, 0);
    const sumDifaktur = (list) => list.reduce((n, o) => n + orderValueSplit(o).invoiced, 0);
    return [
      {
        label: 'Menunggu konfirmasi',
        value: rupiahShort(sum(waiting)),
        hint: `${waiting.length} menunggu konfirmasi`,
        icon: PaperPlaneTilt,
        color: 'blue',
      },
      {
        label: 'Siap difakturkan',
        value: rupiahShort(sumSisa(ready)),
        hint: `${ready.length} pesanan siap ditagih`,
        icon: CheckCircle,
        color: 'green',
      },
      {
        label: 'Sudah difakturkan',
        value: rupiahShort(sumDifaktur(done)),
        hint: `${orders.filter((o) => orderStatus(o) === 'invoiced').length} pesanan selesai`,
        icon: Invoice,
        color: 'primary',
      },
    ];
  }, [orders]);

  const tabCounts = useMemo(
    () => Object.fromEntries(tabs.map((t) => [t.value, orders.filter(t.match).length])),
    [orders],
  );

  const filtered = useMemo(() => {
    const match = tabs.find((t) => t.value === tab).match;
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (!match(o)) return false;
      if (!q) return true;
      const c = toCustomer(contactsById[o.customerId]);
      return [o.number, o.ref, c?.name, c?.email].some((v) => v?.toLowerCase().includes(q));
    });
  }, [orders, contactsById, tab, query]);

  const detail = orders.find((o) => o.id === detailId);
  const dialogOrder = dialog && orders.find((o) => o.id === dialog.id);

  const modals = (
    <>
      {dialogOrder && (dialog.type === 'send' || dialog.type === 'resend') && (
        <SendModal
          key={dialogOrder.id}
          sale={dialogOrder}
          doc={DOC.order}
          resend={dialog.type === 'resend'}
          onClose={closeDialog}
          onSend={(data) => sendOrder(dialogOrder, data, dialog.type === 'resend')}
        />
      )}
      {dialogOrder && dialog.type === 'delete' && (
        <DeleteModal
          sale={dialogOrder}
          doc={DOC.order}
          onClose={closeDialog}
          onDelete={() => deleteOrder(dialogOrder)}
        />
      )}
    </>
  );

  if (detail) {
    return (
      <>
        <OrderDetail
          order={detail}
          invoices={sales.filter((s) => (detail.invoiceIds ?? []).includes(s.id))}
          quote={quotes.find((q) => q.id === detail.fromQuote)}
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
        icon={ClipboardText}
        title="Pesanan Penjualan"
        description="Pesanan yang sudah disepakati pelanggan. Setelah dikonfirmasi, pesanan bisa diterbitkan menjadi faktur."
        actions={
          <>
            <ActionIcon variant="default" size="lg" radius="md" aria-label="Segarkan data pesanan">
              <ArrowsClockwise size={16} />
            </ActionIcon>
            <Button
              radius="md"
              leftSection={<Plus size={16} />}
              onClick={() => goForm({ name: 'order-new' })}
            >
              Buat Pesanan
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
          placeholder="Cari nomor pesanan, pelanggan, atau referensi..."
          head={[
            { label: 'No. Pesanan' },
            { label: 'Pelanggan' },
            { label: 'Tanggal' },
            { label: 'Target selesai' },
            { label: 'Nilai Pesanan', align: 'right' },
            { label: 'Status', align: 'center' },
            { label: 'Aksi', align: 'center', w: 60 },
          ]}
          rows={filtered.map((o) => (
            <OrderRow key={o.id} order={o} onOpen={() => openDetail(o.id)} actions={actions} />
          ))}
          noun="pesanan"
          minWidth={960}
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
