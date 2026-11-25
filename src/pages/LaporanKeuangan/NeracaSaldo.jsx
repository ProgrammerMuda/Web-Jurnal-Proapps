// Laporan Neraca Saldo (Trial Balance) untuk satu rentang tanggal: saldo awal, mutasi debit/kredit,
// dan saldo akhir setiap akun, dikelompokkan per kategori Daftar Akun. Angkanya dari jurnal otomatis
// yang sama dengan Neraca dan Laba Rugi (ledger.js → trialBalance), jadi total debit dan kredit di
// setiap pasang kolom harus selalu sama.
//
// Susunan dan gayanya mengikuti Neraca dan Laba Rugi: filter periode bersama, kartu statistik,
// toolbar tabel, tabel laporan, modal rincian akun, dan ekspor PDF / Excel / CSV.
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Group,
  Menu,
  SegmentedControl,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useMemo, useState } from 'react';
import { BackLink, PageIntro } from '@/components/common.jsx';
import { CaretDown, DownloadSimple, FileCsv, FilePdf, FileXls, MagnifyingGlass, Printer, Table as TableIcon } from '@/components/Icon.jsx';
import { COMPANY } from '@/lib/company.js';
import { useData } from '@/lib/store.jsx';
import { Callout } from '@/pages/Pembelian/components.jsx';
import { TODAY } from '@/pages/Penjualan/data.js';
import { addDays, formatDate, rupiahShort } from '@/pages/Penjualan/utils.js';
import { buildLedger, trialBalance } from './ledger.js';
import { PeriodCard, rangeText, usePeriodFilter } from './PeriodFilter.jsx';
import { exportStatementCsv, exportStatementPdf, exportStatementXlsx, statementLines } from './statementExport.js';
import { AccountLink, accountHref, LeadCell, money, num, Stat, moneyShort } from './StatementParts.jsx';

const KEYS = ['openDebit', 'openCredit', 'debit', 'credit', 'closeDebit', 'closeCredit'];
const valsOf = (r) => KEYS.map((k) => r[k]);
const GROUPS = [
  { label: 'Saldo awal', span: 2 },
  { label: 'Mutasi', span: 2 },
  { label: 'Saldo akhir', span: 2 },
];
// Garis di kiri setiap kolom angka: lebih tegas di awal pasangan (saldo awal, mutasi, saldo
// akhir), tipis di antara Debit dan Kredit.
const divider = (i) => ({ borderLeft: `1px solid var(--mantine-color-gray-${i % 2 === 0 ? 3 : 2})` });

// Baris tabel sesuai mode, saldo nol, dan pencarian.
function flatten(tb, { mode, hideZero, q }) {
  const out = [];
  const keep = (r) => (!hideZero || valsOf(r).some((v) => Math.round(v) !== 0))
    && (!q || `${r.code ?? ''} ${r.name}`.toLowerCase().includes(q));
  tb.groups.forEach((g) => {
    const rows = g.rows.filter(keep);
    if (!rows.length) return;
    if (mode === 'ringkas') {
      out.push({ type: 'cat-sum', key: g.key, label: g.label, count: rows.length, vals: valsOf(g) });
      return;
    }
    out.push({ type: 'section', key: g.key, label: g.label });
    rows.forEach((r) => out.push({ type: 'account', row: { ...r, vals: valsOf(r) } }));
    out.push({ type: 'total', key: g.key, label: `Total ${g.label.toLowerCase()}`, vals: valsOf(g) });
  });
  out.push({ type: 'grand', label: 'Total', vals: valsOf(tb.totals) });
  return out;
}

function Nums({ vals, fw = 500, c }) {
  return vals.map((v, i) => (
    <Table.Td key={KEYS[i]} style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right', ...divider(i) }}>
      <Text span fz="sm" fw={fw} c={c ?? (Math.round(v) === 0 ? 'slate.5' : 'slate.9')}>{num(v)}</Text>
    </Table.Td>
  ));
}

function StatementRow({ r, phone, range }) {
  switch (r.type) {
    case 'section':
      return (
        <Table.Tr className="bs-section">
          <LeadCell phone={phone}><Text fz="sm" fw={700} c="slate.9">{r.label}</Text></LeadCell>
          {KEYS.map((k, i) => <Table.Td key={k} style={divider(i)} />)}
        </Table.Tr>
      );
    case 'account': {
      const a = r.row;
      const open = () => { window.location.hash = accountHref(a.code, range).slice(1); };
      return (
        <Table.Tr className="bs-line" onClick={open} style={{ cursor: 'pointer' }}>
          <Table.Td className="bs-code"><Text fz="xs" c="slate.6" style={{ fontVariantNumeric: 'tabular-nums' }}>{a.code}</Text></Table.Td>
          <Table.Td>
            <AccountLink code={a.code} range={range}>{a.name}</AccountLink>
            {a.n > 0 && <Text fz={11} c="slate.6">{a.n} baris jurnal</Text>}
          </Table.Td>
          <Nums vals={a.vals} />
        </Table.Tr>
      );
    }
    case 'cat-sum':
      return (
        <Table.Tr className="bs-line">
          <LeadCell phone={phone}>
            <Text fz="sm" c="slate.9">{r.label}</Text>
            <Text fz={11} c="slate.6">{r.count} akun</Text>
          </LeadCell>
          <Nums vals={r.vals} />
        </Table.Tr>
      );
    case 'total':
    case 'grand':
      return (
        <Table.Tr className={r.type === 'grand' ? 'bs-total bs-grand' : 'bs-total'}>
          <LeadCell phone={phone}><Text fz="sm" fw={r.type === 'total' ? 600 : 700} c="slate.9">{r.label}</Text></LeadCell>
          <Nums vals={r.vals} fw={r.type === 'total' ? 600 : 700} c="slate.9" />
        </Table.Tr>
      );
    default:
      return null;
  }
}

export default function NeracaSaldo({ onBack }) {
  const data = useData();
  const phone = useMediaQuery('(max-width: 47.99em)');
  const ledger = useMemo(
    () => buildLedger(data),
    [data.sales, data.salesReturns, data.pb, data.stockMoves, data.products], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const { range, fieldProps } = usePeriodFilter();

  const [mode, setMode] = useState('rinci');
  const [hideZero, setHideZero] = useState(true);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  // Tanpa "sembunyikan saldo nol", seluruh akun Daftar Akun ikut tampil.
  const tb = useMemo(() => trialBalance(ledger, range[0], range[1], { all: !hideZero }), [ledger, range[0], range[1], hideZero]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = tb.totals;
  const rows = flatten(tb, { mode: q ? 'rinci' : mode, hideZero, q });
  const periodLine = rangeText(range);
  const seimbang = ['open', 'move', 'close'].every((k) => Math.round(tb.selisih[k]) === 0);
  // Selisih terbesar dari ketiga pasang kolom, untuk angka besar di kartu Keseimbangan.
  const worst = Object.values(tb.selisih).reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0);
  const headers = ['Kode', 'Akun', 'Debit', 'Kredit', 'Debit', 'Kredit', 'Debit', 'Kredit'];

  const exportAs = (format) => {
    const spec = {
      filename: `neraca-saldo-${range[0]}_${range[1]}.${format}`,
      title: 'Neraca Saldo',
      company: COMPANY.name,
      period: periodLine,
      headers,
      groups: GROUPS,
      lines: statementLines(flatten(tb, { mode, hideZero, q: '' })),
      footnote: `Dihitung dari ${tb.count} jurnal antara ${formatDate(range[0])} dan ${formatDate(range[1])}. Saldo awal dari jurnal sebelum ${formatDate(range[0])}; akun laba rugi mulai 1 Januari. Diekspor ${formatDate(TODAY)}.`,
      num,
      pdfWidths: [40, 115, 60, 60, 60, 60, 60, 60],
      xlsxWidths: [12, 40, 16, 16, 16, 16, 16, 16],
    };
    if (format === 'pdf') exportStatementPdf(spec);
    else if (format === 'xlsx') exportStatementXlsx(spec);
    else exportStatementCsv(spec);
  };

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" w="100%">
      <BackLink label="Kembali ke Pusat Laporan" onClick={onBack} />
      <PageIntro
        icon={TableIcon}
        title="Neraca Saldo"
        description="Saldo awal, mutasi, dan saldo akhir setiap akun dari jurnal Penjualan, Pembelian, dan Gudang. Total debit dan kredit harus selalu sama. Klik akun untuk melihat jurnalnya."
        actions={
          <>
            <ActionIcon variant="default" size={36} radius="md" aria-label="Cetak neraca saldo" onClick={() => window.print()}><Printer size={16} /></ActionIcon>
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

      {!seimbang && (
        <Callout tone="warn" title="Debit dan kredit tidak sama">
          Selisih saldo awal {money(tb.selisih.open)}, mutasi {money(tb.selisih.move)}, saldo akhir {money(tb.selisih.close)}. Ada jurnal yang tidak seimbang; periksa jurnal dokumen di periode ini.
        </Callout>
      )}

      <Card withBorder radius="lg" padding={0} bg="white">
        <Box className="bs-stats">
          <Stat
            label="Saldo awal"
            value={moneyShort(t.openDebit)}
            delta={`Per ${formatDate(addDays(range[0], -1))}`}
            parts={[['Debit', t.openDebit], ['Kredit', t.openCredit]]}
          />
          <Stat
            label="Mutasi periode"
            value={moneyShort(t.debit)}
            delta={tb.count ? `${tb.count} jurnal` : 'Belum ada jurnal'}
            parts={[['Debit', t.debit], ['Kredit', t.credit]]}
          />
          <Stat
            label="Saldo akhir"
            value={moneyShort(t.closeDebit)}
            delta={`Per ${formatDate(range[1])}`}
            parts={[['Debit', t.closeDebit], ['Kredit', t.closeCredit]]}
          />
          <Stat
            label="Keseimbangan"
            value={seimbang ? 'Seimbang' : `Selisih ${rupiahShort(Math.abs(worst))}`}
            tone={seimbang ? 'green.8' : 'red.8'}
            delta={seimbang ? 'Total debit = total kredit' : 'Debit dan kredit tidak sama'}
            parts={[['Selisih saldo awal', tb.selisih.open], ['Selisih mutasi', tb.selisih.move], ['Selisih saldo akhir', tb.selisih.close]]}
          />
        </Box>
      </Card>

      <Card withBorder radius="lg" padding={0} bg="white">
        <Group justify="space-between" gap="sm" px="lg" py="md" className="no-print" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          <TextInput
            size="sm"
            radius="md"
            w={{ base: '100%', sm: 280 }}
            aria-label="Cari akun"
            placeholder="Cari nama atau kode akun…"
            leftSection={<MagnifyingGlass size={14} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          <Group gap="lg" wrap="nowrap">
            <Switch size="sm" label="Sembunyikan saldo nol" checked={hideZero} onChange={(e) => setHideZero(e.currentTarget.checked)} />
            <SegmentedControl size="sm" radius="md" aria-label="Tampilan" value={mode} onChange={setMode} data={[{ value: 'rinci', label: 'Rinci' }, { value: 'ringkas', label: 'Ringkas' }]} />
          </Group>
        </Group>

        <Stack gap={2} align="center" px="lg" pt="lg" pb="md">
          <Text fz="sm" c="slate.7">{COMPANY.name}</Text>
          <Text fz="lg" fw={700} c="slate.9">Neraca Saldo</Text>
          <Text fz="sm" c="slate.7" ta="center">{periodLine}</Text>
        </Stack>
        <Box className="bs-sheet">
          <Table horizontalSpacing="md" verticalSpacing="sm" miw={1080} className="bs-table bs-cmp bs-tb">
            <Table.Thead>
              <Table.Tr>
                <Table.Th className="bs-code" />
                <Table.Th />
                {GROUPS.map((g) => (
                  <Table.Th key={g.label} colSpan={g.span} fz="xs" c="slate.8" ta="center" style={{ borderLeft: '1px solid var(--mantine-color-gray-3)' }}>{g.label}</Table.Th>
                ))}
              </Table.Tr>
              <Table.Tr>
                <Table.Th w={96} fz="xs" c="slate.7" className="bs-code">Kode</Table.Th>
                <Table.Th fz="xs" c="slate.7">Akun</Table.Th>
                {headers.slice(2).map((h, i) => (
                  <Table.Th key={`${h}-${KEYS[i]}`} w={128} fz="xs" c="slate.7" ta="center" style={divider(i)}>{h}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r, i) => <StatementRow key={`${r.type}-${r.key ?? r.row?.key ?? r.label}-${i}`} r={r} phone={phone} range={range} />)}
            </Table.Tbody>
          </Table>
          {q && !rows.some((r) => r.type === 'account') && (
            <Text fz="sm" c="slate.6" ta="center" py="lg">Tidak ada akun yang cocok dengan “{query}”.</Text>
          )}
        </Box>
        <Text fz="xs" c="slate.6" px="lg" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
          Saldo awal dari jurnal sebelum {formatDate(range[0])}; akun pendapatan dan beban mulai 1 Januari, laba rugi tahun sebelumnya masuk Laba Ditahan. Saldo ditulis bersih di sisi debit atau kredit; tanda – berarti nol.
        </Text>
      </Card>

    </Stack>
  );
}
