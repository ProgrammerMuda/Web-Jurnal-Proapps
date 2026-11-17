import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import NumberField from '@/components/NumberField.jsx';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  Check,
  ClipboardText,
  FilePlus,
  FileText,
  Invoice,
  PencilSimple,
  Plus,
  Trash,
  User,
  Warning,
} from '@/components/Icon.jsx';
import { BackLink, blockedProps, PageIntro } from './components.jsx';
import { DOC } from './docTypes.js';
import { useData } from '@/lib/store.jsx';
import { canBeInvoiced, formatAddress } from '@/pages/Kontak/utils.js';
import {
  lockedMessage,
  paymentTerms,
  periodLocked,
  products,
  taxes,
  TODAY,
} from './data.js';
import {
  addDays,
  computeTotals,
  lineAmount,
  logActivity,
  nextInvoiceNumber,
  nowIso,
  rupiah,
} from './utils.js';

const emptyLine = () => ({ productId: null, description: '', qty: 1, price: 0, tax: null });

const initialForm = () => ({
  customerId: null,
  number: '',
  date: TODAY,
  dueDate: TODAY,
  term: null,
  ref: '',
  // #27: unit/tower yang ditagih.
  unit: '',
  // #32: e-Faktur / Coretax.
  taxInvoiceNumber: '',
  dppOther: 0,
  billingAddress: '',
  taxInclusive: false,
  items: [emptyLine()],
  discountType: 'percent',
  discountValue: 0,
  withholdingType: 'nominal',
  withholdingValue: 0,
  withholdingAccount: null,
  message: '',
  memo: '',
  // Hanya dipakai dokumen yang punya syarat & ketentuan (penawaran, pesanan).
  terms: '',
  // Catatan alamat pengiriman yang terbawa dari pesanan (S11).
  shippingNote: '',
  payments: [],
});

const productOptions = products.map((p) => ({ value: p.id, label: p.name }));
const typeOptions = [
  { value: 'percent', label: 'Persentase (%)' },
  { value: 'nominal', label: 'Nominal (Rp)' },
];

// Memilih kontak mengisi alamat penagihan & termin default dari profil kontaknya.
function customerPatch(contact, date, termDrivesDue) {
  if (!contact) return { customerId: null };
  const days = paymentTerms.find((t) => t.value === contact.term)?.days;
  return {
    customerId: contact.id,
    billingAddress: formatAddress(contact.billing),
    term: contact.term ?? null,
    // S3: tanggal hanya ikut termin pada dokumen yang memang menagih (faktur).
    ...(termDrivesDue && days != null && { dueDate: addDays(date, days) }),
  };
}

function GeneralStep({ form, set, errors, doc, sources, onPickSource }) {
  const { contacts, contactsById } = useData();
  const customerOptions = contacts
    .filter(canBeInvoiced)
    .map((c) => ({ value: c.id, label: c.displayName }));
  const ikutTermin = doc.fields.termDrivesDue;
  const pickCustomer = (id) =>
    set({ ...customerPatch(contactsById[id], form.date, ikutTermin), sourceKey: null });
  // Termin mengatur jatuh tempo faktur. Di penawaran dan pesanan, tanggalnya berdiri
  // sendiri (masa berlaku / target selesai) dan tidak ikut berubah (S3).
  const pickTerm = (term) => {
    const days = paymentTerms.find((t) => t.value === term)?.days;
    set({ term, ...(ikutTermin && days != null && { dueDate: addDays(form.date, days) }) });
  };
  const pickDate = (date) => {
    const days = paymentTerms.find((t) => t.value === form.term)?.days;
    set({ date, ...(ikutTermin && days != null && date && { dueDate: addDays(date, days) }) });
  };

  return (
    <Stack gap="sm">
      <SimpleGrid cols={2} spacing="sm">
        <Select
          label="Pelanggan / Unit"
          placeholder="Pilih kontak pelanggan..."
          withAsterisk
          searchable
          radius="md"
          data={customerOptions}
          value={form.customerId}
          onChange={pickCustomer}
          error={errors.customerId}
        />
        <TextInput
          label={doc.numberLabel}
          placeholder="Kosongkan untuk nomor otomatis"
          radius="md"
          value={form.number}
          error={errors.number}
          onChange={(e) => set({ number: e.currentTarget.value })}
        />
        <TextInput
          type="date"
          label={doc.dateLabel}
          withAsterisk
          radius="md"
          leftSection={<CalendarBlank size={14} />}
          value={form.date}
          onChange={(e) => pickDate(e.currentTarget.value)}
          error={errors.date}
        />
        <TextInput
          type="date"
          label={doc.dueLabel}
          withAsterisk
          radius="md"
          leftSection={<CalendarBlank size={14} />}
          value={form.dueDate}
          min={form.date}
          onChange={(e) => set({ dueDate: e.currentTarget.value, term: 'custom' })}
          error={errors.dueDate}
        />
        <Select
          label="Syarat Pembayaran"
          placeholder="Pilih termin (COD, Net 30, dll)..."
          radius="md"
          data={paymentTerms}
          value={form.term}
          onChange={pickTerm}
        />
        <TextInput
          label="Unit / Tower"
          placeholder="Misal: Tower A / Unit 12-03"
          radius="md"
          value={form.unit}
          onChange={(e) => set({ unit: e.currentTarget.value })}
        />
        <TextInput
          label="Nomor Referensi Pelanggan (PO / Ref)"
          placeholder="Misal: PO-2026/05"
          radius="md"
          value={form.ref}
          onChange={(e) => set({ ref: e.currentTarget.value })}
        />
      </SimpleGrid>
      {/* #7: dokumen sumber bisa dipilih di sini, bukan hanya lewat tombol di
          halaman detail dokumen asalnya. Hanya milik pelanggan yang dipilih. */}
      {sources && (
        <Select
          label={doc.fields.sourceLabel}
          description="Opsional. Kosongkan untuk dokumen yang berdiri sendiri."
          placeholder={
            form.customerId
              ? sources.length
                ? 'Pilih dokumen sumber...'
                : 'Tidak ada dokumen yang bisa diambil'
              : 'Pilih pelanggan dulu'
          }
          radius="md"
          clearable
          searchable
          disabled={!form.customerId || !sources.length}
          data={sources}
          value={form.sourceKey ?? null}
          onChange={onPickSource}
          leftSection={<ClipboardText size={14} />}
        />
      )}

      {doc.fields.billing && (
        <Textarea
          label={doc.fields.billing}
          placeholder={`${doc.fields.billing} lengkap...`}
          radius="md"
          autosize
          minRows={2}
          value={form.billingAddress}
          onChange={(e) => set({ billingAddress: e.currentTarget.value })}
        />
      )}
    </Stack>
  );
}

function ItemsStep({ form, set, errors, doc }) {
  const update = (i, patch) =>
    set({ items: form.items.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  const pickProduct = (i, id) => {
    const p = products.find((x) => x.id === id);
    // Pajak bawaan produk ikut terisi supaya penawaran, pesanan, dan faktur konsisten (P10).
    update(i, {
      productId: id,
      description: p?.description ?? '',
      price: p?.price ?? 0,
      tax: p?.tax ?? null,
    });
  };
  const remove = (i) =>
    set({
      items: form.items.length > 1 ? form.items.filter((_, idx) => idx !== i) : [emptyLine()],
    });

  return (
    <Stack gap="md">
      {/* Saklar pajak ada di langkah ini karena mengubah arti kolom Harga Satuan,
          dan diletakkan di kanan sejajar judul tabel agar terbaca sebagai pengaturan tabel. */}
      <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
        <Box>
          <Text fz="sm" fw={600} c="slate.9">
            {doc.fields.linesTitle}
          </Text>
          <Text fz={11} c="slate.6">
            {form.items.length} baris
          </Text>
        </Box>
        <Switch
          size="sm"
          labelPosition="left"
          label="Harga sudah termasuk pajak"
          description="Pajak dipisahkan dari harga satuan, bukan ditambahkan."
          checked={form.taxInclusive}
          onChange={(e) => set({ taxInclusive: e.currentTarget.checked })}
          styles={{ body: { alignItems: 'center' }, labelWrapper: { textAlign: 'right' } }}
        />
      </Group>

      <Box
        className="table-frame"
        style={{
          border: '1px solid var(--mantine-color-gray-3)',
          borderRadius: 'var(--mantine-radius-md)',
          overflow: 'auto',
        }}
      >
        <Table
          verticalSpacing="sm"
          horizontalSpacing="md"
          miw={940}
          styles={{
            th: {
              fontSize: 'var(--mantine-font-size-xs)',
              color: 'var(--mantine-color-slate-7)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            },
          }}
        >
          <Table.Thead bg="slate.0">
            <Table.Tr>
              <Table.Th>Produk / jasa</Table.Th>
              <Table.Th w={96} ta="right">
                Qty
              </Table.Th>
              <Table.Th w={190} ta="right">
                Harga satuan
              </Table.Th>
              <Table.Th w={170}>Pajak</Table.Th>
              <Table.Th w={150} ta="right">
                Total
              </Table.Th>
              <Table.Th w={52} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {form.items.map((line, i) => (
              <Table.Tr key={i} style={{ verticalAlign: 'top' }}>
                <Table.Td>
                  <Stack gap={6}>
                    <Select
                      size="sm"
                      radius="md"
                      placeholder="Pilih produk atau jasa..."
                      searchable
                      data={productOptions}
                      value={line.productId}
                      onChange={(id) => pickProduct(i, id)}
                      error={!!errors.items && !line.productId}
                    />
                    <TextInput
                      size="xs"
                      radius="md"
                      placeholder="Deskripsi baris (opsional)..."
                      value={line.description}
                      onChange={(e) => update(i, { description: e.currentTarget.value })}
                    />
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <NumberField
                    size="sm"
                    radius="md"
                    min={1}
                    allowNegative={false}
                    decimalScale={0}
                    ta="right"
                    value={line.qty}
                    onChange={(v) => update(i, { qty: Number(v) || 0 })}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberField
                    money
                    size="sm"
                    radius="md"
                    ta="right"
                    prefix="Rp "
                    value={line.price}
                    onChange={(v) => update(i, { price: Number(v) || 0 })}
                  />
                </Table.Td>
                <Table.Td>
                  <Select
                    size="sm"
                    radius="md"
                    placeholder="Tanpa pajak"
                    clearable
                    data={taxes}
                    value={line.tax}
                    onChange={(v) => update(i, { tax: v })}
                  />
                </Table.Td>
                {/* Jumlah per baris: qty x harga, supaya tiap baris bisa dicek sendiri
                    tanpa menunggu total di bawah. */}
                <Table.Td ta="right">
                  <Text fz="sm" fw={700} c="slate.9" mt={7} style={{ whiteSpace: 'nowrap' }}>
                    {rupiah(lineAmount(line))}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="slate"
                    radius="md"
                    mt={4}
                    onClick={() => remove(i)}
                    aria-label={`Hapus baris ${i + 1}`}
                  >
                    <Trash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>

      {errors.items && (
        <Text fz="xs" c="red.7">
          {errors.items}
        </Text>
      )}

      <Group>
        <Button
          size="xs"
          radius="md"
          variant="light"
          leftSection={<Plus size={14} />}
          onClick={() => set({ items: [...form.items, emptyLine()] })}
        >
          Tambah baris
        </Button>
      </Group>
    </Stack>
  );
}

function ExtrasStep({ form, set, doc }) {
  return (
    <Stack gap="sm">
      <Group grow gap="sm" align="flex-start">
        <Select
          label="Tipe Diskon"
          radius="md"
          allowDeselect={false}
          data={typeOptions}
          value={form.discountType}
          onChange={(v) => set({ discountType: v })}
        />
        {/* Format rupiah hanya dipakai saat nilainya nominal; dalam persen "10,00%"
            hanya membingungkan. */}
        <NumberField
          label="Nilai Diskon"
          radius="md"
          money={form.discountType === 'nominal'}
          min={0}
          prefix={form.discountType === 'nominal' ? 'Rp ' : undefined}
          suffix={form.discountType === 'percent' ? '%' : undefined}
          max={form.discountType === 'percent' ? 100 : undefined}
          value={form.discountValue}
          onChange={(v) => set({ discountValue: Number(v) || 0 })}
          style={{ flexGrow: 2 }}
        />
      </Group>
      {/* #32: data e-Faktur. Hanya faktur yang dilaporkan ke Coretax. */}
      {doc.kind === 'invoice' && (
        <SimpleGrid cols={2} spacing="sm">
          <TextInput
            label="Nomor Seri Faktur Pajak"
            placeholder="010.000-26.00000000"
            description="Diisi saat faktur pajak diterbitkan di Coretax"
            radius="md"
            value={form.taxInvoiceNumber}
            onChange={(e) => set({ taxInvoiceNumber: e.currentTarget.value })}
          />
          <NumberField
            money
            label="DPP Nilai Lain"
            description="Kosongkan bila DPP-nya sama dengan subtotal setelah diskon"
            radius="md"
            prefix="Rp "
            value={form.dppOther}
            onChange={(v) => set({ dppOther: Number(v) || 0 })}
          />
        </SimpleGrid>
      )}

      {doc.fields.terms && (
        <Textarea
          label={doc.fields.terms}
          description="Masa berlaku harga, waktu pengerjaan, garansi, atau syarat lain yang mengikat penawaran ini."
          placeholder={'Contoh:\n• Harga berlaku sampai tanggal di atas\n• Waktu pengerjaan 14 hari kerja setelah PO diterima\n• Pembayaran 50% di muka'}
          radius="md"
          autosize
          minRows={3}
          value={form.terms}
          onChange={(e) => set({ terms: e.currentTarget.value })}
        />
      )}
      <Textarea
        label={`Pesan di ${doc.word.charAt(0).toUpperCase() + doc.word.slice(1)}`}
        placeholder="Terima kasih atas kerja sama Anda..."
        radius="md"
        autosize
        minRows={2}
        value={form.message}
        onChange={(e) => set({ message: e.currentTarget.value })}
      />
      <Textarea
        label="Memo Internal"
        placeholder="Catatan internal yang tidak terlihat oleh pelanggan..."
        radius="md"
        autosize
        minRows={2}
        value={form.memo}
        onChange={(e) => set({ memo: e.currentTarget.value })}
      />
    </Stack>
  );
}


// Pita ringkasan tagihan: full-bleed di dalam kartu form, tepat di atas tombol.
// Baris yang nilainya nol tidak ditampilkan agar yang terbaca hanya yang berlaku.
function TotalsBand({ totals, taxed, inclusive, totalLabel }) {
  const parts = [
    { label: 'Subtotal', value: rupiah(totals.subtotal) },
    totals.discount > 0 && {
      label: 'Diskon',
      value: `-${rupiah(totals.discount)}`,
      color: 'red.7',
    },
    taxed &&
      (inclusive
        ? { label: 'Termasuk PPN', value: rupiah(totals.tax), muted: true }
        : { label: 'PPN', value: `+${rupiah(totals.tax)}` }),
    totals.withholding > 0 && {
      label: 'Potongan (PPh)',
      value: `-${rupiah(totals.withholding)}`,
      color: 'red.7',
    },
  ].filter(Boolean);

  return (
    <Box
      px="lg"
      py="md"
      bg="slate.0"
      style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
    >
      {/* Menurun dan rata kanan seperti kaki faktur: tiap baris memotong baris di atasnya,
          dan Total Tagihan Akhir jadi angka terakhir yang dibaca. */}
      <Box ml="auto" w={{ base: '100%', sm: 340 }}>
        {parts.map((p) => (
          <Group key={p.label} justify="space-between" gap="md" py={3} wrap="nowrap">
            <Text fz="xs" c="slate.7">
              {p.label}
            </Text>
            <Text
              fz="xs"
              fw={p.muted ? 400 : 600}
              c={p.color ?? (p.muted ? 'slate.6' : 'slate.9')}
              style={{ whiteSpace: 'nowrap' }}
            >
              {p.value}
            </Text>
          </Group>
        ))}
        <Divider my={8} color="gray.3" />
        <Group justify="space-between" align="center" gap="md" wrap="nowrap">
          <Text fz="sm" fw={700} c="primary.9">
            {totalLabel}
          </Text>
          <Text fz={20} fw={700} c="primary.9" lh={1.2} style={{ whiteSpace: 'nowrap' }}>
            {rupiah(totals.total)}
          </Text>
        </Group>
      </Box>
    </Box>
  );
}

const STEPS = [
  {
    value: 'general',
    label: 'Informasi Umum',
    description: 'Pelanggan, tanggal, termin',
    icon: User,
  },
  { value: 'items', label: 'Rincian Produk & Jasa', icon: Invoice },
  {
    value: 'extras',
    label: 'Diskon & Tambahan',
    icon: FileText,
  },
];

// Halaman penuh, bukan modal: form sepanjang ini lebih enak dikerjakan di halaman sendiri.
// editing = faktur draf yang diubah; null berarti faktur baru.
// doc: jenis dokumen (faktur / pesanan). nextNumber: pembuat nomor otomatis jenis itu.
export default function SaleForm({
  doc = DOC.invoice,
  nextNumber = nextInvoiceNumber,
  // Mengembalikan true bila nomor sudah dipakai dokumen lain sejenis (#1).
  numberTaken = () => false,
  // Isian awal dari dokumen sumber, mis. faktur yang dibuat dari pesanan (S1).
  prefill = null,
  sourceLabel = null,
  // #7: daftar dokumen sumber dihitung dari pelanggan yang sedang dipilih di form,
  // bukan dari alamat halaman — pelanggannya baru diketahui setelah dipilih.
  sourcesFor = null,
  loadSource = null,
  defaultDueDays = null,
  editing,
  initialCustomerId,
  onCancel,
  onSave,
}) {
  const { contactsById } = useData();
  const [active, setActive] = useState(0);
  const [reached, setReached] = useState(0); // langkah terjauh yang pernah dibuka
  const [form, setForm] = useState(() => ({
    ...initialForm(),
    // Dokumen bermasa berlaku (penawaran) mulai dengan tenggat bawaannya sendiri.
    ...(defaultDueDays != null && { dueDate: addDays(TODAY, defaultDueDays) }),
    ...(editing ?? {}),
    ...(!editing && initialCustomerId
      ? customerPatch(contactsById[initialCustomerId], TODAY, doc.fields.termDrivesDue)
      : {}),
    // Isian awal dari dokumen sumber (pesanan / penawaran).
    ...(prefill ?? {}),
  }));
  const [submitted, setSubmitted] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  // Id faktur baru dibuat sekali saat form dibuka, bukan setiap render.
  const [newId] = useState(() => `${doc.kind === 'order' ? 'so' : 's'}${Date.now()}`);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // P14: isian yang sudah dikerjakan tidak dibuang tanpa konfirmasi.
  const dirty = () => {
    const awal = { ...initialForm(), ...(editing ?? {}) };
    return JSON.stringify({ ...form, items: form.items.filter((l) => l.productId) }) !==
      JSON.stringify({ ...awal, items: (awal.items ?? []).filter((l) => l.productId) });
  };
  const askCancel = () => (dirty() ? setConfirmCancel(true) : onCancel());

  // Memilih dokumen sumber mengisi ulang form dari dokumen itu.
  const pickSource = (key) => {
    if (!key) return set({ sourceKey: null, fromOrder: null, fromQuote: null });
    const isi = loadSource?.(key);
    if (isi) set({ ...isi, sourceKey: key });
  };

  const go = (i) => {
    setActive(i);
    setReached((r) => Math.max(r, i));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filledItems = form.items.filter((l) => l.productId);
  const totals = computeTotals({ ...form, items: filledItems });
  const hasTax = filledItems.some((l) => l.tax);

  // Kolom wajib per langkah. Langkah 3 tidak punya kolom wajib.
  const required = {
    general: {
      customerId: !form.customerId && 'Pelanggan wajib dipilih',
      number:
        form.number.trim() &&
        numberTaken(form.number, editing?.id) &&
        `Nomor ${doc.word} ${form.number.trim()} sudah dipakai`,
      date:
        (!form.date && `${doc.dateLabel} wajib diisi`) ||
        (periodLocked(form.date) && lockedMessage(form.date)),
      dueDate:
        (!form.dueDate && `${doc.dueLabel} wajib diisi`) ||
        (form.dueDate < form.date &&
          `${doc.dueLabel} tidak boleh sebelum ${doc.dateLabel.toLowerCase()}`),
    },
    items: {
      items:
        (!filledItems.length && 'Tambahkan minimal satu produk/jasa') ||
        (totals.total <= 0 && 'Total faktur masih Rp 0. Isi harga pada minimal satu baris.'),
    },
    extras: {},
  };
  // Pesan penghalang pertama di sebuah langkah; null berarti langkah itu sudah lengkap.
  const blockOf = (i) => Object.values(required[STEPS[i].value]).find(Boolean) ?? null;
  const stepValid = (i) => !blockOf(i);
  // Langkah bisa dibuka selama semua langkah sebelumnya sudah valid; isian tetap utuh.
  const canGoTo = (i) => STEPS.slice(0, i).every((_, j) => stepValid(j));
  // Kolom kosong baru ditandai setelah pengguna menekan tombol; nomor kembar ditandai
  // seketika karena angkanya sudah pasti salah saat itu juga.
  const errors = {
    ...(submitted ? { ...required.general, ...required.items } : {}),
    number: required.general.number || undefined,
    // Periode tertutup juga ditandai seketika (#26).
    date: (periodLocked(form.date) && lockedMessage(form.date)) || undefined,
  };

  // draft = true saat "Simpan sebagai Draf" dipakai. Faktur yang diedit selalu draf,
  // karena faktur yang sudah terkirim tidak bisa diubah.
  const save = (draft) => {
    setSubmitted(true);
    if (!stepValid(0)) return go(0);
    if (!stepValid(1)) return go(1);
    const now = nowIso();
    const dokumen = {
      ...form,
      id: editing?.id ?? newId,
      number: form.number.trim() || nextNumber(),
      term: form.term ?? 'custom',
      items: filledItems,
      draft,
      invoiceLink: editing?.invoiceLink ?? null,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    };
    // #31: setiap penyimpanan meninggalkan jejak — dibuat, diubah, atau diterbitkan.
    const jejak = editing ? (draft ? 'updated' : 'issued') : draft ? 'created' : 'issued';
    onSave(logActivity(dokumen, jejak, draft ? 'Disimpan sebagai draf' : ''));
  };

  const last = active === STEPS.length - 1;
  // Subjudul langkah 2 & 3 mengikuti jenis dokumen (ditagihkan / ditawarkan / dipesan).
  const stepDesc = (sv) => doc.steps?.[sv.value] ?? sv.description;
  const step = STEPS[active];
  const stepError = blockOf(active);
  // Lanjut terhalang isian langkah ini; menyimpan terhalang isian wajib di langkah mana pun.
  const nextBlock = stepError;
  const saveBlock = blockOf(0) ?? blockOf(1);

  // Tombol yang terhalang tampil nonaktif tapi tetap bisa diklik: kliknya memunculkan
  // tanda merah di kolom yang kurang, dan tooltip menjelaskan apa yang menghalangi.
  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <BackLink label={editing ? doc.backDetail : doc.backList} onClick={askCancel} />

      <PageIntro
        icon={editing ? PencilSimple : FilePlus}
        title={editing ? doc.editTitle : doc.newTitle}
        description={
          editing
            ? `Draf ${editing.number} belum terkirim, jadi masih bisa diubah.`
            : doc.newHint
        }
      />

      {sourceLabel && (
        <Alert variant="light" color="primary" radius="md" icon={<ClipboardText size={16} />}>
          <Text fz="xs">
            {sourceLabel}. Isinya sudah terisi dan masih bisa diperiksa serta diubah sebelum
            disimpan.
          </Text>
        </Alert>
      )}

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Stepper
          active={active}
          onStepClick={(i) => canGoTo(i) && go(i)}
          size="sm"
          iconSize={32}
          color="secondary.7"
          className="app-stepper"
          styles={{
            stepLabel: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 700 },
            stepDescription: { fontSize: 11 },
            separator: { marginInline: 8 },
          }}
        >
          {STEPS.map((s, i) => (
            <Stepper.Step
              key={s.value}
              allowStepSelect={canGoTo(i)}
              className={i <= reached ? 'step-reached' : undefined}
              label={
                <>
                  <Text
                    component="span"
                    display="block"
                    fz={10}
                    fw={600}
                    tt="uppercase"
                    c={i <= reached ? 'secondary.7' : 'slate.5'}
                    style={{ letterSpacing: 0.5 }}
                  >
                    Langkah {i + 1}
                  </Text>
                  {s.label}
                </>
              }
              description={stepDesc(s)}
              icon={<s.icon size={16} />}
              completedIcon={<s.icon size={16} />}
            />
          ))}
        </Stepper>
      </Card>

      {/* Isi langkah, pita total, dan tombol dalam satu kartu: footer menempel pada
          form yang sedang dikerjakan, bukan melayang sebagai kartu terpisah. */}
      <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
        <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon variant="light" bg="slate.0" c="slate.7" size={32} radius="md">
              <step.icon size={16} />
            </ThemeIcon>
            <Box>
              <Text fw={700} fz="sm" c="slate.9">
                {step.label}
              </Text>
              <Text fz={11} c="slate.6">
                {step.description}
              </Text>
            </Box>
          </Group>
        </Box>

        <Box p="lg">
          {submitted && stepError && (
            <Alert variant="light" color="red" radius="md" icon={<Warning size={16} />} mb="md">
              <Text fz="xs">{stepError}</Text>
            </Alert>
          )}

          {step.value === 'general' && (
            <GeneralStep
              form={form}
              set={set}
              errors={errors}
              doc={doc}
              sources={sourcesFor ? sourcesFor(form.customerId) : null}
              onPickSource={pickSource}
            />
          )}
          {step.value === 'items' && <ItemsStep form={form} set={set} errors={errors} doc={doc} />}
          {step.value === 'extras' && <ExtrasStep form={form} set={set} doc={doc} />}
        </Box>

        {/* Angka tagihan hanya relevan setelah ada barisnya: langkah 1 tidak menampilkannya. */}
        {step.value !== 'general' && <TotalsBand totals={totals} taxed={hasTax} inclusive={form.taxInclusive} totalLabel={doc.totalLabel} />}

        <Group
          justify="space-between"
          gap="sm"
          px="lg"
          py="md"
          bg="white"
          style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
        >
          {/* Batal berdiri sendiri di kiri: aksi yang membatalkan seluruh form,
              bukan bagian dari urutan maju-mundur langkah di kanan. */}
          <Button variant="outline" color="slate" radius="md" onClick={askCancel}>
            Batal
          </Button>
          <Group gap="sm">
            {active > 0 && (
              <Button
                variant="default"
                radius="md"
                leftSection={<ArrowLeft size={16} />}
                onClick={() => go(active - 1)}
              >
                Langkah sebelumnya
              </Button>
            )}
            <Tooltip label={saveBlock} disabled={!saveBlock} withArrow fz="xs" position="top">
              <Button
                variant="light"
                color="slate"
                radius="md"
                leftSection={<FileText size={16} />}
                onClick={() => save(true)}
                {...blockedProps(saveBlock, () => setSubmitted(true))}
              >
                Simpan sebagai Draf
              </Button>
            </Tooltip>
            {last ? (
              <Tooltip label={saveBlock} disabled={!saveBlock} withArrow fz="xs" position="top">
                <Button
                  radius="md"
                  leftSection={<Check size={16} />}
                  onClick={() => save(false)}
                  {...blockedProps(saveBlock, () => setSubmitted(true))}
                >
                  {editing ? doc.publishLabel : doc.saveLabel}
                </Button>
              </Tooltip>
            ) : (
              <Tooltip label={nextBlock} disabled={!nextBlock} withArrow fz="xs" position="top">
                <Button
                  radius="md"
                  rightSection={<ArrowRight size={16} />}
                  onClick={() => {
                    setSubmitted(false);
                    go(active + 1);
                  }}
                  {...blockedProps(nextBlock, () => setSubmitted(true))}
                >
                  Lanjut
                </Button>
              </Tooltip>
            )}
          </Group>
        </Group>
      </Card>

      <Modal
        opened={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        centered
        radius="lg"
        padding="lg"
        size={420}
        title={
          <Text fw={700} fz="sm" c="slate.9">
            Buang isian {doc.word} ini?
          </Text>
        }
      >
        <Text fz="xs" c="slate.6">
          Isian yang sudah dikerjakan tidak disimpan. Kalau belum selesai, simpan dulu sebagai
          draf supaya bisa dilanjutkan nanti.
        </Text>
        <Group justify="flex-end" gap="sm" mt="lg">
          <Button variant="default" radius="md" onClick={() => setConfirmCancel(false)}>
            Lanjut mengisi
          </Button>
          <Button
            variant="light"
            color="slate"
            radius="md"
            leftSection={<FileText size={16} />}
            onClick={() => save(true)}
          >
            Simpan sebagai draf
          </Button>
          <Button color="red" radius="md" onClick={onCancel}>
            Buang
          </Button>
        </Group>
      </Modal>
    </Stack>
  );
}
