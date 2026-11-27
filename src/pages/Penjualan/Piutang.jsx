// Piutang Usaha: meja kerja penagihan. Angkanya diturunkan dari faktur (receivables.js),
// aksi faktur memakai alur yang sama dengan halaman Faktur (saleActions.jsx), dan kartu
// "Cocok dengan buku besar" membandingkannya dengan saldo akun piutang di jurnal.
import { useMemo, useState } from 'react';
import { Anchor, Badge, Box, Button, Card, Grid, Group, Progress, Select, Stack, Table, Text, UnstyledButton } from '@mantine/core';
import {
  ChartBar,
  CaretRight,
  CheckCircle,
  Clock,
  DownloadSimple,
  EnvelopeSimple,
  Eye,
  Invoice,
  Link,
  Notebook,
  User,
  Wallet,
  Warning,
} from '@/components/Icon.jsx';
import StatCards from '@/components/StatCards.jsx';
import { Quiet } from '@/components/overview.jsx';
import rowClasses from '@/components/overview.module.css';
import { useData } from '@/lib/store.jsx';
import { downloadCsv, toCustomer } from '@/pages/Kontak/utils.js';
import { accountHref } from '@/pages/LaporanKeuangan/StatementParts.jsx';
import { Callout, DocNumber, ListShell, RowMenu, TabBar } from '@/pages/Pembelian/components.jsx';
import CustomerReceivableDrawer, { AgeBadge } from './CustomerReceivableDrawer.jsx';
import { PageIntro } from './components.jsx';
import { TODAY } from './data.js';
import { customerReminderNote, JournalModal, SendModal } from './Dialogs.jsx';
import PaymentModal from './PaymentModal.jsx';
import {
  AGE_FILTERS,
  BUCKETS,
  byCustomer,
  creditTotal,
  glCheck,
  openSales,
  RECEIVABLE_ACCOUNTS,
  receivableSummary,
  upcomingOrders,
} from './receivables.js';
import { customerCredit } from './returns.js';
import { formatHash } from './routes.js';
import { toast, useSaleActions } from './saleActions.jsx';
import { canPay, formatDate, formatDateTime, lastSend, lateFeePolicy, lateFeeQuote, rupiah, rupiahShort } from './utils.js';

const go = (v) => {
  window.location.hash = formatHash(v);
  window.scrollTo({ top: 0 });
};
const tabular = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

// Sel nominal: nol ditulis "–", nilai yang sudah lewat jatuh tempo diberi merah.
function Amount({ value, late = false, strong = false }) {
  if (!value) return <Text fz="sm" c="slate.4" style={tabular}>–</Text>;
  return (
    <Text fz="sm" fw={strong ? 700 : 500} c={late ? 'red.8' : 'slate.9'} style={tabular}>
      {rupiah(value)}
    </Text>
  );
}

// Kartu bersama: judul dan keterangan di kiri, aksi di kanan judul (di atas datanya).
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

// Umur piutang: satu bar bersegmen lalu lima baris kelompok. Total sudah ada di kartu atas,
// jadi kartu ini hanya menjawab "seberapa lama". Baris yang berisi bisa diklik untuk menyaring.
function AgingCard({ buckets, total, active, onPick }) {
  return (
    <Card withBorder radius="lg" padding="lg" bg="white" h="100%">
      <CardHead
        title="Umur piutang"
        text="Sisa tagihan menurut lama lewat jatuh tempo"
        right={
          active !== 'all' && BUCKETS.some((b) => b.key === active) && (
            <Button variant="default" size="compact-sm" radius="xl" onClick={() => onPick(active)}>
              Hapus saringan
            </Button>
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
              style={{
                display: 'flex',
                alignItems: 'center',
                borderRadius: 'var(--mantine-radius-md)',
                background: dipilih ? 'var(--mantine-color-gray-1)' : undefined,
                cursor: kosong ? 'default' : 'pointer',
              }}
            >
              <Group gap="sm" wrap="nowrap" w="100%">
                <Box w={8} h={8} style={{ borderRadius: 4, flexShrink: 0, background: `var(--mantine-color-${b.color.replace('.', '-')})`, opacity: kosong ? 0.35 : 1 }} />
                <Text fz="sm" c={kosong ? 'slate.5' : 'slate.9'} style={{ flex: 1 }}>{b.label}</Text>
                <Text fz="xs" c="slate.6" w={64} ta="right">{kosong ? '' : `${b.count} faktur`}</Text>
                <Text fz="sm" fw={500} c={kosong ? 'slate.4' : 'slate.9'} w={150} ta="right" style={tabular}>
                  {kosong ? '–' : rupiah(b.value)}
                </Text>
                <Text fz="xs" c="slate.6" w={40} ta="right" style={tabular}>
                  {kosong ? '' : `${Math.round((b.value / total) * 100)}%`}
                </Text>
              </Group>
            </UnstyledButton>
          );
        })}
      </Stack>
    </Card>
  );
}

// Cek buku besar: satu angka (piutang per hari ini) dengan status di sampingnya, lalu
// rinciannya. Baris selisih hanya muncul bila memang ada selisih.
function GlCard({ check }) {
  const cocok = check.diff === 0;
  const row = (label, value, opts = {}) => (
    <Group justify="space-between" wrap="nowrap" h={32}>
      <Text fz="sm" c={opts.tone ?? 'slate.6'} truncate title={label}>{label}</Text>
      <Text fz="sm" fw={500} c={opts.tone ?? 'slate.9'} style={tabular}>{value}</Text>
    </Group>
  );
  return (
    <Card withBorder radius="lg" padding="lg" bg="white" h="100%">
      <CardHead
        title="Cocok dengan buku besar"
        text={`Per ${formatDate(TODAY)}`}
        right={
          <Button
            component="a"
            href={accountHref('1-10100')}
            variant="default"
            size="compact-sm"
            radius="xl"
            rightSection={<CaretRight size={12} />}
          >
            Buku besar
          </Button>
        }
      />
      <Group gap="sm" mt="lg" align="center" wrap="nowrap">
        <Text fz={24} fw={600} lh="32px" c="slate.9" style={{ ...tabular, letterSpacing: '-0.01em' }}>
          {rupiah(check.perTanggal)}
        </Text>
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
      <Text fz="sm" c="slate.6">Piutang per hari ini dari faktur</Text>
      <Box mt="md" pt="xs" style={{ borderTop: '0.5px solid var(--mantine-color-gray-3)' }}>
        {row('Total per faktur', rupiah(check.perFaktur))}
        {check.future.count > 0 &&
          row(
            `Transaksi ke depan (${check.future.count} faktur)`,
            `${check.future.value >= 0 ? '−' : '+'} ${rupiah(Math.abs(check.future.value))}`,
          )}
        {row(`Saldo buku besar (${RECEIVABLE_ACCOUNTS.length} akun)`, rupiah(check.ledger))}
        {!cocok && row('Selisih', rupiah(check.diff), { tone: 'red.8' })}
      </Box>
      {!cocok && (
        <Box mt="sm">
          <Callout tone="stop" title="Angka piutang tidak sama dengan buku besar">
            Periksa jurnal akun piutang untuk menemukan transaksi yang belum tercatat atau tercatat ganda.
          </Callout>
        </Box>
      )}
    </Card>
  );
}

export default function Piutang({ onNavigate }) {
  const data = useData();
  const { sales, orders, salesReturns, contactsById } = data;
  const { recordPayment, recordSend, copyLink } = useSaleActions();
  const nameOf = (id) => toCustomer(contactsById[id])?.name ?? 'Pelanggan';

  const rows = useMemo(() => openSales(sales), [sales]);
  const summary = useMemo(() => receivableSummary(rows), [rows]);
  const customers = useMemo(() => byCustomer(rows, salesReturns), [rows, salesReturns]);
  const credit = useMemo(
    () => creditTotal(salesReturns, [...new Set(salesReturns.map((r) => r.customerId))]),
    [salesReturns],
  );
  const check = useMemo(
    () => glCheck(data, rows),
    [data.sales, data.salesReturns, data.pb, data.stockMoves, data.products, rows], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [tab, setTab] = useState('customers');
  const [age, setAge] = useState('all');
  const [customerId, setCustomerId] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');
  const [drawerId, setDrawerId] = useState(null);
  // Urutan tab Per Pelanggan: 'total' (bawaan) atau 'credit' (dari kartu Kredit Pelanggan).
  const [sortBy, setSortBy] = useState('total');
  // Satu dialog aktif: { type: 'pay' | 'remind' | 'journal', id }.
  const [dialog, setDialog] = useState(null);

  const ageMatch = AGE_FILTERS.find((f) => f.value === age).match;
  const q = query.trim().toLowerCase();
  const filteredRows = rows
    .filter((r) => ageMatch(r) && (!customerId || r.customerId === customerId))
    .filter((r) => !q || [r.sale.number, r.sale.ref, nameOf(r.customerId)].some((v) => v?.toLowerCase().includes(q)))
    .sort((a, b) => b.late - a.late || b.balance - a.balance);
  const filteredCustomers = byCustomer(filteredRows, salesReturns).sort((a, b) =>
    sortBy === 'credit' ? b.credit - a.credit || b.total - a.total : 0,
  );

  const setFilter = (nextTab, nextAge, nextSort = 'total') => {
    setTab(nextTab);
    setAge(nextAge);
    setSortBy(nextSort);
    setPage(1);
  };

  // --- aksi faktur ---------------------------------------------------------------
  const invoiceActions = {
    open: (sale) => go({ name: 'invoice', id: sale.id }),
    items: (r) => [
      { label: 'Lihat faktur', icon: Eye, onClick: () => go({ name: 'invoice', id: r.sale.id }) },
      canPay(r.sale) && { label: 'Terima pembayaran', icon: Wallet, onClick: () => setDialog({ type: 'pay', id: r.sale.id }) },
      { label: 'Kirim pengingat', icon: EnvelopeSimple, onClick: () => setDialog({ type: 'remind', id: r.sale.id }) },
      { label: 'Salin tautan pembayaran', icon: Link, onClick: () => copyLink(r.sale.id) },
      lateFeeQuote(r.sale, sales, lateFeePolicy(contactsById[r.sale.customerId])).amount > 0 && { label: 'Buat faktur denda', icon: Warning, onClick: () => go({ name: 'sale-new', from: `late:${r.sale.id}` }) },
      { label: 'Lihat jurnal', icon: Notebook, onClick: () => setDialog({ type: 'journal', id: r.sale.id }) },
    ],
  };

  const exportCsv = () =>
    downloadCsv(`piutang-usaha-${TODAY}.csv`, [
      ['No. Faktur', 'Pelanggan', 'Tanggal', 'Jatuh tempo', 'Hari terlambat', 'Kelompok umur', 'Total', 'Dibayar', 'Sisa'],
      ...filteredRows.map((r) => [
        r.sale.number,
        nameOf(r.customerId),
        r.sale.date,
        r.sale.dueDate,
        Math.max(r.late, 0),
        BUCKETS.find((b) => b.key === r.bucket).label,
        r.total,
        r.paid,
        r.balance,
      ]),
    ]);

  const stats = [
    {
      label: 'Total Piutang',
      value: rupiahShort(summary.total),
      hint: `${summary.count} faktur · ${summary.customers} pelanggan`,
      icon: ChartBar,
      onClick: () => setFilter('invoices', 'all'),
      active: tab === 'invoices' && age === 'all' && !customerId,
    },
    {
      label: 'Lewat Jatuh Tempo',
      value: rupiahShort(summary.late.value),
      hint: summary.late.count ? `${summary.late.count} faktur · terlama ${summary.late.oldest} hari` : 'Tidak ada tunggakan',
      icon: Warning,
      onClick: () => setFilter('invoices', 'overdue'),
      active: age === 'overdue',
    },
    {
      label: 'Jatuh Tempo 7 Hari',
      value: rupiahShort(summary.soon.value),
      hint: summary.soon.count ? `${summary.soon.count} faktur perlu disiapkan` : 'Tidak ada minggu ini',
      icon: Clock,
      onClick: () => setFilter('invoices', 'soon'),
      active: age === 'soon',
    },
    {
      label: 'Kredit Pelanggan',
      value: rupiahShort(credit),
      hint: 'Akun 2-30008, tidak mengurangi piutang',
      icon: User,
      onClick: () => setFilter('customers', 'all', 'credit'),
      active: tab === 'customers' && sortBy === 'credit',
    },
  ];

  const customerHead = [
    { label: 'Pelanggan' },
    { label: 'Faktur', align: 'right' },
    ...BUCKETS.map((b) => ({ label: b.short, align: 'right' })),
    { label: 'Total', align: 'right' },
    { label: 'Kredit', align: 'right' },
    { label: '', w: 50 },
  ];
  const customerRows = filteredCustomers.map((c) => (
    <Table.Tr key={c.customerId}>
      <Table.Td>
        <DocNumber onClick={() => setDrawerId(c.customerId)}>{nameOf(c.customerId)}</DocNumber>
        {c.lateCount > 0 && <Text fz={11} c="red.7">{c.lateCount} faktur terlambat · terlama {c.oldest} hari</Text>}
      </Table.Td>
      <Table.Td ta="right"><Text fz="sm" c="slate.8">{c.count}</Text></Table.Td>
      {BUCKETS.map((b) => (
        <Table.Td key={b.key} ta="right"><Amount value={c.buckets[b.key]} late={b.key !== 'current'} /></Table.Td>
      ))}
      <Table.Td ta="right"><Amount value={c.total} strong /></Table.Td>
      <Table.Td ta="right"><Amount value={c.credit} /></Table.Td>
      <Table.Td ta="center">
        <RowMenu
          label={nameOf(c.customerId)}
          items={[
            { label: 'Lihat rincian', icon: Eye, onClick: () => setDrawerId(c.customerId) },
            c.lateCount > 0 && {
              label: `Kirim pengingat (${c.lateCount} faktur terlambat)`,
              icon: EnvelopeSimple,
              onClick: () => setDialog({ type: 'remind-customer', id: c.customerId }),
            },
            onNavigate && { label: 'Buka kontak', icon: User, onClick: () => onNavigate('kontak', { contactId: c.customerId }) },
          ]}
        />
      </Table.Td>
    </Table.Tr>
  ));

  const invoiceHead = [
    { label: 'No. Faktur' },
    { label: 'Pelanggan' },
    { label: 'Tanggal' },
    { label: 'Jatuh tempo' },
    { label: 'Umur' },
    { label: 'Total', align: 'right' },
    { label: 'Dibayar', align: 'right' },
    { label: 'Sisa', align: 'right' },
    { label: 'Terakhir dikirim' },
    { label: '', w: 50 },
  ];
  const invoiceRows = filteredRows.map((r) => {
    const kirim = lastSend(r.sale);
    return (
      <Table.Tr key={r.id}>
        <Table.Td>
          <DocNumber onClick={() => invoiceActions.open(r.sale)}>{r.sale.number}</DocNumber>
          {r.future && <Text fz={11} c="slate.6">Bertanggal setelah hari ini</Text>}
        </Table.Td>
        <Table.Td>
          <Anchor fz="sm" c="slate.9" fw={600} onClick={() => setDrawerId(r.customerId)}>{nameOf(r.customerId)}</Anchor>
        </Table.Td>
        <Table.Td fz="sm" c="slate.8" style={{ whiteSpace: 'nowrap' }}>{formatDate(r.sale.date)}</Table.Td>
        <Table.Td fz="sm" c="slate.8" style={{ whiteSpace: 'nowrap' }}>{formatDate(r.sale.dueDate)}</Table.Td>
        <Table.Td><AgeBadge late={r.late} /></Table.Td>
        <Table.Td ta="right"><Amount value={r.total} /></Table.Td>
        <Table.Td ta="right"><Amount value={r.paid} /></Table.Td>
        <Table.Td ta="right"><Amount value={r.balance} strong late={r.late > 0} /></Table.Td>
        <Table.Td>
          {kirim ? (
            <>
              <Text fz="xs" c="slate.8" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(kirim.at)}</Text>
              <Text fz={11} c="slate.6">{kirim.kind === 'reminder' ? 'Pengingat' : 'Faktur'}</Text>
            </>
          ) : (
            <Text fz="xs" c="orange.8">Belum pernah</Text>
          )}
        </Table.Td>
        <Table.Td ta="center"><RowMenu label={r.sale.number} items={invoiceActions.items(r)} /></Table.Td>
      </Table.Tr>
    );
  });

  const tabs = [
    { value: 'customers', label: `Per Pelanggan (${customers.length})`, icon: User },
    { value: 'invoices', label: `Per Faktur (${rows.length})`, icon: Invoice },
  ];

  const dialogSale = dialog && sales.find((s) => s.id === dialog.id);
  // Pengingat per pelanggan: semua faktur terlambatnya, yang terlama lebih dulu.
  const lateSales =
    dialog?.type === 'remind-customer'
      ? rows.filter((r) => r.customerId === dialog.id && r.late > 0).sort((a, b) => b.late - a.late).map((r) => r.sale)
      : [];
  const drawerGroup = drawerId && customers.find((c) => c.customerId === drawerId);

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro
        icon={ChartBar}
        title="Piutang Usaha"
        description={`Sisa tagihan pelanggan per ${formatDate(TODAY)}, dihitung dari faktur yang belum lunas. Tagih, catat pembayaran, dan cocokkan dengan buku besar dari sini.`}
        actions={
          <Button variant="default" radius="md" leftSection={<DownloadSimple size={16} />} onClick={exportCsv} disabled={!rows.length}>
            Ekspor
          </Button>
        }
      />

      <StatCards items={stats} />

      {rows.length === 0 ? (
        <Card withBorder radius="lg" padding="lg" bg="white">
          <Quiet icon={CheckCircle} title="Tidak ada piutang berjalan" text="Semua faktur terbit sudah lunas." />
        </Card>
      ) : (
        <>
          <Grid gutter="lg" align="stretch">
            <Grid.Col span={{ base: 12, lg: 7 }}>
              <AgingCard
                buckets={summary.buckets}
                total={summary.total}
                active={age}
                onPick={(key) => setFilter(tab, age === key ? 'all' : key, sortBy)}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, lg: 5 }}>
              <GlCard check={check} />
            </Grid.Col>
          </Grid>

          <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
            <TabBar
              tabs={tabs}
              value={tab}
              onChange={(v) => {
                setTab(v);
                setPage(1);
              }}
            />
            <ListShell
              query={query}
              onQuery={(v) => {
                setQuery(v);
                setPage(1);
              }}
              placeholder="Cari nomor faktur, referensi, atau pelanggan..."
              filters={
                <>
                  <Select
                    size="sm"
                    radius="md"
                    w={220}
                    placeholder="Semua pelanggan"
                    aria-label="Saring pelanggan"
                    clearable
                    searchable
                    data={customers.map((c) => ({ value: c.customerId, label: nameOf(c.customerId) }))}
                    value={customerId}
                    onChange={(v) => {
                      setCustomerId(v);
                      setPage(1);
                    }}
                  />
                  <Select
                    size="sm"
                    radius="md"
                    w={210}
                    allowDeselect={false}
                    aria-label="Saring umur piutang"
                    data={AGE_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
                    value={age}
                    onChange={(v) => {
                      setAge(v);
                      setPage(1);
                    }}
                  />
                </>
              }
              head={tab === 'customers' ? customerHead : invoiceHead}
              rows={tab === 'customers' ? customerRows : invoiceRows}
              noun={tab === 'customers' ? 'pelanggan' : 'faktur'}
              minWidth={tab === 'customers' ? 1100 : 1280}
              page={page}
              setPage={setPage}
              pageSize={pageSize}
              setPageSize={setPageSize}
            />
          </Card>
        </>
      )}

      <CustomerReceivableDrawer
        customer={drawerGroup ? toCustomer(contactsById[drawerGroup.customerId]) : null}
        group={drawerGroup}
        sales={sales}
        upcoming={drawerGroup ? upcomingOrders(orders, drawerGroup.customerId) : { count: 0, value: 0 }}
        onClose={() => setDrawerId(null)}
        onOpenContact={() => onNavigate?.('kontak', { contactId: drawerId })}
        onOpenOrders={() => go({ name: 'tab', tab: 'orders' })}
        onOpenPayments={() => go({ name: 'tab', tab: 'payments' })}
        invoiceActions={invoiceActions}
      />

      {dialogSale && dialog.type === 'remind' && (
        <SendModal
          key={dialogSale.id}
          sale={dialogSale}
          resend
          reminder
          onClose={() => setDialog(null)}
          onSend={(d) => {
            recordSend(dialogSale, d, 'reminder');
            setDialog(null);
          }}
        />
      )}
      {lateSales.length > 0 && (
        <SendModal
          key={`c-${dialog.id}`}
          sale={lateSales[0]}
          resend
          reminder
          initialNote={customerReminderNote(lateSales)}
          onClose={() => setDialog(null)}
          onSend={(d) => {
            lateSales.forEach((s) => recordSend(s, d, 'reminder', { quiet: true }));
            toast('Pengingat terkirim', `${lateSales.length} faktur ${nameOf(dialog.id)} dikirim ke ${d.to}.`);
            setDialog(null);
          }}
        />
      )}
      {dialogSale && dialog.type === 'journal' && (
        <JournalModal sale={dialogSale} onClose={() => setDialog(null)} />
      )}
      <PaymentModal
        sale={dialog?.type === 'pay' ? dialogSale : null}
        credit={dialog?.type === 'pay' && dialogSale ? customerCredit(salesReturns, dialogSale.customerId) : 0}
        onClose={() => setDialog(null)}
        onSave={(payment) => {
          recordPayment(dialogSale, payment);
          setDialog(null);
        }}
      />
    </Stack>
  );
}
