// Hutang Usaha: meja kerja pembayaran ke vendor, dengan susunan yang sama seperti Piutang Usaha
// di Penjualan. Angkanya diturunkan dari faktur pembelian (sisa hutang per faktur), lalu kartu
// "Cocok dengan buku besar" membandingkannya dengan saldo akun hutang di jurnal.
import { useMemo, useState } from 'react';
import { Anchor, Badge, Box, Button, Card, Grid, Group, Progress, Select, Stack, Table, Text, UnstyledButton } from '@mantine/core';
import { CaretRight, ChartBar, CheckCircle, Clock, DownloadSimple, Eye, Invoice, Money, Package, Storefront, LockSimple, Warning } from '@/components/Icon.jsx';
import StatCards from '@/components/StatCards.jsx';
import { Quiet } from '@/components/overview.jsx';
import rowClasses from '@/components/overview.module.css';
import { useData } from '@/lib/store.jsx';
import { downloadCsv } from '@/pages/Kontak/utils.js';
import { accountBalances, buildLedger } from '@/pages/LaporanKeuangan/ledger.js';
import { accountHref } from '@/pages/LaporanKeuangan/StatementParts.jsx';
import { Callout, DocNumber, ListShell, PageIntro, RowMenu, TabBar } from './components.jsx';
import { TODAY } from './data.js';
import { canCreate } from './permissions.js';
import { daysLate, readiness } from './selectors.js';
import { formatDate, invTotals, isDpInvoice, rupiah, rupiahShort, sum, vendorCredit } from './utils.js';

// Akun Hutang Usaha di jurnal Pembelian (2-10200). Retensi punya akun sendiri (2-10160) dan
// baru masuk Hutang Usaha saat dilepas, jadi tidak ikut di angka utama.
const HUTANG = '2-10200';
const tabular = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

// Lima kelompok umur, sama dengan Piutang Usaha.
const BUCKETS = [
  { key: 'current', label: 'Belum jatuh tempo', short: 'Belum jatuh tempo', color: 'green.6', test: (d) => d <= 0 },
  { key: 'd30', label: '1–30 hari', short: '1–30', color: 'yellow.6', test: (d) => d <= 30 },
  { key: 'd60', label: '31–60 hari', short: '31–60', color: 'orange.6', test: (d) => d <= 60 },
  { key: 'd90', label: '61–90 hari', short: '61–90', color: 'red.5', test: (d) => d <= 90 },
  { key: 'old', label: '> 90 hari', short: '> 90', color: 'red.8', test: () => true },
];
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);
const AGE_FILTERS = [
  { value: 'all', label: 'Semua umur', match: () => true },
  { value: 'overdue', label: 'Lewat jatuh tempo', match: (r) => r.late > 0 },
  { value: 'soon', label: 'Jatuh tempo ≤ 7 hari', match: (r) => r.late <= 0 && r.inv.dueDate <= addDays(TODAY, 7) },
  ...BUCKETS.map((b) => ({ value: b.key, label: b.label, match: (r) => r.bucket === b.key })),
];

function Amount({ value, late = false, strong = false }) {
  if (!value) return <Text fz="sm" c="slate.4" style={tabular}>–</Text>;
  return (
    <Text fz="sm" fw={strong ? 700 : 500} c={late ? 'red.8' : 'slate.9'} style={tabular}>
      {rupiah(value)}
    </Text>
  );
}

function AgeBadge({ late }) {
  const [color, label] = late > 0 ? ['red', `Terlambat ${late} hari`] : late === 0 ? ['orange', 'Jatuh tempo hari ini'] : ['green', `${-late} hari lagi`];
  return <Badge size="sm" radius="xl" variant="light" color={color} tt="none" fw={600}>{label}</Badge>;
}

// Sudah sejauh mana sisa hutang faktur ini diajukan bayar (Payment Request).
function PayState({ t }) {
  if (t.free <= 0) return <Text fz="xs" c="slate.8">Sudah diajukan</Text>;
  if (t.free < t.balance) return <Text fz="xs" c="orange.8">Sebagian diajukan</Text>;
  return <Text fz="xs" c="orange.8">Belum diajukan</Text>;
}

function CardHead({ title, text, right }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
      <Box style={{ minWidth: 0 }}>
        <Text fz="md" fw={600} c="slate.9" lh="24px">{title}</Text>
        <Text fz="sm" c="slate.6" lh="20px">{text}</Text>
      </Box>
      {right}
    </Group>
  );
}

// Umur hutang: bar bersegmen lalu lima baris kelompok yang bisa diklik untuk menyaring.
function AgingCard({ buckets, total, active, onPick }) {
  return (
    <Card withBorder radius="lg" padding="lg" bg="white" h="100%">
      <CardHead
        title="Umur hutang"
        text="Sisa hutang menurut lama lewat jatuh tempo"
        right={
          active !== 'all' && BUCKETS.some((b) => b.key === active) && (
            <Button variant="default" size="compact-sm" radius="xl" onClick={() => onPick(active)}>Hapus saringan</Button>
          )
        }
      />
      <Progress.Root size={8} radius="xl" mt="lg" bg="gray.1">
        {buckets.map((b) => b.value > 0 && <Progress.Section key={b.key} value={(b.value / total) * 100} color={b.color} />)}
      </Progress.Root>
      <Stack gap={2} mt="md">
        {buckets.map((b) => {
          const kosong = !b.value;
          const dipilih = active === b.key;
          return (
            <UnstyledButton
              key={b.key}
              className={kosong ? undefined : rowClasses.row}
              disabled={kosong}
              aria-pressed={dipilih}
              onClick={() => onPick(b.key)}
              px="sm"
              h={36}
              style={{ display: 'flex', alignItems: 'center', borderRadius: 'var(--mantine-radius-md)', background: dipilih ? 'var(--mantine-color-gray-1)' : undefined, cursor: kosong ? 'default' : 'pointer' }}
            >
              <Group gap="sm" wrap="nowrap" w="100%">
                <Box w={8} h={8} style={{ borderRadius: 4, flexShrink: 0, background: `var(--mantine-color-${b.color.replace('.', '-')})`, opacity: kosong ? 0.35 : 1 }} />
                <Text fz="sm" c={kosong ? 'slate.5' : 'slate.9'} style={{ flex: 1 }}>{b.label}</Text>
                <Text fz="xs" c="slate.6" w={64} ta="right">{kosong ? '' : `${b.count} faktur`}</Text>
                <Text fz="sm" fw={500} c={kosong ? 'slate.4' : 'slate.9'} w={150} ta="right" style={tabular}>{kosong ? '–' : rupiah(b.value)}</Text>
                <Text fz="xs" c="slate.6" w={40} ta="right" style={tabular}>{kosong ? '' : `${Math.round((b.value / total) * 100)}%`}</Text>
              </Group>
            </UnstyledButton>
          );
        })}
      </Stack>
    </Card>
  );
}

// Cek buku besar: sisa hutang per faktur dibanding saldo akun Hutang Usaha per hari ini.
function GlCard({ perFaktur, ledger }) {
  const diff = Math.round(perFaktur - ledger);
  const cocok = diff === 0;
  const row = (label, value, tone) => (
    <Group justify="space-between" wrap="nowrap" h={32}>
      <Text fz="sm" c={tone ?? 'slate.6'} truncate title={label}>{label}</Text>
      <Text fz="sm" fw={500} c={tone ?? 'slate.9'} style={tabular}>{value}</Text>
    </Group>
  );
  return (
    <Card withBorder radius="lg" padding="lg" bg="white" h="100%">
      <CardHead
        title="Cocok dengan buku besar"
        text={`Per ${formatDate(TODAY)}`}
        right={
          <Button component="a" href={accountHref(HUTANG)} variant="default" size="compact-sm" radius="xl" rightSection={<CaretRight size={12} />}>
            Buku besar
          </Button>
        }
      />
      <Group gap="sm" mt="lg" align="center" wrap="nowrap">
        <Text fz={24} fw={600} lh="32px" c="slate.9" style={{ ...tabular, letterSpacing: '-0.01em' }}>{rupiah(perFaktur)}</Text>
        <Badge
          size="md"
          radius="xl"
          variant="light"
          color={cocok ? 'green' : 'red'}
          tt="none"
          fw={500}
          leftSection={cocok ? <CheckCircle size={12} /> : <Warning size={12} />}
          style={{ boxShadow: `0 0 0 1px var(--mantine-color-${cocok ? 'green' : 'red'}-2)` }}
        >
          {cocok ? 'Cocok' : 'Ada selisih'}
        </Badge>
      </Group>
      <Text fz="sm" c="slate.6">Hutang per hari ini dari faktur</Text>
      <Box mt="md" pt="xs" style={{ borderTop: '0.5px solid var(--mantine-color-gray-3)' }}>
        {row('Total per faktur', rupiah(perFaktur))}
        {row(`Saldo buku besar (${HUTANG})`, rupiah(ledger))}
        {!cocok && row('Selisih', rupiah(diff), 'red.8')}
      </Box>
      {!cocok && (
        <Box mt="sm">
          <Callout tone="stop" title="Angka hutang tidak sama dengan buku besar">
            Akun {HUTANG} juga menampung transaksi di luar faktur pembelian (mis. retur gudang). Periksa jurnalnya untuk menemukan selisihnya.
          </Callout>
        </Box>
      )}
    </Card>
  );
}

export default function LaporanHutang({ pb, go }) {
  const data = useData();
  const role = pb.role;
  const canPr = canCreate(role, 'pr');
  const vname = (id) => pb.vendorsById[id]?.name ?? '—';

  // Satu baris per faktur yang masih ada sisa hutangnya.
  const rows = useMemo(
    () => pb.invoices
      .map((inv) => ({ inv, t: invTotals(inv, pb.calc) }))
      .filter((r) => r.t.balance > 0)
      .map((r) => {
        const late = daysLate(r.inv.dueDate);
        return { ...r, id: r.inv.id, vendorId: r.inv.vendorId, late, bucket: BUCKETS.find((b) => b.test(late)).key };
      }),
    [pb.invoices, pb.calc],
  );
  const summary = useMemo(() => {
    const late = rows.filter((r) => r.late > 0);
    const soon = rows.filter(AGE_FILTERS.find((f) => f.value === 'soon').match);
    return {
      total: sum(rows, (r) => r.t.balance),
      vendors: new Set(rows.map((r) => r.vendorId)).size,
      late: { value: sum(late, (r) => r.t.balance), count: late.length, oldest: Math.max(0, ...late.map((r) => r.late)) },
      soon: { value: sum(soon, (r) => r.t.balance), count: soon.length },
      buckets: BUCKETS.map((b) => {
        const isi = rows.filter((r) => r.bucket === b.key);
        return { ...b, value: sum(isi, (r) => r.t.balance), count: isi.length };
      }),
    };
  }, [rows]);
  const retensi = readiness(pb).retention;
  const retensiTotal = sum(retensi, (x) => x.rt.balance);
  const ledger = useMemo(
    () => accountBalances(buildLedger(data), TODAY)[HUTANG] ?? 0,
    [data.pb, data.sales, data.salesReturns, data.stockMoves, data.products], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [tab, setTab] = useState('vendors');
  const [age, setAge] = useState('all');
  const [vendorId, setVendorId] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  const ageMatch = AGE_FILTERS.find((f) => f.value === age).match;
  const q = query.trim().toLowerCase();
  const filteredRows = rows
    .filter((r) => ageMatch(r) && (!vendorId || r.vendorId === vendorId))
    .filter((r) => !q || [r.inv.number, r.inv.vendorNo, vname(r.vendorId)].some((v) => v?.toLowerCase().includes(q)))
    .sort((a, b) => b.late - a.late || b.t.balance - a.t.balance);
  const byVendor = Object.values(filteredRows.reduce((acc, r) => {
    const v = (acc[r.vendorId] ??= { vendorId: r.vendorId, count: 0, lateCount: 0, oldest: 0, total: 0, free: [], buckets: Object.fromEntries(BUCKETS.map((b) => [b.key, 0])) });
    v.count += 1;
    v.total += r.t.balance;
    v.buckets[r.bucket] += r.t.balance;
    if (r.late > 0) v.lateCount += 1;
    v.oldest = Math.max(v.oldest, r.late);
    if (r.t.free > 0) v.free.push(r.inv.id);
    return acc;
  }, {})).sort((a, b) => b.total - a.total);
  const filteredRetensi = retensi.filter(({ po }) => (!vendorId || po.vendorId === vendorId) && (!q || [po.number, vname(po.vendorId)].some((v) => v?.toLowerCase().includes(q))));

  const setFilter = (nextTab, nextAge) => {
    setTab(nextTab);
    setAge(nextAge);
    setPage(1);
  };

  const exportCsv = () =>
    downloadCsv(`hutang-usaha-${TODAY}.csv`, [
      ['No. Faktur', 'No. invoice vendor', 'Vendor', 'Tanggal', 'Jatuh tempo', 'Hari terlambat', 'Kelompok umur', 'Total', 'Dibayar', 'Sisa'],
      ...filteredRows.map((r) => [r.inv.number, r.inv.vendorNo, vname(r.vendorId), r.inv.date, r.inv.dueDate, Math.max(r.late, 0), BUCKETS.find((b) => b.key === r.bucket).label, r.t.total, r.t.paid, r.t.balance]),
    ]);

  const stats = [
    {
      label: 'Total Hutang',
      value: rupiahShort(summary.total),
      hint: `${rows.length} faktur · ${summary.vendors} vendor`,
      icon: ChartBar,
      onClick: () => setFilter('invoices', 'all'),
      active: tab === 'invoices' && age === 'all' && !vendorId,
    },
    {
      label: 'Lewat Jatuh Tempo',
      value: rupiahShort(summary.late.value),
      hint: summary.late.count ? `${summary.late.count} faktur · terlama ${summary.late.oldest} hari` : 'Tidak ada tunggakan',
      icon: Warning,
      onClick: () => setFilter('invoices', 'overdue'),
      active: tab === 'invoices' && age === 'overdue',
    },
    {
      label: 'Jatuh Tempo 7 Hari',
      value: rupiahShort(summary.soon.value),
      hint: summary.soon.count ? `${summary.soon.count} faktur perlu disiapkan` : 'Tidak ada minggu ini',
      icon: Clock,
      onClick: () => setFilter('invoices', 'soon'),
      active: tab === 'invoices' && age === 'soon',
    },
    {
      label: 'Hutang Retensi',
      value: rupiahShort(retensiTotal),
      hint: `Akun 2-10160 · ${retensi.length} pesanan, belum termasuk total`,
      icon: LockSimple,
      onClick: () => setFilter('retention', 'all'),
      active: tab === 'retention',
    },
  ];

  // --- Per vendor ---------------------------------------------------------------------------
  const vendorHead = [
    { label: 'Vendor' },
    { label: 'Faktur', align: 'right' },
    ...BUCKETS.map((b) => ({ label: b.short, align: 'right' })),
    { label: 'Total', align: 'right' },
    { label: 'Kredit', align: 'right' },
    { label: '', w: 50 },
  ];
  const vendorRows = byVendor.map((v) => (
    <Table.Tr key={v.vendorId}>
      <Table.Td>
        <DocNumber onClick={() => { setVendorId(v.vendorId); setFilter('invoices', age); }}>{vname(v.vendorId)}</DocNumber>
        {v.lateCount > 0 && <Text fz={11} c="red.7">{v.lateCount} faktur terlambat · terlama {v.oldest} hari</Text>}
      </Table.Td>
      <Table.Td ta="right"><Text fz="sm" c="slate.8">{v.count}</Text></Table.Td>
      {BUCKETS.map((b) => <Table.Td key={b.key} ta="right"><Amount value={v.buckets[b.key]} late={b.key !== 'current'} /></Table.Td>)}
      <Table.Td ta="right"><Amount value={v.total} strong /></Table.Td>
      <Table.Td ta="right"><Amount value={vendorCredit(v.vendorId, pb)} /></Table.Td>
      <Table.Td ta="center">
        <RowMenu
          label={vname(v.vendorId)}
          items={[
            { label: 'Lihat fakturnya', icon: Eye, onClick: () => { setVendorId(v.vendorId); setFilter('invoices', age); } },
            canPr && v.free.length > 0 && { label: `Ajukan pembayaran (${v.free.length} faktur)`, icon: Money, onClick: () => go({ name: 'pr-new', invoiceIds: v.free }) },
          ]}
        />
      </Table.Td>
    </Table.Tr>
  ));

  // --- Per faktur ---------------------------------------------------------------------------
  const invoiceHead = [
    { label: 'No. Faktur' },
    { label: 'Vendor' },
    { label: 'Tanggal' },
    { label: 'Jatuh tempo' },
    { label: 'Umur' },
    { label: 'Total', align: 'right' },
    { label: 'Dibayar', align: 'right' },
    { label: 'Sisa', align: 'right' },
    { label: 'Pembayaran' },
    { label: '', w: 50 },
  ];
  const invoiceRows = filteredRows.map(({ inv, t, late }) => (
    <Table.Tr key={inv.id}>
      <Table.Td>
        <DocNumber onClick={() => go({ name: 'invoice', id: inv.id })}>{inv.number}</DocNumber>
        <Text fz={11} c="slate.6">{[isDpInvoice(inv) && 'Uang muka', inv.vendorNo].filter(Boolean).join(' · ') || '–'}</Text>
      </Table.Td>
      <Table.Td>
        <Anchor fz="sm" c="slate.9" fw={600} onClick={() => { setVendorId(inv.vendorId); setPage(1); }}>{vname(inv.vendorId)}</Anchor>
      </Table.Td>
      <Table.Td fz="sm" c="slate.8" style={{ whiteSpace: 'nowrap' }}>{formatDate(inv.date)}</Table.Td>
      <Table.Td fz="sm" c="slate.8" style={{ whiteSpace: 'nowrap' }}>{formatDate(inv.dueDate)}</Table.Td>
      <Table.Td><AgeBadge late={late} /></Table.Td>
      <Table.Td ta="right"><Amount value={t.total} /></Table.Td>
      <Table.Td ta="right"><Amount value={t.paid} /></Table.Td>
      <Table.Td ta="right"><Amount value={t.balance} strong late={late > 0} /></Table.Td>
      <Table.Td><PayState t={t} /></Table.Td>
      <Table.Td ta="center">
        <RowMenu
          label={inv.number}
          items={[
            { label: 'Lihat faktur', icon: Eye, onClick: () => go({ name: 'invoice', id: inv.id }) },
            canPr && t.free > 0 && { label: 'Ajukan pembayaran', icon: Money, onClick: () => go({ name: 'pr-new', invoiceIds: [inv.id] }) },
            inv.poId && { label: 'Lihat pesanan', icon: Package, onClick: () => go({ name: 'po', id: inv.poId }) },
          ]}
        />
      </Table.Td>
    </Table.Tr>
  ));

  // --- Retensi ------------------------------------------------------------------------------
  const retentionHead = [{ label: 'Pesanan' }, { label: 'Vendor' }, { label: 'Bisa dilepas' }, { label: 'Saldo retensi', align: 'right' }, { label: '', w: 50 }];
  const retentionRows = filteredRetensi.map(({ po, rt }) => {
    const bisa = daysLate(rt.maintenanceEnd) >= 0;
    return (
      <Table.Tr key={po.id}>
        <Table.Td>
          <DocNumber onClick={() => go({ name: 'po', id: po.id })}>{po.number}</DocNumber>
          <Text fz={11} c="slate.6">Retensi {rt.pct}%</Text>
        </Table.Td>
        <Table.Td fz="sm" c="slate.9">{vname(po.vendorId)}</Table.Td>
        <Table.Td>
          <Badge size="sm" radius="xl" variant="light" color={bisa ? 'green' : 'violet'} tt="none" fw={600}>
            {bisa ? 'Sudah bisa dilepas' : formatDate(rt.maintenanceEnd)}
          </Badge>
        </Table.Td>
        <Table.Td ta="right"><Amount value={rt.balance} strong /></Table.Td>
        <Table.Td ta="center"><RowMenu label={po.number} items={[{ label: 'Lihat pesanan', icon: Package, onClick: () => go({ name: 'po', id: po.id }) }]} /></Table.Td>
      </Table.Tr>
    );
  });

  const tabs = [
    { value: 'vendors', label: `Per Vendor (${new Set(rows.map((r) => r.vendorId)).size})`, icon: Storefront },
    { value: 'invoices', label: `Per Faktur (${rows.length})`, icon: Invoice },
    ...(retensi.length ? [{ value: 'retention', label: `Retensi (${retensi.length})`, icon: LockSimple }] : []),
  ];
  const view = {
    vendors: { head: vendorHead, rows: vendorRows, noun: 'vendor', minWidth: 1100 },
    invoices: { head: invoiceHead, rows: invoiceRows, noun: 'faktur', minWidth: 1280 },
    retention: { head: retentionHead, rows: retentionRows, noun: 'pesanan', minWidth: 720 },
  }[tab];

  return (
    <>
      <PageIntro
        icon={ChartBar}
        title="Hutang Usaha"
        description={`Sisa hutang ke vendor per ${formatDate(TODAY)}, dihitung dari faktur pembelian yang belum lunas. Ajukan pembayaran dan cocokkan dengan buku besar dari sini.`}
        actions={
          <Button variant="default" radius="md" leftSection={<DownloadSimple size={16} />} onClick={exportCsv} disabled={!rows.length}>
            Ekspor
          </Button>
        }
      />

      <StatCards items={stats} />

      {rows.length === 0 && retensi.length === 0 ? (
        <Card withBorder radius="lg" padding="lg" bg="white">
          <Quiet icon={CheckCircle} title="Tidak ada hutang berjalan" text="Semua faktur pembelian sudah lunas." />
        </Card>
      ) : (
        <>
          <Grid gutter="lg" align="stretch">
            <Grid.Col span={{ base: 12, lg: 7 }}>
              <AgingCard
                buckets={summary.buckets}
                total={summary.total || 1}
                active={age}
                onPick={(key) => setFilter(tab === 'retention' ? 'invoices' : tab, age === key ? 'all' : key)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 5 }}>
              <GlCard perFaktur={summary.total} ledger={ledger} />
            </Grid.Col>
          </Grid>

          <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
            <TabBar tabs={tabs} value={tab} onChange={(v) => { setTab(v); setPage(1); }} />
            <ListShell
              query={query}
              onQuery={(v) => { setQuery(v); setPage(1); }}
              placeholder={tab === 'retention' ? 'Cari nomor pesanan atau vendor...' : 'Cari nomor faktur, invoice vendor, atau vendor...'}
              filters={
                <>
                  <Select
                    size="sm"
                    radius="md"
                    w={220}
                    placeholder="Semua vendor"
                    aria-label="Saring vendor"
                    clearable
                    searchable
                    data={[...new Set([...rows.map((r) => r.vendorId), ...retensi.map((x) => x.po.vendorId)])].map((id) => ({ value: id, label: vname(id) }))}
                    value={vendorId}
                    onChange={(v) => { setVendorId(v); setPage(1); }}
                  />
                  {tab !== 'retention' && (
                    <Select
                      size="sm"
                      radius="md"
                      w={210}
                      allowDeselect={false}
                      aria-label="Saring umur hutang"
                      data={AGE_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
                      value={age}
                      onChange={(v) => { setAge(v); setPage(1); }}
                    />
                  )}
                </>
              }
              head={view.head}
              rows={view.rows}
              noun={view.noun}
              minWidth={view.minWidth}
              page={page}
              setPage={setPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
            />
          </Card>
        </>
      )}
    </>
  );
}
