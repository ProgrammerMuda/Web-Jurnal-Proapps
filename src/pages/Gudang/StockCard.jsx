// Kartu stok satu produk: saldo awal periode, mutasi berjalan, saldo akhir.
// Urutannya mengikuti M7 (tanggal dokumen lalu waktu posting).
import { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Select,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import { ArrowsLeftRight, DownloadSimple, Package, Printer } from '@/components/Icon.jsx';
import {
  BackLink,
  DataTable,
  DocNumber,
  EmptyState,
  StatCell,
  StatusPill,
} from '@/pages/Pembelian/components.jsx';
import { formatDate } from '@/pages/Pembelian/utils.js';
import { rupiah } from '@/pages/Penjualan/utils.js';
import { downloadCsv } from '@/pages/Kontak/utils.js';
import { categoryName, unitName } from '@/pages/Produk/catalog.js';
import DateField from '@/components/DateField.jsx';
import { MOVE_TYPE, costBreakdownLabel, getStockCard } from './stock.js';

const number = new Intl.NumberFormat('id-ID');

export default function StockCard({
  data,
  productId,
  warehouseId,
  showValue,
  onBack,
  backLabel,
  onScope,
  onOpenSource,
}) {
  const product = data.products.find((p) => p.id === productId);
  const [from, setFrom] = useState(`${data.today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(data.today);

  const card = useMemo(
    () => getStockCard(data.moves, productId, warehouseId, from, to),
    [data.moves, productId, warehouseId, from, to],
  );

  if (!product)
    return (
      <Stack gap="lg" p="lg" maw={1440} mx="auto">
        <BackLink label={backLabel} onClick={onBack} />
        <EmptyState icon={Package} title="Produk tidak ditemukan" text="Katalognya mungkin sudah berubah." />
      </Stack>
    );

  const satuan = unitName(data.units, product.baseUnitId ?? product.buyUnitId);
  const semua = warehouseId === 'all';
  const warehouseName = (id) => data.warehouses.find((w) => w.id === id)?.name ?? id;
  const lokasi = semua ? 'Semua gudang' : warehouseName(warehouseId);

  const exportCsv = () => {
    downloadCsv(`kartu-stok-${product.sku}.csv`, [
      ['Tanggal', 'No. dokumen', 'Jenis', 'Gudang', 'Masuk', 'Keluar', 'Saldo', ...(showValue ? ['Harga satuan', 'Saldo nilai'] : [])],
      [formatDate(from), 'Saldo awal', '', lokasi, '', '', card.opening.qty, ...(showValue ? ['', Math.round(card.opening.value)] : [])],
      ...card.rows.map((r) => [
        formatDate(r.date),
        r.sourceNo,
        MOVE_TYPE[r.type].label,
        warehouseName(r.warehouseId),
        r.qtyIn || '',
        r.qtyOut || '',
        r.saldoQty,
        ...(showValue ? [Math.round(r.unitCost), Math.round(r.saldoValue)] : []),
      ]),
    ]);
  };

  const head = [
    { label: 'Tanggal' },
    { label: 'No. dokumen' },
    { label: 'Jenis' },
    ...(semua ? [{ label: 'Gudang' }] : []),
    { label: 'Masuk', align: 'right' },
    { label: 'Keluar', align: 'right' },
    { label: 'Saldo qty', align: 'right' },
    ...(showValue
      ? [
          { label: 'Harga satuan', align: 'right' },
          { label: 'Nilai mutasi', align: 'right' },
          { label: 'Saldo nilai', align: 'right' },
          { label: 'Harga rata-rata', align: 'right' },
        ]
      : []),
  ];
  // Kolom sebelum "Saldo qty": tanggal, no. dokumen, jenis, [gudang], masuk, keluar.
  const beforeSaldo = semua ? 6 : 5;

  // Baris ringkasan (saldo awal / saldo akhir) menempel di kolom Saldo qty dan
  // Saldo nilai, bukan di kolom terakhir.
  const summaryRow = (label, qty, value) => (
    <Table.Tr bg="slate.0" key={label}>
      <Table.Td colSpan={beforeSaldo}>
        <Text fz="xs" fw={700} c="slate.7">
          {label}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        <Text fz="sm" fw={700} c="slate.9">
          {number.format(qty)}
        </Text>
      </Table.Td>
      {showValue && (
        <>
          <Table.Td />
          <Table.Td />
          <Table.Td ta="right">
            <Text fz="sm" fw={700} c="slate.9">
              {rupiah(Math.round(value))}
            </Text>
          </Table.Td>
          <Table.Td />
        </>
      )}
    </Table.Tr>
  );

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <BackLink label={backLabel} onClick={onBack} />

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
          <Group gap="md" wrap="nowrap" align="flex-start">
            <Box
              bg="primary.0"
              c="primary.9"
              style={{ width: 44, height: 44, borderRadius: 'var(--mantine-radius-md)', display: 'grid', placeItems: 'center' }}
            >
              <Package size={24} />
            </Box>
            <Box>
              <Title order={3} fz="xl" c="slate.9">
                {product.name}
              </Title>
              <Group gap={8} mt={2}>
                <Text fz="xs" c="slate.6">
                  {product.sku}
                </Text>
                <Badge size="sm" radius="sm" variant="light" color="slate" tt="none">
                  {satuan || 'tanpa satuan'}
                </Badge>
                <Text fz="xs" c="slate.6">
                  {categoryName(data.categories, product.categoryId)}
                </Text>
              </Group>
            </Box>
          </Group>
          <Group gap="xs">
            <Button
              variant="default"
              radius="md"
              leftSection={<Printer size={16} />}
              onClick={() => window.print()}
            >
              Cetak
            </Button>
            <Button
              variant="default"
              radius="md"
              leftSection={<DownloadSimple size={16} />}
              onClick={exportCsv}
            >
              Ekspor
            </Button>
          </Group>
        </Group>
      </Card>

      <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
        <Group
          gap="md"
          px="lg"
          py="sm"
          bg="slate.0"
          style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
        >
          <Select
            size="sm"
            radius="md"
            w={200}
            allowDeselect={false}
            data={[
              { value: 'all', label: 'Semua gudang' },
              ...data.warehouses.map((w) => ({ value: w.id, label: `${w.code} · ${w.name}` })),
            ]}
            value={warehouseId}
            onChange={(v) => onScope({ warehouseId: v })}
          />
          <DateField size="sm" radius="md" w={160} aria-label="Dari tanggal" value={from} onChange={(e) => setFrom(e.currentTarget.value)} />
          <DateField size="sm" radius="md" w={160} aria-label="Sampai tanggal" value={to} onChange={(e) => setTo(e.currentTarget.value)} />
        </Group>

        <Grid gutter={0} style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
          {[
            ['Saldo awal periode', `${number.format(card.opening.qty)} ${satuan}`, showValue && rupiah(Math.round(card.opening.value))],
            [
              'Total masuk',
              `${number.format(card.masuk)} ${satuan}`,
              semua ? 'Pindah antar gudang tidak dihitung' : null,
            ],
            [
              'Total keluar',
              `${number.format(card.keluar)} ${satuan}`,
              semua ? 'Pindah antar gudang tidak dihitung' : null,
            ],
            ['Saldo akhir', `${number.format(card.closing.qty)} ${satuan}`, showValue && rupiah(Math.round(card.closing.value))],
          ].map(([label, value, sub], i) => (
            <Grid.Col
              key={label}
              span={{ base: 12, sm: 6, lg: 3 }}
              style={i > 0 ? { borderLeft: '1px solid var(--mantine-color-gray-3)' } : undefined}
            >
              <StatCell icon={ArrowsLeftRight} label={label}>
                {value}
                {sub && (
                  <Text fz={11} fw={500} c="slate.6">
                    {sub}
                  </Text>
                )}
              </StatCell>
            </Grid.Col>
          ))}
        </Grid>

        <Box p="lg">
          <DataTable
            head={head}
            minWidth={showValue ? 1180 : 820}
            empty={
              card.rows.length ? null : (
                <EmptyState
                  icon={ArrowsLeftRight}
                  title="Tidak ada mutasi di periode ini"
                  text="Ubah rentang tanggal atau pilihan gudangnya."
                />
              )
            }
          >
            {summaryRow(`Saldo awal per ${formatDate(from)}`, card.opening.qty, card.opening.value)}

            {card.rows.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>
                  <Text fz="sm" c="slate.7">
                    {formatDate(r.date)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <DocNumber onClick={() => onOpenSource?.(r)}>{r.sourceNo}</DocNumber>
                  {r.reversalOfId && (
                    <Badge size="xs" radius="sm" variant="light" color="red" tt="none" mt={2}>
                      Pembatalan
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  <StatusPill map={MOVE_TYPE} status={r.type} />
                </Table.Td>
                {semua && (
                  <Table.Td>
                    <Text fz="sm" c="slate.7">
                      {warehouseName(r.warehouseId)}
                    </Text>
                  </Table.Td>
                )}
                <Table.Td ta="right">
                  <Text fz="sm" fw={r.qtyIn ? 700 : 400} c={r.qtyIn ? 'green.8' : 'slate.5'}>
                    {r.qtyIn ? number.format(r.qtyIn) : '—'}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text fz="sm" fw={r.qtyOut ? 700 : 400} c={r.qtyOut ? 'red.8' : 'slate.5'}>
                    {r.qtyOut ? number.format(r.qtyOut) : '—'}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text fz="sm" fw={700} c="slate.9">
                    {number.format(r.saldoQty)}
                  </Text>
                </Table.Td>
                {showValue && (
                  <>
                    <Table.Td ta="right">
                      {/* Mutasi masuk dinilai pada harga perolehan; rinciannya di tooltip. */}
                      <Tooltip
                        label={costBreakdownLabel(r, rupiah)}
                        disabled={!costBreakdownLabel(r, rupiah)}
                        withArrow
                        fz="xs"
                      >
                        <Text
                          fz="sm"
                          c="slate.7"
                          style={costBreakdownLabel(r, rupiah) ? { cursor: 'help' } : undefined}
                        >
                          {rupiah(Math.round(r.unitCost))}
                        </Text>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text fz="sm" c="slate.7">
                        {rupiah(Math.round((r.qtyIn + r.qtyOut) * r.unitCost))}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text fz="sm" fw={600} c="slate.9">
                        {rupiah(Math.round(r.saldoValue))}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text fz="sm" c="slate.6">
                        {rupiah(Math.round(r.avg))}
                      </Text>
                    </Table.Td>
                  </>
                )}
              </Table.Tr>
            ))}

            {summaryRow(`Saldo akhir per ${formatDate(to)}`, card.closing.qty, card.closing.value)}
          </DataTable>
        </Box>
      </Card>
    </Stack>
  );
}
