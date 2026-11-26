// Ringkasan Penjualan: kartu piutang, alur dokumen, "Perlu tindakan", umur piutang.
// Polanya sama dengan Ringkasan Pembelian supaya kedua modul terbaca dengan cara yang sama.
import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Pagination,
  Progress,
  RingProgress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { ArrowRight, CheckCircle, Invoice, Plus, SquaresFour, Warning } from '@/components/Icon.jsx';
import { useData } from '@/lib/store.jsx';
import { PageIntro } from './components.jsx';
import { TODAY } from './data.js';
import { orderStatus } from './orders.js';
import { isExpired, quoteStatus } from './quotes.js';
import { returnStatus } from './returns.js';
import { formatHash } from './routes.js';
import { actionsOf, days, sum } from './selectors.js';
import { activePayments, computeTotals, formatDate, rupiah, rupiahShort, statusOf } from './utils.js';

const go = (v) => {
  window.location.hash = formatHash(v);
};

// Warna baris "Perlu tindakan" per tingkat umur tugas, sama dengan Pembelian.
const LEVEL = {
  warn: { bg: 'var(--mantine-color-orange-0)', edge: 'var(--mantine-color-orange-5)', text: 'orange.9', btn: 'orange' },
  stale: { bg: 'var(--mantine-color-red-0)', edge: 'var(--mantine-color-red-6)', text: 'red.8', btn: 'red' },
};

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

const BUCKETS = [
  { key: 'current', label: 'Belum jatuh tempo', color: 'green.6', test: (d) => d <= 0 },
  { key: 'd30', label: '1–30 hari', color: 'yellow.6', test: (d) => d <= 30 },
  { key: 'd60', label: '31–60 hari', color: 'orange.6', test: (d) => d <= 60 },
  { key: 'd90', label: '61–90 hari', color: 'red.5', test: (d) => d <= 90 },
  { key: 'old', label: '> 90 hari', color: 'red.8', test: () => true },
];

export default function Overview() {
  const { sales, quotes, orders, salesReturns, contactsById } = useData();
  const nameOf = (id) => contactsById[id]?.displayName ?? 'Pelanggan';

  const open = sales
    .filter((s) => ['issued', 'partial'].includes(statusOf(s)))
    .map((s) => ({ s, balance: computeTotals(s).balance }))
    .filter((x) => x.balance > 0);
  const piutang = sum(open, (x) => x.balance);
  const overdue = sum(open.filter((x) => x.s.dueDate < TODAY), (x) => x.balance);
  const overduePct = piutang ? Math.round((overdue / piutang) * 100) : 0;

  const bulan = TODAY.slice(0, 7);
  const kasBulanIni = sum(sales, (s) => sum(activePayments(s).filter((p) => p.date?.startsWith(bulan)), (p) => p.amount));
  const penawaranTerbuka = quotes.filter((q) => quoteStatus(q) === 'sent' && !isExpired(q));

  const todo = actionsOf({ sales, quotes, orders, salesReturns }, nameOf);
  const telat = todo.filter((a) => a.late > 0);
  const berlarut = todo.filter((a) => a.level === 'stale');
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
    { value: 'warn', label: `Lewat batas (${todo.filter((a) => a.level === 'warn').length})` },
    { value: 'ok', label: `Baru (${todo.filter((a) => a.level === 'ok').length})` },
  ];

  // Alur dokumen yang masih berjalan, dari penawaran sampai pelunasan.
  const flow = [
    { key: 'quotes', label: 'Penawaran menunggu jawaban', tab: 'quotes', count: penawaranTerbuka.length },
    { key: 'orders', label: 'Pesanan belum difakturkan', tab: 'orders', count: orders.filter((o) => ['sent', 'confirmed', 'partial'].includes(orderStatus(o))).length },
    { key: 'draft', label: 'Faktur draf', tab: 'invoices', count: sales.filter((s) => statusOf(s) === 'draft').length },
    { key: 'open', label: 'Faktur belum lunas', tab: 'invoices', count: open.length },
    { key: 'returns', label: 'Retur kredit terbuka', tab: 'returns', count: salesReturns.filter((r) => returnStatus(r) === 'issued').length },
  ];

  const buckets = BUCKETS.map((b) => ({ ...b, value: 0 }));
  open.forEach(({ s, balance }) => {
    const late = days(s.dueDate);
    buckets.find((b) => b.test(late)).value += balance;
  });
  const agingTotal = sum(buckets, (b) => b.value);

  const perPelanggan = Object.values(
    open.reduce((acc, { s, balance }) => {
      const k = s.customerId;
      acc[k] = acc[k] ?? { id: k, name: nameOf(k), value: 0, count: 0 };
      acc[k].value += balance;
      acc[k].count += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.value - a.value);

  const dijawab = quotes.filter((q) => ['accepted', 'rejected', 'converted', 'invoiced'].includes(quoteStatus(q)));
  const diterima = dijawab.filter((q) => quoteStatus(q) !== 'rejected');
  const konversi = dijawab.length ? Math.round((diterima.length / dijawab.length) * 100) : 0;

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro
        icon={SquaresFour}
        title="Ringkasan Penjualan"
        description="Piutang berjalan, dokumen yang masih di tengah jalan, dan tindakan yang perlu segera dikerjakan."
        actions={
          <Button size="sm" radius="md" color="primary.9" leftSection={<Plus size={16} />} onClick={() => go({ name: 'sale-new' })}>
            Buat Faktur
          </Button>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <Stat label="Piutang usaha berjalan" value={rupiahShort(piutang)} hint={`dari ${open.length} faktur yang belum lunas`} />
        <Stat
          label="Sudah jatuh tempo"
          value={rupiahShort(overdue)}
          hint={`${overduePct}% dari total piutang`}
          right={<RingProgress size={44} thickness={5} roundCaps sections={[{ value: overduePct, color: overdue ? 'red.6' : 'green.6' }]} />}
        />
        <Stat
          label="Perlu tindakan"
          value={todo.length}
          hint={telat.length > 0 ? `${telat.length} sudah lewat batas` : 'Semua masih dalam batas waktu'}
          right={telat.length > 0 ? <ThemeIcon variant="light" color="red" size={32} radius="md"><Warning size={18} /></ThemeIcon> : undefined}
        />
        <Stat label="Kas diterima bulan ini" value={rupiahShort(kasBulanIni)} hint={`Pembayaran pelanggan ${formatDate(`${bulan}-01`).replace(/^1 /, '')}`} />
      </SimpleGrid>

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Text fw={700} fz="sm" c="slate.9">Alur penjualan</Text>
        <Text fz="xs" c="slate.6" mb="md">Dokumen yang masih berjalan di tiap tahap. Klik tahap untuk membuka daftarnya.</Text>
        <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
          {flow.map((s, i) => (
            <UnstyledButton key={s.key} onClick={() => go({ name: 'tab', tab: s.tab })} p="sm" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
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
            <Box mb="xs">
              <Text fw={700} fz="sm" c="slate.9">Perlu tindakan</Text>
              <Text fz="xs" c="slate.6">Oranye: lewat batas wajar. Merah: dibiarkan berlarut. Yang paling lama di atas.</Text>
            </Box>
            {todo.length === 0 ? (
              <Stack align="center" gap={6} py={36}>
                <ThemeIcon variant="light" color="green" size={48} radius="xl"><CheckCircle size={26} /></ThemeIcon>
                <Text fz="sm" fw={700}>Semua sudah beres</Text>
                <Text fz="xs" c="slate.6">Tidak ada dokumen penjualan yang menunggu tindakan.</Text>
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
                        {umur && <Text fz={11} fw={lv ? 700 : 400} c={lv ? lv.text : 'slate.5'}>{umur}</Text>}
                      </Box>
                      <Button size="compact-xs" radius="md" variant={lv ? 'filled' : 'light'} color={lv?.btn} onClick={() => go(a.to)}>Buka</Button>
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
            <Card withBorder radius="lg" padding="lg" bg="white">
              <Text fw={700} fz="sm" c="slate.9">Umur piutang</Text>
              <Text fz="xs" c="slate.6" mb="sm">Sisa tagihan menurut lama jatuh tempo</Text>
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
              <Text fw={700} fz="sm" c="slate.9">Piutang terbesar</Text>
              <Text fz="xs" c="slate.6" mb="xs">Pelanggan dengan sisa tagihan paling besar</Text>
              {perPelanggan.length === 0 ? (
                <Text fz="xs" c="slate.6">Tidak ada piutang berjalan.</Text>
              ) : (
                <Stack gap={0}>
                  {perPelanggan.slice(0, 5).map((p) => (
                    <Group key={p.id} justify="space-between" wrap="nowrap" gap="sm" py={8} style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                      <Box style={{ minWidth: 0 }}>
                        <Text fz="xs" fw={600} c="slate.9" truncate>{p.name}</Text>
                        <Text fz={11} c="slate.6">{p.count} faktur</Text>
                      </Box>
                      <Text fz="xs" fw={700} style={{ whiteSpace: 'nowrap' }}>{rupiah(p.value)}</Text>
                    </Group>
                  ))}
                </Stack>
              )}
            </Card>

            <Card withBorder radius="lg" padding="lg" bg="white">
              <Text fw={700} fz="sm" c="slate.9" mb="xs">Penawaran</Text>
              <Stack gap={6}>
                <Group justify="space-between"><Text fz="xs" c="slate.7">Menunggu jawaban</Text><Text fz="xs" fw={600}>{penawaranTerbuka.length} penawaran</Text></Group>
                <Group justify="space-between"><Text fz="xs" c="slate.7">Nilai menunggu jawaban</Text><Text fz="xs" fw={600}>{rupiah(sum(penawaranTerbuka, (q) => computeTotals(q).total))}</Text></Group>
                <Group justify="space-between"><Text fz="xs" c="slate.7">Tingkat konversi</Text><Badge size="sm" radius="sm" variant="light" color={konversi >= 50 ? 'green' : 'gray'} tt="none">{konversi}%</Badge></Group>
                <Group justify="space-between"><Text fz="xs" c="slate.7">Kedaluwarsa</Text><Badge size="sm" radius="sm" variant="light" color={quotes.some(isExpired) ? 'red' : 'gray'} tt="none">{quotes.filter(isExpired).length}</Badge></Group>
              </Stack>
              <Button variant="subtle" size="compact-xs" radius="md" mt="sm" leftSection={<Invoice size={14} />} onClick={() => go({ name: 'tab', tab: 'quotes' })}>
                Lihat semua penawaran
              </Button>
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
