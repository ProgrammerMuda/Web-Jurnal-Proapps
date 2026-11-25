// Detail satu akun: identitas akun, ringkasan saldo periode, dan jurnal transaksinya (buku besar
// akun) dengan saldo berjalan. Dibuka dari Daftar Akun atau dari nama akun di laporan keuangan
// lewat #daftar-akun/<kode>?from=…&to=… (periode laporan ikut terbawa).
//
// Angkanya dari jurnal otomatis yang sama dengan laporan (LaporanKeuangan/ledger.js), jadi saldo
// akhir di sini selalu sama dengan saldo akun itu di Neraca Saldo untuk periode yang sama.
// Akun induk menjumlah jurnal semua sub-akunnya, dan halamannya hanya mendaftar sub-akun beserta
// saldonya; jurnalnya baru tampil saat sub-akun dibuka.
import { Badge, Box, Button, Card, Group, Stack, Table, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import { BackLink } from '@/components/common.jsx';
import { ArrowsLeftRight, LockSimple, LockSimpleOpen, MagnifyingGlass, Newspaper, Notebook, Receipt, Shuffle } from '@/components/Icon.jsx';
import { EmptyState } from '@/pages/Pembelian/components.jsx';
import { useData } from '@/lib/store.jsx';
import { accountFamily, accountLedger, buildLedger } from '@/pages/LaporanKeuangan/ledger.js';
import DateField from '@/components/DateField.jsx';
import { TODAY } from '@/pages/Penjualan/data.js';
import { PRESETS, rangeText } from '@/pages/LaporanKeuangan/PeriodFilter.jsx';
import { AccountLink, accountHref, Amount, MutationTable, Stat } from '@/pages/LaporanKeuangan/StatementParts.jsx';
import { addDays, formatDate, rupiah } from '@/pages/Penjualan/utils.js';
import AccountActions from './AccountActions.jsx';
import { accounts } from './accounts.js';

// Tab khusus akun Kas & Bank. Selain Jurnal Transaksi, isinya belum dibuat di prototype.
const BANK_TABS = [
  { value: 'journal', label: 'Jurnal Transaksi', icon: Receipt },
  {
    value: 'statement',
    label: 'Rekening Koran',
    icon: Newspaper,
    empty: { title: 'Rekening koran belum diimpor', text: 'Mutasi dari rekening koran bank akan tampil di sini setelah diimpor, untuk dicocokkan dengan jurnal transaksi.' },
  },
  {
    value: 'reconcile',
    label: 'Rekonsiliasi Bank',
    icon: ArrowsLeftRight,
    empty: { title: 'Belum ada rekonsiliasi', text: 'Rekonsiliasi mencocokkan saldo jurnal akun ini dengan saldo rekening koran per tanggal, lalu mencatat selisihnya.' },
  },
  {
    value: 'mapping',
    label: 'Pemetaan Kas',
    icon: Shuffle,
    empty: { title: 'Belum ada pemetaan kas', text: 'Pemetaan kas mengelompokkan arus masuk dan keluar akun ini ke pos laporan arus kas (operasi, investasi, pendanaan).' },
  },
];

const signed = (n) => (Math.round(n) < 0 ? `(${rupiah(-n)})` : rupiah(n));
const goBack = () => {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = 'daftar-akun';
};

export default function AccountDetail({ code, initialRange }) {
  const data = useData();
  const ledger = useMemo(
    () => buildLedger(data),
    [data.sales, data.salesReturns, data.pb, data.stockMoves, data.products], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Rentang tanggal transaksi: dari tautan laporan bila ada, selain itu bulan ini. Isian kosong
  // memakai batas bulan ini; tanggal yang terbalik ditukar untuk hitungan.
  const [rawRange, setRawRange] = useState(initialRange ?? PRESETS[0].range);
  const filled = rawRange.map((d, i) => d || PRESETS[0].range[i]);
  const range = filled[0] > filled[1] ? [filled[1], filled[0]] : filled;
  const dateFilter = <DateRange value={rawRange} onChange={setRawRange} />;
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('journal');
  const acc = accounts.find((a) => a.code === code);
  const book = useMemo(() => accountLedger(ledger, code, range[0], range[1]), [ledger, code, range[0], range[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  // Sub-akun langsung, masing-masing dengan saldonya (termasuk sub-akunnya sendiri bila ada).
  const subs = useMemo(
    () => accounts.filter((a) => a.parent === code).map((a) => ({ acc: a, book: accountLedger(ledger, a.code, range[0], range[1]) })),
    [ledger, code, range[0], range[1]], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!acc) {
    return (
      <Stack gap="lg" p="lg" maw={1440} mx="auto" w="100%">
        <BackLink label="Kembali" onClick={goBack} />
        <Card withBorder radius="lg" padding="xl" bg="white">
          <Text fw={700} c="slate.9">Akun {code} tidak ditemukan</Text>
          <Text fz="sm" c="slate.6">Akun ini tidak ada di Daftar Akun. Mungkin sudah dihapus atau kodenya berubah.</Text>
        </Card>
      </Stack>
    );
  }

  // Pernah dijurnal, di tanggal mana pun (bukan hanya di rentang filter): penentu boleh dihapus.
  const family = new Set(accountFamily(code));
  const hasTx = ledger.some((e) => e.lines.some((l) => family.has(l.code)));
  // Akun kas & bank (bukan induk) punya tab tambahan untuk pekerjaan rekening bank.
  const isBank = acc.category === 'Kas & Bank';
  const parent = acc.parent ? accounts.find((a) => a.code === acc.parent) : null;
  const q = query.trim().toLowerCase();
  const rows = q
    ? book.rows.filter(({ entry: e, line: l }) => `#${e.no} jurnal transaksi ${e.ref} ${e.title} ${l.memo ?? ''} ${e.module}`.toLowerCase().includes(q))
    : book.rows;
  const normal = book.sign < 0 ? 'kredit' : 'debit';

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" w="100%">
      <BackLink label="Kembali" onClick={goBack} />
      {/* Kepala halaman: nama akun dengan sifat-sifatnya (saldo normal, terkunci, pajak, kontra)
          di sampingnya, lalu kode dan posisinya di bagan akun. */}
      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" align="flex-start" gap="md">
          <Group gap="md" wrap="nowrap" align="flex-start" style={{ minWidth: 0 }}>
            <ThemeIcon size={40} radius="md" color="primary.9"><Notebook size={22} /></ThemeIcon>
            <Box style={{ minWidth: 0 }}>
              <Group gap="xs" wrap="wrap">
                <Title order={3} fz="lg" c="slate.9">{acc.name}</Title>
                <Badge size="sm" radius="sm" variant="light" color={normal === 'debit' ? 'teal' : 'red'} tt="none">Saldo normal {normal}</Badge>
                <Badge
                  size="sm"
                  radius="sm"
                  variant="light"
                  color={acc.locked ? 'slate' : 'green'}
                  tt="none"
                  leftSection={acc.locked ? <LockSimple size={11} /> : <LockSimpleOpen size={11} />}
                >
                  {acc.locked ? 'Terkunci' : 'Terbuka'}
                </Badge>
                {acc.tax && <Badge size="sm" radius="sm" variant="light" color="blue" tt="none">Pajak {acc.tax}</Badge>}
                {acc.contra && <Badge size="sm" radius="sm" variant="light" color="orange" tt="none">Kontra</Badge>}
              </Group>
              <Text fz="xs" c="slate.6" mt={2}>
                <Text span fz="xs" fw={600} c="slate.8">{acc.code}</Text>
                {` · ${acc.category}`}
                {parent ? ` · Sub-akun dari ${parent.code} ${parent.name}` : ''}
                {book.family > 1 ? ` · Akun induk, menjumlah ${book.family - 1} sub-akun` : ''}
              </Text>
            </Box>
          </Group>
          <AccountActions acc={acc} hasTx={hasTx} hasChildren={subs.length > 0} />
        </Group>
      </Card>

      <Card withBorder radius="lg" padding={0} bg="white">
        <Box className="bs-stats">
          <Stat
            label="Saldo akhir"
            value={signed(book.closing)}
            negative={Math.round(book.closing) < 0}
            delta={`Per ${formatDate(range[1])}`}
          />
          <Stat
            label="Saldo awal"
            value={signed(book.opening)}
            negative={Math.round(book.opening) < 0}
            delta={`Per ${formatDate(addDays(range[0], -1))}`}
          />
          <Stat
            label="Mutasi debit"
            value={rupiah(book.debit)}
            delta={rangeText(range)}
          />
          <Stat
            label="Mutasi kredit"
            value={rupiah(book.credit)}
            delta={rangeText(range)}
          />
        </Box>
      </Card>

      {subs.length > 0
        ? <SubAccounts subs={subs} book={book} range={range} query={query} setQuery={setQuery} dateFilter={dateFilter} />
        : (
        <Card withBorder radius="lg" padding={0} bg="white">
          {isBank && (
            <Group gap={4} px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
              {BANK_TABS.map((t) => {
                const active = tab === t.value;
                return (
                  <Button
                    key={t.value}
                    size="sm"
                    radius="md"
                    variant={active ? 'filled' : 'subtle'}
                    color={active ? 'primary.9' : 'slate.7'}
                    leftSection={<t.icon size={16} />}
                    fw={active ? 700 : 500}
                    fz="xs"
                    onClick={() => setTab(t.value)}
                  >
                    {t.value === 'journal' ? `${t.label} (${book.count})` : t.label}
                  </Button>
                );
              })}
            </Group>
          )}
          {tab !== 'journal' ? (
            <EmptyState {...BANK_TABS.find((t) => t.value === tab).empty} icon={BANK_TABS.find((t) => t.value === tab).icon} />
          ) : (
          <>
          <Group justify="space-between" gap="sm" px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
            <Box>
              {!isBank && <Text fz="sm" fw={700} c="slate.9">Jurnal Transaksi</Text>}
              <Text fz="xs" c="slate.6">{book.count} jurnal · {rangeText(range)}</Text>
            </Box>
            <Group gap="sm" wrap="wrap" w={{ base: '100%', md: 'auto' }}>
              {dateFilter}
              <TextInput
                size="sm"
                radius="md"
                w={{ base: '100%', sm: 260 }}
                aria-label="Cari jurnal"
                placeholder="Cari no. jurnal, dokumen, atau catatan…"
                leftSection={<MagnifyingGlass size={14} />}
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
              />
            </Group>
          </Group>
          <Box p="lg">
            <MutationTable
              rows={rows}
              opening={{ label: `Saldo awal per ${formatDate(addDays(range[0], -1))}`, saldo: book.opening }}
              footer={q ? null : { label: `Saldo akhir per ${formatDate(range[1])}`, debit: book.debit, credit: book.credit, saldo: book.closing }}
              emptyText={q && book.rows.length ? `Tidak ada jurnal yang cocok dengan “${query}”.` : undefined}
            />
          </Box>
          </>
          )}
        </Card>
        )}
    </Stack>
  );
}

// Akun induk: daftar sub-akun dan saldonya pada periode filter. Nama sub-akun membuka detailnya
// (dengan periode yang sama), di sana baru jurnal transaksinya tampil. Angka sub-akun ditulis
// menurut saldo normal akun induk supaya jumlahnya sama dengan saldo induk; sub-akun kontra
// (mis. akumulasi penyusutan) karena itu tampil dalam kurung.
// Nol ditulis "—" supaya sub-akun yang tidak bergerak tidak penuh "Rp 0,00".
const Cell = ({ value, fw }) => (Math.round(value) ? <Amount value={value} fw={fw} /> : <Text fz="sm" c="slate.4" ta="right">—</Text>);

const openAccount = (href) => {
  window.location.assign(href);
  window.scrollTo({ top: 0 });
};

function SubAccounts({ subs, book, range, query, setQuery, dateFilter }) {
  const q = query.trim().toLowerCase();
  const conv = (b, n) => n * b.sign * book.sign;
  const rows = subs
    .map(({ acc, book: b }) => ({ acc, opening: conv(b, b.opening), debit: b.debit, credit: b.credit, closing: conv(b, b.closing), count: b.count }))
    .filter((r) => !q || `${r.acc.code} ${r.acc.name}`.toLowerCase().includes(q));
  // Jurnal yang dicatat langsung ke akun induk (bukan ke sub-akunnya), bila ada.
  const sum = (k) => subs.reduce((n, { book: b }) => n + (k === 'debit' || k === 'credit' ? b[k] : conv(b, b[k])), 0);
  const direct = { opening: book.opening - sum('opening'), debit: book.debit - sum('debit'), credit: book.credit - sum('credit'), closing: book.closing - sum('closing') };
  const hasDirect = Object.values(direct).some((n) => Math.round(n) !== 0);
  const open = (code) => openAccount(accountHref(code, range));
  const head = ['KODE', 'NAMA AKUN', 'SALDO AWAL', 'DEBIT', 'KREDIT', 'SALDO AKHIR'];

  return (
    <Card withBorder radius="lg" padding={0} bg="white">
      <Group justify="space-between" gap="sm" px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <Box>
          <Text fz="sm" fw={700} c="slate.9">Sub-akun</Text>
          <Text fz="xs" c="slate.6">{subs.length} sub-akun · {rangeText(range)} · klik nama akun untuk melihat jurnalnya</Text>
        </Box>
        <Group gap="sm" wrap="wrap" w={{ base: '100%', md: 'auto' }}>
          {dateFilter}
          <TextInput
            size="sm"
            radius="md"
            w={{ base: '100%', sm: 260 }}
            aria-label="Cari sub-akun"
            placeholder="Cari kode atau nama sub-akun…"
            leftSection={<MagnifyingGlass size={14} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </Group>
      </Group>
      <Box p="lg">
        <Box className="table-frame" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)', overflow: 'auto' }}>
          <Table verticalSpacing="sm" horizontalSpacing="md" miw={1000} highlightOnHover>
            <Table.Thead bg="slate.0">
              <Table.Tr>
                {head.map((h, i) => <Table.Th key={h} fz="xs" c="slate.7" ta={i >= 2 ? 'right' : undefined} w={i === 0 ? 100 : i >= 2 ? 160 : undefined} miw={i === 1 ? 240 : undefined}>{h}</Table.Th>)}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r) => (
                <Table.Tr key={r.acc.code} onClick={() => open(r.acc.code)} style={{ cursor: 'pointer' }}>
                  <Table.Td><Text fz="xs" c="slate.6" style={{ fontVariantNumeric: 'tabular-nums' }}>{r.acc.code}</Text></Table.Td>
                  <Table.Td>
                    <Box tt="capitalize"><AccountLink code={r.acc.code} range={range}>{r.acc.name}</AccountLink></Box>
                    <Text fz={11} c="slate.6">{r.count ? `${r.count} jurnal` : 'Tidak ada jurnal di periode ini'}</Text>
                  </Table.Td>
                  <Table.Td><Cell value={r.opening} /></Table.Td>
                  <Table.Td><Cell value={r.debit} /></Table.Td>
                  <Table.Td><Cell value={r.credit} /></Table.Td>
                  <Table.Td><Cell value={r.closing} fw={700} /></Table.Td>
                </Table.Tr>
              ))}
              {!q && hasDirect && (
                <Table.Tr>
                  <Table.Td><Text fz="xs" c="slate.6">—</Text></Table.Td>
                  <Table.Td><Text fz="sm" c="slate.8">Dicatat langsung ke akun induk</Text></Table.Td>
                  <Table.Td><Cell value={direct.opening} /></Table.Td>
                  <Table.Td><Cell value={direct.debit} /></Table.Td>
                  <Table.Td><Cell value={direct.credit} /></Table.Td>
                  <Table.Td><Cell value={direct.closing} fw={700} /></Table.Td>
                </Table.Tr>
              )}
              {!q && (
                <Table.Tr bg="slate.0">
                  <Table.Td colSpan={2}><Text fz="sm" fw={700} c="slate.9">Total akun induk</Text></Table.Td>
                  <Table.Td><Amount value={book.opening} fw={700} /></Table.Td>
                  <Table.Td><Amount value={book.debit} fw={700} /></Table.Td>
                  <Table.Td><Amount value={book.credit} fw={700} /></Table.Td>
                  <Table.Td><Amount value={book.closing} fw={700} /></Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
          {!rows.length && <Text fz="xs" c="slate.6" ta="center" py="md">Tidak ada sub-akun yang cocok dengan “{query}”.</Text>}
        </Box>
      </Box>
    </Card>
  );
}

// Filter tanggal transaksi di kepala kartu: dari tanggal s.d. tanggal.
function DateRange({ value, onChange }) {
  const bad = !!(value[0] && value[1] && value[0] > value[1]);
  return (
    <Box w={{ base: '100%', sm: 'auto' }}>
      <Group gap={6} wrap="nowrap">
        <DateField
          size="sm"
          radius="md"
          w={{ base: '100%', sm: 160 }}
          aria-label="Tanggal transaksi: dari"
          value={value[0] ?? ''}
          max={TODAY}
          error={bad}
          onChange={(e) => onChange([e.currentTarget.value, value[1]])}
        />
        <Text fz="xs" c="slate.6">s.d.</Text>
        <DateField
          size="sm"
          radius="md"
          w={{ base: '100%', sm: 160 }}
          aria-label="Tanggal transaksi: sampai"
          value={value[1] ?? ''}
          max={TODAY}
          error={bad}
          onChange={(e) => onChange([value[0], e.currentTarget.value])}
        />
      </Group>
      {bad && <Text fz={11} c="red.8" mt={4}>Tanggal mulai setelah tanggal akhir; urutannya dibalik.</Text>}
    </Box>
  );
}
