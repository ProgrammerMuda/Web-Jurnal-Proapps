// Form Buat opname. Bentuknya satu halaman seperti form Pindah Barang:
// dokumennya pendek, dan yang panjang justru pekerjaan sesudahnya.
import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  Group,
  MultiSelect,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import DateField from '@/components/DateField.jsx';
import { blockedProps } from '@/components/common.jsx';
import { ListChecks } from '@/components/Icon.jsx';
import { BackLink, Callout, FormActions, Section } from '@/pages/Pembelian/components.jsx';
import { formatDate } from '@/pages/Pembelian/utils.js';
import { periodLocked } from '@/pages/Penjualan/data.js';
import { picOptions, picTitle } from './data.js';
import { productsInScope, runningOpnameOf, validateOpname } from './opname.js';

const number = new Intl.NumberFormat('id-ID');
const monthLabel = (iso) => formatDate(`${iso.slice(0, 7)}-01`).replace(/^\d+ /, '');

// Teks bantuan ditaruh di bawah kolom isian, bukan menyelip antara label dan input.
const helperBelow = ['label', 'input', 'description', 'error'];

const SCOPE_OPTIONS = [
  { value: 'all', label: 'Semua produk di gudang ini' },
  { value: 'category', label: 'Per kategori' },
  { value: 'manual', label: 'Pilih produk' },
];

// Nama lalu jabatan yang redup — sama dengan dropdown PIC di form gudang.
const renderPic = ({ option }) => (
  <Box>
    <Text fz="sm" fw={600} c="slate.9">
      {option.label}
    </Text>
    {picTitle(option.value) && (
      <Text fz={11} c="slate.6">
        {picTitle(option.value)}
      </Text>
    )}
  </Box>
);

export default function OpnameForm({ data, opnames, preset, onCancel, onSave }) {
  const [warehouseId, setWarehouseId] = useState(preset?.warehouseId ?? null);
  const [date, setDate] = useState(data.today);
  const [scopeType, setScopeType] = useState('all');
  const [categoryIds, setCategoryIds] = useState([]);
  const [productIds, setProductIds] = useState([]);
  const [counterUserId, setCounterUserId] = useState('gudang');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const scope = useMemo(
    () => ({ type: scopeType, categoryIds, productIds }),
    [scopeType, categoryIds, productIds],
  );
  const form = { warehouseId, date, scope };

  // Gudang yang sedang diopname tetap tampil, tapi tidak bisa dipilih — lebih
  // jelas daripada menghilang tanpa penjelasan (O1).
  const warehouseData = data.warehouses
    .filter((w) => w.status === 'active')
    .map((w) => {
      const o = runningOpnameOf(opnames, w.id);
      return {
        value: w.id,
        label: `${w.code} · ${w.name}${o ? ` — Sedang diopname (${o.number})` : ''}`,
        disabled: !!o,
      };
    });

  const cakupan = useMemo(
    () =>
      warehouseId
        ? productsInScope({ products: data.products, moves: data.moves, warehouseId, scope })
        : [],
    [data.products, data.moves, warehouseId, scope],
  );

  const errors = validateOpname(form, {
    opnames,
    warehouses: data.warehouses,
    moves: data.moves,
    products: data.products,
    today: data.today,
    periodLocked,
    monthLabel,
  });
  const blocked = errors.warehouseId || errors.date || errors.scope;
  const err = (k) => (submitted ? errors[k] : undefined);

  const submit = (start) => {
    setSubmitted(true);
    if (blocked) return;
    onSave({ warehouseId, date, scope, counterUserId, notes: notes.trim() }, start);
  };

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <BackLink label="Kembali ke stok opname" onClick={onCancel} />

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group gap="md" wrap="nowrap" align="flex-start">
          <Box
            bg="primary.0"
            c="primary.9"
            style={{ width: 44, height: 44, borderRadius: 'var(--mantine-radius-md)', display: 'grid', placeItems: 'center' }}
          >
            <ListChecks size={24} />
          </Box>
          <Box>
            <Text fz="xl" fw={700} c="slate.9">
              Buat stok opname
            </Text>
            <Text fz="xs" c="slate.6" maw={640}>
              Satu dokumen untuk satu gudang pada satu tanggal hitung. Saldo buku baru
              dibekukan saat hitungan dimulai, bukan saat draf disimpan.
            </Text>
          </Box>
        </Group>
      </Card>

      <Section title="Informasi dokumen" description="Gudang dan tanggal hitung">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Select
            label="Gudang"
            withAsterisk
            size="sm"
            radius="md"
            searchable
            placeholder="Pilih gudang"
            data={warehouseData}
            value={warehouseId}
            error={err('warehouseId')}
            onChange={setWarehouseId}
          />
          <DateField
            label="Tanggal hitung"
            withAsterisk
            size="sm"
            radius="md"
            max={data.today}
            value={date}
            error={err('date')}
            inputWrapperOrder={helperBelow}
            description="Saldo buku yang dibandingkan adalah posisi pada tanggal ini."
            onChange={(e) => setDate(e.currentTarget.value)}
          />
        </SimpleGrid>
      </Section>

      <Section
        title="Cakupan produk"
        description="Produk mana saja yang dihitung di sesi ini"
      >
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="Cakupan"
              withAsterisk
              size="sm"
              radius="md"
              allowDeselect={false}
              data={SCOPE_OPTIONS}
              value={scopeType}
              onChange={setScopeType}
            />
            {scopeType === 'category' && (
              <MultiSelect
                label="Kategori"
                withAsterisk
                size="sm"
                radius="md"
                searchable
                clearable
                placeholder="Pilih kategori"
                data={data.categories.map((c) => ({ value: c.id, label: c.name }))}
                value={categoryIds}
                error={err('scope')}
                onChange={setCategoryIds}
              />
            )}
            {scopeType === 'manual' && (
              <MultiSelect
                label="Produk"
                withAsterisk
                size="sm"
                radius="md"
                searchable
                clearable
                placeholder="Pilih produk"
                data={data.products
                  .filter((p) => p.tracked)
                  .map((p) => ({ value: p.id, label: p.name }))}
                value={productIds}
                error={err('scope')}
                onChange={setProductIds}
              />
            )}
          </SimpleGrid>

          {scopeType === 'all' && (
            <Callout tone="info">
              Yang dihitung adalah semua produk berstok yang pernah punya mutasi di gudang ini,
              termasuk yang saldonya sekarang nol — barang yang habis tetap perlu dibuktikan.
            </Callout>
          )}
          {warehouseId && (
            <Text fz="xs" c={errors.scope ? 'red.7' : 'slate.6'}>
              {errors.scope ?? `${number.format(cakupan.length)} produk masuk cakupan ini.`}
            </Text>
          )}
        </Stack>
      </Section>

      <Section title="Pelaksana" description="Siapa yang menghitung dan catatan sesi">
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="Petugas hitung"
              size="sm"
              radius="md"
              searchable
              clearable
              placeholder="Pilih petugas"
              data={picOptions}
              renderOption={renderPic}
              value={counterUserId}
              onChange={setCounterUserId}
            />
          </SimpleGrid>
          <Textarea
            label="Catatan"
            size="sm"
            radius="md"
            minRows={2}
            autosize
            placeholder="Alasan opname, rentang rak yang dihitung, dan sebagainya"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />
        </Stack>
      </Section>

      <FormActions error={submitted ? blocked : null} onCancel={onCancel}>
        <Button
          variant="default"
          radius="md"
          onClick={() => submit(false)}
          {...blockedProps(blocked, () => setSubmitted(true))}
        >
          Simpan draf
        </Button>
        <Button
          radius="md"
          onClick={() => submit(true)}
          {...blockedProps(blocked, () => setSubmitted(true))}
        >
          Mulai hitung
        </Button>
      </FormActions>
    </Stack>
  );
}
