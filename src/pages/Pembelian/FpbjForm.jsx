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
import { Briefcase, Buildings, CalendarBlank, ClipboardText, FileText, Info, Package, Plus, Scales, Trash } from '@/components/Icon.jsx';
import DateField from '@/components/DateField.jsx';
import NumberField from '@/components/NumberField.jsx';
import { Callout, BackLink, FormModal, PageIntro, Section } from './components.jsx';
import { ROUTE_OPTIONS, RouteOption } from './procurement.jsx';
import { DropField } from './Dialogs.jsx';
import { departments, personLabel, productCatalog, TODAY, units } from './data.js';
import { formatDate, iomFiles, nextNumber, rupiah, sum, uid } from './utils.js';
import { toast } from './usePb.js';

const blank = (extra = {}) => ({
  id: uid('it'),
  desc: '',
  spec: '',
  qty: 1,
  unit: 'pcs',
  estPrice: 0,
  kind: 'barang',
  isNew: true,
  ...extra,
});

export default function FpbjForm({ pb, prefill, editing, onBack, onSaved }) {
  const refPo = prefill?.poId ? pb.posById[prefill.poId] : null;
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
        }
      : {
          date: TODAY,
          neededBy: '',
          dept: '',
          purpose: refPo ? `Pesan ulang dari ${refPo.number}` : '',
          note: '',
          iomNo: '',
          iomDate: '',
          iomFile: [],
        },
  );
  const [items, setItems] = useState(() =>
    editing
      ? editing.items
      : refPo
      ? refPo.items.map((i) =>
          blank({
            desc: i.desc,
            spec: i.spec ?? '',
            qty: i.qty,
            unit: i.unit,
            kind: i.kind ?? 'barang',
            isNew: false,
            refItemId: i.id,
            refPoId: refPo.id,
          }),
        )
      : [blank()],
  );
  // Jalur pengadaan dipilih saat permintaan dibuat; penawaran vendor diunggah di detail permintaan.
  const [proc, setProc] = useState(() =>
    editing
      ? {
          path: editing.route === 'repeat' ? 'repeat' : editing.single?.on ? 'single' : editing.route === 'bidding' ? 'bidding' : null,
          vendor: editing.refVendorId ?? null,
          po: editing.refPoId ?? null,
        }
      : { path: refPo ? 'repeat' : null, vendor: refPo?.vendorId ?? null, po: refPo?.id ?? null },
  );
  const [sub, setSub] = useState(false);
  const [review, setReview] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const setItem = (id, p) => setItems((l) => l.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const total = sum(items, (i) => i.qty * i.estPrice);

  // Nama barang atau jasa dipilih dari katalog produk; jenis, satuan, dan harga acuan terisi otomatis.
  // Dropdown produk mengikuti jenis baris: jenis Barang hanya menampilkan barang, jenis Jasa hanya jasa.
  const productOptions = (kind) => productCatalog.filter((p) => p.kind === kind).map((p) => ({ value: p.id, label: p.name }));
  const productOf = (i) => productCatalog.find((p) => p.id === i.productId) ?? productCatalog.find((p) => p.name.toLowerCase() === i.desc.trim().toLowerCase());
  const pickProduct = (itemId, productId) => {
    const p = productCatalog.find((x) => x.id === productId);
    if (!p) return setItem(itemId, { productId: null, desc: '' });
    // Estimasi harga sengaja tidak diisi otomatis: peminta yang menentukan angkanya.
    setItem(itemId, { productId: p.id, desc: p.name, kind: p.kind, unit: p.unit });
  };

  const errors = {
    date: (!f.date && 'Tanggal permintaan wajib diisi') || (f.date > TODAY && 'Tidak boleh setelah hari ini') || (f.iomDate && f.date < f.iomDate && 'Tidak boleh sebelum tanggal IOM'),
    iomDate: (!f.iomDate && 'Tanggal IOM wajib diisi') || (f.date && f.iomDate > f.date && 'Tidak boleh setelah tanggal permintaan'),
    purpose: !f.purpose.trim() && 'Keperluan wajib diisi',
    dept: !f.dept && 'Departemen wajib dipilih',
    neededBy: (!f.neededBy && 'Tanggal dibutuhkan wajib diisi') || (f.date && f.neededBy < f.date && 'Tidak boleh sebelum tanggal permintaan'),
    iomNo: !f.iomNo.trim() && 'No. IOM wajib diisi',
    path: !proc.path && 'Jalur pengadaan wajib dipilih',
    iomFile: !f.iomFile.length && 'Minimal satu berkas IOM wajib diunggah',
    items:
      (!items.length || items.some((i) => !i.desc.trim() || !(i.qty > 0))) &&
      'Setiap item butuh deskripsi dan qty',
  };
  const labels = { date: 'Tanggal permintaan', neededBy: 'Dibutuhkan pada', dept: 'Departemen', purpose: 'Keperluan', iomNo: 'No. IOM', iomDate: 'Tanggal IOM', iomFile: 'Upload IOM', path: 'Jalur pengadaan', items: 'Barang atau jasa' };
  const missing = Object.keys(errors).filter((k) => errors[k]).map((k) => labels[k]);
  const invalid = missing.length > 0;

  // Kolom jalur pengadaan pada dokumen; untuk pesan ulang, item dicocokkan dengan PO referensi (nama sama = item lama).
  const procFields = (list) => {
    const po = pb.posById[proc.po];
    return {
      route: proc.path === 'repeat' ? 'repeat' : proc.path ? 'bidding' : null,
      single: { on: proc.path === 'single', reason: '' },
      refVendorId: proc.path === 'repeat' ? proc.vendor : null,
      refPoId: proc.path === 'repeat' ? proc.po : null,
      items:
        proc.path === 'repeat' && po
          ? list.map((it) => {
              const m = po.items.find((x) => x.desc.toLowerCase() === it.desc.toLowerCase());
              return m ? { ...it, isNew: false, refItemId: m.id, refPoId: po.id } : { ...it, isNew: true, refItemId: undefined };
            })
          : list,
    };
  };

  const save = (submit) => {
    if (submit) {
      setSub(true);
      if (Object.values(errors).some(Boolean)) return;
    } else if (!f.purpose.trim()) {
      setSub(true);
      if (errors.purpose) return;
    }
    if (editing) {
      pb.update('fpbj', editing.id, (d) => ({
        ...d,
        date: f.date,
        neededBy: f.neededBy,
        dept: f.dept,
        purpose: f.purpose,
        note: f.note,
        iom: { no: f.iomNo, date: f.iomDate, files: f.iomFile },
        ...procFields(items),
        status: submit ? 'diajukan' : d.status,
        returnNote: submit ? '' : d.returnNote,
      }));
      toast(submit ? 'Permintaan diperbarui dan diajukan ulang.' : 'Perubahan permintaan disimpan.');
      onSaved(editing.id);
      return;
    }
    const doc = {
      id: uid('fpbj'),
      number: nextNumber('FPBJ', pb.fpbj),
      date: f.date,
      neededBy: f.neededBy,
      dept: f.dept,
      purpose: f.purpose,
      iom: { no: f.iomNo, date: f.iomDate, files: f.iomFile },
      ...procFields(items),
      status: submit ? 'diajukan' : 'draft',
      note: f.note,
      returnNote: '',
      quotes: [],
      procurement: null,
      requester: personLabel(pb.role),
    };
    pb.add('fpbj', doc);
    toast(submit ? 'Permintaan diajukan. Menunggu verifikasi Accounting.' : 'Permintaan disimpan sebagai draf.');
    onSaved(doc.id);
  };

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" className="pb-form">
      <BackLink label="Kembali ke daftar permintaan" onClick={onBack} />
      <PageIntro
        icon={ClipboardText}
        title={editing ? `Ubah ${editing.number}` : 'Permintaan pembelian baru'}
        description="Catat kebutuhan barang atau jasa dan unggah IOM yang sudah disetujui atasan. Permintaan disimpan sebagai draf sebelum diajukan."
      />
      {refPo && (
        <Callout title="Pesan ulang">
          Item dan harga terakhir diambil dari {refPo.number}. Jalur &quot;Pesan ulang&quot; sudah terpilih; Anda bisa menyesuaikan qty
          atau menambah item baru.
        </Callout>
      )}
      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8.5 }}>
          <Stack gap="lg">
            <Section title="Informasi permintaan" description="Kapan dan untuk keperluan apa barang atau jasa dibutuhkan">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <DateField label="Tanggal permintaan" withAsterisk size="sm" radius="md" min={f.iomDate || undefined} max={TODAY} value={f.date} error={errors.date} onChange={(e) => { const date = e.currentTarget.value; set(f.neededBy && date > f.neededBy ? { date, neededBy: '' } : { date }); }} />
                <DateField label="Dibutuhkan pada" withAsterisk size="sm" radius="md" min={f.date} value={f.neededBy} error={f.neededBy && errors.neededBy} onChange={(e) => set({ neededBy: e.currentTarget.value })} />
                <Select label="Departemen" withAsterisk size="sm" radius="md" data={departments} value={f.dept || null} error={sub && errors.dept} placeholder="Pilih departemen" onChange={(v) => set({ dept: v })} />
                <TextInput label="Keperluan" withAsterisk size="sm" radius="md" placeholder="Contoh: Pengadaan ATK bulanan" value={f.purpose} error={sub && errors.purpose} onChange={(e) => set({ purpose: e.currentTarget.value })} />
                <Textarea label="Catatan" size="sm" radius="md" minRows={4} rows={4} placeholder="Contoh: Mohon diprioritaskan karena stok hampir habis" value={f.note} onChange={(e) => set({ note: e.currentTarget.value })} style={{ gridColumn: '1 / -1' }} />
              </SimpleGrid>
            </Section>

            <Section
              title={<>Jalur pengadaan <span style={{ color: 'var(--mantine-color-red-6)' }}>*</span></>}
              description={proc.path === 'repeat' ? 'Dipilih otomatis karena permintaan ini berasal dari PO lama.' : 'Pilih sesuai riwayat vendor dan barang. Penawaran vendor diunggah di detail permintaan setelah diverifikasi.'}
            >
              <Stack gap="sm">
                {proc.path === 'repeat' ? (
                  <>
                    {ROUTE_OPTIONS.filter((o) => o.value === 'repeat').map((o) => (
                      <RouteOption key={o.value} mode="repeat" setMode={() => {}} disabled value={o.value} icon={o.icon} title={o.title} text={o.text} />
                    ))}
                    <Text fz="xs" c="slate.6">
                      Acuan: {pb.posById[proc.po]?.number ?? '—'} · {pb.vendorsById[proc.vendor]?.name ?? '—'}. Item dan harga terakhir sudah terisi; sesuaikan qty dan tanggal dibutuhkan.
                    </Text>
                  </>
                ) : (
                  ROUTE_OPTIONS.filter((o) => o.value !== 'repeat').map((o) => (
                    <RouteOption key={o.value} mode={proc.path} setMode={(v) => setProc((x) => ({ ...x, path: v }))} value={o.value} icon={o.icon} title={o.title} text={o.text} />
                  ))
                )}
              </Stack>
            </Section>

            <Section title="IOM" description="Internal Office Memo yang sudah disetujui atasan, wajib diunggah untuk mengajukan">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="No. IOM" placeholder="Contoh: IOM/OPS/11/021" withAsterisk size="sm" radius="md" value={f.iomNo} error={sub && errors.iomNo} onChange={(e) => set({ iomNo: e.currentTarget.value })} />
                <DateField label="Tanggal IOM" withAsterisk size="sm" radius="md" max={f.date || TODAY} value={f.iomDate} error={f.iomDate && errors.iomDate} onChange={(e) => set({ iomDate: e.currentTarget.value })} />
                <Box style={{ gridColumn: '1 / -1' }}><DropField label="Upload IOM" multiple withAsterisk value={f.iomFile} error={sub && errors.iomFile} onChange={(v) => set({ iomFile: v })} /></Box>
              </SimpleGrid>
            </Section>

            <Section title={<>Barang atau jasa <span style={{ color: 'var(--mantine-color-red-6)' }}>*</span></>} description="Tulis spesifikasi dan estimasi harga. Estimasi hanya acuan, harga final ditentukan di pengadaan.">
              <Box style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)', overflow: 'auto' }}>
                <Table verticalSpacing="xs" horizontalSpacing="sm" miw={920} styles={{ th: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600, color: 'var(--mantine-color-slate-7)' } }}>
                  <Table.Thead bg="slate.0">
                    <Table.Tr>
                      <Table.Th w={110}>Jenis</Table.Th>
                      <Table.Th>Deskripsi / spesifikasi</Table.Th>
                      <Table.Th w={100}>Qty</Table.Th>
                      <Table.Th w={100}>Satuan</Table.Th>
                      <Table.Th w={170}>Estimasi harga</Table.Th>
                      <Table.Th w={150} ta="right">Jumlah</Table.Th>
                      <Table.Th w={44} />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {items.map((i) => (
                      <Table.Tr key={i.id}>
                        <Table.Td>
                          <Select size="xs" radius="md" allowDeselect={false} data={[{ value: 'barang', label: 'Barang' }, { value: 'jasa', label: 'Jasa' }]} value={i.kind} onChange={(v) => { const p = productOf(i); setItem(i.id, p && p.kind !== v ? { kind: v, productId: null, desc: '', unit: 'pcs', estPrice: 0 } : { kind: v }); }} />
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={4}>
                            <Select
                              size="xs"
                              radius="md"
                              searchable
                              placeholder={i.kind === 'jasa' ? 'Pilih jasa' : 'Pilih barang'}
                              nothingFoundMessage="Produk tidak ditemukan"
                              data={!i.desc || productOf(i) ? productOptions(i.kind) : [...productOptions(i.kind), { value: `lama:${i.id}`, label: `${i.desc} (dari PO referensi)` }]}
                              value={productOf(i)?.id ?? (i.desc ? `lama:${i.id}` : null)}
                              error={sub && !i.desc.trim()}
                              onChange={(v) => v && !v.startsWith('lama:') && pickProduct(i.id, v)}
                            />
                            <TextInput size="xs" radius="md" placeholder="Contoh: Putih, 500 lembar per rim" value={i.spec} onChange={(e) => setItem(i.id, { spec: e.currentTarget.value })} />
                            {!i.isNew && <Text fz={10} c="teal.7" fw={600}>Item lama · referensi PO</Text>}
                          </Stack>
                        </Table.Td>
                        <Table.Td><NumberField size="xs" radius="md" min={1} value={i.qty} onChange={(v) => setItem(i.id, { qty: Number(v) || 0 })} /></Table.Td>
                        <Table.Td><Select size="xs" radius="md" allowDeselect={false} data={units} value={i.unit} onChange={(v) => setItem(i.id, { unit: v })} /></Table.Td>
                        <Table.Td><NumberField size="xs" radius="md" min={0} thousandSeparator="." decimalSeparator="," prefix="Rp " value={i.estPrice} onChange={(v) => setItem(i.id, { estPrice: Number(v) || 0 })} /></Table.Td>
                        <Table.Td ta="right" fz="sm" fw={600}>{rupiah(i.qty * i.estPrice)}</Table.Td>
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
                {refPo ? 'Tambah item baru' : 'Tambah baris'}
              </Button>
            </Section>

          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 3.5 }}>
          <Card withBorder radius="lg" padding="lg" bg="white" pos="sticky" top={80}>
            <Text fw={700} fz="sm" c="slate.9" mb="sm">Ringkasan</Text>
            <Stack gap={6}>
              <Row label="Jumlah item" value={items.length} />
              <Row label="Jalur" value={proc.path ? ROUTE_OPTIONS.find((o) => o.value === proc.path).short : '—'} />
              <Row label="Dibutuhkan" value={f.neededBy ? formatDate(f.neededBy) : '—'} />
              <Row label="Estimasi total" value={rupiah(total)} strong />
            </Stack>
            <Text fz={11} c="slate.6" mt="sm">
              Setelah diajukan, Accounting memeriksa IOM dan kelengkapan permintaan. Penawaran vendor diunggah di detail permintaan.
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
              <Text fz={11} c="slate.6">Setelah diajukan, permintaan dikunci sampai Accounting memverifikasi.</Text>
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
          <Text fz={20} fw={700} lh={1.3} mt={2}>{f.purpose}</Text>
          <Group justify="space-between" align="flex-end" mt="md" wrap="nowrap">
            <Box>
              <Text fz={11} fw={600} style={{ opacity: 0.75 }}>Estimasi total</Text>
              <Text fz={26} fw={700} lh={1.2}>{rupiah(total)}</Text>
            </Box>
            <Badge size="lg" radius="xl" variant="white" color="primary.9" fw={700} tt="none">{items.length} item</Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs" mt="lg">
            <ReviewMeta icon={Buildings} label="Departemen">{f.dept}</ReviewMeta>
            <ReviewMeta icon={CalendarBlank} label="Tanggal permintaan">{formatDate(f.date)}</ReviewMeta>
            <ReviewMeta icon={CalendarBlank} label="Dibutuhkan pada">{formatDate(f.neededBy)}</ReviewMeta>
            <ReviewMeta icon={Scales} label="Jalur pengadaan">{ROUTE_OPTIONS.find((o) => o.value === proc.path)?.short}{proc.path === 'repeat' && proc.vendor ? ` · ${pb.vendorsById[proc.vendor]?.name ?? ''}` : ''}</ReviewMeta>
          </SimpleGrid>
          {f.note.trim() && (
            <Box mt="md" p="sm" style={{ borderRadius: 'var(--mantine-radius-md)', background: 'rgba(255,255,255,0.12)' }}>
              <Text fz={11} fw={600} style={{ opacity: 0.75 }}>Catatan</Text>
              <Text fz="sm" style={{ whiteSpace: 'pre-wrap' }}>{f.note}</Text>
            </Box>
          )}
        </Box>

        <Box>
          <Group justify="space-between" mb={8}>
            <Text fz="sm" fw={700} c="slate.9">IOM</Text>
            <Text fz="xs" c="slate.6">{f.iomNo} · {formatDate(f.iomDate)}</Text>
          </Group>
          <Group gap="xs">
            {f.iomFile.map((name) => (
              <Group key={name} gap={6} wrap="nowrap" px="sm" py={6} style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 999, maxWidth: '100%' }}>
                <FileText size={16} color="var(--mantine-color-primary-9)" />
                <Text fz="xs" fw={600} truncate>{name}</Text>
              </Group>
            ))}
          </Group>
        </Box>

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
                style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 130px minmax(0, 1fr)', alignItems: 'center', columnGap: 'var(--mantine-spacing-md)', borderTop: idx ? '1px solid var(--mantine-color-gray-2)' : undefined }}
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
                <Stack gap={4} align="center">
                  <Badge size="sm" radius="xl" variant="default" fw={600} tt="none">{i.qty} {i.unit}</Badge>
                  <Text fz="xs" c="slate.6" style={{ whiteSpace: 'nowrap' }}>× {rupiah(i.estPrice)}</Text>
                </Stack>
                <Box ta="right">
                  <Text fz={11} fw={600} c="slate.6">Jumlah</Text>
                  <Text fz="sm" fw={700} c="slate.9" style={{ whiteSpace: 'nowrap' }}>{rupiah(i.qty * i.estPrice)}</Text>
                </Box>
              </Box>
            ))}
            <Group justify="space-between" px="md" py="sm" bg="primary.0" style={{ borderTop: '1px solid var(--mantine-color-primary-1)' }}>
              <Text fz="sm" fw={600} c="primary.9">Estimasi total</Text>
              <Text fz="md" fw={700} c="primary.9">{rupiah(total)}</Text>
            </Group>
          </Box>
        </Box>
      </FormModal>
    </Stack>
  );
}

function ReviewMeta({ icon: Icon, label, children }) {
  return (
    <Group gap="xs" wrap="nowrap" p="xs" style={{ minWidth: 0, borderRadius: 'var(--mantine-radius-md)', background: 'rgba(255,255,255,0.12)' }}>
      <Icon size={20} style={{ flexShrink: 0 }} />
      <Box style={{ minWidth: 0 }}>
        <Text fz={10} fw={600} style={{ opacity: 0.75 }}>{label}</Text>
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
