// Potongan tampilan yang dipakai bersama halaman Produk & Jasa.
import {
  Badge,
  Box,
  Card,
  Grid,
  Group,
  Progress,
  RingProgress,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { Package } from '@/components/Icon.jsx';
import { baseUnitOf, unitName } from './catalog.js';

const number = new Intl.NumberFormat('id-ID');

// --- Kartu statistik di atas tabel ------------------------------------------

function StatCard({ label, value, hint, right }) {
  return (
    <Card withBorder radius="lg" padding="lg" bg="white" h="100%">
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm" h="100%">
        <Box style={{ minWidth: 0 }}>
          <Text fz={11} c="slate.7" fw={600}>
            {label}
          </Text>
          <Text fz={32} fw={700} c="slate.9" lh={1.2}>
            {value}
          </Text>
          <Text fz={11} c="slate.6">
            {hint}
          </Text>
        </Box>
        {right}
      </Group>
    </Card>
  );
}

// Batang kecil per kategori — meniru sparkline pada kartu "Total produk".
function CategoryBars({ products, categories }) {
  const counts = categories
    .map((c) => products.filter((p) => p.categoryId === c.id).length)
    .filter((n) => n > 0);
  const max = Math.max(1, ...counts);
  const shown = counts.length ? counts : [0];
  return (
    <Group gap={4} align="flex-end" h={48} wrap="nowrap">
      {shown.slice(0, 8).map((n, i) => (
        <Box
          key={i}
          w={6}
          h={Math.max(4, Math.round((n / max) * 48))}
          bg={n === max ? 'primary.9' : 'slate.2'}
          style={{ borderRadius: 3 }}
        />
      ))}
    </Group>
  );
}

export function ProductStats({ products, categories, units }) {
  const total = products.length;
  const dijual = products.filter((p) => p.sellable).length;
  const dibeli = products.filter((p) => p.purchasable).length;
  const dilacak = products.filter((p) => p.tracked).length;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <Grid gutter="md">
      <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
        <StatCard
          label="Total produk"
          value={number.format(total)}
          hint={`${categories.length} kategori · ${units.length} satuan`}
          right={<CategoryBars products={products} categories={categories} />}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
        <StatCard
          label="Dijual"
          value={number.format(dijual)}
          hint="Muncul di penjualan"
          right={
            <RingProgress
              size={64}
              thickness={7}
              roundCaps
              sections={[{ value: pct(dijual), color: 'primary.9' }]}
              label={
                <Text ta="center" fz={11} fw={700} c="primary.9">
                  {pct(dijual)}%
                </Text>
              }
            />
          }
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
        <StatCard
          label="Dibeli"
          value={number.format(dibeli)}
          hint="Muncul di pembelian"
          right={
            <Box w={110}>
              <Text fz={11} fw={700} c="slate.9" ta="right">
                {pct(dibeli)}%
              </Text>
              <Progress value={pct(dibeli)} size="sm" radius="xl" color="primary.9" mt={6} />
            </Box>
          }
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
        <StatCard
          label="Stok dilacak"
          value={number.format(dilacak)}
          hint="Stok dihitung"
          right={
            <Box w={120}>
              <Progress.Root size={8} radius="xl">
                <Tooltip label={`Dilacak: ${dilacak}`} withArrow fz="xs">
                  <Progress.Section value={pct(dilacak)} color="primary.9" />
                </Tooltip>
                <Tooltip label={`Non-stok: ${total - dilacak}`} withArrow fz="xs">
                  <Progress.Section value={100 - pct(dilacak)} color="slate.2" />
                </Tooltip>
              </Progress.Root>
              <Group gap={6} justify="flex-end" mt={8} wrap="nowrap">
                <Box w={8} h={8} bg="primary.9" style={{ borderRadius: '50%' }} />
                <Text fz={10} c="slate.6">
                  Dilacak
                </Text>
                <Text fz={10} fw={700} c="slate.9">
                  {dilacak}
                </Text>
              </Group>
              <Group gap={6} justify="flex-end" mt={2} wrap="nowrap">
                <Box w={8} h={8} bg="slate.3" style={{ borderRadius: '50%' }} />
                <Text fz={10} c="slate.6">
                  Non-stok
                </Text>
                <Text fz={10} fw={700} c="slate.9">
                  {total - dilacak}
                </Text>
              </Group>
            </Box>
          }
        />
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
