// Laporan Buku Besar (General Ledger): per akun, saldo awal, setiap jurnal di rentang tanggal dengan
// saldo berjalan, lalu saldo akhir. Angkanya dari jurnal otomatis yang sama dengan Neraca Saldo
// (ledger.js → generalLedger), jadi saldo awal dan akhir setiap akun selalu sama di kedua laporan.
//
// Susunannya mengikuti Buku Besar di aplikasi produksi (akun sebagai judul blok, baris Saldo Awal,
// jurnal, baris Saldo Akhir), dengan gaya laporan lain di prototype: filter periode bersama,
// kartu statistik, toolbar tabel, dan ekspor PDF / Excel / CSV. Nama akun membuka detail akun,
// nomor jurnal membuka halaman Jurnal Transaksi.
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Group,
  Menu,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import { BackLink, PageIntro } from '@/components/common.jsx';
import { Book, CaretDown, DownloadSimple, FileCsv, FilePdf, FileXls, MagnifyingGlass, Printer } from '@/components/Icon.jsx';
import { COMPANY } from '@/lib/company.js';
import { useData } from '@/lib/store.jsx';
import { Callout } from '@/pages/Pembelian/components.jsx';
import { TODAY } from '@/pages/Penjualan/data.js';
import { addDays, formatDate, rupiah } from '@/pages/Penjualan/utils.js';
import { buildLedger, generalLedger } from './ledger.js';
import { exportLedgerCsv, exportLedgerPdf, exportLedgerXlsx } from './ledgerExport.js';
import { PeriodCard, rangeText, usePeriodFilter } from './PeriodFilter.jsx';
import { AccountLink, money, num, Stat } from './StatementParts.jsx';

const HEAD = ['Tanggal', 'No. Jurnal', 'Keterangan', 'Debit', 'Kredit', 'Saldo'];
// Keterangan jurnal: jenis transaksi + nomor dokumen (tanpa mengulang nomor yang sudah ada di judul).
// Judul jurnal Penjualan memuat tanggal ("Pembayaran 3 Nov 2026"), yang sudah ada di kolom Tanggal.
export const describe = (e) => {
  const t = e.title.replace(/\s\d{1,2} \S+ \d{4}$/, '');
  return t.includes(e.ref) ? t : `${t} ${e.ref}`;
};

const numCell = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' };
function N({ v, fw = 500, dash = true }) {
  const zero = Math.round(v) === 0;
  return (
    <Table.Td style={numCell}>
      <Text span fz="sm" fw={fw} c={zero && dash ? 'slate.4' : Math.round(v) < 0 ? 'red.8' : 'slate.9'}>{zero && dash ? '–' : num(v)}</Text>
    </Table.Td>
  );
}

// Akun dan barisnya sesuai pencarian dan pilihan "sembunyikan akun tanpa transaksi". Nama/kode
// akun yang cocok menampilkan seluruh bloknya; selain itu hanya jurnal yang cocok.
function filterGroups(gl, { q, hideEmpty }) {
  return gl.groups
    .map((g) => ({
      ...g,
      accounts: g.accounts
        .filter((a) => (hideEmpty ? a.rows.length > 0 : a.rows.length > 0 || Math.round(a.opening) !== 0))
        .map((a) => {
          if (!q || `${a.code ?? ''} ${a.name}`.toLowerCase().includes(q)) return a;
          const rows = a.rows.filter(({ entry: e, line: l }) => `#${e.no} ${e.no} ${describe(e)} ${l.memo ?? ''}`.toLowerCase().includes(q));
          return rows.length ? { ...a, rows, filtered: true } : null;
        })
        .filter(Boolean),
    }))
    .filter((g) => g.accounts.length);
}

function AccountBlock({ a, range, collapsed, onToggle }) {
  const open = (href) => { window.location.assign(href); window.scrollTo({ top: 0 }); };
  return (
    <>
      <Table.Tr className="gl-account">
        <Table.Td colSpan={6}>
          <Group gap="xs" wrap="nowrap">
            <ActionIcon variant="subtle" color="slate" size="sm" onClick={onToggle} aria-label={collapsed ? `Buka ${a.name}` : `Ciutkan ${a.name}`} aria-expanded={!collapsed} className="no-print">
              <CaretDown size={14} style={{ transform: collapsed ? 'rotate(-90deg)' : undefined, transition: 'transform 150ms' }} />
            </ActionIcon>
            <Text span fz="sm" c="slate.6" style={{ fontVariantNumeric: 'tabular-nums' }}>{a.code ?? '–'}</Text>
            {a.code ? <AccountLink code={a.code} range={range} fw={700}>{a.name}</AccountLink> : <Text span fz="sm" fw={700} c="slate.9">{a.name}</Text>}
            <Text span fz={11} c="slate.6">· saldo normal {a.sign < 0 ? 'kredit' : 'debit'}</Text>
          </Group>
        </Table.Td>
      </Table.Tr>
      {!collapsed && (
        <>
          <Table.Tr>
            <Table.Td colSpan={5}><Text fz="sm" c="slate.7">Saldo awal per {formatDate(addDays(range[0], -1))}</Text></Table.Td>
            <N v={a.opening} fw={600} dash={false} />
          </Table.Tr>
          {a.rows.map(({ entry: e, line: l, saldo }, i) => (
            <Table.Tr key={`${e.id}-${i}`} className="bs-line" onClick={() => open(e.journalHref)} style={{ cursor: 'pointer' }}>
              <Table.Td style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}><Text fz="sm" c="slate.8">{formatDate(e.date)}</Text></Table.Td>
              <Table.Td style={{ verticalAlign: 'top' }}>
                <UnstyledButton
                  component="a"
                  href={e.journalHref}
                  fz="sm"
                  fw={600}
                  c="primary.9"
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); open(e.journalHref); }}
                >
                  #{e.no}
                </UnstyledButton>
              </Table.Td>
              <Table.Td style={{ verticalAlign: 'top' }}>
                <Text fz="sm" c="slate.9">{describe(e)}</Text>
                {l.memo && <Text fz={11} c="slate.6">{l.memo}</Text>}
              </Table.Td>
              <N v={l.debit} />
              <N v={l.credit} />
              <N v={saldo} dash={false} />
            </Table.Tr>
          ))}
          {!a.rows.length && (
            <Table.Tr>
              <Table.Td colSpan={6}><Text fz="xs" c="slate.6">Tidak ada transaksi di periode ini.</Text></Table.Td>
            </Table.Tr>
          )}
        </>
      )}
      <Table.Tr className="bs-total">
        <Table.Td colSpan={3}>
          <Text fz="sm" fw={600} c="slate.9" ta="right">
            Saldo akhir {a.name}
            {a.filtered && <Text span fz={11} fw={400} c="slate.6"> (semua jurnal akun ini)</Text>}
          </Text>
        </Table.Td>
        <N v={a.debit} fw={600} />
        <N v={a.credit} fw={600} />
        <N v={a.closing} fw={700} dash={false} />
      </Table.Tr>
    </>
  );
}

export default function BukuBesar({ onBack }) {
  const data = useData();
  const ledger = useMemo(
    () => buildLedger(data),
    [data.sales, data.salesReturns, data.pb, data.stockMoves, data.products], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const { range, fieldProps } = usePeriodFilter();
  const [hideEmpty, setHideEmpty] = useState(true);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const q = query.trim().toLowerCase();

  const gl = useMemo(() => generalLedger(ledger, range[0], range[1]), [ledger, range[0], range[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const groups = filterGroups(gl, { q, hideEmpty });
  const all = gl.groups.flatMap((g) => g.accounts);
  const active = all.filter((a) => a.rows.length).length;
  const shownKeys = groups.flatMap((g) => g.accounts.map((a) => a.key));
  const allCollapsed = shownKeys.length > 0 && shownKeys.every((k) => collapsed.has(k));
  const selisih = Math.round(gl.totals.debit - gl.totals.credit);
  const periodLine = rangeText(range);
  const toggle = (key) => setCollapsed((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const exportAs = (format) => {
    const spec = {
      filename: `buku-besar-${range[0]}_${range[1]}.${format}`,
      title: 'Buku Besar',
      company: COMPANY.name,
      period: periodLine,
      headers: HEAD,
      openingLabel: `Saldo awal per ${formatDate(addDays(range[0], -1))}`,
      groups: filterGroups(gl, { q: '', hideEmpty }),
      describe,
      formatDate,
      num,
      footnote: `Dihitung dari ${gl.count} jurnal antara ${formatDate(range[0])} dan ${formatDate(range[1])}. Saldo mengikuti saldo normal akun; angka dalam kurung berarti berlawanan dengan saldo normalnya. Diekspor ${formatDate(TODAY)}.`,
    };
    if (format === 'pdf') exportLedgerPdf(spec);
    else if (format === 'xlsx') exportLedgerXlsx(spec);
    else exportLedgerCsv(spec);
  };

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" w="100%">
      <BackLink label="Kembali ke Pusat Laporan" onClick={onBack} />
      <PageIntro
        icon={Book}
        title="Buku Besar"
        description="Saldo awal, setiap jurnal dengan saldo berjalan, dan saldo akhir per akun dari jurnal Penjualan, Pembelian, dan Gudang. Klik nama akun untuk detail akun, klik nomor jurnal untuk rincian jurnalnya."
        actions={
          <>
            <ActionIcon variant="default" size={36} radius="md" aria-label="Cetak buku besar" onClick={() => window.print()}><Printer size={16} /></ActionIcon>
            <Menu position="bottom-end" width={240} shadow="md" radius="md">
              <Menu.Target>
                <Button variant="default" radius="md" leftSection={<DownloadSimple size={16} />} rightSection={<CaretDown size={14} />}>Ekspor</Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Pilih format ekspor</Menu.Label>
                <Menu.Item leftSection={<FilePdf size={18} />} onClick={() => exportAs('pdf')}>Dokumen PDF (.pdf)</Menu.Item>
                <Menu.Item leftSection={<FileXls size={18} />} onClick={() => exportAs('xlsx')}>Spreadsheet Excel (.xlsx)</Menu.Item>
                <Menu.Item leftSection={<FileCsv size={18} />} onClick={() => exportAs('csv')}>Data CSV (.csv)</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </>
        }
      />

      <PeriodCard {...fieldProps} noCompare />

      {selisih !== 0 && (
        <Callout tone="warn" title="Debit dan kredit tidak sama">
          Total mutasi debit dan kredit di periode ini selisih {money(selisih)}. Ada jurnal yang tidak seimbang; periksa jurnal dokumen di periode ini.
        </Callout>
      )}

      <Card withBorder radius="lg" padding={0} bg="white">
        <Box className="bs-stats">
          <Stat label="Akun bertransaksi" value={`${active} akun`} delta={`dari ${all.length} akun bersaldo atau bermutasi`} />
          <Stat label="Total mutasi debit" value={rupiah(gl.totals.debit)} delta={gl.count ? `${gl.count} jurnal · ${periodLine}` : 'Belum ada jurnal'} />
          <Stat label="Total mutasi kredit" value={rupiah(gl.totals.credit)} delta={periodLine} />
          <Stat
            label="Keseimbangan"
            value={selisih === 0 ? 'Seimbang' : `Selisih ${rupiah(Math.abs(selisih))}`}
            tone={selisih === 0 ? 'green.8' : 'red.8'}
            delta={selisih === 0 ? 'Total debit = total kredit' : 'Debit dan kredit tidak sama'}
          />
        </Box>
      </Card>

      <Card withBorder radius="lg" padding={0} bg="white">
        <Group justify="space-between" gap="sm" px="lg" py="sm" bg="slate.0" className="no-print" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
          <TextInput
            size="sm"
            radius="md"
            w={{ base: '100%', sm: 320 }}
            aria-label="Cari akun atau jurnal"
            placeholder="Cari akun, no. jurnal, atau keterangan…"
            leftSection={<MagnifyingGlass size={14} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          <Group gap="lg" wrap="wrap">
            <Switch size="sm" label="Sembunyikan akun tanpa transaksi" checked={hideEmpty} onChange={(e) => setHideEmpty(e.currentTarget.checked)} />
            <Button
              size="sm"
              variant="default"
              radius="md"
              disabled={!shownKeys.length}
              onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(shownKeys))}
            >
              {allCollapsed ? 'Buka semua akun' : 'Ciutkan semua akun'}
            </Button>
          </Group>
        </Group>

        <Stack gap={2} align="center" px="lg" pt="lg" pb="md">
          <Text fz="sm" c="slate.7">{COMPANY.name}</Text>
          <Text fz="lg" fw={700} c="slate.9">Buku Besar</Text>
          <Text fz="sm" c="slate.7" ta="center">{periodLine}</Text>
        </Stack>
        <Box className="bs-sheet">
          <Table horizontalSpacing="md" verticalSpacing="xs" miw={920} className="gl-table">
            <Table.Thead>
              <Table.Tr>
                {HEAD.map((h, i) => (
                  <Table.Th key={h} fz="xs" c="slate.7" ta={i >= 3 ? 'right' : undefined} w={[110, 110, undefined, 150, 150, 160][i]}>{h}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {groups.map((g) => (
                <GroupRows key={g.key} g={g} range={range} collapsed={collapsed} toggle={toggle} />
              ))}
              {groups.length > 0 && !q && (
                <Table.Tr className="bs-total bs-grand">
                  <Table.Td colSpan={3}><Text fz="sm" fw={700} c="slate.9" ta="right">Total mutasi periode</Text></Table.Td>
                  <N v={gl.totals.debit} fw={700} />
                  <N v={gl.totals.credit} fw={700} />
                  <Table.Td />
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
          {!groups.length && (
            <Text fz="sm" c="slate.6" ta="center" py="lg">
              {q ? `Tidak ada akun atau jurnal yang cocok dengan “${query}”.` : 'Belum ada jurnal di periode ini.'}
            </Text>
          )}
        </Box>
        <Text fz="xs" c="slate.6" px="lg" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
          Saldo mengikuti saldo normal akun: akun debit (aset, beban) bertambah saat didebit, akun kredit (liabilitas, ekuitas, pendapatan) bertambah saat dikredit. Angka dalam kurung berarti saldonya berlawanan dengan saldo normal. Saldo awal dari jurnal sebelum {formatDate(range[0])}; akun pendapatan dan beban mulai 1 Januari.
        </Text>
      </Card>
    </Stack>
  );
}

function GroupRows({ g, range, collapsed, toggle }) {
  return (
    <>
      <Table.Tr className="bs-section gl-section">
        <Table.Td colSpan={6}><Text fz="xs" fw={700} c="slate.8" tt="uppercase" style={{ letterSpacing: 0.4 }}>{g.label}</Text></Table.Td>
      </Table.Tr>
      {g.accounts.map((a) => (
        <AccountBlock key={a.key} a={a} range={range} collapsed={collapsed.has(a.key)} onToggle={() => toggle(a.key)} />
      ))}
    </>
  );
}
