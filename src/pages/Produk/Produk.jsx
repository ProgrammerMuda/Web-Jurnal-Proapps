// Modul Persediaan: master Produk & Jasa, Kategori Produk, dan Satuan.
// Katalognya dipakai bersama modul Penjualan dan Pembelian (lihat catalog.js),
// jadi produk yang ditambahkan di sini langsung bisa dipilih di faktur penjualan,
// permintaan pembelian, dan tagihan vendor.
import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Center,
  Group,
  Menu,
  Pagination,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { CopyIcon, FormModal, PageIntro } from '@/components/common.jsx';
import {
  ArrowsClockwise,
  CheckCircle,
  DotsThreeVertical,
  Eye,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Ruler,
  SelectionAll,
  Tag,
  Trash,
  Warning,
} from '@/components/Icon.jsx';
import { useData } from '@/lib/store.jsx';
import { rupiah } from '@/pages/Penjualan/utils.js';
import { ProductAvatar, ProductStats, StockCell } from './components.jsx';
import { categoryName, generateSku, unitName } from './catalog.js';
import { productUsage, usageCount } from './usage.js';
import { getBalance } from '@/pages/Gudang/stock.js';
import { TODAY } from '@/pages/Gudang/data.js';
import ProductForm from './ProductForm.jsx';
import ProductDetail from './ProductDetail.jsx';
import MasterList from './MasterList.jsx';
import { formatHash, parseHash } from './routes.js';

const pageSizes = ['10', '25', '50'];
const nowIso = () => new Date().toISOString();

const toast = (title, message, color = 'green') =>
  notifications.show({
    color,
    icon: color === 'green' ? <CheckCircle size={18} /> : <Warning size={18} />,
    title,
    message,
    radius: 'md',
    withBorder: true,
    autoClose: 5000,
  });

// --- Daftar produk ----------------------------------------------------------

function ProductRow({ product, categories, units, totalQty, onView, onEdit, onDelete }) {
  return (
    <Table.Tr>
      <Table.Td>
        <Group gap="sm" wrap="nowrap">
          <ProductAvatar />
          <Box style={{ minWidth: 0 }}>
            <Text
              fz="sm"
              fw={700}
              c="primary.9"
              tt="uppercase"
              style={{ cursor: 'pointer' }}
              onClick={onView}
            >
              {product.name}
            </Text>
            <Group gap={4} wrap="nowrap">
              <Text fz={10} c="slate.6">
                {product.sku}
              </Text>
              <CopyIcon value={product.sku} size={12} />
            </Group>
          </Box>
        </Group>
      </Table.Td>
      <Table.Td>
        <Text fz="sm" c="slate.7">
          {categoryName(categories, product.categoryId) || '—'}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        {product.sellable ? (
          <>
            <Text fz="sm" fw={700} c="slate.9">
              {rupiah(product.salePrice)}
            </Text>
            {product.saleUnitId && (
              <Text fz={10} c="slate.6">
                / {unitName(units, product.saleUnitId)}
              </Text>
            )}
          </>
        ) : (
          <Text fz="sm" c="slate.5">
            Tidak dijual
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="right">
        {product.purchasable ? (
          <>
            <Text fz="sm" fw={600} c="slate.9">
              {rupiah(product.buyPrice)}
            </Text>
            {product.buyUnitId && (
              <Text fz={10} c="slate.6">
                / {unitName(units, product.buyUnitId)}
              </Text>
            )}
          </>
        ) : (
          <Text fz="sm" c="slate.5">
            Tidak dibeli
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <StockCell product={product} totalQty={totalQty} units={units} />
      </Table.Td>
      <Table.Td>
        <Group justify="flex-end">
          <Menu position="bottom-end" withinPortal shadow="md" width={170}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="slate" aria-label={`Aksi ${product.name}`}>
                <DotsThreeVertical size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item fz="xs" leftSection={<Eye size={14} />} onClick={onView}>
                Lihat detail
              </Menu.Item>
              <Menu.Item fz="xs" leftSection={<PencilSimple size={14} />} onClick={onEdit}>
                Ubah produk
              </Menu.Item>
              <Menu.Item fz="xs" color="red" leftSection={<Trash size={14} />} onClick={onDelete}>
                Hapus
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

function ProductList({ products, categories, units, qtyOf, onView, onEdit, onDelete, onAdd }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [mode, setMode] = useState(null); // dijual | dibeli | dilacak
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (!q || [p.name, p.sku, p.description, p.externalCode].some((v) => v?.toLowerCase().includes(q))) &&
        (!category || p.categoryId === category) &&
        (!mode ||
          (mode === 'dijual' && p.sellable) ||
          (mode === 'dibeli' && p.purchasable) ||
          (mode === 'dilacak' && p.tracked)),
    );
  }, [products, query, category, mode]);

  const size = Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * size;
  const rows = filtered.slice(start, start + size);
  const reset = (fn) => (v) => {
    fn(v);
    setPage(1);
  };

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro
        icon={SelectionAll}
        title="Daftar Produk & Layanan"
        description="Katalog barang dan jasa beserta satuan, harga, akun, pajak, dan status persediaannya. Dipakai bersama oleh modul Penjualan dan Pembelian."
        actions={
          <>
            <ActionIcon variant="default" size="lg" radius="md" aria-label="Segarkan katalog">
              <ArrowsClockwise size={16} />
            </ActionIcon>
            <Button radius="md" leftSection={<Plus size={16} />} onClick={onAdd}>
              Tambah Produk
            </Button>
          </>
        }
      />

      <ProductStats products={products} categories={categories} units={units} />

      <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
        <Group
          gap="md"
          px="lg"
          py="sm"
          bg="slate.0"
          style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
        >
          <TextInput
            placeholder="Cari nama atau SKU produk..."
            size="sm"
            radius="md"
            w={320}
            maw="100%"
            leftSection={<MagnifyingGlass size={14} />}
            value={query}
            onChange={(e) => reset(setQuery)(e.currentTarget.value)}
          />
          <Select
            size="sm"
            radius="md"
            w={200}
            clearable
            placeholder="Semua kategori"
            data={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={category}
            onChange={reset(setCategory)}
          />
          <Select
            size="sm"
            radius="md"
            w={170}
            clearable
            placeholder="Semua produk"
            data={[
              { value: 'dijual', label: 'Dijual' },
              { value: 'dibeli', label: 'Dibeli' },
              { value: 'dilacak', label: 'Stok dilacak' },
            ]}
            value={mode}
            onChange={reset(setMode)}
          />
        </Group>

        <Box p="lg">
          <Box
            style={{
              border: '1px solid var(--mantine-color-gray-3)',
              borderRadius: 'var(--mantine-radius-md)',
              overflow: 'hidden',
            }}
          >
            <ScrollArea type="auto">
              <Table
                verticalSpacing="sm"
                horizontalSpacing="md"
                miw={1000}
                highlightOnHover
                styles={{
                  th: {
                    fontSize: 'var(--mantine-font-size-xs)',
                    color: 'var(--mantine-color-slate-7)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  },
                }}
              >
                <Table.Thead bg="slate.0">
                  <Table.Tr>
                    <Table.Th>Produk</Table.Th>
                    <Table.Th>Kategori</Table.Th>
                    <Table.Th ta="right">Harga Jual</Table.Th>
                    <Table.Th ta="right">Harga Beli</Table.Th>
                    <Table.Th>Persediaan</Table.Th>
                    <Table.Th ta="right">Aksi</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((p) => (
                    <ProductRow
                      key={p.id}
                      product={p}
                      categories={categories}
                      units={units}
                      totalQty={qtyOf(p.id)}
                      onView={() => onView(p)}
                      onEdit={() => onEdit(p)}
                      onDelete={() => onDelete(p)}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>

            {!filtered.length && (
              <Center py="xl">
                <Text fz="sm" c="slate.6">
                  Tidak ada produk yang cocok dengan pencarian atau filter.
                </Text>
              </Center>
            )}

            <Group
              justify="space-between"
              gap="sm"
              px="md"
              py="sm"
              style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
            >
              <Text fz="xs" c="slate.7">
                Menampilkan {filtered.length ? start + 1 : 0}–{start + rows.length} dari{' '}
                {filtered.length} produk
              </Text>
              <Group gap="sm">
                <Select
                  size="xs"
                  radius="md"
                  w={110}
                  allowDeselect={false}
                  data={pageSizes.map((v) => ({ value: v, label: `${v} per hal.` }))}
                  value={pageSize}
                  onChange={reset(setPageSize)}
                />
                <Pagination size="sm" radius="md" total={totalPages} value={current} onChange={setPage} />
              </Group>
            </Group>
          </Box>
        </Box>
      </Card>
    </Stack>
  );
}

// --- Halaman modul ----------------------------------------------------------

export default function Produk({ onNavigate }) {
  const {
    products,
    setProducts,
    productCategories,
    setProductCategories,
    productUnits,
    setProductUnits,
    sales,
    quotes,
    orders,
    contactsById,
    pb,
    stockMoves,
    stockMinimums,
    warehouses,
  } = useData();

  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (v) => {
    window.location.hash = formatHash(v);
    window.scrollTo({ top: 0 });
  };

  const [form, setForm] = useState(null); // { product: null | produk }
  const [confirm, setConfirm] = useState(null); // produk yang akan dihapus

  const data = { sales, quotes, orders, pb, contactsById };
  // Qty stok datang dari saldo gudang (sumber yang sama dengan Mutasi Stok),
  // bukan dari master produk.
  // Qty datang dari buku besar persediaan (Mutasi Stok), bukan dari master produk.
  const qtyOf = (productId) => getBalance(stockMoves, productId, 'all');
  const warehouseCountOf = (productId) =>
    warehouses.filter((w) => getBalance(stockMoves, productId, w.id) > 0).length;
  const stockData = {
    moves: stockMoves,
    minimums: stockMinimums,
    products,
    categories: productCategories,
    units: productUnits,
    warehouses,
    today: TODAY,
  };

  const saveProduct = (draft) => {
    if (form.product) {
      setProducts((list) =>
        list.map((p) => (p.id === draft.id ? { ...p, ...draft, updatedAt: nowIso() } : p)),
      );
      toast('Produk diperbarui', `Perubahan pada "${draft.name}" sudah tersimpan.`);
    } else {
      const id = `p${Date.now()}`;
      const now = nowIso();
      setProducts((list) => [
        { ...draft, id, sku: draft.sku || generateSku(), createdAt: now, updatedAt: now },
        ...list,
      ]);
      const dipakai = [draft.sellable && 'Penjualan', draft.purchasable && 'Pembelian']
        .filter(Boolean)
        .join(' dan ');
      toast(
        'Produk ditambahkan',
        `"${draft.name}" kini bisa dipilih di modul ${dipakai || 'Persediaan'}.`,
      );
    }
    setForm(null);
  };

  const deleteProduct = (product) => {
    const dipakai = usageCount(productUsage(product, data));
    if (dipakai) {
      toast(
        'Produk masih dipakai',
        `"${product.name}" ada di ${dipakai} dokumen penjualan/pembelian, jadi tidak bisa dihapus. Nonaktifkan lewat Ubah Produk bila sudah tidak dipakai lagi.`,
        'red',
      );
      return;
    }
    setConfirm(product);
  };

  const doDelete = () => {
    setProducts((list) => list.filter((p) => p.id !== confirm.id));
    if (route.view.name === 'detail') go({ name: 'tab', tab: 'items' });
    toast('Produk dihapus', `"${confirm.name}" sudah tidak ada di katalog.`);
    setConfirm(null);
  };

  const addCategory = ({ name, description }) => {
    const id = `cat-${Date.now()}`;
    setProductCategories((list) => [...list, { id, name, description, createdAt: nowIso() }]);
    return id;
  };
  const addUnit = ({ name, description }) => {
    // id satuan = namanya, karena dokumen Pembelian menyimpan satuan sebagai teks.
    const id = name;
    setProductUnits((list) =>
      list.some((u) => u.id === id) ? list : [...list, { id, name, description, createdAt: nowIso() }],
    );
    return id;
  };

  const formModal = (
    <>
      <ProductForm
        opened={!!form}
        product={form?.product ?? null}
        categories={productCategories}
        units={productUnits}
        onClose={() => setForm(null)}
        onSave={saveProduct}
        onAddCategory={addCategory}
        onAddUnit={addUnit}
      />
      <FormModal
        opened={!!confirm}
        onClose={() => setConfirm(null)}
        title="Hapus produk"
        subtitle="Tindakan ini tidak bisa dibatalkan"
        icon={Trash}
        size={440}
        footer={
          <>
            <Button variant="default" radius="md" onClick={() => setConfirm(null)}>
              Batal
            </Button>
            <Button color="red" radius="md" onClick={doDelete}>
              Hapus Produk
            </Button>
          </>
        }
      >
        <Text fz="sm" c="slate.7">
          Hapus <b>{confirm?.name}</b> dari katalog? Produk ini akan hilang dari pilihan di
          modul Penjualan dan Pembelian.
        </Text>
      </FormModal>
    </>
  );

  if (route.tab === 'categories')
    return (
      <MasterList
        icon={Tag}
        title="Kategori Produk"
        description="Kelompokkan produk dan jasa agar mudah dicari dan dilaporkan."
        hint="Kelompokkan produk Anda untuk kemudahan pelaporan dan pencarian."
        searchPlaceholder="Cari kategori..."
        addLabel="Tambah Kategori"
        entryLabel="Nama kategori"
        entryPlaceholder="Contoh: Utility, Home Service"
        nounSingular="Kategori"
        entries={productCategories}
        setEntries={setProductCategories}
        usedBy={(c) => products.filter((p) => p.categoryId === c.id).length}
      />
    );

  if (route.tab === 'units')
    return (
      <MasterList
        icon={Ruler}
        title="Satuan"
        description="Satuan ukuran yang dipakai produk dan jasa, misalnya pcs, jam, atau kWh."
        hint="Satuan ukuran untuk produk dan jasa (misal: pcs, jam, kWh, m3)."
        searchPlaceholder="Cari satuan unit..."
        addLabel="Tambah Satuan Unit"
        entryLabel="Nama satuan unit"
        entryPlaceholder="Contoh: kWh, m3, Unit, Bulan"
        nounSingular="Satuan"
        entries={productUnits}
        setEntries={setProductUnits}
        usedBy={(u) =>
          products.filter((p) => p.saleUnitId === u.id || p.buyUnitId === u.id).length
        }
      />
    );

  const selected = products.find((p) => p.id === route.view.id);
  if (route.view.name === 'detail' && selected)
    return (
      <>
        <ProductDetail
          product={selected}
          categories={productCategories}
          units={productUnits}
          totalQty={qtyOf(selected.id)}
          warehouseCount={warehouseCountOf(selected.id)}
          stockData={stockData}
          onOpenStockCard={(productId, warehouseId) => {
            window.location.hash = `#gudang/kartu?produk=${productId}&gudang=${warehouseId}`;
          }}
          data={data}
          onBack={() => go({ name: 'tab', tab: 'items' })}
          onEdit={() => setForm({ product: selected })}
          onDelete={() => deleteProduct(selected)}
          onNavigate={onNavigate}
        />
        {formModal}
      </>
    );

  return (
    <>
      <ProductList
        products={products}
        categories={productCategories}
        units={productUnits}
        qtyOf={qtyOf}
        onView={(p) => go({ name: 'detail', id: p.id })}
        onEdit={(p) => setForm({ product: p })}
        onDelete={deleteProduct}
        onAdd={() => setForm({ product: null })}
      />
      {formModal}
    </>
  );
}
