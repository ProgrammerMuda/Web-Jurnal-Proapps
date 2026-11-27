// Form Ajukan biaya. Pengaju cukup mengisi apa yang tertulis di tagihannya: penerima, nomor,
// tanggal, kategori, dan jumlah sesuai tagihan. Akun beban, PPN, dan PPh ditetapkan Accounting
// saat verifikasi, jadi pengaju tidak perlu tahu kode akun maupun aturan pajaknya.
import { useState } from 'react';
import { ActionIcon, Box, Button, Card, Group, SegmentedControl, Select, SimpleGrid, Stack, Table, Text, Textarea, TextInput } from '@mantine/core';
import { PaperPlaneTilt, Plus, Receipt, Trash } from '@/components/Icon.jsx';
import DateField from '@/components/DateField.jsx';
import { DropField } from '@/components/DropField.jsx';
import NumberField from '@/components/NumberField.jsx';
import { BackLink, CardHead, FormActions, PageIntro, renderVendorOption, vendorSelectData } from './components.jsx';
import { departments, personLabel, TODAY } from './data.js';
import { CATEGORIES, categoryOf, defaultDue, nextExpenseNumber } from './expenses.js';
import { SOURCE_ACCOUNTS } from './journal.js';
import { logEntry, withLog } from './permissions.js';
import { toast } from './usePb.js';
import { rupiah } from './utils.js';

let seq = 0;
const blankLine = () => ({ id: `n${Date.now()}${seq++}`, category: null, desc: '', gross: 0 });

export default function ExpenseForm({ pb, editing, onBack, onSaved }) {
  const [f, setF] = useState(() => ({
    vendorId: editing?.vendorId ?? null,
    vendorNo: editing?.vendorNo ?? '',
    date: editing?.date ?? TODAY,
    dueDate: editing?.dueDate ?? defaultDue(TODAY),
    dept: editing?.dept ?? null,
    paid: !!editing?.paidDirect,
    source: editing?.paidDirect?.source ?? SOURCE_ACCOUNTS[0].label,
    paidDate: editing?.paidDirect?.date ?? TODAY,
    lines: editing?.lines.map((l) => ({ id: l.id, category: l.category, desc: l.desc, gross: l.gross ?? l.price, account: l.account })) ?? [blankLine()],
    files: editing?.files ?? [],
    note: editing?.note ?? '',
  }));
  const [sub, setSub] = useState(false);
  const set = (patch) => setF((s) => ({ ...s, ...patch }));
  const setLine = (id, patch) => setF((s) => ({ ...s, lines: s.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  const total = f.lines.reduce((n, l) => n + (Number(l.gross) || 0), 0);

  const errors = {
    vendorId: !f.vendorId && 'Pilih penerima',
    date: !f.date && 'Isi tanggal tagihan',
    dueDate: !f.paid && (!f.dueDate ? 'Isi jatuh tempo' : f.dueDate < f.date && 'Jatuh tempo tidak boleh sebelum tanggal tagihan'),
    dept: !f.dept && 'Pilih departemen',
    files: !f.files.length && 'Lampirkan tagihan atau bukti bayarnya',
    lines: f.lines.some((l) => !l.category || !l.desc.trim() || !(l.gross > 0)) && 'Lengkapi kategori, keterangan, dan jumlah tiap baris',
  };
  const firstError = Object.values(errors).find(Boolean);

  const save = () => {
    setSub(true);
    if (firstError) return;
    const lines = f.lines.map((l) => {
      const prev = editing?.lines.find((x) => x.id === l.id);
      // Akun hasil verifikasi sebelumnya dipertahankan kalau kategorinya tidak diganti.
      const account = prev && prev.category === l.category ? prev.account : categoryOf(l.category).account;
      return { id: l.id, category: l.category, desc: l.desc.trim(), gross: l.gross, account, kind: 'jasa', qty: 1, unit: '', price: l.gross, ppnRate: 0, received: true };
    });
    const source = SOURCE_ACCOUNTS.find((s) => s.label === f.source);
    const base = {
      type: 'biaya',
      vendorId: f.vendorId,
      vendorNo: f.vendorNo.trim(),
      date: f.date,
      dueDate: f.paid ? f.paidDate : f.dueDate,
      dept: f.dept,
      note: f.note.trim(),
      files: f.files,
      lines,
      paidDirect: f.paid ? { source: source.label, account: source.account, date: f.paidDate } : null,
      stage: 'verifikasi',
      // Pajak ditetapkan ulang oleh Accounting saat verifikasi berikutnya.
      pphType: 'none',
      pphPct: 0,
      pphAccount: undefined,
      approvals: undefined,
    };
    if (editing) {
      pb.update('invoices', editing.id, (d) => withLog({ ...d, ...base, returnNote: undefined }, logEntry(pb.role, 'ajukan', { note: 'Diajukan ulang' })));
      toast(`${editing.number} diajukan ulang ke Accounting.`);
      onSaved(editing.id);
      return;
    }
    const id = `exp-${Date.now()}`;
    const doc = withLog({ id, number: nextExpenseNumber(pb.invoices, f.date), createdBy: personLabel(pb.role), ...base }, logEntry(pb.role, 'ajukan'));
    pb.add('invoices', doc);
    toast(`${doc.number} diajukan. Accounting akan memverifikasi akun dan pajaknya.`);
    onSaved(id);
  };

  const field = { size: 'sm', radius: 'md' };
  return (
    <Stack gap="lg" p="lg" maw={1080} mx="auto" className="pb-form">
      <BackLink label={editing ? `Kembali ke ${editing.number}` : 'Kembali ke daftar biaya'} onClick={onBack} />
      <PageIntro
        icon={Receipt}
        title={editing ? `Ubah ${editing.number}` : 'Ajukan biaya'}
        description="Isi sesuai tagihan yang diterima. Accounting yang menentukan akun beban, PPN, dan PPh-nya."
      />

      <Card withBorder radius="lg" padding={0} bg="white">
        <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          <CardHead icon={Receipt} desc="Siapa yang menagih dan kapan harus dibayar">Tagihan</CardHead>
        </Box>
        <Stack gap="md" p="lg">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              {...field}
              label="Penerima"
              withAsterisk
              searchable
              placeholder="Pilih vendor atau penyedia layanan"
              data={vendorSelectData(pb.vendors)}
              renderOption={renderVendorOption}
              value={f.vendorId}
              error={sub && errors.vendorId}
              onChange={(v) => set({ vendorId: v })}
            />
            <TextInput {...field} label="No. tagihan dari penerima" placeholder="Mis. nomor rekening listrik atau invoice" value={f.vendorNo} onChange={(e) => set({ vendorNo: e.currentTarget.value })} />
            <DateField {...field} label="Tanggal tagihan" withAsterisk max={TODAY} value={f.date} error={sub && errors.date} onChange={(e) => set({ date: e.currentTarget.value })} />
            <Select {...field} label="Departemen" withAsterisk placeholder="Pilih departemen" data={departments} value={f.dept} error={sub && errors.dept} onChange={(v) => set({ dept: v })} />
          </SimpleGrid>

          <Box>
            <Text fz="sm" fw={500} mb={6}>Cara bayar</Text>
            <SegmentedControl
              radius="md"
              size="sm"
              value={f.paid ? 'paid' : 'bill'}
              onChange={(v) => set({ paid: v === 'paid' })}
              data={[
                { value: 'bill', label: 'Ditagih, dibayar nanti' },
                { value: 'paid', label: 'Sudah dibayar perusahaan' },
              ]}
            />
            <Text fz="xs" c="slate.6" mt={6}>
              {f.paid
                ? 'Mis. autodebet atau dibayar langsung dari rekening. Setelah disetujui, biaya ini langsung lunas tanpa Payment Request.'
                : 'Setelah disetujui, biaya ini masuk Hutang Usaha dan dibayar lewat Payment Request.'}
            </Text>
          </Box>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {f.paid ? (
              <>
                <Select {...field} label="Dibayar dari" withAsterisk allowDeselect={false} data={SOURCE_ACCOUNTS.map((s) => s.label)} value={f.source} onChange={(v) => set({ source: v })} />
                <DateField {...field} label="Tanggal dibayar" withAsterisk max={TODAY} value={f.paidDate} onChange={(e) => set({ paidDate: e.currentTarget.value })} />
              </>
            ) : (
              <DateField {...field} label="Jatuh tempo" withAsterisk min={f.date} value={f.dueDate} error={sub && errors.dueDate} onChange={(e) => set({ dueDate: e.currentTarget.value })} />
            )}
          </SimpleGrid>
        </Stack>
      </Card>

      <Card withBorder radius="lg" padding={0} bg="white">
        <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          <CardHead icon={Receipt} desc="Jumlah sesuai tagihan, termasuk pajak bila ada">Rincian biaya</CardHead>
        </Box>
        <Box style={{ overflow: 'auto' }}>
          <Table verticalSpacing="sm" horizontalSpacing="md" miw={720}>
            <Table.Thead bg="slate.0">
              <Table.Tr>
                <Table.Th w={260} fz="xs" c="slate.7">Kategori</Table.Th>
                <Table.Th fz="xs" c="slate.7">Keterangan</Table.Th>
                <Table.Th w={200} fz="xs" c="slate.7" ta="right">Jumlah sesuai tagihan</Table.Th>
                <Table.Th w={44} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {f.lines.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>
                    <Select {...field} size="xs" searchable placeholder="Pilih kategori" data={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} value={l.category} error={sub && !l.category} onChange={(v) => setLine(l.id, { category: v })} aria-label="Kategori" />
                  </Table.Td>
                  <Table.Td>
                    <TextInput {...field} size="xs" placeholder="Mis. listrik gedung, periode Oktober 2026" value={l.desc} error={sub && !l.desc.trim()} onChange={(e) => setLine(l.id, { desc: e.currentTarget.value })} aria-label="Keterangan" />
                  </Table.Td>
                  <Table.Td>
                    <NumberField size="xs" radius="md" money hideControls leftSection={<Text fz="xs" c="slate.6">Rp</Text>} value={l.gross || ''} error={sub && !(l.gross > 0)} onChange={(v) => setLine(l.id, { gross: Number(v) || 0 })} aria-label="Jumlah" />
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" color="red" radius="md" aria-label="Hapus baris" disabled={f.lines.length === 1} onClick={() => set({ lines: f.lines.filter((x) => x.id !== l.id) })}>
                      <Trash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
        <Group justify="space-between" px="lg" py="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
          <Button variant="default" radius="md" size="xs" leftSection={<Plus size={14} />} onClick={() => set({ lines: [...f.lines, blankLine()] })}>Tambah baris</Button>
          <Group gap="sm">
            <Text fz="sm" c="slate.7">Total tagihan</Text>
            <Text fz="lg" fw={700} c="slate.9" style={{ fontVariantNumeric: 'tabular-nums' }}>{rupiah(total)}</Text>
          </Group>
        </Group>
      </Card>

      <Card withBorder radius="lg" padding={0} bg="white">
        <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          <CardHead icon={Receipt} desc="Tagihan wajib dilampirkan; faktur pajak bila ada">Bukti & catatan</CardHead>
        </Box>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" p="lg">
          <Box>
            <DropField label="Tagihan / bukti bayar" withAsterisk multiple value={f.files} onChange={(v) => set({ files: v })} />
            {sub && errors.files && <Text fz="xs" c="red.7" mt={4}>{errors.files}</Text>}
          </Box>
          <Textarea {...field} label="Catatan" placeholder="Periode, lokasi, atau keterangan lain untuk Accounting" autosize minRows={4} value={f.note} onChange={(e) => set({ note: e.currentTarget.value })} />
        </SimpleGrid>
      </Card>

      <FormActions error={sub && firstError} onCancel={onBack}>
        <Button radius="md" leftSection={<PaperPlaneTilt size={16} />} onClick={save}>
          {editing ? 'Ajukan ulang' : 'Ajukan biaya'}
        </Button>
      </FormActions>
    </Stack>
  );
}
