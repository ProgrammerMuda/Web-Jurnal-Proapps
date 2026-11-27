import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Group,
  Modal,
  MultiSelect,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Switch,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import NumberField from '@/components/NumberField.jsx';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bank,
  Check,
  FileText,
  Info,
  MapPin,
  PencilSimple,
  Plus,
  Trash,
  UserCircle,
  UserPlus,
} from '@/components/Icon.jsx';
import { useData } from '@/lib/store.jsx';
import { LATE_FEE_BASIS, LATE_FEE_DEFAULT } from '@/pages/Penjualan/data.js';
import {
  apAccounts,
  arAccounts,
  banks,
  contactTerms,
  contactTypes,
  emptyContact,
  idTypes,
  provinces,
  salutations,
} from './data.js';

const typeOptions = contactTypes.map((t) => ({ value: t.value, label: t.long }));
const provinceOptions = Object.keys(provinces);
const boxStyle = {
  border: '1px solid var(--mantine-color-gray-3)',
  borderRadius: 'var(--mantine-radius-md)',
};
// Kolom angka: hanya digit, dengan batas panjang opsional (maxLength mencegah ketikan berlebih,
// sanitasi di onChange membersihkan teks yang ditempel).
const digitsOnly = (value, max) => {
  const d = value.replace(/\D/g, '');
  return max ? d.slice(0, max) : d;
};
const numeric = (max, onValue) => ({
  inputMode: 'numeric',
  maxLength: max,
  onChange: (e) => onValue(digitsOnly(e.currentTarget.value, max)),
});
// Kolom angka dengan batas panjang: di pojok kanan label tampil jumlah digit terisi (mis. 01/16).
function DigitsInput({ label, value, max, onValue, ...props }) {
  const width = String(max).length;
  return (
    <TextInput
      {...props}
      label={
        <Group justify="space-between" wrap="nowrap" gap="xs" component="span">
          <span>{label}</span>
          <Text component="span" fz={11} fw={500} c={value.length >= max ? 'slate.8' : 'slate.5'}>
            {String(value.length).padStart(width, '0')}/{max}
          </Text>
        </Group>
      }
      labelProps={{ style: { display: 'block', width: '100%' } }}
      radius="md"
      value={value}
      inputMode="numeric"
      maxLength={max}
      onChange={(e) => onValue(digitsOnly(e.currentTarget.value, max))}
    />
  );
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// Kartu PIC: header sendiri (ikon, judul, badge Opsional) dan isian nama.
function PicSection({ form, set }) {
  return (
    <Box bg="white" style={{ ...boxStyle, overflow: 'hidden' }}>
      <Group
        justify="space-between"
        wrap="nowrap"
        px="md"
        py="sm"
        bg="slate.0"
        style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
      >
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" bg="secondary.0" c="secondary.7" size={32} radius="md">
            <UserCircle size={18} />
          </ThemeIcon>
          <Box>
            <Text fz="sm" fw={700} c="slate.9" lh={1.3}>
              Kontak Person / PIC
            </Text>
            <Text fz={11} c="slate.6">
              Person In Charge yang mewakili perusahaan
            </Text>
          </Box>
        </Group>
        <Badge size="sm" radius="sm" variant="light" color="gray" tt="none" fw={600}>
          Opsional
        </Badge>
      </Group>

      <Stack gap="sm" p="md">
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <Select
            label="Gelar / Sapaan"
            placeholder="Pilih"
            radius="md"
            clearable
            data={salutations}
            value={form.salutation}
            onChange={(v) => set({ salutation: v })}
          />
          <TextInput
            label="Nama Depan"
            placeholder="Nama depan"
            radius="md"
            value={form.firstName}
            onChange={(e) => set({ firstName: e.currentTarget.value })}
          />
          <TextInput
            label="Nama Tengah"
            placeholder="Nama tengah"
            radius="md"
            value={form.middleName}
            onChange={(e) => set({ middleName: e.currentTarget.value })}
          />
          <TextInput
            label="Nama Belakang"
            placeholder="Nama belakang"
            radius="md"
            value={form.lastName}
            onChange={(e) => set({ lastName: e.currentTarget.value })}
          />
        </SimpleGrid>
      </Stack>
    </Box>
  );
}

function MainTab({ form, set, errors, groups }) {
  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <TextInput
          label="Nama Tampilan (Display Name)"
          description="Nama yang tercetak pada invoice, kwitansi, dan laporan keuangan."
          placeholder="Contoh: PT. Sumber Makmur Abadi / John Doe"
          withAsterisk
          radius="md"
          value={form.displayName}
          onChange={(e) => set({ displayName: e.currentTarget.value })}
          error={errors.displayName}
        />
        <MultiSelect
          label="Tipe Kontak"
          description="Klasifikasi peran kontak dalam transaksi bisnis."
          placeholder={form.types.length ? '' : 'Pilih tipe kontak'}
          withAsterisk
          radius="md"
          data={typeOptions}
          value={form.types}
          onChange={(types) => set({ types })}
          error={errors.types}
        />
        <TextInput
          label="Nama Perusahaan / Bisnis"
          placeholder="Contoh: PT. Indoland Manajemen Properti"
          radius="md"
          value={form.company}
          onChange={(e) => set({ company: e.currentTarget.value })}
        />
        <MultiSelect
          label="Grup Kontak"
          placeholder={form.groups.length ? '' : 'Pilih grup kontak'}
          radius="md"
          clearable
          searchable
          data={groups}
          value={form.groups}
          onChange={(g) => set({ groups: g })}
          nothingFoundMessage="Grup belum ada — tambahkan lewat Kelola Grup"
        />
      </SimpleGrid>

      <PicSection form={form} set={set} />

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <Select
          label="Jenis Identitas"
          radius="md"
          allowDeselect={false}
          data={idTypes}
          value={form.idType}
          onChange={(v) => set({ idType: v })}
        />
        <DigitsInput
          label="Nomor Identitas"
          placeholder="16 digit angka"
          max={16}
          value={form.idNumber}
          onValue={(v) => set({ idNumber: v })}
        />
        <DigitsInput
          label="NPWP"
          placeholder="16 digit angka"
          max={16}
          value={form.npwp}
          onValue={(v) => set({ npwp: v })}
        />
        <TextInput
          label="Email Utama"
          placeholder="kontak@perusahaan.com"
          withAsterisk
          radius="md"
          value={form.email}
          onChange={(e) => set({ email: e.currentTarget.value })}
          error={errors.email}
        />
        <DigitsInput
          label="No. Handphone (Mobile)"
          placeholder="0812xxxxxxxx"
          max={15}
          value={form.mobile}
          onValue={(v) => set({ mobile: v })}
        />
        <DigitsInput
          label="No. Telepon Kantor"
          placeholder="02112345678"
          max={15}
          value={form.phone}
          onValue={(v) => set({ phone: v })}
        />
      </SimpleGrid>

      <Textarea
        label="Catatan Tambahan (Opsional)"
        placeholder="Keterangan pendukung atau preferensi komunikasi kontak..."
        radius="md"
        autosize
        minRows={2}
        value={form.notes}
        onChange={(e) => set({ notes: e.currentTarget.value })}
      />
    </Stack>
  );
}

function AddressFields({ value, onChange, label, placeholder }) {
  const cities = value.province ? provinces[value.province] : [];
  return (
    <Stack gap="sm">
      <Textarea
        label={label}
        placeholder={placeholder}
        radius="md"
        autosize
        minRows={2}
        value={value.address}
        onChange={(e) => onChange({ address: e.currentTarget.value })}
      />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <Select
          label="Provinsi"
          placeholder="Pilih provinsi"
          radius="md"
          searchable
          clearable
          data={provinceOptions}
          value={value.province}
          onChange={(province) => onChange({ province, city: null })}
        />
        <Select
          label="Kota / Kabupaten"
          placeholder="Pilih atau cari kota"
          radius="md"
          searchable
          clearable
          disabled={!value.province}
          data={cities}
          value={value.city}
          onChange={(city) => onChange({ city })}
        />
        <DigitsInput
          label="Kode Pos"
          placeholder="Contoh: 12190"
          max={5}
          value={value.zip}
          onValue={(v) => onChange({ zip: v })}
        />
      </SimpleGrid>
    </Stack>
  );
}

function AddressTab({ form, set }) {
  return (
    <Stack gap="sm">
      <Box p="sm" style={boxStyle}>
        <Text fz="xs" fw={700} c="primary.9" mb="xs">
          Alamat Penagihan (Billing Address)
        </Text>
        <AddressFields
          label="Alamat Lengkap"
          placeholder="Jalan, nomor gedung/rumah, kelurahan, kecamatan..."
          value={form.billing}
          onChange={(patch) => set({ billing: { ...form.billing, ...patch } })}
        />
      </Box>
      <Box p="sm" style={boxStyle}>
        <Group justify="space-between" mb="xs">
          <Text fz="xs" fw={700} c="primary.9">
            Alamat Pengiriman (Shipping Address)
          </Text>
          <Switch
            size="sm"
            label="Sama dengan alamat penagihan"
            checked={form.shippingSame}
            onChange={(e) => set({ shippingSame: e.currentTarget.checked })}
          />
        </Group>
        {form.shippingSame ? (
          <Text fz={11} c="slate.6">
            Alamat pengiriman otomatis mengikuti alamat penagihan di atas.
          </Text>
        ) : (
          <AddressFields
            label="Alamat Pengiriman Lengkap"
            placeholder="Alamat gudang / tempat penerimaan barang..."
            value={form.shipping}
            onChange={(patch) => set({ shipping: { ...form.shipping, ...patch } })}
          />
        )}
      </Box>
    </Stack>
  );
}

const emptyBank = () => ({ bank: '', number: '', holder: '', branch: '' });

function BankTab({ form, set }) {
  const add = () => set({ banks: [...form.banks, emptyBank()] });
  const update = (i, patch) =>
    set({ banks: form.banks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) });
  const remove = (i) => set({ banks: form.banks.filter((_, idx) => idx !== i) });

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start">
        <Box>
          <Text fz="sm" fw={700} c="slate.9">
            Daftar Rekening Bank
          </Text>
          <Text fz={11} c="slate.6">
            Simpan informasi rekening bank untuk pembayaran atau penerimaan dana.
          </Text>
        </Box>
        <Button
          size="xs"
          radius="md"
          variant="light"
          leftSection={<Plus size={14} />}
          onClick={add}
        >
          Tambah Rekening
        </Button>
      </Group>

      {form.banks.length === 0 ? (
        <Center py="lg" bg="slate.0" style={{ ...boxStyle, borderStyle: 'dashed' }}>
          <Stack gap={6} align="center">
            <ThemeIcon variant="light" color="slate" size={36} radius="xl">
              <Bank size={18} />
            </ThemeIcon>
            <Text fz="sm" fw={600} c="slate.9">
              Belum ada rekening bank
            </Text>
            <Text fz={11} c="slate.6">
              Tambahkan informasi rekening jika kontak ini memerlukan transfer pembayaran.
            </Text>
            <Button
              size="xs"
              radius="md"
              variant="default"
              leftSection={<Plus size={14} />}
              onClick={add}
            >
              Tambah Rekening Pertama
            </Button>
          </Stack>
        </Center>
      ) : (
        form.banks.map((b, i) => (
          <Box key={i} p="sm" style={boxStyle}>
            <Group justify="space-between" mb="xs">
              <Text fz="xs" fw={700} c="primary.9">
                Rekening #{i + 1}
              </Text>
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                onClick={() => remove(i)}
                aria-label={`Hapus rekening ${i + 1}`}
              >
                <Trash size={14} />
              </ActionIcon>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Select
                label="Nama Bank"
                placeholder="Pilih bank (cari: BCA, Mandiri, BRI)"
                radius="md"
                searchable
                clearable
                nothingFoundMessage="Bank tidak ditemukan"
                // Bank di luar daftar (data lama) tetap tampil agar tidak hilang saat diedit.
                data={!b.bank || banks.includes(b.bank) ? banks : [...banks, b.bank]}
                value={b.bank || null}
                onChange={(bank) => update(i, { bank: bank ?? '' })}
              />
              <TextInput
                label="Nomor Rekening"
                placeholder="Nomor rekening bank"
                radius="md"
                value={b.number}
                {...numeric(undefined, (v) => update(i, { number: v }))}
              />
              <TextInput
                label="Atas Nama (Account Holder)"
                placeholder="Nama pemilik rekening"
                radius="md"
                value={b.holder}
                onChange={(e) => update(i, { holder: e.currentTarget.value })}
              />
              <TextInput
                label="Kantor Cabang"
                placeholder="Cabang pembukaan rekening"
                radius="md"
                value={b.branch}
                onChange={(e) => update(i, { branch: e.currentTarget.value })}
              />
            </SimpleGrid>
          </Box>
        ))
      )}
    </Stack>
  );
}

function MappingTab({ form, set }) {
  const pickTerm = (term) => {
    const days = contactTerms.find((t) => t.value === term)?.days;
    set({ term, ...(days != null && { termDays: days }) });
  };
  return (
    <Stack gap="sm">
      <Alert variant="light" color="primary" radius="md" icon={<Info size={16} />} p="sm">
        <Text fz="xs" c="slate.8">
          Pemetaan akun memastikan invoice penjualan atau tagihan vendor langsung membukukan piutang
          atau hutang ke akun yang Anda tentukan di bawah ini.
        </Text>
      </Alert>
      <Box p="sm" style={boxStyle}>
        <Text fz="xs" fw={700} c="primary.9" mb="xs">
          Akun Piutang & Hutang
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select
            label="Akun Piutang (Accounts Receivable)"
            description="Digunakan untuk membukukan tagihan kepada pelanggan ini."
            placeholder="Pilih akun piutang"
            radius="md"
            searchable
            clearable
            data={arAccounts}
            value={form.arAccount}
            onChange={(v) => set({ arAccount: v })}
          />
          <Select
            label="Akun Hutang (Accounts Payable)"
            description="Digunakan untuk membukukan kewajiban tagihan dari pemasok ini."
            placeholder="Pilih akun hutang"
            radius="md"
            searchable
            clearable
            data={apAccounts}
            value={form.apAccount}
            onChange={(v) => set({ apAccount: v })}
          />
        </SimpleGrid>
      </Box>
      <Box p="sm" style={boxStyle}>
        <Text fz="xs" fw={700} c="primary.9" mb="xs">
          Termin Pembayaran Default
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select
            label="Termin Standar"
            description="Jangka waktu jatuh tempo pembayaran transaksi."
            placeholder="Pilih termin"
            radius="md"
            clearable
            data={contactTerms}
            value={form.term}
            onChange={pickTerm}
          />
          <NumberField
            label="Jumlah Hari Jatuh Tempo"
            description="0 berarti Cash on Delivery (Tunai langsung)."
            radius="md"
            min={0}
            max={365}
            allowNegative={false}
            decimalScale={0}
            value={form.termDays}
            onChange={(v) => {
              const days = Number(v) || 0;
              set({
                termDays: days,
                term: contactTerms.find((t) => t.days === days)?.value ?? null,
              });
            }}
          />
        </SimpleGrid>
      </Box>
      <LateFeeBox form={form} set={set} />
    </Stack>
  );
}

// #29: aturan denda keterlambatan pelanggan ini, sesuai kontraknya. Tanpa pengaturan
// khusus, faktur memakai aturan bawaan.
function LateFeeBox({ form, set }) {
  const lf = form.lateFee ?? { mode: 'default' };
  const mode = lf.mode ?? 'default';
  const val = mode === 'custom' ? { ...LATE_FEE_DEFAULT, ...lf } : LATE_FEE_DEFAULT;
  const patch = (p) => set({ lateFee: { ...LATE_FEE_DEFAULT, ...lf, mode: 'custom', ...p } });
  const basisLabel = LATE_FEE_BASIS.find((b) => b.value === LATE_FEE_DEFAULT.basis)?.label;
  return (
    <Box p="sm" style={boxStyle}>
      <Text fz="xs" fw={700} c="primary.9" mb={4}>
        Denda Keterlambatan
      </Text>
      <Text fz="xs" c="slate.7" mb="xs">
        Ikuti klausul denda di kontrak pelanggan. Denda dihitung harian sejak jatuh tempo bila
        pembayaran lewat dari masa tenggang.
      </Text>
      <SegmentedControl
        size="xs"
        radius="md"
        mb="sm"
        value={mode}
        onChange={(m) => set({ lateFee: m === 'default' ? null : m === 'none' ? { mode: 'none' } : { ...LATE_FEE_DEFAULT, mode: 'custom' } })}
        data={[
          { value: 'default', label: 'Aturan bawaan' },
          { value: 'custom', label: 'Sesuai kontrak' },
          { value: 'none', label: 'Tanpa denda' },
        ]}
      />
      {mode === 'default' && (
        <Text fz="xs" c="slate.7">
          {String(LATE_FEE_DEFAULT.rate).replace('.', ',')}% {basisLabel}, masa tenggang {LATE_FEE_DEFAULT.grace} hari.
        </Text>
      )}
      {mode === 'none' && <Text fz="xs" c="slate.7">Faktur pelanggan ini tidak dikenai denda keterlambatan.</Text>}
      {mode === 'custom' && (
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
          <NumberField
            label="Tarif denda"
            radius="md"
            min={0}
            max={100}
            decimalScale={3}
            decimalSeparator=","
            rightSection={<Text fz="xs" c="slate.6">%</Text>}
            value={val.rate}
            onChange={(v) => patch({ rate: Number(v) || 0 })}
          />
          <Select
            label="Dihitung"
            radius="md"
            allowDeselect={false}
            data={LATE_FEE_BASIS}
            value={val.basis}
            onChange={(v) => patch({ basis: v })}
          />
          <NumberField
            label="Masa tenggang (hari)"
            radius="md"
            min={0}
            max={90}
            decimalScale={0}
            allowNegative={false}
            value={val.grace}
            onChange={(v) => patch({ grace: Number(v) || 0 })}
          />
        </SimpleGrid>
      )}
    </Box>
  );
}

const STEPS = [
  { value: 'main', label: 'Informasi Utama', description: 'Profil & kontak', icon: Info },
  { value: 'address', label: 'Alamat', description: 'Penagihan & pengiriman', icon: MapPin },
  { value: 'bank', label: 'Rekening Bank', description: 'Opsional', icon: Bank },
  {
    value: 'mapping',
    label: 'Pemetaan Akun',
    description: 'Piutang, hutang & termin',
    icon: FileText,
  },
];

function StepContent({ step, form, set, errors, groups }) {
  if (step === 'main') return <MainTab form={form} set={set} errors={errors} groups={groups} />;
  if (step === 'address') return <AddressTab form={form} set={set} />;
  if (step === 'bank') return <BankTab form={form} set={set} />;
  return <MappingTab form={form} set={set} />;
}

// Tombol nonaktif: latar abu-abu muda, teks abu-abu.
const disabledStyle = {
  backgroundColor: 'var(--mantine-color-gray-1)',
  color: 'var(--mantine-color-gray-5)',
  borderColor: 'var(--mantine-color-gray-1)',
  cursor: 'not-allowed',
};

// Layout modal: header, band stepper/tab, dan footer tetap (freeze); hanya isi form yang scroll.
const formRootStyle = { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 };
const frozenStyle = { flexShrink: 0 };
const scrollStyle = { flex: 1, minHeight: 0, overflowY: 'auto' };

function Footer({ hint, children }) {
  return (
    <Group
      justify="space-between"
      gap="sm"
      px="lg"
      py="md"
      bg="white"
      style={{ ...frozenStyle, borderTop: '1px solid var(--mantine-color-gray-3)' }}
    >
      <Text fz={11} c="slate.6">
        {hint}
      </Text>
      <Group gap="sm">{children}</Group>
    </Group>
  );
}

function ContactForm({ contact, onCancel, onSave }) {
  const { groups } = useData();
  const isEdit = !!contact;
  const [active, setActive] = useState(0); // indeks step / tab
  const [reached, setReached] = useState(0); // step terjauh yang pernah dibuka
  const go = (i) => {
    setActive(i);
    setReached((r) => Math.max(r, i));
  };
  const [form, setForm] = useState(() => contact ?? emptyContact());
  const [submitted, setSubmitted] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Kolom wajib per step. Hanya step Informasi Utama yang punya kolom wajib.
  const email = form.email.trim();
  const required = {
    main: {
      displayName: !form.displayName.trim() && 'Nama tampilan wajib diisi',
      types: !form.types.length && 'Pilih minimal satu tipe kontak',
      email:
        (!email && 'Email utama wajib diisi') || (!isEmail(email) && 'Format email tidak valid'),
    },
  };
  const stepValid = (i) => !Object.values(required[STEPS[i].value] ?? {}).some(Boolean);
  const allValid = STEPS.every((_, i) => stepValid(i));
  // Step bisa dibuka (maju/mundur lewat stepper) selama semua step sebelumnya sudah valid.
  // Data form tersimpan di satu state, jadi isian tetap utuh saat berpindah step.
  const canGoTo = (i) => STEPS.slice(0, i).every((_, j) => stepValid(j));

  // Mode tambah: kolom kosong tidak langsung merah (tombol Lanjut sudah nonaktif);
  // format email yang salah tetap ditandai agar jelas kenapa belum bisa lanjut.
  // Mode ubah: semua error tampil setelah tombol simpan ditekan.
  const errors = submitted
    ? required.main
    : { email: email && !isEmail(email) ? 'Format email tidak valid' : null };

  const payload = () => ({
    ...form,
    displayName: form.displayName.trim(),
    email,
    // Rekening yang benar-benar kosong tidak disimpan.
    banks: form.banks.filter((b) => b.bank || b.number || b.holder),
  });

  if (isEdit) {
    const submit = () => {
      setSubmitted(true);
      if (!allValid) return setActive(0);
      onSave(payload());
    };
    return (
      <Box style={formRootStyle}>
        <Box
          px="lg"
          pt="xs"
          bg="slate.0"
          style={{ ...frozenStyle, borderBottom: '1px solid var(--mantine-color-gray-3)' }}
        >
          <Group gap={4}>
            {STEPS.map((t, i) => {
              const on = active === i;
              const count = t.value === 'bank' ? form.banks.length : 0;
              return (
                <Button
                  key={t.value}
                  size="xs"
                  radius={0}
                  variant="subtle"
                  color={on ? 'primary.9' : 'slate.7'}
                  fw={on ? 700 : 500}
                  leftSection={<t.icon size={14} />}
                  rightSection={
                    count ? (
                      <Badge size="xs" circle>
                        {count}
                      </Badge>
                    ) : null
                  }
                  onClick={() => setActive(i)}
                  style={{
                    borderBottom: `2px solid ${on ? 'var(--mantine-color-primary-9)' : 'transparent'}`,
                    marginBottom: -1,
                  }}
                >
                  {t.label}
                </Button>
              );
            })}
          </Group>
        </Box>
        <Box px="lg" py="md" style={scrollStyle}>
          <StepContent
            step={STEPS[active].value}
            form={form}
            set={set}
            errors={errors}
            groups={groups}
          />
        </Box>
        <Footer>
          <Button variant="default" radius="md" onClick={onCancel}>
            Batal
          </Button>
          <Button radius="md" onClick={submit}>
            Simpan Perubahan
          </Button>
        </Footer>
      </Box>
    );
  }

  const last = active === STEPS.length - 1;
  // Step terakhir mengecek semua step (jaga-jaga jika step sebelumnya diubah lewat header).
  const canNext = last ? allValid : stepValid(active);
  const next = () => {
    if (!canNext) return;
    if (last) onSave(payload());
    else go(active + 1);
  };

  return (
    <Box style={formRootStyle}>
      {/* Band stepper: latar slate-0, garis bawah mentok kiri-kanan modal */}
      <Box
        px="lg"
        py="md"
        bg="slate.0"
        style={{ ...frozenStyle, borderBottom: '1px solid var(--mantine-color-gray-3)' }}
      >
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
              description={s.description}
              icon={<s.icon size={16} />}
              completedIcon={<s.icon size={16} />}
            />
          ))}
        </Stepper>
      </Box>

      <Box px="lg" py="md" style={scrollStyle}>
        <StepContent
          step={STEPS[active].value}
          form={form}
          set={set}
          errors={errors}
          groups={groups}
        />
      </Box>

      <Footer
        hint={
          canNext
            ? `Langkah ${active + 1} dari ${STEPS.length}`
            : 'Lengkapi kolom bertanda * untuk melanjutkan.'
        }
      >
        {active === 0 ? (
          <Button variant="default" radius="md" onClick={onCancel}>
            Batal
          </Button>
        ) : (
          <Button
            variant="default"
            radius="md"
            leftSection={<ArrowLeft size={16} />}
            onClick={() => setActive((i) => i - 1)}
          >
            Kembali
          </Button>
        )}
        <Button
          radius="md"
          disabled={!canNext}
          style={canNext ? undefined : disabledStyle}
          rightSection={last ? null : <ArrowRight size={16} />}
          leftSection={last ? <Check size={16} /> : null}
          onClick={next}
        >
          {last ? 'Tambah Kontak' : 'Lanjut'}
        </Button>
      </Footer>
    </Box>
  );
}

// contact: null = tambah baru, objek = ubah kontak tersebut.
export default function ContactFormModal({ opened, contact, onClose, onSave }) {
  const Icon = contact ? PencilSimple : UserPlus;
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      // Mode tambah lebih lebar agar 4 step stepper muat dalam satu baris.
      size={contact ? 700 : 960}
      radius="lg"
      padding={0}
      styles={{
        // Padding diatur per bagian agar garis header/stepper/footer mentok kiri-kanan modal.
        // Content setinggi isi (maks. tinggi layar); hanya body yang scroll.
        content: { display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        header: {
          flexShrink: 0,
          padding: 'var(--mantine-spacing-lg)',
          borderBottom: '1px solid var(--mantine-color-gray-3)',
        },
        title: { flex: 1 },
        body: { padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
      }}
      title={
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" bg="primary.0" c="primary.9" size={32} radius="md">
            <Icon size={18} />
          </ThemeIcon>
          <div>
            <Text fw={700} fz="sm" c="slate.9">
              {contact ? 'Ubah Data Kontak' : 'Tambah Kontak Baru'}
            </Text>
            <Text fz={11} c="slate.6">
              {contact
                ? `Perbarui profil dan pemetaan akun untuk "${contact.displayName}"`
                : 'Daftarkan kontak pelanggan, pemasok, atau karyawan ke sistem akuntansi.'}
            </Text>
          </div>
        </Group>
      }
    >
      {opened && (
        <ContactForm
          key={contact?.id ?? 'new'}
          contact={contact}
          onCancel={onClose}
          onSave={onSave}
        />
      )}
    </Modal>
  );
}
