// Form Retur / Nota Kredit. Tiga langkah, pola sama dengan form faktur:
// informasi → baris yang diretur → penyelesaian.
import {
  Alert,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  Radio,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { useState } from 'react';
import NumberField from '@/components/NumberField.jsx';
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  Check,
  FileText,
  Invoice,
  User,
  Warning,
} from '@/components/Icon.jsx';
import { BackLink, blockedProps, Field, PageIntro } from './components.jsx';
import { lockedMessage, periodLocked, products } from './data.js';
import {
  netUnitPrice,
  RETURN_REASONS,
  returnableQty,
  returnTotals,
  SETTLEMENTS,
  splitSettlement,
} from './returns.js';
import {
  computeTotals,
  formatDate,
  logActivity,
  nowIso,
  rupiah,
  taxLabel,
  useCustomer,
} from './utils.js';

const STEPS = [
  { value: 'info', label: 'Informasi', description: 'Faktur, tanggal, alasan', icon: User },
  { value: 'lines', label: 'Baris Diretur', description: 'Qty yang dikoreksi', icon: Invoice },
  { value: 'settle', label: 'Penyelesaian', description: 'Potong atau kredit', icon: FileText },
];

const productName = (l) => products.find((p) => p.id === l.productId)?.name ?? l.description;

export default function ReturnForm({ draft, sale, numberTaken, onCancel, onSave }) {
  const [active, setActive] = useState(0);
  const [reached, setReached] = useState(0);
  const [form, setForm] = useState(draft);
  const [submitted, setSubmitted] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const customer = useCustomer(draft.customerId);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const go = (i) => {
    setActive(i);
    setReached((r) => Math.max(r, i));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const t = returnTotals(sale, form.lines);
  const faktur = computeTotals(sale);
  const bagi = splitSettlement(t.total, form.settlement, faktur.balance);
  const dirty = form.lines.some((l) => Number(l.qty) > 0) || form.note.trim();
  const askCancel = () => (dirty ? setConfirmCancel(true) : onCancel());

  const setQty = (index, qty) =>
    set({ lines: form.lines.map((l) => (l.index === index ? { ...l, qty } : l)) });
  const returAll = () =>
    set({ lines: form.lines.map((l) => ({ ...l, qty: returnableQty(sale.items[l.index]) })) });

  const required = {
    info:
      (!form.date && 'Tanggal retur wajib diisi') ||
      (form.date < sale.date && 'Tanggal retur tidak boleh sebelum tanggal faktur') ||
      (periodLocked(form.date) && lockedMessage(form.date)) ||
      (form.number.trim() &&
        numberTaken(form.number, form.id) &&
        `Nomor retur ${form.number.trim()} sudah dipakai`) ||
      null,
    lines:
      (!form.lines.some((l) => Number(l.qty) > 0) && 'Isi qty retur pada minimal satu baris') ||
      (form.lines.some((l) => Number(l.qty) > returnableQty(sale.items[l.index])) &&
        'Qty retur melebihi yang masih bisa diretur') ||
      null,
    settle: !form.settlement && 'Pilih cara penyelesaian',
  };
  const blockOf = (i) => required[STEPS[i].value] ?? null;
  const stepValid = (i) => !blockOf(i);
  const canGoTo = (i) => STEPS.slice(0, i).every((_, j) => stepValid(j));

  const save = (asDraft) => {
    setSubmitted(true);
    if (!stepValid(0)) return go(0);
    if (!stepValid(1)) return go(1);
    const now = nowIso();
    const bagi = splitSettlement(t.total, form.settlement, faktur.balance);
    const dokumen = {
      ...form,
      lines: form.lines.filter((l) => Number(l.qty) > 0),
      subtotal: t.subtotal,
      tax: t.tax,
      total: t.total,
      // B1: porsi yang memotong tagihan dikunci di sini, memakai sisa tagihan faktur
      // saat retur disimpan — bukan dihitung ulang belakangan.
      ...bagi,
      draft: asDraft,
      createdAt: form.createdAt ?? now,
      updatedAt: now,
    };
    onSave(logActivity(dokumen, asDraft ? 'created' : 'issued'));
  };

  const last = active === STEPS.length - 1;
  const step = STEPS[active];
  const stepError = blockOf(active);
  const nextBlock = stepError;
  const saveBlock = blockOf(0) ?? blockOf(1);
  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <BackLink label="Daftar retur" onClick={askCancel} />

      <PageIntro
        icon={ArrowCounterClockwise}
        title={form.createdAt ? 'Ubah Retur Draf' : 'Buat Retur / Nota Kredit'}
        description="Koreksi tagihan atas faktur yang sudah terbit. Harga dan pajak terkunci mengikuti fakturnya."
      />

      <Alert variant="light" color="primary" radius="md" icon={<Invoice size={16} />}>
        <Text fz="xs">
          Dibuat dari <b>{sale.number}</b> · total faktur {rupiah(faktur.total)} · sisa tagihan{' '}
          {rupiah(faktur.balance)}
        </Text>
      </Alert>

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
              description={s.description}
              icon={<s.icon size={16} />}
              completedIcon={<s.icon size={16} />}
            />
          ))}
        </Stepper>
      </Card>

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

          {step.value === 'info' && (
            <Stack gap="sm">
              <SimpleGrid cols={2} spacing="sm">
                <Box>
                  <Field label="Faktur sumber">{sale.number}</Field>
                </Box>
                <Box>
                  <Field label="Pelanggan">{customer?.name ?? '—'}</Field>
                </Box>
                <TextInput
                  label="Nomor Retur"
                  placeholder="Kosongkan untuk nomor otomatis"
                  radius="md"
                  value={form.number}
                  onChange={(e) => set({ number: e.currentTarget.value })}
                />
                <TextInput
                  type="date"
                  label="Tanggal Retur"
                  withAsterisk
                  radius="md"
                  leftSection={<CalendarBlank size={14} />}
                  min={sale.date}
                  value={form.date}
                  error={submitted && required.info}
                  onChange={(e) => set({ date: e.currentTarget.value })}
                />
                <Select
                  label="Alasan Retur"
                  withAsterisk
                  radius="md"
                  allowDeselect={false}
                  data={RETURN_REASONS}
                  value={form.reason}
                  onChange={(v) => set({ reason: v })}
                />
              </SimpleGrid>
              <Textarea
                label="Catatan"
                placeholder="Keterangan tambahan, misalnya nomor komplain..."
                radius="md"
                autosize
                minRows={2}
                value={form.note}
                onChange={(e) => set({ note: e.currentTarget.value })}
              />
            </Stack>
          )}

          {step.value === 'lines' && (
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Text fz="sm" fw={600} c="slate.9">
                  Baris faktur
                </Text>
                <Button size="xs" variant="light" radius="md" onClick={returAll}>
                  Retur semua
                </Button>
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
                  miw={860}
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
                      <Table.Th w={90} ta="right">
                        Qty faktur
                      </Table.Th>
                      <Table.Th w={100} ta="right">
                        Sudah diretur
                      </Table.Th>
                      <Table.Th w={120} ta="right">
                        Qty retur
                      </Table.Th>
                      <Table.Th w={140} ta="right">
                        Harga netto
                      </Table.Th>
                      <Table.Th w={110}>Pajak</Table.Th>
                      <Table.Th w={140} ta="right">
                        Total
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {form.lines.map((l) => {
                      const asal = sale.items[l.index];
                      const netto = netUnitPrice(sale, asal);
                      const sisa = returnableQty(asal);
                      return (
                        <Table.Tr key={l.index}>
                          <Table.Td>
                            <Text fz="sm" fw={600} c="slate.9">
                              {productName(asal)}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right" fz="sm">
                            {asal.qty}
                          </Table.Td>
                          <Table.Td ta="right" fz="sm" c="slate.6">
                            {asal.returnedQty ?? 0}
                          </Table.Td>
                          <Table.Td>
                            <NumberField
                              size="sm"
                              radius="md"
                              min={0}
                              max={sisa}
                              clampBehavior="strict"
                              decimalScale={0}
                              ta="right"
                              disabled={sisa === 0}
                              value={l.qty}
                              onChange={(v) => setQty(l.index, Number(v) || 0)}
                            />
                          </Table.Td>
                          <Table.Td ta="right" fz="sm" style={{ whiteSpace: 'nowrap' }}>
                            {rupiah(netto)}
                          </Table.Td>
                          <Table.Td fz="xs" c={asal.tax ? 'slate.8' : 'slate.5'}>
                            {taxLabel(asal.tax) ?? 'Tanpa pajak'}
                          </Table.Td>
                          <Table.Td ta="right" fz="sm" fw={700} style={{ whiteSpace: 'nowrap' }}>
                            {rupiah(netto * (Number(l.qty) || 0))}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Box>
            </Stack>
          )}

          {step.value === 'settle' && (
            <Stack gap="md">
              <Radio.Group
                value={form.settlement}
                onChange={(v) => set({ settlement: v })}
                label="Cara penyelesaian"
                withAsterisk
              >
                <Stack gap="sm" mt="xs">
                  {SETTLEMENTS.map((s) => {
                    const tidakBisa =
                      s.value === 'deduct' && faktur.balance <= 0
                        ? 'Faktur ini sudah tidak punya sisa tagihan'
                        : s.value === 'credit' && faktur.paid === 0 && faktur.balance > 0
                          ? 'Faktur belum dibayar sama sekali, jadi returnya memotong tagihan dulu'
                          : null;
                    return (
                      <Tooltip key={s.value} label={tidakBisa} disabled={!tidakBisa} withArrow fz="xs">
                        <Box
                          p="sm"
                          style={{
                            border: '1px solid var(--mantine-color-gray-3)',
                            borderRadius: 'var(--mantine-radius-md)',
                            opacity: tidakBisa ? 0.55 : 1,
                          }}
                        >
                          <Radio
                            value={s.value}
                            disabled={!!tidakBisa}
                            label={
                              <Box>
                                <Text fz="sm" fw={600} c="slate.9">
                                  {s.label}
                                </Text>
                                <Text fz={11} c="slate.6">
                                  {s.hint}
                                </Text>
                              </Box>
                            }
                          />
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Stack>
              </Radio.Group>

              {/* B1: nilai retur yang melebihi sisa tagihan tidak hilang — dipecah,
                  dan pembagiannya ditunjukkan sebelum retur diterbitkan. */}
              <Box
                p="md"
                bg="slate.0"
                style={{ borderRadius: 'var(--mantine-radius-md)' }}
              >
                <Text fz={11} fw={600} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }}>
                  Nilai retur dibagi
                </Text>
                <Group justify="space-between" py={3} mt={4}>
                  <Text fz="xs" c="slate.7">
                    Memotong tagihan {sale.number}
                  </Text>
                  <Text fz="xs" fw={700} c="slate.9">
                    {rupiah(bagi.deducted)}
                  </Text>
                </Group>
                <Group justify="space-between" py={3}>
                  <Text fz="xs" c="slate.7">
                    Jadi kredit pelanggan
                  </Text>
                  <Text fz="xs" fw={700} c="slate.9">
                    {rupiah(bagi.credited)}
                  </Text>
                </Group>
                <Text fz={11} c="slate.6" mt={6}>
                  Sisa tagihan faktur sekarang {rupiah(faktur.balance)}
                  {bagi.credited > 0 && bagi.deducted > 0
                    ? ' — kelebihan nilai retur menjadi kredit pelanggan.'
                    : '.'}
                </Text>
              </Box>

              <Alert variant="light" color="gray" radius="md" icon={<Warning size={16} />}>
                <Text fz="xs">
                  Pengembalian uang tunai belum tersedia. Retur diselesaikan dengan memotong
                  tagihan atau menjadi saldo kredit pelanggan.
                </Text>
              </Alert>
            </Stack>
          )}
        </Box>

        <Box px="lg" py="md" bg="slate.0" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
          <Box ml="auto" w={{ base: '100%', sm: 340 }}>
            <Group justify="space-between" py={3}>
              <Text fz="xs" c="slate.7">
                Subtotal retur
              </Text>
              <Text fz="xs" fw={600} c="slate.9">
                {rupiah(t.subtotal)}
              </Text>
            </Group>
            {t.tax > 0 && (
              <Group justify="space-between" py={3}>
                <Text fz="xs" c="slate.7">
                  PPN dikoreksi
                </Text>
                <Text fz="xs" fw={600} c="slate.9">
                  {rupiah(t.tax)}
                </Text>
              </Group>
            )}
            <Divider my={8} color="gray.3" />
            <Group justify="space-between" align="center">
              <Text fz="sm" fw={700} c="primary.9">
                Total Retur
              </Text>
              <Text fz={20} fw={700} c="primary.9" style={{ whiteSpace: 'nowrap' }}>
                {rupiah(t.total)}
              </Text>
            </Group>
          </Box>
        </Box>

        <Group
          justify="space-between"
          gap="sm"
          px="lg"
          py="md"
          bg="white"
          style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
        >
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
                  Terbitkan Retur
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
            Buang isian retur ini?
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

      <Text fz={11} c="slate.6" ta="center">
        Retur dibuat {formatDate(form.date)} atas faktur {sale.number}
      </Text>
    </Stack>
  );
}
