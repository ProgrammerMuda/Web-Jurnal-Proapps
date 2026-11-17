// Dialog pembuatan dokumen lanjutan (penawaran, penerimaan, faktur, payment request, retur, dll).
import {
  Badge,
  Box,
  Button,
  Grid,
  Group,
  Input,
  SimpleGrid,
  Stack,
  Select,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useState } from 'react';
import {
  ClipboardText,
  CurrencyCircleDollar,
  FileText,
  Invoice,
  ArrowCounterClockwise,
  PaperPlaneTilt,
  Truck,
  Wallet,
  Warning,
} from '@/components/Icon.jsx';
import DateField from '@/components/DateField.jsx';
import NumberField from '@/components/NumberField.jsx';
import { Callout, CopyIcon, Field, FormModal } from './components.jsx';
import { dpOptions, fitOptions, periodOptions, personLabel, serviceTerms, serviceTermOf, TODAY } from './data.js';
import {
  addDays,
  advanceLabel,
  advancePct,
  bankOf,
  formatDate,
  invDpp,
  invPpn,
  invTotals,
  nextNumber,
  parseWarranty,
  itemKind,
  poAllBarang,
  poAllJasa,
  poDocLabel,
  lineRate,
  lineTaxes,
  ppnLabel,
  TAX_OPTIONS,
  poDpAmount,
  poTotal,
  remainingQty,
  scheduleBase,
  scheduleExcludesDp,
  scheduleCount,
  returnedQty,
  rupiah,
  uid,
  termText,
  uninvoicedLines,
  vendorCredit,
  vendorEmail,
} from './utils.js';
import { toast } from './usePb.js';
import { DropField, MAX_UPLOAD_MB } from '@/components/DropField.jsx';

export { DropField, MAX_UPLOAD_MB };

const th = {
  th: {
    fontSize: 'var(--mantine-font-size-xs)',
    color: 'var(--mantine-color-slate-7)',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
};
const tableFrame = {
  border: '1px solid var(--mantine-color-gray-3)',
  borderRadius: 'var(--mantine-radius-md)',
  overflow: 'auto',
};

const Cancel = ({ onClick }) => (
  <Button variant="default" radius="md" onClick={onClick}>
    Batal
  </Button>
);

// Berkas tunggal (nilai berupa nama berkas), tampilan sama dengan DropField.
export function FileField({ label, value, onChange, error, withAsterisk }) {
  return <DropField label={label} withAsterisk={withAsterisk} value={value ? [value] : []} error={error} onChange={(arr) => onChange(arr[0] ?? '')} />;
}

// Bobot termin default: dibagi rata, sisa pembulatan masuk ke termin terakhir supaya totalnya 100%.
function evenPcts(n) {
  const base = Math.floor((100 / n) * 10) / 10;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? Math.round((100 - base * (n - 1)) * 10) / 10 : base));
}

// Rangkai objek termin dari isian form: hanya parameter yang dipakai jenis termin itu yang disimpan.
function buildTerm(f, spec) {
  if (!spec) {
    // Termin barang.
    return { type: f.termType, dpPct: f.termType === 'cad' ? 0 : f.termType === 'cbd' ? 100 : f.dpPct };
  }
  const t = { type: f.termType };
  if (spec.fields.includes('dp')) t.dpPct = f.dpPct;
  if (spec.fields.includes('terms')) {
    t.terms = f.terms;
    t.termPcts = f.termPcts;
  }
  if (spec.fields.includes('retention')) {
    t.retentionPct = f.retentionPct;
    t.retentionMonths = f.retentionMonths;
  }
  if (spec.fields.includes('period')) {
    t.period = f.period;
    t.periods = f.periods;
  }
  if (spec.fields.includes('due')) t.dueDays = f.dueDays;
  return t;
}

// --- Penawaran vendor ------------------------------------------------------------------------
export function QuoteModal({ opened, onClose, fpbj, pb, repeatVendorId, editing, single }) {
  // Permintaan yang isinya jasa semua jadi SPK, jadi termin bayarnya pakai katalog jasa.
  const isJasa = poAllJasa(fpbj);
  // Mode ubah: formulir terisi dari penawaran yang sudah ada.
  const [vendorId, setVendorId] = useState(editing?.vendorId ?? repeatVendorId ?? null);
  const [f, setF] = useState(() => ({
    no: editing?.no ?? '',
    validUntil: editing?.validUntil ?? addDays(TODAY, 14),
    desc: editing?.desc ?? '',
    file: editing?.file ?? '',
    termType: editing?.term?.type ?? (isJasa ? 'postpaid' : 'cad'),
    dpPct: editing?.term?.dpPct > 0 && editing?.term?.dpPct < 100 ? editing.term.dpPct : 30,
    dueDays: editing?.term?.dueDays ?? 30,
    terms: editing?.term?.terms ?? 3,
    termPcts: editing?.term?.termPcts ?? evenPcts(editing?.term?.terms ?? 3),
    retentionPct: editing?.term?.retentionPct ?? 5,
    retentionMonths: editing?.term?.retentionMonths ?? 3,
    period: editing?.term?.period ?? 'bulan',
    periods: editing?.term?.periods ?? 12,
    lead: editing?.lead ?? '',
    ...parseWarranty(editing?.warranty),
  }));
  const [lines, setLines] = useState(() =>
    Object.fromEntries(
      fpbj.items.map((i) => {
        const l = editing?.lines.find((x) => x.itemId === i.id);
        return [i.id, { price: l?.price ?? 0, spec: l?.spec ?? '', fit: l?.fit ?? 'sesuai', taxes: lineTaxes(editing, l) }];
      }),
    ),
  );
  // Saklar harga: berlaku untuk semua item ber-PPN; disimpan per item sebagai 'ppn' atau 'ppn_incl'.
  const [ppnIncl, setPpnIncl] = useState(() => Object.values(lines).some((l) => l.taxes.includes('ppn_incl')));
  const [sub, setSub] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const setLine = (id, p) => setLines((l) => ({ ...l, [id]: { ...l[id], ...p } }));

  // Spesifikasi termin yang sedang dipilih; `fields` menentukan isian tambahan yang wajib.
  const spec = isJasa ? serviceTermOf(f.termType) : null;
  const needs = (key) => !!spec?.fields.includes(key);
  const pcts = f.termPcts.slice(0, f.terms);
  const pctSum = Math.round(pcts.reduce((n, p) => n + (Number(p) || 0), 0) * 10) / 10;
  // Nilai yang dibagi ke termin: total penawaran dikurangi uang muka dan retensi.
  const quoteGross = fpbj.items.reduce((n, i) => n + i.qty * (lines[i.id]?.price || 0), 0);
  const base = scheduleBase(quoteGross, buildTerm(f, spec));
  const setPct = (k, v) => setF((x) => ({ ...x, termPcts: x.termPcts.map((p, i) => (i === k ? Number(v) || 0 : p)) }));

  const usedVendors = fpbj.quotes.filter((q) => q.id !== editing?.id).map((q) => q.vendorId);
  const vendorData = pb.vendors
    .filter((v) => !usedVendors.includes(v.id) || v.id === vendorId)
    .map((v) => ({ value: v.id, label: v.name }));
  const errors = {
    vendor: !vendorId && 'Vendor wajib dipilih',
    no: !f.no.trim() && 'No. penawaran wajib diisi',
    file: !f.file && 'Berkas penawaran wajib diunggah',
    validUntil: !f.validUntil && 'Masa berlaku wajib diisi',
    lead: (f.lead === '' || f.lead == null) && `Estimasi ${isJasa ? 'pengerjaan' : 'pengiriman'} wajib diisi`,
    dp: ((!isJasa && f.termType === 'dp') || needs('dp')) && !(f.dpPct > 0 && f.dpPct < 100) && 'DP harus 1-99%',
    terms: needs('terms') && !(f.terms >= 2) && 'Termin progres minimal 2',
    pcts: needs('terms') && f.terms >= 2 && Math.abs(pctSum - 100) > 0.05 && `Total bobot termin harus 100% (sekarang ${pctSum}%)`,
    retention: needs('retention') && !(f.retentionPct > 0 && f.retentionMonths > 0) && 'Retensi dan masa pemeliharaan wajib diisi',
    periods: needs('period') && !(f.periods >= 1) && 'Jumlah periode minimal 1',
    prices: fpbj.items.some((i) => !(lines[i.id].price > 0)) && 'Isi harga untuk semua item',
    specs: fpbj.items.some((i) => !lines[i.id].spec.trim()) && 'Isi spesifikasi yang ditawarkan untuk semua item',
  };
  const submit = () => {
    setSub(true);
    if (Object.values(errors).some(Boolean)) return;
    const quote = {
      id: editing?.id ?? uid('q'),
      vendorId,
      no: f.no,
      validUntil: f.validUntil,
      desc: f.desc,
      file: f.file,
      term: buildTerm(f, spec),
      lead: Number(f.lead),
      warranty: f.warrantyValue > 0 ? `${f.warrantyValue} ${f.warrantyUnit}` : '',
      lines: fpbj.items.map((i) => ({
        itemId: i.id,
        ...lines[i.id],
        taxes: lines[i.id].taxes.map((t) => (t === 'ppn' || t === 'ppn_incl' ? (ppnIncl ? 'ppn_incl' : 'ppn') : t)),
      })),
    };
    pb.update('fpbj', fpbj.id, (d) =>
      editing
        ? {
            ...d,
            quotes: d.quotes.map((q) => (q.id === editing.id ? quote : q)),
            // Harga final diisi ulang dari penawaran yang baru.
            procurement: { ...d.procurement, winners: {}, finals: {} },
          }
        : { ...d, quotes: [...d.quotes, quote] },
    );
    toast(editing ? 'Penawaran vendor diperbarui.' : 'Penawaran vendor ditambahkan.');
    onClose();
  };

  return (
    <>
      <FormModal
        opened={opened}
        onClose={onClose}
        size={860}
        icon={FileText}
        title={editing ? 'Ubah penawaran vendor' : 'Tambah penawaran vendor'}
        subtitle={fpbj.number}
        footer={
          <>
            <Cancel onClick={onClose} />
            <Button radius="md" onClick={submit}>
              {editing ? 'Simpan perubahan' : 'Simpan penawaran'}
            </Button>
          </>
        }
      >
        <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }}>Informasi penawaran</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
              label="Vendor"
              withAsterisk
              size="sm"
              radius="md"
              searchable
              data={vendorData}
              value={vendorId}
              disabled={!!repeatVendorId}
              error={sub && errors.vendor}
              onChange={setVendorId}
              placeholder="Pilih vendor"
            />
          <TextInput label="No. penawaran" placeholder="Contoh: QT/2026/11/045" withAsterisk size="sm" radius="md" value={f.no} error={sub && errors.no} onChange={(e) => set({ no: e.currentTarget.value })} />
          <DateField label="Berlaku s/d" withAsterisk size="sm" radius="md" min={TODAY} value={f.validUntil} error={sub && errors.validUntil} onChange={(e) => set({ validUntil: e.currentTarget.value })} />
          <NumberField label={`Estimasi ${isJasa ? 'pengerjaan' : 'pengiriman'} (hari)`} withAsterisk size="sm" radius="md" min={0} placeholder="Contoh: 14" value={f.lead} error={sub && errors.lead} onChange={(v) => set({ lead: v === '' ? '' : Number(v) })} />
        </SimpleGrid>

        <Box>
          <FileField label="Berkas penawaran" withAsterisk value={f.file} error={sub && errors.file} onChange={(file) => set({ file })} />
        </Box>

        <Group justify="space-between" mt="xs">
          <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }}>Harga per item</Text>
          <Switch size="sm" label="Harga sudah termasuk PPN" checked={ppnIncl} onChange={(e) => setPpnIncl(e.currentTarget.checked)} />
        </Group>
        {/* Item lebar di kiri; harga, pajak, dan kesesuaian ringkas di kanan; spesifikasi satu baris penuh di bawahnya. */}
        <Box style={tableFrame}>
          {(() => {
            const cols = `minmax(0, 1fr) 150px 140px${single ? '' : ' 140px'}`;
            const headCell = { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600, color: 'var(--mantine-color-slate-7)', whiteSpace: 'nowrap' };
            return (
              <Box miw={single ? 600 : 740}>
                <Box px="sm" py={8} bg="slate.0" style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 'var(--mantine-spacing-sm)', borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                  <Text style={headCell}>Item</Text>
                  <Text style={headCell}>Harga satuan <span style={{ color: 'var(--mantine-color-red-6)' }}>*</span></Text>
                  <Text style={headCell}>Pajak</Text>
                  {!single && <Text style={headCell}>Kesesuaian</Text>}
                </Box>
                {fpbj.items.map((i, idx) => (
                  <Box key={i.id} px="sm" py="sm" style={{ borderTop: idx ? '1px solid var(--mantine-color-gray-2)' : undefined }}>
                    <Box style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 'var(--mantine-spacing-sm)', alignItems: 'center' }}>
                      <Box style={{ minWidth: 0 }}>
                        <Text fz="sm" fw={600}>{i.desc}</Text>
                        <Text fz={11} c="slate.6">{i.qty} {i.unit} · estimasi {rupiah(i.estPrice)}</Text>
                      </Box>
                      <NumberField size="xs" radius="md" money prefix="Rp " aria-label={`Harga satuan ${i.desc}`} value={lines[i.id].price} onChange={(v) => setLine(i.id, { price: Number(v) || 0 })} />
                      <Select
                        size="xs"
                        radius="md"
                        allowDeselect={false}
                        aria-label={`Pajak ${i.desc}`}
                        data={TAX_OPTIONS}
                        value={lines[i.id].taxes[0] === 'ppn_incl' ? 'ppn' : lines[i.id].taxes[0] ?? 'none'}
                        onChange={(v) => setLine(i.id, { taxes: v === 'none' ? [] : [v] })}
                      />
                      {!single && <Select size="xs" radius="md" allowDeselect={false} aria-label={`Kesesuaian ${i.desc}`} data={fitOptions} value={lines[i.id].fit} onChange={(v) => setLine(i.id, { fit: v })} />}
                    </Box>
                    <Text mt={8} mb={4} fz={11} fw={600} c="slate.7">Spesifikasi ditawarkan <span style={{ color: 'var(--mantine-color-red-6)' }}>*</span></Text>
                    <TextInput size="xs" radius="md" aria-label={`Spesifikasi ${i.desc}`} placeholder="Contoh: Putih, 500 lembar per rim" value={lines[i.id].spec} error={sub && !lines[i.id].spec.trim()} onChange={(e) => setLine(i.id, { spec: e.currentTarget.value })} />
                  </Box>
                ))}
              </Box>
            );
          })()}
        </Box>
        {sub && (errors.prices || errors.specs) && <Text fz="xs" c="red.7">{errors.prices || errors.specs}</Text>}

        <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }} mt="xs">Ketentuan</Text>
        {isJasa ? (
          <>
            {/* Permintaan jasa → SPK: terminnya mengikuti penyelesaian pekerjaan, bukan pengiriman. */}
            <Select
              label="Termin bayar"
              withAsterisk
              size="sm"
              radius="md"
              allowDeselect={false}
              data={serviceTerms.map((t) => ({ value: t.value, label: t.label }))}
              description={spec ? `${spec.hint} · contoh: ${spec.example}` : undefined}
              value={f.termType}
              onChange={(v) => set({ termType: v })}
            />
            {spec?.fields.length > 0 && (
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
                {needs('dp') && (
                  <NumberField label="Uang muka (%)" withAsterisk size="sm" radius="md" min={1} max={99} clampBehavior="strict" error={sub && errors.dp} value={f.dpPct} onChange={(v) => set({ dpPct: Number(v) || 0 })} />
                )}
                {needs('terms') && (
                  <NumberField
                    label="Jumlah termin"
                    withAsterisk
                    size="sm"
                    radius="md"
                    min={2}
                    max={24}
                    clampBehavior="strict"
                    error={sub && errors.terms}
                    value={f.terms}
                    onChange={(v) => {
                      const n = Math.min(Math.max(Number(v) || 0, 1), 24);
                      set({ terms: n, termPcts: evenPcts(n) });
                    }}
                  />
                )}
                {needs('retention') && (
                  <>
                    <NumberField label="Retensi (%)" withAsterisk size="sm" radius="md" min={1} max={20} clampBehavior="strict" error={sub && errors.retention} value={f.retentionPct} onChange={(v) => set({ retentionPct: Number(v) || 0 })} />
                    <NumberField label="Masa pemeliharaan (bulan)" withAsterisk size="sm" radius="md" min={1} max={36} clampBehavior="strict" value={f.retentionMonths} onChange={(v) => set({ retentionMonths: Number(v) || 0 })} />
                  </>
                )}
                {needs('period') && (
                  <>
                    <Select label="Periode" size="sm" radius="md" allowDeselect={false} data={periodOptions} value={f.period} onChange={(v) => set({ period: v })} />
                    <NumberField label="Jumlah periode" withAsterisk size="sm" radius="md" min={1} max={60} clampBehavior="strict" error={sub && errors.periods} value={f.periods} onChange={(v) => set({ periods: Number(v) || 0 })} />
                  </>
                )}
                {needs('due') && (
                  <NumberField label="Jatuh tempo faktur (hari)" size="sm" radius="md" min={0} max={180} clampBehavior="strict" value={f.dueDays} onChange={(v) => set({ dueDays: Number(v) || 0 })} />
                )}
              </SimpleGrid>
            )}

            {needs('terms') && f.terms >= 2 && (
              <Box style={tableFrame}>
                <Group justify="space-between" px="md" py={8} bg="slate.0" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                  <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.4 }}>Bobot tiap termin</Text>
                  <Button size="compact-xs" radius="md" variant="subtle" onClick={() => set({ termPcts: evenPcts(f.terms) })}>Bagi rata</Button>
                </Group>
                <Table verticalSpacing={6} horizontalSpacing="sm" styles={th}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Termin</Table.Th>
                      <Table.Th w={120} ta="right">Bobot (%)</Table.Th>
                      <Table.Th ta="right">Nilai</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {pcts.map((p, k) => (
                      <Table.Tr key={k}>
                        <Table.Td fz="sm" fw={600}>Termin {k + 1}</Table.Td>
                        <Table.Td>
                          <NumberField size="xs" radius="md" min={0} max={100} clampBehavior="strict" decimalScale={1} value={p} onChange={(v) => setPct(k, v)} />
                        </Table.Td>
                        <Table.Td ta="right" fz="sm">{base > 0 ? rupiah(Math.round((base * (Number(p) || 0)) / 100)) : '—'}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                <Group justify="space-between" px="md" py={8} style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                  <Text fz="xs" c="slate.6">
                    {scheduleExcludesDp(buildTerm(f, spec))
                      ? `Dihitung dari nilai setelah dikurangi uang muka ${f.dpPct}%`
                      : 'Dihitung dari nilai penawaran'}
                    {needs('retention') ? ` dan retensi ${f.retentionPct}%` : ''}
                    {base > 0 ? ` · ${rupiah(base)}` : ''}
                  </Text>
                  <Text fz="xs" fw={700} c={Math.abs(pctSum - 100) > 0.05 ? 'red.7' : 'slate.9'}>Total {pctSum}%</Text>
                </Group>
              </Box>
            )}

            <Input.Wrapper label="Garansi / masa layanan" size="sm">
              <Group gap="xs" wrap="nowrap">
                <NumberField size="sm" radius="md" min={0} placeholder="Contoh: 12" flex={1} value={f.warrantyValue} onChange={(v) => set({ warrantyValue: Number(v) || 0 })} />
                <Select size="sm" radius="md" w={120} allowDeselect={false} aria-label="Satuan garansi" data={[{ value: 'hari', label: 'Hari' }, { value: 'bulan', label: 'Bulan' }, { value: 'tahun', label: 'Tahun' }]} value={f.warrantyUnit} onChange={(v) => set({ warrantyUnit: v })} />
              </Group>
            </Input.Wrapper>
          </>
        ) : (
        <SimpleGrid cols={{ base: 1, sm: f.termType === 'dp' ? 3 : 2 }}>
          <Select label="Termin bayar" withAsterisk size="sm" radius="md" allowDeselect={false} data={dpOptions} value={f.termType} onChange={(v) => set({ termType: v })} />
          {f.termType === 'dp' && (
            <NumberField label="DP (%)" withAsterisk size="sm" radius="md" min={1} max={99} error={sub && errors.dp} value={f.dpPct} onChange={(v) => set({ dpPct: Number(v) || 0 })} />
          )}
          <Input.Wrapper label="Garansi" size="sm">
            <Group gap="xs" wrap="nowrap">
              <NumberField size="sm" radius="md" min={0} placeholder="Contoh: 12" flex={1} value={f.warrantyValue} onChange={(v) => set({ warrantyValue: Number(v) || 0 })} />
              <Select size="sm" radius="md" w={120} allowDeselect={false} aria-label="Satuan garansi" data={[{ value: 'hari', label: 'Hari' }, { value: 'bulan', label: 'Bulan' }, { value: 'tahun', label: 'Tahun' }]} value={f.warrantyUnit} onChange={(v) => set({ warrantyUnit: v })} />
            </Group>
          </Input.Wrapper>
        </SimpleGrid>
        )}
        {sub && (errors.dp || errors.terms || errors.pcts || errors.retention || errors.periods) && (
          <Text fz="xs" c="red.7">{errors.dp || errors.terms || errors.pcts || errors.retention || errors.periods}</Text>
        )}
        <Textarea label="Deskripsi penawaran" placeholder={isJasa ? 'Contoh: Sudah termasuk material dan tenaga kerja' : 'Contoh: Penawaran sudah termasuk pengiriman ke kantor'} size="sm" radius="md" minRows={2} autosize value={f.desc} onChange={(e) => set({ desc: e.currentTarget.value })} />
      </FormModal>
    </>
  );
}

// --- Penerimaan (FPB barang / BAST jasa) ---------------------------------------------------------
export function ReceiptModal({ opened, onClose, po, pb }) {
  const [date, setDate] = useState(TODAY);
  const [doNo, setDoNo] = useState('');
  const [note, setNote] = useState('');
  // SPK bertermin diserahterimakan per termin, jadi barisnya mulai kosong — PIC mengisi yang selesai saja.
  // Pesanan biasa tetap terisi penuh karena umumnya diterima sekaligus.
  const scheduled = scheduleCount(po.term) > 1 || po.items.some((i) => i.unit === 'retensi');
  const [rows, setRows] = useState(() =>
    Object.fromEntries(po.items.map((i) => [i.id, { qty: scheduled ? 0 : remainingQty(po, i.id, pb.receipts), rejected: 0 }])),
  );
  const [sub, setSub] = useState(false);
  const isJasa = poAllJasa(po);
  const mixed = !isJasa && !poAllBarang(po);
  const total = po.items.reduce((n, i) => n + (rows[i.id].qty || 0), 0);
  const err = {
    doNo: !doNo.trim() && (isJasa ? 'No. BAST wajib diisi' : mixed ? 'No. surat jalan / BAST wajib diisi' : 'Surat jalan wajib diisi'),
    qty: total <= 0 && 'Isi minimal satu qty diterima',
  };
  const submit = () => {
    setSub(true);
    if (err.doNo || err.qty) return;
    const lines = po.items
      .map((i) => ({ itemId: i.id, qty: rows[i.id].qty || 0, rejected: rows[i.id].rejected || 0 }))
      .filter((l) => l.qty > 0 || l.rejected > 0);
    const prefix = lines.every((l) => itemKind(po, l.itemId) === 'jasa') ? 'BAST' : 'FPB';
    pb.add('receipts', {
      id: uid('fpb'),
      number: nextNumber(prefix, pb.receipts),
      poId: po.id,
      vendorId: po.vendorId,
      date,
      doNumber: doNo,
      kind: prefix === 'BAST' ? 'jasa' : 'barang',
      // BAST jasa perlu persetujuan Atasan sebelum bisa difaktur (spesifikasi 2.2 & 3.8).
      // FPB barang langsung terkonfirmasi: approval Kepala Gudang opsional dan nonaktif default.
      status: prefix === 'BAST' ? 'draf' : 'dikonfirmasi',
      createdBy: personLabel(pb.role),
      lines,
      note,
    });
    toast(
      prefix === 'BAST'
        ? 'BAST dicatat. Menunggu persetujuan atasan sebelum bisa difaktur.'
        : `${prefix} dicatat. Sisa qty yang belum diterima tetap terbuka.`,
    );
    onClose();
  };
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={760}
      icon={Truck}
      title={isJasa ? 'Catat serah terima jasa (BAST)' : mixed ? 'Catat penerimaan (FPB / BAST)' : 'Catat penerimaan barang (FPB)'}
      subtitle={`${po.number} · ${pb.vendorsById[po.vendorId]?.name}`}
      footer={
        <>
          <Cancel onClick={onClose} />
          <Button radius="md" onClick={submit}>
            Simpan {isJasa ? 'BAST' : mixed ? 'penerimaan' : 'FPB'}
          </Button>
        </>
      }
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <DateField label="Tanggal terima" size="sm" radius="md" value={date} onChange={(e) => setDate(e.currentTarget.value)} />
        <TextInput label={isJasa ? 'No. BAST / berkas bertanda tangan' : mixed ? 'No. surat jalan / BAST' : 'No. surat jalan'} placeholder={isJasa ? 'Contoh: BAST/2026/11/007' : 'Contoh: SJ-20261104-01'} withAsterisk size="sm" radius="md" value={doNo} error={sub && err.doNo} onChange={(e) => setDoNo(e.currentTarget.value)} />
      </SimpleGrid>
      <Box style={tableFrame}>
        <Table verticalSpacing="xs" horizontalSpacing="sm" miw={620} styles={th}>
          <Table.Thead bg="slate.0">
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th ta="right">Dipesan</Table.Th>
              <Table.Th ta="right">Sisa setelah ini</Table.Th>
              <Table.Th w={130}>{isJasa ? 'Progres diterima' : 'Qty diterima'}</Table.Th>
              <Table.Th w={110}>Ditolak</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {po.items.map((i) => {
              const rem = remainingQty(po, i.id, pb.receipts);
              // Diterima + ditolak tidak boleh melebihi sisa pesanan: tiap kolom dibatasi sisa dikurangi kolom satunya.
              // Kolom Sisa ikut berkurang saat diketik, dan kolom yang jatahnya habis dimatikan sampai kolom lain dikurangi.
              const row = rows[i.id];
              const maxQty = Math.max(rem - (row.rejected || 0), 0);
              const maxRejected = Math.max(rem - (row.qty || 0), 0);
              const sisa = Math.max(rem - (row.qty || 0) - (row.rejected || 0), 0);
              const setCell = (key, v, cap) =>
                setRows((r) => ({ ...r, [i.id]: { ...r[i.id], [key]: Math.min(Math.max(Number(v) || 0, 0), cap) } }));
              return (
                <Table.Tr key={i.id}>
                  <Table.Td fz="sm" fw={600}>
                    {i.desc}
                    {mixed && <Badge size="xs" radius="sm" variant="light" color={i.kind === 'jasa' ? 'grape' : 'slate'} ml={6} tt="none">{i.kind === 'jasa' ? 'Jasa' : 'Barang'}</Badge>}
                  </Table.Td>
                  <Table.Td ta="right" fz="sm">{i.qty} {i.unit}</Table.Td>
                  <Table.Td ta="right" fz="sm" fw={sisa === 0 ? 700 : 400} c={sisa === 0 ? 'green.8' : undefined}>{sisa} {i.unit}</Table.Td>
                  <Table.Td>
                    <NumberField size="xs" radius="md" min={0} max={maxQty} clampBehavior="strict" disabled={rem === 0 || maxQty === 0} value={row.qty} onChange={(v) => setCell('qty', v, maxQty)} />
                  </Table.Td>
                  <Table.Td>
                    <NumberField size="xs" radius="md" min={0} max={maxRejected} clampBehavior="strict" disabled={rem === 0 || maxRejected === 0} value={row.rejected} onChange={(v) => setCell('rejected', v, maxRejected)} />
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Box>
      {sub && err.qty && <Text fz="xs" c="red.7">{err.qty}</Text>}
      <Textarea label="Catatan kondisi" placeholder="Contoh: Dus penyok, isi dalam kondisi baik" size="sm" radius="md" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      <Callout>
        Diterima dan ditolak dijumlah tidak boleh melebihi sisa pesanan. Qty ditolak tidak dihitung sebagai diterima,
        jadi sisa PO tetap terbuka. Tidak perlu dokumen retur bila faktur belum dibuat.
      </Callout>
    </FormModal>
  );
}

// --- Faktur pembelian ----------------------------------------------------------------------------
export function InvoiceModal({ opened, onClose, receiptIds, pb }) {
  const receipts = receiptIds.map((id) => pb.receiptsById[id]).filter(Boolean);
  const vendor = pb.vendorsById[receipts[0]?.vendorId];
  const [vendorNo, setVendorNo] = useState('');
  const [date, setDate] = useState(TODAY);
  // Jatuh tempo mengikuti termin pesanan kalau diatur di penawaran (jasa), kalau tidak pakai 30 hari.
  const termDue = pb.posById[receipts[0]?.poId]?.term?.dueDays;
  const [dueDate, setDueDate] = useState(addDays(TODAY, termDue > 0 ? termDue : 30));
  const [pphInput, setPphInput] = useState(null);
  const [inv, setInv] = useState('');
  const [tax, setTax] = useState('');
  const [sub, setSub] = useState(false);
  const base = receipts.flatMap((r) => {
    const po = pb.posById[r.poId];
    return uninvoicedLines(r, pb.invoices).map((l) => ({
      key: `${r.id}:${l.itemId}`,
      receiptId: r.id,
      receiptNo: r.number,
      poId: po.id,
      itemId: l.itemId,
      desc: po.items.find((i) => i.id === l.itemId).desc,
      unit: po.items.find((i) => i.id === l.itemId).unit,
      price: po.items.find((i) => i.id === l.itemId).price,
      ppnRate: po.items.find((i) => i.id === l.itemId).ppnRate,
      pphRate: po.items.find((i) => i.id === l.itemId).pphRate ?? 0,
      open: l.open,
    }));
  });
  const [qtys, setQtys] = useState(() => Object.fromEntries(base.map((b) => [b.key, b.open])));
  const lines = base.map((b) => ({ ...b, qty: qtys[b.key] ?? 0 }));
  // PPh awal mengikuti pajak item di PO (rata-rata tertimbang bila tarifnya berbeda); masih bisa diubah.
  const active = lines.filter((l) => l.qty > 0);
  const baseDpp = active.reduce((n, l) => n + l.qty * l.price, 0);
  const autoPph = baseDpp ? Math.round((active.reduce((n, l) => n + l.qty * l.price * l.pphRate, 0) / baseDpp) * 10000) / 100 : 0;
  const pph = pphInput ?? autoPph;
  const draft = { lines: lines.map((l) => ({ ...l })), pphPct: pph, poId: lines[0]?.poId };
  const dpp = invDpp(draft);
  const ppn = invPpn(draft);
  const pphVal = Math.round((dpp * (pph || 0)) / 100);
  const dpDeduct = invTotals({ ...draft }, { pos: pb.pos, prs: pb.prs, returns: [] }).dp;
  const total = dpp + ppn - pphVal - dpDeduct;
  const err = {
    no: !vendorNo.trim() && 'No. invoice vendor wajib diisi',
    files: (!inv || !tax) && 'Unggah invoice dan faktur pajak',
    qty: lines.every((l) => !l.qty) && 'Isi minimal satu qty',
  };
  const submit = () => {
    setSub(true);
    if (Object.values(err).some(Boolean)) return;
    pb.add('invoices', {
      id: uid('fkt'),
      number: nextNumber('FKT', pb.invoices),
      vendorNo,
      poId: lines[0].poId,
      vendorId: vendor.id,
      date,
      dueDate,
      lines: lines.filter((l) => l.qty > 0).map((l) => ({ receiptId: l.receiptId, poId: l.poId, itemId: l.itemId, qty: l.qty, price: l.price, ppnRate: l.ppnRate })),
      pphPct: pph || 0,
      files: [inv, tax],
    });
    toast('Faktur dibuat. Hutang usaha tercatat.');
    onClose();
  };
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={860}
      icon={Invoice}
      title="Buat faktur pembelian"
      subtitle={`${vendor?.name} · dari ${receipts.map((r) => r.number).join(', ')}`}
      footer={
        <>
          <Cancel onClick={onClose} />
          <Button radius="md" onClick={submit}>
            Simpan faktur
          </Button>
        </>
      }
    >
      {/* Baris pertama: identitas dan angka faktur — potongan PPh sebaris dengan tanggal jatuh tempo. */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <TextInput label="No. invoice vendor" placeholder="Contoh: INV-2026-0123" withAsterisk size="sm" radius="md" value={vendorNo} error={sub && err.no} onChange={(e) => setVendorNo(e.currentTarget.value)} />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 3 }}>
          <DateField label="Tanggal faktur" size="sm" radius="md" value={date} onChange={(e) => setDate(e.currentTarget.value)} />
        </Grid.Col>
        <Grid.Col span={{ base: 6, sm: 3 }}>
          <DateField label="Jatuh tempo" size="sm" radius="md" min={date} value={dueDate} onChange={(e) => setDueDate(e.currentTarget.value)} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 2 }}>
          <NumberField label="Potongan PPh" suffix=" %" size="sm" radius="md" min={0} max={100} decimalScale={2} value={pph} onChange={(v) => setPphInput(Number(v) || 0)} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <FileField label="Invoice vendor" value={inv} onChange={setInv} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <FileField label="Faktur pajak" value={tax} onChange={setTax} />
        </Grid.Col>
      </Grid>
      {sub && err.files && <Text fz="xs" c="red.7">{err.files}</Text>}
      <Box style={tableFrame}>
        <Table verticalSpacing="xs" horizontalSpacing="sm" miw={720} styles={th}>
          <Table.Thead bg="slate.0">
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th>Penerimaan</Table.Th>
              <Table.Th ta="right">Belum difaktur</Table.Th>
              <Table.Th w={120}>Qty faktur</Table.Th>
              <Table.Th ta="right">Harga PO</Table.Th>
              <Table.Th ta="right">Jumlah</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lines.map((l) => (
              <Table.Tr key={l.key}>
                <Table.Td fz="sm" fw={600}>{l.desc}</Table.Td>
                <Table.Td fz="xs" c="slate.7">{l.receiptNo}</Table.Td>
                <Table.Td ta="right" fz="sm">{l.open} {l.unit}</Table.Td>
                <Table.Td>
                  <NumberField size="xs" radius="md" min={0} max={l.open} value={l.qty} onChange={(v) => setQtys((q) => ({ ...q, [l.key]: Math.min(Number(v) || 0, l.open) }))} />
                </Table.Td>
                <Table.Td ta="right" fz="sm">{rupiah(l.price)}</Table.Td>
                <Table.Td ta="right" fz="sm" fw={600}>{rupiah(l.qty * l.price)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
      {sub && err.qty && <Text fz="xs" c="red.7">{err.qty}</Text>}
      <Callout tone="warn" title="Pencocokan 3 arah">
        Qty faktur dibatasi qty diterima (FPB/BAST) dan harga dikunci sama dengan PO.
      </Callout>
      <Box p="sm" bg="slate.0" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <Field label="DPP">{rupiah(dpp)}</Field>
          <Field label={ppnLabel(lines.filter((l) => l.qty > 0))}>+{rupiah(ppn)}</Field>
          <Field label="Potongan PPh" valueProps={{ c: 'red.7' }}>-{rupiah(pphVal)}</Field>
          <Field label="Potongan uang muka" valueProps={{ c: 'red.7' }}>-{rupiah(dpDeduct)}</Field>
        </SimpleGrid>
        <Group justify="space-between" mt="sm" pt="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
          <Text fz="sm" fw={700}>Hutang usaha</Text>
          <Text fz="md" fw={700}>{rupiah(total)}</Text>
        </Group>
      </Box>
    </FormModal>
  );
}

// --- Payment Request (DP/CBD atau pelunasan) ---------------------------------------------------------
// Strip "Dibayarkan ke": dipakai PR DP maupun PR pelunasan supaya rekening tujuan
// selalu terbaca sebagai tiga kolom pendek, bukan satu baris panjang yang terpotong.
function PayeeStrip({ vendor }) {
  const b = bankOf(vendor);
  const cells = [
    ['Vendor', vendor?.name],
    ['Bank', b?.bank],
    ['Nomor rekening', b?.number],
  ];
  return (
    <Box style={tableFrame}>
      <Box px="md" py={8} bg="slate.0" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.4 }}>Dibayarkan ke</Text>
      </Box>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={0}>
        {cells.map(([k, v], i) => (
          <Box key={k} px="md" py={9} style={{ minWidth: 0, borderLeft: i ? '1px solid var(--mantine-color-gray-2)' : undefined }}>
            <Text fz={11} c="slate.6">{k}</Text>
            <Text fz="sm" fw={700} c="slate.9" truncate>{v || '—'}</Text>
          </Box>
        ))}
      </SimpleGrid>
      {b?.holder && b.holder !== vendor?.name && (
        <Box px="md" py={8} style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
          <Text fz={11} c="slate.6">Atas nama <Text span fz={11} fw={700} c="slate.9">{b.holder}</Text></Text>
        </Box>
      )}
    </Box>
  );
}

export function PrModal({ opened, onClose, kind, po, invoiceIds, pb }) {
  const isDp = kind === 'dp';
  const invs = (invoiceIds ?? []).map((id) => pb.invoicesById[id]).filter(Boolean);
  const totals = Object.fromEntries(invs.map((i) => [i.id, invTotals(i, pb.calc)]));
  const vendor = pb.vendorsById[isDp ? po.vendorId : invs[0]?.vendorId];
  const [date, setDate] = useState(TODAY);
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [dpAmount, setDpAmount] = useState(isDp ? poDpAmount(po) : 0);
  const [alloc, setAlloc] = useState(() => Object.fromEntries(invs.map((i) => [i.id, totals[i.id].free])));
  const [sub, setSub] = useState(false);
  const amount = isDp ? dpAmount : invs.reduce((n, i) => n + (alloc[i.id] || 0), 0);
  const totalFree = invs.reduce((n, i) => n + totals[i.id].free, 0);
  // Nominal DP diubah manual dari nilai uang muka pada PO: ditandai supaya tidak lewat tanpa disadari.
  const offBase = isDp && dpAmount !== poDpAmount(po);
  const err = {
    amount: amount <= 0 && 'Nominal wajib diisi',
    ref: isDp && !ref && 'Unggah invoice proforma',
  };
  const submit = () => {
    setSub(true);
    if (err.amount || err.ref) return;
    pb.add('prs', {
      id: uid('pr'),
      number: nextNumber('PR', pb.prs),
      kind,
      vendorId: vendor.id,
      poId: isDp ? po.id : invs[0].poId,
      invoiceIds: isDp ? [] : invs.map((i) => i.id),
      alloc: isDp ? undefined : alloc,
      amount,
      date,
      status: 'diajukan',
      // Dicatat untuk pemisahan tugas: pembuat PR tidak boleh menyetujui PR-nya sendiri.
      createdBy: personLabel(pb.role),
      note,
      ref,
    });
    toast('Payment Request diajukan ke approver.');
    onClose();
  };
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={640}
      icon={Wallet}
      title={isDp ? `Payment Request ${advanceLabel(po.term)}` : 'Payment Request pelunasan'}
      subtitle={isDp ? `${po.number} · ${vendor?.name}` : `${vendor?.name} · ${invs.map((i) => i.number).join(', ')}`}
      footer={
        <>
          <Cancel onClick={onClose} />
          <Button radius="md" onClick={submit}>Ajukan</Button>
        </>
      }
    >
      {isDp ? (
        <>
          {/* Urutan sama dengan PR pelunasan: rekening tujuan dulu, lalu isian, lalu total. */}
          <PayeeStrip vendor={vendor} />

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DateField label="Tanggal pengajuan" size="sm" radius="md" value={date} onChange={(e) => setDate(e.currentTarget.value)} />
            <Box>
              <NumberField label="Nominal diajukan" size="sm" radius="md" money prefix="Rp " value={dpAmount} error={sub && err.amount} onChange={(v) => setDpAmount(Number(v) || 0)} />
              {!sub || !err.amount ? (
                <Group gap={6} mt={4} wrap="nowrap">
                  <Text fz={11} c={offBase ? 'orange.8' : 'slate.6'} style={{ minWidth: 0 }}>
                    {advancePct(po.term) >= 100 ? 'Bayar penuh di muka' : `Uang muka ${advancePct(po.term)}%`} = {rupiah(poDpAmount(po))}
                  </Text>
                  {offBase && (
                    <Button size="compact-xs" radius="md" variant="subtle" onClick={() => setDpAmount(poDpAmount(po))}>
                      Pakai nilai ini
                    </Button>
                  )}
                </Group>
              ) : null}
            </Box>
          </SimpleGrid>

          <FileField label="Invoice proforma" value={ref} error={sub && err.ref} onChange={setRef} />

          <Group
            justify="space-between"
            px="md"
            py="sm"
            bg="primary.0"
            style={{ border: '1px solid var(--mantine-color-primary-1)', borderRadius: 'var(--mantine-radius-md)' }}
          >
            <Box>
              <Text fz={11} fw={600} c="primary.9">Total diajukan</Text>
              <Text fz={11} c="slate.6">{termText(po.term)} · dari total {poDocLabel(po)} {rupiah(poTotal(po))}</Text>
            </Box>
            <Text fz={22} fw={700} c="primary.9">{rupiah(amount)}</Text>
          </Group>
        </>
      ) : (
        <>
          {/* Rekening tujuan dulu, baru alokasi per faktur, lalu total — urutan sama dengan modal pembayaran. */}
          <PayeeStrip vendor={vendor} />

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <DateField label="Tanggal pengajuan" size="sm" radius="md" value={date} onChange={(e) => setDate(e.currentTarget.value)} />
            <Field label="Faktur dibayar">{`${invs.length} faktur · sisa hutang ${rupiah(totalFree)}`}</Field>
          </SimpleGrid>

          <Box>
            <Group justify="space-between" mb={6}>
              <Text fz="sm" fw={600} c="slate.9">Alokasi pembayaran</Text>
              <Group gap={4}>
                <Button size="compact-xs" radius="md" variant="subtle" onClick={() => setAlloc(Object.fromEntries(invs.map((i) => [i.id, totals[i.id].free])))}>Bayar penuh</Button>
                <Button size="compact-xs" radius="md" variant="subtle" color="slate" onClick={() => setAlloc(Object.fromEntries(invs.map((i) => [i.id, 0])))}>Kosongkan</Button>
              </Group>
            </Group>
            <Box style={tableFrame}>
              <Table verticalSpacing="xs" horizontalSpacing="sm" styles={th}>
                <Table.Thead bg="slate.0">
                  <Table.Tr>
                    <Table.Th>Faktur</Table.Th>
                    <Table.Th ta="right">Sisa hutang</Table.Th>
                    <Table.Th w={170} ta="right">Dibayar sekarang</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {invs.map((i) => {
                    const late = i.dueDate < TODAY;
                    return (
                      <Table.Tr key={i.id}>
                        <Table.Td fz="sm" fw={600}>
                          {i.number}
                          <Text fz={11} c={late ? 'red.7' : 'slate.6'} fw={late ? 600 : 400}>
                            {i.vendorNo ? `${i.vendorNo} · ` : ''}jatuh tempo {formatDate(i.dueDate)}{late ? ' · telat' : ''}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right" fz="sm">{rupiah(totals[i.id].free)}</Table.Td>
                        <Table.Td>
                          <NumberField size="xs" radius="md" money max={totals[i.id].free} clampBehavior="strict" prefix="Rp " value={alloc[i.id]} onChange={(v) => setAlloc((a) => ({ ...a, [i.id]: Math.min(Number(v) || 0, totals[i.id].free) }))} />
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Box>
          </Box>

          <Group
            justify="space-between"
            px="md"
            py="sm"
            bg="primary.0"
            style={{ border: '1px solid var(--mantine-color-primary-1)', borderRadius: 'var(--mantine-radius-md)' }}
          >
            <Box>
              <Text fz={11} fw={600} c="primary.9">Total diajukan</Text>
              <Text fz={11} c="slate.6">Sisa hutang setelah PR ini {rupiah(Math.max(totalFree - amount, 0))}</Text>
            </Box>
            <Text fz={22} fw={700} c="primary.9">{rupiah(amount)}</Text>
          </Group>
          {sub && err.amount && <Text fz="xs" c="red.7">{err.amount}</Text>}
        </>
      )}
      <Textarea label="Catatan" placeholder="Contoh: Mohon diproses sebelum akhir pekan" size="sm" radius="md" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
    </FormModal>
  );
}

// --- Finance membayar ----------------------------------------------------------------------------
// Rekening sumber pembayaran; di produksi diambil dari daftar akun Kas & Bank.
const SOURCE_ACCOUNTS = ['BCA 288-123-9001 · Kas Operasional', 'Mandiri 101-00-5577 · Kas Proyek', 'Kas kecil'];
export function PayModal({ opened, onClose, pr, pb }) {
  const vendor = pb.vendorsById[pr.vendorId];
  const bank = bankOf(vendor);
  const [proofs, setProofs] = useState(() => (pr.proof ? [pr.proof] : []));
  const [date, setDate] = useState(TODAY);
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  const [source, setSource] = useState(SOURCE_ACCOUNTS[0]);
  const [sub, setSub] = useState(false);
  // Pembayaran menerbitkan Payment Voucher (PV); Payment Request-nya ditandai dibayar dan ditautkan.
  const pay = () => {
    setSub(true);
    if (!proofs.length) return;
    const id = uid('pv');
    pb.add('vouchers', {
      id,
      number: nextNumber('PV', pb.vouchers),
      prIds: [pr.id],
      vendorId: pr.vendorId,
      date,
      amount: pr.amount,
      source,
      payRef: ref,
      proofs,
      note,
      paidBy: personLabel('kasir'),
    });
    pb.update('prs', pr.id, (d) => ({ ...d, status: 'dibayar', paidAt: date, voucherId: id }));
    toast('Pembayaran dicatat. Payment Voucher diterbitkan.');
    onClose();
  };
  const rowStyle = (i) => ({ borderTop: i ? '1px solid var(--mantine-color-gray-2)' : undefined });
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={620}
      icon={CurrencyCircleDollar}
      title="Bayar Payment Request"
      subtitle={`${pr.number} · ${vendor?.name}`}
      footer={
        <>
          <Cancel onClick={onClose} />
          <Button radius="md" onClick={pay}>Bayar &amp; terbitkan PV</Button>
        </>
      }
    >
      {/* Nominal ditonjolkan, lalu rekening tujuan lengkap supaya tidak salah transfer. */}
      <Group
        justify="space-between"
        px="md"
        py="sm"
        bg="primary.0"
        style={{ border: '1px solid var(--mantine-color-primary-1)', borderRadius: 'var(--mantine-radius-md)' }}
      >
        <Box>
          <Text fz={11} fw={600} c="primary.9">Nominal dibayar</Text>
          <Text fz={11} c="slate.6">{pr.kind === 'dp' ? 'Uang muka / CBD' : 'Pelunasan faktur'}</Text>
        </Box>
        <Text fz={22} fw={700} c="primary.9">{rupiah(pr.amount)}</Text>
      </Group>

      <Box style={tableFrame}>
        <Box px="md" py={8} bg="slate.0" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.4 }}>Rekening tujuan</Text>
        </Box>
        {bank ? (
          [
            ['Nama bank', bank.branch ? `${bank.bank} · ${bank.branch}` : bank.bank],
            ['Nomor rekening', bank.number],
            ['Atas nama', bank.holder],
          ].map(([k, v], i) => (
            <Group key={k} justify="space-between" wrap="nowrap" px="md" py={9} gap="md" style={rowStyle(i)}>
              <Text fz="xs" c="slate.6">{k}</Text>
              <Group gap={6} wrap="nowrap">
                <Text fz="sm" fw={700} c="slate.9">{v || '—'}</Text>
                {k === 'Nomor rekening' && v && <CopyIcon value={v} size={14} />}
              </Group>
            </Group>
          ))
        ) : (
          <Text fz="xs" c="slate.6" px="md" py="sm">Rekening vendor belum diisi di data kontak.</Text>
        )}
      </Box>

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <DateField label="Tanggal bayar" size="sm" radius="md" value={date} onChange={(e) => setDate(e.currentTarget.value)} />
        <TextInput label="No. referensi transfer" placeholder="Contoh: TRF-20261104-0098" size="sm" radius="md" value={ref} onChange={(e) => setRef(e.currentTarget.value)} />
      </SimpleGrid>
      <Select label="Dibayar dari" size="sm" radius="md" data={SOURCE_ACCOUNTS} value={source} onChange={(v) => setSource(v ?? SOURCE_ACCOUNTS[0])} allowDeselect={false} />

      <DropField
        label="Bukti transfer"
        multiple
        value={proofs}
        onChange={setProofs}
        error={sub && !proofs.length && 'Bukti transfer wajib diunggah'}
      />

      <Textarea label="Catatan pembayaran" placeholder="Opsional. Contoh: transfer dipecah dua kali karena limit harian." size="sm" radius="md" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
    </FormModal>
  );
}

// --- Retur pembelian ------------------------------------------------------------------------------
export function ReturnModal({ opened, onClose, invoice, pb }) {
  const po = pb.posById[invoice.poId];
  const [date, setDate] = useState(TODAY);
  const [reason, setReason] = useState('');
  const [settlement, setSettlement] = useState('potong');
  const rows = invoice.lines.map((l, idx) => ({ l, idx })).filter(({ l }) => itemKind(po, l.itemId) === 'barang').map(({ l, idx }) => {
    const item = po.items.find((i) => i.id === l.itemId);
    return {
      key: `${l.itemId}:${idx}`,
      itemId: l.itemId,
      desc: item.desc,
      unit: item.unit,
      price: l.price,
      rate: lineRate(l),
      max: Math.max(l.qty - returnedQty(invoice.id, l.itemId, pb.returns), 0),
    };
  });
  const [qtys, setQtys] = useState({});
  const [sub, setSub] = useState(false);
  const picked = rows.filter((r) => (qtys[r.key] || 0) > 0);
  const errors = { reason: !reason.trim() && 'Alasan retur wajib diisi', qty: !picked.length && 'Isi qty retur minimal satu item' };
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={720}
      icon={ArrowCounterClockwise}
      title="Retur pembelian"
      subtitle={`${invoice.number} · ${pb.vendorsById[invoice.vendorId]?.name}`}
      footer={
        <>
          <Cancel onClick={onClose} />
          <Button
            radius="md"
            onClick={() => {
              setSub(true);
              if (errors.reason || errors.qty) return;
              pb.add('returns', {
                id: uid('rtr'),
                number: nextNumber('RTR', pb.returns),
                invoiceId: invoice.id,
                vendorId: invoice.vendorId,
                date,
                reason,
                settlement,
                status: 'selesai',
                lines: picked.map((r) => ({ itemId: r.itemId, qty: qtys[r.key], price: r.price })),
              });
              toast('Retur dicatat dan hutang disesuaikan.');
              onClose();
            }}
          >
            Simpan retur
          </Button>
        </>
      }
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <DateField label="Tanggal retur" size="sm" radius="md" value={date} onChange={(e) => setDate(e.currentTarget.value)} />
        <Select
          label="Penyelesaian"
          size="sm"
          radius="md"
          allowDeselect={false}
          value={settlement}
          onChange={setSettlement}
          data={[
            { value: 'potong', label: 'Potong hutang faktur' },
            { value: 'kredit', label: 'Kredit vendor (dipakai di pembelian berikutnya)' },
            { value: 'refund', label: 'Refund dari vendor' },
          ]}
        />
      </SimpleGrid>
      <TextInput label="Alasan retur" placeholder="Contoh: Barang rusak saat diterima" withAsterisk size="sm" radius="md" value={reason} error={sub && errors.reason} onChange={(e) => setReason(e.currentTarget.value)} />
      <Box style={tableFrame}>
        <Table verticalSpacing="xs" horizontalSpacing="sm" styles={th}>
          <Table.Thead bg="slate.0">
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th ta="right">Bisa diretur</Table.Th>
              <Table.Th w={120}>Qty retur</Table.Th>
              <Table.Th ta="right">Nilai</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.key}>
                <Table.Td fz="sm" fw={600}>{r.desc}</Table.Td>
                <Table.Td ta="right" fz="sm">{r.max} {r.unit}</Table.Td>
                <Table.Td>
                  <NumberField size="xs" radius="md" min={0} max={r.max} disabled={r.max === 0} value={qtys[r.key] ?? 0} onChange={(v) => setQtys((q) => ({ ...q, [r.key]: Math.min(Number(v) || 0, r.max) }))} />
                </Table.Td>
                <Table.Td ta="right" fz="sm">{rupiah((qtys[r.key] || 0) * r.price)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
      {sub && errors.qty && <Text fz="xs" c="red.7">{errors.qty}</Text>}
      <Group justify="space-between">
        <Text fz="sm" fw={700}>Nilai retur (termasuk PPN)</Text>
        <Text fz="md" fw={700}>{rupiah(Math.round(picked.reduce((n, r) => n + qtys[r.key] * r.price * (1 + r.rate), 0)))}</Text>
      </Group>
      <Callout>Retur hanya untuk barang. Untuk jasa, koreksi lewat revisi BAST atau potongan di faktur.</Callout>
    </FormModal>
  );
}

// --- Konfirmasi kirim PO/SPK ke vendor -------------------------------------------------------------
// Dikirim = titik tidak bisa ditarik lagi: vendor sudah pegang dokumennya, jadi perlu konfirmasi.
export function SendPoModal({ opened, onClose, po, pb, onConfirm }) {
  const vendor = pb.vendorsById[po?.vendorId];
  const [cc, setCc] = useState('');
  const [note, setNote] = useState('');
  if (!po) return null;
  const label = poDocLabel(po);
  const email = vendorEmail(vendor);
  const file = `${po.number.replace(/\//g, '-')}.pdf`;
  const send = () => {
    onConfirm({ cc: cc.trim(), note: note.trim() });
    setCc('');
    setNote('');
  };

  const row = (k, v) => (
    <Group justify="space-between" wrap="nowrap" gap="md" align="flex-start">
      <Text fz="xs" c="slate.7" style={{ flexShrink: 0 }}>{k}</Text>
      <Text fz="xs" fw={600} c="slate.9" ta="right" style={{ overflowWrap: 'anywhere' }}>{v}</Text>
    </Group>
  );

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={520}
      icon={PaperPlaneTilt}
      title={`Kirim ${label} ke email vendor?`}
      subtitle={`${po.number} · ${vendor?.name ?? '—'}`}
      footer={
        <>
          <Cancel onClick={onClose} />
          <Button radius="md" leftSection={<PaperPlaneTilt size={16} />} disabled={!email} onClick={send}>
            Kirim ke vendor
          </Button>
        </>
      }
    >
      <Box p="sm" bg="slate.0" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
        <Stack gap={6}>
          {row('Kepada', email ? <>{email}<Text fz={11} fw={400} c="slate.6">{vendor?.pic ? `u.p. ${vendor.pic}` : ''}</Text></> : 'Email vendor belum diisi')}
          {row('Lampiran', file)}
          {row('Nilai', rupiah(poTotal(po)))}
        </Stack>
      </Box>

      {!email && (
        <Callout tone="stop" title="Email vendor kosong">
          Lengkapi email vendor {vendor?.name} di Kontak dulu sebelum dokumen ini dikirim.
        </Callout>
      )}

      <TextInput
        label="CC (opsional)"
        placeholder="atasan@perusahaan.co.id"
        size="sm"
        radius="md"
        value={cc}
        onChange={(e) => setCc(e.currentTarget.value)}
      />
      <Textarea
        label="Pesan untuk vendor (opsional)"
        placeholder="Mohon konfirmasi penerimaan dan jadwal pengiriman."
        size="sm"
        radius="md"
        autosize
        minRows={2}
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
      />

      <Callout tone="warn" title="Setelah dikirim">
        Status {label} berubah jadi &quot;Dikirim ke vendor&quot; dan isinya tidak bisa diubah lagi. Gudang baru bisa
        mencatat penerimaan setelah langkah ini.
      </Callout>
    </FormModal>
  );
}

// --- Alasan (tolak / kembalikan) -------------------------------------------------------------------
export function ReasonModal({ opened, onClose, title, label, confirmLabel, onConfirm }) {
  const [text, setText] = useState('');
  const [sub, setSub] = useState(false);
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={480}
      icon={Warning}
      title={title}
      footer={
        <>
          <Cancel onClick={onClose} />
          <Button
            radius="md"
            color="red"
            onClick={() => {
              setSub(true);
              if (!text.trim()) return;
              onConfirm(text.trim());
              setText('');
              setSub(false);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Textarea label={label} withAsterisk size="sm" radius="md" autosize minRows={3} value={text} error={sub && !text.trim() && 'Alasan wajib diisi'} onChange={(e) => setText(e.currentTarget.value)} />
    </FormModal>
  );
}

// --- Alokasi kredit vendor ke faktur --------------------------------------------------------------
export function CreditModal({ opened, onClose, invoice: inv, pb }) {
  const vendor = pb.vendorsById[inv?.vendorId];
  const t = invTotals(inv ?? { lines: [] }, pb.calc);
  // Saldo yang masih bisa dipakai = saldo vendor + yang sudah dialokasikan ke faktur ini (boleh dikoreksi turun).
  const pool = vendorCredit(inv?.vendorId, pb) + (inv?.credit ?? 0);
  const max = Math.min(pool, t.balance + (inv?.credit ?? 0));
  const [amount, setAmount] = useState(() => Math.min(pool, t.balance));
  if (!inv) return null;
  const save = () => {
    pb.update('invoices', inv.id, (d) => ({ ...d, credit: Math.min(Math.max(amount, 0), max) }));
    toast(amount > 0 ? 'Kredit vendor dialokasikan ke faktur.' : 'Alokasi kredit dihapus dari faktur.');
    onClose();
  };
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={520}
      icon={CurrencyCircleDollar}
      title="Alokasikan kredit"
      subtitle={`${inv.number} · ${vendor?.name}`}
      footer={
        <>
          <Cancel onClick={onClose} />
          <Button radius="md" disabled={pool <= 0} onClick={save}>Alokasikan</Button>
        </>
      }
    >
      <SimpleGrid cols={2}>
        <Field label={`Saldo kredit ${vendor?.name ?? 'vendor'}`}>{rupiah(pool)}</Field>
        <Field label="Sisa hutang faktur ini">{rupiah(t.balance + (inv.credit ?? 0))}</Field>
      </SimpleGrid>
      {pool <= 0 ? (
        <Callout tone="warn" title="Belum ada saldo kredit">
          Kredit vendor muncul dari retur pembelian yang diselesaikan sebagai “Kredit vendor”. Retur yang memotong
          hutang langsung tidak menambah saldo ini.
        </Callout>
      ) : (
        <>
          <NumberField
            label="Dipakai untuk faktur ini"
            description={`Maksimal ${rupiah(max)} — mengikuti saldo kredit atau sisa hutang, mana yang lebih kecil.`}
            money
            size="sm"
            radius="md"
            max={max}
            clampBehavior="strict"
            prefix="Rp "
            value={amount}
            onChange={(v) => setAmount(Math.min(Math.max(Number(v) || 0, 0), max))}
          />
          <Box p="sm" bg="slate.0" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
            <Group justify="space-between">
              <Text fz="sm" fw={600} c="slate.7">Sisa hutang setelah alokasi</Text>
              <Text fz="lg" fw={700} c="slate.9">{rupiah(Math.max(t.balance + (inv.credit ?? 0) - amount, 0))}</Text>
            </Group>
            <Text fz={11} c="slate.6" mt={4}>Sisa saldo kredit vendor: {rupiah(Math.max(pool - amount, 0))}</Text>
          </Box>
        </>
      )}
    </FormModal>
  );
}

// --- Detail ringkas dokumen ---------------------------------------------------------------------------
export function DetailModal({ opened, onClose, kind, doc, pb }) {
  if (!doc) return null;
  const po = pb.posById[doc.poId];
  const vendor = pb.vendorsById[doc.vendorId];
  const itemOf = (id) => po?.items.find((i) => i.id === id);
  const titles = { receipts: doc.kind === 'jasa' ? 'Detail BAST' : 'Detail penerimaan barang', invoices: 'Detail faktur pembelian', prs: 'Detail Payment Request', returns: 'Detail retur pembelian' };
  const showLines = kind !== 'prs';
  const t = kind === 'invoices' ? invTotals(doc, pb.calc) : null;
  return (
    <FormModal opened={opened} onClose={onClose} size={680} icon={ClipboardText} title={titles[kind]} subtitle={doc.number} footer={<Button radius="md" variant="default" onClick={onClose}>Tutup</Button>}>
      <SimpleGrid cols={{ base: 2, sm: 3 }}>
        <Field label="Vendor">{vendor?.name}</Field>
        <Field label="Tanggal">{formatDate(doc.date)}</Field>
        {po && <Field label={poDocLabel(po)}>{po.number}</Field>}
        {doc.doNumber && <Field label="Surat jalan / BAST">{doc.doNumber}</Field>}
        {doc.vendorNo && <Field label="No. invoice vendor" placeholder="Contoh: INV-2026-0123">{doc.vendorNo}</Field>}
        {doc.dueDate && <Field label="Jatuh tempo">{formatDate(doc.dueDate)}</Field>}
        {doc.reason && <Field label="Alasan">{doc.reason}</Field>}
        {doc.settlement && <Field label="Penyelesaian">{{ potong: 'Potong hutang', kredit: 'Kredit vendor', refund: 'Refund' }[doc.settlement]}</Field>}
        {kind === 'prs' && <Field label="Nominal">{rupiah(doc.amount)}</Field>}
        {kind === 'prs' && <Field label="Jenis">{doc.kind === 'dp' ? 'DP / CBD' : 'Pelunasan'}</Field>}
      </SimpleGrid>
      {showLines && (
        <Box style={tableFrame}>
          <Table verticalSpacing="xs" horizontalSpacing="sm" styles={th}>
            <Table.Thead bg="slate.0">
              <Table.Tr>
                <Table.Th>Item</Table.Th>
                <Table.Th ta="right">Qty</Table.Th>
                {kind !== 'receipts' && <Table.Th ta="right">Harga</Table.Th>}
                {kind === 'receipts' && <Table.Th ta="right">Ditolak</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {doc.lines.map((l, i) => (
                <Table.Tr key={i}>
                  <Table.Td fz="sm">{itemOf(l.itemId)?.desc}</Table.Td>
                  <Table.Td ta="right" fz="sm">{l.qty} {itemOf(l.itemId)?.unit}</Table.Td>
                  {kind !== 'receipts' && <Table.Td ta="right" fz="sm">{rupiah(l.price)}</Table.Td>}
                  {kind === 'receipts' && <Table.Td ta="right" fz="sm">{l.rejected || 0}</Table.Td>}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
      )}
      {t && (
        <Box p="sm" bg="slate.0" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
          <SimpleGrid cols={{ base: 2, sm: 5 }}>
            <Field label="DPP">{rupiah(t.dpp)}</Field>
            <Field label="PPN">{rupiah(t.ppn)}</Field>
            <Field label="Potongan DP / PPh / retur">-{rupiah(t.dp + t.pph + t.ret)}</Field>
            <Field label="Dibayar">{rupiah(t.paid)}</Field>
            <Field label="Sisa hutang" valueProps={{ c: t.balance ? 'red.8' : 'green.8' }}>{rupiah(t.balance)}</Field>
          </SimpleGrid>
        </Box>
      )}
      {doc.note && <Text fz="xs" c="slate.7">Catatan: {doc.note}</Text>}
    </FormModal>
  );
}

