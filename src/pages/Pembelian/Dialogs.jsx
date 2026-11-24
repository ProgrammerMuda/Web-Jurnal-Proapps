// Dialog pembuatan dokumen lanjutan (penawaran, penerimaan, faktur, payment request, retur, dll).
import {
  Badge,
  Box,
  Checkbox,
  Button,
  Group,
  Input,
  SegmentedControl,
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
  ArrowCounterClockwise,
  PaperPlaneTilt,
  Storefront,
  Truck,
  Warning,
} from '@/components/Icon.jsx';
import DateField from '@/components/DateField.jsx';
import NumberField from '@/components/NumberField.jsx';
import AttachmentList from './Attachments.jsx';
import { Callout, CopyIcon, Field, FormModal, blockedProps } from './components.jsx';
import TermBreakdown from './TermBreakdown.jsx';
import { periodOptions, personLabel, TODAY } from './data.js';
import { snapshotTerm, termFields } from './paymentTerms.js';
import {
  addDays,
  advancePct,
  dpInvoiceOf,
  dpBlockReason,
  dpBlocks,
  dpState,
  DP_STATE,
  poDpAmount,
  termText,
  bappJournalDate,
  bappProgress,
  bankOf,
  formatDate,
  invTotals,
  nextNumber,
  parseWarranty,
  itemKind,
  poAllBarang,
  poAllJasa,
  poDocLabel,
  proofFiles,
  quoteTotals,
  quoteDiscountLabel,
  lineRate,
  lineTaxes,
  TAX_OPTIONS,
  poTotal,
  remainingQty,
  scheduleBase,
  scheduleExcludesDp,
  scheduleCount,
  minQuotesFor,
  rangeLabel,
  returnedQty,
  scheduleRows,
  taxSummary,
  routeSwitchEffects,
  rupiah,
  uid,
  vendorCredit,
  vendorEmail,
} from './utils.js';
import { toast } from './usePb.js';
import { useData } from '@/lib/store.jsx';
import { buildMove, canIssue, getBalance } from '@/pages/Gudang/stock.js';
import { frozenMessage } from '@/pages/Gudang/opname.js';
import { freightShare, landedUnitCost } from './landedCost.js';
import { freightCapitalized } from '@/pages/Pengaturan/settings.js';
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

// Rangkai objek termin dari isian form: hanya parameter yang dipakai jenis termin itu yang
// disimpan, plus salinan saklar mekanisnya (snapshotTerm) supaya arti dokumen tidak ikut
// berubah kalau katalog syarat pembayaran diubah belakangan.
function buildTerm(f, spec) {
  if (!spec) return { type: f.termType };
  const fields = termFields(spec);
  const t = { type: spec.id, ...snapshotTerm(spec) };
  if (spec.advance === 'full') t.dpPct = 100;
  if (fields.includes('dp')) t.dpPct = f.dpPct;
  if (fields.includes('terms')) {
    t.terms = f.terms;
    t.termPcts = f.termPcts;
  }
  if (fields.includes('retention')) {
    t.retentionPct = f.retentionPct;
    t.retentionMonths = f.retentionMonths;
  }
  if (fields.includes('period')) {
    t.period = f.period;
    t.periods = f.periods;
  }
  if (fields.includes('due')) t.dueDays = f.dueDays;
  return t;
}

// --- Penawaran vendor ------------------------------------------------------------------------
export function QuoteModal({ opened, onClose, fppbj, pb, editing, single }) {
  // Permintaan yang isinya jasa semua jadi SPK, jadi termin bayarnya pakai katalog jasa.
  const isJasa = poAllJasa(fppbj);
  // Katalog syarat pembayaran datang dari Pengaturan, bukan daftar tetap di kode.
  // Hanya termin aktif yang berlaku untuk jenis permintaan ini yang ditawarkan.
  const termCatalog = (pb.paymentTerms ?? []).filter(
    (t) => t.active !== false && (t.scope === 'both' || t.scope === (isJasa ? 'jasa' : 'barang')),
  );
  const defaultTerm = termCatalog.find((t) => t.id === editing?.term?.type) ?? termCatalog[0] ?? null;
  const d0 = defaultTerm?.defaults ?? {};

  // Mode ubah: formulir terisi dari penawaran yang sudah ada.
  const [vendorId, setVendorId] = useState(editing?.vendorId ?? null);
  const [f, setF] = useState(() => ({
    no: editing?.no ?? '',
    validUntil: editing?.validUntil ?? addDays(TODAY, 14),
    desc: editing?.desc ?? '',
    file: editing?.file ?? '',
    // Nilai awal tiap parameter diambil dari definisi termin di Pengaturan.
    termType: editing?.term?.type ?? defaultTerm?.id ?? '',
    dpPct: editing?.term?.dpPct > 0 && editing?.term?.dpPct < 100 ? editing.term.dpPct : d0.dpPct ?? 30,
    dueDays: editing?.term?.dueDays ?? d0.dueDays ?? 30,
    terms: editing?.term?.terms ?? d0.terms ?? 3,
    termPcts: editing?.term?.termPcts ?? evenPcts(editing?.term?.terms ?? d0.terms ?? 3),
    retentionPct: editing?.term?.retentionPct ?? d0.retentionPct ?? 5,
    retentionMonths: editing?.term?.retentionMonths ?? d0.retentionMonths ?? 3,
    period: editing?.term?.period ?? d0.period ?? 'bulan',
    periods: editing?.term?.periods ?? d0.periods ?? 12,
    lead: editing?.lead ?? '',
    // Ongkir dan diskon sifatnya opsional: penawaran tanpa keduanya tetap sah.
    // Diskon disimpan sebagai mode + nilai supaya diskon persen tetap persen.
    shipping: editing?.shipping ?? 0,
    discMode: editing?.discount?.mode ?? 'rp',
    discValue: editing?.discount?.value ?? 0,
    // Apakah barang/jasanya melewati serah terima. Bawaannya ya — itu keadaan normal,
    // dan penawaran lama yang belum punya kolom ini memang berarti begitu.
    withReceipt: editing?.withReceipt ?? true,
    ...parseWarranty(editing?.warranty),
  }));
  const [lines, setLines] = useState(() =>
    Object.fromEntries(
      fppbj.items.map((i) => {
        const l = editing?.lines.find((x) => x.itemId === i.id);
        return [i.id, { price: l?.price ?? 0, spec: l?.spec ?? '', taxes: lineTaxes(editing, l) }];
      }),
    ),
  );
  // Saklar harga: berlaku untuk semua item ber-PPN; disimpan per item sebagai 'ppn' atau 'ppn_incl'.
  const [ppnIncl, setPpnIncl] = useState(() => Object.values(lines).some((l) => l.taxes.includes('ppn_incl')));
  const [sub, setSub] = useState(false);
  const set = (p) => { setSub(true); setF((x) => ({ ...x, ...p })); };
  const setLine = (id, p) => { setSub(true); setLines((l) => ({ ...l, [id]: { ...l[id], ...p } })); };

  // Spesifikasi termin yang sedang dipilih; `fields` menentukan isian tambahan yang wajib.
  const spec = termCatalog.find((t) => t.id === f.termType) ?? defaultTerm;
  const needs = (key) => termFields(spec).includes(key);
  // Ganti termin = pakai nilai awal termin yang baru, supaya definisi di Pengaturan terasa.
  const pickTerm = (id) => {
    const def = termCatalog.find((t) => t.id === id);
    const dd = def?.defaults ?? {};
    set({
      termType: id,
      ...(dd.dpPct != null && { dpPct: dd.dpPct }),
      ...(dd.dueDays != null && { dueDays: dd.dueDays }),
      ...(dd.terms != null && { terms: dd.terms, termPcts: evenPcts(dd.terms) }),
      ...(dd.retentionPct != null && { retentionPct: dd.retentionPct }),
      ...(dd.retentionMonths != null && { retentionMonths: dd.retentionMonths }),
      ...(dd.period != null && { period: dd.period }),
      ...(dd.periods != null && { periods: dd.periods }),
    });
  };
  const pcts = f.termPcts.slice(0, f.terms);
  const pctSum = Math.round(pcts.reduce((n, p) => n + (Number(p) || 0), 0) * 10) / 10;
  // Nilai yang dibagi ke termin: total penawaran dikurangi uang muka dan retensi.
  const quoteGross = fppbj.items.reduce((n, i) => n + i.qty * (lines[i.id]?.price || 0), 0);
  // Diskon persen mengikuti subtotal; diskon rupiah dipakai apa adanya. Keduanya opsional.
  const discRp =
    Number(f.discValue) > 0
      ? Math.min(
          f.discMode === 'pct'
            ? Math.round((quoteGross * Math.min(Number(f.discValue), 100)) / 100)
            : Math.round(Number(f.discValue)),
          quoteGross,
        )
      : 0;
  const shipRp = Math.max(0, Number(f.shipping) || 0);
  const quoteNet = quoteGross - discRp + shipRp;
  // Termin dibagi dari nilai yang benar-benar ditagih vendor, jadi sesudah diskon dan ongkir.
  const base = scheduleBase(quoteNet, buildTerm(f, spec));
  const setPct = (k, v) => setF((x) => ({ ...x, termPcts: x.termPcts.map((p, i) => (i === k ? Number(v) || 0 : p)) }));

  const usedVendors = fppbj.quotes.filter((q) => q.id !== editing?.id).map((q) => q.vendorId);
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
    termType: termCatalog.length === 0 && 'Belum ada syarat pembayaran yang bisa dipilih',
    periods: needs('period') && !(f.periods >= 1) && 'Jumlah periode minimal 1',
    prices: fppbj.items.some((i) => !(lines[i.id].price > 0)) && 'Isi harga untuk semua item',
    specs: fppbj.items.some((i) => !lines[i.id].spec.trim()) && 'Isi spesifikasi yang ditawarkan untuk semua item',
    disc:
      f.discMode === 'rp' &&
      Number(f.discValue) > 0 &&
      quoteGross > 0 &&
      Number(f.discValue) > quoteGross &&
      'Diskon tidak boleh melebihi subtotal penawaran',
  };
  const invalid = Object.values(errors).some(Boolean);
  const submit = () => {
    setSub(true);
    if (invalid) return;
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
      withReceipt: f.withReceipt,
      // Keduanya opsional: 0 / null berarti vendor tidak menagih ongkir dan tidak memberi diskon.
      shipping: shipRp,
      discount: Number(f.discValue) > 0 ? { mode: f.discMode, value: Number(f.discValue) } : null,
      lines: fppbj.items.map((i) => ({
        itemId: i.id,
        ...lines[i.id],
        taxes: lines[i.id].taxes.map((t) => (t === 'ppn' || t === 'ppn_incl' ? (ppnIncl ? 'ppn_incl' : 'ppn') : t)),
      })),
    };
    pb.update('fppbj', fppbj.id, (d) =>
      editing
        ? {
            ...d,
            quotes: d.quotes.map((q) => (q.id === editing.id ? quote : q)),
            // Harga final diisi ulang dari penawaran yang baru. Harga hasil negosiasi untuk
            // vendor ini juga dilepas — kalau tidak, offerPrice() tetap memakai angka lama
            // dan perubahan harga penawaran tidak terlihat sama sekali.
            procurement: {
              ...d.procurement,
              winners: {},
              finals: {},
              offerFinals: Object.fromEntries(
                Object.entries(d.procurement?.offerFinals ?? {}).filter(([v]) => v !== quote.vendorId),
              ),
              status: d.procurement?.status === 'diajukan' ? 'draf' : d.procurement?.status,
            },
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
        subtitle={fppbj.number}
        footer={
          <>
            <Cancel onClick={onClose} />
            <Button radius="md" disabled={invalid} onClick={submit}>
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
        {/* Item lebar di kiri; harga dan pajak ringkas di kanan; spesifikasi satu baris penuh di bawahnya. */}
        <Box style={tableFrame}>
          {(() => {
            const cols = 'minmax(0, 1fr) 150px 140px';
            const headCell = { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600, color: 'var(--mantine-color-slate-7)', whiteSpace: 'nowrap' };
            return (
              <Box miw={single ? 600 : 740}>
                <Box px="sm" py={8} bg="slate.0" style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 'var(--mantine-spacing-sm)', borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                  <Text style={headCell}>Item</Text>
                  <Text style={headCell}>Harga satuan <span style={{ color: 'var(--mantine-color-red-6)' }}>*</span></Text>
                  <Text style={headCell}>Pajak</Text>
                </Box>
                {fppbj.items.map((i, idx) => (
                  <Box key={i.id} px="sm" py="sm" style={{ borderTop: idx ? '1px solid var(--mantine-color-gray-2)' : undefined }}>
                    <Box style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 'var(--mantine-spacing-sm)', alignItems: 'center' }}>
                      <Box style={{ minWidth: 0 }}>
                        <Text fz="sm" fw={600}>{i.desc}</Text>
                        <Text fz={11} c="slate.6">{i.qty} {i.unit}{i.spec ? ` · ${i.spec}` : ''}</Text>
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

        {/* Ongkir dan diskon sering ada di surat penawaran, tapi tidak selalu — keduanya
            opsional. Dibiarkan 0 berarti harga barangnya sudah final. */}
        <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }} mt="xs">Ongkir &amp; diskon (opsional)</Text>
        <Box style={tableFrame} p="sm">
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <NumberField
                label="Ongkos kirim"
                size="sm"
                radius="md"
                money
                prefix="Rp "
                placeholder="0"
                description="Biaya kirim yang ditagih vendor. Ikut jadi harga perolehan barang."
                value={f.shipping}
                onChange={(v) => set({ shipping: Number(v) || 0 })}
              />
              <Box>
                <Input.Wrapper
                  label="Diskon"
                  size="sm"
                  description="Potongan dari vendor, dalam rupiah atau persen dari subtotal."
                  error={sub && errors.disc}
                >
                  <Group gap="xs" wrap="nowrap" mt={4}>
                    <SegmentedControl
                      size="xs"
                      radius="md"
                      data={[{ value: 'rp', label: 'Rp' }, { value: 'pct', label: '%' }]}
                      value={f.discMode}
                      onChange={(v) => set({ discMode: v })}
                      aria-label="Satuan diskon"
                    />
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      {f.discMode === 'pct' ? (
                        <NumberField
                          size="sm"
                          radius="md"
                          min={0}
                          max={100}
                          clampBehavior="strict"
                          decimalScale={2}
                          unit="%"
                          placeholder="0"
                          aria-label="Diskon persen"
                          value={f.discValue}
                          onChange={(v) => set({ discValue: Number(v) || 0 })}
                        />
                      ) : (
                        <NumberField
                          size="sm"
                          radius="md"
                          money
                          prefix="Rp "
                          placeholder="0"
                          aria-label="Diskon rupiah"
                          error={!!(sub && errors.disc)}
                          value={f.discValue}
                          onChange={(v) => set({ discValue: Number(v) || 0 })}
                        />
                      )}
                    </Box>
                  </Group>
                </Input.Wrapper>
              </Box>
            </SimpleGrid>
            {/* Ringkasan nilai penawaran, supaya pengaruh diskon dan ongkir langsung terlihat. */}
            <Box style={{ borderTop: '1px solid var(--mantine-color-gray-2)', paddingTop: 8 }}>
              <Group justify="space-between" gap="xs">
                <Text fz="xs" c="slate.6">Subtotal item</Text>
                <Text fz="xs" fw={600} c="slate.8">{rupiah(quoteGross)}</Text>
              </Group>
              {discRp > 0 && (
                <Group justify="space-between" gap="xs" mt={2}>
                  <Text fz="xs" c="slate.6">Diskon{f.discMode === 'pct' ? ` ${Number(f.discValue)}%`.replace('.', ',') : ''}</Text>
                  <Text fz="xs" fw={600} c="green.8">-{rupiah(discRp)}</Text>
                </Group>
              )}
              {shipRp > 0 && (
                <Group justify="space-between" gap="xs" mt={2}>
                  <Text fz="xs" c="slate.6">Ongkos kirim</Text>
                  <Text fz="xs" fw={600} c="slate.8">{rupiah(shipRp)}</Text>
                </Group>
              )}
              <Group justify="space-between" gap="xs" mt={4}>
                <Text fz="xs" fw={700} c="slate.9">Nilai penawaran</Text>
                <Text fz="sm" fw={700} c="slate.9">{rupiah(quoteNet)}</Text>
              </Group>
              <Text fz={10} c="slate.5" mt={2}>Belum termasuk PPN. Pajak dihitung per item di tabel harga.</Text>
            </Box>
          </Stack>
        </Box>

        <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }} mt="xs">Ketentuan</Text>
        <>
            {/* Pilihan termin berasal dari Pengaturan → Syarat Pembayaran, disaring per jenis permintaan. */}
            {termCatalog.length === 0 && (
              <Callout tone="warn" title="Belum ada syarat pembayaran">
                Penawaran tidak bisa disimpan tanpa termin bayar. Buat dulu di <strong>Pengaturan → Transaksi &amp;
                Dokumen → Syarat Pembayaran</strong>, minimal satu yang berlaku untuk {isJasa ? 'jasa' : 'barang'}.
              </Callout>
            )}
            <Select
              label="Termin bayar"
              withAsterisk
              size="sm"
              radius="md"
              allowDeselect={false}
              data={termCatalog.map((t) => ({ value: t.id, label: t.label }))}
              disabled={termCatalog.length === 0}
              placeholder={termCatalog.length === 0 ? 'Belum ada pilihan' : undefined}
              error={sub && errors.termType}
              description={spec ? [spec.hint, spec.example && `contoh: ${spec.example}`].filter(Boolean).join(' · ') : undefined}
              value={f.termType}
              onChange={pickTerm}
            />
            {termFields(spec).length > 0 && (
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
                {needs('due') && (
                  <NumberField label="Jatuh tempo faktur (hari)" size="sm" radius="md" min={0} max={180} clampBehavior="strict" value={f.dueDays} onChange={(v) => set({ dueDays: Number(v) || 0 })} />
                )}
                {needs('retention') && (
                  <Box style={{ gridColumn: 'span 2' }}>
                    <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
                      <NumberField label="Retensi (%)" withAsterisk size="sm" radius="md" min={1} max={20} clampBehavior="strict" error={sub && errors.retention} value={f.retentionPct} onChange={(v) => set({ retentionPct: Number(v) || 0 })} />
                      <NumberField label="Masa pemeliharaan (bulan)" withAsterisk size="sm" radius="md" min={1} max={36} clampBehavior="strict" value={f.retentionMonths} onChange={(v) => set({ retentionMonths: Number(v) || 0 })} />
                    </SimpleGrid>
                  </Box>
                )}
                {needs('period') && (
                  <Box style={{ gridColumn: 'span 2' }}>
                    <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
                      <Select label="Periode" size="sm" radius="md" allowDeselect={false} data={periodOptions} value={f.period} onChange={(v) => set({ period: v })} />
                      <NumberField label="Jumlah periode" withAsterisk size="sm" radius="md" min={1} max={60} clampBehavior="strict" error={sub && errors.periods} value={f.periods} onChange={(v) => set({ periods: Number(v) || 0 })} />
                    </SimpleGrid>
                  </Box>
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

            {/* Menentukan rantai dokumen sesudah PO/SPK, jadi ditanyakan di sini — bukan
                ditebak belakangan dari ada atau tidaknya FPB/BAPP yang tercatat. Diberi label
                sendiri supaya tidak terbaca sebagai bagian dari termin bayar di atasnya. */}
            <Input.Wrapper label={`Serah terima ${isJasa ? 'jasa' : 'barang'}`} withAsterisk size="sm">
              <Box style={tableFrame} p="sm">
                <Switch
                  size="sm"
                  labelPosition="left"
                  justify="space-between"
                  w="100%"
                  label={`Ada penerimaan ${isJasa ? 'jasa (BAPP)' : 'barang (FPB)'}`}
                  description={f.withReceipt
                    ? `${isJasa ? 'Pekerjaan diperiksa dan dituangkan dalam berita acara' : 'Barang diterima gudang dan dicatat'} dulu; faktur dibuat dari ${isJasa ? 'BAPP' : 'FPB'} itu.`
                    : `Tidak ada serah terima. Setelah ${isJasa ? 'SPK' : 'PO'} terbit, fakturnya langsung dibuat dari ${isJasa ? 'SPK' : 'PO'} itu.`}
                  checked={f.withReceipt}
                  onChange={(e) => set({ withReceipt: e.currentTarget.checked })}
                  styles={{ body: { alignItems: 'center' }, labelWrapper: { flex: 1 } }}
                />
              </Box>
            </Input.Wrapper>

            <Input.Wrapper label="Garansi / masa layanan" size="sm">
              <Group gap="xs" wrap="nowrap">
                <NumberField size="sm" radius="md" min={0} placeholder="Contoh: 12" flex={1} value={f.warrantyValue} onChange={(v) => set({ warrantyValue: Number(v) || 0 })} />
                <Select size="sm" radius="md" w={120} allowDeselect={false} aria-label="Satuan garansi" data={[{ value: 'hari', label: 'Hari' }, { value: 'bulan', label: 'Bulan' }, { value: 'tahun', label: 'Tahun' }]} value={f.warrantyUnit} onChange={(v) => set({ warrantyUnit: v })} />
              </Group>
            </Input.Wrapper>
        </>
        {sub && (errors.dp || errors.terms || errors.pcts || errors.retention || errors.periods) && (
          <Text fz="xs" c="red.7">{errors.dp || errors.terms || errors.pcts || errors.retention || errors.periods}</Text>
        )}
        <Textarea label="Deskripsi penawaran" placeholder={isJasa ? 'Contoh: Sudah termasuk material dan tenaga kerja' : 'Contoh: Penawaran sudah termasuk pengiriman ke kantor'} size="sm" radius="md" minRows={2} autosize value={f.desc} onChange={(e) => set({ desc: e.currentTarget.value })} />
      </FormModal>
    </>
  );
}

// --- Penerimaan (FPB barang / BAPP jasa) ---------------------------------------------------------
/**
 * Mutasi stok dari penerimaan barang. Harga masuk = harga perolehan per satuan
 * dasar (DPP setelah diskon, tanpa PPN Masukan) sesuai M5.
 */
// Baris PO lama belum menyimpan productId, jadi dicocokkan juga lewat namanya —
// cara yang sama dipakai form permintaan saat mengenali produk katalog.
const productOfItem = (products, item) => {
  const nama = (item?.desc ?? '').trim().toLowerCase();
  return (
    products.find((p) => p.id === item?.productId) ??
    products.find((p) => p.name.toLowerCase() === nama)
  );
};

function postReceiptStock({ receiptId, number, date, po, lines, postStock, products, by, settings, doc }) {
  if (!po.warehouseId) return;
  const moves = lines
    .map((l) => {
      const item = po.items.find((i) => i.id === l.itemId);
      if (!item) return null;
      const product = productOfItem(products, item);
      if (!product?.tracked || !(l.qty > 0)) return null;
      // Harga masuk = harga perolehan per unit (DPP + ongkir + PPN bila tidak bisa
      // dikreditkan). Rinciannya ikut disimpan supaya jurnal dan tooltip membaca
      // angka yang sama, bukan menghitung ulang dari dokumen.
      const c = landedUnitCost(po, item.id, settings, doc);
      return buildMove({
        date,
        type: 'receipt',
        productId: product.id,
        warehouseId: po.warehouseId,
        qty: l.qty,
        unitCost: c.total,
        sourceType: 'goods_receipt',
        sourceId: receiptId,
        sourceNo: number,
        createdBy: by,
        costBreakdown: {
          dpp: c.dpp,
          freight: freightCapitalized(settings) ? c.freight : freightShare(po, item.id) / (item.qty || 1),
          vat: c.vat,
          vatRate: item.ppnRate ?? 0,
          freightCapitalized: freightCapitalized(settings),
        },
      });
    })
    .filter(Boolean);
  if (moves.length) postStock({ moves });
}

/**
 * Mutasi keluar dari retur pembelian. Dinilai dengan harga perolehan mutasi
 * penerimaan aslinya (H11), bukan harga rata-rata, supaya nilai persediaan yang
 * dikurangi sama dengan tagihan yang dikurangi.
 */
/**
 * Mutasi penerimaan yang diretur. Yang dicari adalah penerimaan pada FPB yang
 * difakturkan di baris itu (`receiptId`), bukan penerimaan terakhir atas barang
 * yang sama: produk yang sama bisa diterima lagi dari PO lain dengan harga
 * berbeda, dan retur harus memakai harga perolehan FPB-nya sendiri.
 *
 * Tanpa receiptId tidak ada tebakan yang aman, jadi hasilnya null dan
 * pemanggilnya yang menahan dokumen.
 */
function sourceReceiptMove(moves, product, warehouseId, receiptId, asOf) {
  if (!product || !warehouseId) return null;
  const milik = (moves ?? []).filter(
    (m) => m.type === 'receipt' && m.productId === product.id && m.warehouseId === warehouseId,
  );
  const tepat = receiptId ? milik.find((m) => m.sourceId === receiptId) : null;
  if (tepat) return tepat;
  // Dokumen lama bisa saja tidak menyimpan kaitan ke mutasinya. Pilihan paling
  // aman adalah penerimaan terakhir SEBELUM tanggal FPB itu — bukan penerimaan
  // terbaru, yang bisa berasal dari PO lain dengan harga berbeda.
  if (!asOf) return null;
  return (
    milik
      .filter((m) => m.date <= asOf)
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null
  );
}

function postReturnStock({ returnId, number, date, po, lines, postStock, products, moves, receipts, by, billed, freightRefunded }) {
  if (!po?.warehouseId) return;
  const out = lines
    .map((l) => {
      const item = po.items.find((i) => i.id === l.itemId);
      const product = productOfItem(products, item);
      if (!product?.tracked || !(l.qty > 0)) return null;
      const rc = (receipts ?? []).find((x) => x.id === l.receiptId);
      const asal = sourceReceiptMove(moves, product, po.warehouseId, l.receiptId, rc?.date ?? date);
      // Baris tanpa penerimaan asal sudah ditahan di form; kalau toh lolos,
      // lebih baik tidak membuat mutasi berharga tebakan.
      if (!asal) return null;
      return buildMove({
        date,
        type: 'purchase_return',
        productId: product.id,
        warehouseId: po.warehouseId,
        qty: l.qty,
        unitCost: asal.unitCost,
        sourceType: 'purchase_return',
        sourceId: returnId,
        sourceNo: number,
        createdBy: by,
        costBreakdown: asal.costBreakdown,
        sourceReceiptMoveId: asal.id,
        billed,
        freightRefunded,
      });
    })
    .filter(Boolean);
  if (out.length) postStock({ moves: out });
}

export function ReceiptModal({ opened, onClose, po, pb }) {
  const { postStock, products, companySettings, stockOpnames, warehouses } = useData();
  // O4: gudang yang sedang diopname tidak boleh menerima barang — saldo bukunya
  // sudah dibekukan, jadi penerimaan di tengah hitungan membuat angkanya meleset.
  const beku = frozenMessage(
    stockOpnames,
    po?.warehouseId,
    warehouses.find((w) => w.id === po?.warehouseId)?.name ?? 'Gudang tujuan',
  );
  const [date, setDate] = useState(TODAY);
  const [doNo, setDoNo] = useState('');
  const [note, setNote] = useState('');
  const scheduled = scheduleCount(po.term) > 1 || po.items.some((i) => i.unit === 'retensi');
  // Semua qty mulai dari 0 — yang dicatat harus apa yang betul-betul diterima, bukan angka
  // pesanan yang tinggal disetujui. Mengisi penuh otomatis memancing pencatatan asal setuju.
  const [rows, setRows] = useState(() =>
    Object.fromEntries(po.items.map((i) => [i.id, { qty: 0, rejected: 0 }])),
  );
  const [sub, setSub] = useState(false);
  const [file, setFile] = useState('');
  // Error dibuka begitu form disentuh — tombol simpan nonaktif selama belum sah, jadi
  // submit() tidak pernah menyalakan `sub` sendiri.
  const touch = (fn) => (v) => { setSub(true); fn(v); };
  const isJasa = poAllJasa(po);
  const mixed = !isJasa && !poAllBarang(po);
  // SPK bertermin dicatat per termin dengan centang, bukan isian qty: tiap baris jadwal
  // adalah satu pekerjaan yang selesai atau belum, tidak ada "separuh termin".
  const bappMode = isJasa && scheduled;
  // SPK jasa tanpa jadwal termin: pekerjaannya juga tidak dihitung per qty — satu lingkup
  // kerja itu diterima atau ditolak. Mengetik "12 dari 20" di sini meniru FPB barang dan
  // memaksa angka pada sesuatu yang penilaiannya bukan angka.
  const bappPlain = isJasa && !scheduled;
  // Satu centang per lingkup kerja: dicentang berarti diterima. Yang tidak dicentang tidak
  // ikut BAPP ini dan tetap terbuka — sama seperti termin yang belum selesai pada SPK
  // bertermin. Tidak ada kolom "ditolak": menolak berarti belum menerima, dan sisa SPK-nya
  // memang tetap terbuka sampai pekerjaannya diterima.
  const [pickedWork, setPickedWork] = useState([]);
  const accepted = po.items.filter((i) => pickedWork.includes(i.id));
  const acceptedValue = accepted.reduce((n, i) => n + i.qty * i.price, 0);
  const [picked, setPicked] = useState([]);
  const sched = bappMode ? scheduleRows(po, pb.receipts, TODAY, picked) : [];
  const pickedValue = po.items.filter((i) => picked.includes(i.id)).reduce((n, i) => n + i.qty * i.price, 0);
  const progress = bappMode ? bappProgress(po, pb.receipts, picked) : null;
  const journalDate = bappMode ? bappJournalDate(po, picked, date) : date;
  const total = bappMode ? picked.length : bappPlain ? accepted.length : po.items.reduce((n, i) => n + (rows[i.id].qty || 0), 0);
  const totalRejected = bappMode || bappPlain ? 0 : po.items.reduce((n, i) => n + (rows[i.id].rejected || 0), 0);
  // Berapa baris yang betul-betul diisi, dan berapa yang belum — penerimaan sebagian itu wajar,
  // tapi harus terlihat supaya tidak ada baris yang terlewat tanpa sadar.
  const rowsFilled = bappMode || bappPlain ? 0 : po.items.filter((i) => (rows[i.id].qty || 0) + (rows[i.id].rejected || 0) > 0).length;
  const sisaSetelah = bappMode || bappPlain
    ? 0
    : po.items.reduce((n, i) => n + Math.max(remainingQty(po, i.id, pb.receipts) - (rows[i.id].qty || 0) - (rows[i.id].rejected || 0), 0), 0);
  const err = {
    doNo: !doNo.trim() && (isJasa ? 'No. BAPP wajib diisi' : mixed ? 'No. surat jalan / BAPP wajib diisi' : 'No. surat jalan wajib diisi'),
    date: (!date && `Tanggal ${isJasa ? 'BAPP' : 'terima'} wajib diisi`)
      || (date > TODAY && 'Tidak boleh setelah hari ini'),
    qty: total <= 0
      && (bappMode
        ? 'Centang minimal satu termin yang sudah selesai'
        : bappPlain
          ? 'Centang minimal satu pekerjaan yang sudah diterima'
          : 'Isi minimal satu qty diterima'),
    file: isJasa && !file && 'BAPP bertanda tangan wajib diunggah',
    // Jasa tidak membentuk persediaan, jadi BAPP tidak ikut terhalang pembekuan.
    beku: !isJasa && beku,
  };
  const invalid = Object.values(err).some(Boolean);
  const submit = () => {
    setSub(true);
    if (invalid) return;
    const lines = bappMode
      ? po.items.filter((i) => picked.includes(i.id)).map((i) => ({ itemId: i.id, qty: i.qty, rejected: 0 }))
      : bappPlain
      // Dicentang = seluruh lingkupnya diterima.
      ? accepted.map((i) => ({ itemId: i.id, qty: i.qty, rejected: 0 }))
      : po.items
          .map((i) => ({ itemId: i.id, qty: rows[i.id].qty || 0, rejected: rows[i.id].rejected || 0 }))
          .filter((l) => l.qty > 0 || l.rejected > 0);
    const prefix = lines.every((l) => itemKind(po, l.itemId) === 'jasa') ? 'BAPP' : 'FPB';
    const receiptId = uid('fpb');
    const number = nextNumber(prefix, pb.receipts);
    pb.add('receipts', {
      id: receiptId,
      number,
      poId: po.id,
      vendorId: po.vendorId,
      date,
      doNumber: doNo,
      kind: prefix === 'BAPP' ? 'jasa' : 'barang',
      // BAPP jasa perlu persetujuan Atasan sebelum bisa difaktur (spesifikasi 2.2 & 3.8).
      // FPB barang langsung terkonfirmasi: approval Kepala Gudang opsional dan nonaktif default.
      status: prefix === 'BAPP' ? 'draf' : 'dikonfirmasi',
      createdBy: personLabel(pb.role),
      // Tanggal pengakuan beban. Berbeda dari tanggal dokumen pada termin berkala: bebannya
      // milik periode yang di-BAPP, bukan hari dokumennya diketik.
      journalDate: prefix === 'BAPP' ? journalDate : date,
      warehouseId: po.warehouseId ?? null,
      file,
      lines,
      note,
    });
    // Barang yang diterima langsung menambah stok di gudang tujuan PO. Hanya produk
    // yang dilacak stoknya yang bergerak (M12); jasa tidak punya persediaan.
    postReceiptStock({
      receiptId,
      number,
      date,
      po,
      lines,
      postStock,
      products,
      by: personLabel(pb.role),
      settings: companySettings,
    });
    toast(
      prefix === 'BAPP'
        ? 'BAPP dicatat. Menunggu approval Chief Finance lalu Building Manager sebelum bisa difaktur.'
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
      title={isJasa ? 'Catat BAPP' : mixed ? 'Catat penerimaan (FPB / BAPP)' : 'Catat penerimaan barang (FPB)'}
      subtitle={`${po.number} · ${pb.vendorsById[po.vendorId]?.name}`}
      footer={
        <>
          <Cancel onClick={onClose} />
          <Button radius="md" disabled={invalid} onClick={submit}>
            Simpan {isJasa ? 'BAPP' : mixed ? 'penerimaan' : 'FPB'}
          </Button>
        </>
      }
    >
      {dpBlocks(dpState(po, pb.calc)) && (
        <Callout tone="warn" title={DP_STATE[dpState(po, pb.calc).state].label}>
          {dpBlockReason(dpState(po, pb.calc))}. Penerimaan tetap bisa disimpan — barang yang sudah
          datang tetap dicatat — tapi faktur pelunasannya baru bisa dibuat setelah uang muka beres.
        </Callout>
      )}
      {err.beku && (
        <Callout tone="warn" title="Gudang sedang diopname">
          {err.beku}. Penerimaan ke gudang ini ditahan sampai opname-nya diposting atau
          dibatalkan, supaya saldo buku yang dibekukan tidak bergeser di tengah hitungan.
        </Callout>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput label={isJasa ? 'No. BAPP' : mixed ? 'No. surat jalan / BAPP' : 'No. surat jalan'} placeholder={isJasa ? 'Contoh: BAPP/2026/11/0007' : 'Contoh: SJ-20261104-01'} withAsterisk size="sm" radius="md" value={doNo} error={sub && err.doNo} onChange={(e) => { setSub(true); setDoNo(e.currentTarget.value); }} />
        <DateField
          label={isJasa ? 'Tanggal BAPP' : 'Tanggal terima'}
          withAsterisk
          size="sm"
          radius="md"
          max={TODAY}
          value={date}
          error={sub && err.date}
          onChange={(e) => { setSub(true); setDate(e.currentTarget.value); }}
        />
      </SimpleGrid>
      {bappMode ? (
        <>
          {/* Satu termin = satu pekerjaan: selesai atau belum, jadi dicentang, bukan diisi qty. */}
          <Box style={tableFrame}>
            {sched.map(({ item: i, received, lockedUntil, blockedByOrder }, idx) => {
              const checked = picked.includes(i.id);
              const disabled = received || !!lockedUntil || (blockedByOrder && !checked);
              const sub2 = i.periodFrom
                ? rangeLabel({ from: i.periodFrom, to: i.periodTo })
                : i.unit === 'retensi'
                  ? 'ditagih setelah masa pemeliharaan'
                  : `${i.pct ?? 0}% dari nilai`;
              return (
                <Group
                  key={i.id}
                  justify="space-between"
                  wrap="nowrap"
                  px="md"
                  py="sm"
                  style={{ borderTop: idx ? '1px solid var(--mantine-color-gray-2)' : undefined, background: checked ? 'var(--mantine-color-primary-0)' : undefined }}
                >
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Checkbox
                      size="sm"
                      checked={checked}
                      disabled={disabled}
                      aria-label={i.desc}
                      onChange={(e) => {
                        const on = e.currentTarget.checked;
                        setPicked((l) => {
                          if (on) return [...l, i.id];
                          // Lepas centang ini beserta termin sesudahnya: tanpa itu bisa
                          // tersisa termin 4 tercentang sementara termin 3 tidak.
                          const after = po.items.slice(po.items.findIndex((x) => x.id === i.id)).map((x) => x.id);
                          return l.filter((x) => !after.includes(x));
                        });
                      }}
                    />
                    <Box style={{ minWidth: 0 }}>
                      <Text fz="sm" fw={600} c={disabled && !received ? 'slate.5' : 'slate.9'}>{i.desc}</Text>
                      <Group gap={6} wrap="nowrap">
                        <Text fz={11} c="slate.6">{sub2}</Text>
                        {lockedUntil && (
                          <Text fz={11} c="slate.5">· bisa dicatat mulai {formatDate(lockedUntil)}</Text>
                        )}
                      </Group>
                    </Box>
                  </Group>
                  {received ? (
                    <Badge size="sm" radius="sm" variant="light" color="green" fw={700} tt="none">Diterima</Badge>
                  ) : (
                    <Text fz="sm" fw={700} c={disabled ? 'slate.5' : 'slate.9'} style={{ whiteSpace: 'nowrap' }}>{rupiah(i.qty * i.price)}</Text>
                  )}
                </Group>
              );
            })}
          </Box>
          <Text fz="xs" c="slate.6">
            {sched.some((r) => r.lockedUntil)
              ? 'Termin berkala baru bisa dicatat setelah periodenya berakhir.'
              : 'Tidak terkunci tanggal. Boleh pilih lebih dari satu, asal berurutan.'}
          </Text>
          <FileField label="Unggah BAPP bertanda tangan" withAsterisk value={file} error={sub && err.file} onChange={touch(setFile)} />
          {picked.length > 0 && (
            <Box style={tableFrame} p="md">
              <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }} mb={6}>Hasil</Text>
              <SimpleGrid cols={{ base: 1, xs: 2 }} spacing={6}>
                <Field label="Nilai dicatat">{rupiah(pickedValue)}</Field>
                <Field label="Progres pesanan">
                  {progress.periodic ? `${progress.done} dari ${progress.total} periode` : `${progress.pct}%`}
                </Field>
                <Field label="Sisa pesanan">{progress.remaining > 0 ? rupiah(progress.remaining) : `${rupiah(0)} · selesai`}</Field>
                <Field label="Tanggal jurnal">
                  {formatDate(journalDate)}
                  <Text fz={11} c="slate.6" component="span"> · {journalDate === date ? 'tanggal BAPP' : 'akhir periode'}</Text>
                </Field>
              </SimpleGrid>
            </Box>
          )}
        </>
      ) : bappPlain ? (
        <>
          {/* Satu lingkup kerja = satu centang: diterima atau belum. Bentuknya sengaja sama
              dengan BAPP bertermin, karena pertanyaannya memang sama. */}
          <Box style={tableFrame}>
            {po.items.map((i, idx) => {
              const selesai = remainingQty(po, i.id, pb.receipts) === 0;
              const checked = pickedWork.includes(i.id);
              return (
                <Group
                  key={i.id}
                  justify="space-between"
                  wrap="nowrap"
                  gap="md"
                  px="md"
                  py="sm"
                  style={{
                    borderTop: idx ? '1px solid var(--mantine-color-gray-2)' : undefined,
                    background: checked ? 'var(--mantine-color-primary-0)' : undefined,
                  }}
                >
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Checkbox
                      size="sm"
                      checked={checked}
                      disabled={selesai}
                      aria-label={i.desc}
                      onChange={(e) => {
                        setSub(true);
                        const on = e.currentTarget.checked;
                        setPickedWork((l) => (on ? [...l, i.id] : l.filter((x) => x !== i.id)));
                      }}
                    />
                    <Box style={{ minWidth: 0 }}>
                      <Text fz="sm" fw={600} c={selesai ? 'slate.5' : 'slate.9'}>{i.desc}</Text>
                      <Text fz={11} c="slate.6">
                        {i.qty} {i.unit}
                        {i.spec ? ` · ${i.spec}` : ''}
                      </Text>
                    </Box>
                  </Group>
                  {selesai ? (
                    <Badge size="sm" radius="sm" variant="light" color="green" fw={700} tt="none" style={{ flexShrink: 0 }}>Sudah di-BAPP</Badge>
                  ) : (
                    <Text fz="sm" fw={700} c="slate.9" style={{ whiteSpace: 'nowrap' }}>{rupiah(i.qty * i.price)}</Text>
                  )}
                </Group>
              );
            })}
          </Box>
          <Text fz="xs" c="slate.6">
            Pekerjaan yang belum dipilih tidak ikut BAPP ini dan tetap terbuka untuk BAPP berikutnya.
          </Text>
          <FileField label="Unggah BAPP bertanda tangan" withAsterisk value={file} error={sub && err.file} onChange={touch(setFile)} />
          {accepted.length > 0 && (
            <Box style={tableFrame} p="md">
              <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }} mb={6}>Hasil</Text>
              <SimpleGrid cols={{ base: 1, xs: 2 }} spacing={6}>
                <Field label="Diterima">{accepted.length} dari {po.items.length} pekerjaan</Field>
                <Field label="Nilai dicatat">{rupiah(acceptedValue)}</Field>
              </SimpleGrid>
            </Box>
          )}
        </>
      ) : (
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
              const setCell = (key, v, cap) => {
                setSub(true);
                setRows((r) => ({ ...r, [i.id]: { ...r[i.id], [key]: Math.min(Math.max(Number(v) || 0, 0), cap) } }));
              };
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
      )}
      {sub && err.qty && <Text fz="xs" c="red.7">{err.qty}</Text>}
      {!bappMode && !bappPlain && total + totalRejected > 0 && (
        <Box style={tableFrame} p="md">
          <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }} mb={6}>Ringkasan</Text>
          <SimpleGrid cols={{ base: 2, xs: 4 }} spacing={6}>
            <Field label="Total diterima">{total}</Field>
            <Field label="Total ditolak">
              <Text fz="sm" fw={600} c={totalRejected ? 'red.7' : undefined} component="span">{totalRejected}</Text>
            </Field>
            <Field label="Baris diisi">{rowsFilled} dari {po.items.length}</Field>
            <Field label="Sisa pesanan">
              <Text fz="sm" fw={600} c={sisaSetelah === 0 ? 'green.8' : undefined} component="span">
                {sisaSetelah === 0 ? 'Tidak ada · selesai' : sisaSetelah}
              </Text>
            </Field>
          </SimpleGrid>
        </Box>
      )}
      {!bappMode && !bappPlain && (
        <FileField
          label={isJasa ? 'Unggah BAPP bertanda tangan' : mixed ? 'Unggah surat jalan / BAPP (opsional)' : 'Unggah surat jalan (opsional)'}
          withAsterisk={isJasa}
          value={file}
          error={sub && err.file}
          onChange={touch(setFile)}
        />
      )}
      <Textarea label={isJasa ? 'Catatan pemeriksaan' : 'Catatan kondisi'} placeholder={isJasa ? 'Contoh: Pekerjaan sesuai lingkup, tidak ada temuan' : 'Contoh: Dus penyok, isi dalam kondisi baik'} size="sm" radius="md" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      {!bappMode && !bappPlain && (
        <Callout>
          Diterima dan ditolak dijumlah tidak boleh melebihi sisa pesanan. Qty ditolak tidak dihitung sebagai diterima,
          jadi sisa PO tetap terbuka. Tidak perlu dokumen retur bila faktur belum dibuat.
        </Callout>
      )}
    </FormModal>
  );
}

// --- Pembayaran ke vendor ----------------------------------------------------------------------
const SOURCE_ACCOUNTS = ['BCA 288-123-9001 · Kas Operasional', 'Mandiri 101-00-5577 · Kas Proyek', 'Kas kecil'];

// Strip "Dibayarkan ke": dipakai PV maupun modal pembayaran.
// "Atas nama" menempel di bawah nomor rekening — itu satu kesatuan saat mengetik transfer,
// bukan keterangan terpisah. Subtotal jadi kaki kotaknya, bukan baris lepas di bawahnya.
function PayeeStrip({ vendor, subtotalLabel, subtotal }) {
  const b = bankOf(vendor);
  const cells = [
    ['Vendor', vendor?.name, null],
    ['Bank', b?.bank, b?.branch],
    ['Nomor rekening', b?.number, b?.holder && b.holder !== vendor?.name ? `a.n. ${b.holder}` : null],
  ];
  return (
    <Box style={tableFrame}>
      <Box px="md" py={8} bg="slate.0" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.4 }}>Dibayarkan ke</Text>
      </Box>
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={0}>
        {cells.map(([k, v, sub], i) => (
          <Box key={k} px="md" py={9} style={{ minWidth: 0, borderLeft: i ? '1px solid var(--mantine-color-gray-2)' : undefined }}>
            <Text fz={11} c="slate.6">{k}</Text>
            <Text fz="sm" fw={700} c="slate.9" truncate>{v || '\u2014'}</Text>
            {sub && <Text fz={11} c="slate.6" truncate>{sub}</Text>}
          </Box>
        ))}
      </SimpleGrid>
      {subtotal != null && (
        <Group
          justify="space-between"
          px="md"
          py={9}
          bg="slate.0"
          style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}
        >
          <Text fz="xs" c="slate.6">{subtotalLabel}</Text>
          <Text fz="sm" fw={700} c="slate.9">{rupiah(subtotal)}</Text>
        </Group>
      )}
    </Box>
  );
}

// --- Terbitkan Payment Voucher dari PR yang sudah disetujui ------------------------------------
// PV adalah perintah bayar: terbit lebih dulu, baru uangnya keluar. Memisahkan keduanya membuat
// "siapa memerintahkan" dan "siapa mentransfer" jadi dua jejak yang berbeda.
export function VoucherModal({ opened, onClose, pr, pb }) {
  // Satu PR boleh mencakup faktur dari beberapa vendor, tapi satu transfer hanya bisa ke satu
  // rekening — jadi PV diterbitkan per vendor, masing-masing sebesar bagian vendor itu.
  const vendorIds = pr.vendorIds?.length ? pr.vendorIds : [pr.vendorId];
  const vendors = vendorIds.map((id) => pb.vendorsById[id]).filter(Boolean);
  const bagian = (vid) => (vendorIds.length === 1
    ? pr.amount
    : (pr.invoiceIds ?? [])
      .map((id) => pb.invoicesById[id])
      .filter((i) => i?.vendorId === vid)
      .reduce((n, i) => n + (pr.alloc?.[i.id] ?? 0), 0));
  const vendor = vendors[0];
  const bank = bankOf(vendor);
  const [date, setDate] = useState(TODAY);
  const [source, setSource] = useState(SOURCE_ACCOUNTS[0]);
  const [note, setNote] = useState('');
  const [sub, setSub] = useState(false);
  const err = {
    date: (!date && 'Tanggal PV wajib diisi') || (date > TODAY && 'Tidak boleh setelah hari ini'),
    bank: !bank?.number && 'Rekening vendor belum diisi di data kontak',
  };
  const invalid = Object.values(err).some(Boolean);
  const submit = () => {
    setSub(true);
    if (invalid) return;
    let list = pb.vouchers;
    const dibuat = [];
    vendors.forEach((v) => {
      const doc = {
        id: uid('pv'),
        number: nextNumber('PV', list),
        prIds: [pr.id],
        vendorId: v.id,
        date,
        amount: bagian(v.id),
        source,
        note,
        status: 'draf',
        issuedBy: personLabel(pb.role),
        // Diisi saat pembayaran dicatat, bukan sekarang.
        payRef: '',
        proofs: [],
      };
      list = [doc, ...list];
      pb.add('vouchers', doc);
      dibuat.push(doc);
    });
    pb.update('prs', pr.id, (d) => ({ ...d, status: 'diproses', voucherId: dibuat[0].id, voucherIds: dibuat.map((x) => x.id) }));
    toast(dibuat.length > 1
      ? `${dibuat.length} Payment Voucher terbit, satu per vendor.`
      : 'Payment Voucher terbit. Tinggal dicatat pembayarannya.');
    onClose();
  };
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={620}
      icon={CurrencyCircleDollar}
      title={vendors.length > 1 ? `Terbitkan ${vendors.length} Payment Voucher` : 'Terbitkan Payment Voucher'}
      subtitle={`${pr.number} · ${vendors.map((v) => v.name).join(', ')}`}
      footer={
        <>
          <Cancel onClick={onClose} />
          <Button radius="md" disabled={invalid} onClick={submit}>Terbitkan {vendors.length > 1 ? `${vendors.length} PV` : 'PV'}</Button>
        </>
      }
    >
      <Group
        justify="space-between"
        px="md"
        py="sm"
        bg="primary.0"
        style={{ border: '1px solid var(--mantine-color-primary-1)', borderRadius: 'var(--mantine-radius-md)' }}
      >
        <Box>
          <Text fz={11} fw={600} c="primary.9">Nominal diperintahkan</Text>
          <Text fz={11} c="slate.6">{pr.kind === 'dp' ? 'Uang muka / CBD' : 'Pelunasan faktur'}</Text>
        </Box>
        <Text fz={22} fw={700} c="primary.9">{rupiah(pr.amount)}</Text>
      </Group>

      {vendors.map((v) => (
        <PayeeStrip key={v.id} vendor={v} subtotalLabel={vendors.length > 1 ? 'PV untuk vendor ini' : 'Nilai PV'} subtotal={bagian(v.id)} />
      ))}

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <DateField label="Tanggal PV" withAsterisk size="sm" radius="md" max={TODAY} value={date} error={sub && err.date} onChange={(e) => { setSub(true); setDate(e.currentTarget.value); }} />
        <Select label="Dibayar dari" size="sm" radius="md" data={SOURCE_ACCOUNTS} value={source} onChange={(v) => setSource(v ?? SOURCE_ACCOUNTS[0])} allowDeselect={false} />
      </SimpleGrid>

      <Textarea label="Catatan" placeholder="Opsional. Contoh: dibayar setelah konfirmasi vendor." size="sm" radius="md" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />

      {sub && err.bank && <Text fz="xs" c="red.7">{err.bank}</Text>}
      <Callout>
        PV ini baru perintah bayar — kas belum berkurang. Uang keluar dicatat terpisah pada PV-nya,
        dan jurnal kas keluarnya terposting saat itu juga.
      </Callout>
    </FormModal>
  );
}

// --- Faktur uang muka (DP / CBD) ---------------------------------------------------------------
// Uang muka tidak lagi langsung diajukan lewat Payment Request: vendor menagihnya dulu
// dengan invoice uang muka, dicatat di sini sebagai faktur, baru PR dan PV menyusul —
// rantainya sama dengan pelunasan. Jurnalnya: Dr Uang Muka Pembelian / Cr Hutang Usaha.
export function DpInvoiceModal({ opened, onClose, po, pb, onSaved }) {
  const vendor = pb.vendorsById[po?.vendorId];
  const base = po ? poDpAmount(po) : 0;
  const [vendorNo, setVendorNo] = useState('');
  const [date, setDate] = useState(TODAY);
  const [dueDate, setDueDate] = useState(TODAY);
  const [amount, setAmount] = useState(base);
  const [invFile, setInvFile] = useState('');
  const [taxFile, setTaxFile] = useState('');
  const [note, setNote] = useState('');
  const [sub, setSub] = useState(false);
  if (!po) return null;
  const sudah = dpInvoiceOf(po.id, pb.invoices);
  const pct = advancePct(po.term);
  const label = pct >= 100 ? 'Bayar penuh di muka' : `Uang muka ${pct}%`;
  const err = {
    vendorNo: !vendorNo.trim() && 'No. invoice vendor wajib diisi',
    date: (!date && 'Tanggal faktur wajib diisi') || (date > TODAY && 'Tidak boleh setelah hari ini'),
    dueDate: (!dueDate && 'Jatuh tempo wajib diisi') || (dueDate < date && 'Tidak boleh sebelum tanggal faktur'),
    amount: !(amount > 0) && 'Nilai uang muka wajib diisi',
    invFile: !invFile && 'Unggah invoice uang muka dari vendor',
    sudah: sudah && `Pesanan ini sudah punya faktur uang muka ${sudah.number}`,
  };
  const invalid = Object.values(err).some(Boolean);
  const submit = () => {
    setSub(true);
    if (invalid) return;
    const doc = {
      id: uid('fkt'),
      number: nextNumber('FKT', pb.invoices),
      type: 'dp',
      vendorNo: vendorNo.trim(),
      poId: po.id,
      vendorId: po.vendorId,
      date,
      dueDate,
      // Satu baris bernilai bruto. PPN atas uang muka belum dipisah (keputusan terbuka #3
      // di spesifikasi jurnal), jadi tarifnya 0 dan PPN diakui penuh di faktur pelunasan.
      lines: [{ kind: 'dp', desc: `${label} atas ${poDocLabel(po)} ${po.number}`, unit: 'ls', qty: 1, price: amount, ppnRate: 0 }],
      pphPct: 0,
      files: [invFile, taxFile].filter(Boolean),
      note,
      createdBy: personLabel(pb.role),
    };
    pb.add('invoices', doc);
    toast('Faktur uang muka dicatat. Hutang ke vendor tercatat, tinggal diajukan Payment Request.');
    onClose();
    onSaved?.(doc.id);
  };
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={620}
      icon={FileText}
      title="Catat faktur uang muka"
      subtitle={`${po.number} · ${vendor?.name ?? ''}`}
      footer={
        <>
          <Cancel onClick={onClose} />
          <Button radius="md" onClick={submit}>Simpan faktur</Button>
        </>
      }
    >
      <Group
        justify="space-between"
        px="md"
        py="sm"
        bg="primary.0"
        style={{ border: '1px solid var(--mantine-color-primary-1)', borderRadius: 'var(--mantine-radius-md)' }}
      >
        <Box>
          <Text fz={11} fw={600} c="primary.9">{label} menurut termin</Text>
          <Text fz={11} c="slate.6">{termText(po.term)} · total {poDocLabel(po)} {rupiah(poTotal(po))}</Text>
        </Box>
        <Text fz={22} fw={700} c="primary.9">{rupiah(base)}</Text>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <TextInput label="No. invoice vendor" withAsterisk size="sm" radius="md" placeholder="Contoh: INV-DP-0012" value={vendorNo} error={sub && err.vendorNo} onChange={(e) => setVendorNo(e.currentTarget.value)} />
        <NumberField
          label="Nilai uang muka"
          withAsterisk
          money
          size="sm"
          radius="md"
          prefix="Rp "
          value={amount}
          error={sub && err.amount}
          description={amount !== base ? `Berbeda dari termin (${rupiah(base)})` : undefined}
          onChange={(v) => setAmount(Number(v) || 0)}
        />
        <DateField label="Tanggal faktur" withAsterisk size="sm" radius="md" max={TODAY} value={date} error={sub && err.date} onChange={(e) => setDate(e.currentTarget.value)} />
        <DateField label="Jatuh tempo" withAsterisk size="sm" radius="md" min={date} value={dueDate} error={sub && err.dueDate} onChange={(e) => setDueDate(e.currentTarget.value)} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <FileField label="Invoice uang muka" withAsterisk value={invFile} error={sub && err.invFile} onChange={setInvFile} />
        <FileField label="Faktur pajak uang muka (opsional)" value={taxFile} onChange={setTaxFile} />
      </SimpleGrid>

      <Textarea label="Catatan" placeholder="Opsional" size="sm" radius="md" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />

      {sub && err.sudah && <Text fz="xs" c="red.7">{err.sudah}</Text>}
      <Callout>
        Jurnalnya: Uang Muka Pembelian (debit) dan Hutang Lainnya (kredit). Kas baru berkurang saat
        PV-nya dibayar. Uang muka ini dipotongkan nanti di faktur pelunasan.
      </Callout>
    </FormModal>
  );
}

// --- Catat pembayaran atas Payment Voucher -----------------------------------------------------
export function PayModal({ opened, onClose, voucher: v, pb }) {
  const pr = pb.prsById[(v.prIds ?? [])[0]];
  const vendor = pb.vendorsById[v.vendorId];
  const bank = bankOf(vendor);
  const [proofs, setProofs] = useState(() => proofFiles(v));
  const [date, setDate] = useState(v.date || TODAY);
  const [ref, setRef] = useState(v.payRef ?? '');
  const [note, setNote] = useState('');
  const [sub, setSub] = useState(false);
  const err = {
    date: (!date && 'Tanggal bayar wajib diisi')
      || (date > TODAY && 'Tidak boleh setelah hari ini')
      || (date < v.date && `Tidak boleh sebelum tanggal PV ${formatDate(v.date)}`),
    ref: !ref.trim() && 'No. referensi transfer wajib diisi',
    proofs: !proofs.length && 'Bukti transfer wajib diunggah',
  };
  const invalid = Object.values(err).some(Boolean);
  const pay = () => {
    setSub(true);
    if (invalid) return;
    pb.update('vouchers', v.id, (d) => ({
      ...d,
      status: 'dibayar',
      paidAt: date,
      payRef: ref,
      proofs,
      paidBy: personLabel(pb.role),
      note: note || d.note,
      // Jurnal kas keluar terposting bersamaan: uang keluar dan pencatatannya satu peristiwa,
      // memisahkannya hanya menyisakan pekerjaan yang gampang terlupa.
      journalPostedAt: date,
      journalBy: personLabel(pb.role),
    }));
    if (pr) pb.update('prs', pr.id, (d) => ({ ...d, status: 'dibayar', paidAt: date }));
    toast('Pembayaran dicatat dan jurnal kas keluar diposting.');
    onClose();
  };
  const rowStyle = (i) => ({ borderTop: i ? '1px solid var(--mantine-color-gray-2)' : undefined });
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={620}
      icon={CurrencyCircleDollar}
      title="Catat pembayaran"
      subtitle={`${v.number} · ${vendor?.name}`}
      footer={
        <>
          <Cancel onClick={onClose} />
          <Button radius="md" disabled={invalid} onClick={pay}>Simpan pembayaran</Button>
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
          <Text fz={11} c="slate.6">{pr?.kind === 'dp' ? 'Uang muka / CBD' : 'Pelunasan faktur'}</Text>
        </Box>
        <Text fz={22} fw={700} c="primary.9">{rupiah(v.amount)}</Text>
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
          ].map(([k, val], i) => (
            <Group key={k} justify="space-between" wrap="nowrap" px="md" py={9} gap="md" style={rowStyle(i)}>
              <Text fz="xs" c="slate.6">{k}</Text>
              <Group gap={6} wrap="nowrap">
                <Text fz="sm" fw={700} c="slate.9">{val || '—'}</Text>
                {k === 'Nomor rekening' && val && <CopyIcon value={val} size={14} />}
              </Group>
            </Group>
          ))
        ) : (
          <Text fz="xs" c="slate.6" px="md" py="sm">Rekening vendor belum diisi di data kontak.</Text>
        )}
      </Box>

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <DateField label="Tanggal bayar" withAsterisk size="sm" radius="md" max={TODAY} min={v.date} value={date} error={sub && err.date} onChange={(e) => { setSub(true); setDate(e.currentTarget.value); }} />
        <TextInput label="No. referensi transfer" withAsterisk placeholder="Contoh: TRF-20261104-0098" size="sm" radius="md" value={ref} error={sub && err.ref} onChange={(e) => { setSub(true); setRef(e.currentTarget.value); }} />
      </SimpleGrid>

      <DropField
        label="Bukti transfer"
        withAsterisk
        multiple
        value={proofs}
        onChange={(v2) => { setSub(true); setProofs(v2); }}
        error={sub && err.proofs}
      />

      <Textarea label="Catatan pembayaran" placeholder="Opsional. Contoh: transfer dipecah dua kali karena limit harian." size="sm" radius="md" autosize minRows={2} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
    </FormModal>
  );
}

export function ReturnModal({ opened, onClose, invoice, pb }) {
  const { postStock, products, stockMoves, stockOpnames, warehouses } = useData();
  const po = pb.posById[invoice.poId];
  // O4: retur mengeluarkan barang dari gudang, jadi ia ikut ditahan selama
  // gudang itu diopname — sama seperti penerimaan dan pindah barang.
  const beku = frozenMessage(
    stockOpnames,
    po?.warehouseId,
    warehouses.find((w) => w.id === po?.warehouseId)?.name ?? 'Gudang',
  );
  const [date, setDate] = useState(TODAY);
  const [reason, setReason] = useState('');
  const [settlement, setSettlement] = useState('potong');
  // Vendor biasanya hanya mengurangi tagihan sebesar barangnya; ongkirnya sudah
  // terlanjur dibayar. Dicentang bila vendor ikut mengembalikan ongkir.
  const [freightRefunded, setFreightRefunded] = useState(false);
  const [qtys, setQtys] = useState({});
  const [sub, setSub] = useState(false);

  const rows = invoice.lines.map((l, idx) => ({ l, idx })).filter(({ l }) => itemKind(po, l.itemId) === 'barang').map(({ l, idx }) => {
    const item = po.items.find((i) => i.id === l.itemId);
    const product = productOfItem(products, item);
    // Penerimaan asalnya dicari lewat FPB yang difakturkan di baris ini, supaya
    // harga perolehannya milik FPB itu — bukan penerimaan terakhir produk yang sama.
    const rcDate = pb.receipts.find((x) => x.id === l.receiptId)?.date ?? invoice.date;
    const asal = sourceReceiptMove(stockMoves, product, po?.warehouseId, l.receiptId, rcDate);
    const dilacak = !!product?.tracked;
    // Batas qty: sisa yang belum diretur dari faktur, DAN stok yang benar-benar
    // masih ada di gudang (M3/H16) — barang yang sudah dipakai tidak bisa diretur.
    const sisaFaktur = Math.max(l.qty - returnedQty(invoice.id, l.itemId, pb.returns), 0);
    const stok = dilacak && po?.warehouseId ? getBalance(stockMoves, product.id, po.warehouseId, date) : Infinity;
    return {
      key: `${l.itemId}:${idx}`,
      itemId: l.itemId,
      receiptId: l.receiptId ?? null,
      productId: product?.id ?? null,
      tracked: dilacak,
      desc: item.desc,
      unit: item.unit,
      price: l.price,
      rate: lineRate(l),
      // Harga perolehan asli — dipakai menilai barang keluar, tidak bisa diubah.
      cost: asal ? asal.unitCost : l.price,
      costFrom: asal?.sourceNo ?? null,
      // Ongkir ikut harga barang hanya bila penerimaannya dulu memang begitu;
      // kebijakan yang berlaku sekarang tidak mengubah dokumen yang sudah lewat.
      ongkirDiHarga: !!asal?.costBreakdown?.freightCapitalized && (asal.costBreakdown.freight || 0) > 0,
      noSource: dilacak && !asal,
      sisaFaktur,
      stok,
      max: Math.max(0, Math.min(sisaFaktur, stok === Infinity ? sisaFaktur : stok)),
    };
  });

  const picked = rows.filter((r) => (qtys[r.key] || 0) > 0);
  const adaOngkir = rows.some((r) => r.ongkirDiHarga);
  // Stok hari ini cukup belum tentu cukup pada hari-hari sesudahnya bila ada
  // dokumen bertanggal mundur, jadi dicek dengan canIssue, bukan sekadar saldo.
  const stokKurang = (r) => {
    const q = qtys[r.key] || 0;
    if (!r.tracked || q <= 0) return null;
    const cek = canIssue(stockMoves, r.productId, po.warehouseId, date, q);
    return cek.ok ? null : Math.max(0, cek.available);
  };
  const errors = {
    reason: !reason.trim() && 'Alasan retur wajib diisi',
    qty: !picked.length && 'Isi qty retur minimal satu item',
    beku,
    source:
      picked.some((r) => r.noSource) &&
      'Penerimaan asal tidak ditemukan untuk salah satu barang — harga perolehannya tidak bisa dipastikan',
    stock: picked.some((r) => stokKurang(r) !== null) && 'Qty retur melebihi stok yang masih ada di gudang',
  };
  const blocked = errors.beku || errors.reason || errors.qty || errors.source || errors.stock;
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
            {...blockedProps(blocked, () => setSub(true))}
            onClick={() => {
              setSub(true);
              if (blocked) return;
              const returnId = uid('rtr');
              const number = nextNumber('RTR', pb.returns);
              // receiptId ikut disimpan: dialah yang menentukan harga perolehan
              // mana yang dipakai, sekarang maupun saat dokumen dibaca lagi.
              const lines = picked.map((r) => ({
                itemId: r.itemId,
                receiptId: r.receiptId,
                qty: qtys[r.key],
                price: r.price,
              }));
              pb.add('returns', {
                id: returnId,
                number,
                invoiceId: invoice.id,
                vendorId: invoice.vendorId,
                date,
                reason,
                settlement,
                freightRefunded: adaOngkir ? freightRefunded : false,
                status: 'selesai',
                lines,
              });
              // Barang keluar dari gudang dengan harga perolehan aslinya.
              postReturnStock({
                returnId,
                number,
                date,
                po,
                lines,
                postStock,
                products,
                moves: stockMoves,
                receipts: pb.receipts,
                by: personLabel(pb.role),
                billed: true,
                freightRefunded: adaOngkir ? freightRefunded : false,
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
      {errors.beku && (
        <Callout tone="warn" title="Gudang sedang diopname">
          {errors.beku}. Retur ditahan sampai opname-nya diposting atau dibatalkan, supaya saldo
          buku yang dibekukan tidak bergeser di tengah hitungan.
        </Callout>
      )}
      <TextInput label="Alasan retur" placeholder="Contoh: Barang rusak saat diterima" withAsterisk size="sm" radius="md" value={reason} error={sub && errors.reason} onChange={(e) => setReason(e.currentTarget.value)} />
      {adaOngkir && (
        <Checkbox
          size="sm"
          label="Ongkir ikut dikembalikan vendor"
          description="Ongkir barang ini dulu masuk harga perolehan. Bila tidak dicentang, porsi ongkir yang diretur dibebankan ke Pengiriman & Pengangkutan."
          checked={freightRefunded}
          onChange={(e) => setFreightRefunded(e.currentTarget.checked)}
        />
      )}
      <Box style={tableFrame}>
        <Table verticalSpacing="xs" horizontalSpacing="sm" styles={th}>
          <Table.Thead bg="slate.0">
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th ta="right">Stok di gudang</Table.Th>
              <Table.Th ta="right">Bisa diretur</Table.Th>
              <Table.Th w={120}>Qty retur</Table.Th>
              <Table.Th ta="right">Nilai</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.key}>
                <Table.Td fz="sm" fw={600}>
                  {r.desc}
                  {r.noSource ? (
                    <Text fz={11} fw={600} c="red.7">
                      Penerimaan asal tidak ditemukan — harga perolehannya tidak bisa dipastikan
                    </Text>
                  ) : (
                    <Text fz={11} fw={500} c="slate.6">
                      Harga perolehan {rupiah(Math.round(r.cost))}/{r.unit}
                      {r.costFrom ? ` (dari ${r.costFrom})` : ''}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td ta="right" fz="sm" c={r.tracked ? undefined : 'slate.5'}>
                  {r.tracked ? `${r.stok} ${r.unit}` : '—'}
                </Table.Td>
                <Table.Td ta="right" fz="sm">
                  {r.max} {r.unit}
                  {r.tracked && r.stok < r.sisaFaktur && (
                    <Text fz={11} c="orange.7">
                      Dibatasi stok (faktur {r.sisaFaktur})
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <NumberField
                    size="xs"
                    radius="md"
                    min={0}
                    max={r.max}
                    disabled={r.max === 0 || r.noSource}
                    value={qtys[r.key] ?? 0}
                    error={sub && stokKurang(r) !== null}
                    onChange={(v) => setQtys((q) => ({ ...q, [r.key]: Math.min(Number(v) || 0, r.max) }))}
                  />
                  {sub && stokKurang(r) !== null && (
                    <Text fz={11} c="red.7">
                      Tersedia {stokKurang(r)} {r.unit}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td ta="right" fz="sm">{rupiah((qtys[r.key] || 0) * r.price)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
      {sub && blocked && blocked !== errors.reason && <Text fz="xs" c="red.7">{blocked}</Text>}
      <Group justify="space-between">
        <Text fz="sm" fw={700}>Nilai retur (termasuk PPN)</Text>
        <Text fz="md" fw={700}>{rupiah(Math.round(picked.reduce((n, r) => n + qtys[r.key] * r.price * (1 + r.rate), 0)))}</Text>
      </Group>
      <Callout>Retur hanya untuk barang. Untuk jasa, koreksi lewat revisi BAPP atau potongan di faktur.</Callout>
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
      title={po.sent ? `Kirim ulang ${label} ke email vendor?` : `Kirim ${label} ke email vendor?`}
      subtitle={`${po.number} · ${vendor?.name ?? '—'}`}
      footer={
        <>
          <Cancel onClick={onClose} />
          <Button radius="md" leftSection={<PaperPlaneTilt size={16} />} disabled={!email} onClick={send}>
            {po.sent ? 'Kirim ulang' : 'Kirim ke vendor'}
          </Button>
        </>
      }
    >
      <Box p="sm" bg="slate.0" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
        <Stack gap={6}>
          {row('Kepada', email ? <>{email}<Text fz={11} fw={400} c="slate.6" component="span" display="block">{vendor?.pic ? `u.p. ${vendor.pic}` : ''}</Text></> : 'Email vendor belum diisi')}
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

      {po.sent ? (
        <Callout title="Dokumen ini sudah pernah dikirim">
          Isinya sama persis dengan yang dulu dikirim; yang berubah hanya tujuan, CC, dan pesannya. Tanggal
          kirim pertama tetap dipakai sebagai acuan, pengiriman ulang dicatat terpisah di jejak dokumen.
        </Callout>
      ) : (
        <Callout tone="warn" title="Setelah dikirim">
          {label} tercatat sudah lepas ke vendor dan isinya tidak bisa diubah lagi. Penerimaan
          tidak menunggu langkah ini — FPB / BAPP boleh dicatat lebih dulu kalau barang atau pekerjaannya
          memang sudah datang.
        </Callout>
      )}
    </FormModal>
  );
}

// --- Alasan (tolak / kembalikan) -------------------------------------------------------------------
// --- Detail penawaran vendor ----------------------------------------------------------------------
// Menggantikan accordion di tabel penawaran: rincian per item plus keterangan yang tidak muat
// di tabel (masa berlaku, deskripsi, berkas) dikumpulkan di satu tempat.
// Satu kelompok keterangan sebagai kartu: judul di kepala berlatar abu, isinya di badan.
// Bentuknya sama dengan tabel di modal ini, jadi keduanya terbaca sebagai satu bahasa.
function InfoCard({ title, children }) {
  return (
    <Box style={tableFrame}>
      <Box px="md" py={8} bg="slate.0" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }}>{title}</Text>
      </Box>
      <Box px="md" py="sm">{children}</Box>
    </Box>
  );
}

// Satu keterangan dengan baris kedua opsional — mis. nama termin lalu jatuh temponya.
// Tidak memakai Field karena nilainya perlu dua baris terpisah, bukan satu paragraf.
function Pair({ label, value, sub }) {
  return (
    <Box style={{ minWidth: 0 }}>
      <Text fz={11} c="slate.6">{label}</Text>
      <Text fz="sm" fw={600} c="slate.9" lh={1.35} style={{ overflowWrap: 'anywhere' }}>{value}</Text>
      {sub && <Text fz={11} c="slate.6" lh={1.35}>{sub}</Text>}
    </Box>
  );
}

export function QuoteDetailModal({ opened, onClose, quote: q, fppbj, pb }) {
  if (!q || !fppbj) return null;
  const name = pb.vendorsById[q.vendorId]?.name ?? q.vendorId;
  const t = quoteTotals(q, fppbj.items);
  const isJasa = poAllJasa(fppbj);
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={760}
      icon={Storefront}
      title="Detail penawaran"
      subtitle={`${name} · ${q.no}`}
      footer={<Button radius="md" variant="default" onClick={onClose}>Tutup</Button>}
    >
      <Stack gap="md">
        {/* Dua kelompok terpisah: siapa & kapan penawarannya, lalu syarat yang disanggupi.
            Total penawaran tidak diulang di sini — angkanya ada di kaki tabel harga. */}
        <InfoCard title="Penawaran">
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md" verticalSpacing="sm">
            <Pair label="Vendor" value={name} />
            <Pair label="No. penawaran" value={q.no} />
            <Pair label="Berlaku sampai" value={q.validUntil ? formatDate(q.validUntil) : '—'} />
          </SimpleGrid>
        </InfoCard>

        <InfoCard title="Ketentuan">
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md" verticalSpacing="sm">
            <Pair label={isJasa ? 'Waktu pengerjaan' : 'Waktu kirim'} value={`${q.lead} hari`} />
            <Pair label="Garansi" value={q.warranty || '—'} />
          </SimpleGrid>
          {/* Termin dirinci per tahap: berapa dan kapan jatuh tempo tiap pembayaran. */}
          <Box mt="sm">
            <Text fz={11} c="slate.6" mb={4}>Termin bayar</Text>
            <TermBreakdown term={q.term} total={t.total} jasa={isJasa} />
          </Box>
        </InfoCard>

        {q.desc?.trim() && (
          <Box>
            <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }} mb={6}>Keterangan vendor</Text>
            <Text fz="sm" c="slate.8" style={{ whiteSpace: 'pre-wrap' }}>{q.desc}</Text>
          </Box>
        )}

        <Box>
          <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }} mb={8}>Harga per item</Text>
          <Box style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)', overflow: 'auto' }}>
            <Table verticalSpacing="xs" horizontalSpacing="sm" miw={560} styles={{ th: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600, color: 'var(--mantine-color-slate-7)', whiteSpace: 'nowrap' } }}>
              <Table.Thead bg="slate.0">
                <Table.Tr>
                  <Table.Th>Barang atau jasa</Table.Th>
                  <Table.Th ta="right" w={90}>Jumlah</Table.Th>
                  <Table.Th ta="right" w={150}>Harga satuan</Table.Th>
                  <Table.Th ta="right" w={150}>Jumlah harga</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {fppbj.items.map((it) => {
                  const l = q.lines.find((x) => x.itemId === it.id);
                  return (
                    <Table.Tr key={it.id}>
                      <Table.Td>
                        <Text fz="sm" fw={600} c="slate.9">{it.desc}</Text>
                        {/* Spesifikasi hanya ditampilkan kalau memang diisi; tanda hubung bukan isi. */}
                        {l?.spec?.trim() && l.spec.trim() !== '-' && <Text fz={11} c="slate.6">{l.spec.trim()}</Text>}
                      </Table.Td>
                      <Table.Td ta="right" fz="sm" style={{ whiteSpace: 'nowrap' }}>{it.qty} {it.unit}</Table.Td>
                      <Table.Td ta="right">
                        {l ? (
                          <>
                            <Text fz="sm" fw={600}>{rupiah(l.price)}</Text>
                            <Text fz={10} c="slate.6" fw={500}>{taxSummary(lineTaxes(q, l))}</Text>
                          </>
                        ) : (
                          <Badge size="sm" radius="sm" variant="light" color="gray" fw={700} tt="none">Tidak ditawar</Badge>
                        )}
                      </Table.Td>
                      <Table.Td ta="right" fz="sm" fw={700}>{l ? rupiah(l.price * it.qty) : '—'}</Table.Td>
                    </Table.Tr>
                  );
                })}
                {/* Subtotal hanya perlu dipisahkan kalau ada diskon atau ongkir yang mengubahnya. */}
                {(t.disc > 0 || t.ship > 0) && (
                  <Table.Tr>
                    <Table.Td colSpan={3} ta="right" fz="xs" c="slate.6">Subtotal item</Table.Td>
                    <Table.Td ta="right" fz="sm" fw={600}>{rupiah(t.base)}</Table.Td>
                  </Table.Tr>
                )}
                {t.disc > 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={3} ta="right" fz="xs" c="slate.6">Diskon {quoteDiscountLabel(q)}</Table.Td>
                    <Table.Td ta="right" fz="sm" fw={600} c="green.8">-{rupiah(t.disc)}</Table.Td>
                  </Table.Tr>
                )}
                {t.ship > 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={3} ta="right" fz="xs" c="slate.6">Ongkos kirim</Table.Td>
                    <Table.Td ta="right" fz="sm" fw={600}>{rupiah(t.ship)}</Table.Td>
                  </Table.Tr>
                )}
                <Table.Tr bg="slate.0">
                  <Table.Td colSpan={3} ta="right" fz="sm" fw={700} c="slate.9">Total penawaran</Table.Td>
                  <Table.Td ta="right" fz="sm" fw={700} c="slate.9">{rupiah(t.total)}</Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Box>
        </Box>

        <Box>
          <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }} mb={8}>Berkas penawaran</Text>
          {q.file ? <AttachmentList names={[q.file]} label={`Penawaran ${name}`} /> : <Text fz="xs" c="slate.6">Tidak ada berkas dilampirkan.</Text>}
        </Box>
      </Stack>
    </FormModal>
  );
}

// --- Konfirmasi hapus penawaran vendor ------------------------------------------------------------
export function ConfirmDeleteQuoteModal({ opened, onClose, quote, fppbj, pb, onConfirm }) {
  if (!quote || !fppbj) return null;
  const name = pb.vendorsById[quote.vendorId]?.name ?? quote.vendorId;
  const nilai = quoteTotals(quote, fppbj.items).total;
  const isWinner = Object.values(fppbj.procurement?.winners ?? {}).includes(quote.vendorId);
  const sisa = fppbj.quotes.length - 1;
  const perluLagi = Math.max(0, minQuotesFor(fppbj) - sisa);
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={520}
      icon={Warning}
      title="Hapus penawaran ini?"
      subtitle={`${name} · ${quote.no}`}
      footer={
        <>
          <Cancel onClick={onClose} />
          <Button radius="md" color="red" onClick={onConfirm}>Hapus penawaran</Button>
        </>
      }
    >
      <Stack gap="sm">
        <SimpleGrid cols={2}>
          <Field label="Vendor">{name}</Field>
          <Field label="Nilai penawaran">{rupiah(nilai)}</Field>
        </SimpleGrid>
        <Text fz="sm" c="slate.7">
          Seluruh harga per item, pajak, spesifikasi, dan ketentuan pada penawaran ini ikut terhapus.
          {isWinner && ' Vendor ini sedang ditetapkan sebagai pemenang, jadi pemenangnya ikut dilepas.'}
          {fppbj.procurement?.status === 'diajukan' && ' Pengajuan ke approver juga ditarik kembali ke draf.'}
        </Text>
        {!fppbj.single?.on && perluLagi > 0 && (
          <Callout tone="warn">
            Sisa {sisa} penawaran. Bidding butuh minimal {minQuotesFor(fppbj)}, jadi masih kurang {perluLagi} lagi
            sebelum pengadaan bisa diajukan.
          </Callout>
        )}
        <Callout tone="stop">Penghapusan ini tidak bisa dibatalkan — penawarannya harus diunggah ulang.</Callout>
      </Stack>
    </FormModal>
  );
}

// --- Konfirmasi ganti jalur pengadaan -------------------------------------------------------------
// Hanya muncul kalau pergantiannya benar-benar berakibat (lihat routeSwitchEffects). Isinya
// menyebut akibatnya satu per satu, bukan peringatan umum "data akan hilang" — karena memang
// tidak ada penawaran yang dihapus.
export function SwitchRouteModal({ opened, onClose, mode, fppbj, pb, onConfirm }) {
  if (!mode || !fppbj) return null;
  const toSingle = mode === 'single';
  const label = toSingle ? 'vendor tunggal' : 'bidding';
  const effects = routeSwitchEffects(fppbj, mode, (id) => pb.vendorsById[id]?.name ?? id);
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={520}
      icon={Warning}
      title={`Ganti jalur ke ${label}?`}
      subtitle={`${fppbj.number} · ${fppbj.purpose}`}
      footer={
        <>
          <Cancel onClick={onClose} />
          <Button radius="md" onClick={onConfirm}>Ganti ke {label}</Button>
        </>
      }
    >
      <Stack gap="sm">
        <Text fz="sm" c="slate.7">Yang berubah kalau jalur diganti:</Text>
        <Stack gap={8}>
          {effects.map((e) => (
            <Group key={e} gap={8} wrap="nowrap" align="flex-start">
              <Box mt={6} style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--mantine-color-slate-5)', flexShrink: 0 }} />
              <Text fz="sm" c="slate.8" lh={1.45}>{e}</Text>
            </Group>
          ))}
        </Stack>
        <Callout>
          Tidak ada penawaran yang dihapus. Semua data penawaran tetap tersimpan, dan kembali ke jalur semula akan
          memunculkannya lagi utuh.
        </Callout>
      </Stack>
    </FormModal>
  );
}

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
  const titles = { receipts: doc.kind === 'jasa' ? 'Detail BAPP' : 'Detail penerimaan barang (FPB)', invoices: 'Detail faktur pembelian', prs: 'Detail Payment Request', returns: 'Detail retur pembelian' };
  const showLines = kind !== 'prs';
  const t = kind === 'invoices' ? invTotals(doc, pb.calc) : null;
  return (
    <FormModal opened={opened} onClose={onClose} size={680} icon={ClipboardText} title={titles[kind]} subtitle={doc.number} footer={<Button radius="md" variant="default" onClick={onClose}>Tutup</Button>}>
      <SimpleGrid cols={{ base: 2, sm: 3 }}>
        <Field label="Vendor">{vendor?.name}</Field>
        <Field label="Tanggal">{formatDate(doc.date)}</Field>
        {po && <Field label={poDocLabel(po)}>{po.number}</Field>}
        {doc.doNumber && <Field label="Surat jalan / BAPP">{doc.doNumber}</Field>}
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

