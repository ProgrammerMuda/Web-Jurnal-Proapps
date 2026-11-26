// Daftar dokumen Stok Opname: kartu ringkasan, toolbar filter, lalu tabel.
// Bentuknya mengikuti daftar dokumen lain di aplikasi ini.
import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Group,
  Progress,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { PageIntro } from '@/components/common.jsx';
import StatCards from '@/components/StatCards.jsx';
import DateField from '@/components/DateField.jsx';
import {
  ClipboardText,
  ListChecks,
  MagnifyingGlass,
  Package,
  Plus,
  Warning,
} from '@/components/Icon.jsx';
import {
  DataTable,
  DocNumber,
  EmptyState,
  StatusPill,
} from '@/pages/Pembelian/components.jsx';
import { formatDate } from '@/pages/Pembelian/utils.js';
import { rupiah } from '@/pages/Penjualan/utils.js';
import { OPNAME_STATUS, opnameStatusOptions, opnameSummary } from './opname.js';

const number = new Intl.NumberFormat('id-ID');

export default function OpnameList({ data, opnames, showValue, onOpen, onNew }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(null);
  const [warehouseId, setWarehouseId] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const warehouseName = (id) => data.warehouses.find((w) => w.id === id)?.name ?? id;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return opnames
      .filter((o) => (!q || o.number.toLowerCase().includes(q)))
      .filter((o) => (!status || o.status === status))
      .filter((o) => warehouseId === 'all' || o.warehouseId === warehouseId)
      .filter((o) => (!from || o.date >= from) && (!to || o.date <= to))
      .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : a.date < b.date ? 1 : -1))
      .map((o) => ({ o, s: opnameSummary(o) }));
  }, [opnames, query, status, warehouseId, from, to]);

  const berjalan = opnames.filter((o) => ['counting', 'pending_approval'].includes(o.status));
  const menunggu = opnames.filter((o) => o.status === 'pending_approval');
  // "Bulan ini" mengikuti tanggal hitung, bukan tanggal posting: selisihnya
  // memang milik periode itu.
  const bulan = data.today.slice(0, 7);
  const netBulanIni = opnames
    .filter((o) => o.status === 'posted' && o.date.startsWith(bulan))
    .reduce((n, o) => n + opnameSummary(o).netValue, 0);

  const stats = [
    { label: 'Sedang berjalan', value: number.format(berjalan.length), hint: 'Dalam hitungan atau menunggu persetujuan', icon: ListChecks, color: 'blue' },
    { label: 'Menunggu persetujuan', value: number.format(menunggu.length), hint: 'Opname yang perlu disetujui', icon: Warning, color: 'orange' },
    showValue && { label: 'Selisih bulan ini', value: rupiah(Math.round(netBulanIni)), hint: 'Selisih bersih opname yang diposting', icon: Package, color: 'indigo' },
  ].filter(Boolean);

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro
        icon={ListChecks}
        title="Stok Opname"
        description="Menghitung fisik barang di satu gudang, membandingkannya dengan saldo buku, lalu memposting selisihnya sebagai penyesuaian beserta jurnalnya."
        actions={
          <Button radius="md" leftSection={<Plus size={16} />} onClick={onNew}>
            Buat opname
          </Button>
        }
      />

      <StatCards items={stats} />

      <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
        <Group
          gap="md"
          px="lg"
          py="sm"
          bg="slate.0"
          style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
        >
          <TextInput
            placeholder="Cari no. dokumen..."
            size="sm"
            radius="md"
            w={220}
            leftSection={<MagnifyingGlass size={14} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          <Select
            size="sm"
            radius="md"
            w={190}
            allowDeselect={false}
            data={[
              { value: 'all', label: 'Semua gudang' },
              ...data.warehouses.map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` })),
            ]}
            value={warehouseId}
            onChange={(v) => setWarehouseId(v)}
          />
          <Select
            size="sm"
            radius="md"
            w={190}
            clearable
            placeholder="Semua status"
            data={opnameStatusOptions}
            value={status}
            onChange={setStatus}
          />
          <DateField
            size="sm"
            radius="md"
            w={160}
            aria-label="Dari tanggal"
            value={from}
            onChange={(e) => setFrom(e.currentTarget.value)}
          />
          <DateField
            size="sm"
            radius="md"
            w={160}
            aria-label="Sampai tanggal"
            value={to}
            onChange={(e) => setTo(e.currentTarget.value)}
          />
        </Group>

        <Box p="lg">
          <DataTable
            head={[
              { label: 'No. dokumen' },
              { label: 'Tanggal hitung' },
              { label: 'Gudang' },
              { label: 'Status' },
              { label: 'Progres', w: 180 },
              { label: 'Produk selisih', align: 'right' },
              ...(showValue ? [{ label: 'Nilai selisih', align: 'right' }] : []),
              { label: 'Dibuat oleh' },
            ]}
            minWidth={showValue ? 1180 : 1020}
            empty={
              rows.length ? null : (
                <EmptyState
                  icon={ClipboardText}
                  title="Belum ada stok opname"
                  text="Opname dibuat per gudang lewat tombol Buat opname."
                />
              )
            }
          >
            {rows.map(({ o, s }) => (
              <Table.Tr key={o.id}>
                <Table.Td>
                  <DocNumber onClick={() => onOpen(o)}>{o.number}</DocNumber>
                </Table.Td>
                <Table.Td>
                  <Text fz="sm" c="slate.7">
                    {formatDate(o.date)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text fz="sm" c="slate.7">
                    {warehouseName(o.warehouseId)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <StatusPill map={OPNAME_STATUS} status={o.status} />
                </Table.Td>
                <Table.Td>
                  {o.status === 'draft' ? (
                    <Text fz="sm" c="slate.5">
                      Belum dimulai
                    </Text>
                  ) : (
                    <>
                      <Progress
                        value={s.total ? (s.counted / s.total) * 100 : 0}
                        size="sm"
                        radius="xl"
                        color={s.uncounted ? 'primary' : 'green'}
                      />
                      <Text fz={11} c="slate.6" mt={2}>
                        {number.format(s.counted)} dari {number.format(s.total)} dihitung
                      </Text>
                    </>
                  )}
                </Table.Td>
                <Table.Td ta="right">
                  <Text fz="sm" fw={s.diffCount ? 700 : 400} c={s.diffCount ? 'slate.9' : 'slate.5'}>
                    {number.format(s.diffCount)}
                  </Text>
                </Table.Td>
                {showValue && (
                  <Table.Td ta="right">
                    <Text
                      fz="sm"
                      fw={600}
                      c={s.netValue > 0 ? 'green.8' : s.netValue < 0 ? 'red.8' : 'slate.5'}
                    >
                      {s.netValue ? rupiah(Math.round(s.netValue)) : '—'}
                    </Text>
                  </Table.Td>
                )}
                <Table.Td>
                  <Text fz="sm" c="slate.7">
                    {o.createdBy}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </DataTable>
        </Box>
      </Card>
    </Stack>
  );
}