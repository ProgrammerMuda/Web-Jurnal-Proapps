// Laporan Laba Rugi untuk satu rentang tanggal. Angkanya dari jurnal otomatis semua modul
// (ledger.js), lewat incomeStatement yang memakai hitungan yang sama dengan Laba Tahun Berjalan
// di Neraca: laba bersih 1 Jan s.d. X selalu sama dengan angka itu di Neraca per X.
//
// Susunan dan gayanya mengikuti Neraca: kartu periode, kartu statistik, toolbar tabel, tabel
// laporan dengan kolom pembanding, modal rincian akun, dan ekspor PDF / Excel / CSV.
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
import { CaretDown, DownloadSimple, FileCsv, FilePdf, FileXls, MagnifyingGlass, Printer, TrendUp } from '@/components/Icon.jsx';
import { COMPANY } from '@/lib/company.js';
import { useData } from '@/lib/store.jsx';
import { TODAY } from '@/pages/Penjualan/data.js';
import { formatDate, rupiahShort } from '@/pages/Penjualan/utils.js';
import { buildLedger, incomeStatement } from './ledger.js';
import { exportStatementCsv, exportStatementPdf, exportStatementXlsx, statementLines } from './statementExport.js';
import { PeriodCard, rangeText, shortLabel, usePeriodFilter } from './PeriodFilter.jsx';
import { AccountLink, accountHref, LeadCell, num, NumCells, pct, Ratio, Stat, moneyShort } from './StatementParts.jsx';

// --- Susunan laporan ----------------------------------------------------------------------------
// Gabungkan laporan periode dan pembandingnya per seksi; akun yang hanya ada di salah satu
// periode tetap tampil dengan nol di sisi lainnya.
function buildTree(cur, prev) {
  return cur.sections.map((s, i) => {
    const ps = prev?.sections[i];
    const map = new Map();
    s.accounts.forEach((a) => map.set(a.code, { key: a.code, code: a.code, name: a.name, category: a.category, a: a.balance, b: prev ? 0 : null }));
    ps?.accounts.forEach((a) => {
      const row = map.get(a.code) ?? { key: a.code, code: a.code, name: a.name, category: a.category, a: 0 };
      row.b = a.balance;
      map.set(a.code, row);
    });
    const rows = [...map.values()].sort((x, y) => x.code.localeCompare(y.code));
    return { key: s.key, label: s.label, sign: s.sign, rows, a: s.total, b: ps ? ps.total : null };
  });
}

// Baris hasil disisipkan setelah seksi tertentu.
const RESULTS = {
  hpp: { key: 'labaKotor', label: 'Laba kotor' },
  beban: { key: 'labaOperasional', label: 'Laba operasional' },
  lainKeluar: { key: 'labaSebelumPajak', label: 'Laba sebelum pajak penghasilan' },
};

// Baris tabel sesuai mode, saldo nol, dan pencarian. Seksi selalu tampil (totalnya "-" bila
// kosong) supaya susunan laporan tidak berubah-ubah; yang disaring hanya baris akun.
function flatten(tree, totals, prevTotals, { mode, hideZero, q }) {
  const out = [];
  const keep = (r) => (!hideZero || Math.round(r.a) !== 0 || Math.round(r.b ?? 0) !== 0)
    && (!q || `${r.code} ${r.name}`.toLowerCase().includes(q));
  tree.forEach((s) => {
    if (mode === 'ringkas') {
      out.push({ type: 'total', key: s.key, label: s.label, a: s.a, b: s.b });
    } else {
      out.push({ type: 'section', label: s.label });
      const rows = s.rows.filter(keep);
      rows.forEach((r) => out.push({ type: 'account', row: r, sign: s.sign }));
      if (!rows.length && q && s.rows.length) out.push({ type: 'empty' });
      out.push({ type: 'total', key: s.key, label: `Total ${s.label.toLowerCase()}`, a: s.a, b: s.b });
    }
    const res = RESULTS[s.key];
    if (res) out.push({ type: 'result', label: res.label, a: totals[res.key], b: prevTotals ? prevTotals[res.key] : null });
  });
  out.push({ type: 'grand', label: 'Laba bersih setelah pajak', a: totals.labaBersih, b: prevTotals ? prevTotals.labaBersih : null });
  return out;
}

function StatementRow({ r, compare, phone, range }) {
  const cols = compare ? 6 : 3;
  switch (r.type) {
    case 'section':
      return (
        <Table.Tr className="bs-section">
          <Table.Td colSpan={cols}><Text fz="sm" fw={700} c="slate.9">{r.label}</Text></Table.Td>
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
            <Text fz={11} c="slate.6">{a.category}</Text>
          </Table.Td>
          <NumCells a={a.a} b={a.b} compare={compare} />
        </Table.Tr>
      );
    }
    case 'total':
    case 'result':
    case 'grand':
      return (
        <Table.Tr className={r.type === 'grand' ? 'bs-total bs-grand' : 'bs-total'}>
          <LeadCell phone={phone}><Text fz="sm" fw={r.type === 'total' ? 600 : 700} c="slate.9">{r.label}</Text></LeadCell>
          <NumCells a={r.a} b={r.b} compare={compare} fw={r.type === 'total' ? 600 : 700} />
        </Table.Tr>
      );
    case 'empty':
      return (
        <Table.Tr>
          <Table.Td colSpan={cols}><Text fz="xs" c="slate.6">Tidak ada akun yang cocok dengan pencarian.</Text></Table.Td>
        </Table.Tr>
      );
    default:
      return null;
  }
}

// Satu isian periode: pilihan cepat + dua tanggal (dari, sampai).

// Rasio sebagai persen. Penyebut nol atau negatif → tidak ada rasio; nilai di luar ±1.000%
// dipotong supaya tidak menyesatkan.
const ratioText = (n, d) => {
  if (!(d > 0)) return '–';
  const r = n / d;
  if (r > 10) return '> 1.000%';
  if (r < -10) return '(> 1.000%)';
  return pct(r);
};

export default function LabaRugi({ onBack }) {
  const data = useData();
  const phone = useMediaQuery('(max-width: 47.99em)');
  const ledger = useMemo(
    () => buildLedger(data),
    [data.sales, data.salesReturns, data.pb, data.stockMoves, data.products], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { range, cmpRange, compare, fieldProps } = usePeriodFilter();

  const pl = useMemo(() => incomeStatement(ledger, range[0], range[1]), [ledger, range[0], range[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => (cmpRange ? incomeStatement(ledger, cmpRange[0], cmpRange[1]) : null), [ledger, cmpRange?.[0], cmpRange?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const tree = useMemo(() => buildTree(pl, prev), [pl, prev]);

  const [mode, setMode] = useState('rinci');
  const [hideZero, setHideZero] = useState(true);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const t = pl.totals;
  const pt = prev?.totals ?? null;

  const rows = flatten(tree, t, pt, { mode: q ? 'rinci' : mode, hideZero, q });

  const labelA = shortLabel(range);
  const labelB = cmpRange ? shortLabel(cmpRange) : null;
  const periodLine = `${rangeText(range)}${compare ? ` dibandingkan ${rangeText(cmpRange)}` : ''}`;

  const exportAs = (format) => {
    const spec = {
      filename: `laba-rugi-${range[0]}_${range[1]}.${format}`,
      title: 'Laba Rugi',
      company: COMPANY.name,
      period: periodLine,
      headers: ['Kode', 'Akun', labelA, ...(compare ? [labelB, 'Perubahan', '%'] : [])],
      compare,
      lines: statementLines(flatten(tree, t, pt, { mode, hideZero, q: '' })),
      footnote: `Dihitung dari ${pl.count} jurnal antara ${formatDate(range[0])} dan ${formatDate(range[1])}. Angka dalam kurung berarti berlawanan dari saldo normal. Diekspor ${formatDate(TODAY)}.`,
      num,
    };
    if (format === 'pdf') exportStatementPdf(spec);
    else if (format === 'xlsx') exportStatementXlsx(spec);
    else exportStatementCsv(spec);
  };

  const delta = (a, b) => {
    if (!compare || b == null) return null;
    const d = Math.round(a - b);
    const since = `sejak ${labelB}`;
    return d === 0 ? `Tetap ${since}` : `${d > 0 ? 'Naik' : 'Turun'} ${rupiahShort(Math.abs(d))} ${since}`;
  };
  const totalPendapatan = t.pendapatan + t.lainMasuk;
  const noRevenue = !(t.pendapatan > 0);

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" w="100%">
      <BackLink label="Kembali ke Pusat Laporan" onClick={onBack} />
      <PageIntro
        icon={TrendUp}
        title="Laba Rugi"
        description="Pendapatan dikurangi beban dari jurnal Penjualan, Pembelian, dan Gudang. Klik akun untuk melihat jurnal pembentuknya."
        actions={
          <>
            <ActionIcon variant="default" size={36} radius="md" aria-label="Cetak laba rugi" onClick={() => window.print()}><Printer size={16} /></ActionIcon>
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

      <PeriodCard {...fieldProps} />

      <Card withBorder radius="lg" padding={0} bg="white">
        <Box className="bs-stats">
          <Stat
            label="Pendapatan"
            value={moneyShort(totalPendapatan)}
            negative={Math.round(totalPendapatan) < 0}
            delta={delta(totalPendapatan, pt ? pt.pendapatan + pt.lainMasuk : null)}
            parts={[['Pendapatan usaha', t.pendapatan], ['Pendapatan lain-lain', t.lainMasuk]]}
          />
          <Stat
            label="Laba kotor"
            value={moneyShort(t.labaKotor)}
            negative={Math.round(t.labaKotor) < 0}
            delta={delta(t.labaKotor, pt?.labaKotor)}
            parts={[['Pendapatan usaha', t.pendapatan], ['Harga pokok penjualan', t.hpp]]}
          />
          <Stat
            label="Beban"
            value={moneyShort(t.beban + t.lainKeluar)}
            negative={Math.round(t.beban + t.lainKeluar) < 0}
            delta={delta(t.beban + t.lainKeluar, pt ? pt.beban + pt.lainKeluar : null)}
            parts={[['Beban operasional', t.beban], ['Beban lain-lain', t.lainKeluar]]}
          />
          <Stat
            label="Laba bersih"
            value={moneyShort(t.labaBersih)}
            negative={Math.round(t.labaBersih) < 0}
            delta={delta(t.labaBersih, pt?.labaBersih)}
            parts={[['Laba sebelum pajak', t.labaSebelumPajak], ['Beban pajak penghasilan', t.pajak]]}
          />
        </Box>
        <Box className="bs-stats bs-ratios">
          <Ratio
            label="Margin kotor"
            value={ratioText(t.labaKotor, t.pendapatan)}
            note={noRevenue ? 'Belum ada pendapatan di periode ini' : 'Sisa pendapatan setelah harga pokok'}
          />
          <Ratio
            label="Margin bersih"
            value={ratioText(t.labaBersih, totalPendapatan)}
            note={!(totalPendapatan > 0) ? 'Belum ada pendapatan di periode ini'
              : t.labaBersih < 0 ? 'Bisnis merugi di periode ini'
                : 'Untung dari setiap rupiah pendapatan'}
          />
          <Ratio
            label="Rasio beban"
            value={ratioText(t.beban, t.pendapatan)}
            note={noRevenue ? 'Belum ada pendapatan di periode ini' : 'Bagian pendapatan yang habis untuk beban operasional'}
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
          <Text fz="lg" fw={700} c="slate.9">Laba Rugi</Text>
          <Text fz="sm" c="slate.7" ta="center">{periodLine}</Text>
        </Stack>
        <Box className="bs-sheet">
          <Table horizontalSpacing="md" verticalSpacing="sm" miw={compare ? 900 : 560} className={compare ? 'bs-table bs-cmp' : 'bs-table'}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={96} fz="xs" c="slate.7" className="bs-code">Kode</Table.Th>
                <Table.Th fz="xs" c="slate.7">Akun</Table.Th>
                <Table.Th w={170} fz="xs" c="slate.7" ta="right">{labelA}</Table.Th>
                {compare && (
                  <>
                    <Table.Th w={170} fz="xs" c="slate.7" ta="right">{labelB}</Table.Th>
                    <Table.Th w={150} fz="xs" c="slate.7" ta="right">Perubahan</Table.Th>
                    <Table.Th w={64} fz="xs" c="slate.7" ta="right">%</Table.Th>
                  </>
                )}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r, i) => <StatementRow key={`${r.type}-${r.key ?? r.row?.key ?? r.label}-${i}`} r={r} compare={compare} phone={phone} range={range} />)}
            </Table.Tbody>
          </Table>
        </Box>
        <Text fz="xs" c="slate.6" px="lg" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
          Dihitung dari {pl.count} jurnal antara {formatDate(range[0])} dan {formatDate(range[1])}: {Object.entries(pl.modules).map(([m, n]) => `${m} ${n}`).join(' · ') || 'belum ada jurnal'}. Angka dalam kurung berarti berlawanan dari saldo normal, tanda – berarti nol.
          {Math.round(t.pajak) === 0 && ' Beban pajak penghasilan (pajak kini dan tangguhan) belum ada di periode ini: biasanya dicatat lewat jurnal penyesuaian akhir periode, jadi laba bersih setelah pajak masih sama dengan laba sebelum pajak.'}
        </Text>
      </Card>

    </Stack>
  );
}
