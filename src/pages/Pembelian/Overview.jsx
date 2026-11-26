// Tab Ringkasan: kartu hutang, pipeline, "Perlu tindakan" per peran, umur hutang.
import { useState } from 'react';
import { Badge, Box, Button, Card, Grid, Group, Pagination, Progress, SegmentedControl, SimpleGrid, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { CheckCircle, ListChecks, Truck, Wallet, Warning } from '@/components/Icon.jsx';
import { CardTitle, CompareBars, CompositionCard, FlowCard, Legend, QueueCard, Quiet, ShareList } from '@/components/overview.jsx';
import { Callout, RoleChip } from './components.jsx';
import { actionsFor, aging, daysLate, debtByVendor, dueSoon, pipeline, procurementMix, purchasesInMonth, readiness, unbilled, vendorClaims } from './selectors.js';
import { useData } from '@/lib/store.jsx';

// Warna baris "Perlu tindakan" per tingkat umur tugas (lihat taskAge di selectors.js).
const LEVEL = {
  warn: { bg: 'var(--mantine-color-orange-0)', edge: 'var(--mantine-color-orange-5)', text: 'orange.9', btn: 'orange' },
  stale: { bg: 'var(--mantine-color-red-0)', edge: 'var(--mantine-color-red-6)', text: 'red.8', btn: 'red' },
};

import { roleOf, TODAY } from './data.js';
import { invTotals, rupiah, rupiahShort, sum, formatDate, RETURN_STATUS } from './utils.js';

// Kalimat umur tugas dalam hari dan tanggal, mis. "Lewat 43 hari dari batas 22 Sep 2026".
function ageLine(a) {
  if (!a.due) return a.waiting > 0 ? `Menunggu ${a.waiting} hari` : null;
  if (a.late > 0) return `Lewat ${a.late} hari dari batas ${formatDate(a.due)}`;
  return `Batas ${formatDate(a.due)} · ${a.late === 0 ? 'hari ini' : `${-a.late} hari lagi`}`;
}

export default function Overview({ pb, go, openDialog }) {
  const role = pb.role;
  const live = pb.invoices.map((i) => ({ i, t: invTotals(i, pb.calc) })).filter((x) => x.t.balance > 0);
  const debt = sum(live, (x) => x.t.balance);
  const overdue = sum(live.filter((x) => daysLate(x.i.dueDate) > 0), (x) => x.t.balance);
  const overduePct = debt ? Math.round((overdue / debt) * 100) : 0;
  const ready = pb.prs.filter((p) => p.status === 'disetujui');
  const todo = actionsFor(role, pb);
  // Tugas yang sudah lewat batas wajar: ini yang perlu menonjol di dashboard peran ini.
  const telat = todo.filter((a) => a.late > 0);
  const berlarut = todo.filter((a) => a.level === 'stale');
  const mulaiLama = todo.filter((a) => a.level === 'warn');
  const baru = todo.filter((a) => a.level === 'ok');
  // Filter dan halaman daftar "Perlu tindakan".
  const PER_PAGE = 8;
  const [level, setLevel] = useState('all');
  const [page, setPage] = useState(1);
  const shownTodo = level === 'all' ? todo : todo.filter((a) => a.level === level);
  const totalPages = Math.max(1, Math.ceil(shownTodo.length / PER_PAGE));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * PER_PAGE;
  const pageTodo = shownTodo.slice(start, start + PER_PAGE);
  const levelTabs = [
    { value: 'all', label: `Semua (${todo.length})` },
    { value: 'stale', label: `Berlarut (${berlarut.length})` },
    { value: 'warn', label: `Lewat batas (${mulaiLama.length})` },
    { value: 'ok', label: `Baru (${baru.length})` },
  ];
  const flow = pipeline(pb);
  // Retensi yang masih ditahan setelah termin terakhir: dipantau di sini selama masa
  // pemeliharaan, supaya tidak hanya terlihat kalau orang membuka PO-nya.
  const retensi = readiness(pb).retention;
  const retensiTotal = sum(retensi, (x) => x.rt.balance);
  const bulanLagi = (iso) => {
    const d = daysLate(iso) * -1;
    return d <= 0 ? 'Bisa dilepas' : d < 31 ? `${d} hari lagi` : `${Math.round(d / 30)} bulan lagi`;
  };
  const buckets = aging(pb);
  const agingTotal = sum(buckets, (b) => b.value);
  const { stockMoves, products } = useData();
  const ctx = { stockMoves, products };
  const belumTagih = unbilled(pb, ctx);
  const klaim = vendorClaims(pb, ctx);
  const segera = dueSoon(pb, 7);
  const perVendor = debtByVendor(pb);
  const mix = procurementMix(pb);
  const bulanIni = TODAY.slice(0, 7);
  const bulanLalu = (() => {
    const [y, m] = bulanIni.split('-').map(Number);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  })();
  const beliIni = purchasesInMonth(pb, bulanIni);
  const hariKe = Number(TODAY.slice(8, 10));
  const beliLalu = purchasesInMonth(pb, bulanLalu);
  // Dibanding periode yang sama bulan lalu (1–tanggal hari ini), bukan sebulan penuh.
  const beliLaluSd = purchasesInMonth(pb, bulanLalu, hariKe);
  const beliDelta = beliLaluSd ? Math.round(((beliIni - beliLaluSd) / beliLaluSd) * 100) : null;
  const namaBulan = (ym) => formatDate(`${ym}-01`).replace(/^1 /, '');
  const overdueList = live.filter((x) => daysLate(x.i.dueDate) > 0);
  const segeraNilai = sum(segera, (x) => x.bal);
  const komposisi = [
    { key: 'late', label: 'Sudah jatuh tempo', value: overdue, display: rupiahShort(overdue), color: 'red.6', hint: overdue ? `${overdueList.length} faktur · ${overduePct}% dari hutang` : 'Tidak ada yang telat' },
    { key: 'soon', label: 'Jatuh tempo 7 hari', value: segeraNilai, display: rupiahShort(segeraNilai), color: 'orange.4', hint: segera.length ? `${segera.length} faktur · terdekat ${formatDate(segera[0].i.dueDate)}` : 'Tidak ada minggu ini' },
    { key: 'later', label: 'Lebih dari 7 hari', value: Math.max(debt - overdue - segeraNilai, 0), display: rupiahShort(Math.max(debt - overdue - segeraNilai, 0)), color: 'gray.4', hint: 'Belum perlu dibayar' },
  ];
  const antrean = [
    {
      key: 'todo',
      label: 'Menunggu tindakan Anda',
      value: todo.length,
      hint: telat.length > 0 ? `${telat.length} sudah lewat batas wajar` : `Sebagai ${roleOf(role).label}`,
      alert: telat.length > 0,
      icon: telat.length > 0 ? Warning : ListChecks,
      tone: telat.length > 0 ? 'red' : 'gray',
      onClick: () => document.getElementById('perlu-tindakan')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    },
    {
      key: 'unbilled',
      label: 'Barang diterima belum ditagih',
      value: rupiahShort(belumTagih.value),
      hint: belumTagih.count ? `${belumTagih.count} FPB/BAPP menunggu faktur vendor` : 'Semua penerimaan sudah difaktur',
      icon: Truck,
      tone: 'gray',
      onClick: () => go({ name: 'tab', tab: 'receipts' }),
    },
    {
      key: 'ready',
      label: 'Siap dibayar',
      value: ready.length,
      hint: ready.length ? `${rupiah(sum(ready, (p) => p.amount))} menunggu Finance` : 'Belum ada Payment Request disetujui',
      icon: Wallet,
      tone: 'gray',
      onClick: () => go({ name: 'tab', tab: 'payments' }),
    },
  ];
  const klaimKosong = !klaim.dp && !klaim.kredit && !klaim.refund && klaim.openReturns.length === 0;
  const jalur = [
    { key: 'bidding', label: 'Jalur bidding', n: mix.bidding, color: 'primary.7' },
    { key: 'single', label: 'Vendor tunggal', n: mix.single, color: 'cyan.6' },
    { key: 'none', label: 'Belum pilih jalur', n: mix.belumJalur, color: 'gray.4' },
  ];

  return (
    <Stack gap="lg">
      <Grid gutter="lg" align="stretch">
        {/* Satu kartu hutang: angka utama + komposisinya menurut jatuh tempo. */}
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <CompositionCard
            title="Hutang usaha berjalan"
            text={`${live.length} faktur belum lunas`}
            action={{ label: 'Laporan hutang', onClick: () => go({ name: 'tab', tab: 'payables' }) }}
            figure={rupiah(debt)}
            parts={komposisi}
          />
        </Grid.Col>
        {/* Tiga hal yang menunggu orang: baris yang bisa diklik ke daftarnya. */}
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <QueueCard items={antrean} />
        </Grid.Col>
      </Grid>

      <FlowCard
        title="Alur pembelian"
        text="Dokumen yang masih berjalan, masing-masing hanya di satu tahap. Klik tahap untuk membuka daftarnya."
        steps={flow.map((f) => ({ ...f, onClick: () => go({ name: 'tab', tab: f.tab }) }))}
      />

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card id="perlu-tindakan" withBorder radius="lg" padding="lg" bg="white" h="100%" style={{ scrollMarginTop: 72 }}>
            <Group justify="space-between" mb="xs">
              <Box>
                <Text fw={700} fz="sm" c="slate.9">Perlu tindakan</Text>
                <Text fz="xs" c="slate.6">Oranye: lewat batas wajar. Merah: dibiarkan berlarut. Yang paling lama di atas.</Text>
              </Box>
              <Group gap="xs" wrap="nowrap">
                <RoleChip role={role} />
              </Group>
            </Group>
            {telat.length > 0 && (
              <Box mb="sm">
                <Callout tone={berlarut.length ? 'stop' : 'warn'} title={`${telat.length} tindakan lewat batas waktu`}>
                  Paling lama: {telat[0].title} untuk <b>{telat[0].sub.split(' · ')[0]}</b>, terlambat {telat[0].late} hari sejak {formatDate(telat[0].due)}.
                </Callout>
              </Box>
            )}
            {todo.length === 0 ? (
              <Stack align="center" gap={6} py={36}>
                <ThemeIcon variant="light" color="green" size={48} radius="xl"><CheckCircle size={26} /></ThemeIcon>
                <Text fz="sm" fw={700}>Semua sudah beres</Text>
                <Text fz="xs" c="slate.6">Tidak ada dokumen yang menunggu tindakan {roleOf(role).label}.</Text>
              </Stack>
            ) : (
              <Stack gap={4}>
                <SegmentedControl
                  size="xs"
                  radius="md"
                  mb="xs"
                  fullWidth
                  data={levelTabs}
                  value={level}
                  onChange={(v) => { setLevel(v); setPage(1); }}
                  aria-label="Saring menurut umur tugas"
                />
                {pageTodo.length === 0 && (
                  <Text fz="xs" c="slate.6" ta="center" py="lg">
                    Tidak ada tindakan {levelTabs.find((t) => t.value === level)?.label.replace(/ \(\d+\)$/, '').toLowerCase()}.
                  </Text>
                )}
                {pageTodo.map((a) => {
                  const lv = LEVEL[a.level];
                  const umur = ageLine(a);
                  return (
                    <Group
                      key={a.id}
                      justify="space-between"
                      wrap="nowrap"
                      py="sm"
                      px={lv ? 'sm' : 0}
                      style={
                        lv
                          ? { background: lv.bg, borderLeft: `3px solid ${lv.edge}`, borderRadius: 'var(--mantine-radius-md)' }
                          : { borderBottom: '1px solid var(--mantine-color-gray-2)' }
                      }
                    >
                      <Box style={{ minWidth: 0 }}>
                        <Text fz="sm" fw={600} c="slate.9" truncate>{a.title}</Text>
                        <Text fz={11} fw={600} c="primary.7" truncate>{a.sub}</Text>
                        {/* Umur tugas: berapa lama tidak dikerjakan, dan seberapa jauh lewat batas. */}
                        {umur && (
                          <Text fz={11} fw={lv ? 700 : 400} c={lv ? lv.text : 'slate.5'}>
                            {umur}
                          </Text>
                        )}
                      </Box>
                      <Button size="compact-xs" radius="md" variant={lv ? 'filled' : 'light'} color={lv?.btn} onClick={() => { go(a.to); if (a.dialog) openDialog?.(a.dialog); }}>Buka</Button>
                    </Group>
                  );
                })}
                {shownTodo.length > PER_PAGE && (
                  <Group justify="space-between" gap="sm" pt="sm">
                    <Text fz="xs" c="slate.7">
                      Menampilkan {start + 1}–{start + pageTodo.length} dari {shownTodo.length} tindakan
                    </Text>
                    <Pagination size="sm" radius="md" total={totalPages} value={current} onChange={setPage} />
                  </Group>
                )}
              </Stack>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="lg">
            {retensi.length > 0 && (
              <Card withBorder radius="lg" padding="lg" bg="white">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Box>
                    <Text fw={700} fz="sm" c="slate.9">Retensi ditahan</Text>
                    <Text fz="xs" c="slate.6">Termin sudah lunas, menunggu masa pemeliharaan selesai</Text>
                  </Box>
                  <Text fz="sm" fw={700} c="violet.8" style={{ whiteSpace: 'nowrap' }}>{rupiahShort(retensiTotal)}</Text>
                </Group>
                <Stack gap={0} mt="sm">
                  {retensi.slice(0, 5).map(({ po, rt }) => {
                    const due = rt.maintenanceEnd <= TODAY;
                    return (
                      <UnstyledButton key={po.id} onClick={() => go({ name: 'po', id: po.id })} py={8} style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                        <Group justify="space-between" wrap="nowrap" gap="sm">
                          <Box style={{ minWidth: 0 }}>
                            <Text fz="xs" fw={600} c="primary.9" truncate>{po.number}</Text>
                            <Text fz={11} c="slate.6" truncate>{pb.vendorsById[po.vendorId]?.name} · {rupiah(rt.balance)}</Text>
                          </Box>
                          <Badge size="sm" radius="sm" variant="light" color={due ? 'green' : 'violet'} tt="none" style={{ flexShrink: 0 }}>
                            {bulanLagi(rt.maintenanceEnd)}
                          </Badge>
                        </Group>
                      </UnstyledButton>
                    );
                  })}
                </Stack>
                {retensi.length > 5 && <Text fz="xs" c="slate.6" pt="xs">+{retensi.length - 5} pesanan lain</Text>}
              </Card>
            )}
            <Card withBorder radius="lg" padding="lg" bg="white">
              <Text fw={700} fz="sm" c="slate.9">Umur hutang</Text>
              <Text fz="xs" c="slate.6" mb="sm">Sisa hutang menurut lama jatuh tempo</Text>
              <Progress.Root size={10} radius="xl" mb="sm">
                {buckets.map((b) => b.value > 0 && <Progress.Section key={b.key} value={(b.value / agingTotal) * 100} color={b.color} />)}
              </Progress.Root>
              <Stack gap={6}>
                {buckets.map((b) => (
                  <Group key={b.key} justify="space-between">
                    <Group gap={6}><Box w={8} h={8} style={{ borderRadius: 4, background: `var(--mantine-color-${b.color.replace('.', '-')})` }} /><Text fz="xs" c="slate.7">{b.label}</Text></Group>
                    <Text fz="xs" fw={600}>{rupiah(b.value)}</Text>
                  </Group>
                ))}
              </Stack>
            </Card>
            <Card withBorder radius="lg" padding="lg" bg="white">
              <CardTitle title="Hutang per vendor" text="Sisa hutang terbesar" right={perVendor.length > 0 && `${perVendor.length} vendor`} />
              {perVendor.length === 0 ? (
                <Quiet icon={CheckCircle} title="Tidak ada hutang berjalan" text="Semua faktur vendor sudah lunas." />
              ) : (
                <ShareList
                  rows={perVendor.map((v) => ({ ...v, display: rupiahShort(v.value), sub: `${v.count} faktur` }))}
                  total={debt}
                  onClick={() => go({ name: 'tab', tab: 'payables' })}
                />
              )}
            </Card>

            <Card withBorder radius="lg" padding="lg" bg="white">
              <CardTitle title="Uang muka, kredit & retur" text="Hak kita atas vendor yang belum terpakai" />
              {klaimKosong ? (
                <Quiet icon={Wallet} title="Tidak ada yang tertahan" text="Uang muka, kredit retur, dan refund akan muncul di sini." />
              ) : (
                <>
                  <SimpleGrid cols={3} spacing={6} mt="sm">
                    {[
                      ['Uang muka', klaim.dp, 'belum dipotong'],
                      ['Kredit', klaim.kredit, 'siap dipakai'],
                      ['Refund', klaim.refund, 'belum diterima'],
                    ].map(([label, value, hint]) => (
                      <Box key={label} p={10} style={{ background: 'var(--mantine-color-gray-0)', borderRadius: 'var(--mantine-radius-md)' }}>
                        <Text fz={11} c="slate.6">{label}</Text>
                        <Text fz="sm" fw={700} c={value ? 'slate.9' : 'slate.4'} lh={1.4} style={{ fontVariantNumeric: 'tabular-nums' }}>{value ? rupiahShort(value) : '–'}</Text>
                        <Text fz={10} c="slate.5">{hint}</Text>
                      </Box>
                    ))}
                  </SimpleGrid>
                  {klaim.openReturns.length > 0 && (
                    <Stack gap={0} mt="sm">
                      {klaim.openReturns.slice(0, 3).map(({ ret, state }) => (
                        <Group key={ret.id} justify="space-between" wrap="nowrap" py={8} style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                          <Box style={{ minWidth: 0 }}>
                            <Text fz="xs" fw={600} c="primary.9" truncate>{ret.number}</Text>
                            <Text fz={11} c="slate.6" truncate>{pb.vendorsById[ret.vendorId]?.name}</Text>
                          </Box>
                          <Badge size="sm" radius="xl" variant="light" color={RETURN_STATUS[state].color} tt="none" style={{ flexShrink: 0 }}>{RETURN_STATUS[state].label}</Badge>
                        </Group>
                      ))}
                    </Stack>
                  )}
                </>
              )}
            </Card>

            <Card withBorder radius="lg" padding="lg" bg="white">
              <CardTitle
                title={`Pembelian ${namaBulan(bulanIni)}`}
                text={`Faktur masuk 1–${hariKe} ${namaBulan(bulanIni).split(' ')[0]}, DPP tanpa uang muka`}
                right={beliDelta != null && (
                  <Badge size="sm" radius="xl" variant="light" color={beliDelta > 0 ? 'orange' : 'green'} tt="none">
                    {beliDelta > 0 ? '+' : ''}{beliDelta}%
                  </Badge>
                )}
              />
              <Text fz={24} fw={700} c="slate.9" lh="32px" mt="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>{rupiahShort(beliIni)}</Text>
              <CompareBars
                bars={[
                  { label: `1–${hariKe} ${namaBulan(bulanIni).split(' ')[0]}`, value: beliIni, display: rupiah(beliIni), color: 'primary.8' },
                  { label: `1–${hariKe} ${namaBulan(bulanLalu).split(' ')[0]}`, value: beliLaluSd, display: rupiah(beliLaluSd), color: 'slate.4' },
                ]}
              />
              <Text fz={11} c="slate.6" mt="sm" pt="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                Sebulan penuh {namaBulan(bulanLalu)}: <Text span fz={11} c="slate.8" fw={600}>{rupiah(beliLalu)}</Text>
                {beliLalu > 0 && ` · bulan ini sudah ${Math.round((beliIni / beliLalu) * 100)}%`}
              </Text>
            </Card>

            <Card withBorder radius="lg" padding="lg" bg="white">
              <CardTitle title="Pengadaan berjalan" text="Permintaan yang belum jadi PO, menurut jalurnya" />
              {mix.aktif === 0 ? (
                <Quiet icon={CheckCircle} title="Tidak ada pengadaan berjalan" text="Semua permintaan sudah jadi PO." />
              ) : (
                <>
                  <Group gap={6} align="baseline" mt="sm">
                    <Text fz={24} fw={700} c="slate.9" lh="32px">{mix.aktif}</Text>
                    <Text fz="xs" c="slate.6">permintaan</Text>
                  </Group>
                  <Progress.Root size={8} radius="xl" mt={8} bg="gray.1">
                    {jalur.map((j) => j.n > 0 && <Progress.Section key={j.key} value={(j.n / mix.aktif) * 100} color={j.color} />)}
                  </Progress.Root>
                  <Box mt="sm">
                    <Legend items={jalur.map((j) => ({ ...j, value: j.n, muted: !j.n }))} />
                  </Box>
                  {mix.late.length > 0 ? (
                    <Box mt="sm" p={10} style={{ background: 'var(--mantine-color-red-0)', borderRadius: 'var(--mantine-radius-md)' }}>
                      <Text fz="xs" fw={600} c="red.8">{mix.late.length} lewat tanggal dibutuhkan</Text>
                      {mix.late.slice(0, 2).map((f) => <Text key={f.id} fz={11} c="red.7">{f.number} · {formatDate(f.neededBy)}</Text>)}
                    </Box>
                  ) : (
                    <Group gap={6} mt="sm" pt="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                      <CheckCircle size={14} color="var(--mantine-color-green-6)" />
                      <Text fz={11} c="slate.6">Semua masih sebelum tanggal dibutuhkan</Text>
                    </Group>
                  )}
                </>
              )}
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
