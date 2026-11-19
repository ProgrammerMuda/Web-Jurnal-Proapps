// Komponen pengadaan: panduan langkah, pilihan jalur, dan dua layar jalur — bidding dan vendor tunggal.
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  ThemeIcon,
} from '@mantine/core';
import { blockedBySoD, approvalState, isApproverTurn, canCreate } from './permissions.js';
import { Check, Eye, ListChecks, PencilSimple, Plus, Scales, Storefront, Trash, Warning } from '@/components/Icon.jsx';
import NumberField from '@/components/NumberField.jsx';
import { Callout, RowMenu, Section } from './components.jsx';
import { personTitle } from './data.js';
import BiddingForm from './BiddingSheet.jsx';
import {
  biddingReady,
  minQuotesFor,
  poAllJasa,
  needsBiddingNote,
  approverFor,
  procurementValue,
  PROC_STATUS,
  quoteLine,
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
  const nQuotes = f.quotes.length;
  const approved = st === 'disetujui';
  const submitted = st === 'diajukan' || approved;
  void pb;
  let steps;
  // Vendor tunggal punya langkahnya sendiri: tanpa pembanding, tanpa pemilihan pemenang.
  if (single) {
    steps = [
      { label: 'Penawaran vendor tunggal', sub: nQuotes ? '1 penawaran' : 'Belum ada', done: nQuotes >= 1, cta: 'Upload penawaran' },
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
  const title = single ? 'Vendor tunggal' : 'Bidding';
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
  { value: 'bidding', icon: Scales, short: 'Bidding', title: 'Pengadaan dengan bidding', text: 'Kumpulkan beberapa penawaran, bandingkan, lalu pilih pemenang. Jalur normal untuk sebagian besar pembelian.' },
  { value: 'single', icon: Storefront, short: 'Vendor tunggal', title: 'Vendor tunggal', text: 'Hanya satu vendor yang bisa menyuplai. Cukup satu penawaran, tanpa pembanding, lalu diajukan ke approver.' },
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
  const current = f.single?.on ? 'single' : f.route === 'bidding' ? 'bidding' : null;
  const hasQuotes = f.quotes.length > 0;
  // Bidding dan vendor tunggal memakai bentuk data penawaran yang sama, jadi bebas ditukar
  // sampai pengadaannya disetujui. Sesudah disetujui PO sudah terbit, jalur tidak boleh berubah.
  const blocked = () => !canCreate(role, 'procurement') || f.procurement?.status === 'disetujui';
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
        {hasQuotes && (
          <Text fz="xs" c="slate.6">
            Penawaran yang sudah diunggah tetap tersimpan kalau jalurnya diganti.
          </Text>
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

// --- Vendor tunggal ---------------------------------------------------------------------------------
// Jalur terpisah dari bidding: satu vendor, satu penawaran, tanpa pembanding dan tanpa pemilihan
// pemenang. Penawaran dan harga final digabung dalam satu kartu.
export function SingleSection({ f, pb, role, patchProc, onAddQuote, onViewQuote, onEditQuote, onDeleteQuote, onSubmit, onApprove, onReject, vendor }) {
  void pb;
  const proc = f.procurement ?? {};
  const st = proc.status;
  const locked = st === 'diajukan' || st === 'disetujui';
  const ready = biddingReady(f);
  const needNote = needsBiddingNote(f);

  // Belum ada penawaran: satu kartu ajakan unggah, bukan tabel pembanding kosong.
  if (f.quotes.length === 0) {
    return (
      <Section
        divided
        icon={Storefront}
        title="Pengadaan vendor tunggal"
        description="Cukup satu penawaran, tanpa pembanding. Mulai dengan mengunggah penawaran vendornya."
        right={
          !locked && canCreate(role, 'quote') ? (
            <Button size="xs" radius="md" leftSection={<Plus size={14} />} onClick={onAddQuote}>Upload penawaran</Button>
          ) : null
        }
      >
        {canCreate(role, 'quote') ? (
          <Text fz="xs" c="slate.6">
            Jalur ini dipakai ketika hanya satu vendor yang bisa menyuplai. Tidak ada perbandingan harga, dan vendor
            pada penawaran itu langsung jadi pemenangnya.
          </Text>
        ) : (
          <Hint role="accounting" />
        )}
      </Section>
    );
  }

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
      description="Periksa penawarannya, tetapkan harga final, lalu ajukan ke approver."
      right={
        <Group gap="xs" wrap="nowrap">
          {st && <Badge radius="sm" variant="light" color={PROC_STATUS[st].color} tt="none">{PROC_STATUS[st].label}</Badge>}
          {!locked && canCreate(role, 'quote') && (
            <Button size="xs" radius="md" variant="default" onClick={() => onEditQuote(q.id)}>Ubah penawaran</Button>
          )}
          <RowMenu
            label={`penawaran ${vendor(q.vendorId)}`}
            items={[
              { label: 'Lihat detail', icon: Eye, onClick: () => onViewQuote(q.id) },
              !locked && canCreate(role, 'quote') && { label: 'Hapus penawaran', icon: Trash, color: 'red', onClick: () => onDeleteQuote(q.id) },
            ]}
          />
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
        <ApprovalBar st={st} role={role} ready={ready} onSubmit={onSubmit} onApprove={onApprove} onReject={onReject} label="vendor tunggal" fppbj={f} />
      </Stack>
    </Section>
  );
}

// --- Bidding ----------------------------------------------------------------------------------------
// Bidding: kumpulkan beberapa penawaran, bandingkan, pilih pemenang.
export function BiddingSection({ f, pb, role, patchProc, onAddQuote, onViewQuote, onEditQuote, onDeleteQuote, onSubmit, onApprove, onReject, vendor }) {
  const proc = f.procurement ?? {};
  const st = proc.status;
  const locked = st === 'diajukan' || st === 'disetujui';
  const enough = f.quotes.length >= minQuotesFor(f);
  const ready = biddingReady(f);
  // Penawaran hanya bisa diubah / dihapus selama pengadaan belum diajukan atau sudah ditolak.
  const canEditQuotes = !locked && canCreate(role, 'quote');

  return (
    <>
      <Section
        divided
        icon={Storefront}
        title="Penawaran vendor"
        description={
          enough
            ? `Syarat minimal ${minQuotesFor(f)} penawaran sudah terpenuhi.`
            : `Kurang ${minQuotesFor(f) - f.quotes.length} penawaran lagi untuk memenuhi syarat minimal ${minQuotesFor(f)} penawaran.`
        }
        right={
          <Group gap="sm" wrap="nowrap">
            {/* Syarat minimal terpenuhi bukan berarti pengadaan selesai, jadi bukan hijau — abu saja. */}
            <Badge size="lg" radius="sm" variant="light" color={enough ? 'slate' : 'orange'} fw={700} tt="none" leftSection={enough ? <Check size={12} /> : null}>
              {f.quotes.length} / {minQuotesFor(f)} penawaran
            </Badge>
            {!locked && canCreate(role, 'quote') && (
              <Button size="xs" radius="md" leftSection={<Plus size={14} />} onClick={onAddQuote}>Tambah penawaran</Button>
            )}
          </Group>
        }
      >
        {f.quotes.length === 0 ? (
          <Text fz="xs" c="slate.6">Belum ada penawaran. Daftarkan vendor dan unggah penawaran dari tiap vendor.</Text>
        ) : (
          <Box style={frame}>
            <Table verticalSpacing="xs" horizontalSpacing="sm" miw={740} styles={th}>
              <Table.Thead bg="slate.0">
                <Table.Tr>
                  {/* Vendor dan Termin sama-sama butuh ruang; kolom lain dipersempit secukupnya. */}
                  <Table.Th miw={190}>Vendor</Table.Th>
                  <Table.Th w={165}>Termin</Table.Th>
                  {/* Barang diukur waktu kirimnya, jasa waktu pengerjaannya. */}
                  <Table.Th w={74}>{poAllJasa(f) ? 'Waktu kerja' : 'Waktu kirim'}</Table.Th>
                  <Table.Th w={74}>Garansi</Table.Th>
                  <Table.Th ta="right" w={140}>Total penawaran</Table.Th>
                  <Table.Th ta="right" w={70}>Aksi</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {f.quotes.map((q) => {
                  const total = f.items.reduce((n, it) => n + (quoteLine(q, it.id)?.price ?? 0) * it.qty, 0);
                  const lowest = f.quotes.length > 1 && total === Math.min(...f.quotes.map((x) => f.items.reduce((n, it) => n + (quoteLine(x, it.id)?.price ?? 0) * it.qty, 0)));
                  const nPo = pb ? pb.pos.filter((p) => p.vendorId === q.vendorId).length : 0;
                  return (
                    <Table.Tr key={q.id}>
                      <Table.Td>
                        <Box style={{ minWidth: 0 }}>
                          <Text fz="sm" fw={600}>{vendor(q.vendorId)}</Text>
                          <Text fz={11} c="slate.6">{q.no} · {nPo > 0 ? `vendor lama, ${nPo} PO` : 'vendor baru'}</Text>
                        </Box>
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
                      <Table.Td ta="right">
                        <RowMenu
                          label={`penawaran ${vendor(q.vendorId)}`}
                          items={[
                            { label: 'Lihat detail', icon: Eye, onClick: () => onViewQuote(q.id) },
                            canEditQuotes && { label: 'Ubah penawaran', icon: PencilSimple, onClick: () => onEditQuote(q.id) },
                            canEditQuotes && { label: 'Hapus penawaran', icon: Trash, color: 'red', onClick: () => onDeleteQuote(q.id) },
                          ]}
                        />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Box>
        )}
        {!enough && !locked && (
          <Box mt="sm">
            <Callout tone="warn">Bidding butuh minimal {minQuotesFor(f)} penawaran (nilai penawaran sampai Rp10 juta minimal 2, di atasnya minimal 3). Kalau hanya satu vendor yang bisa menyuplai, ganti jalur ke Vendor tunggal.</Callout>
          </Box>
        )}
      </Section>

      {enough && <BiddingForm f={f} pb={pb} role={role} patchProc={patchProc} onSubmit={onSubmit} onApprove={onApprove} onReject={onReject} ready={ready} vendor={vendor} />}
    </>
  );
}

export function ApprovalBar({ st, role, ready, onSubmit, onApprove, onReject, label, fppbj }) {
  // Setelah disetujui tidak ada alert lagi: kabar sukses ditampilkan lewat modal saat tombol Setujui ditekan.
  if (st === 'disetujui') return null;
  if (st === 'diajukan') {
    const ap = approvalState(fppbj?.procurement, 'procurement');
    if (!isApproverTurn(role, fppbj?.procurement, 'procurement')) return <Hint role={ap.next ?? 'cfo'} />;
    // Pemisahan tugas 2.4: pembuat FPPBJ tidak boleh menyetujui pengadaannya sendiri.
    if (blockedBySoD(role, fppbj)) {
      return (
        <Callout tone="stop" title="Tidak bisa disetujui sendiri">
          Permintaan ini Anda yang ajukan. Pemisahan tugas melarang pembuat permintaan menyetujui
          pengadaannya sendiri — mintakan approval ke {approverFor(procurementValue(fppbj))} lain.
        </Callout>
      );
    }
    return (
      <Group justify="flex-end">
        <Button radius="md" color="red" variant="light" onClick={onReject}>Tolak</Button>
        <Button radius="md" leftSection={<Check size={16} />} onClick={onApprove}>Setujui ({ap.done.length + 1}/{ap.total})</Button>
      </Group>
    );
  }
  return canCreate(role, 'procurement') ? (
    <Group justify="space-between">
      {!ready ? <Group gap={6}><Warning size={14} color="var(--mantine-color-orange-7)" /><Text fz="xs" c="orange.8">Lengkapi isian wajib untuk mengajukan.</Text></Group> : <span />}
      <Button radius="md" disabled={!ready} onClick={onSubmit}>Ajukan approval{label ? ` ${label}` : ''}</Button>
    </Group>
  ) : (
    <Hint role="accounting" />
  );
}

