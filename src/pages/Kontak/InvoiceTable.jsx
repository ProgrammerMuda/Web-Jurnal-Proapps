import {
  ActionIcon,
  Anchor,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Menu,
  Pagination,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  CalendarBlank,
  DotsThreeVertical,
  Eye,
  Invoice,
  MagnifyingGlass,
  Notebook,
} from '@/components/Icon.jsx';
import { CopyIcon } from '@/components/common.jsx';
import { StatusBadge } from '@/pages/Penjualan/components.jsx';
import { products } from '@/pages/Penjualan/data.js';
import { computeTotals, formatDate, isOverdue, rupiah, statusOf } from '@/pages/Penjualan/utils.js';

// Label filter sedikit berbeda antara tab rincian kontak & halaman riwayat (mengikuti aslinya).
const FILTERS = {
  detail: [
    ['all', 'Semua'],
    ['unpaid', 'Belum lunas'],
    ['paid', 'Lunas'],
    ['overdue', 'Lewat jatuh tempo'],
    ['draft', 'Draf'],
  ],
  history: [
    ['all', 'Semua Transaksi'],
    ['unpaid', 'Belum Lunas'],
    ['paid', 'Lunas'],
    ['overdue', 'Jatuh Tempo'],
    ['draft', 'Draft'],
  ],
};

const match = {
  all: () => true,
  unpaid: (s) => statusOf(s) === 'sent',
  paid: (s) => statusOf(s) === 'paid',
  overdue: isOverdue,
  draft: (s) => statusOf(s) === 'draft',
};

const productName = (id) => products.find((p) => p.id === id)?.name;
const pageSizes = ['10', '20', '50'];

export function FilterPills({ items, value, onChange }) {
  return (
    <Group gap={4}>
      {items.map(([v, label]) => {
        const active = v === value;
        return (
          <Button
            key={v}
            size="xs"
            radius="md"
            variant={active ? 'filled' : 'subtle'}
            color={active ? 'primary.9' : 'slate.7'}
            fw={active ? 700 : 500}
            onClick={() => onChange(v)}
          >
            {label}
          </Button>
        );
      })}
    </Group>
  );
}

function InvoiceRow({ sale, onOpen }) {
  const t = computeTotals(sale);
  const first = sale.items[0];
  return (
    <Table.Tr>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <ThemeIcon variant="light" bg="slate.0" c="slate.7" size={28} radius="md">
            <Invoice size={14} />
          </ThemeIcon>
          <Box>
            <Group gap={2} wrap="nowrap">
              <Anchor component="button" fz="xs" fw={700} c="primary.9" onClick={onOpen}>
                {sale.number}
              </Anchor>
              <CopyIcon value={sale.number} size={12} />
            </Group>
            {sale.ref && (
              <Text fz={11} c="slate.6">
                Referensi: {sale.ref}
              </Text>
            )}
          </Box>
        </Group>
      </Table.Td>
      <Table.Td>
        <Text fz="xs" fw={600} c="slate.9" style={{ whiteSpace: 'nowrap' }}>
          {formatDate(sale.date)}
        </Text>
        <Group gap={4} wrap="nowrap" c={isOverdue(sale) ? 'red.7' : 'slate.6'}>
          <CalendarBlank size={11} />
          <Text fz={11} c="inherit" style={{ whiteSpace: 'nowrap' }}>
            {formatDate(sale.dueDate)}
          </Text>
        </Group>
      </Table.Td>
      <Table.Td>
        <Text fz="xs" c="slate.9" tt="uppercase" lineClamp={1}>
          {productName(first?.productId) ?? first?.description ?? '—'}
        </Text>
        <Group gap={6} mt={2} wrap="nowrap">
          <Badge size="xs" radius="sm" variant="outline" color="slate">
            {sale.items.length} produk
          </Badge>
          <Anchor component="button" fz={11} c="primary.9">
            <Group gap={2} wrap="nowrap">
              <Notebook size={11} /> Jurnal transaksi
            </Group>
          </Anchor>
        </Group>
      </Table.Td>
      <Table.Td ta="center">
        <StatusBadge status={statusOf(sale)} size="xs" />
      </Table.Td>
      <Table.Td ta="right" fz="xs" fw={700} style={{ whiteSpace: 'nowrap' }}>
        {rupiah(t.total)}
      </Table.Td>
      <Table.Td
        ta="right"
        fz="xs"
        fw={700}
        c={t.balance > 0 ? 'red.8' : 'green.8'}
        style={{ whiteSpace: 'nowrap' }}
      >
        {rupiah(t.balance)}
      </Table.Td>
      <Table.Td ta="center">
        <Menu position="bottom-end" withinPortal shadow="md" width={160}>
          <Menu.Target>
            <ActionIcon variant="subtle" color="slate" aria-label={`Aksi ${sale.number}`}>
              <DotsThreeVertical size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item fz="xs" leftSection={<Eye size={14} />} onClick={onOpen}>
              Buka faktur
            </Menu.Item>
            <Menu.Item fz="xs" leftSection={<Notebook size={14} />}>
              Lihat jurnal
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  );
}

// variant "detail": pencarian di atas filter; "history": filter kiri, pencarian kanan.
export default function InvoiceTable({ sales, variant = 'detail', onOpenSale }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sales.filter(
      (s) =>
        match[filter](s) &&
        (!q ||
          s.number.toLowerCase().includes(q) ||
          s.items.some((l) =>
            (productName(l.productId) ?? l.description).toLowerCase().includes(q),
          )),
    );
  }, [sales, filter, query]);

  const size = Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * size;
  const rows = filtered.slice(start, start + size);
  const reset = (fn) => (v) => {
    fn(v);
    setPage(1);
  };

  const search = (
    <TextInput
      size="sm"
      radius="md"
      placeholder={variant === 'history' ? 'Cari nomor faktur atau produk...' : 'Cari nomor faktur'}
      leftSection={<MagnifyingGlass size={14} />}
      value={query}
      onChange={(e) => reset(setQuery)(e.currentTarget.value)}
      w={variant === 'history' ? 260 : undefined}
    />
  );
  const pills = <FilterPills items={FILTERS[variant]} value={filter} onChange={reset(setFilter)} />;

  return (
    <Stack gap="sm">
      {variant === 'history' ? (
        <Group justify="space-between">
          {pills}
          {search}
        </Group>
      ) : (
        <>
          {search}
          {pills}
        </>
      )}

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
            miw={900}
            verticalSpacing="sm"
            horizontalSpacing="md"
            highlightOnHover
            styles={{
              th: {
                fontSize: 'var(--mantine-font-size-xs)',
                color: 'var(--mantine-color-slate-7)',
                textTransform: 'uppercase',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              },
            }}
          >
            <Table.Thead bg="slate.0">
              <Table.Tr>
                <Table.Th>Nomor Faktur</Table.Th>
                <Table.Th>Tanggal & Jatuh Tempo</Table.Th>
                <Table.Th>Ringkasan Item</Table.Th>
                <Table.Th ta="center">Status</Table.Th>
                <Table.Th ta="right">Total Tagihan</Table.Th>
                <Table.Th ta="right">Sisa Tagihan</Table.Th>
                <Table.Th ta="center" w={60}>
                  Aksi
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((s) => (
                <InvoiceRow key={s.id} sale={s} onOpen={() => onOpenSale(s.id)} />
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {rows.length === 0 && (
          <Center py={40}>
            <Stack gap={6} align="center">
              <ThemeIcon variant="light" color="slate" size={44} radius="xl">
                <Invoice size={22} />
              </ThemeIcon>
              <Text fz="sm" fw={700} c="slate.9">
                Belum ada faktur
              </Text>
              <Text fz="xs" c="slate.6">
                Belum ada faktur penjualan yang cocok untuk kontak atau filter ini.
              </Text>
            </Stack>
          </Center>
        )}

        <Group
          justify="space-between"
          px="md"
          py="sm"
          style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
        >
          <Group gap="xs">
            <Text fz="xs" c="slate.7">
              Menampilkan {filtered.length ? start + 1 : 0}–{start + rows.length} dari{' '}
              {filtered.length} faktur
            </Text>
            <Select
              size="xs"
              radius="md"
              w={72}
              allowDeselect={false}
              data={pageSizes}
              value={pageSize}
              onChange={reset(setPageSize)}
            />
          </Group>
          <Pagination size="sm" radius="md" total={totalPages} value={current} onChange={setPage} />
        </Group>
      </Box>
    </Stack>
  );
}
