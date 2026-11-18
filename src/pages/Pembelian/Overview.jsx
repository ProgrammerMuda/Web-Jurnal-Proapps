// Tab Ringkasan: kartu hutang, pipeline, "Perlu tindakan" per peran, umur hutang.
import { Badge, Box, Button, Card, Grid, Group, Progress, RingProgress, SimpleGrid, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { CheckCircle, ArrowRight, Warning } from '@/components/Icon.jsx';
import { Callout, RoleChip } from './components.jsx';
import { actionsFor, aging, daysLate, pipeline } from './selectors.js';
import { roleOf } from './data.js';
import { invTotals, rupiah, rupiahShort, sum, formatDate } from './utils.js';

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

export default function Overview({ pb, go }) {
  const role = pb.role;
  const live = pb.invoices.map((i) => ({ i, t: invTotals(i, pb.calc) })).filter((x) => x.t.balance > 0);
  const debt = sum(live, (x) => x.t.balance);
  const overdue = sum(live.filter((x) => daysLate(x.i.dueDate) > 0), (x) => x.t.balance);
  const overduePct = debt ? Math.round((overdue / debt) * 100) : 0;
  const ready = pb.prs.filter((p) => p.status === 'disetujui');
  const todo = actionsFor(role, pb);
  // Tugas yang sudah lewat batas wajar: ini yang perlu menonjol di dashboard peran ini.
  const telat = todo.filter((a) => a.late > 0);
  const flow = pipeline(pb);
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
                <Text fz="xs" c="slate.6">Yang sudah lewat batas wajar ditaruh paling atas.</Text>
              </Box>
              <Group gap="xs" wrap="nowrap">
                {telat.length > 0 && (
                  <Badge size="sm" radius="sm" variant="light" color="red" fw={700} tt="none" leftSection={<Warning size={12} />}>
                    {telat.length} terlambat
                  </Badge>
                )}
                <RoleChip role={role} />
              </Group>
            </Group>
            {telat.length > 0 && (
              <Box mb="sm">
                <Callout tone="warn" title={`${telat.length} tindakan melewati batas wajar`}>
                  Paling lama: {telat[0].title} · {telat[0].sub} — terlambat {telat[0].late} hari.
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
              <Stack gap={0}>
                {todo.slice(0, 8).map((a) => (
                  <Group key={a.id} justify="space-between" wrap="nowrap" py="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                    <Box style={{ minWidth: 0 }}>
                      <Group gap={6} wrap="nowrap">
                        {a.late > 0 && <Box w={4} h={16} bg="red.6" style={{ borderRadius: 2, flexShrink: 0 }} />}
                        <Text fz="sm" fw={600} c="slate.9" truncate>{a.title}</Text>
                      </Group>
                      <Text fz={11} c="slate.6" truncate>{a.sub}</Text>
                      {/* Umur tugas: berapa lama menggantung, dan berapa hari lewat batas. */}
                      {a.late > 0 ? (
                        <Text fz={11} fw={600} c="red.7">
                          Terlambat {a.late} hari{a.waiting != null ? ` · menunggu ${a.waiting} hari` : ''}
                        </Text>
                      ) : (
                        a.waiting != null && a.waiting > 0 && <Text fz={11} c="slate.5">Menunggu {a.waiting} hari</Text>
                      )}
                    </Box>
                    <Button size="compact-xs" radius="md" variant={a.late > 0 ? 'filled' : 'light'} color={a.late > 0 ? 'red' : undefined} onClick={() => go(a.to)}>{a.cta}</Button>
                  </Group>
                ))}
                {todo.length > 8 && <Text fz="xs" c="slate.6" pt="sm">+{todo.length - 8} tindakan lain</Text>}
              </Stack>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="lg">
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
