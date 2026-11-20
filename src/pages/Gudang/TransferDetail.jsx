// Detail dokumen Pindah Barang beserta mutasi yang dihasilkannya.
import { Badge, Box, Button, Card, Group, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { ArrowsLeftRight, Check, Printer, Prohibit } from '@/components/Icon.jsx';
import {
  BackLink,
  Callout,
  DataTable,
  DocNumber,
  RowMenu,
  Section,
  StatusPill,
} from '@/pages/Pembelian/components.jsx';
import { formatDate } from '@/pages/Pembelian/utils.js';
import { rupiah } from '@/pages/Penjualan/utils.js';
import { unitName } from '@/pages/Produk/catalog.js';
import { MOVE_TYPE, TRANSFER_STATUS, getAverageCost } from './stock.js';

const number = new Intl.NumberFormat('id-ID');

function InfoCell({ label, value, divider }) {
  return (
    <Box
      px="lg"
      py="md"
      style={{ minWidth: 0, borderLeft: divider ? '1px solid var(--mantine-color-gray-2)' : undefined }}
    >
      <Text fz={11} fw={600} c="slate.6">
        {label}
      </Text>
      <Text fz="sm" fw={600} c="slate.9" lh={1.35}>
        {value || '—'}
      </Text>
    </Box>
  );
}

export default function TransferDetail({
  transfer,
  data,
  showValue,
  canApprove,
  approverLabel,
  onBack,
  onApprove,
  onReject,
  onCancelTransfer,
  onOpenCard,
}) {
  const warehouseName = (id) => data.warehouses.find((w) => w.id === id)?.name ?? id;
  const productOf = (id) => data.products.find((p) => p.id === id);
  const moves = data.moves.filter((m) => m.sourceId === transfer.id);
  const menunggu = transfer.status === 'menunggu';
  const disetujui = transfer.status === 'disetujui';
  const ditolak = transfer.status === 'ditolak';
  const dibatalkan = transfer.status === 'cancelled';
  // Pengajuan yang masih menunggu boleh ditarik; yang sudah disetujui dibatalkan
  // dengan mutasi pembalik.
  const bisaDibatalkan = menunggu || disetujui;

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <BackLink label="Kembali ke mutasi stok" onClick={onBack} />

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
          <Group gap="md" wrap="nowrap" align="flex-start">
            <Box
              bg="primary.0"
              c="primary.9"
              style={{ width: 44, height: 44, borderRadius: 'var(--mantine-radius-md)', display: 'grid', placeItems: 'center' }}
            >
              <ArrowsLeftRight size={24} />
            </Box>
            <Box>
              <Group gap={8} align="center">
                <Title order={3} fz="xl" c="slate.9">
                  {transfer.no}
                </Title>
                <StatusPill map={TRANSFER_STATUS} status={transfer.status} />
              </Group>
              <Text fz="xs" c="slate.6" mt={2}>
                {formatDate(transfer.date)} · {warehouseName(transfer.fromWarehouseId)} →{' '}
                {warehouseName(transfer.toWarehouseId)}
              </Text>
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
            {menunggu && canApprove && (
              <>
                <Button
                  variant="default"
                  color="red"
                  c="red.7"
                  radius="md"
                  leftSection={<Prohibit size={16} />}
                  onClick={onReject}
                >
                  Tolak
                </Button>
                <Button radius="md" leftSection={<Check size={16} />} onClick={onApprove}>
                  Setujui pindah barang
                </Button>
              </>
            )}
            {bisaDibatalkan && (
              <RowMenu
                label={transfer.no}
                items={[
                  {
                    label: menunggu ? 'Tarik pengajuan' : 'Batalkan pindah barang',
                    icon: Prohibit,
                    color: 'red',
                    onClick: onCancelTransfer,
                  },
                ]}
              />
            )}
          </Group>
        </Group>
      </Card>

      <Section title="Informasi dokumen" description="Asal, tujuan, dan catatan" divided flush>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={0}>
          <InfoCell label="Gudang asal" value={warehouseName(transfer.fromWarehouseId)} />
          <InfoCell label="Gudang tujuan" value={warehouseName(transfer.toWarehouseId)} divider />
        </SimpleGrid>
        <SimpleGrid
          cols={{ base: 1, sm: 2 }}
          spacing={0}
          style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}
        >
          <InfoCell label="Diajukan oleh" value={`${transfer.createdBy} · ${formatDate(transfer.createdAt.slice(0, 10))}`} />
          <InfoCell
            label="Persetujuan"
            value={
              disetujui
                ? `${transfer.approvedBy} · ${formatDate(transfer.approvedAt.slice(0, 10))}`
                : ditolak
                  ? `Ditolak · ${transfer.rejectedBy}`
                  : menunggu
                    ? `Menunggu ${approverLabel}`
                    : '—'
            }
            divider
          />
        </SimpleGrid>
        <SimpleGrid
          cols={{ base: 1, sm: 2 }}
          spacing={0}
          style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}
        >
          <InfoCell label="Catatan" value={transfer.notes} />
          <InfoCell label="Jumlah produk" value={`${transfer.lines.length} produk`} divider />
        </SimpleGrid>
      </Section>

      {menunggu && (
        <Callout tone="wait" title={`Menunggu persetujuan ${approverLabel}`}>
          Stok belum berpindah. Mutasi baru dicatat setelah pengajuan ini disetujui, jadi
          saldo {warehouseName(transfer.fromWarehouseId)} masih utuh.
        </Callout>
      )}

      {ditolak && (
        <Callout tone="stop" title={`Ditolak oleh ${transfer.rejectedBy ?? approverLabel}`}>
          {transfer.rejectReason || 'Tanpa alasan tertulis.'} Stok tidak berpindah dan tidak ada
          mutasi yang tercatat.
        </Callout>
      )}

      {dibatalkan && (
        <Callout tone="warn" title="Dokumen ini sudah dibatalkan">
          {moves.length
            ? 'Mutasi pembalik sudah dicatat dan stok kembali ke gudang asal. Mutasi aslinya tetap ada di riwayat supaya jejaknya utuh.'
            : 'Pengajuan ditarik sebelum disetujui, jadi tidak ada mutasi yang pernah tercatat.'}
        </Callout>
      )}

      <Section title="Barang yang dipindah" description={`${transfer.lines.length} produk`}>
        <DataTable
          head={[
            { label: 'Produk' },
            { label: 'Qty', align: 'right' },
            { label: 'Satuan' },
            ...(showValue ? [{ label: 'Nilai', align: 'right' }] : []),
          ]}
          minWidth={620}
        >
          {transfer.lines.map((l) => {
            const p = productOf(l.productId);
            const avg = getAverageCost(data.moves, l.productId, transfer.date);
            return (
              <Table.Tr key={l.productId}>
                <Table.Td>
                  <DocNumber onClick={() => onOpenCard(l.productId)}>{p?.name ?? l.productId}</DocNumber>
                  <Text fz={10} c="slate.6">
                    {p?.sku}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text fz="sm" fw={700} c="slate.9">
                    {number.format(l.qty)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text fz="sm" c="slate.7">
                    {unitName(data.units, p?.baseUnitId ?? p?.buyUnitId)}
                  </Text>
                </Table.Td>
                {showValue && (
                  <Table.Td ta="right">
                    <Text fz="sm" c="slate.7">
                      {rupiah(Math.round(l.qty * avg))}
                    </Text>
                  </Table.Td>
                )}
              </Table.Tr>
            );
          })}
        </DataTable>
      </Section>

      <Section
        title="Mutasi yang dihasilkan"
        description="Dua baris per produk: keluar dari gudang asal, masuk ke gudang tujuan. Tanpa jurnal."
        right={
          <Badge size="sm" radius="sm" variant="light" color="slate" tt="none">
            {moves.length} mutasi
          </Badge>
        }
      >
        {!moves.length ? (
          <Callout tone="info">
            Belum ada mutasi. Stok baru bergerak setelah pengajuan ini disetujui.
          </Callout>
        ) : (
        <DataTable
          head={[
            { label: 'Tanggal' },
            { label: 'Jenis' },
            { label: 'Produk' },
            { label: 'Gudang' },
            { label: 'Masuk', align: 'right' },
            { label: 'Keluar', align: 'right' },
          ]}
          minWidth={760}
        >
          {moves.map((m) => (
            <Table.Tr key={m.id}>
              <Table.Td>
                <Text fz="sm" c="slate.7">
                  {formatDate(m.date)}
                </Text>
              </Table.Td>
              <Table.Td>
                <StatusPill map={MOVE_TYPE} status={m.type} />
                {m.reversalOfId && (
                  <Badge size="xs" radius="sm" variant="light" color="red" tt="none" ml={6}>
                    Pembatalan
                  </Badge>
                )}
              </Table.Td>
              <Table.Td>
                <DocNumber onClick={() => onOpenCard(m.productId)}>
                  {productOf(m.productId)?.name ?? m.productId}
                </DocNumber>
              </Table.Td>
              <Table.Td>
                <Text fz="sm" c="slate.7">
                  {warehouseName(m.warehouseId)}
                </Text>
              </Table.Td>
              <Table.Td ta="right">
                <Text fz="sm" fw={m.qtyIn ? 700 : 400} c={m.qtyIn ? 'green.8' : 'slate.5'}>
                  {m.qtyIn ? number.format(m.qtyIn) : '—'}
                </Text>
              </Table.Td>
              <Table.Td ta="right">
                <Text fz="sm" fw={m.qtyOut ? 700 : 400} c={m.qtyOut ? 'red.8' : 'slate.5'}>
                  {m.qtyOut ? number.format(m.qtyOut) : '—'}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </DataTable>
        )}
      </Section>

      <Group justify="flex-end">
        <Button variant="default" radius="md" onClick={onBack}>
          Kembali ke mutasi stok
        </Button>
      </Group>
    </Stack>
  );
}
