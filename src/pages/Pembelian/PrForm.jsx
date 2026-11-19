// Halaman penuh "Ajukan Pembayaran" (Payment Request) — pola sama dengan form Catat Faktur:
// dokumen sumbernya dipilih di dalam halaman, lalu diisi bertahap lewat stepper.
//
// Dua jalur:
//   'invoice' — pelunasan satu atau beberapa faktur vendor yang sama, dengan alokasi per faktur.
//   'dp'      — uang muka / CBD dari satu PO/SPK, sebelum fakturnya ada.
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  MultiSelect,
  Radio,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Table,
  Text,
  Textarea,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  Check,
  ClipboardText,
  Invoice,
  Storefront,
  Wallet,
  Warning,
} from '@/components/Icon.jsx';
import NumberField from '@/components/NumberField.jsx';
import {
  BackLink,
  blockedProps,
  Callout,
  EmptyState,
  PageIntro,
  StatusPill,
} from './components.jsx';
import { FileField } from './Dialogs.jsx';
import { personLabel, TODAY } from './data.js';
import {
  advancePct,
  bankOf,
  formatDate,
  INV_STATUS,
  invStatus,
  invTotals,
  nextNumber,
  poDocLabel,
  poDpAmount,
  poTotal,
  rupiah,
  termText,
  uid,
} from './utils.js';
import { toast } from './usePb.js';

// Lebih dari sekian vendor, kepala kartu diringkas jadi hitungannya saja.
const RINGKAS = 3;

// Pilihan vendor di form ini menyebut apa yang relevan SEKARANG: berapa dokumen terbuka
// vendor itu dan berapa nilainya. Jumlah PO sebelumnya (bawaan renderVendorOption) tidak
// membantu memilih siapa yang mau dibayar.
const renderPayeeOption = ({ option }) => (
  <Group gap="sm" wrap="nowrap" style={{ width: '100%' }}>
    <ThemeIcon variant="light" size={32} radius="md" style={{ flexShrink: 0 }}>
      <Buildings size={18} />
    </ThemeIcon>
    <Box style={{ minWidth: 0, flex: 1 }}>
      <Text fz="sm" fw={600} c="slate.9" truncate>{option.label}</Text>
      <Text fz={11} c="slate.6">{option.sub}</Text>
    </Box>
  </Group>
);

const STEPS = [
  { value: 'source', label: 'Sumber Pembayaran', description: 'Pilih vendor, lalu fakturnya', icon: ClipboardText },
  { value: 'amount', label: 'Nominal', description: 'Alokasi per faktur dan totalnya', icon: Wallet },
  { value: 'submit', label: 'Data Pengajuan', description: 'Berkas, catatan, rekening tujuan', icon: Invoice },
];

const th = {
  th: { fontSize: 'var(--mantine-font-size-xs)', color: 'var(--mantine-color-slate-7)', fontWeight: 600, whiteSpace: 'nowrap' },
};
const tableFrame = {
  border: '1px solid var(--mantine-color-gray-3)',
  borderRadius: 'var(--mantine-radius-md)',
  overflow: 'auto',
};

function ModeCard({ icon: Icon, title, text, active, onClick }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      ta="left"
      p="md"
      style={{
        cursor: 'pointer',
        borderRadius: 'var(--mantine-radius-md)',
        border: `1px solid ${active ? 'var(--mantine-color-primary-6)' : 'var(--mantine-color-gray-3)'}`,
        background: active ? 'var(--mantine-color-primary-0)' : 'white',
        boxShadow: active ? '0 0 0 1px var(--mantine-color-primary-6) inset' : undefined,
      }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <ThemeIcon variant="light" color={active ? 'primary' : 'slate'} size={32} radius="md">
          <Icon size={16} />
        </ThemeIcon>
        <Box>
          <Text fz="sm" fw={700} c="slate.9">{title}</Text>
          <Text fz={11} c="slate.6">{text}</Text>
        </Box>
      </Group>
    </Box>
  );
}

// Rekening tujuan: satu PR = satu transfer per vendor, jadi penerimanya selalu satu.
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

function TotalsBand({ rows, totalLabel, total }) {
  return (
    <Box px="lg" py="md" bg="slate.0" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
      <Box ml="auto" w={{ base: '100%', sm: 340 }}>
        {rows.filter(Boolean).map((r) => (
          <Group key={r.label} justify="space-between" gap="md" py={3} wrap="nowrap">
            <Text fz="xs" c="slate.7">{r.label}</Text>
            <Text fz="xs" fw={600} c={r.color ?? 'slate.9'} style={{ whiteSpace: 'nowrap' }}>{r.value}</Text>
          </Group>
        ))}
        <Divider my={8} color="gray.3" />
        <Group justify="space-between" align="center" gap="md" wrap="nowrap">
          <Text fz="sm" fw={700} c="primary.9">{totalLabel}</Text>
          <Text fz={20} fw={700} c="primary.9" lh={1.2} style={{ whiteSpace: 'nowrap' }}>{rupiah(total)}</Text>
        </Group>
      </Box>
    </Box>
  );
}

export default function PrForm({ pb, initialInvoiceIds = [], initialPoId = null, onBack, onSaved }) {
  // Faktur yang masih punya sisa hutang belum dialokasikan ke PR mana pun.
  const readyInvoices = pb.invoices.filter((i) => invTotals(i, pb.calc).free > 0);
  // PO/SPK beruang muka yang PR DP-nya belum pernah diajukan.
  const readyPos = pb.pos.filter(
    (p) => p.sent && advancePct(p.term) > 0 && !pb.prs.some((x) => x.kind === 'dp' && x.poId === p.id && x.status !== 'ditolak'),
  );

  const seededPo = readyPos.some((p) => p.id === initialPoId) ? initialPoId : null;
  // Pilihan awal dari alamat halaman: cukup faktur yang memang masih bisa diajukan.
  const seededInv = initialInvoiceIds.filter((id) => readyInvoices.some((i) => i.id === id));

  const [active, setActive] = useState(0);
  const [reached, setReached] = useState(0);
  const [sub, setSub] = useState(false);

  const [mode, setMode] = useState(seededPo ? 'dp' : 'invoice');
  // Vendor dipilih dulu — boleh lebih dari satu — baru fakturnya menyusul. Uang muka tetap
  // satu vendor, karena uang mukanya milik satu pesanan.
  const [vendorSel, setVendorSel] = useState(() => {
    if (seededPo) return [pb.posById[seededPo]?.vendorId].filter(Boolean);
    return [...new Set(seededInv.map((id) => pb.invoicesById[id]?.vendorId).filter(Boolean))];
  });
  const [picked, setPicked] = useState(seededPo ? [seededPo] : seededInv);
  const [alloc, setAlloc] = useState({});
  const [dpInput, setDpInput] = useState(null);
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');

  const isDp = mode === 'dp';
  const ready = isDp ? readyPos : readyInvoices;
  // Hanya dokumen milik vendor yang dipilih. Satu PR boleh mencakup beberapa vendor;
  // pembayarannya tetap per vendor — satu Payment Voucher per vendor nanti.
  const rows = ready.filter((d) => vendorSel.includes(d.vendorId));
  const vendorsWithReady = pb.vendors.filter((v) => ready.some((d) => d.vendorId === v.id));
  const payeeOptions = vendorsWithReady.map((v) => {
    const milik = ready.filter((d) => d.vendorId === v.id);
    const nilai = milik.reduce((n, d) => n + (isDp ? poDpAmount(d) : invTotals(d, pb.calc).free), 0);
    return {
      value: v.id,
      label: v.name,
      sub: `${milik.length} ${isDp ? 'pesanan beruang muka' : 'faktur terbuka'} · ${rupiah(nilai)}`,
    };
  });

  const invs = isDp ? [] : picked.map((id) => pb.invoicesById[id]).filter(Boolean);
  const po = isDp ? pb.posById[picked[0]] : null;
  // Vendor yang benar-benar ditagih dalam PR ini, menurut dokumen yang dipilih.
  const vendorIds = [...new Set(isDp ? (po ? [po.vendorId] : []) : invs.map((i) => i.vendorId))];
  const vendors = vendorIds.map((id) => pb.vendorsById[id]).filter(Boolean);
  const vendor = vendors[0] ?? null;
  const totals = Object.fromEntries(invs.map((i) => [i.id, invTotals(i, pb.calc)]));
  // Alokasi bawaan = sisa hutang penuh; yang sudah disentuh pengguna tidak ditimpa.
  const allocOf = (i) => alloc[i.id] ?? totals[i.id].free;
  const totalFree = invs.reduce((n, i) => n + totals[i.id].free, 0);
  // Dokumen yang sedang ditagih, apa pun jalurnya.
  const dokumen = isDp ? (po ? [po] : []) : invs;
  const subtotalOf = (vid) => invs.filter((i) => i.vendorId === vid).reduce((n, i) => n + allocOf(i), 0);
  const dpBase = po ? poDpAmount(po) : 0;
  const dpAmount = dpInput ?? dpBase;
  const amount = isDp ? dpAmount : invs.reduce((n, i) => n + allocOf(i), 0);
  // Nominal DP yang diubah manual ditandai supaya tidak lewat tanpa disadari.
  const offBase = isDp && dpAmount !== dpBase;

  const switchMode = (m) => { setMode(m); setPicked([]); setVendorSel([]); setAlloc({}); setDpInput(null); };
  // Melepas satu vendor ikut membuang dokumennya dari pilihan: kalau tidak, ada faktur
  // tercentang yang tidak kelihatan di tabel mana pun tapi tetap ikut ditagihkan.
  const pickVendors = (ids) => {
    setVendorSel(ids);
    setPicked((p) => p.filter((id) => ids.includes((isDp ? pb.posById[id] : pb.invoicesById[id])?.vendorId)));
    if (isDp) setDpInput(null);
  };
  const togglePick = (id) => setPicked((p) => {
    // DP selalu satu PO: uang muka milik satu pesanan, tidak ada yang digabung.
    if (isDp) return p.includes(id) ? [] : [id];
    return p.includes(id) ? p.filter((x) => x !== id) : [...p, id];
  });

  const required = {
    source: {
      vendor: !vendorSel.length && (isDp ? 'Vendor wajib dipilih' : 'Pilih minimal satu vendor'),
      picked: !picked.length && (isDp ? 'Pilih pesanan yang akan dibayar di muka' : 'Pilih minimal satu faktur'),
    },
    amount: {
      amount: amount <= 0 && 'Nominal pembayaran masih Rp 0',
      over: !isDp && invs.some((i) => allocOf(i) > totals[i.id].free) && 'Alokasi melebihi sisa hutang faktur',
    },
    submit: {
      ref: isDp && !ref && 'Invoice proforma wajib diunggah',
    },
  };
  const blockOf = (i) => Object.values(required[STEPS[i].value]).find(Boolean) ?? null;
  const stepValid = (i) => !blockOf(i);
  const canGoTo = (i) => STEPS.slice(0, i).every((_, j) => stepValid(j));
  const errors = sub ? { ...required.source, ...required.amount, ...required.submit } : {};

  const go = (i) => {
    setSub(false);
    setActive(i);
    setReached((r) => Math.max(r, i));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = () => {
    const kurang = STEPS.findIndex((_, i) => !stepValid(i));
    if (kurang >= 0) {
      go(kurang);
      setSub(true);
      return;
    }
    const doc = {
      id: uid('pr'),
      number: nextNumber('PR', pb.prs),
      kind: isDp ? 'dp' : 'pelunasan',
      // vendorId tetap diisi vendor pertama supaya layar lama yang membacanya tidak pecah;
      // daftar lengkapnya ada di vendorIds.
      vendorId: vendor.id,
      vendorIds,
      poId: isDp ? po.id : invs[0].poId,
      invoiceIds: isDp ? [] : invs.map((i) => i.id),
      alloc: isDp ? undefined : Object.fromEntries(invs.map((i) => [i.id, allocOf(i)])),
      amount,
      date: TODAY,
      status: 'diajukan',
      // Dicatat untuk pemisahan tugas: pembuat PR tidak boleh menyetujui PR-nya sendiri.
      createdBy: personLabel(pb.role),
      note,
      ref,
    };
    pb.add('prs', doc);
    toast('Payment Request diajukan ke approver.');
    onSaved(doc.id);
  };

  const step = STEPS[active];
  const last = active === STEPS.length - 1;
  const stepError = blockOf(active);
  const saveBlock = blockOf(0) ?? blockOf(1) ?? blockOf(2);

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" className="pb-form">
      <BackLink label="Kembali ke daftar pembayaran" onClick={onBack} />

      <PageIntro
        icon={Wallet}
        title="Ajukan Pembayaran"
        description={isDp
          ? 'Permintaan pembayaran uang muka atas satu pesanan, sebelum fakturnya ada.'
          : 'Pilih vendor dulu, boleh beberapa, lalu faktur mana saja yang dibayar. Pembayarannya tetap per vendor.'}
      />

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
                  <Text component="span" display="block" fz={10} fw={600} tt="uppercase" c={i <= reached ? 'secondary.7' : 'slate.5'} style={{ letterSpacing: 0.5 }}>
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
          <Group gap="sm" wrap="nowrap" justify="space-between">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon variant="light" bg="slate.0" c="slate.7" size={32} radius="md">
                <step.icon size={16} />
              </ThemeIcon>
              <Box>
                <Text fw={700} fz="sm" c="slate.9">{step.label}</Text>
                <Text fz={11} c="slate.6">{step.description}</Text>
              </Box>
            </Group>
            {/* Dikelompokkan per vendor: satu PR bisa mencakup beberapa vendor, jadi satu nama
                di atas setumpuk nomor faktur akan salah menyebut milik siapa nomor-nomor itu.
                Lebih dari tiga vendor diringkas, supaya kepala kartu tidak lebih tinggi
                daripada isinya. */}
            {vendors.length > 0 && (
              <Stack gap={6} align="flex-end" maw={460} style={{ flexShrink: 0 }}>
                {vendors.length > RINGKAS ? (
                  <>
                    <Text fz="sm" fw={700} c="slate.9">{vendors.length} vendor</Text>
                    <Text fz={11} c="slate.6">{dokumen.length} {isDp ? 'pesanan' : 'faktur'} · {rupiah(amount)}</Text>
                  </>
                ) : (
                  vendors.map((v) => {
                    const milikV = dokumen.filter((d) => d.vendorId === v.id);
                    return (
                      <Box key={v.id} ta="right">
                        <Text fz="sm" fw={700} c="slate.9" lh={1.25}>{v.name}</Text>
                        <Group gap={4} justify="flex-end" wrap="wrap" mt={2}>
                          {milikV.map((d) => (
                            <Badge key={d.id} size="sm" radius="sm" variant="light" color="slate" fw={600} tt="none">{d.number}</Badge>
                          ))}
                        </Group>
                      </Box>
                    );
                  })
                )}
              </Stack>
            )}
            {!vendors.length && <Text fz={11} c="slate.6">Belum ada dokumen dipilih</Text>}
          </Group>
        </Box>

        <Box p="lg">
          {sub && stepError && (
            <Alert variant="light" color="red" radius="md" icon={<Warning size={16} />} mb="md">
              <Text fz="xs">{stepError}</Text>
            </Alert>
          )}

          {step.value === 'source' && (
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                <ModeCard
                  icon={Invoice}
                  title="Pelunasan faktur"
                  text="Pilih vendornya dulu — boleh beberapa — lalu faktur mana saja yang dibayar."
                  active={!isDp}
                  onClick={() => switchMode('invoice')}
                />
                <ModeCard
                  icon={Wallet}
                  title="Uang muka (DP / CBD)"
                  text="Dibayar sebelum fakturnya ada, dari satu PO/SPK bertermin uang muka."
                  active={isDp}
                  onClick={() => switchMode('dp')}
                />
              </SimpleGrid>

              {/* Vendor dulu, baru fakturnya. Pelunasan boleh beberapa vendor sekaligus;
                  uang muka satu saja, karena uang mukanya milik satu pesanan. */}
              {isDp ? (
                <Select
                  label="Vendor"
                  withAsterisk
                  size="sm"
                  radius="md"
                  searchable
                  placeholder={vendorsWithReady.length ? 'Pilih vendor' : 'Tidak ada vendor dengan pesanan beruang muka'}
                  description="Uang muka selalu atas satu pesanan, jadi satu vendor."
                  disabled={!vendorsWithReady.length}
                  data={payeeOptions}
                  renderOption={renderPayeeOption}
                  value={vendorSel[0] ?? null}
                  error={errors.vendor}
                  onChange={(v) => pickVendors(v ? [v] : [])}
                  leftSection={<Storefront size={14} />}
                />
              ) : (
                <MultiSelect
                  label="Vendor"
                  withAsterisk
                  size="sm"
                  radius="md"
                  searchable
                  clearable
                  hidePickedOptions
                  placeholder={vendorSel.length ? 'Tambah vendor lain' : (vendorsWithReady.length ? 'Pilih satu atau beberapa vendor' : 'Tidak ada vendor dengan faktur terbuka')}
                  description="Boleh lebih dari satu. Fakturnya dipilih di tabel di bawah."
                  disabled={!vendorsWithReady.length}
                  data={payeeOptions}
                  renderOption={renderPayeeOption}
                  value={vendorSel}
                  error={errors.vendor}
                  onChange={pickVendors}
                  leftSection={<Storefront size={14} />}
                />
              )}

              {!vendorSel.length ? (
                <Callout>Pilih vendor dulu untuk melihat {isDp ? 'pesanan beruang muka' : 'faktur'} yang bisa diajukan.</Callout>
              ) : !rows.length ? (
                <EmptyState
                  icon={Wallet}
                  title={`Belum ada ${isDp ? 'pesanan' : 'faktur'} yang bisa diajukan`}
                  text={isDp
                    ? 'Semua pesanan beruang muka vendor ini sudah pernah diajukan PR DP-nya.'
                    : 'Semua faktur vendor yang dipilih sudah lunas atau sudah dialokasikan ke PR lain.'}
                />
              ) : (
                <Box style={tableFrame}>
                  <Table verticalSpacing="xs" horizontalSpacing="sm" miw={760} styles={th}>
                    <Table.Thead bg="slate.0">
                      <Table.Tr>
                        <Table.Th w={44} />
                        <Table.Th>{isDp ? 'No. PO/SPK' : 'No. faktur'}</Table.Th>
                        {!isDp && <Table.Th>Vendor</Table.Th>}
                        <Table.Th>{isDp ? 'Termin bayar' : 'Jatuh tempo'}</Table.Th>
                        {!isDp && <Table.Th>Status</Table.Th>}
                        {isDp && <Table.Th>Tanggal</Table.Th>}
                        <Table.Th ta="right">{isDp ? 'Uang muka' : 'Sisa hutang'}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {rows.map((d) => {
                        const dipilih = picked.includes(d.id);
                        const late = !isDp && d.dueDate < TODAY;
                        return (
                          <Table.Tr
                            key={d.id}
                            onClick={() => togglePick(d.id)}
                            style={{ cursor: 'pointer' }}
                            bg={dipilih ? 'primary.0' : undefined}
                          >
                            <Table.Td>
                              {/* DP satu pesanan saja, jadi bulat; pelunasan boleh banyak faktur. */}
                              {isDp ? (
                                <Radio size="xs" checked={dipilih} aria-label={`Pilih ${d.number}`} onChange={() => togglePick(d.id)} />
                              ) : (
                                <Checkbox size="xs" checked={dipilih} aria-label={`Pilih ${d.number}`} onChange={() => togglePick(d.id)} />
                              )}
                            </Table.Td>
                            <Table.Td fz="sm" fw={700}>
                              {d.number}
                              {!isDp && d.vendorNo && <Text fz={11} c="slate.6" fw={400}>{d.vendorNo}</Text>}
                            </Table.Td>
                            {!isDp && <Table.Td fz="xs" c="slate.7">{pb.vendorsById[d.vendorId]?.name ?? '—'}</Table.Td>}
                            <Table.Td fz="xs" fw={late ? 700 : 400} c={late ? 'red.7' : 'slate.7'}>
                              {isDp ? termText(d.term) : formatDate(d.dueDate)}
                            </Table.Td>
                            {/* Status dibaca dari sisa hutang dan tanggalnya, sama dengan daftar
                                Tagihan Vendor — bukan ditebak ulang di sini. */}
                            {!isDp && (
                              <Table.Td>
                                <StatusPill map={INV_STATUS} status={invStatus(d, invTotals(d, pb.calc))} size="xs" />
                              </Table.Td>
                            )}
                            {isDp && <Table.Td fz="xs" c="slate.7">{formatDate(d.date)}</Table.Td>}
                            <Table.Td ta="right" fz="sm" fw={600}>
                              {rupiah(isDp ? poDpAmount(d) : invTotals(d, pb.calc).free)}
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Box>
              )}
            </Stack>
          )}

          {step.value === 'amount' && (
            isDp ? (
              <Stack gap="md">
                <Box maw={360}>
                  <NumberField
                    label="Nominal diajukan"
                    withAsterisk
                    size="sm"
                    radius="md"
                    money
                    prefix="Rp "
                    value={dpAmount}
                    error={errors.amount}
                    onChange={(v) => setDpInput(Number(v) || 0)}
                  />
                  <Group gap={6} mt={4} wrap="nowrap">
                    <Text fz={11} c={offBase ? 'orange.8' : 'slate.6'}>
                      {advancePct(po?.term) >= 100 ? 'Bayar penuh di muka' : `Uang muka ${advancePct(po?.term)}%`} = {rupiah(dpBase)}
                    </Text>
                    {offBase && (
                      <Button size="compact-xs" radius="md" variant="subtle" onClick={() => setDpInput(dpBase)}>Pakai nilai ini</Button>
                    )}
                  </Group>
                </Box>
                <Callout>
                  {termText(po?.term)} · dari total {poDocLabel(po)} {rupiah(poTotal(po))}. Uang muka dibayar tanpa
                  faktur pembelian; vendor melampirkan invoice proforma.
                </Callout>
              </Stack>
            ) : (
              <Stack gap="md">
                <Group justify="space-between">
                  <Text fz="sm" fw={600} c="slate.9">Alokasi per faktur</Text>
                  <Group gap={4}>
                    <Button size="compact-xs" radius="md" variant="subtle" onClick={() => setAlloc(Object.fromEntries(invs.map((i) => [i.id, totals[i.id].free])))}>Bayar penuh</Button>
                    <Button size="compact-xs" radius="md" variant="subtle" color="slate" onClick={() => setAlloc(Object.fromEntries(invs.map((i) => [i.id, 0])))}>Kosongkan</Button>
                  </Group>
                </Group>
                <Box style={tableFrame}>
                  <Table verticalSpacing="xs" horizontalSpacing="sm" miw={680} styles={th}>
                    <Table.Thead bg="slate.0">
                      <Table.Tr>
                        <Table.Th>Faktur</Table.Th>
                        <Table.Th ta="right">Sisa hutang</Table.Th>
                        <Table.Th w={180} ta="right">Dibayar sekarang</Table.Th>
                        <Table.Th ta="right">Sisa setelah ini</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {invs.map((i) => {
                        const late = i.dueDate < TODAY;
                        const sisa = Math.max(totals[i.id].free - allocOf(i), 0);
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
                              <NumberField
                                size="xs"
                                radius="md"
                                money
                                prefix="Rp "
                                max={totals[i.id].free}
                                clampBehavior="strict"
                                aria-label={`Nominal untuk ${i.number}`}
                                value={allocOf(i)}
                                onChange={(v) => setAlloc((a) => ({ ...a, [i.id]: Math.min(Number(v) || 0, totals[i.id].free) }))}
                              />
                            </Table.Td>
                            <Table.Td ta="right" fz="sm" fw={sisa === 0 ? 700 : 400} c={sisa === 0 ? 'green.8' : undefined}>
                              {sisa === 0 ? 'Lunas' : rupiah(sisa)}
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </Box>
              </Stack>
            )
          )}

          {step.value === 'submit' && (
            <Stack gap="md">
              {/* Satu strip per vendor, lengkap dengan subtotalnya: PR boleh mencakup beberapa
                  vendor, tapi transfernya tetap per vendor — satu PV per vendor nanti. */}
              {vendors.map((v) => (
                <PayeeStrip
                  key={v.id}
                  vendor={v}
                  subtotalLabel={vendors.length > 1 ? 'Subtotal vendor ini' : 'Total diajukan'}
                  subtotal={isDp ? amount : subtotalOf(v.id)}
                />
              ))}
              {vendors.length > 1 && (
                <Callout tone="warn" title={`${vendors.length} vendor dalam satu PR`}>
                  Satu transfer hanya bisa ke satu rekening, jadi setelah disetujui PR ini
                  menerbitkan <strong>{vendors.length} Payment Voucher</strong> — satu per vendor,
                  masing-masing sebesar subtotal di atas.
                </Callout>
              )}
              <FileField
                label={isDp ? 'Invoice proforma' : 'Lampiran pendukung (opsional)'}
                withAsterisk={isDp}
                value={ref}
                error={errors.ref}
                onChange={setRef}
              />
              <Textarea
                label="Catatan"
                placeholder="Opsional. Contoh: mohon ditransfer sebelum akhir bulan."
                size="sm"
                radius="md"
                autosize
                minRows={2}
                value={note}
                onChange={(e) => setNote(e.currentTarget.value)}
              />
              <Callout>
                PR ini diajukan ke approval berjenjang: Chief Finance dulu, lalu Building Manager.
                Kas baru keluar setelah Payment Voucher terbit dan pembayarannya dicatat.
              </Callout>
            </Stack>
          )}
        </Box>

        {/* Angka baru ada artinya setelah dokumennya dipilih. */}
        {step.value !== 'source' && (
          <TotalsBand
            rows={isDp
              ? [{ label: 'Nilai pesanan', value: rupiah(poTotal(po)) }, offBase && { label: 'Nilai uang muka menurut termin', value: rupiah(dpBase), color: 'orange.8' }]
              : [
                { label: `Sisa hutang ${invs.length} faktur`, value: rupiah(totalFree) },
                { label: 'Sisa setelah PR ini', value: rupiah(Math.max(totalFree - amount, 0)) },
              ]}
            totalLabel="Total diajukan"
            total={amount}
          />
        )}

        <Group justify="space-between" gap="sm" px="lg" py="md" bg="white" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
          <Button variant="outline" color="slate" radius="md" onClick={onBack}>Batal</Button>
          <Group gap="sm">
            {active > 0 && (
              <Button variant="default" radius="md" leftSection={<ArrowLeft size={16} />} onClick={() => go(active - 1)}>
                Langkah sebelumnya
              </Button>
            )}
            {last ? (
              <Tooltip label={saveBlock} disabled={!saveBlock} withArrow fz="xs" position="top">
                <Button radius="md" leftSection={<Check size={16} />} onClick={submit} {...blockedProps(saveBlock, () => setSub(true))}>
                  Ajukan Pembayaran
                </Button>
              </Tooltip>
            ) : (
              <Tooltip label={stepError} disabled={!stepError} withArrow fz="xs" position="top">
                <Button radius="md" rightSection={<ArrowRight size={16} />} onClick={() => go(active + 1)} {...blockedProps(stepError, () => setSub(true))}>
                  Lanjut
                </Button>
              </Tooltip>
            )}
          </Group>
        </Group>
      </Card>
    </Stack>
  );
}
