import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import NumberField from '@/components/NumberField.jsx';
import { useState } from 'react';
import {
  CalendarBlank,
  FilePlus,
  FileText,
  Invoice,
  Plus,
  Trash,
  User,
} from '@/components/Icon.jsx';
import { TotalsBox } from './components.jsx';
import { useData } from '@/lib/store.jsx';
import { canBeInvoiced, formatAddress } from '@/pages/Kontak/utils.js';
import { allAccounts, paymentTerms, products, taxes, TODAY } from './data.js';
import { addDays, computeTotals, generateInvoiceNumber, nowIso } from './utils.js';

const emptyLine = () => ({ productId: null, description: '', qty: 1, price: 0, tax: null });

const initialForm = () => ({
  customerId: null,
  number: '',
  date: TODAY,
  dueDate: TODAY,
  term: null,
  ref: '',
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
  payments: [],
});

const productOptions = products.map((p) => ({ value: p.id, label: p.name }));
const typeOptions = [
  { value: 'percent', label: 'Persentase (%)' },
  { value: 'nominal', label: 'Nominal (Rp)' },
];
const money = { thousandSeparator: '.', decimalSeparator: ',', allowNegative: false, min: 0 };

// Memilih kontak mengisi alamat penagihan & termin default dari profil kontaknya.
function customerPatch(contact, date) {
  if (!contact) return { customerId: null };
  const days = paymentTerms.find((t) => t.value === contact.term)?.days;
  return {
    customerId: contact.id,
    billingAddress: formatAddress(contact.billing),
    term: contact.term ?? null,
    ...(days != null && { dueDate: addDays(date, days) }),
  };
}

function GeneralTab({ form, set, errors }) {
  const { contacts, contactsById } = useData();
  const customerOptions = contacts
    .filter(canBeInvoiced)
    .map((c) => ({ value: c.id, label: c.displayName }));
  const pickCustomer = (id) => set(customerPatch(contactsById[id], form.date));
  // Termin mengatur jatuh tempo otomatis (kecuali Custom).
  const pickTerm = (term) => {
    const days = paymentTerms.find((t) => t.value === term)?.days;
    set({ term, ...(days != null && { dueDate: addDays(form.date, days) }) });
  };
  const pickDate = (date) => {
    const days = paymentTerms.find((t) => t.value === form.term)?.days;
    set({ date, ...(days != null && date && { dueDate: addDays(date, days) }) });
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
          label="Nomor Faktur"
          placeholder="Kosongkan untuk nomor otomatis"
          radius="md"
          value={form.number}
          onChange={(e) => set({ number: e.currentTarget.value })}
        />
        <TextInput
          type="date"
          label="Tanggal Transaksi"
          withAsterisk
          radius="md"
          leftSection={<CalendarBlank size={14} />}
          value={form.date}
          onChange={(e) => pickDate(e.currentTarget.value)}
          error={errors.date}
        />
        <TextInput
          type="date"
          label="Tanggal Jatuh Tempo"
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
          label="Nomor Referensi Pelanggan (PO / Ref)"
          placeholder="Misal: PO-2026/05"
          radius="md"
          value={form.ref}
          onChange={(e) => set({ ref: e.currentTarget.value })}
        />
      </SimpleGrid>
      <Textarea
        label="Alamat Penagihan (Billing)"
        placeholder="Alamat penagihan lengkap..."
        radius="md"
        autosize
        minRows={2}
        value={form.billingAddress}
        onChange={(e) => set({ billingAddress: e.currentTarget.value })}
      />
      <Switch
        size="sm"
        label="Harga sudah termasuk pajak (Tax Inclusive)"
        checked={form.taxInclusive}
        onChange={(e) => set({ taxInclusive: e.currentTarget.checked })}
      />
    </Stack>
  );
}

function ItemsTab({ form, set, errors }) {
  const update = (i, patch) =>
    set({ items: form.items.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  const pickProduct = (i, id) => {
    const p = products.find((x) => x.id === id);
    update(i, { productId: id, description: p?.description ?? '', price: p?.price ?? 0 });
  };
  const remove = (i) =>
    set({
      items: form.items.length > 1 ? form.items.filter((_, idx) => idx !== i) : [emptyLine()],
    });

  return (
    <Stack gap="sm">
      <Table
        verticalSpacing="xs"
        horizontalSpacing="sm"
        styles={{
          th: { fontSize: 'var(--mantine-font-size-xs)', color: 'var(--mantine-color-slate-7)' },
        }}
      >
        <Table.Thead bg="slate.0">
          <Table.Tr>
            <Table.Th>Produk / Jasa</Table.Th>
            <Table.Th w={90}>Jumlah</Table.Th>
            <Table.Th w={130}>Harga Satuan (Rp)</Table.Th>
            <Table.Th w={110}>Pajak</Table.Th>
            <Table.Th w={50} ta="center">
              Hapus
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {form.items.map((line, i) => (
            <Table.Tr key={i}>
              <Table.Td>
                <Stack gap={6}>
                  <Select
                    size="xs"
                    radius="md"
                    placeholder="Pilih produk..."
                    searchable
                    data={productOptions}
                    value={line.productId}
                    onChange={(id) => pickProduct(i, id)}
                    error={errors.items && !line.productId}
                  />
                  <TextInput
                    size="xs"
                    radius="md"
                    placeholder="Deskripsi baris..."
                    value={line.description}
                    onChange={(e) => update(i, { description: e.currentTarget.value })}
                  />
                </Stack>
              </Table.Td>
              <Table.Td>
                <NumberField
                  size="xs"
                  radius="md"
                  min={1}
                  allowNegative={false}
                  decimalScale={0}
                  value={line.qty}
                  onChange={(v) => update(i, { qty: Number(v) || 0 })}
                />
              </Table.Td>
              <Table.Td>
                <NumberField
                  size="xs"
                  radius="md"
                  decimalScale={0}
                  {...money}
                  value={line.price}
                  onChange={(v) => update(i, { price: Number(v) || 0 })}
                />
              </Table.Td>
              <Table.Td>
                <Select
                  size="xs"
                  radius="md"
                  placeholder="Pajak..."
                  clearable
                  data={taxes}
                  value={line.tax}
                  onChange={(v) => update(i, { tax: v })}
                />
              </Table.Td>
              <Table.Td ta="center">
                <ActionIcon
                  variant="light"
                  color="slate"
                  radius="md"
                  onClick={() => remove(i)}
                  aria-label="Hapus baris"
                >
                  <Trash size={14} />
                </ActionIcon>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
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
          Tambah Baris Produk
        </Button>
      </Group>
    </Stack>
  );
}

function ExtrasTab({ form, set }) {
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
        <NumberField
          label="Nilai Diskon"
          radius="md"
          {...money}
          max={form.discountType === 'percent' ? 100 : undefined}
          value={form.discountValue}
          onChange={(v) => set({ discountValue: Number(v) || 0 })}
          style={{ flexGrow: 2 }}
        />
      </Group>
      <SimpleGrid cols={3} spacing="sm">
        <Select
          label="Tipe Potongan (Withholding)"
          radius="md"
          allowDeselect={false}
          data={typeOptions}
          value={form.withholdingType}
          onChange={(v) => set({ withholdingType: v })}
        />
        <NumberField
          label="Nilai Potongan"
          radius="md"
          {...money}
          value={form.withholdingValue}
          onChange={(v) => set({ withholdingValue: Number(v) || 0 })}
        />
        <Select
          label="Akun Potongan"
          placeholder="Pilih akun..."
          radius="md"
          searchable
          clearable
          data={allAccounts}
          value={form.withholdingAccount}
          onChange={(v) => set({ withholdingAccount: v })}
        />
      </SimpleGrid>
      <Textarea
        label="Pesan di Faktur"
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

function SaleForm({ initialCustomerId, onCancel, onSave }) {
  const { contactsById } = useData();
  const [tab, setTab] = useState('general');
  const [form, setForm] = useState(() => ({
    ...initialForm(),
    ...(initialCustomerId && customerPatch(contactsById[initialCustomerId], TODAY)),
  }));
  const [submitted, setSubmitted] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const filledItems = form.items.filter((l) => l.productId);
  const allErrors = {
    customerId: !form.customerId && 'Pelanggan wajib dipilih',
    date: !form.date && 'Tanggal transaksi wajib diisi',
    dueDate:
      (!form.dueDate && 'Tanggal jatuh tempo wajib diisi') ||
      (form.dueDate < form.date && 'Jatuh tempo tidak boleh sebelum tanggal transaksi'),
    items: !filledItems.length && 'Tambahkan minimal satu produk/jasa',
  };
  const errors = submitted ? allErrors : {};
  const totals = computeTotals({ ...form, items: filledItems });

  const tabs = [
    { value: 'general', label: 'Informasi Umum', icon: User },
    { value: 'items', label: `Rincian Produk & Jasa (${form.items.length})`, icon: Invoice },
    { value: 'extras', label: 'Diskon & Tambahan', icon: FileText },
  ];

  const submit = () => {
    setSubmitted(true);
    if (allErrors.customerId || allErrors.date || allErrors.dueDate) return setTab('general');
    if (allErrors.items) return setTab('items');
    const now = nowIso();
    onSave({
      ...form,
      id: `s${Date.now()}`,
      number: form.number.trim() || generateInvoiceNumber(),
      term: form.term ?? 'custom',
      items: filledItems,
      draft: false,
      invoiceLink: null,
      createdAt: now,
      updatedAt: now,
    });
  };

  return (
    <Stack gap="md">
      <Group gap={4}>
        {tabs.map((t) => {
          const active = tab === t.value;
          return (
            <Button
              key={t.value}
              size="xs"
              radius="md"
              variant={active ? 'filled' : 'subtle'}
              color={active ? 'primary.9' : 'slate.7'}
              leftSection={<t.icon size={14} />}
              fw={active ? 700 : 500}
              onClick={() => setTab(t.value)}
            >
              {t.label}
            </Button>
          );
        })}
      </Group>

      {tab === 'general' && <GeneralTab form={form} set={set} errors={errors} />}
      {tab === 'items' && <ItemsTab form={form} set={set} errors={errors} />}
      {tab === 'extras' && <ExtrasTab form={form} set={set} />}

      <TotalsBox totals={totals} />

      <Group
        justify="flex-end"
        gap="sm"
        pt="md"
        style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
      >
        <Button variant="default" radius="md" onClick={onCancel}>
          Batal
        </Button>
        <Button radius="md" onClick={submit}>
          Simpan Faktur Penjualan
        </Button>
      </Group>
    </Stack>
  );
}

export default function SaleFormModal({ opened, initialCustomerId, onClose, onSave }) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size={640}
      radius="lg"
      padding="lg"
      title={
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" bg="secondary.0" c="secondary.7" size={32} radius="md">
            <FilePlus size={18} />
          </ThemeIcon>
          <div>
            <Text fw={700} fz="sm" c="slate.9">
              Buat Faktur Penjualan Baru
            </Text>
            <Text fz={11} c="slate.6">
              Catat tagihan invoice pelanggan atau penghuni properti
            </Text>
          </div>
        </Group>
      }
    >
      {/* Form dipasang ulang setiap modal dibuka agar mulai dari kosong */}
      {opened && (
        <SaleForm initialCustomerId={initialCustomerId} onCancel={onClose} onSave={onSave} />
      )}
    </Modal>
  );
}
