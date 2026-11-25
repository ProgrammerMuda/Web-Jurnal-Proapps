import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Checkbox,
  Group,
  Menu,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { AccountLink } from '@/pages/LaporanKeuangan/StatementParts.jsx';
import { useData } from '@/lib/store.jsx';
import { accountBalances, buildLedger } from '@/pages/LaporanKeuangan/ledger.js';
import { TODAY } from '@/pages/Penjualan/data.js';
import AccountDetail from './AccountDetail.jsx';
import JournalDetail from './JournalDetail.jsx';
import {
  ArrowsClockwise,
  Bank,
  CaretDown,
  ClipboardText,
  DotsThreeVertical,
  Gear,
  Key,
  ListBullets,
  Lock,
  LockSimple,
  LockSimpleOpen,
  MagnifyingGlass,
  Plus,
  SquaresFour,
} from '@/components/Icon.jsx';
import { accountCategories, accounts } from './accounts.js';

// Format saldo seperti aslinya: Rp 1.234,00 dan negatif dalam kurung.
const money = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
// Dibulatkan ke sen dan -0 dijadikan 0, supaya sisa pembulatan tidak tampil sebagai "Rp -0,00".
const toCents = (n) => Math.round((n ?? 0) * 100) / 100 || 0;
const formatBalance = (n) => {
  const v = toCents(n);
  return v < 0 ? `(Rp ${money.format(-v)})` : `Rp ${money.format(v)}`;
};

const childrenOf = accounts.reduce((map, a) => {
  if (a.parent) (map[a.parent] ||= []).push(a);
  return map;
}, {});
const roots = accounts.filter((a) => !a.parent);

const stats = [
  {
    label: 'Total Akun COA',
    value: accounts.length,
    hint: 'Akun induk & sub-akun terdaftar',
    icon: ListBullets,
  },
  {
    label: 'Kas & Setara Kas',
    value: accounts.filter((a) => a.bankCash).length,
    hint: 'Akun kas, bank, & e-wallet',
    icon: Bank,
  },
  {
    label: 'Kategori Aktif',
    value: new Set(accounts.map((a) => a.category)).size,
    hint: 'Klasifikasi pos keuangan COA',
    icon: SquaresFour,
  },
  {
    label: 'Akun Terkunci',
    value: accounts.filter((a) => a.locked).length,
    hint: 'Proteksi periode tutup buku',
    icon: Lock,
  },
];

const tabs = [
  { value: 'all', label: 'Semua Akun', icon: ListBullets, match: () => true },
  { value: 'bank', label: 'Kas & Bank', icon: Bank, match: (a) => a.bankCash },
  { value: 'locked', label: 'Akun Terkunci', icon: LockSimple, match: (a) => a.locked },
];

function PageIntro() {
  return (
    <Card withBorder radius="lg" padding="lg" bg="white">
      <Group justify="space-between" align="flex-start" gap="md">
        <Group gap="md" wrap="nowrap" align="flex-start">
          <ThemeIcon size={40} radius="md" color="primary.9">
            <ClipboardText size={22} />
          </ThemeIcon>
          <Box>
            <Title order={3} fz="lg" c="slate.9">
              Daftar Akun
            </Title>
            <Text fz="xs" c="slate.6" maw={560}>
              Kelola seluruh bagan akun standar, hierarki akun induk dan sub-akun, klasifikasi
              kategori posisi saldo, serta kontrol penguncian buku besar akuntansi.
            </Text>
          </Box>
        </Group>
        <Group gap="xs">
          <ActionIcon variant="default" size="lg" radius="md" aria-label="Segarkan data akun">
            <ArrowsClockwise size={16} />
          </ActionIcon>
          <Menu position="bottom-end" withinPortal shadow="md" width={240}>
            <Menu.Target>
              <Button
                variant="default"
                radius="md"
                leftSection={<DotsThreeVertical size={16} />}
                rightSection={<CaretDown size={12} />}
              >
                Aksi Lainnya
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Transaksi & Impor</Menu.Label>
              <Menu.Item leftSection={<Plus size={14} />}>Tambah Transaksi Jurnal</Menu.Item>
              <Menu.Divider />
              <Menu.Label>Konfigurasi Buku Besar</Menu.Label>
              <Menu.Item leftSection={<Gear size={14} />}>Atur Akun Standar</Menu.Item>
              <Menu.Item leftSection={<ClipboardText size={14} />}>
                Saldo Awal (Beginning Balance)
              </Menu.Item>
              <Menu.Item leftSection={<Key size={14} />}>Kunci Periode & Tutup Buku</Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Button radius="md" leftSection={<Plus size={16} />}>
            Tambah Akun
          </Button>
        </Group>
      </Group>
    </Card>
  );
}

function StatCard({ stat }) {
  const Icon = stat.icon;
  return (
    <Card withBorder radius="md" padding="md" bg="white">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text fz={11} fw={600} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }}>
            {stat.label}
          </Text>
          <Text fz={22} fw={700} c="slate.9" lh={1.3}>
            {stat.value}
          </Text>
          <Text fz={11} c="slate.6">
            {stat.hint}
          </Text>
        </Box>
        <ThemeIcon variant="light" bg="secondary.0" c="secondary.7" size={36} radius="md">
          <Icon size={18} />
        </ThemeIcon>
      </Group>
    </Card>
  );
}

function AccountRow({ account, balance, depth, expandable, expanded, onToggle, selected, onSelect }) {
  const isSub = depth > 0;
  return (
    <Table.Tr bg={expanded ? 'slate.0' : undefined}>
      <Table.Td w={44}>
        <Checkbox
          size="xs"
          radius="sm"
          checked={selected}
          disabled={account.locked}
          onChange={onSelect}
          aria-label={`Pilih ${account.code}`}
        />
      </Table.Td>
      <Table.Td>
        <Group justify="space-between" wrap="nowrap" pl={isSub ? 'sm' : 0} gap="xs">
          <Text fz="sm" fw={isSub ? 500 : 700} c="slate.9" ff="monospace">
            {account.code}
          </Text>
          {expandable && (
            <ActionIcon
              variant="subtle"
              color="slate"
              size="sm"
              onClick={onToggle}
              aria-label={expanded ? 'Tutup sub-akun' : 'Buka sub-akun'}
              aria-expanded={expanded}
            >
              <CaretDown
                size={14}
                style={{
                  transform: expanded ? undefined : 'rotate(-90deg)',
                  transition: 'transform 150ms',
                }}
              />
            </ActionIcon>
          )}
        </Group>
      </Table.Td>
      <Table.Td>
        {account.locked ? (
          <Badge
            size="sm"
            radius="sm"
            variant="light"
            color="slate"
            tt="none"
            fw={500}
            leftSection={<LockSimple size={11} />}
          >
            Terkunci
          </Badge>
        ) : (
          <Badge
            size="sm"
            radius="sm"
            variant="light"
            color="green"
            tt="none"
            fw={500}
            leftSection={<LockSimpleOpen size={11} />}
          >
            Terbuka
          </Badge>
        )}
      </Table.Td>
      <Table.Td>
        <Box pl={isSub ? 'sm' : 0} tt="capitalize">
          <AccountLink code={account.code}>{account.name}</AccountLink>
        </Box>
      </Table.Td>
      <Table.Td>
        <Text fz="sm" c="slate.8">
          {account.category}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge
          size="xs"
          radius="sm"
          variant="light"
          color={account.normal === 'debit' ? 'teal' : 'red'}
        >
          {account.normal}
        </Badge>
      </Table.Td>
      <Table.Td>
        {account.allUsers && (
          <Badge size="sm" radius="sm" color="blue" tt="none" fw={500}>
            All Users
          </Badge>
        )}
      </Table.Td>
      <Table.Td>
        <Text fz="sm" c="slate.7">
          {account.tax ?? '-'}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        <Text fz="sm" fw={700} c={toCents(balance) < 0 ? 'red.8' : 'slate.9'} ff="monospace" style={{ whiteSpace: 'nowrap' }}>
          {formatBalance(balance)}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}

// #daftar-akun → daftar; #daftar-akun/<kode>?from=…&to=… → detail akun (periode opsional).
function parseHash(hash) {
  const m = hash.match(/^#daftar-akun\/([^?]+)(?:\?(.*))?$/);
  if (!m) return null;
  const params = new URLSearchParams(m[2] ?? '');
  const from = params.get('from');
  const to = params.get('to');
  return { code: decodeURIComponent(m[1]), range: from && to ? [from, to] : null };
}

export default function DaftarAkun() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const journal = hash.match(/^#daftar-akun\/jurnal\/([^?]+)/);
  if (journal) return <JournalDetail key={hash} id={decodeURIComponent(journal[1])} />;
  const detail = parseHash(hash);
  // key: pindah ke akun lain atau periode lain memasang ulang halaman detail dengan filter barunya.
  return detail ? <AccountDetail key={hash} code={detail.code} initialRange={detail.range} /> : <DaftarAkunList />;
}

function DaftarAkunList() {
  const data = useData();
  // Saldo akhir dihitung dari jurnal per hari ini, sama dengan Neraca Saldo dan detail akun.
  const balances = useMemo(
    () => accountBalances(buildLedger(data), TODAY),
    [data.sales, data.salesReturns, data.pb, data.stockMoves, data.products], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [selected, setSelected] = useState(() => new Set());

  const toggleIn = (setter, key) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const tabMatch = tabs.find((t) => t.value === tab).match;
  const q = query.trim().toLowerCase();

  // Tanpa filter: tampilkan hierarki (induk + sub-akun yang di-expand).
  // Dengan filter: tampilkan daftar datar semua akun yang cocok, termasuk sub-akun.
  // Hanya akun yang cocok dengan tab/filter yang tampil. Induk yang cocok tetap punya
  // accordion berisi sub-akun yang cocok saja. Jika induknya tidak cocok (mis. induk Open
  // di tab Akun Terkunci), sub-akun yang cocok tampil sebagai baris sendiri.
  // Saat mencari teks, induk otomatis terbuka agar sub-akun yang cocok langsung terlihat.
  const rows = useMemo(() => {
    const match = (a) =>
      tabMatch(a) &&
      (!category || a.category === category) &&
      (!q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));

    return roots.flatMap((a) => {
      const kids = (childrenOf[a.code] || []).filter(match);
      if (!match(a)) return kids.map((c) => ({ account: c, depth: 0 }));
      // Saat mencari, default terbuka; klik chevron tetap bisa menutupnya.
      const open = kids.length > 0 && !!q !== expanded.has(a.code);
      return [
        { account: a, depth: 0, expandable: kids.length > 0, open },
        ...(open ? kids.map((c) => ({ account: c, depth: 1 })) : []),
      ];
    });
  }, [tabMatch, category, q, expanded]);

  // Belum ada akun diarsipkan di data; toggle hanya menampilkan status kosong.
  const visibleRows = showArchived ? [] : rows;

  const selectable = visibleRows.filter((r) => !r.account.locked).map((r) => r.account.code);
  const allSelected = selectable.length > 0 && selectable.every((c) => selected.has(c));
  const someSelected = selectable.some((c) => selected.has(c));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      selectable.forEach((c) => (allSelected ? next.delete(c) : next.add(c)));
      return next;
    });

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        {stats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </SimpleGrid>

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group gap={4} mb="md">
          {tabs.map((t) => {
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
                {t.label} ({accounts.filter(t.match).length})
              </Button>
            );
          })}
        </Group>

        <Group gap="sm" mb="md">
          <TextInput
            placeholder="Cari kode atau nama akun..."
            size="sm"
            radius="md"
            w={240}
            leftSection={<MagnifyingGlass size={14} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          <Select
            placeholder="Pilih Kategori Akun"
            size="sm"
            radius="md"
            w={190}
            data={accountCategories}
            value={category}
            onChange={setCategory}
            clearable
            searchable
          />
          <Switch
            size="sm"
            label="Lihat Diarsipkan"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.currentTarget.checked)}
          />
        </Group>

        {/* Border + radius di pembungkus (radius md = sama dengan input pencarian & tab) */}
        <Box
          className="table-frame"
          style={{
            // Warna sama dengan garis antar-baris tabel (--table-border-color Mantine)
            border: '1px solid var(--mantine-color-gray-3)',
            borderRadius: 'var(--mantine-radius-md)',
            overflow: 'hidden',
          }}
        >
          <ScrollArea type="auto">
            <Table
              verticalSpacing="sm"
              horizontalSpacing="md"
              miw={1200}
              highlightOnHover
              styles={{
                th: {
                  fontSize: 'var(--mantine-font-size-xs)',
                  color: 'var(--mantine-color-slate-7)',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                },
              }}
            >
              <Table.Thead bg="slate.0">
                <Table.Tr>
                  <Table.Th w={44}>
                    <Checkbox
                      size="xs"
                      radius="sm"
                      checked={allSelected}
                      indeterminate={someSelected && !allSelected}
                      onChange={toggleAll}
                      aria-label="Pilih semua akun"
                    />
                  </Table.Th>
                  <Table.Th w={170}>Kode Akun</Table.Th>
                  <Table.Th miw={96}>Status</Table.Th>
                  <Table.Th>Nama Akun</Table.Th>
                  <Table.Th>Kategori</Table.Th>
                  <Table.Th miw={110}>Posisi Saldo</Table.Th>
                  <Table.Th miw={116}>Akses</Table.Th>
                  <Table.Th>Pajak</Table.Th>
                  <Table.Th ta="right">Saldo Akhir</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visibleRows.map(({ account, depth, expandable, open }) => (
                  <AccountRow
                    key={account.code}
                    account={account}
                    balance={balances[account.code] ?? 0}
                    depth={depth}
                    expandable={expandable}
                    expanded={!!open}
                    onToggle={() => toggleIn(setExpanded, account.code)}
                    selected={selected.has(account.code)}
                    onSelect={() => toggleIn(setSelected, account.code)}
                  />
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Box>

        {visibleRows.length === 0 && (
          <Center py="xl">
            <Text fz="sm" c="slate.6">
              Belum ada data akun yang sesuai kriteria
            </Text>
          </Center>
        )}
      </Card>
    </Stack>
  );
}
