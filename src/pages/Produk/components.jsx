// Potongan tampilan yang dipakai bersama halaman Produk & Jasa.
import {
  Badge,
  Box,
  Card,
  Grid,
  Group,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { Invoice, Package, ShoppingCart, Warehouse } from '@/components/Icon.jsx';
import { CompositionCard, QueueCard } from '@/components/overview.jsx';
import { baseUnitOf, unitName } from './catalog.js';

const number = new Intl.NumberFormat('id-ID');

export function ProductStats({ products, categories, units, onFilter }) {
  const total = products.length;
  const sold = products.filter((product) => product.sellable).length;
  const purchased = products.filter((product) => product.purchasable).length;
  const tracked = products.filter((product) => product.tracked).length;
  const parts = [
    { key: 'tracked', label: 'Stok dilacak', value: tracked, color: 'primary.9' },
    { key: 'untracked', label: 'Non-stok', value: total - tracked, color: 'slate.3' },
  ].map((part) => ({
    ...part,
    display: number.format(part.value),
    hint: total ? `${Math.round(part.value / total * 100)}% dari katalog` : '',
  }));
  const shortcuts = [
    { key: 'dijual', label: 'Bisa dijual', hint: 'Tersedia untuk transaksi penjualan', value: sold, icon: Invoice, tone: 'blue' },
    { key: 'dibeli', label: 'Bisa dibeli', hint: 'Tersedia untuk transaksi pembelian', value: purchased, icon: ShoppingCart, tone: 'teal' },
    { key: 'dilacak', label: 'Stok dilacak', hint: 'Jumlah persediaan dicatat per gudang', value: tracked, icon: Warehouse, tone: 'gray' },
  ].map((item) => ({ ...item, value: number.format(item.value), onClick: () => onFilter(item.key) }));

  return (
    <Grid component="section" aria-label="Ringkasan produk dan jasa" gutter="lg" align="stretch">
      <Grid.Col span={{ base: 12, lg: 7 }}>
        <CompositionCard
          title="Total produk & jasa"
          text={total ? `${number.format(categories.length)} kategori · ${number.format(units.length)} satuan` : 'Katalog masih kosong'}
          figure={number.format(total)}
          parts={parts}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, lg: 5 }}>
        <QueueCard items={shortcuts} secondaryIcons />
      </Grid.Col>
    </Grid>
  );
}

// --- Potongan kecil ---------------------------------------------------------

export function ProductAvatar({ size = 34 }) {
  return (
    <ThemeIcon size={size} radius="md" variant="light" bg="primary.0" c="primary.9">
      <Package size={Math.round(size * 0.55)} />
    </ThemeIcon>
  );
}

const STOCK_BADGE = {
  'non-stok': { label: 'Non-stok', color: 'slate', hint: 'Stok tidak dihitung' },
  habis: { label: 'Stok habis', color: 'red', hint: 'Tidak ada stok di gudang mana pun' },
  aman: { label: 'Dilacak', color: 'green', hint: 'Stok dihitung' },
};

/**
 * Status stok produk di tingkat katalog. Qty datang dari saldo gudang (Mutasi Stok),
 * bukan dari master produk. Status "di bawah minimum" tidak dihitung di sini karena
 * stok minimum berlaku per produk per gudang, bukan per produk.
 */
export const stockBadgeOf = (product, totalQty = 0) =>
  STOCK_BADGE[!product.tracked ? 'non-stok' : totalQty > 0 ? 'aman' : 'habis'];

export function StockCell({ product, totalQty = 0, units = [] }) {
  const s = stockBadgeOf(product, totalQty);
  return (
    <Stack gap={2}>
      <Badge size="sm" radius="sm" variant="light" color={s.color} tt="none" fw={600}>
        {s.label}
      </Badge>
      <Text fz={10} c="slate.6">
        {product.tracked
          ? `${number.format(totalQty)} ${unitName(units, baseUnitOf(product))}`.trim()
          : s.hint}
      </Text>
    </Stack>
  );
}

// Kartu bagian pada halaman rincian (judul + deskripsi + isi).
export function SectionCard({ icon: Icon, title, description, children, right }) {
  return (
    <Card withBorder radius="lg" padding="lg" bg="white">
      <Group justify="space-between" align="flex-start" wrap="nowrap" mb="md" gap="sm">
        <Group gap="sm" wrap="nowrap" align="flex-start">
          {Icon && (
            <ThemeIcon size={32} radius="md" variant="light" bg="primary.0" c="primary.9">
              <Icon size={18} />
            </ThemeIcon>
          )}
          <Box>
            <Text fz="sm" fw={700} c="slate.9">
              {title}
            </Text>
            {description && (
              <Text fz={11} c="slate.6">
                {description}
              </Text>
            )}
          </Box>
        </Group>
        {right}
      </Group>
      {children}
    </Card>
  );
}

export function InfoItem({ label, value, empty = '—' }) {
  const kosong = value === null || value === undefined || value === '';
  return (
    <Box>
      <Text fz={11} c="slate.6">
        {label}
      </Text>
      <Text fz="sm" fw={600} c={kosong ? 'slate.5' : 'slate.9'}>
        {kosong ? empty : value}
      </Text>
    </Box>
  );
}
