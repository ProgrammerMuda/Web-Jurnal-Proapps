// Mutasi Stok: buku besar persediaan. Dua tab — Saldo stok (posisi) dan Riwayat
// mutasi (pergerakan). Halaman ini terutama untuk dibaca; satu-satunya dokumen
// yang dibuat dari sini adalah Pindah Barang.
import { useMemo, useState } from 'react';
import { Box, Button, Card, Grid, Group, Stack, Table, Text } from '@mantine/core';
import { PageIntro } from '@/components/common.jsx';
import {
  ArrowsLeftRight,
  CheckCircle,
  DownloadSimple,
  Package,
  Prohibit,
  Warning,
} from '@/components/Icon.jsx';
import {
  Callout,
  DataTable,
  DocNumber,
  EmptyState,
  StatCell,
  StatusPill,
  TabBar,
} from '@/pages/Pembelian/components.jsx';
import { formatDate } from '@/pages/Pembelian/utils.js';
import { rupiah } from '@/pages/Penjualan/utils.js';
import { downloadCsv } from '@/pages/Kontak/utils.js';
import { unitName } from '@/pages/Produk/catalog.js';
import StockBalances from './StockBalances.jsx';
import MoveHistory from './MoveHistory.jsx';
import {
  MOVE_TYPE,
  TRANSFER_STATUS,
  balanceRows,
  belowMinimumCount,
  distinctItemCount,
  getInventoryValue,
  listMoves,
  sumValue,
} from './stock.js';
import { AKUN, accountLabel, moveJournal } from './journal.js';

const number = new Intl.NumberFormat('id-ID');

const baseTabs = [
  { value: 'saldo', label: 'Saldo stok', icon: Package },
  { value: 'riwayat', label: 'Riwayat mutasi', icon: ArrowsLeftRight },
  { value: 'pindah', label: 'Pindah barang', icon: ArrowsLeftRight },
];

// Daftar dokumen pindah barang — termasuk yang masih menunggu persetujuan, yang
// belum punya mutasi sama sekali sehingga tidak akan muncul di Riwayat mutasi.
function TransferList({ data, warehouseName, onOpen }) {
  const rows = [...data.transfers].sort((a, b) =>
    a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : a.date < b.date ? 1 : -1,
  );
  return (
    <Box p="lg">
      <DataTable
        head={[
          { label: 'No. dokumen' },
          { label: 'Tanggal' },
          { label: 'Dari' },
          { label: 'Ke' },
          { label: 'Produk', align: 'right' },
          { label: 'Diajukan oleh' },
          { label: 'Status' },
        ]}
        minWidth={940}
        empty={
          rows.length ? null : (
            <EmptyState
              icon={ArrowsLeftRight}
              title="Belum ada pindah barang"
              text="Dokumen pindah barang dibuat dari tombol Pindah barang di atas."
            />
          )
        }
      >
        {rows.map((t) => (
          <Table.Tr key={t.id}>
            <Table.Td>
              <DocNumber onClick={() => onOpen(t)}>{t.no}</DocNumber>
            </Table.Td>
            <Table.Td>
              <Text fz="sm" c="slate.7">
                {formatDate(t.date)}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text fz="sm" c="slate.7">
                {warehouseName(t.fromWarehouseId)}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text fz="sm" c="slate.7">
                {warehouseName(t.toWarehouseId)}
              </Text>
            </Table.Td>
            <Table.Td ta="right">
              <Text fz="sm" fw={600} c="slate.9">
                {t.lines.length}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text fz="sm" c="slate.7">
                {t.createdBy}
              </Text>
            </Table.Td>
            <Table.Td>
              <StatusPill map={TRANSFER_STATUS} status={t.status} />
            </Table.Td>
          </Table.Tr>
        ))}
      </DataTable>
    </Box>
  );
}

/**
 * Saldo akun Persediaan di buku besar pada tanggal tertentu (M10).
 * Dihitung dari jurnal yang dihasilkan mutasi, lalu dibandingkan dengan total
 * nilai persediaan. Selisih berarti ada jurnal manual ke akun itu.
 */
function ledgerBalance(moves, products, asOf) {
  const byId = Object.fromEntries(products.map((p) => [p.id, p]));
  return listMoves(moves, { to: asOf }).reduce((total, m) => {
    const lines = moveJournal(m, byId[m.productId], m.amount, { residual: m.residual });
    const persediaan = byId[m.productId]?.inventoryAccount || AKUN.persediaan;
    return (
      total +
      lines
        .filter((l) => l.account === persediaan)
        .reduce((n, l) => n + l.debit - l.credit, 0)
    );
  }, 0);
}

export default function MutasiStok({
  data,
  showValue,
  scope,
  onScope,
  onOpenCard,
  onNewTransfer,
  onOpenSource,
  onOpenTransfer,
  onOpenJournal,
  pendingCount = 0,
}) {
  const [tab, setTab] = useState(scope.view === 'riwayat' ? 'riwayat' : 'saldo');
  // Jumlah pengajuan yang menunggu ditempel di label tabnya, supaya approver tahu
  // ada yang perlu dikerjakan tanpa harus membuka tabnya dulu.
  const tabs = baseTabs.map((t) =>
    t.value === 'pindah' && pendingCount
      ? { ...t, label: `Pindah barang (${pendingCount})` }
      : t,
  );

  const asOf = scope.asOf ?? data.today;
  const rows = useMemo(
    () => balanceRows(data, { warehouseId: scope.warehouseId, asOf }),
    [data, scope.warehouseId, asOf],
  );

  // Stok minimum berlaku per produk per gudang, jadi peringatannya dihitung per
  // gudang — bukan dari baris matriks yang sudah dijumlah lintas gudang.
  const alerts = useMemo(() => {
    const lingkup =
      scope.warehouseId === 'all'
        ? data.warehouses.filter((w) => w.status === 'active').map((w) => w.id)
        : [scope.warehouseId];
    const perWarehouse = lingkup.flatMap((id) =>
      balanceRows(data, { warehouseId: id, asOf }),
    );
    return {
      below: belowMinimumCount(perWarehouse.filter((r) => r.minQty > 0)),
      habis: perWarehouse.filter((r) => r.qty === 0 && r.minQty > 0).length,
    };
  }, [data, scope.warehouseId, asOf]);

  const nilai = useMemo(
    () => getInventoryValue(data.moves, data.products, scope.warehouseId, asOf),
    [data.moves, data.products, scope.warehouseId, asOf],
  );
  const buku = useMemo(
    () => (showValue ? ledgerBalance(data.moves, data.products, asOf) : 0),
    [data.moves, data.products, asOf, showValue],
  );
  // Rekonsiliasi hanya bermakna untuk seluruh gudang: akun persediaan tidak dipecah
  // per lokasi (R6 di spesifikasi Gudang).
  const selisih = scope.warehouseId === 'all' ? Math.round(nilai) - Math.round(buku) : 0;

  const exportBalances = () => {
    downloadCsv(`saldo-stok-${asOf}.csv`, [
      ['Produk', 'SKU', 'Satuan', 'Qty', 'Stok minimum', ...(showValue ? ['Harga rata-rata', 'Nilai'] : [])],
      ...rows.map((r) => [
        r.product.name,
        r.product.sku,
        unitName(data.units, r.product.baseUnitId ?? r.product.buyUnitId),
        r.qty,
        r.minQty || '',
        ...(showValue ? [Math.round(r.avg), Math.round(r.value)] : []),
      ]),
    ]);
  };

  const exportMoves = () => {
    const list = listMoves(data.moves, { warehouseId: scope.warehouseId, from: scope.from, to: scope.to });
    downloadCsv('riwayat-mutasi.csv', [
      ['Tanggal', 'No. dokumen', 'Jenis', 'Produk', 'Gudang', 'Masuk', 'Keluar', ...(showValue ? ['Harga satuan', 'Nilai'] : [])],
      ...list.map((m) => [
        formatDate(m.date),
        m.sourceNo,
        MOVE_TYPE[m.type].label,
        data.products.find((p) => p.id === m.productId)?.name ?? m.productId,
        data.warehouses.find((w) => w.id === m.warehouseId)?.name ?? m.warehouseId,
        m.qtyIn || '',
        m.qtyOut || '',
        ...(showValue ? [Math.round(m.unit), Math.round(m.amount)] : []),
      ]),
    ]);
  };

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro
        icon={ArrowsLeftRight}
        title="Mutasi Stok"
        description="Saldo dan riwayat barang masuk, keluar, dan berpindah di semua gudang. Angka di menu Gudang dan Produk dibaca dari sini."
        actions={
          <>
            <Button
              variant="default"
              radius="md"
              leftSection={<DownloadSimple size={16} />}
              onClick={tab === 'saldo' ? exportBalances : exportMoves}
            >
              Ekspor
            </Button>
            <Button radius="md" leftSection={<ArrowsLeftRight size={16} />} onClick={onNewTransfer}>
              Pindah barang
            </Button>
          </>
        }
      />

      {tab === 'saldo' && (
        <>
          <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
            <Grid gutter={0}>
              {[
                showValue && ['Nilai persediaan', rupiah(Math.round(nilai)), Package],
                ['Produk dilacak', `${number.format(distinctItemCount(rows))} produk`, Package],
                ['Di bawah minimum', `${number.format(alerts.below)} produk`, Warning],
                ['Habis', `${number.format(alerts.habis)} produk`, Prohibit],
              ]
                .filter(Boolean)
                .map(([label, value, Icon], i) => (
                  <Grid.Col
                    key={label}
                    span={{ base: 12, sm: 6, lg: showValue ? 3 : 4 }}
                    style={i > 0 ? { borderLeft: '1px solid var(--mantine-color-gray-3)' } : undefined}
                  >
                    <StatCell icon={Icon} label={label}>
                      {value}
                    </StatCell>
                  </Grid.Col>
                ))}
            </Grid>
          </Card>

          {showValue && scope.warehouseId === 'all' && (
            <Callout
              tone={selisih === 0 ? 'ok' : 'warn'}
              title={
                selisih === 0
                  ? `Cocok dengan buku besar (${accountLabel(AKUN.persediaan)})`
                  : `Selisih ${rupiah(Math.abs(selisih))} dengan akun Persediaan`
              }
            >
              {selisih === 0
                ? `Total nilai persediaan per ${formatDate(asOf)} sama dengan saldo akun Persediaan.`
                : 'Penyebab umum: ada jurnal manual ke akun Persediaan. Akun ini sebaiknya hanya diisi lewat dokumen persediaan.'}
            </Callout>
          )}
        </>
      )}

      <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
        <TabBar tabs={tabs} value={tab} onChange={setTab} />
        {tab === 'saldo' ? (
          <StockBalances
            data={data}
            scope={{ warehouseId: scope.warehouseId, asOf }}
            onScope={onScope}
            showValue={showValue}
            categories={data.categories}
            onOpenCard={(row, warehouseId) =>
              onOpenCard(row.productId, warehouseId ?? scope.warehouseId)
            }
          />
        ) : tab === 'pindah' ? (
          <TransferList
            data={data}
            warehouseName={(id) => data.warehouses.find((w) => w.id === id)?.name ?? id}
            onOpen={onOpenTransfer}
          />
        ) : (
          <MoveHistory
            data={data}
            filter={{
              warehouseId: scope.warehouseId,
              productId: scope.productId ?? null,
              from: scope.from,
              to: scope.to,
            }}
            onFilter={onScope}
            showValue={showValue}
            onOpenSource={onOpenSource}
            onOpenJournal={onOpenJournal}
          />
        )}
      </Card>

      <Group gap={6} wrap="nowrap" align="flex-start">
        <CheckCircle size={14} />
        <Text fz={11} c="slate.6">
          Mutasi tidak bisa diubah atau dihapus. Koreksi dilakukan dengan membatalkan
          dokumen asalnya, yang mencatat mutasi pembalik.
        </Text>
      </Group>

    </Stack>
  );
}

export { sumValue };
