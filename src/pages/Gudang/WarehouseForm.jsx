// Modal tambah / ubah gudang. Satu form utuh di tengah layar: isiannya sedikit dan
// hanya dua yang wajib, jadi tidak perlu dipandu bertahap.
// Pola modal project: header dan footer beku, hanya isi form yang bergulir.
import { useRef, useState } from 'react';
import {
  Box,
  Button,
  Group,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { FormModal, blockedProps } from '@/components/common.jsx';
import { Check, PencilSimple, Plus, Warehouse } from '@/components/Icon.jsx';
import {
  emptyWarehouse,
  nextWarehouseCode,
  picOptions,
  validateWarehouse,
} from './data.js';

// Teks bantuan ditaruh di bawah kolom isian, bukan menyelip antara label dan input.
const helperBelow = ['label', 'input', 'description', 'error'];

const frame = {
  border: '1px solid var(--mantine-color-gray-3)',
  borderRadius: 'var(--mantine-radius-md)',
};

// Pilihan penanggung jawab: nama di baris pertama, jabatan di bawahnya dengan
// warna redup — bukan disambung tanda titik dalam satu baris.
const renderPicOption = ({ option, checked }) => (
  <Group gap="sm" wrap="nowrap" justify="space-between" style={{ width: '100%' }}>
    <Box style={{ minWidth: 0 }}>
      <Text fz="sm" fw={600} c="slate.9" truncate>
        {option.label}
      </Text>
      <Text fz={11} c="slate.6" truncate>
        {option.title}
      </Text>
    </Box>
    {checked && <Check size={16} />}
  </Group>
);

// Pencarian tetap menemukan orang lewat jabatannya, walau yang tampil di kolom
// isian hanya namanya.
const filterPic = ({ options, search }) => {
  const q = search.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) =>
    [o.label, o.title].some((v) => v?.toLowerCase().includes(q)),
  );
};

const SectionTitle = ({ children }) => (
  <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }}>
    {children}
  </Text>
);

export default function WarehouseForm({ opened, warehouse, warehouses, locked, onClose, onSave }) {
  const editing = !!warehouse;
  const initial = () =>
    warehouse ? { ...warehouse } : { ...emptyWarehouse(), code: nextWarehouseCode(warehouses) };

  const [form, setForm] = useState(initial);
  const [clean, setClean] = useState(() => JSON.stringify(initial()));
  const [submitted, setSubmitted] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const body = useRef(null);

  // Isi ulang tiap kali modal dibuka untuk gudang yang berbeda — dihitung saat
  // render, bukan lewat effect, supaya tidak memicu render bertingkat.
  const key = `${opened}-${warehouse?.id ?? 'baru'}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    if (opened) {
      const next = initial();
      setForm(next);
      setClean(JSON.stringify(next));
      setSubmitted(false);
      setConfirmClose(false);
    }
  }

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const dirty = JSON.stringify(form) !== clean;
  const tryClose = () => (dirty ? setConfirmClose(true) : onClose());

  const all = validateWarehouse(form, warehouses);
  // Error baru ditampilkan setelah Simpan diklik, bukan sambil mengetik.
  const err = (field) => (submitted ? all[field] : undefined);

  // Kolom yang salah atau belum diisi, urut seperti letaknya di form.
  const firstBad = ['code', 'name', 'phone'].find((f) => all[f]);
  // Pesan alasan tombol belum bisa dipakai; null = sudah boleh disimpan.
  const blocked = firstBad ? all[firstBad] : null;

  const submit = () => {
    setSubmitted(true);
    if (firstBad) {
      body.current?.querySelector?.(`[data-field="${firstBad}"]`)?.focus();
      return;
    }
    onSave({
      ...form,
      code: form.code.trim(),
      name: form.name.trim(),
      phone: (form.phone ?? '').trim(),
    });
  };

  return (
    <>
      <FormModal
        opened={opened}
        onClose={tryClose}
        title={editing ? 'Ubah gudang' : 'Tambah gudang'}
        subtitle="Lokasi penyimpanan barang. Stok tidak diisi dari sini."
        icon={editing ? PencilSimple : Plus}
        size={720}
        footer={
          <>
            <Button variant="default" radius="md" onClick={tryClose}>
              Batal
            </Button>
            <Tooltip label={blocked} disabled={!blocked} withArrow fz="xs" position="top">
              <Button radius="md" onClick={submit} {...blockedProps(blocked, () => setSubmitted(true))}>
                {editing ? 'Simpan' : 'Tambah gudang'}
              </Button>
            </Tooltip>
          </>
        }
      >
        <Box ref={body}>
          <Stack gap="lg">
            <Stack gap="sm">
              <SectionTitle>Identitas</SectionTitle>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput
                  label="Kode"
                  withAsterisk
                  size="sm"
                  radius="md"
                  data-field="code"
                  maxLength={20}
                  readOnly={locked}
                  inputWrapperOrder={helperBelow}
                  description={
                    locked
                      ? 'Kode terkunci karena sudah dipakai di transaksi'
                      : 'Terisi otomatis, boleh diubah selama gudang belum dipakai.'
                  }
                  value={form.code}
                  error={err('code')}
                  onChange={(e) => set({ code: e.currentTarget.value })}
                />
                <TextInput
                  label="Nama gudang"
                  withAsterisk
                  size="sm"
                  radius="md"
                  data-field="name"
                  maxLength={100}
                  placeholder="Contoh: Gudang Lt. 4"
                  value={form.name}
                  error={err('name')}
                  onChange={(e) => set({ name: e.currentTarget.value })}
                />
              </SimpleGrid>
            </Stack>

            <Stack gap="sm">
              <SectionTitle>Lokasi</SectionTitle>
              <Textarea
                label="Alamat"
                size="sm"
                radius="md"
                minRows={2}
                autosize
                placeholder="Jalan, nomor, lantai, atau ruang"
                value={form.address}
                onChange={(e) => set({ address: e.currentTarget.value })}
              />
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <TextInput
                  label="Kota"
                  size="sm"
                  radius="md"
                  placeholder="Contoh: Jakarta"
                  value={form.city}
                  onChange={(e) => set({ city: e.currentTarget.value })}
                />
                <TextInput
                  label="Kode pos"
                  size="sm"
                  radius="md"
                  placeholder="Contoh: 12190"
                  value={form.postalCode}
                  onChange={(e) => set({ postalCode: e.currentTarget.value })}
                />
              </SimpleGrid>
            </Stack>

            <Stack gap="sm">
              <SectionTitle>Kontak</SectionTitle>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <Select
                  label="Penanggung jawab"
                  size="sm"
                  radius="md"
                  searchable
                  clearable
                  placeholder="Pilih pengguna"
                  data={picOptions}
                  renderOption={renderPicOption}
                  filter={filterPic}
                  value={form.picUserId}
                  onChange={(v) => set({ picUserId: v })}
                />
                <TextInput
                  label="Telepon"
                  size="sm"
                  radius="md"
                  data-field="phone"
                  placeholder="Contoh: 021-5150123"
                  value={form.phone}
                  error={err('phone')}
                  onChange={(e) => set({ phone: e.currentTarget.value })}
                />
              </SimpleGrid>
            </Stack>

            <Stack gap="sm">
              <SectionTitle>Catatan & status</SectionTitle>
              <Textarea
                label="Catatan"
                size="sm"
                radius="md"
                minRows={2}
                autosize
                placeholder="Keterangan tambahan tentang gudang ini"
                value={form.notes}
                onChange={(e) => set({ notes: e.currentTarget.value })}
              />
              {/* Sakelar, bukan kotak centang: ini menyalakan satu perilaku (dipakai
                  sebagai pilihan bawaan), dan keterangannya ikut berubah. Polanya sama
                  dengan sakelar serah terima barang di penawaran vendor. */}
              <Input.Wrapper label="Gudang utama" size="sm">
                <Box style={frame} p="sm">
                  <Switch
                    size="sm"
                    labelPosition="left"
                    justify="space-between"
                    w="100%"
                    label="Jadikan gudang utama"
                    description={
                      form.isDefault
                        ? 'Dipakai sebagai pilihan bawaan di transaksi baru. Gudang utama yang lama otomatis dilepas.'
                        : 'Transaksi baru tetap memakai gudang utama yang sekarang.'
                    }
                    checked={form.isDefault}
                    disabled={warehouse?.isDefault}
                    onChange={(e) => set({ isDefault: e.currentTarget.checked })}
                    styles={{ body: { alignItems: 'center' }, labelWrapper: { flex: 1 } }}
                  />
                </Box>
              </Input.Wrapper>
            </Stack>
          </Stack>
        </Box>
      </FormModal>

      <FormModal
        opened={confirmClose}
        onClose={() => setConfirmClose(false)}
        title="Buang perubahan?"
        subtitle="Perubahan yang belum disimpan akan hilang"
        icon={Warehouse}
        size={420}
        footer={
          <>
            <Button variant="default" radius="md" onClick={() => setConfirmClose(false)}>
              Lanjut mengisi
            </Button>
            <Button
              color="red"
              radius="md"
              onClick={() => {
                setConfirmClose(false);
                onClose();
              }}
            >
              Buang perubahan
            </Button>
          </>
        }
      >
        <Text fz="sm" c="slate.7">
          Ada perubahan pada form gudang yang belum disimpan.
        </Text>
      </FormModal>
    </>
  );
}
