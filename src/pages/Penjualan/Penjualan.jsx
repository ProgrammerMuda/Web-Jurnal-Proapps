import {
  ActionIcon,
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
  UnstyledButton,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  Check,
  Clock,
  DotsThreeVertical,
  DownloadSimple,
  Eye,
  FileText,
  Invoice,
  Link,
  MagnifyingGlass,
  Plus,
  Warning,
} from '@/components/Icon.jsx';
import { CopyIcon, PageIntro, StatusBadge } from './components.jsx';
import PaymentModal from './PaymentModal.jsx';
import SaleDetail from './SaleDetail.jsx';
import SaleFormModal from './SaleFormModal.jsx';
import {
  computeTotals,
  formatDate,
  isOverdue,
  nowIso,
  rupiah,
  rupiahShort,
  statusOf,
  useCustomer,
} from './utils.js';
import { useData } from '@/lib/store.jsx';
import { toCustomer } from '@/pages/Kontak/utils.js';

const tabs = [
  { value: 'all', label: 'Semua Penjualan', icon: Invoice, match: () => true },
  { value: 'unpaid', label: 'Belum Lunas', icon: Clock, match: (s) => statusOf(s) === 'sent' },
  { value: 'paid', label: 'Lunas', icon: Check, match: (s) => statusOf(s) === 'paid' },
  { value: 'draft', label: 'Draft', icon: FileText, match: (s) => statusOf(s) === 'draft' },
  { value: 'overdue', label: 'Jatuh Tempo', icon: Warning, match: isOverdue },
];

const pageSizes = ['10', '20', '50'].map((v) => ({ value: v, label: `${v} / hal` }));

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

function SaleRow({ sale, onOpen, onPay, onCreateLink }) {
  const t = computeTotals(sale);
  const status = statusOf(sale);
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
        <StatusBadge status={status} size="xs" />
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
            {status === 'sent' && (
              <Menu.Item fz="xs" leftSection={<Invoice size={14} />} onClick={onPay}>
                Catat Pembayaran
              </Menu.Item>
            )}
            <Menu.Item fz="xs" leftSection={<Link size={14} />} onClick={onCreateLink}>
              Tautan Invoice
            </Menu.Item>
            <Menu.Item fz="xs" leftSection={<DownloadSimple size={14} />}>
              Unduh Faktur PDF
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  );
}

// params (dari halaman lain): { saleId } membuka rincian, { createFor } membuka form untuk kontak itu.
export default function Penjualan({ params }) {
  const { sales, setSales, contactsById } = useData();
  const [detailId, setDetailId] = useState(params?.saleId ?? null);
  const [createOpen, setCreateOpen] = useState(!!params?.createFor);
  const [payId, setPayId] = useState(null);

  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  const updateSale = (id, fn) =>
    setSales((list) => list.map((s) => (s.id === id ? { ...fn(s), updatedAt: nowIso() } : s)));

  const openDetail = (id) => {
    setDetailId(id);
    window.scrollTo({ top: 0 });
  };

  // Tautan faktur dibuat sekali, lalu disalin ke clipboard setiap kali diminta.
  const createLink = (id) => {
    const sale = sales.find((s) => s.id === id);
    const link = sale.invoiceLink ?? `https://jurnal.proapps.id/invoice/${id}`;
    if (!sale.invoiceLink) updateSale(id, (s) => ({ ...s, invoiceLink: link }));
    navigator.clipboard?.writeText(link).catch(() => {});
  };

  const savePayment = (payment) => {
    updateSale(payId, (s) => ({ ...s, payments: [...s.payments, payment] }));
    setPayId(null);
  };

  const saveSale = (sale) => {
    setSales((list) => [sale, ...list]);
    setCreateOpen(false);
    setTab('all');
    setQuery('');
    setPage(1);
  };

  const stats = useMemo(() => {
    const active = sales.filter((s) => !s.draft).map(computeTotals);
    const sum = (k) => active.reduce((n, t) => n + t[k], 0);
    const overdue = sales.filter(isOverdue).length;
    return [
      {
        label: 'Total Penjualan',
        value: rupiahShort(sum('total')),
        hint: `${sales.length} faktur tercatat`,
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
        label: 'Sudah Diterima (Lunas)',
        value: rupiahShort(sum('paid')),
        hint: 'Pembayaran terverifikasi',
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

  const filtered = useMemo(() => {
    const match = tabs.find((t) => t.value === tab).match;
    const q = query.trim().toLowerCase();
    return sales.filter((s) => {
      if (!match(s)) return false;
      if (!q) return true;
      const c = toCustomer(contactsById[s.customerId]);
      return [s.number, s.ref, c?.name, c?.email].some((v) => v?.toLowerCase().includes(q));
    });
  }, [sales, contactsById, tab, query]);

  const size = Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, totalPages);
  const pageRows = filtered.slice((current - 1) * size, current * size);

  const detail = sales.find((s) => s.id === detailId);
  const paying = sales.find((s) => s.id === payId);

  const modals = (
    <>
      <SaleFormModal
        opened={createOpen}
        initialCustomerId={params?.createFor}
        onClose={() => setCreateOpen(false)}
        onSave={saveSale}
      />
      <PaymentModal sale={paying} onClose={() => setPayId(null)} onSave={savePayment} />
    </>
  );

  if (detail) {
    return (
      <>
        <SaleDetail
          sale={detail}
          onBack={() => setDetailId(null)}
          onPay={() => setPayId(detail.id)}
          onCreateLink={() => createLink(detail.id)}
        />
        {modals}
      </>
    );
  }

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro
        title="Daftar Penjualan & Faktur"
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
              radius="md"
              leftSection={<Plus size={16} />}
              onClick={() => setCreateOpen(true)}
            >
              Buat Penjualan
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
                {t.label}
              </Button>
            );
          })}
        </Group>

        <TextInput
          placeholder="Cari nomor transaksi, pelanggan, atau referensi..."
          size="sm"
          radius="md"
          w={320}
          maw="100%"
          mb="md"
          leftSection={<MagnifyingGlass size={14} />}
          value={query}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            setPage(1);
          }}
        />

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
