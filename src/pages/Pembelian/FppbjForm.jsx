// Halaman penuh "Permintaan Pembelian Baru" — seperti halaman buat permintaan di produksi.
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useState } from 'react';
import { Briefcase, Buildings, CalendarBlank, ClipboardText, Info, Package, Plus, Trash } from '@/components/Icon.jsx';
import DateField from '@/components/DateField.jsx';
import NumberField from '@/components/NumberField.jsx';
import { BackLink, FormModal, PageIntro, Section } from './components.jsx';
import { DropField } from './Dialogs.jsx';
import { departments, personLabel, productCatalog, TODAY, units } from './data.js';
import { useData } from '@/lib/store.jsx';
import { defaultWarehouseId, warehouseOptions } from '@/pages/Gudang/data.js';
import { formatDate, iomFiles, nextNumber, uid } from './utils.js';
import { toast } from './usePb.js';
import { logEntry, withLog } from './permissions.js';
import review from './FppbjReview.module.css';
import AttachmentList from './Attachments.jsx';

const blank = (extra = {}) => ({
  id: uid('it'),
  desc: '',
  spec: '',
  qty: 1,
  unit: 'pcs',
  kind: 'barang',
  ...extra,
});

export default function FppbjForm({ pb, editing, onBack, onSaved }) {
  const { warehouses } = useData();
  // Lokasi kirim = gudang tujuan barang. Bawaannya gudang utama; hanya gudang aktif
  // yang bisa dipilih, tapi gudang lama pada permintaan yang sudah ada tetap tampil.
  const gudangOptions = warehouseOptions(warehouses, editing?.warehouseId);
  const [f, setF] = useState(() =>
    editing
      ? {
          date: editing.date,
          neededBy: editing.neededBy,
          dept: editing.dept,
          purpose: editing.purpose,
          note: editing.note,
          iomNo: editing.iom.no,
          iomDate: editing.iom.date,
          iomFile: iomFiles(editing.iom),
          warehouseId: editing.warehouseId ?? null,
        }
      : {
          date: TODAY,
          neededBy: '',
          dept: '',
          purpose: '',
          note: '',
          iomNo: '',
          iomDate: '',
          iomFile: [],
          warehouseId: defaultWarehouseId(warehouses),
        },
  );
  const [items, setItems] = useState(() => (editing ? editing.items : [blank()]));
  // Jalur pengadaan TIDAK dipilih di sini — ditentukan di panel pengadaan, setelah verifikasi.
  const [sub, setSub] = useState(false);
  const [review, setReview] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const setItem = (id, p) => setItems((l) => l.map((i) => (i.id === id ? { ...i, ...p } : i)));

  // Nama barang atau jasa dipilih dari katalog produk; jenis dan satuan terisi otomatis.
  // Dropdown produk mengikuti jenis baris: jenis Barang hanya menampilkan barang, jenis Jasa hanya jasa.
  const productOptions = (kind) => productCatalog.filter((p) => p.kind === kind).map((p) => ({ value: p.id, label: p.name }));
  const productOf = (i) => productCatalog.find((p) => p.id === i.productId) ?? productCatalog.find((p) => p.name.toLowerCase() === i.desc.trim().toLowerCase());
  const pickProduct = (itemId, productId) => {
    const p = productCatalog.find((x) => x.id === productId);
    if (!p) return setItem(itemId, { productId: null, desc: '' });
    setItem(itemId, { productId: p.id, desc: p.name, kind: p.kind, unit: p.unit });
  };

  // IOM opsional: tidak ada satu pun field IOM yang wajib. Yang tersisa hanya pemeriksaan
  // kewajaran tanggal, dan itu pun baru berlaku kalau tanggal IOM memang diisi.
  const errors = {
    date: (!f.date && 'Tanggal permintaan wajib diisi') || (f.date > TODAY && 'Tidak boleh setelah hari ini') || (f.iomDate && f.date < f.iomDate && 'Tidak boleh sebelum tanggal memo'),
    iomDate: !!f.iomDate && !!f.date && f.iomDate > f.date && 'Tidak boleh setelah tanggal permintaan',
    purpose: !f.purpose.trim() && 'Keperluan wajib diisi',
    dept: !f.dept && 'Departemen wajib dipilih',
    neededBy: (!f.neededBy && 'Tanggal dibutuhkan wajib diisi') || (f.date && f.neededBy < f.date && 'Tidak boleh sebelum tanggal permintaan'),
    items:
      (!items.length || items.some((i) => !i.desc.trim() || !(i.qty > 0))) &&
      'Setiap item butuh deskripsi dan qty',
  };
  const labels = { date: 'Tanggal permintaan', neededBy: 'Dibutuhkan pada', dept: 'Departemen', purpose: 'Keperluan', iomDate: 'Tanggal memo', items: 'Barang atau jasa' };
  const missing = Object.keys(errors).filter((k) => errors[k]).map((k) => labels[k]);
  const invalid = missing.length > 0;

  const save = (submit) => {
    if (submit) {
      setSub(true);
      if (Object.values(errors).some(Boolean)) return;
    } else if (!f.purpose.trim()) {
      setSub(true);
      if (errors.purpose) return;
    }
    if (editing) {
      pb.update('fppbj', editing.id, (d) => ({
        ...d,
        date: f.date,
        neededBy: f.neededBy,
        dept: f.dept,
        purpose: f.purpose,
        note: f.note,
        warehouseId: f.warehouseId,
        iom: { no: f.iomNo, date: f.iomDate, files: f.iomFile },
        items,
        status: submit ? 'diajukan' : d.status,
        submittedAt: submit ? TODAY : d.submittedAt,
        returnNote: submit ? '' : d.returnNote,
        ...(submit ? { log: [...(d.log ?? []), logEntry(pb.role, 'ajukan', { note: 'Diajukan ulang' })] } : {}),
      }));
      toast(submit ? 'Permintaan diperbarui dan diajukan ulang.' : 'Perubahan permintaan disimpan.');
      onSaved(editing.id);
      return;
    }
    const doc0 = {
      id: uid('fppbj'),
      number: nextNumber('FPPBJ', pb.fppbj),
      date: f.date,
      neededBy: f.neededBy,
      dept: f.dept,
      warehouseId: f.warehouseId,
      purpose: f.purpose,
      iom: { no: f.iomNo, date: f.iomDate, files: f.iomFile },
      items,
      route: null,
      single: { on: false, reason: '' },
      status: submit ? 'diajukan' : 'draft',
      submittedAt: submit ? TODAY : null,
      note: f.note,
      returnNote: '',
      quotes: [],
      procurement: null,
      requester: personLabel(pb.role),
    };
    const doc = submit ? withLog(doc0, logEntry(pb.role, 'ajukan')) : doc0;
    pb.add('fppbj', doc);
    toast(submit ? 'Permintaan diajukan. Menunggu verifikasi.' : 'Permintaan disimpan sebagai draf.');
    onSaved(doc.id);
  };

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" className="pb-form">
      <BackLink label="Kembali ke daftar permintaan" onClick={onBack} />
      <PageIntro
        icon={ClipboardText}
        title={editing ? `Ubah ${editing.number}` : 'Permintaan pembelian baru'}
        description="Catat kebutuhan barang atau jasa. Jalur pengadaan tidak dipilih di sini — itu ditentukan di tahap pengadaan, setelah permintaan diverifikasi. Permintaan disimpan sebagai draf sebelum diajukan."
      />
      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8.5 }}>
          <Stack gap="lg">
            <Section title="Informasi permintaan" description="Kapan dan untuk keperluan apa barang atau jasa dibutuhkan">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <DateField label="Tanggal permintaan" withAsterisk size="sm" radius="md" min={f.iomDate || undefined} max={TODAY} value={f.date} error={errors.date} onChange={(e) => { const date = e.currentTarget.value; set(f.neededBy && date > f.neededBy ? { date, neededBy: '' } : { date }); }} />
                <DateField label="Dibutuhkan pada" withAsterisk size="sm" radius="md" min={f.date} value={f.neededBy} error={f.neededBy && errors.neededBy} onChange={(e) => set({ neededBy: e.currentTarget.value })} />
                <Select label="Departemen" withAsterisk size="sm" radius="md" data={departments} value={f.dept || null} error={sub && errors.dept} placeholder="Pilih departemen" onChange={(v) => set({ dept: v })} />
                <Select label="Lokasi kirim" description="Gudang tujuan barang" size="sm" radius="md" searchable clearable data={gudangOptions} value={f.warehouseId} placeholder="Pilih gudang" onChange={(v) => set({ warehouseId: v })} />
                <TextInput label="Keperluan" withAsterisk size="sm" radius="md" placeholder="Contoh: Pengadaan ATK bulanan" value={f.purpose} error={sub && errors.purpose} onChange={(e) => set({ purpose: e.currentTarget.value })} />
                <Textarea label="Catatan" size="sm" radius="md" minRows={4} rows={4} placeholder="Contoh: Mohon diprioritaskan karena stok hampir habis" value={f.note} onChange={(e) => set({ note: e.currentTarget.value })} style={{ gridColumn: '1 / -1' }} />
              </SimpleGrid>
            </Section>

            <Section title="Internal Office Memo (opsional)" description="Memo yang sudah disetujui atasan. Lampirkan bila memang ada; permintaan tetap bisa diajukan tanpa memo.">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Nomor memo" placeholder="Contoh: IOM/OPS/11/021" size="sm" radius="md" value={f.iomNo} onChange={(e) => set({ iomNo: e.currentTarget.value })} />
                <DateField label="Tanggal memo" size="sm" radius="md" max={f.date || TODAY} value={f.iomDate} error={f.iomDate && errors.iomDate} onChange={(e) => set({ iomDate: e.currentTarget.value })} />
                <Box style={{ gridColumn: '1 / -1' }}><DropField label="Upload memo" multiple value={f.iomFile} onChange={(v) => set({ iomFile: v })} /></Box>
              </SimpleGrid>
            </Section>

            <Section title={<>Barang atau jasa <span style={{ color: 'var(--mantine-color-red-6)' }}>*</span></>} description="Tulis spesifikasi dan jumlah yang dibutuhkan. Harga tidak diisi di sini — harga datang dari penawaran vendor saat pengadaan.">
              <Box style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)', overflow: 'auto' }}>
                <Table verticalSpacing="xs" horizontalSpacing="sm" miw={720} styles={{ th: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600, color: 'var(--mantine-color-slate-7)' } }}>
                  <Table.Thead bg="slate.0">
                    <Table.Tr>
                      <Table.Th w={110}>Jenis</Table.Th>
                      <Table.Th>Deskripsi / spesifikasi</Table.Th>
                      <Table.Th w={100}>Qty</Table.Th>
                      <Table.Th w={100}>Satuan</Table.Th>
                      <Table.Th w={44} />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {items.map((i) => (
                      <Table.Tr key={i.id}>
                        <Table.Td>
                          <Select size="xs" radius="md" allowDeselect={false} data={[{ value: 'barang', label: 'Barang' }, { value: 'jasa', label: 'Jasa' }]} value={i.kind} onChange={(v) => { const p = productOf(i); setItem(i.id, p && p.kind !== v ? { kind: v, productId: null, desc: '', unit: 'pcs' } : { kind: v }); }} />
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={4}>
                            <Select
                              size="xs"
                              radius="md"
                              searchable
                              placeholder={i.kind === 'jasa' ? 'Pilih jasa' : 'Pilih barang'}
                              nothingFoundMessage="Produk tidak ditemukan"
                              data={productOptions(i.kind)}
                              value={productOf(i)?.id ?? null}
                              error={sub && !i.desc.trim()}
                              onChange={(v) => v && pickProduct(i.id, v)}
                            />
                            <TextInput size="xs" radius="md" placeholder="Contoh: Putih, 500 lembar per rim" value={i.spec} onChange={(e) => setItem(i.id, { spec: e.currentTarget.value })} />
                          </Stack>
                        </Table.Td>
                        <Table.Td><NumberField size="xs" radius="md" min={1} value={i.qty} onChange={(v) => setItem(i.id, { qty: Number(v) || 0 })} /></Table.Td>
                        <Table.Td><Select size="xs" radius="md" allowDeselect={false} data={units} value={i.unit} onChange={(v) => setItem(i.id, { unit: v })} /></Table.Td>
                        <Table.Td>
                          <ActionIcon variant="subtle" color="red" aria-label="Hapus baris" disabled={items.length === 1} onClick={() => setItems((l) => l.filter((x) => x.id !== i.id))}>
                            <Trash size={16} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Box>
              {sub && errors.items && <Text fz="xs" c="red.7" mt={6}>{errors.items}</Text>}
              <Button mt="sm" size="xs" variant="light" radius="md" leftSection={<Plus size={14} />} onClick={() => setItems((l) => [...l, blank()])}>
                Tambah baris
              </Button>
            </Section>

          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 3.5 }}>
          <Card withBorder radius="lg" padding="lg" bg="white" pos="sticky" top={80}>
            <Text fw={700} fz="sm" c="slate.9" mb="sm">Ringkasan</Text>
            <Stack gap={6}>
              <Row label="Jumlah item" value={items.length} />
              <Row label="Dibutuhkan" value={f.neededBy ? formatDate(f.neededBy) : '—'} strong />
            </Stack>
            <Text fz={11} c="slate.6" mt="sm">
              Setelah diajukan, permintaan diverifikasi dulu. Jalur pengadaan dan penawaran vendor menyusul di detail permintaan.
            </Text>
            <Stack gap="xs" mt="md">
              <Button radius="md" disabled={invalid} onClick={() => setReview(true)}>{editing ? 'Simpan & ajukan ulang' : 'Ajukan permintaan'}</Button>
              <Button radius="md" variant="default" onClick={() => save(false)}>{editing ? 'Simpan perubahan' : 'Simpan sebagai draf'}</Button>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <FormModal
        opened={review}
        onClose={() => setReview(false)}
        size={720}
        icon={ClipboardText}
        title={editing ? 'Ajukan ulang permintaan?' : 'Ajukan permintaan?'}
        subtitle="Periksa kembali sebelum dikirim ke Accounting."
        footer={
          <Group justify="space-between" wrap="nowrap" w="100%">
            <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
              <Info size={16} color="var(--mantine-color-slate-6)" style={{ flexShrink: 0 }} />
              <Text fz={11} c="slate.6">Setelah diajukan, permintaan dikunci sampai diverifikasi.</Text>
            </Group>
            <Group gap="sm" wrap="nowrap" style={{ flexShrink: 0 }}>
              <Button variant="default" radius="md" onClick={() => setReview(false)}>Kembali ubah</Button>
              <Button radius="md" onClick={() => { setReview(false); save(true); }}>{editing ? 'Ajukan ulang' : 'Ajukan'}</Button>
            </Group>
          </Group>
        }
      >
        <Box
          p="lg"
          style={{
            borderRadius: 'var(--mantine-radius-lg)',
            color: 'white',
            background: 'linear-gradient(135deg, var(--mantine-color-primary-9) 0%, var(--mantine-color-primary-7) 100%)',
          }}
        >
          <Text fz={11} fw={600} style={{ opacity: 0.75, letterSpacing: 0.5 }} tt="uppercase">Keperluan</Text>
          <Text fz={20} fw={700} lh={1.3} mt={4}>{f.purpose}</Text>
          {/* Tiga fakta sejajar dalam satu baris, dipisah garis tipis; di ponsel bertumpuk. */}
          <SimpleGrid
            cols={{ base: 1, xs: 3 }}
            spacing={0}
            verticalSpacing="sm"
            mt="lg"
            pt="md"
            style={{ borderTop: '1px solid rgba(255,255,255,0.18)' }}
          >
            <ReviewMeta icon={Buildings} label="Departemen" first>{f.dept}</ReviewMeta>
            <ReviewMeta icon={CalendarBlank} label="Tanggal permintaan">{formatDate(f.date)}</ReviewMeta>
            <ReviewMeta icon={CalendarBlank} label="Dibutuhkan pada">{formatDate(f.neededBy)}</ReviewMeta>
          </SimpleGrid>
          {f.note.trim() && (
            <Box mt="md" pt="md" style={{ borderTop: '1px solid rgba(255,255,255,0.18)' }}>
              <Text fz={11} fw={600} style={{ opacity: 0.75 }}>Catatan</Text>
              <Text fz="sm" lh={1.5} mt={2} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{f.note}</Text>
            </Box>
          )}
        </Box>

        {(f.iomNo.trim() || f.iomDate || f.iomFile.length > 0) && (
          <Box>
            <Text fz="sm" fw={700} c="slate.9" mb={8}>Internal Office Memo</Text>
            <Stack gap="xs">
              <SimpleGrid cols={3} spacing="md">
                <Box style={{ minWidth: 0 }}>
                  <Text fz={11} c="slate.6">Nomor memo</Text>
                  <Text fz="sm" fw={600} c="slate.9" truncate>{f.iomNo.trim() || '—'}</Text>
                </Box>
                <Box style={{ minWidth: 0 }}>
                  <Text fz={11} c="slate.6">Tanggal memo</Text>
                  <Text fz="sm" fw={600} c="slate.9">{f.iomDate ? formatDate(f.iomDate) : '—'}</Text>
                </Box>
                <Box style={{ minWidth: 0 }}>
                  <Text fz={11} c="slate.6">Berkas</Text>
                  <Text fz="sm" fw={600} c="slate.9">{f.iomFile.length ? `${f.iomFile.length} berkas` : '—'}</Text>
                </Box>
              </SimpleGrid>
              {/* Berkas yang diunggah bisa dilihat atau diunduh sebelum diajukan. */}
              {f.iomFile.length > 0 && <AttachmentList names={f.iomFile} label={`Internal Office Memo ${f.iomNo.trim()}`.trim()} />}
            </Stack>
          </Box>
        )}

        <Box>
          <Group justify="space-between" mb={8}>
            <Text fz="sm" fw={700} c="slate.9">Barang atau jasa</Text>
            <Badge size="sm" radius="sm" variant="light" color="slate" tt="none">{items.length} item</Badge>
          </Group>
          <Box style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }}>
            {items.map((i, idx) => (
              <Box
                key={i.id}
                p="md"
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 130px', alignItems: 'center', columnGap: 'var(--mantine-spacing-md)', borderTop: idx ? '1px solid var(--mantine-color-gray-2)' : undefined }}
              >
                <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
                  <ThemeIcon variant="light" size={40} radius="md" color={i.kind === 'jasa' ? 'grape' : 'primary'} style={{ flexShrink: 0 }}>
                    {i.kind === 'jasa' ? <Briefcase size={20} /> : <Package size={20} />}
                  </ThemeIcon>
                  <Box style={{ minWidth: 0 }}>
                    <Text fz="sm" fw={700} c="slate.9" truncate>{i.desc}</Text>
                    {i.spec && <Text fz="xs" c="slate.6" truncate>{i.spec}</Text>}
                  </Box>
                </Group>
                <Box ta="right">
                  <Badge size="sm" radius="xl" variant="default" fw={600} tt="none">{i.qty} {i.unit}</Badge>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </FormModal>
    </Stack>
  );
}

function ReviewMeta({ icon: Icon, label, first, children }) {
  return (
    <Group
      gap="xs"
      wrap="nowrap"
      align="flex-start"
      className={first ? undefined : review.sep}
      style={{ minWidth: 0 }}
    >
      <Icon size={18} style={{ flexShrink: 0, marginTop: 2, opacity: 0.85 }} />
      <Box style={{ minWidth: 0 }}>
        <Text fz={11} fw={600} style={{ opacity: 0.75 }}>{label}</Text>
        <Text fz="sm" fw={700} truncate>{children}</Text>
      </Box>
    </Group>
  );
}

function Row({ label, value, strong }) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Text fz="xs" c="slate.7">{label}</Text>
      <Text fz={strong ? 'sm' : 'xs'} fw={strong ? 700 : 600} c="slate.9" ta="right">{value}</Text>
    </Group>
  );
}
