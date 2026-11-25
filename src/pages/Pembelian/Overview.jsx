// Tab Ringkasan: kartu hutang, pipeline, "Perlu tindakan" per peran, umur hutang.
import { useState } from 'react';
import { Badge, Box, Button, Card, Grid, Group, Pagination, Progress, RingProgress, SegmentedControl, SimpleGrid, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { CheckCircle, ArrowRight, Warning } from '@/components/Icon.jsx';
import { Callout, RoleChip } from './components.jsx';
import { actionsFor, aging, daysLate, pipeline, readiness } from './selectors.js';

// Warna baris "Perlu tindakan" per tingkat umur tugas (lihat taskAge di selectors.js).
const LEVEL = {
  warn: { bg: 'var(--mantine-color-orange-0)', edge: 'var(--mantine-color-orange-5)', text: 'orange.9', btn: 'orange' },
  stale: { bg: 'var(--mantine-color-red-0)', edge: 'var(--mantine-color-red-6)', text: 'red.8', btn: 'red' },
};

import { roleOf, TODAY } from './data.js';
import { invTotals, rupiah, rupiahShort, sum, formatDate } from './utils.js';

// Kalimat umur tugas dalam hari dan tanggal, mis. "Lewat 43 hari dari batas 22 Sep 2026".
function ageLine(a) {
  if (!a.due) return a.waiting > 0 ? `Menunggu ${a.waiting} hari` : null;
  if (a.late > 0) return `Lewat ${a.late} hari dari batas ${formatDate(a.due)}`;
  return `Batas ${formatDate(a.due)} · ${a.late === 0 ? 'hari ini' : `${-a.late} hari lagi`}`;
}

function Stat({ label, value, hint, right }) {
  return (
    <Card withBorder radius="md" padding="md" bg="white">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text fz={11} fw={600} c="slate.6">{label}</Text>
          <Text fz={22} fw={700} c="slate.9" lh={1.3}>{value}</Text>
          <Text fz={11} c="slate.6">{hint}</Text>
        </Box>
        {right}
      </Group>
    </Card>
  );
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
  const late = pb.fppbj.filter((f) => f.neededBy < '2026-11-04' && !pb.pos.some((p) => p.fppbjId === f.id) && f.status !== 'draft' && f.status !== 'dibatalkan');
  const bidding = pb.fppbj.filter((f) => f.route === 'bidding').length;
  const single = pb.fppbj.filter((f) => f.single?.on).length;

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <Stat label="Hutang usaha berjalan" value={rupiahShort(debt)} hint={`dari ${live.length} faktur yang belum lunas`} />
        <Stat
          label="Sudah jatuh tempo"
          value={rupiahShort(overdue)}
          hint={`${overduePct}% dari total hutang`}
          right={<RingProgress size={44} thickness={5} roundCaps sections={[{ value: overduePct, color: overdue ? 'red.6' : 'green.6' }]} />}
        />
        <Stat
          label="Menunggu tindakan Anda"
          value={todo.length}
          hint={telat.length > 0 ? `${telat.length} sudah lewat batas wajar` : `Sebagai ${roleOf(role).label}`}
          right={telat.length > 0 ? <ThemeIcon variant="light" color="red" size={32} radius="md"><Warning size={18} /></ThemeIcon> : undefined}
        />
        <Stat label="Siap dibayar" value={ready.length} hint={ready.length ? `Total ${rupiah(sum(ready, (p) => p.amount))} menunggu Kasir` : 'Payment Request yang sudah disetujui'} />
      </SimpleGrid>

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Text fw={700} fz="sm" c="slate.9">Alur pembelian</Text>
        <Text fz="xs" c="slate.6" mb="md">Dokumen yang masih berjalan di tiap tahap. Klik tahap untuk membuka daftarnya.</Text>
        <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
          {flow.map((s, i) => (
            <UnstyledButton key={s.key} onClick={() => go({ name: 'tab', tab: s.tab })} p="sm" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)', position: 'relative' }}>
              <Group gap={6} wrap="nowrap" justify="space-between">
                <Text fz="xs" fw={600} c="slate.7">{s.label}</Text>
                {i < flow.length - 1 && <ArrowRight size={12} color="var(--mantine-color-slate-4)" />}
              </Group>
              <Text fz={26} fw={700} c={s.count ? 'primary.9' : 'slate.4'} lh={1.2}>{s.count}</Text>
            </UnstyledButton>
          ))}
        </SimpleGrid>
      </Card>

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card withBorder radius="lg" padding="lg" bg="white" h="100%">
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
              <Text fw={700} fz="sm" c="slate.9" mb="xs">Pengadaan</Text>
              <Stack gap={6}>
                <Group justify="space-between"><Text fz="xs" c="slate.7">Jalur bidding</Text><Text fz="xs" fw={600}>{bidding} permintaan</Text></Group>
                <Group justify="space-between"><Text fz="xs" c="slate.7">Vendor tunggal</Text><Text fz="xs" fw={600}>{single} permintaan</Text></Group>
                <Group justify="space-between"><Text fz="xs" c="slate.7">Lewat tanggal dibutuhkan</Text><Badge size="sm" radius="sm" variant="light" color={late.length ? 'red' : 'gray'} tt="none">{late.length}</Badge></Group>
              </Stack>
              {late.slice(0, 2).map((f) => <Text key={f.id} fz={11} c="slate.6" mt={4}>{f.number} · {formatDate(f.neededBy)}</Text>)}
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
