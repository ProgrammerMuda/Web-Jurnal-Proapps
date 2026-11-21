// Rincian satu produk: pemetaan akun penjualan & pembelian, status persediaan,
// dan daftar dokumen yang memakainya di modul Penjualan / Pembelian.
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { CopyIcon } from '@/components/common.jsx';
import {
  ArrowLeft,
  Info,
  PencilSimple,
  ShoppingCart,
  Storefront,
  Trash,
  Warehouse,
} from '@/components/Icon.jsx';
import { accounts } from '@/pages/DaftarAkun/accounts.js';
import { rupiah } from '@/pages/Penjualan/utils.js';
import { formatDate } from '@/pages/Pembelian/utils.js';
import { lastPostedOpname, runningOpnameOf } from '@/pages/Gudang/opname.js';
import { InfoItem, ProductAvatar, SectionCard, stockBadgeOf } from './components.jsx';
import { baseUnitOf, buyTaxOptions, categoryName, saleTaxOptions, unitName } from './catalog.js';
import { USAGE_LABEL, USAGE_NAV, productUsage } from './usage.js';
import { DataTable, DocNumber, StatusPill } from '@/pages/Pembelian/components.jsx';
import {
  STOCK_STATUS,
  productWarehouseRows,
  stockStatusOf,
} from '@/pages/Gudang/stock.js';

const number = new Intl.NumberFormat('id-ID');
const accountLabel = (code) => {
  const a = accounts.find((x) => x.code === code);
  return a ? `${a.code} · ${a.name}` : null;
};
const taxLabel = (options, value) =>
  options.find((t) => t.value === value)?.label ?? 'Bebas Pajak (0%)';

// Satu angka besar di strip ringkasan atas.
function Metric({ label, value, hint, color = 'slate.9' }) {
  return (
    <Box px="lg" py="md">
      <Text fz={11} c="slate.6">
        {label}
      </Text>
      <Text fz={22} fw={700} c={color} lh={1.3}>
        {value}
      </Text>
      <Text fz={11} c="slate.6">
        {hint}
      </Text>
    </Box>
  );
}

function UsageTable({ rows, empty, onOpen, partyLabel }) {
  if (!rows.length)
    return (
      <Alert color="slate" variant="light" radius="md" icon={<Info size={16} />}>
        <Text fz="xs">{empty}</Text>
      </Alert>
    );
  return (
    <Box
      style={{
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 'var(--mantine-radius-md)',
        overflow: 'hidden',
      }}
    >
      <ScrollArea type="auto">
        <Table verticalSpacing="xs" horizontalSpacing="md" miw={560} highlightOnHover>
          <Table.Thead bg="slate.0">
            <Table.Tr>
              <Table.Th fz="xs">Dokumen</Table.Th>
              <Table.Th fz="xs">Tanggal</Table.Th>
              <Table.Th fz="xs">{partyLabel}</Table.Th>
              <Table.Th fz="xs" ta="right">
                Qty
              </Table.Th>
              <Table.Th fz="xs" ta="right">
                Nilai
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr
                key={`${r.kind}-${r.id}`}
                style={{ cursor: 'pointer' }}
                onClick={() => onOpen(r)}
              >
                <Table.Td>
                  <Text fz="xs" fw={700} c="primary.9">
                    {r.number}
                  </Text>
                  <Text fz={10} c="slate.6">
                    {USAGE_LABEL[r.kind]}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text fz="xs" c="slate.7">
                    {formatDate(r.date)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text fz="xs" c="slate.7" truncate maw={200}>
                    {r.party ?? '—'}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text fz="xs" c="slate.9">
                    {number.format(r.qty)}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  {/* Permintaan (FPPBJ) memang belum berharga — harga baru datang dari
                      penawaran vendor di tahap pengadaan. */}
                  <Text fz="xs" fw={600} c={r.kind === 'fppbj' ? 'slate.5' : 'slate.9'}>
                    {r.kind === 'fppbj' ? 'Belum berharga' : rupiah(r.amount)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Box>
  );
}

// Stok produk ini dipecah per gudang, lengkap dengan stok minimum dan statusnya —
// bukan satu baris matriks. Angkanya tetap dari buku besar Mutasi Stok.
function WarehouseStockRows({ product, stockData, units, onOpenStockCard }) {
  const rows = productWarehouseRows(stockData, product, stockData.today);
  if (!rows.length)
    return (
      <Box px="lg" pb="lg">
        <Alert color="slate" variant="light" radius="md" icon={<Info size={16} />}>
          <Text fz="xs">Produk ini belum punya stok di gudang mana pun.</Text>
        </Alert>
      </Box>
    );
  const satuan = unitName(units, baseUnitOf(product));
  return (
    <Box p="lg" pt={0}>
      <DataTable
        head={[
          { label: 'Gudang' },
          { label: 'Qty', align: 'right' },
          { label: 'Satuan' },
          { label: 'Stok min.', align: 'right' },
          { label: 'Status' },
          { label: 'Terakhir diopname' },
          { label: 'Nilai', align: 'right' },
        ]}
        minWidth={820}
      >
        {rows.map((r) => (
          <Table.Tr key={r.warehouse.id}>
            <Table.Td>
              <DocNumber onClick={() => onOpenStockCard?.(product.id, r.warehouse.id)}>
                {r.warehouse.name}
              </DocNumber>
              <Text fz={10} c="slate.6">
                {r.warehouse.code}
                {r.warehouse.status === 'inactive' ? ' · nonaktif' : ''}
              </Text>
            </Table.Td>
            <Table.Td ta="right">
              <Text fz="sm" fw={700} c="slate.9">
                {number.format(r.qty)}
              </Text>
            </Table.Td>
            <Table.Td>
              <Text fz="sm" c="slate.7">
                {satuan}
              </Text>
            </Table.Td>
            <Table.Td ta="right">
              <Text fz="sm" c={r.minQty > 0 ? 'slate.7' : 'slate.5'}>
                {r.minQty > 0 ? number.format(r.minQty) : 'Tidak dipantau'}
              </Text>
            </Table.Td>
            <Table.Td>
              <StatusPill map={STOCK_STATUS} status={stockStatusOf(r)} />
            </Table.Td>
            <Table.Td>
              {/* Kapan qty gudang ini terakhir dibuktikan secara fisik. */}
              <Text fz="sm" c="slate.7">
                {lastPostedOpname(stockData.opnames, r.warehouse.id)
                  ? formatDate(lastPostedOpname(stockData.opnames, r.warehouse.id).date)
                  : '—'}
              </Text>
              {runningOpnameOf(stockData.opnames, r.warehouse.id) && (
                <Text fz={10} c="orange.7">
                  Sedang diopname
                </Text>
              )}
            </Table.Td>
            <Table.Td ta="right">
              <Text fz="sm" fw={600} c="slate.9">
                {rupiah(Math.round(r.value))}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </DataTable>
    </Box>
  );
}

export default function ProductDetail({
  product,
  categories,
  units,
  totalQty = 0,
  warehouseCount = 0,
  stockData = null,
  onOpenStockCard,
  data,
  onBack,
  onEdit,
  onDelete,
  onNavigate,
}) {
  const usage = productUsage(product, data);
  const stock = stockBadgeOf(product, totalQty);
  const party = (id, list) => list?.[id]?.displayName ?? list?.[id]?.name ?? null;
  const penjualan = usage.penjualan.map((r) => ({ ...r, party: party(r.partyId, data.contactsById) }));
  const pembelian = usage.pembelian.map((r) => ({
    ...r,
    party: data.pb?.vendors?.find((v) => v.id === r.partyId)?.name ?? null,
  }));

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      {/* Header */}
      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
          <Group gap="md" wrap="nowrap" align="flex-start">
            <ProductAvatar size={44} />
            <Box>
              <Title order={3} fz="xl" c="slate.9" tt="uppercase">
                {product.name}
              </Title>
              <Group gap={8} mt={4} wrap="wrap">
                <Text fz="xs" c="slate.6">
                  {product.sku}
                </Text>
                <CopyIcon value={product.sku} />
                <Text fz="xs" c="slate.5">
                  ·
                </Text>
                <Text fz="xs" c="slate.6">
                  {categoryName(categories, product.categoryId) || 'Tanpa kategori'}
                </Text>
                {product.sellable && (
                  <Badge size="sm" radius="sm" variant="light" color="primary" tt="none">
                    Dijual
                  </Badge>
                )}
                {product.purchasable && (
                  <Badge size="sm" radius="sm" variant="light" color="orange" tt="none">
                    Dibeli
                  </Badge>
                )}
                <Badge size="sm" radius="sm" variant="light" color={stock.color} tt="none">
                  {product.tracked ? 'Dilacak' : 'Non-stok / jasa'}
                </Badge>
              </Group>
              <Text fz={11} c="slate.6" mt={6}>
                Dibuat pada {formatDate(product.createdAt.slice(0, 10))} • Diperbarui pada{' '}
                {formatDate(product.updatedAt.slice(0, 10))}
              </Text>
            </Box>
          </Group>
          <Group gap="xs">
            <Button
              variant="default"
              radius="md"
              leftSection={<ArrowLeft size={16} />}
              onClick={onBack}
            >
              Kembali ke Daftar Produk
            </Button>
            <Button
              variant="default"
              color="red"
              c="red.7"
              radius="md"
              leftSection={<Trash size={16} />}
              onClick={onDelete}
            >
              Hapus
            </Button>
            <Button radius="md" leftSection={<PencilSimple size={16} />} onClick={onEdit}>
              Ubah Produk
            </Button>
          </Group>
        </Group>
      </Card>

      {/* Strip ringkasan */}
      <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
        <Grid gutter={0}>
          {[
            {
              label: 'Harga Jual',
              value: product.sellable ? rupiah(product.salePrice) : 'Tidak Dijual',
              hint: product.sellable
                ? `Pajak: ${taxLabel(saleTaxOptions, product.saleTax)}`
                : 'Tidak muncul di penjualan',
            },
            {
              label: 'Harga Beli',
              value: product.purchasable ? rupiah(product.buyPrice) : 'Tidak Dibeli',
              hint: product.purchasable
                ? `Pajak: ${taxLabel(buyTaxOptions, product.buyTax)}`
                : 'Tidak muncul di pembelian',
            },
            {
              label: 'Satuan dasar',
              value: unitName(units, baseUnitOf(product)) || '—',
              hint: baseUnitOf(product) ? 'Satuan pencatatan stok' : 'Belum ada satuan',
            },
            {
              label: 'Persediaan',
              value: product.tracked
                ? `${number.format(totalQty)} ${unitName(units, baseUnitOf(product))}`.trim()
                : 'Non-stok / jasa',
              hint: product.tracked
                ? `Tersebar di ${number.format(warehouseCount)} gudang`
                : 'Stok tidak dihitung',
              color: product.tracked ? `${stock.color}.7` : 'slate.9',
            },
          ].map((m, i) => (
            <Grid.Col
              key={m.label}
              span={{ base: 12, sm: 6, lg: 3 }}
              style={
                i > 0 ? { borderLeft: '1px solid var(--mantine-color-gray-3)' } : undefined
              }
            >
              <Metric {...m} />
            </Grid.Col>
          ))}
        </Grid>
      </Card>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="lg">
            <SectionCard
              icon={Storefront}
              title="Pengaturan Penjualan"
              description="Mapping akun dan tarif pajak saat membuat faktur atau tagihan pelanggan."
            >
              {product.sellable ? (
                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <InfoItem label="Harga Satuan Standar" value={rupiah(product.salePrice)} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <InfoItem
                      label="Tarif Pajak Penjualan"
                      value={taxLabel(saleTaxOptions, product.saleTax)}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <InfoItem
                      label="Akun Penjualan (Kredit)"
                      value={accountLabel(product.saleAccount)}
                      empty="Belum dipetakan"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <InfoItem
                      label="Akun Piutang (Debit)"
                      value={accountLabel(product.arAccount)}
                      empty="Belum dipetakan"
                    />
                  </Grid.Col>
                </Grid>
              ) : (
                <Alert color="slate" variant="light" radius="md" icon={<Info size={16} />}>
                  <Text fz="xs">Produk ini tidak ditandai untuk dijual ke pelanggan.</Text>
                </Alert>
              )}
            </SectionCard>

            <SectionCard
              icon={ShoppingCart}
              title="Pengaturan Pembelian"
              description="Mapping akun beban/biaya dan pajak saat transaksi pengadaan dari vendor."
            >
              {product.purchasable ? (
                <Grid gutter="md">
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <InfoItem label="Harga Beli Acuan" value={rupiah(product.buyPrice)} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <InfoItem
                      label="Tarif Pajak Pembelian"
                      value={taxLabel(buyTaxOptions, product.buyTax)}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <InfoItem
                      label="Akun Pembelian (Debit)"
                      value={accountLabel(product.buyAccount)}
                      empty="Belum dipetakan"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <InfoItem
                      label="Satuan Pembelian"
                      value={unitName(units, product.buyUnitId)}
                      empty="Belum ada satuan"
                    />
                  </Grid.Col>
                </Grid>
              ) : (
                <Alert color="slate" variant="light" radius="md" icon={<Info size={16} />}>
                  <Text fz="xs">Produk ini tidak ditandai untuk dibeli dari pemasok.</Text>
                </Alert>
              )}
            </SectionCard>

            <SectionCard
              icon={Warehouse}
              title="Manajemen Persediaan & Stok"
              description="Pelacakan saldo fisik barang dan akun neraca persediaan."
            >
              {product.tracked ? (
                <Stack gap="md">
                  <Grid gutter="md">
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <InfoItem
                        label="Stok Seluruh Gudang"
                        value={`${number.format(totalQty)} ${unitName(units, baseUnitOf(product))}`.trim()}
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <InfoItem
                        label="Satuan Dasar"
                        value={unitName(units, baseUnitOf(product))}
                        empty="Belum ada satuan"
                      />
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <InfoItem
                        label="Akun Persediaan"
                        value={accountLabel(product.inventoryAccount)}
                        empty="Belum dipetakan"
                      />
                    </Grid.Col>
                  </Grid>
                  <Alert color="slate" variant="light" radius="md" icon={<Info size={16} />}>
                    <Text fz="xs">
                      Qty dan stok minimum dicatat per gudang. Rinciannya ada di menu Mutasi
                      Stok; stok hanya berubah lewat dokumen, bukan dari halaman produk.
                    </Text>
                  </Alert>
                </Stack>
              ) : (
                <Alert color="slate" variant="light" radius="md" icon={<Info size={16} />}>
                  <Text fz="xs">
                    Stok produk ini tidak dihitung, sehingga tidak ada nilai persediaan yang
                    dibukukan.
                  </Text>
                </Alert>
              )}
            </SectionCard>

            {/* Stok per gudang — komponen yang sama dengan tab Saldo stok di Mutasi
                Stok, jadi angkanya tidak mungkin berbeda. */}
            {product.tracked && stockData && (
              <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
                <Box px="lg" pt="md" pb="xs">
                  <Group gap="sm" wrap="nowrap" align="flex-start">
                    <ThemeIcon size={32} radius="md" variant="light" bg="primary.0" c="primary.9">
                      <Warehouse size={18} />
                    </ThemeIcon>
                    <Box>
                      <Text fz="sm" fw={700} c="slate.9">
                        Stok per Gudang
                      </Text>
                      <Text fz={11} c="slate.6">
                        Hanya baca. Stok berubah lewat dokumen persediaan, bukan dari halaman ini.
                      </Text>
                    </Box>
                  </Group>
                </Box>
                <WarehouseStockRows
                  product={product}
                  stockData={stockData}
                  units={units}
                  onOpenStockCard={onOpenStockCard}
                />
              </Card>
            )}

            {/* Jembatan ke modul transaksi */}
            <SectionCard
              icon={Storefront}
              title="Dipakai di Penjualan"
              description="Penawaran, pesanan, dan faktur yang memuat produk ini."
              right={
                <Badge size="sm" radius="sm" variant="light" color="primary" tt="none">
                  {penjualan.length} dokumen
                </Badge>
              }
            >
              <UsageTable
                rows={penjualan}
                partyLabel="Pelanggan"
                empty="Belum ada dokumen penjualan yang memakai produk ini."
                onOpen={(r) => onNavigate?.(USAGE_NAV[r.kind])}
              />
            </SectionCard>

            <SectionCard
              icon={ShoppingCart}
              title="Dipakai di Pembelian"
              description="Permintaan, pesanan pembelian, dan tagihan vendor yang memuat produk ini."
              right={
                <Badge size="sm" radius="sm" variant="light" color="orange" tt="none">
                  {pembelian.length} dokumen
                </Badge>
              }
            >
              <UsageTable
                rows={pembelian}
                partyLabel="Vendor"
                empty="Belum ada dokumen pembelian yang memakai produk ini."
                onOpen={(r) => onNavigate?.(USAGE_NAV[r.kind])}
              />
            </SectionCard>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <SectionCard
            icon={Info}
            title="Rincian Produk"
            description="Kode produk dan riwayat perubahan"
          >
            <Stack gap="md">
              <Box>
                <Text fz={11} c="slate.6">
                  SKU
                </Text>
                <Group gap={6} wrap="nowrap">
                  <Text fz="sm" fw={600} c="slate.9">
                    {product.sku}
                  </Text>
                  <CopyIcon value={product.sku} />
                </Group>
              </Box>
              <InfoItem label="Kode Eksternal" value={product.externalCode} empty="Belum diisi" />
              <InfoItem label="Jenis" value={product.kind === 'jasa' ? 'Jasa' : 'Barang'} />
              <InfoItem
                label="Kategori"
                value={categoryName(categories, product.categoryId)}
                empty="Tanpa kategori"
              />
              <InfoItem label="Deskripsi" value={product.description} empty="Belum diisi" />
              <InfoItem label="Dibuat" value={formatDate(product.createdAt.slice(0, 10))} />
              <InfoItem
                label="Terakhir Diperbarui"
                value={formatDate(product.updatedAt.slice(0, 10))}
              />
            </Stack>
          </SectionCard>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
