// Tabel saldo stok. Dipakai tiga tempat dengan komponen yang sama:
// tab Saldo stok di Mutasi Stok, tab Stok di detail gudang, dan Stok per gudang
// di detail produk. Angkanya selalu datang dari stock.js, tidak dihitung di sini.
import { useMemo, useState } from 'react';
import { Badge, Box, Group, Select, Table, Text, TextInput } from '@mantine/core';
import { Info, MagnifyingGlass, Package } from '@/components/Icon.jsx';
import {
  DataTable,
  DocNumber,
  EmptyState,
  RowMenu,
  StatusPill,
} from '@/pages/Pembelian/components.jsx';
import { rupiah } from '@/pages/Penjualan/utils.js';
import { unitName } from '@/pages/Produk/catalog.js';
import DateField from '@/components/DateField.jsx';
import { STOCK_STATUS, balanceRows, minQtyOf, stockStatusOf, warehouseColumns } from './stock.js';

const number = new Intl.NumberFormat('id-ID');
const satuan = (units, p) => unitName(units, p.baseUnitId ?? p.buyUnitId) || '—';

/**
 * @param scope        { warehouseId: id | 'all', asOf, productId }
 * @param onScope      ubah filter; kalau tidak diberi, toolbar tidak dirender
 * @param showValue    hak akses melihat harga & nilai (M11)
 * @param onOpenCard   buka kartu stok untuk baris ini
 * @param onSetMin     atur stok minimum (hanya saat satu gudang dipilih)
 */
export default function StockBalances({
  data,
  scope,
  onScope,
  showValue,
  categories = [],
  onOpenCard,
  onSetMin,
  right,
  minWidth,
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(null);
  const [category, setCategory] = useState(null);

  const semua = scope.warehouseId === 'all';
  // Gudang nonaktif yang masih menyimpan stok tetap diberi kolom, supaya tabel dan
  // total nilai persediaan tidak pernah bercerita hal yang berbeda.
  const kolom = useMemo(() => warehouseColumns(data, scope.asOf), [data, scope.asOf]);

  // Status stok ditentukan per gudang, jadi di mode matriks satu produk cocok
  // kalau ada gudang mana pun yang berstatus itu.
  const cocokStatus = (r) => {
    if (!status) return true;
    if (!semua) return stockStatusOf(r) === status;
    return kolom.some((w) => {
      const qty = r.perWarehouse[w.id] ?? 0;
      const minQty = minQtyOf(data.minimums ?? [], r.productId, w.id);
      return (qty > 0 || minQty > 0) && stockStatusOf({ qty, minQty }) === status;
    });
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return balanceRows({ ...data, warehouses: semua ? kolom : data.warehouses }, scope).filter(
      (r) =>
        (!q || [r.product.name, r.product.sku].some((v) => v?.toLowerCase().includes(q))) &&
        (!category || r.product.categoryId === category) &&
        cocokStatus(r),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, scope, semua, kolom, query, category, status]);

  const head = semua
    ? [
        { label: 'Produk' },
        { label: 'Satuan' },
        ...kolom.map((w) => ({ label: w.code, align: 'right' })),
        { label: 'Total qty', align: 'right' },
        ...(showValue
          ? [
              { label: 'Harga rata-rata', align: 'right' },
              { label: 'Nilai', align: 'right' },
            ]
          : []),
      ]
    : [
        { label: 'Produk' },
        { label: 'Satuan' },
        { label: 'Qty', align: 'right' },
        { label: 'Stok min.', align: 'right' },
        { label: 'Status' },
        ...(showValue
          ? [
              { label: 'Harga rata-rata', align: 'right' },
              { label: 'Nilai', align: 'right' },
            ]
          : []),
        ...(onSetMin ? [{ label: '', align: 'right', w: 60 }] : []),
      ];

  const total = rows.reduce((n, r) => n + r.value, 0);

  return (
    <>
      {/* Toolbar selalu ada. Yang bergantung pada onScope hanya pemilih tanggal dan
          gudang; cari, kategori, dan status stok adalah filter lokal tabel ini, jadi
          harus tetap tersedia di mana pun komponen ini dipakai. */}
      <Group
        gap="md"
        px="lg"
        py="sm"
        bg="slate.0"
        justify="space-between"
        style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
      >
        <Group gap="md">
          {onScope && (
            <>
              <Group gap={6} wrap="nowrap">
                <Text fz="xs" fw={600} c="slate.7">
                  Saldo per
                </Text>
                <DateField
                  size="sm"
                  radius="md"
                  w={165}
                  aria-label="Saldo per tanggal"
                  value={scope.asOf}
                  onChange={(e) => onScope({ asOf: e.currentTarget.value })}
                />
                {scope.asOf !== data.today && (
                  <Badge size="sm" radius="sm" variant="light" color="orange" tt="none">
                    Bukan hari ini
                  </Badge>
                )}
              </Group>
              <Select
                size="sm"
                radius="md"
                w={200}
                allowDeselect={false}
                data={[
                  { value: 'all', label: 'Semua gudang' },
                  ...data.warehouses.map((w) => ({
                    value: w.id,
                    label: `${w.code} · ${w.name}${w.status === 'inactive' ? ' (nonaktif)' : ''}`,
                  })),
                ]}
                value={scope.warehouseId}
                onChange={(v) => onScope({ warehouseId: v })}
              />
            </>
          )}
          {categories.length > 0 && (
            <Select
              size="sm"
              radius="md"
              w={170}
              clearable
              placeholder="Semua kategori"
              data={categories.map((c) => ({ value: c.id, label: c.name }))}
              value={category}
              onChange={setCategory}
            />
          )}
          <Select
            size="sm"
            radius="md"
            w={185}
            clearable
            placeholder="Semua status stok"
            data={Object.entries(STOCK_STATUS).map(([value, s]) => ({ value, label: s.label }))}
            value={status}
            onChange={setStatus}
          />
          <TextInput
            placeholder="Cari produk atau SKU..."
            size="sm"
            radius="md"
            w={240}
            leftSection={<MagnifyingGlass size={14} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </Group>
        {right}
      </Group>

      <Box p="lg">
        <DataTable
          head={head}
          minWidth={minWidth ?? (semua ? 300 + kolom.length * 110 + (showValue ? 260 : 0) : 820)}
          empty={
            rows.length ? null : (
              <EmptyState
                icon={Package}
                title="Belum ada stok"
                text="Stok bertambah saat barang diterima atau saldo awal diisi — bukan diinput dari sini."
              />
            )
          }
        >
          {rows.map((r) => (
            <Table.Tr key={r.productId}>
              <Table.Td>
                <DocNumber onClick={() => onOpenCard?.(r)}>{r.product.name}</DocNumber>
                <Text fz={10} c="slate.6">
                  {r.product.sku}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text fz="sm" c="slate.7">
                  {satuan(data.units, r.product)}
                </Text>
              </Table.Td>

              {semua ? (
                <>
                  {kolom.map((w) => (
                    <Table.Td key={w.id} ta="right">
                      {r.perWarehouse[w.id] ? (
                        <Text
                          fz="sm"
                          fw={600}
                          c="primary.9"
                          style={{ cursor: 'pointer' }}
                          onClick={() => onOpenCard?.(r, w.id)}
                        >
                          {number.format(r.perWarehouse[w.id])}
                        </Text>
                      ) : (
                        <Text fz="sm" c="slate.5">
                          —
                        </Text>
                      )}
                    </Table.Td>
                  ))}
                  <Table.Td ta="right">
                    <Text fz="sm" fw={700} c="slate.9">
                      {number.format(r.qty)}
                    </Text>
                  </Table.Td>
                </>
              ) : (
                <>
                  <Table.Td ta="right">
                    <Text fz="sm" fw={700} c="slate.9">
                      {number.format(r.qty)}
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
                </>
              )}

              {showValue && (
                <>
                  <Table.Td ta="right">
                    <Text fz="sm" c="slate.7">
                      {rupiah(Math.round(r.avg))}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fz="sm" fw={600} c="slate.9">
                      {rupiah(Math.round(r.value))}
                    </Text>
                  </Table.Td>
                </>
              )}

              {!semua && onSetMin && (
                <Table.Td>
                  <Group justify="flex-end">
                    <RowMenu
                      label={r.product.name}
                      items={[
                        { label: 'Atur stok minimum', icon: Info, onClick: () => onSetMin(r) },
                        {
                          label: 'Lihat kartu stok',
                          icon: Package,
                          onClick: () => onOpenCard?.(r),
                        },
                      ]}
                    />
                  </Group>
                </Table.Td>
              )}
            </Table.Tr>
          ))}

          {showValue && rows.length > 0 && (
            <Table.Tr bg="slate.0">
              <Table.Td colSpan={head.length - 1}>
                <Text fz="xs" fw={700} c="slate.7" tt="uppercase">
                  Total nilai persediaan
                </Text>
              </Table.Td>
              <Table.Td ta="right">
                <Text fz="sm" fw={700} c="slate.9">
                  {rupiah(Math.round(total))}
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </DataTable>
      </Box>
    </>
  );
}
