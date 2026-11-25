// Modal tambah / ubah produk. Tiga blok yang bisa dinyalakan sendiri-sendiri:
// Penjualan, Pembelian, dan Persediaan — menentukan di modul mana produk ini muncul.
import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Select,
  Switch,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
} from '@mantine/core';
import NumberField from '@/components/NumberField.jsx';
import { FormModal } from '@/components/common.jsx';
import {
  Check,
  PencilSimple,
  Plus,
  Package,
  Ruler,
  ShoppingCart,
  Storefront,
  Tag,
  Warehouse,
} from '@/components/Icon.jsx';
import { accounts } from '@/pages/DaftarAkun/accounts.js';
import { Callout } from '@/pages/Pembelian/components.jsx';
import { opnameHoldingProduct } from '@/pages/Gudang/opname.js';
import { buyTaxOptions, emptyProduct, generateSku, saleTaxOptions } from './catalog.js';

// Hanya akun paling bawah (bukan induk) yang boleh dipetakan ke produk.
const leafAccounts = accounts.filter((a) => !accounts.some((x) => x.parent === a.code));
const optionsOf = (filter) =>
  leafAccounts.filter(filter).map((a) => ({ value: a.code, label: `${a.code} · ${a.name}` }));

const revenueOptions = optionsOf((a) => a.normal === 'kredit');
const receivableOptions = optionsOf((a) => a.normal === 'debit');
const expenseOptions = optionsOf((a) => ['Beban', 'Harga Pokok Penjualan', 'Beban Lainnya'].includes(a.category) || a.normal === 'debit');
const inventoryOptions = optionsOf((a) => a.category === 'Persediaan');

const kindOptions = [
  { value: 'barang', label: 'Barang' },
  { value: 'jasa', label: 'Jasa' },
];

// Blok Penjualan / Pembelian: judul + sakelar, isinya muncul saat sakelar menyala.
function ToggleSection({ icon: Icon, title, description, checked, onChange, children }) {
  return (
    <Card withBorder radius="md" padding="md" bg="white">
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <ThemeIcon size={30} radius="md" variant="light" bg="primary.0" c="primary.9">
            <Icon size={16} />
          </ThemeIcon>
          <Box>
            <Text fz="sm" fw={700} c="slate.9">
              {title}
            </Text>
            <Text fz={11} c="slate.6">
              {description}
            </Text>
          </Box>
        </Group>
        <Switch
          checked={checked}
          onChange={(e) => onChange(e.currentTarget.checked)}
          aria-label={title}
        />
      </Group>
      {checked && <Box mt="md">{children}</Box>}
    </Card>
  );
}

// Pilihan "Dilacak / Tidak dilacak" sebagai dua kartu, seperti di situs.
function ChoiceCard({ icon: Icon, title, description, active, disabled, onClick }) {
  return (
    <Card
      withBorder
      radius="md"
      padding="sm"
      onClick={disabled ? undefined : onClick}
      role="radio"
      aria-checked={active}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => !disabled && (e.key === 'Enter' || e.key === ' ') && onClick()}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !active ? 0.55 : 1,
        borderColor: active ? 'var(--mantine-color-primary-9)' : undefined,
        backgroundColor: active ? 'var(--mantine-color-primary-0)' : undefined,
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
        <Group gap={8} wrap="nowrap" align="flex-start">
          <Icon size={16} />
          <Box>
            <Text fz="xs" fw={700} c="slate.9">
              {title}
            </Text>
            <Text fz={10} c="slate.6">
              {description}
            </Text>
          </Box>
        </Group>
        {active && <Check size={14} />}
      </Group>
    </Card>
  );
}

// Modal kecil untuk menambah kategori / satuan tanpa meninggalkan form produk.
function QuickAddModal({ opened, onClose, onSave, title, label, placeholder }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  // Isi ulang saat modal dibuka — dihitung saat render, bukan lewat effect.
  const [wasOpen, setWasOpen] = useState(opened);
  if (opened !== wasOpen) {
    setWasOpen(opened);
    if (opened) {
      setName('');
      setDescription('');
      setSubmitted(false);
    }
  }

  const save = () => {
    setSubmitted(true);
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim() });
    onClose();
  };

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={title}
      icon={Plus}
      size={440}
      footer={
        <>
          <Button variant="default" radius="md" onClick={onClose}>
            Batal
          </Button>
          <Button radius="md" onClick={save}>
            Simpan
          </Button>
        </>
      }
    >
      <TextInput
        label={label}
        withAsterisk
        radius="md"
        placeholder={placeholder}
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        error={submitted && !name.trim() && 'Nama wajib diisi'}
        data-autofocus
      />
      <Textarea
        label="Deskripsi"
        description="Opsional, membantu tim memahami penggunaannya."
        radius="md"
        minRows={2}
        autosize
        value={description}
        onChange={(e) => setDescription(e.currentTarget.value)}
      />
    </FormModal>
  );
}

export default function ProductForm({
  opened,
  product,
  categories,
  units,
  onClose,
  onSave,
  onAddCategory,
  onAddUnit,
  opnames,
}) {
  const editing = !!product;
  // Produk yang sedang dihitung di opname berjalan tidak boleh berubah sifatnya:
  // saldo buku sudah dibekukan dalam satuan dasar yang berlaku saat itu.
  const dikunci = editing ? opnameHoldingProduct(opnames, product.id) : null;
  const [form, setForm] = useState(() => product ?? emptyProduct());
  const [submitted, setSubmitted] = useState(false);
  const [quick, setQuick] = useState(null); // 'kategori' | 'satuan-jual' | 'satuan-beli'

  // Form diisi ulang tiap kali modal dibuka untuk produk yang berbeda. Dikerjakan
  // saat render (bukan effect) supaya tidak memicu render bertingkat.
  const formKey = `${opened}-${product?.id ?? 'baru'}`;
  const [lastKey, setLastKey] = useState(formKey);
  if (formKey !== lastKey) {
    setLastKey(formKey);
    if (opened) {
      setForm(product ? { ...product } : { ...emptyProduct(), sku: generateSku() });
      setSubmitted(false);
    }
  }

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );
  const unitOptions = useMemo(() => units.map((u) => ({ value: u.id, label: u.name })), [units]);

  const errors = {
    name: !form.name.trim() && 'Nama produk wajib diisi',
    categoryId: !form.categoryId && 'Kategori wajib dipilih',
    salePrice: form.sellable && !(form.salePrice > 0) && 'Harga jual wajib diisi',
    saleUnitId: form.sellable && !form.saleUnitId && 'Satuan wajib dipilih',
    saleAccount: form.sellable && !form.saleAccount && 'Akun penjualan wajib dipilih',
    arAccount: form.sellable && !form.arAccount && 'Akun piutang wajib dipilih',
    buyPrice: form.purchasable && form.buyPrice < 0 && 'Harga beli tidak boleh negatif',
    buyUnitId: form.purchasable && !form.buyUnitId && 'Satuan wajib dipilih',
    buyAccount: form.purchasable && !form.buyAccount && 'Akun pembelian wajib dipilih',
    baseUnitId: form.tracked && !form.baseUnitId && 'Satuan dasar wajib dipilih',
    inventoryAccount: form.tracked && !form.inventoryAccount && 'Akun persediaan wajib dipilih',
    mode:
      !form.sellable && !form.purchasable && 'Produk harus dijual, dibeli, atau keduanya',
  };
  const invalid = Object.values(errors).some(Boolean);
  const err = (k) => (submitted ? errors[k] || undefined : undefined);

  const submit = () => {
    setSubmitted(true);
    if (invalid) return;
    onSave(form);
  };

  const addCategory = (data) => {
    const id = onAddCategory(data);
    set({ categoryId: id });
  };
  const addUnit = (target) => (data) => {
    const id = onAddUnit(data);
    set(target === 'satuan-jual' ? { saleUnitId: id } : { buyUnitId: id });
  };

  return (
    <>
      <FormModal
        opened={opened}
        onClose={onClose}
        title={editing ? 'Ubah Informasi Produk' : 'Tambah Produk & Jasa'}
        subtitle="Satu katalog yang dipakai modul Penjualan dan Pembelian"
        icon={editing ? PencilSimple : Plus}
        size={960}
        footer={
          <>
            <Button variant="default" radius="md" onClick={onClose}>
              Batal
            </Button>
            <Button radius="md" onClick={submit}>
              {editing ? 'Simpan Perubahan' : 'Simpan Produk'}
            </Button>
          </>
        }
      >
        {submitted && errors.mode && (
          <Text fz="xs" c="red.7">
            {errors.mode}
          </Text>
        )}

        {/* Informasi dasar */}
        <Card withBorder radius="md" padding="md" bg="white">
          <Group gap="sm" wrap="nowrap" align="flex-start" mb="md">
            <ThemeIcon size={30} radius="md" variant="light" bg="primary.0" c="primary.9">
              <Tag size={16} />
            </ThemeIcon>
            <Box>
              <Text fz="sm" fw={700} c="slate.9">
                Informasi Dasar Produk
              </Text>
              <Text fz={11} c="slate.6">
                Nama produk, kategori, jenis, dan identitas SKU.
              </Text>
            </Box>
          </Group>
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Nama produk"
                withAsterisk
                radius="md"
                placeholder="Mis. Jasa servis AC"
                value={form.name}
                onChange={(e) => set({ name: e.currentTarget.value })}
                error={err('name')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="SKU (Stock Keeping Unit)"
                radius="md"
                value={form.sku}
                onChange={(e) => set({ sku: e.currentTarget.value })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 8 }}>
              <Text fz="sm" fw={500} mb={4}>
                Kategori <span style={{ color: 'var(--mantine-color-red-6)' }}>*</span>
              </Text>
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <Select
                  flex={1}
                  radius="md"
                  searchable
                  clearable
                  placeholder="Pilih kategori"
                  data={categoryOptions}
                  value={form.categoryId}
                  onChange={(v) => set({ categoryId: v })}
                  error={err('categoryId')}
                />
                <ActionIcon
                  variant="light"
                  size={36}
                  radius="md"
                  aria-label="Tambah kategori"
                  onClick={() => setQuick('kategori')}
                >
                  <Plus size={16} />
                </ActionIcon>
              </Group>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Select
                label="Jenis"
                description="Barang dilacak stoknya, jasa tidak"
                radius="md"
                allowDeselect={false}
                data={kindOptions}
                value={form.kind}
                // Lacak stok mengikuti jenis: ya untuk Barang, tidak untuk Jasa.
                // Pengguna tetap boleh mengubahnya di blok Persediaan.
                onChange={(v) => set({ kind: v, tracked: v === 'barang' })}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <TextInput
                label="Deskripsi"
                radius="md"
                placeholder="Keterangan singkat yang ikut terisi di baris dokumen"
                value={form.description}
                onChange={(e) => set({ description: e.currentTarget.value })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Kode eksternal"
                description="Opsional — kode dari sistem lain."
                radius="md"
                value={form.externalCode}
                onChange={(e) => set({ externalCode: e.currentTarget.value })}
              />
            </Grid.Col>
          </Grid>
        </Card>

        {/* Penjualan */}
        <ToggleSection
          icon={Storefront}
          title="Penjualan"
          description="Aktifkan bila produk ini dijual ke pelanggan."
          checked={form.sellable}
          onChange={(v) => set({ sellable: v })}
        >
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <NumberField
                label="Harga jual / unit"
                withAsterisk
                money
                radius="md"
                prefix="Rp "
                value={form.salePrice}
                onChange={(v) => set({ salePrice: Number(v) || 0 })}
                error={err('salePrice')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Text fz="sm" fw={500} mb={4}>
                Satuan <span style={{ color: 'var(--mantine-color-red-6)' }}>*</span>
              </Text>
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <Select
                  flex={1}
                  radius="md"
                  searchable
                  placeholder="Pilih satuan"
                  data={unitOptions}
                  value={form.saleUnitId}
                  onChange={(v) => set({ saleUnitId: v })}
                  error={err('saleUnitId')}
                />
                <ActionIcon
                  variant="light"
                  size={36}
                  radius="md"
                  aria-label="Tambah satuan"
                  onClick={() => setQuick('satuan-jual')}
                >
                  <Plus size={16} />
                </ActionIcon>
              </Group>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Select
                label="Pajak penjualan"
                radius="md"
                clearable
                placeholder="Tanpa pajak"
                data={saleTaxOptions}
                value={form.saleTax}
                onChange={(v) => set({ saleTax: v })}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Akun penjualan"
                description="Hanya akun bersaldo normal kredit"
                withAsterisk
                radius="md"
                searchable
                clearable
                placeholder="Pilih akun"
                data={revenueOptions}
                value={form.saleAccount}
                onChange={(v) => set({ saleAccount: v })}
                error={err('saleAccount')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Select
                label="Akun piutang"
                description="Hanya akun bersaldo normal debit"
                withAsterisk
                radius="md"
                searchable
                clearable
                placeholder="Pilih akun"
                data={receivableOptions}
                value={form.arAccount}
                onChange={(v) => set({ arAccount: v })}
                error={err('arAccount')}
              />
            </Grid.Col>
          </Grid>
        </ToggleSection>

        {/* Pembelian */}
        <ToggleSection
          icon={ShoppingCart}
          title="Pembelian"
          description="Aktifkan bila produk ini dibeli dari vendor / supplier."
          checked={form.purchasable}
          onChange={(v) => set({ purchasable: v })}
        >
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <NumberField
                label="Harga beli / unit"
                description="Harga acuan katalog; boleh 0 untuk tagihan rutin."
                money
                radius="md"
                prefix="Rp "
                value={form.buyPrice}
                onChange={(v) => set({ buyPrice: Number(v) || 0 })}
                error={err('buyPrice')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Text fz="sm" fw={500} mb={4}>
                Satuan <span style={{ color: 'var(--mantine-color-red-6)' }}>*</span>
              </Text>
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <Select
                  flex={1}
                  radius="md"
                  searchable
                  placeholder="Pilih satuan"
                  data={unitOptions}
                  value={form.buyUnitId}
                  onChange={(v) => set({ buyUnitId: v })}
                  error={err('buyUnitId')}
                />
                <ActionIcon
                  variant="light"
                  size={36}
                  radius="md"
                  aria-label="Tambah satuan"
                  onClick={() => setQuick('satuan-beli')}
                >
                  <Plus size={16} />
                </ActionIcon>
              </Group>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Select
                label="Pajak pembelian"
                radius="md"
                clearable
                placeholder="Tanpa pajak"
                data={buyTaxOptions}
                value={form.buyTax}
                onChange={(v) => set({ buyTax: v })}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <Select
                label="Akun pembelian"
                description="Akun beban, atau aset tetap untuk peralatan, yang didebit saat barang diterima"
                withAsterisk
                radius="md"
                searchable
                clearable
                placeholder="Pilih akun"
                data={expenseOptions}
                value={form.buyAccount}
                onChange={(v) => set({ buyAccount: v })}
                error={err('buyAccount')}
              />
            </Grid.Col>
          </Grid>
        </ToggleSection>

        {/* Persediaan */}
        <Card withBorder radius="md" padding="md" bg="white">
          <Group gap="sm" wrap="nowrap" align="flex-start" mb="md">
            <ThemeIcon size={30} radius="md" variant="light" bg="primary.0" c="primary.9">
              <Warehouse size={16} />
            </ThemeIcon>
            <Box>
              <Text fz="sm" fw={700} c="slate.9">
                Persediaan
              </Text>
              <Text fz={11} c="slate.6">
                Lacak stok menentukan apakah jumlah barang ini dihitung per gudang.
              </Text>
            </Box>
          </Group>
          {dikunci && (
            <Callout tone="warn" title={`Produk sedang dihitung di ${dikunci.number}`}>
              Lacak stok dan satuan dasar dikunci sampai opname itu diposting atau dibatalkan,
              karena saldo bukunya sudah dibekukan dalam satuan yang berlaku sekarang.
            </Callout>
          )}
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <ChoiceCard
                icon={Package}
                title="Lacak stok (barang)"
                description="Qty dihitung per gudang dan nilainya masuk akun persediaan."
                active={form.tracked}
                disabled={!!dikunci}
                onClick={() =>
                  !dikunci &&
                  set({ tracked: true, kind: 'barang', baseUnitId: form.baseUnitId ?? form.buyUnitId ?? form.saleUnitId })
                }
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <ChoiceCard
                icon={Ruler}
                title="Tidak dilacak (jasa / non-stok)"
                description="Stok tidak dihitung. Cocok untuk jasa dan biaya."
                active={!form.tracked}
                disabled={!!dikunci}
                onClick={() => !dikunci && set({ tracked: false })}
              />
            </Grid.Col>
            {form.tracked && (
              <>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select
                    label="Satuan dasar"
                    description="Satuan yang dipakai saat qty stok dicatat di gudang"
                    withAsterisk
                    radius="md"
                    searchable
                    placeholder="Pilih satuan"
                    data={unitOptions}
                    value={form.baseUnitId}
                    disabled={!!dikunci}
                    onChange={(v) => set({ baseUnitId: v })}
                    error={err('baseUnitId')}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <Select
                    label="Akun persediaan"
                    description="Akun aset untuk nilai stok"
                    withAsterisk
                    radius="md"
                    searchable
                    clearable
                    placeholder="Pilih akun"
                    data={inventoryOptions}
                    value={form.inventoryAccount}
                    onChange={(v) => set({ inventoryAccount: v })}
                    error={err('inventoryAccount')}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  <Text fz={11} c="slate.6">
                    Jumlah stok awal tidak diisi di sini. Saldo awal dicatat lewat menu Saldo
                    Awal, dan perubahan stok berikutnya lewat dokumen penerimaan, pengeluaran,
                    pindah barang, atau stok opname.
                  </Text>
                </Grid.Col>
              </>
            )}
          </Grid>
        </Card>
      </FormModal>

      <QuickAddModal
        opened={quick === 'kategori'}
        onClose={() => setQuick(null)}
        onSave={addCategory}
        title="Tambah Kategori"
        label="Nama kategori"
        placeholder="Contoh: Utility, Home Service"
      />
      <QuickAddModal
        opened={quick === 'satuan-jual' || quick === 'satuan-beli'}
        onClose={() => setQuick(null)}
        onSave={addUnit(quick)}
        title="Tambah Satuan Unit"
        label="Nama satuan unit"
        placeholder="Contoh: kWh, m3, Unit, Bulan"
      />
    </>
  );
}
