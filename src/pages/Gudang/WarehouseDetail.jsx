// Detail gudang: identitas, ringkasan, lalu tab Stok, Mutasi terakhir, dan
// Riwayat perubahan. Semua angka stok dibaca dari stock.js, tidak dihitung di sini.
import { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Center,
  Grid,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import {
  ArrowsLeftRight,
  Clock,
  Info,
  PencilSimple,
  Package,
  Prohibit,
  CheckCircle,
  Trash,
  Warehouse,
} from '@/components/Icon.jsx';
import {
  BackLink,
  CardHead,
  DataTable,
  EmptyState,
  RowMenu,
  Section,
  StatCell,
  StatusPill,
  TabBar,
} from '@/pages/Pembelian/components.jsx';
import { formatDate } from '@/pages/Pembelian/utils.js';
import { rupiah } from '@/pages/Penjualan/utils.js';
import { unitName } from '@/pages/Produk/catalog.js';
import { FIELD_LABEL, STATUS_PILL, picLabel, picName, picTitle } from './data.js';
import StockBalances from './StockBalances.jsx';
import MoveHistory from './MoveHistory.jsx';
import { balanceRows, belowMinimumCount, distinctItemCount, sumValue } from './stock.js';

const number = new Intl.NumberFormat('id-ID');
const dateTime = (iso) => `${formatDate(iso.slice(0, 10))}, ${iso.slice(11, 16).replace(':', '.')}`;

const tabs = [
  { value: 'stok', label: 'Stok', icon: Package },
  { value: 'mutasi', label: 'Mutasi terakhir', icon: ArrowsLeftRight },
  { value: 'riwayat', label: 'Riwayat perubahan', icon: Clock },
];

// Nilai field pada tab Riwayat perubahan ditulis dengan kata, bukan kode mentah.
function fieldValue(field, value) {
  if (value === null || value === undefined || value === '') return '(kosong)';
  if (field === 'status') return STATUS_PILL[value]?.label ?? value;
  if (field === 'isDefault') return value ? 'Ya' : 'Tidak';
  if (field === 'picUserId') return picLabel(value) ?? value;
  return String(value);
}

// Sel informasi bergaris, mengikuti kartu rincian di modul Pembelian: baris dipisah
// garis atas, kolom kedua dipisah garis kiri.
function InfoCell({ label, value, sub, divider, empty = 'Belum diisi' }) {
  const kosong = value === null || value === undefined || value === '';
  return (
    <Box
      px="lg"
      py="md"
      style={{
        minWidth: 0,
        borderLeft: divider ? '1px solid var(--mantine-color-gray-2)' : undefined,
      }}
    >
      <Text fz={11} fw={600} c="slate.6">
        {label}
      </Text>
      <Text
        fz="sm"
        fw={600}
        lh={1.35}
        c={kosong ? 'slate.5' : 'slate.9'}
        style={{ overflowWrap: 'anywhere' }}
      >
        {kosong ? empty : value}
      </Text>
      {!kosong && sub && (
        <Text fz="xs" c="slate.6">
          {sub}
        </Text>
      )}
    </Box>
  );
}

// Baris kedua dan seterusnya diberi garis atas supaya kisinya terbaca rapi.
const rowDivider = { borderTop: '1px solid var(--mantine-color-gray-2)' };

function LogsTab({ logs, products, units }) {
  const productName = (id) => products.find((p) => p.id === id)?.name ?? id;
  return (
    <Box p="lg">
      <DataTable
        head={[{ label: 'Waktu', w: 190 }, { label: 'Pengguna', w: 200 }, { label: 'Perubahan' }]}
        minWidth={720}
        empty={
          logs.length ? null : (
            <EmptyState
              icon={Clock}
              title="Belum ada perubahan"
              text="Setiap perubahan data gudang akan tercatat di sini."
            />
          )
        }
      >
        {logs.map((l) => (
          <Table.Tr key={l.id}>
            <Table.Td>
              <Text fz="sm" c="slate.7">
                {dateTime(l.at)}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text fz="sm" fw={600} c="slate.9">
                {l.userName}
              </Text>
            </Table.Td>
            <Table.Td>
              <Stack gap={2}>
                {l.changes.map((c, i) => (
                  <Text key={i} fz="xs" c="slate.7">
                    <Text span fz="xs" fw={700} c="slate.9">
                      {FIELD_LABEL[c.field] ?? c.field}
                      {c.productId ? ` · ${productName(c.productId)}` : ''}
                    </Text>
                    {': '}
                    {fieldValue(c.field, c.from)} → {fieldValue(c.field, c.to)}
                    {c.field === 'minQty' && c.unitId ? ` ${unitName(units, c.unitId)}` : ''}
                  </Text>
                ))}
              </Stack>
            </Table.Td>
          </Table.Tr>
        ))}
      </DataTable>
    </Box>
  );
}

export default function WarehouseDetail({
  warehouse,
  data,
  logs,
  showValue,
  canDelete,
  onBack,
  onEdit,
  onMakeDefault,
  onDeactivate,
  onActivate,
  onDelete,
  onTransfer,
  onOpenCard,
  onSetMin,
  onOpenMoves,
}) {
  const [tab, setTab] = useState('stok');
  // Pindah ke gudang lain selalu mulai dari tab Stok.
  const [lastId, setLastId] = useState(warehouse.id);
  if (warehouse.id !== lastId) {
    setLastId(warehouse.id);
    setTab('stok');
  }
  const { products, units } = data;
  const rows = useMemo(
    () => balanceRows(data, { warehouseId: warehouse.id, asOf: data.today }),
    [data, warehouse.id],
  );
  const myLogs = useMemo(
    () => logs.filter((l) => l.warehouseId === warehouse.id).sort((a, b) => (a.at < b.at ? 1 : -1)),
    [logs, warehouse.id],
  );
  const nonaktif = warehouse.status === 'inactive';

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <BackLink label="Kembali ke daftar gudang" onClick={onBack} />

      {/* Header */}
      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
          <Group gap="md" wrap="nowrap" align="flex-start">
            <Box
              bg="primary.0"
              c="primary.9"
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--mantine-radius-md)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Warehouse size={24} />
            </Box>
            <Box>
              <Group gap={8} align="center" wrap="wrap">
                <Title order={3} fz="xl" c="slate.9">
                  {warehouse.name}
                </Title>
                {warehouse.isDefault && (
                  <Badge size="sm" radius="sm" variant="light" color="primary" tt="none">
                    Utama
                  </Badge>
                )}
                {nonaktif && <StatusPill map={STATUS_PILL} status="inactive" />}
              </Group>
              <Text fz="xs" c="slate.6" mt={2}>
                {warehouse.code}
                {warehouse.city ? ` · ${warehouse.city}` : ''}
              </Text>
            </Box>
          </Group>
          <Group gap="xs">
            <Button
              radius="md"
              leftSection={<ArrowsLeftRight size={16} />}
              onClick={onTransfer}
            >
              Pindah barang
            </Button>
            <RowMenu
              label={warehouse.name}
              items={[
                { label: 'Ubah', icon: PencilSimple, onClick: onEdit },
                !warehouse.isDefault &&
                  !nonaktif && { label: 'Jadikan utama', icon: Warehouse, onClick: onMakeDefault },
                nonaktif
                  ? { label: 'Aktifkan', icon: CheckCircle, onClick: onActivate }
                  : { label: 'Nonaktifkan', icon: Prohibit, onClick: onDeactivate },
                canDelete && { divider: true, key: 'd' },
                canDelete && { label: 'Hapus', icon: Trash, color: 'red', onClick: onDelete },
              ]}
            />
          </Group>
        </Group>
      </Card>

      {/* Kartu info */}
      <Section
        icon={Info}
        title="Informasi gudang"
        description="Lokasi, penanggung jawab, dan catatan"
        divided
        flush
      >
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={0}>
          <InfoCell label="Alamat" value={warehouse.address} />
          <InfoCell
            label="Kota / kode pos"
            value={[warehouse.city, warehouse.postalCode].filter(Boolean).join(' ')}
            divider
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={0} style={rowDivider}>
          <InfoCell
            label="Penanggung jawab"
            value={picName(warehouse.picUserId)}
            empty="Belum ditunjuk"
            // Jabatan jadi baris kedua yang redup, bukan disambung tanda titik.
            sub={picTitle(warehouse.picUserId)}
          />
          <InfoCell label="Telepon" value={warehouse.phone} divider />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={0} style={rowDivider}>
          <InfoCell label="Catatan" value={warehouse.notes} />
          <InfoCell
            label="Dibuat"
            value={`${warehouse.createdBy} · ${formatDate(warehouse.createdAt.slice(0, 10))}`}
            divider
          />
        </SimpleGrid>
      </Section>

      {/* Ringkasan */}
      <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
        <Grid gutter={0}>
          <Grid.Col span={{ base: 12, sm: showValue ? 4 : 6 }}>
            <StatCell icon={Package} label="Jumlah item">
              {number.format(distinctItemCount(rows))} produk
            </StatCell>
          </Grid.Col>
          {showValue && (
            <Grid.Col
              span={{ base: 12, sm: 4 }}
              style={{ borderLeft: '1px solid var(--mantine-color-gray-3)' }}
            >
              <StatCell icon={Warehouse} label="Nilai persediaan">
                {rupiah(Math.round(sumValue(rows)))}
              </StatCell>
            </Grid.Col>
          )}
          <Grid.Col
            span={{ base: 12, sm: showValue ? 4 : 6 }}
            style={{ borderLeft: '1px solid var(--mantine-color-gray-3)' }}
          >
            <StatCell icon={Info} label="Item di bawah minimum">
              {number.format(belowMinimumCount(rows))} produk
            </StatCell>
          </Grid.Col>
        </Grid>
      </Card>

      {/* Tab */}
      <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
        <Box px="lg" pt="md">
          <CardHead icon={Warehouse} desc="Saldo dan riwayat dibaca dari Mutasi Stok">
            Isi gudang
          </CardHead>
        </Box>
        <TabBar tabs={tabs} value={tab} onChange={setTab} />
        {/* Komponen yang sama dengan menu Mutasi Stok — sumber angkanya satu. */}
        {tab === 'stok' && (
          <StockBalances
            data={data}
            scope={{ warehouseId: warehouse.id, asOf: data.today }}
            showValue={showValue}
            onOpenCard={(r) => onOpenCard(r.productId)}
            onSetMin={onSetMin}
            minWidth={showValue ? 940 : 740}
          />
        )}
        {tab === 'mutasi' && (
          <>
            <Group
              gap="md"
              px="lg"
              py="sm"
              bg="slate.0"
              justify="space-between"
              style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
            >
              <Text fz="xs" c="slate.6">
                20 mutasi terakhir di gudang ini. Sumbernya sama dengan menu Mutasi Stok.
              </Text>
              <Button variant="subtle" size="sm" radius="md" fz="xs" onClick={onOpenMoves}>
                Lihat semua di Mutasi Stok
              </Button>
            </Group>
            <MoveHistory
              data={data}
              filter={{ warehouseId: warehouse.id }}
              showValue={showValue}
              limit={20}
              onOpenSource={(m) => onOpenCard(m.productId)}
            />
          </>
        )}
        {tab === 'riwayat' && <LogsTab logs={myLogs} products={products} units={units} />}
      </Card>
    </Stack>
  );
}

// Dipakai bila kartu ringkasan dirender tanpa data (gudang baru dibuat).
export function EmptyStock() {
  return (
    <Center py="xl">
      <Text fz="sm" c="slate.6">
        Belum ada stok di gudang ini.
      </Text>
    </Center>
  );
}
