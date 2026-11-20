// Riwayat mutasi. Dipakai tab Riwayat mutasi di Mutasi Stok dan tab Mutasi terakhir
// di detail gudang — komponen dan sumber angkanya sama persis.
import { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Group,
  MultiSelect,
  Select,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { ArrowsLeftRight, MagnifyingGlass } from '@/components/Icon.jsx';
import { DataTable, DocNumber, EmptyState, StatusPill } from '@/pages/Pembelian/components.jsx';
import { formatDate } from '@/pages/Pembelian/utils.js';
import { rupiah } from '@/pages/Penjualan/utils.js';
import DateField from '@/components/DateField.jsx';
import { MOVE_TYPE, listMoves, moveTypeOptions } from './stock.js';
import { hasJournal } from './journal.js';

const number = new Intl.NumberFormat('id-ID');

export default function MoveHistory({
  data,
  filter,
  onFilter,
  showValue,
  limit,
  onOpenSource,
  onOpenJournal,
  right,
}) {
  const [types, setTypes] = useState([]);
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const all = listMoves(data.moves, { ...filter, types, query });
    return limit ? all.slice(0, limit) : all;
  }, [data.moves, filter, types, query, limit]);

  const productName = (id) => data.products.find((p) => p.id === id)?.name ?? id;
  const warehouseName = (id) => data.warehouses.find((w) => w.id === id)?.name ?? id;

  const head = [
    { label: 'Tanggal' },
    { label: 'No. dokumen' },
    { label: 'Jenis' },
    { label: 'Produk' },
    ...(filter.warehouseId === 'all' ? [{ label: 'Gudang' }] : []),
    { label: 'Masuk', align: 'right' },
    { label: 'Keluar', align: 'right' },
    ...(showValue
      ? [{ label: 'Harga satuan', align: 'right' }, { label: 'Nilai', align: 'right' }]
      : []),
    { label: 'Jurnal', align: 'center' },
  ];

  const masuk = rows.reduce((n, r) => n + r.qtyIn, 0);
  const keluar = rows.reduce((n, r) => n + r.qtyOut, 0);
  // Nilai masuk dan keluar dipisah; menjumlahkannya jadi satu akan menghitung satu
  // pindah barang dua kali.
  const nilaiMasuk = rows.reduce((n, r) => (r.qtyIn ? n + r.amount : n), 0);
  const nilaiKeluar = rows.reduce((n, r) => (r.qtyOut ? n + r.amount : n), 0);
  const satuProduk = !!filter.productId;

  return (
    <>
      {onFilter && (
        <Group
          gap="md"
          px="lg"
          py="sm"
          bg="slate.0"
          justify="space-between"
          style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
        >
          <Group gap="md">
            <DateField
              size="sm"
              radius="md"
              w={160}
              aria-label="Dari tanggal"
              value={filter.from ?? ''}
              onChange={(e) => onFilter({ from: e.currentTarget.value })}
            />
            <DateField
              size="sm"
              radius="md"
              w={160}
              aria-label="Sampai tanggal"
              value={filter.to ?? ''}
              onChange={(e) => onFilter({ to: e.currentTarget.value })}
            />
            <Select
              size="sm"
              radius="md"
              w={185}
              allowDeselect={false}
              data={[
                { value: 'all', label: 'Semua gudang' },
                ...data.warehouses.map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` })),
              ]}
              value={filter.warehouseId}
              onChange={(v) => onFilter({ warehouseId: v })}
            />
            <Select
              size="sm"
              radius="md"
              w={180}
              clearable
              searchable
              placeholder="Semua produk"
              data={data.products
                .filter((p) => p.tracked)
                .map((p) => ({ value: p.id, label: p.name }))}
              value={filter.productId ?? null}
              onChange={(v) => onFilter({ productId: v })}
            />
            <MultiSelect
              size="sm"
              radius="md"
              w={200}
              clearable
              placeholder="Semua jenis"
              data={moveTypeOptions}
              value={types}
              onChange={setTypes}
            />
            <TextInput
              placeholder="Cari no. dokumen..."
              size="sm"
              radius="md"
              w={200}
              leftSection={<MagnifyingGlass size={14} />}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
          </Group>
          {right}
        </Group>
      )}

      <Box p="lg">
        <DataTable
          head={head}
          minWidth={showValue ? 1180 : 940}
          empty={
            rows.length ? null : (
              <EmptyState
                icon={ArrowsLeftRight}
                title="Belum ada mutasi"
                text="Mutasi tercatat otomatis saat dokumen persediaan disimpan."
              />
            )
          }
        >
          {rows.map((m) => (
            <Table.Tr key={m.id}>
              <Table.Td>
                <Text fz="sm" c="slate.7">
                  {formatDate(m.date)}
                </Text>
              </Table.Td>
              <Table.Td>
                <DocNumber onClick={() => onOpenSource?.(m)}>{m.sourceNo}</DocNumber>
                {m.reversalOfId && (
                  <Badge size="xs" radius="sm" variant="light" color="red" tt="none" mt={2}>
                    Pembatalan
                  </Badge>
                )}
              </Table.Td>
              <Table.Td>
                <StatusPill map={MOVE_TYPE} status={m.type} />
              </Table.Td>
              <Table.Td>
                <Text fz="sm" c="slate.8">
                  {productName(m.productId)}
                </Text>
              </Table.Td>
              {filter.warehouseId === 'all' && (
                <Table.Td>
                  <Text fz="sm" c="slate.7">
                    {warehouseName(m.warehouseId)}
                  </Text>
                </Table.Td>
              )}
              <Table.Td ta="right">
                <Text fz="sm" fw={m.qtyIn ? 700 : 400} c={m.qtyIn ? 'green.8' : 'slate.5'}>
                  {number.format(m.qtyIn)}
                </Text>
              </Table.Td>
              <Table.Td ta="right">
                <Text fz="sm" fw={m.qtyOut ? 700 : 400} c={m.qtyOut ? 'red.8' : 'slate.5'}>
                  {number.format(m.qtyOut)}
                </Text>
              </Table.Td>
              {showValue && (
                <>
                  <Table.Td ta="right">
                    <Text fz="sm" c="slate.7">
                      {rupiah(Math.round(m.unit))}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fz="sm" fw={600} c="slate.9">
                      {rupiah(Math.round(m.amount))}
                    </Text>
                  </Table.Td>
                </>
              )}
              <Table.Td ta="center">
                {hasJournal(m.type) ? (
                  <Button
                    variant="subtle"
                    size="xs"
                    radius="md"
                    fz="xs"
                    onClick={() => onOpenJournal?.(m)}
                  >
                    Lihat jurnal
                  </Button>
                ) : (
                  <Tooltip
                    label="Pindah barang tidak berjurnal: akun persediaannya sama di kedua gudang."
                    withArrow
                    fz="xs"
                    multiline
                    w={260}
                  >
                    <Text fz={11} c="slate.5" style={{ cursor: 'help' }}>
                      Tanpa jurnal
                    </Text>
                  </Tooltip>
                )}
              </Table.Td>
            </Table.Tr>
          ))}

          {rows.length > 0 && (
            <Table.Tr bg="slate.0">
              <Table.Td colSpan={filter.warehouseId === 'all' ? 5 : 4}>
                <Text fz="xs" fw={700} c="slate.7" tt="uppercase">
                  Total {rows.length} mutasi
                </Text>
              </Table.Td>
              <Table.Td ta="right">
                <Text fz="sm" fw={700} c={satuProduk ? 'green.8' : 'slate.5'}>
                  {satuProduk ? number.format(masuk) : '—'}
                </Text>
              </Table.Td>
              <Table.Td ta="right">
                <Text fz="sm" fw={700} c={satuProduk ? 'red.8' : 'slate.5'}>
                  {satuProduk ? number.format(keluar) : '—'}
                </Text>
              </Table.Td>
              {showValue && (
                <>
                  <Table.Td />
                  <Table.Td ta="right">
                    <Text fz="xs" fw={700} c="green.8">
                      Masuk {rupiah(Math.round(nilaiMasuk))}
                    </Text>
                    <Text fz="xs" fw={700} c="red.8">
                      Keluar {rupiah(Math.round(nilaiKeluar))}
                    </Text>
                  </Table.Td>
                </>
              )}
              <Table.Td />
            </Table.Tr>
          )}
        </DataTable>
        {!satuProduk && rows.length > 0 && (
          <Text fz={11} c="slate.6" mt="xs">
            Total masuk dan keluar hanya dijumlahkan bila filter produk dipilih — qty antar
            produk tidak bisa dijumlah karena satuannya berbeda.
          </Text>
        )}
      </Box>
    </>
  );
}
