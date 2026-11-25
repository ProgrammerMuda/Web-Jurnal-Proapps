// Laporan Jurnal Umum (Journal Entry Log): semua jurnal di rentang tanggal secara kronologis, per
// jurnal baris debit dulu lalu kredit, ditutup total jurnalnya. Datanya
// jurnal otomatis yang sama dengan Buku Besar dan Neraca Saldo (ledger.js → buildLedger), jadi
// total debit dan kreditnya selalu sama dengan total mutasi di kedua laporan itu.
//
// Nomor jurnal membuka halaman Jurnal Transaksi, nama akun membuka detail akun.
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Menu,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import { BackLink, PageIntro } from '@/components/common.jsx';
import { CaretDown, DownloadSimple, FileCsv, FilePdf, FileXls, MagnifyingGlass, Notebook, Printer } from '@/components/Icon.jsx';
import { COMPANY } from '@/lib/company.js';
import { useData } from '@/lib/store.jsx';
import { Callout } from '@/pages/Pembelian/components.jsx';
import { TODAY } from '@/pages/Penjualan/data.js';
import { formatDate, rupiah } from '@/pages/Penjualan/utils.js';
import { describe } from './BukuBesar.jsx';
import { exportJournalCsv, exportJournalPdf, exportJournalXlsx } from './journalExport.js';
import { accountsByCode, buildLedger } from './ledger.js';
import { PeriodCard, rangeText, usePeriodFilter } from './PeriodFilter.jsx';
import { AccountLink, MODULE_COLOR, money, num, Stat } from './StatementParts.jsx';

const HEAD = ['Tanggal', 'No. Jurnal', 'Akun', 'Keterangan', 'Debit', 'Kredit'];
const MODULES = ['Penjualan', 'Pembelian', 'Gudang'];
const PAGE_SIZE = 50;

// Baris jurnal untuk ditampilkan: debit dulu, lalu kredit (urutan buku jurnal), nama akun lengkap.
const sortLines = (lines) => [...lines.filter((l) => l.debit), ...lines.filter((l) => !l.debit)]
  .map((l) => ({ ...l, name: accountsByCode[l.code]?.name ?? l.name ?? 'Akun tidak dikenal' }));

const numCell = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right', verticalAlign: 'top' };
function N({ v, fw = 500 }) {
  const zero = Math.round(v) === 0;
  return (
    <Table.Td style={numCell}>
      <Text span fz="sm" fw={fw} c={zero ? 'slate.4' : 'slate.9'}>{zero ? '–' : num(v)}</Text>
    </Table.Td>
  );
}

const open = (href) => { window.location.assign(href); window.scrollTo({ top: 0 }); };

function JournalBlock({ e, range }) {
  return (
    <>
      <Table.Tr className="gl-account bs-line" onClick={() => open(e.journalHref)} style={{ cursor: 'pointer' }}>
        <Table.Td style={{ whiteSpace: 'nowrap' }}><Text fz="sm" fw={600} c="slate.9">{formatDate(e.date)}</Text></Table.Td>
        <Table.Td>
          <UnstyledButton
            component="a"
            href={e.journalHref}
            fz="sm"
            fw={700}
            c="primary.9"
            style={{ whiteSpace: 'nowrap' }}
            onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); open(e.journalHref); }}
          >
            #{e.no}
          </UnstyledButton>
        </Table.Td>
        <Table.Td colSpan={4}>
          <Group gap="xs" wrap="nowrap">
            <Text fz="sm" fw={600} c="slate.9" lineClamp={1}>{describe(e)}</Text>
            <Badge size="xs" radius="sm" variant="light" color={MODULE_COLOR[e.module]} tt="none" style={{ flexShrink: 0 }}>{e.module}</Badge>
          </Group>
        </Table.Td>
      </Table.Tr>
      {e.lines.map((l, i) => (
        <Table.Tr key={i}>
          <Table.Td />
          <Table.Td />
          <Table.Td style={{ verticalAlign: 'top' }}>
            <Group gap={8} wrap="nowrap">
              <Text span fz="sm" c="slate.6" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{l.code ?? '–'}</Text>
              {accountsByCode[l.code] ? <AccountLink code={l.code} range={range}>{l.name}</AccountLink> : <Text span fz="sm" c="slate.9">{l.name}</Text>}
            </Group>
          </Table.Td>
          <Table.Td style={{ verticalAlign: 'top' }}><Text fz="sm" c="slate.7">{l.memo || '–'}</Text></Table.Td>
          <N v={l.debit} />
          <N v={l.credit} />
        </Table.Tr>
      ))}
      <Table.Tr className="bs-total">
        <Table.Td colSpan={3} />
        <Table.Td><Text fz="sm" fw={600} c="slate.9">Total jurnal #{e.no}</Text></Table.Td>
        <N v={e.lines.reduce((n, l) => n + l.debit, 0)} fw={700} />
        <N v={e.lines.reduce((n, l) => n + l.credit, 0)} fw={700} />
      </Table.Tr>
    </>
  );
}

export default function JurnalUmum({ onBack }) {
  const data = useData();
  const ledger = useMemo(
    () => buildLedger(data),
    [data.sales, data.salesReturns, data.pb, data.stockMoves, data.products], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const { range, fieldProps } = usePeriodFilter();
  const [query, setQuery] = useState('');
  const [module, setModule] = useState('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const q = query.trim().toLowerCase();

  // Semua jurnal di periode (dasar statistik dan ekspor), lalu yang cocok dengan filter tabel.
  const inRange = useMemo(
    () => ledger.filter((e) => e.date >= range[0] && e.date <= range[1]).map((e) => ({ ...e, lines: sortLines(e.lines) })),
    [ledger, range[0], range[1]], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const shown = inRange.filter((e) => {
    if (module !== 'all' && e.module !== module) return false;
    if (!q) return true;
    const text = `#${e.no} ${e.no} ${describe(e)} ${e.ref} ${e.lines.map((l) => `${l.code} ${l.name} ${l.memo ?? ''}`).join(' ')}`;
    return text.toLowerCase().includes(q);
  });
  const sum = (list, k) => list.reduce((n, e) => n + e.lines.reduce((m, l) => m + l[k], 0), 0);
  const total = { debit: sum(inRange, 'debit'), credit: sum(inRange, 'credit') };
  const shownTotal = { debit: sum(shown, 'debit'), credit: sum(shown, 'credit') };
  const selisih = Math.round(total.debit - total.credit);
  const unbalanced = inRange.filter((e) => Math.round(sum([e], 'debit') - sum([e], 'credit')) !== 0);
  const perModule = Object.fromEntries(MODULES.map((m) => [m, inRange.filter((e) => e.module === m).length]));
  const filtered = module !== 'all' || !!q;
  const periodLine = rangeText(range);
  const visible = shown.slice(0, limit);

  const exportAs = (format) => {
    const list = filtered ? shown : inRange;
    const spec = {
      filename: `jurnal-umum-${range[0]}_${range[1]}.${format}`,
      title: 'Jurnal Umum',
      company: COMPANY.name,
      period: periodLine + (module !== 'all' ? ` · Modul ${module}` : ''),
      headers: HEAD,
      entries: list,
      totals: filtered ? shownTotal : total,
      describe,
      formatDate,
      num,
      footnote: `${list.length} jurnal antara ${formatDate(range[0])} dan ${formatDate(range[1])}${filtered ? ' (sesuai filter)' : ''}. Diekspor ${formatDate(TODAY)}.`,
    };
    if (format === 'pdf') exportJournalPdf(spec);
    else if (format === 'xlsx') exportJournalXlsx(spec);
    else exportJournalCsv(spec);
  };

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" w="100%">
      <BackLink label="Kembali ke Pusat Laporan" onClick={onBack} />
      <PageIntro
        icon={Notebook}
        title="Jurnal Umum"
        description="Semua jurnal Penjualan, Pembelian, dan Gudang secara kronologis, lengkap dengan akun debit dan kreditnya. Klik nomor jurnal untuk rinciannya, klik nama akun untuk detail akun."
        actions={
          <>
            <ActionIcon variant="default" size={36} radius="md" aria-label="Cetak jurnal umum" onClick={() => window.print()}><Printer size={16} /></ActionIcon>
            <Menu position="bottom-end" width={240} shadow="md" radius="md">
              <Menu.Target>
                <Button variant="default" radius="md" leftSection={<DownloadSimple size={16} />} rightSection={<CaretDown size={14} />}>Ekspor</Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{filtered ? 'Ekspor jurnal sesuai filter' : 'Pilih format ekspor'}</Menu.Label>
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
          Total debit dan kredit di periode ini selisih {money(selisih)}. Jurnal yang tidak seimbang: {unbalanced.map((e) => `#${e.no}`).join(', ')}.
        </Callout>
      )}

      <Card withBorder radius="lg" padding={0} bg="white">
        <Box className="bs-stats">
          <Stat
            label="Jumlah jurnal"
            value={`${inRange.length} jurnal`}
            delta={inRange.length ? MODULES.filter((m) => perModule[m]).map((m) => `${m} ${perModule[m]}`).join(' · ') : 'Belum ada jurnal'}
          />
          <Stat label="Total debit" value={rupiah(total.debit)} delta={periodLine} />
          <Stat label="Total kredit" value={rupiah(total.credit)} delta={periodLine} />
          <Stat
            label="Keseimbangan"
            value={selisih === 0 ? 'Seimbang' : `Selisih ${rupiah(Math.abs(selisih))}`}
            tone={selisih === 0 ? 'green.8' : 'red.8'}
            delta={selisih === 0 ? 'Setiap jurnal debit = kredit' : `${unbalanced.length} jurnal tidak seimbang`}
          />
        </Box>
      </Card>

      <Card withBorder radius="lg" padding={0} bg="white">
        <Group justify="space-between" gap="sm" px="lg" py="md" className="no-print" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          <TextInput
            size="sm"
            radius="md"
            w={{ base: '100%', sm: 360 }}
            aria-label="Cari jurnal"
            placeholder="Cari no. jurnal, dokumen, akun, atau keterangan…"
            leftSection={<MagnifyingGlass size={14} />}
            value={query}
            onChange={(e) => { setQuery(e.currentTarget.value); setLimit(PAGE_SIZE); }}
          />
          <Select
            size="sm"
            radius="md"
            w={{ base: '100%', sm: 220 }}
            aria-label="Modul"
            allowDeselect={false}
            value={module}
            onChange={(v) => { setModule(v); setLimit(PAGE_SIZE); }}
            data={[{ value: 'all', label: `Semua modul (${inRange.length})` }, ...MODULES.map((m) => ({ value: m, label: `${m} (${perModule[m]})` }))]}
          />
        </Group>

        <Stack gap={2} align="center" px="lg" pt="lg" pb="md">
          <Text fz="sm" c="slate.7">{COMPANY.name}</Text>
          <Text fz="lg" fw={700} c="slate.9">Jurnal Umum</Text>
          <Text fz="sm" c="slate.7" ta="center">{periodLine}{module !== 'all' && ` · Modul ${module}`}</Text>
        </Stack>
        <Box className="bs-sheet">
          <Table horizontalSpacing="md" verticalSpacing="xs" miw={980} className="gl-table">
            <Table.Thead>
              <Table.Tr>
                {HEAD.map((h, i) => (
                  <Table.Th key={h} fz="xs" c="slate.7" ta={i >= 4 ? 'right' : undefined} w={[110, 100, undefined, 260, 150, 150][i]}>{h}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visible.map((e) => <JournalBlock key={e.id} e={e} range={range} />)}
              {shown.length > 0 && (
                <Table.Tr className="bs-total bs-grand">
                  <Table.Td colSpan={4}>
                    <Text fz="sm" fw={700} c="slate.9" ta="right">
                      {filtered ? `Total ${shown.length} jurnal sesuai filter` : `Total ${shown.length} jurnal`}
                    </Text>
                  </Table.Td>
                  <N v={shownTotal.debit} fw={700} />
                  <N v={shownTotal.credit} fw={700} />
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
          {!shown.length && (
            <Text fz="sm" c="slate.6" ta="center" py="lg">
              {filtered ? 'Tidak ada jurnal yang cocok dengan filter ini.' : 'Belum ada jurnal di periode ini.'}
            </Text>
          )}
        </Box>
        {shown.length > limit && (
          <Group justify="center" py="md" className="no-print" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
            <Text fz="sm" c="slate.6">Menampilkan {limit} dari {shown.length} jurnal</Text>
            <Button size="sm" variant="default" radius="md" onClick={() => setLimit((n) => n + PAGE_SIZE)}>Tampilkan {Math.min(PAGE_SIZE, shown.length - limit)} lagi</Button>
          </Group>
        )}
        <Text fz="xs" c="slate.6" px="lg" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
          Jurnal diurutkan menurut tanggal transaksi. Di setiap jurnal, akun debit ditulis lebih dulu, lalu akun kredit, dan ditutup total debit dan kredit jurnal itu. Total di bawah tabel menjumlah semua jurnal yang cocok dengan filter, termasuk yang belum ditampilkan.
        </Text>
      </Card>
    </Stack>
  );
}
