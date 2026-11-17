// Komponen pengadaan: panduan langkah, pilihan jalur, form bidding / vendor tunggal, dan form pesan ulang.
import { Fragment, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  UnstyledButton,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { blockedBySoD, canApprove, canCreate } from './permissions.js';
import { ArrowsClockwise, CaretDown, CaretUp, Check, ListChecks, Plus, Scales, Storefront, Warning } from '@/components/Icon.jsx';
import NumberField from '@/components/NumberField.jsx';
import { Callout, renderVendorOption, Section, vendorSelectData } from './components.jsx';
import { fitOptions, personTitle, RULES } from './data.js';
import AttachmentList from './Attachments.jsx';
import BiddingForm from './BiddingSheet.jsx';
import {
  biddingReady,
  minQuotesFor,
  poAllJasa,
  needsBiddingNote,
  formatDate,
  approverFor,
  fpbjTotal,
  PROC_STATUS,
  quoteLine,
  repeatCheck,
  repeatReady,
  rupiah,
  termParts,
  termText,
  lineTaxes,
  taxSummary,
  biddingWinner,
} from './utils.js';

export const th = { th: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600, color: 'var(--mantine-color-slate-7)', whiteSpace: 'nowrap' } };
export const frame = { border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)', overflow: 'auto' };

// Menyebut siapa yang ditunggu: alert oranye berisi jabatannya, mis. "Menunggu tindakan manager keuangan".
export const Hint = ({ role }) => <Callout tone="wait">Menunggu tindakan {personTitle(role).toLowerCase()}</Callout>;

export function ProcGuide({ f, pb, role }) {
  const proc = f.procurement ?? {};
  const st = proc.status;
  const single = !!f.single?.on;
  const isRepeat = f.route === 'repeat';
  const nQuotes = f.quotes.length;
  const approved = st === 'disetujui';
  const submitted = st === 'diajukan' || approved;
  let steps;
  if (isRepeat) {
    const c = repeatCheck(f, pb.pos);
    steps = [
      { label: 'Vendor & PO acuan', sub: pb.vendorsById[f.refVendorId]?.name ?? 'Belum dipilih', done: !!f.refVendorId },
      { label: 'Penawaran terbaru', sub: c.hasQuote ? 'Sudah diunggah' : 'Belum diunggah', done: c.hasQuote, cta: 'Upload penawaran' },
      { label: 'Cek harga', sub: repeatReady(f, pb.pos) ? 'Harga wajar' : c.forceBidding ? 'Wajib bidding' : c.mixed ? 'Pisahkan paket' : 'Lengkapi isian', done: repeatReady(f, pb.pos) },
      { label: 'Persetujuan', sub: approved ? 'Disetujui' : st === 'diajukan' ? 'Menunggu approver' : 'Belum diajukan', done: approved },
    ];
  } else if (single) {
    steps = [
      { label: 'Penawaran vendor', sub: nQuotes ? '1 penawaran' : 'Belum ada', done: nQuotes >= 1, cta: 'Tambah penawaran' },
      { label: 'Harga final', sub: biddingReady(f) ? 'Siap diajukan' : 'Lengkapi isian', done: biddingReady(f) },
      { label: 'Persetujuan', sub: approved ? 'Disetujui' : st === 'diajukan' ? 'Menunggu approver' : 'Belum diajukan', done: approved },
    ];
  } else {
    const picked = !!biddingWinner(f);
    steps = [
      { label: 'Kumpulkan penawaran', sub: `${nQuotes} dari ${minQuotesFor(f)}`, done: nQuotes >= minQuotesFor(f), cta: 'Tambah penawaran' },
      { label: 'Pilih pemenang', sub: picked ? 'Vendor pemenang terpilih' : 'Belum dipilih', done: nQuotes >= minQuotesFor(f) && picked },
      { label: 'Alasan dan catatan', sub: biddingReady(f) ? 'Siap diajukan' : 'Belum lengkap', done: biddingReady(f) },
      { label: 'Persetujuan', sub: approved ? 'Disetujui' : st === 'diajukan' ? 'Menunggu approver' : 'Belum diajukan', done: approved },
    ];
  }
  // Langkah 4 dianggap aktif setelah diajukan.
  const firstOpen = steps.findIndex((s) => !s.done);
  const current = submitted && !approved ? steps.length - 1 : firstOpen === -1 ? steps.length : firstOpen;
  const step = steps[current];
  const title = isRepeat ? 'Pesan ulang' : single ? 'Vendor tunggal' : 'Bidding';
  return (
    <Card withBorder radius="lg" padding={0} bg="white">
      <Group justify="space-between" px="lg" py="md">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" size={32} radius="md" style={{ flexShrink: 0 }}><ListChecks size={18} /></ThemeIcon>
          <Box>
            <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }}>Langkah pengadaan</Text>
            <Text fz="sm" fw={700} c="slate.9">{title}</Text>
          </Box>
        </Group>
        <Badge size="sm" radius="sm" variant="light" color={approved ? 'green' : 'blue'} tt="none">
          {approved ? 'Selesai' : `${Math.min(current + 1, steps.length)} dari ${steps.length}`}
        </Badge>
      </Group>
      <SimpleGrid cols={{ base: 2, sm: steps.length }} spacing={0} style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
        {steps.map((s, i) => {
          const done = s.done;
          const active = i === current;
          return (
            <Group key={s.label} gap="xs" wrap="nowrap" align="flex-start" px="lg" py="md" style={{ borderLeft: i ? '1px solid var(--mantine-color-gray-2)' : undefined, background: active ? 'var(--mantine-color-primary-0)' : undefined }}>
              <ThemeIcon size={24} radius="xl" variant={done ? 'filled' : 'default'} color={done ? 'secondary.7' : 'slate'} style={{ flexShrink: 0, ...(active && !done ? { background: 'var(--mantine-color-white)', borderColor: 'var(--mantine-color-primary-3)' } : {}) }}>
                {done ? <Check size={14} /> : <Text fz={11} fw={700} c={active ? 'primary.9' : 'slate.5'}>{i + 1}</Text>}
              </ThemeIcon>
              <Box style={{ minWidth: 0 }}>
                <Text fz="xs" fw={700} c={done || active ? 'slate.9' : 'slate.6'} lh={1.3}>{s.label}</Text>
                <Text fz={11} c="slate.6">{s.sub}</Text>
              </Box>
            </Group>
          );
        })}
      </SimpleGrid>
      {step?.cta && canCreate(role, 'procurement') && !submitted && (
        <Group justify="space-between" px="lg" py="sm" bg="slate.0" style={{ borderTop: '1px solid var(--mantine-color-gray-2)', borderRadius: '0 0 var(--mantine-radius-lg) var(--mantine-radius-lg)' }}>
          <Text fz="xs" c="slate.7">Berikutnya: <b>{step.label}</b></Text>
          <Text fz="xs" c="slate.6">{step.cta} di bagian bawah ini</Text>
        </Group>
      )}
    </Card>
  );
}

export const ROUTE_OPTIONS = [
  { value: 'single', icon: Storefront, short: 'Vendor tunggal', title: 'Vendor tunggal', text: 'Hanya satu vendor yang bisa menyuplai. Cukup satu penawaran, lalu diajukan ke approver.' },
  { value: 'bidding', icon: Scales, short: 'Bidding', title: 'Pengadaan dengan bidding', text: 'Kumpulkan minimal 3 penawaran, negosiasi, lalu pilih pemenang. Untuk vendor atau barang baru.' },
  { value: 'repeat', icon: ArrowsClockwise, short: 'Pesan ulang', title: 'Pesan ulang', text: 'Vendor sudah dipercaya. Harga dibandingkan dengan pembelian terakhir; item baru butuh pembanding.' },
];

export function RouteOption({ mode, setMode, value, title, text, icon: Icon, disabled }) {
  return (
    <Box
      onClick={() => !disabled && setMode(value)}
      p="md"
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && mode !== value ? 0.55 : 1,
        border: `1px solid var(--mantine-color-${mode === value ? 'primary-9' : 'gray-3'})`,
        background: mode === value ? 'var(--mantine-color-primary-0)' : undefined,
        borderRadius: 'var(--mantine-radius-md)',
      }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <ThemeIcon variant={mode === value ? 'filled' : 'light'} color="primary" size={40} radius="md" style={{ flexShrink: 0 }}>
          <Icon size={20} />
        </ThemeIcon>
        <Box style={{ minWidth: 0 }}>
          <Text fz="sm" fw={700}>{title}</Text>
          <Text fz="xs" c="slate.6">{text}</Text>
        </Box>
      </Group>
    </Box>
  );
}

// --- Pilih jalur -----------------------------------------------------------------------------------
export function RouteSelector({ f, role, onPick }) {
  const current = f.route === 'repeat' ? 'repeat' : f.single?.on ? 'single' : f.route === 'bidding' ? 'bidding' : null;
  const hasQuotes = f.quotes.length > 0;
  // Pesan ulang tidak bisa ditukar dengan jalur lain bila penawaran sudah ada (data penawarannya berbeda).
  const blocked = (v) => !canCreate(role, 'procurement') || (hasQuotes && !!current && (v === 'repeat') !== (current === 'repeat'));
  const options = ROUTE_OPTIONS;
  // Setelah jalur dipilih, pilihan diringkas jadi satu baris agar form langsung terlihat.
  if (current) {
    const chosen = options.find((o) => o.value === current);
    return (
      <Stack gap="xs">
        <SegmentedControl
          fullWidth
          radius="md"
          value={current}
          onChange={onPick}
          data={options.map((o) => ({
            value: o.value,
            disabled: blocked(o.value),
            label: (
              <Group gap={8} justify="center" wrap="nowrap" py={2}>
                <o.icon size={18} />
                <Text fz="sm" fw={600} span>{o.short}</Text>
              </Group>
            ),
          }))}
        />
        <Text fz="xs" c="slate.6">{chosen.text}</Text>
        {hasQuotes && canCreate(role, 'quote') && (
          <Text fz="xs" c="slate.6">Pesan ulang dan jalur lain tidak bisa saling ditukar setelah ada penawaran.</Text>
        )}
      </Stack>
    );
  }
  return (
    <Stack gap="sm">
      {options.map((o) => (
        <RouteOption key={o.value} mode={current} setMode={onPick} disabled={blocked(o.value)} value={o.value} icon={o.icon} title={o.title} text={o.text} />
      ))}
    </Stack>
  );
}

// --- Bidding ----------------------------------------------------------------------------------------
export function BiddingSection({ f, pb, role, patchProc, onAddQuote, onEditQuote, onSubmit, onApprove, onReject, vendor }) {
  const [openQuote, setOpenQuote] = useState(null); // id penawaran yang rincian itemnya dibuka
  const proc = f.procurement ?? {};
  const st = proc.status;
  const locked = st === 'diajukan' || st === 'disetujui';
  const single = !!f.single?.on;
  const enough = f.quotes.length >= minQuotesFor(f);
  const ready = biddingReady(f);
  const needNote = needsBiddingNote(f);

  // Vendor tunggal: penawaran dan form pengadaan dijadikan satu kartu (tetap bisa ganti penawaran atau ajukan).
  if (single && f.quotes.length >= 1) {
    const q = f.quotes[0];
    const termLabel = termText(q.term);
    const readOnly = locked || !canCreate(role, 'quote');
    const approved = st === 'disetujui';
    // Setelah disetujui yang tersisa hanya harga final (teks), bukan kolom penawaran dan isian yang dinonaktifkan.
    return (
      <Section
        divided
        icon={Storefront}
        title="Pengadaan vendor tunggal"
        description="Penawaran dan harga final dari vendor tunggal"
        right={
          <Group gap="xs" wrap="nowrap">
            {st && <Badge radius="sm" variant="light" color={PROC_STATUS[st].color} tt="none">{PROC_STATUS[st].label}</Badge>}
            {!locked && canCreate(role, 'quote') && <Button size="xs" radius="md" variant="default" onClick={onEditQuote}>Ganti penawaran</Button>}
          </Group>
        }
      >
        <Stack gap="md">
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            {[
              ['Vendor', vendor(q.vendorId)],
              ['No. penawaran', q.no],
              ['Termin bayar', termLabel],
              ['Estimasi pengiriman', `${q.lead} hari`],
            ].map(([label, value]) => (
              <Box key={label} style={{ minWidth: 0 }}>
                <Text fz={11} fw={600} c="slate.6">{label}</Text>
                <Text fz="sm" fw={700} c="slate.9" lh={1.35} style={{ overflowWrap: 'anywhere' }}>{value}</Text>
              </Box>
            ))}
          </SimpleGrid>
          <Box style={frame}>
            <Table verticalSpacing="xs" horizontalSpacing="sm" miw={approved ? 420 : 560} styles={th}>
              <Table.Thead bg="slate.0">
                <Table.Tr>
                  <Table.Th>Item</Table.Th>
                  {!approved && <Table.Th ta="right">Harga penawaran</Table.Th>}
                  <Table.Th ta={readOnly ? 'right' : undefined} w={readOnly ? undefined : 190}>Harga final</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {f.items.map((it) => {
                  const l = quoteLine(q, it.id);
                  const final = proc.finals?.[it.id] ?? l?.price ?? 0;
                  return (
                    <Table.Tr key={it.id}>
                      <Table.Td fz="sm" fw={600}>{it.desc}<Text fz={11} c="slate.6" fw={400}>{it.qty} {it.unit}</Text></Table.Td>
                      {!approved && (
                        <Table.Td ta="right">
                          <Text fz="sm" fw={700}>{l ? rupiah(l.price) : '—'}</Text>
                          {l && <Text fz={10} c="slate.6" fw={500}>{taxSummary(lineTaxes(q, l))}</Text>}
                        </Table.Td>
                      )}
                      <Table.Td ta={readOnly ? 'right' : undefined}>
                        {readOnly ? (
                          <Text fz="sm" fw={700}>{rupiah(final)}</Text>
                        ) : (
                          <NumberField size="xs" radius="md" money prefix="Rp " value={final} onChange={(v) => patchProc({ finals: { ...proc.finals, [it.id]: Number(v) || 0 } })} />
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Box>
          {readOnly ? (
            proc.negotiation?.trim() && (
              <Box>
                <Text fz={11} fw={600} c="slate.6">Catatan negosiasi</Text>
                <Text fz="sm" c="slate.9" style={{ whiteSpace: 'pre-wrap' }}>{proc.negotiation}</Text>
              </Box>
            )
          ) : (
            <Textarea label={`Catatan negosiasi${needNote ? ' (wajib)' : ''}`} placeholder="Contoh: Vendor menyetujui diskon 5% untuk pembelian 10 unit" size="sm" radius="md" autosize minRows={2} value={proc.negotiation ?? ''} onChange={(e) => patchProc({ negotiation: e.currentTarget.value })} description="Harga final lebih tinggi dari penawaran, wajib dijelaskan." />
          )}
          {st === 'ditolak' && <Callout tone="stop" title="Ditolak approver">{proc.note}</Callout>}
          <ApprovalBar st={st} role={role} ready={ready} onSubmit={onSubmit} onApprove={onApprove} onReject={onReject} label="vendor tunggal" fpbj={f} />
        </Stack>
      </Section>
    );
  }

  return (
    <>
      <Section
        divided
        icon={Storefront}
        title="Penawaran vendor"
        description={
          single
            ? 'Vendor tunggal: cukup satu penawaran.'
            : enough
            ? `Syarat minimal ${minQuotesFor(f)} penawaran sudah terpenuhi.`
            : `Kurang ${minQuotesFor(f) - f.quotes.length} penawaran lagi. Estimasi ${rupiah(fpbjTotal(f))} butuh minimal ${minQuotesFor(f)} penawaran.`
        }
        right={
          <Group gap="sm" wrap="nowrap">
            {/* Syarat minimal terpenuhi bukan berarti pengadaan selesai, jadi bukan hijau — abu saja. */}
            {!single && (
              <Badge size="lg" radius="sm" variant="light" color={enough ? 'slate' : 'orange'} fw={700} tt="none" leftSection={enough ? <Check size={12} /> : null}>
                {f.quotes.length} / {minQuotesFor(f)} penawaran
              </Badge>
            )}
            {!locked && canCreate(role, 'quote') ? (
              // Vendor tunggal hanya punya satu penawaran: tombol tambah diganti "Ganti penawaran".
              single && f.quotes.length >= 1 ? (
                <Button size="xs" radius="md" variant="default" onClick={onEditQuote}>Ganti penawaran</Button>
              ) : (
                <Button size="xs" radius="md" leftSection={<Plus size={14} />} onClick={onAddQuote}>{single ? 'Upload penawaran' : 'Tambah penawaran'}</Button>
              )
            ) : null}
          </Group>
        }
      >
        {f.quotes.length === 0 ? (
          <Text fz="xs" c="slate.6">{single ? 'Belum ada penawaran. Unggah penawaran dari vendor tunggal; hanya satu penawaran yang dibutuhkan.' : 'Belum ada penawaran. Daftarkan vendor dan unggah penawaran dari tiap vendor.'}</Text>
        ) : (
          <Box style={frame}>
            <Table verticalSpacing="xs" horizontalSpacing="sm" miw={820} styles={th}>
              <Table.Thead bg="slate.0">
                <Table.Tr>
                  {/* Vendor dan Termin sama-sama butuh ruang; kolom lain dipersempit secukupnya. */}
                  <Table.Th miw={190}>Vendor</Table.Th>
                  <Table.Th w={165}>Termin</Table.Th>
                  {/* Barang diukur waktu kirimnya, jasa waktu pengerjaannya. */}
                  <Table.Th w={74}>{poAllJasa(f) ? 'Waktu kerja' : 'Waktu kirim'}</Table.Th>
                  <Table.Th w={74}>Garansi</Table.Th>
                  <Table.Th ta="right" w={140}>Total penawaran</Table.Th>
                  <Table.Th w={150}>Berkas</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {f.quotes.map((q) => {
                  const total = f.items.reduce((n, it) => n + (quoteLine(q, it.id)?.price ?? 0) * it.qty, 0);
                  const lowest = f.quotes.length > 1 && total === Math.min(...f.quotes.map((x) => f.items.reduce((n, it) => n + (quoteLine(x, it.id)?.price ?? 0) * it.qty, 0)));
                  const nPo = pb ? pb.pos.filter((p) => p.vendorId === q.vendorId).length : 0;
                  const isOpen = openQuote === q.id;
                  return (
                    <Fragment key={q.id}>
                    <Table.Tr>
                      <Table.Td>
                        <UnstyledButton onClick={() => setOpenQuote(isOpen ? null : q.id)} aria-label={`Rincian harga ${vendor(q.vendorId)}`}>
                          <Group gap={6} wrap="nowrap">
                            {isOpen ? <CaretUp size={12} /> : <CaretDown size={12} />}
                            <Box style={{ minWidth: 0 }}>
                              <Text fz="sm" fw={600}>{vendor(q.vendorId)}</Text>
                              <Text fz={11} c="slate.6">{q.no} · {nPo > 0 ? `vendor lama, ${nPo} PO` : 'vendor baru'} · {isOpen ? 'tutup rincian' : `rincian ${f.items.length} item`}</Text>
                            </Box>
                          </Group>
                        </UnstyledButton>
                      </Table.Td>
                      <Table.Td>
                        {/* Nama termin di baris pertama, parameternya di baris kedua yang lebih kecil. */}
                        <Text fz="sm" lh={1.3}>{termParts(q.term).label}</Text>
                        {termParts(q.term).detail && (
                          <Text fz={11} c="slate.6" lh={1.3}>{termParts(q.term).detail}</Text>
                        )}
                      </Table.Td>
                      <Table.Td fz="sm">{q.lead} hari</Table.Td>
                      <Table.Td fz="sm">{q.warranty || '—'}</Table.Td>
                      <Table.Td ta="right">
                        <Text fz="sm" fw={700} c={lowest ? 'green.8' : 'slate.9'}>{rupiah(total)}</Text>
                        {lowest && <Badge size="xs" radius="sm" variant="light" color="green" fw={700} tt="none">Termurah</Badge>}
                      </Table.Td>
                      <Table.Td>{q.file ? <AttachmentList compact names={[q.file]} label={`Penawaran ${vendor(q.vendorId)}`} /> : '—'}</Table.Td>
                    </Table.Tr>
                    {isOpen && (
                      <Table.Tr bg="slate.0">
                        <Table.Td colSpan={6} p={0}>
                          <Table verticalSpacing={6} horizontalSpacing="sm" styles={th}>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>Barang atau jasa</Table.Th>
                                <Table.Th ta="right" w={90}>Jumlah</Table.Th>
                                <Table.Th ta="right" w={150}>Harga satuan</Table.Th>
                                <Table.Th ta="right" w={150}>Jumlah harga</Table.Th>
                                <Table.Th w={180}>Kesesuaian</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {f.items.map((it) => {
                                const l = quoteLine(q, it.id);
                                return (
                                  <Table.Tr key={it.id}>
                                    <Table.Td>
                                      <Text fz="sm" fw={600} c="slate.9">{it.desc}</Text>
                                      {l?.spec && <Text fz={11} c="slate.6">{l.spec}</Text>}
                                    </Table.Td>
                                    <Table.Td ta="right" fz="sm" style={{ whiteSpace: 'nowrap' }}>{it.qty} {it.unit}</Table.Td>
                                    <Table.Td ta="right" fz="sm" fw={600}>{l ? rupiah(l.price) : '—'}</Table.Td>
                                    <Table.Td ta="right" fz="sm" fw={700}>{l ? rupiah(l.price * it.qty) : '—'}</Table.Td>
                                    <Table.Td>
<Badge size="sm" radius="sm" variant="light" fw={700} color={!l ? 'gray' : l.fit === 'tidak' ? 'red' : l.fit === 'alternatif' ? 'orange' : 'green'} tt="none">
                                        {l ? fitOptions.find((o) => o.value === l.fit)?.label : 'Tidak ditawar'}
                                      </Badge>
                                    </Table.Td>
                                  </Table.Tr>
                                );
                              })}
                            </Table.Tbody>
                          </Table>
                        </Table.Td>
                      </Table.Tr>
                    )}
                    </Fragment>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Box>
        )}
        {!enough && !locked && !single && (
          <Box mt="sm">
            <Callout tone="warn">Bidding butuh minimal {minQuotesFor(f)} penawaran (estimasi sampai Rp10 juta minimal 2, di atasnya minimal 3). Kalau hanya satu vendor yang bisa menyuplai, ganti jalur ke Vendor tunggal.</Callout>
          </Box>
        )}
      </Section>

      {!single && enough && <BiddingForm f={f} pb={pb} role={role} patchProc={patchProc} onSubmit={onSubmit} onApprove={onApprove} onReject={onReject} ready={ready} vendor={vendor} />}
    </>
  );
}

// --- Pesan ulang ------------------------------------------------------------------------------------
export function RepeatSection({ f, pb, role, patchProc, onAddQuote, onSubmit, onApprove, onReject, onToBidding, onSplit, onApply }) {
  const proc = f.procurement ?? {};
  const st = proc.status;
  const locked = st === 'diajukan' || st === 'disetujui';
  const c = repeatCheck(f, pb.pos);
  const ready = repeatReady(f, pb.pos);
  const refPo = pb.posById[f.refPoId];
  const v = pb.vendorsById[f.refVendorId];
  const levelColor = { ok: 'green', warn: 'orange', bidding: 'red' };
  const levelText = { ok: 'Wajar', warn: 'Perlu alasan', bidding: 'Wajib bidding' };
  const comps = proc.comparators ?? {};
  const donePos = pb.pos.filter((p) => p.vendorId === f.refVendorId);
  const canEdit = !locked && canCreate(role, 'procurement');
  // Pesan ulang dari PO lama: vendor dan PO acuan sudah tetap. Data lama tanpa acuan masih bisa memilih di sini.
  const setup = f.refVendorId ? (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <Box>
        <Text fz={11} fw={600} c="slate.6">Vendor referensi</Text>
        <Text fz="sm" fw={600} c="slate.9">{v?.name ?? '—'}</Text>
      </Box>
      <Box>
        <Text fz={11} fw={600} c="slate.6">PO referensi</Text>
        <Text fz="sm" fw={600} c="slate.9">{refPo ? `${refPo.number} · ${formatDate(refPo.date)}` : '—'}</Text>
      </Box>
    </SimpleGrid>
  ) : (
    <SimpleGrid cols={{ base: 1, sm: 2 }}>
      <Select label="Vendor referensi" placeholder="Pilih vendor" withAsterisk size="sm" radius="md" searchable disabled={!canEdit} data={vendorSelectData(pb.vendors, pb.pos)} renderOption={renderVendorOption} value={f.refVendorId ?? null} onChange={(val) => val && onApply(val, null)} />
      <Select label="PO referensi (untuk item lama)" placeholder="Pilih PO referensi (opsional)" size="sm" radius="md" clearable disabled={!canEdit || !f.refVendorId} data={donePos.map((p) => ({ value: p.id, label: `${p.number} · ${formatDate(p.date)}` }))} value={f.refPoId ?? null} onChange={(val) => onApply(f.refVendorId, val)} />
    </SimpleGrid>
  );
  return (
    <Section
        divided
      icon={ArrowsClockwise}
      title="Pesan ulang"
      description={v ? `${v.name}${refPo ? ` · referensi ${refPo.number}` : ''} · ${donePos.length} PO sebelumnya` : 'Pilih vendor dan PO acuan di bawah ini'}
      right={st ? <Badge radius="sm" variant="light" color={PROC_STATUS[st].color} tt="none">{PROC_STATUS[st].label}</Badge> : null}
    >
      <Stack gap="md">
        {setup}
        {!f.refVendorId && <Text fz="xs" c="slate.6">Pilih vendor referensi untuk melanjutkan.</Text>}
        {f.refVendorId && (!c.hasQuote ? (
          <Group justify="space-between" p="md" style={{ border: '1px dashed var(--mantine-color-gray-4)', borderRadius: 'var(--mantine-radius-md)' }}>
            <Text fz="xs" c="slate.7">Unggah penawaran terbaru dari {v?.name}. Harga dibandingkan dengan pembelian terakhir.</Text>
            {canCreate(role, 'quote') ? <Button size="xs" radius="md" leftSection={<Plus size={14} />} onClick={onAddQuote}>Upload penawaran</Button> : <Hint role="accounting" />}
          </Group>
        ) : (
          <Box style={frame}>
            <Table verticalSpacing="xs" horizontalSpacing="sm" miw={720} styles={th}>
              <Table.Thead bg="slate.0">
                <Table.Tr>
                  <Table.Th>Item</Table.Th>
                  <Table.Th ta="right">Harga terakhir</Table.Th>
                  <Table.Th ta="right">Harga baru</Table.Th>
                  <Table.Th ta="right">Selisih</Table.Th>
                  <Table.Th>Penilaian</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {c.rows.map((r) => (
                  <Table.Tr key={r.item.id}>
                    <Table.Td fz="sm" fw={600}>{r.item.desc}<Text fz={11} c="slate.6" fw={400}>{r.item.qty} {r.item.unit}</Text></Table.Td>
                    {r.kind === 'lama' ? (
                      <>
                        <Table.Td ta="right" fz="sm">{rupiah(r.last)}<Text fz={10} c="slate.6">{formatDate(r.lastDate)}</Text></Table.Td>
                        <Table.Td ta="right" fz="sm" fw={700}>{r.price == null ? '—' : rupiah(r.price)}</Table.Td>
                        <Table.Td ta="right" fz="sm" c={r.pct > 0 ? 'orange.8' : 'green.8'} fw={600}>{r.pct == null ? '—' : `${r.pct > 0 ? '+' : ''}${r.pct.toFixed(1).replace('.', ',')}%`}</Table.Td>
                        <Table.Td><Badge size="xs" radius="sm" variant="light" color={levelColor[r.level]} tt="none">{levelText[r.level]}</Badge>{r.months > RULES.staleMonths && <Text fz={10} c="slate.6">Pembelian terakhir {r.months} bulan lalu</Text>}</Table.Td>
                      </>
                    ) : (
                      <>
                        <Table.Td ta="right" fz="sm" c="slate.5">—</Table.Td>
                        <Table.Td ta="right" fz="sm" fw={700}>{r.price == null ? '—' : rupiah(r.price)}</Table.Td>
                        <Table.Td ta="right" fz="sm" c="slate.5">—</Table.Td>
                        <Table.Td><Badge size="xs" radius="sm" variant="light" color="blue" tt="none">Item baru</Badge></Table.Td>
                      </>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
        ))}

        {c.hasQuote && c.mixed && (
          <Callout tone="warn" title="Item lama dan item baru dalam satu permintaan">
            Item lama dicek seperti pesan ulang biasa, item baru butuh pembanding atau bidding. Pisahkan jadi dua paket agar masing-masing diproses sendiri; hasilnya bisa 2 PO ke vendor yang sama.
            {canCreate(role, 'procurement') && !locked && <Box mt={6}><Button size="xs" radius="md" onClick={onSplit}>Pisahkan jadi dua paket</Button></Box>}
          </Callout>
        )}
        {c.hasQuote && !c.mixed && c.forceBidding && (
          <Callout tone="stop" title="Wajib uji harga pasar lewat bidding">
            {c.rows.some((r) => r.level === 'bidding') ? `Ada item naik lebih dari ${RULES.priceBiddingPct}%.` : `Total item baru ${rupiah(c.newTotal)} melebihi ${rupiah(RULES.newItemLimit)}.`} Penawaran vendor ini ikut terbawa; tambah minimal 2 penawaran vendor lain. Vendor lama tetap bisa menang.
            {canCreate(role, 'procurement') && !locked && <Box mt={6}><Button size="xs" radius="md" color="red" onClick={onToBidding}>Pindahkan ke bidding</Button></Box>}
          </Callout>
        )}
        {c.hasQuote && !c.mixed && c.needReason && !c.forceBidding && (
          <Callout tone="warn" title="Alasan kenaikan wajib">Item naik {RULES.priceWarnPct}–{RULES.priceBiddingPct}% atau pembelian terakhir lebih dari {RULES.staleMonths} bulan. Lampirkan bukti, misalnya surat kenaikan harga dari vendor.</Callout>
        )}

        {c.hasQuote && !c.mixed && !c.forceBidding && c.needComparator && (
          <Box>
            <Text fz="sm" fw={700} mb={4}>Harga pembanding item baru</Text>
            <Text fz="xs" c="slate.6" mb="xs">Nilai item baru ≤ {rupiah(RULES.newItemLimit)}: cukup 1 pembanding per item (penawaran vendor lain, marketplace, atau e-katalog).</Text>
            <Stack gap="xs">
              {c.rows.filter((r) => r.kind === 'baru').map((r) => (
                <SimpleGrid key={r.item.id} cols={{ base: 1, sm: 3 }} p="xs" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
                  <Text fz="sm" fw={600} style={{ alignSelf: 'center' }}>{r.item.desc}</Text>
                  <NumberField size="xs" radius="md" money prefix="Rp " placeholder="Contoh: Rp 1.500.000" disabled={locked || !canCreate(role, 'procurement')} value={comps[r.item.id]?.price ?? 0} onChange={(val) => patchProc({ comparators: { ...comps, [r.item.id]: { ...comps[r.item.id], price: Number(val) || 0 } } })} />
                  <TextInput size="xs" radius="md" placeholder="Contoh: tokopedia.com atau Toko Sinar Jaya" disabled={locked || !canCreate(role, 'procurement')} value={comps[r.item.id]?.source ?? ''} onChange={(e) => patchProc({ comparators: { ...comps, [r.item.id]: { ...comps[r.item.id], source: e.currentTarget.value } } })} />
                </SimpleGrid>
              ))}
            </Stack>
          </Box>
        )}

        {c.hasQuote && !c.mixed && !c.forceBidding && (c.needReason || c.needComparator) && (
          <Textarea label="Alasan" placeholder="Contoh: Harga lama sudah tidak berlaku, vendor menaikkan harga" withAsterisk size="sm" radius="md" autosize minRows={2} disabled={locked || !canCreate(role, 'procurement')} description="Alasan kenaikan harga, atau alasan memilih vendor ini untuk item baru." value={proc.reason ?? ''} onChange={(e) => patchProc({ reason: e.currentTarget.value })} />
        )}
        {st === 'ditolak' && <Callout tone="stop" title="Ditolak approver">{proc.note}</Callout>}
        {c.hasQuote && !c.mixed && !c.forceBidding && <ApprovalBar st={st} role={role} ready={ready} onSubmit={onSubmit} onApprove={onApprove} onReject={onReject} label="pesan ulang" fpbj={f} />}
      </Stack>
    </Section>
  );
}

export function ApprovalBar({ st, role, ready, onSubmit, onApprove, onReject, label, fpbj }) {
  // Setelah disetujui tidak ada alert lagi: kabar sukses ditampilkan lewat modal saat tombol Setujui ditekan.
  if (st === 'disetujui') return null;
  if (st === 'diajukan') {
    if (!canApprove(role, 'procurement')) return <Hint role="building_manager" />;
    // Pemisahan tugas 2.4: pembuat FPBJ tidak boleh menyetujui pengadaannya sendiri.
    if (blockedBySoD(role, fpbj)) {
      return (
        <Callout tone="stop" title="Tidak bisa disetujui sendiri">
          Permintaan ini Anda yang ajukan. Pemisahan tugas melarang pembuat permintaan menyetujui
          pengadaannya sendiri — mintakan approval ke {approverFor(fpbjTotal(fpbj))} lain.
        </Callout>
      );
    }
    return (
      <Group justify="flex-end">
        <Button radius="md" color="red" variant="light" onClick={onReject}>Tolak</Button>
        <Button radius="md" leftSection={<Check size={16} />} onClick={onApprove}>Setujui</Button>
      </Group>
    );
  }
  return canCreate(role, 'procurement') ? (
    <Group justify="space-between">
      {!ready ? <Group gap={6}><Warning size={14} color="var(--mantine-color-orange-7)" /><Text fz="xs" c="orange.8">Lengkapi isian wajib untuk mengajukan.</Text></Group> : <span />}
      <Button radius="md" disabled={!ready} onClick={onSubmit}>Ajukan approval{label === 'pesan ulang' ? ' pesan ulang' : ''}</Button>
    </Group>
  ) : (
    <Hint role="accounting" />
  );
}

