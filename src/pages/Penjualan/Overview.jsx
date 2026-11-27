// Ringkasan Penjualan: piutang dan komposisinya, antrean kerja, alur dokumen, "Perlu tindakan",
// umur piutang, piutang per pelanggan, kredit pelanggan, penjualan bulan ini, dan penawaran.
// Kartunya memakai potongan yang sama dengan Ringkasan Pembelian (components/overview.jsx).
import { useState } from 'react';
import { Badge, Box, Button, Card, Grid, Group, Pagination, Progress, SegmentedControl, Stack, Text, ThemeIcon } from '@mantine/core';
import { CheckCircle, Coins, HandCoins, ListChecks, PaperPlaneTilt, Plus, SquaresFour, Warning } from '@/components/Icon.jsx';
import { CardTitle, CompareBars, CompositionCard, FlowCard, Legend, QueueCard, Quiet, ShareList } from '@/components/overview.jsx';
import { useData } from '@/lib/store.jsx';
import { Callout } from '@/pages/Pembelian/components.jsx';
import { PageIntro } from './components.jsx';
import { TODAY } from './data.js';
import { orderStatus } from './orders.js';
import { isExpired, quoteStatus } from './quotes.js';
import { BUCKETS, openSales } from './receivables.js';
import { creditPart, returnStatus } from './returns.js';
import { formatHash } from './routes.js';
import { actionsOf, days, isLate, sum, unsent } from './selectors.js';
import { activePayments, addDays, computeTotals, formatDate, rupiah, rupiahShort, statusOf } from './utils.js';

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

// Bulan sebelumnya dari "YYYY-MM".
const prevMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};
const monthName = (ym) => formatDate(`${ym}-01`).replace(/^1 /, '');

export default function Overview() {
  const { sales, quotes, orders, salesReturns, contactsById } = useData();
  const nameOf = (id) => contactsById[id]?.displayName ?? 'Pelanggan';

  // --- Piutang dan komposisinya menurut jatuh tempo ---
  // Aturan faktur terbuka dan kelompok umur sama dengan halaman Piutang Usaha (receivables.js).
  const open = openSales(sales).map((r) => ({ s: r.sale, balance: r.balance }));
  const piutang = sum(open, (x) => x.balance);
  const telatList = open.filter((x) => x.s.dueDate < TODAY);
  const overdue = sum(telatList, (x) => x.balance);
  const sepekan = addDays(TODAY, 7);
  const segeraList = open.filter((x) => x.s.dueDate >= TODAY && x.s.dueDate <= sepekan).sort((a, b) => a.s.dueDate.localeCompare(b.s.dueDate));
  const segera = sum(segeraList, (x) => x.balance);
  const nanti = Math.max(piutang - overdue - segera, 0);
  const masaDepan = open.filter((x) => x.s.date > TODAY).length;
  const komposisi = [
    { key: 'late', label: 'Sudah jatuh tempo', value: overdue, display: rupiahShort(overdue), color: 'red.6', hint: overdue ? `${telatList.length} faktur · ${Math.round((overdue / piutang) * 100)}% dari piutang` : 'Tidak ada yang telat' },
    { key: 'soon', label: 'Jatuh tempo 7 hari', value: segera, display: rupiahShort(segera), color: 'orange.4', hint: segeraList.length ? `${segeraList.length} faktur · terdekat ${formatDate(segeraList[0].s.dueDate)}` : 'Tidak ada minggu ini' },
    { key: 'later', label: 'Lebih dari 7 hari', value: nanti, display: rupiahShort(nanti), color: 'gray.4', hint: 'Belum perlu ditagih' },
  ];

  // --- Antrean kerja ---
  const todo = actionsOf({ sales, quotes, orders, salesReturns }, nameOf);
  const telat = todo.filter(isLate);
  const berlarut = todo.filter((a) => a.level === 'stale');
  const belumKirim = open.filter((x) => unsent(x.s));
  const bulanIni = TODAY.slice(0, 7);
  const bulanLalu = prevMonth(bulanIni);
  const bayarBulanIni = sales.flatMap((s) => activePayments(s)).filter((p) => p.date?.startsWith(bulanIni));
  const antrean = [
    {
      key: 'todo',
      label: 'Perlu tindakan',
      value: todo.length,
      hint: telat.length ? `${telat.length} sudah lewat batas wajar` : 'Semua masih dalam batas waktu',
      alert: telat.length > 0,
      icon: telat.length ? Warning : ListChecks,
      tone: telat.length ? 'red' : 'gray',
      onClick: () => document.getElementById('perlu-tindakan')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    },
    {
      key: 'unsent',
      label: 'Faktur belum dikirim',
      value: belumKirim.length,
      hint: belumKirim.length ? `${rupiah(sum(belumKirim, (x) => x.balance))} belum diketahui pelanggan` : 'Semua faktur sudah dikirim',
      icon: PaperPlaneTilt,
      onClick: () => go({ name: 'tab', tab: 'invoices' }),
    },
    {
      key: 'cash',
      label: `Kas diterima ${monthName(bulanIni)}`,
      value: rupiahShort(sum(bayarBulanIni, (p) => p.amount)),
      hint: `${bayarBulanIni.length} pembayaran pelanggan`,
      icon: HandCoins,
      onClick: () => go({ name: 'tab', tab: 'payments' }),
    },
  ];

  // --- Daftar "Perlu tindakan" ---
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

  // --- Alur: tiap dokumen hanya di satu tahap ---
  const penawaranTerbuka = quotes.filter((q) => quoteStatus(q) === 'sent' && !isExpired(q));
  const flow = [
    { key: 'quotes', label: 'Penawaran', hint: 'menunggu jawaban pelanggan', tab: 'quotes', count: penawaranTerbuka.length },
    { key: 'orders', label: 'Pesanan', hint: 'belum difakturkan penuh', tab: 'orders', count: orders.filter((o) => ['sent', 'confirmed', 'partial'].includes(orderStatus(o))).length },
    { key: 'draft', label: 'Faktur draf', hint: 'belum diterbitkan', tab: 'invoices', count: sales.filter((s) => statusOf(s) === 'draft').length },
    { key: 'open', label: 'Faktur belum lunas', hint: 'menunggu pembayaran', tab: 'invoices', count: open.length },
  ];

  // --- Umur piutang ---
  const buckets = BUCKETS.map((b) => ({ ...b, value: 0 }));
  open.forEach(({ s, balance }) => {
    buckets.find((b) => b.test(days(s.dueDate))).value += balance;
  });

  // --- Piutang per pelanggan ---
  const perPelanggan = Object.values(
    open.reduce((acc, { s, balance }) => {
      const k = s.customerId;
      acc[k] = acc[k] ?? { id: k, name: nameOf(k), value: 0, count: 0, late: 0 };
      acc[k].value += balance;
      acc[k].count += 1;
      if (s.dueDate < TODAY) acc[k].late += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.value - a.value);

  // --- Kredit pelanggan dari retur yang belum terpakai ---
  const kreditRetur = salesReturns
    .filter((r) => returnStatus(r) === 'issued' && creditPart(r) > (r.creditUsed ?? 0))
    .map((r) => ({ r, sisa: creditPart(r) - (r.creditUsed ?? 0) }));
  const kreditTotal = sum(kreditRetur, (x) => x.sisa);

  // --- Penjualan bulan ini vs periode sama bulan lalu (DPP faktur terbit) ---
  const hariKe = Number(TODAY.slice(8, 10));
  const dpp = (s) => {
    const t = computeTotals(s);
    return t.subtotal - t.discount;
  };
  const jualDi = (ym, untilDay = 31) =>
    sum(
      sales.filter((s) => !['draft', 'cancelled'].includes(statusOf(s)) && s.date?.startsWith(ym) && Number(s.date.slice(8, 10)) <= untilDay),
      dpp,
    );
  const jualIni = jualDi(bulanIni, hariKe);
  const jualLaluSd = jualDi(bulanLalu, hariKe);
  const jualLalu = jualDi(bulanLalu);
  const jualDelta = jualLaluSd ? Math.round(((jualIni - jualLaluSd) / jualLaluSd) * 100) : null;

  // --- Penawaran: kedaluwarsa tanpa jawaban dihitung gagal, bukan diabaikan ---
  const menang = quotes.filter((q) => ['accepted', 'converted', 'invoiced'].includes(quoteStatus(q)));
  const ditolak = quotes.filter((q) => quoteStatus(q) === 'rejected');
  const kedaluwarsa = quotes.filter(isExpired);
  const selesai = menang.length + ditolak.length + kedaluwarsa.length;
  const konversi = selesai ? Math.round((menang.length / selesai) * 100) : null;
  const penawaranLegend = [
    { key: 'won', label: 'Diterima', value: menang.length, color: 'green.6' },
    { key: 'lost', label: 'Ditolak', value: ditolak.length, color: 'red.5' },
    { key: 'exp', label: 'Kedaluwarsa tanpa jawaban', value: kedaluwarsa.length, color: 'orange.4' },
  ];

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

      <Grid gutter="lg" align="stretch">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <CompositionCard
            title="Piutang usaha berjalan"
            text={`${open.length} faktur belum lunas${masaDepan ? ` · ${masaDepan} bertanggal setelah hari ini` : ''}`}
            action={{ label: 'Piutang usaha', onClick: () => go({ name: 'tab', tab: 'receivables' }) }}
            figure={rupiah(piutang)}
            parts={komposisi}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}>
          <QueueCard items={antrean} />
        </Grid.Col>
      </Grid>

      <FlowCard
        title="Alur penjualan"
        text="Dokumen yang masih berjalan, masing-masing hanya di satu tahap. Klik tahap untuk membuka daftarnya."
        steps={flow.map((f) => ({ ...f, onClick: () => go({ name: 'tab', tab: f.tab }) }))}
      />

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card id="perlu-tindakan" withBorder radius="lg" padding="lg" bg="white" h="100%" style={{ scrollMarginTop: 72 }}>
            <Box mb="xs">
              <Text fw={700} fz="sm" c="slate.9">Perlu tindakan</Text>
              <Text fz="xs" c="slate.6">Oranye: lewat batas wajar. Merah: dibiarkan berlarut. Yang paling lama di atas.</Text>
            </Box>
            {telat.length > 0 && (
              <Box mb="sm">
                <Callout tone={berlarut.length ? 'stop' : 'warn'} title={`${telat.length} tindakan lewat batas waktu`}>
                  Paling lama: {telat[0].title} untuk <b>{telat[0].sub}</b>, {telat[0].late > 0 ? `terlambat ${telat[0].late} hari` : `menunggu ${telat[0].waiting} hari`}.
                </Callout>
              </Box>
            )}
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
              <CardTitle
                title="Umur piutang"
                text="Sisa tagihan menurut lama jatuh tempo"
                right={<Button variant="default" size="compact-xs" radius="xl" onClick={() => go({ name: 'tab', tab: 'receivables' })} style={{ flexShrink: 0 }}>Rincian</Button>}
              />
              <Progress.Root size={8} radius="xl" my="sm" bg="gray.1">
                {buckets.map((b) => b.value > 0 && <Progress.Section key={b.key} value={(b.value / piutang) * 100} color={b.color} />)}
              </Progress.Root>
              <Legend items={buckets.map((b) => ({ ...b, value: rupiah(b.value), muted: !b.value }))} />
            </Card>

            <Card withBorder radius="lg" padding="lg" bg="white">
              <CardTitle title="Piutang per pelanggan" text="Sisa tagihan terbesar" right={perPelanggan.length > 0 && `${perPelanggan.length} pelanggan`} />
              {perPelanggan.length === 0 ? (
                <Quiet icon={CheckCircle} title="Tidak ada piutang berjalan" text="Semua faktur sudah lunas." />
              ) : (
                <ShareList
                  rows={perPelanggan.map((p) => ({
                    ...p,
                    display: rupiahShort(p.value),
                    sub: p.late ? `${p.count} faktur · ${p.late} lewat jatuh tempo` : `${p.count} faktur`,
                    alert: p.late > 0,
                  }))}
                  total={piutang}
                  onClick={() => go({ name: 'tab', tab: 'receivables' })}
                />
              )}
            </Card>

            <Card withBorder radius="lg" padding="lg" bg="white">
              <CardTitle title="Kredit pelanggan" text="Retur yang jadi kredit dan belum terpakai" />
              {kreditRetur.length === 0 ? (
                <Quiet icon={Coins} title="Tidak ada kredit terbuka" text="Kredit dari retur penjualan akan muncul di sini." />
              ) : (
                <>
                  <Text fz={24} fw={700} c="slate.9" lh="32px" mt="sm">{rupiahShort(kreditTotal)}</Text>
                  <Stack gap={0} mt="xs">
                    {kreditRetur.slice(0, 4).map(({ r, sisa }) => (
                      <Group key={r.id} justify="space-between" wrap="nowrap" py={8} style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                        <Box style={{ minWidth: 0 }}>
                          <Text fz="xs" fw={600} c="primary.9" truncate>{r.number}</Text>
                          <Text fz={11} c="slate.6" truncate>{nameOf(r.customerId)}</Text>
                        </Box>
                        <Text fz="xs" fw={600} style={{ whiteSpace: 'nowrap' }}>{rupiah(sisa)}</Text>
                      </Group>
                    ))}
                  </Stack>
                </>
              )}
            </Card>

            <Card withBorder radius="lg" padding="lg" bg="white">
              <CardTitle
                title={`Penjualan ${monthName(bulanIni)}`}
                text={`Faktur terbit 1–${hariKe} ${monthName(bulanIni).split(' ')[0]}, DPP setelah diskon`}
                right={jualDelta != null && (
                  <Badge size="sm" radius="xl" variant="light" color={jualDelta >= 0 ? 'green' : 'orange'} tt="none">
                    {jualDelta > 0 ? '+' : ''}{jualDelta}%
                  </Badge>
                )}
              />
              <Text fz={24} fw={700} c="slate.9" lh="32px" mt="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>{rupiahShort(jualIni)}</Text>
              <CompareBars
                bars={[
                  { label: `1–${hariKe} ${monthName(bulanIni).split(' ')[0]}`, value: jualIni, display: rupiah(jualIni), color: 'primary.8' },
                  { label: `1–${hariKe} ${monthName(bulanLalu).split(' ')[0]}`, value: jualLaluSd, display: rupiah(jualLaluSd), color: 'slate.4' },
                ]}
              />
              <Text fz={11} c="slate.6" mt="sm" pt="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                Sebulan penuh {monthName(bulanLalu)}: <Text span fz={11} c="slate.8" fw={600}>{rupiah(jualLalu)}</Text>
                {jualLalu > 0 && ` · bulan ini sudah ${Math.round((jualIni / jualLalu) * 100)}%`}
              </Text>
            </Card>

            <Card withBorder radius="lg" padding="lg" bg="white">
              <CardTitle
                title="Penawaran"
                text="Konversi yang sudah selesai"
                right={
                  <Button variant="default" size="compact-sm" radius="xl" style={{ flexShrink: 0 }} onClick={() => go({ name: 'tab', tab: 'quotes' })}>
                    Semua
                  </Button>
                }
              />
              {konversi == null ? (
                <Quiet icon={PaperPlaneTilt} title="Belum ada penawaran yang selesai" text="Konversi dihitung setelah ada yang diterima, ditolak, atau kedaluwarsa." />
              ) : (
                <>
                  <Group gap={6} align="baseline" mt="sm">
                    <Text fz={24} fw={700} c="slate.9" lh="32px">{konversi}%</Text>
                    <Text fz="xs" c="slate.6">{menang.length} dari {selesai} penawaran diterima</Text>
                  </Group>
                  <Progress.Root size={8} radius="xl" mt={8} mb="sm" bg="gray.1">
                    {penawaranLegend.map((j) => j.value > 0 && <Progress.Section key={j.key} value={(j.value / selesai) * 100} color={j.color} />)}
                  </Progress.Root>
                  <Legend items={penawaranLegend.map((j) => ({ ...j, muted: !j.value }))} />
                </>
              )}
              <Group justify="space-between" mt="sm" pt="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                <Text fz={11} c="slate.6">Masih menunggu jawaban</Text>
                <Text fz={11} c="slate.8" fw={600}>
                  {penawaranTerbuka.length} · {rupiah(sum(penawaranTerbuka, (q) => computeTotals(q).total))}
                </Text>
              </Group>
            </Card>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
