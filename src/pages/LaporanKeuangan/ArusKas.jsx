// Laporan Arus Kas (PSAK 2) metode langsung: penerimaan dan pengeluaran kas per aktivitas
// (operasi, investasi, pendanaan), kas awal, dan kas akhir. Angkanya dari jurnal yang menyentuh
// akun Kas & Bank (ledger.js → cashFlow), dikelompokkan menurut akun lawannya. Di bawahnya:
// rekonsiliasi metode tidak langsung (laba bersih → kas operasi), saldo per rekening, dan
// transaksi investasi/pendanaan yang tidak memakai kas.
//
// Kas akhir selalu sama dengan saldo Kas & Bank di Neraca pada tanggal yang sama (rekening
// bersaldo minus di Neraca tampil sebagai Cerukan Bank, di sini tetap bagian dari kas).
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Menu,
  Stack,
  Switch,
  Table,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import { BackLink, PageIntro } from '@/components/common.jsx';
import { CaretDown, DownloadSimple, FileCsv, FilePdf, FileXls, Money, Printer } from '@/components/Icon.jsx';
import { COMPANY } from '@/lib/company.js';
import { useData } from '@/lib/store.jsx';
import { Callout } from '@/pages/Pembelian/components.jsx';
import { TODAY } from '@/pages/Penjualan/data.js';
import { addDays, formatDate, rupiah, rupiahShort } from '@/pages/Penjualan/utils.js';
import { describe } from './BukuBesar.jsx';
import { accountsByCode, balanceSheet, buildLedger, cashFlow, OVERDRAFT_CAT } from './ledger.js';
import { PeriodCard, rangeText, shortLabel, usePeriodFilter } from './PeriodFilter.jsx';
import { AccountLink, MODULE_COLOR, moneyShort, num, NumCells, Stat } from './StatementParts.jsx';
import { exportStatementCsv, exportStatementPdf, exportStatementXlsx } from './statementExport.js';

const openHref = (href) => { window.location.assign(href); window.scrollTo({ top: 0 }); };
const numCell = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' };

// Baris laporan utama (juga dipakai ekspor). Pos yang nol di kedua periode disembunyikan bila
// hideZero; seksi tetap tampil supaya susunannya tidak berubah-ubah.
function statementRows(cf, prev, { hideZero }) {
  const out = [];
  cf.sections.forEach((s, si) => {
    const ps = prev?.sections[si];
    out.push({ type: 'section', label: s.label });
    const items = s.items
      .map((it, ii) => ({ ...it, a: it.amount, b: ps ? ps.items[ii].amount : null }))
      .filter((it) => !hideZero || Math.round(it.a) !== 0 || Math.round(it.b ?? 0) !== 0);
    items.forEach((it) => out.push({ type: 'item', key: it.key, label: it.label, a: it.a, b: it.b, rows: it.rows }));
    if (!items.length) out.push({ type: 'empty', label: 'Tidak ada arus kas di aktivitas ini.' });
    out.push({ type: 'result', label: s.result, a: s.total, b: ps ? ps.total : null });
  });
  const b = (k) => (prev ? prev.totals[k] : null);
  out.push({ type: 'result', label: 'Kenaikan (penurunan) bersih kas dan setara kas', a: cf.totals.net, b: b('net') });
  out.push({ type: 'total', label: 'Kas dan setara kas awal periode', a: cf.totals.opening, b: b('opening') });
  out.push({ type: 'grand', label: 'Kas dan setara kas akhir periode', a: cf.totals.closing, b: b('closing') });
  return out;
}

function reconRows(cf, prev) {
  const rows = [{ type: 'item', label: 'Laba (rugi) bersih', a: cf.indirect.laba, b: prev ? prev.indirect.laba : null }];
  cf.indirect.adjustments.forEach((x, i) => {
    const b = prev ? prev.indirect.adjustments[i].amount : null;
    if (Math.round(x.amount) !== 0 || Math.round(b ?? 0) !== 0) rows.push({ type: 'item', label: x.label, a: x.amount, b });
  });
  rows.push({ type: 'grand', label: 'Kas bersih dari aktivitas operasi', a: cf.indirect.operasi, b: prev ? prev.indirect.operasi : null });
  return rows;
}

function JournalLine({ entry: e, amount, cols }) {
  return (
    <Table.Tr className="bs-line" onClick={() => openHref(e.journalHref)} style={{ cursor: 'pointer' }}>
      <Table.Td pl={44}>
        <Group gap={8} wrap="nowrap">
          <Text span fz="xs" c="slate.6" style={{ whiteSpace: 'nowrap' }}>{formatDate(e.date)}</Text>
          <UnstyledButton
            component="a"
            href={e.journalHref}
            fz="xs"
            fw={700}
            c="primary.9"
            onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); openHref(e.journalHref); }}
          >
            #{e.no}
          </UnstyledButton>
          <Text span fz="xs" c="slate.8" lineClamp={1}>{describe(e)}</Text>
          <Badge size="xs" radius="sm" variant="light" color={MODULE_COLOR[e.module]} tt="none" style={{ flexShrink: 0 }}>{e.module}</Badge>
        </Group>
      </Table.Td>
      <Table.Td style={numCell}><Text span fz="xs" c={Math.round(amount) < 0 ? 'red.8' : 'slate.8'}>{num(amount)}</Text></Table.Td>
      {cols > 2 && <Table.Td colSpan={cols - 2} />}
    </Table.Tr>
  );
}

function Row({ r, compare, open, onToggle }) {
  const cols = compare ? 5 : 2;
  switch (r.type) {
    case 'section':
      return (
        <Table.Tr className="bs-section">
          <Table.Td colSpan={cols}><Text fz="sm" fw={700} c="slate.9">{r.label}</Text></Table.Td>
        </Table.Tr>
      );
    case 'empty':
      return (
        <Table.Tr>
          <Table.Td colSpan={cols} pl={44}><Text fz="xs" c="slate.6">{r.label}</Text></Table.Td>
        </Table.Tr>
      );
    case 'item': {
      const can = r.rows?.length > 0;
      return (
        <>
          <Table.Tr className={can ? 'bs-line' : undefined} onClick={can ? onToggle : undefined} style={can ? { cursor: 'pointer' } : undefined}>
            <Table.Td>
              <Group gap={6} wrap="nowrap">
                <Box w={22} className="no-print">
                  {can && (
                    <ActionIcon variant="subtle" color="slate" size="sm" aria-label={open ? `Tutup rincian ${r.label}` : `Lihat rincian ${r.label}`} aria-expanded={open} onClick={(ev) => { ev.stopPropagation(); onToggle(); }}>
                      <CaretDown size={14} style={{ transform: open ? undefined : 'rotate(-90deg)', transition: 'transform 150ms' }} />
                    </ActionIcon>
                  )}
                </Box>
                <Text fz="sm" c="slate.9">{r.label}</Text>
                {can && <Text span fz={11} c="slate.6" style={{ whiteSpace: 'nowrap' }}>{r.rows.length} jurnal</Text>}
              </Group>
            </Table.Td>
            <NumCells a={r.a} b={r.b} compare={compare} />
          </Table.Tr>
          {open && r.rows.map((x, i) => <JournalLine key={`${x.entry.id}-${i}`} entry={x.entry} amount={x.amount} cols={cols} />)}
        </>
      );
    }
    default:
      return (
        <Table.Tr className={r.type === 'grand' ? 'bs-total bs-grand' : 'bs-total'}>
          <Table.Td><Text fz="sm" fw={r.type === 'total' ? 600 : 700} c="slate.9">{r.label}</Text></Table.Td>
          <NumCells a={r.a} b={r.b} compare={compare} fw={r.type === 'total' ? 600 : 700} />
        </Table.Tr>
      );
  }
}

function StatementTable({ rows, compare, labelA, labelB, expanded, toggle, head = 'Keterangan' }) {
  return (
    <Box className="bs-sheet">
      <Table horizontalSpacing="md" verticalSpacing="sm" miw={compare ? 900 : 560} className="bs-table">
        <Table.Thead>
          <Table.Tr>
            <Table.Th fz="xs" c="slate.7">{head}</Table.Th>
            <Table.Th w={180} fz="xs" c="slate.7" ta="right">{labelA}</Table.Th>
            {compare && (
              <>
                <Table.Th w={180} fz="xs" c="slate.7" ta="right">{labelB}</Table.Th>
                <Table.Th w={150} fz="xs" c="slate.7" ta="right">Perubahan</Table.Th>
                <Table.Th w={64} fz="xs" c="slate.7" ta="right">%</Table.Th>
              </>
            )}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r, i) => (
            <Row key={`${r.type}-${r.key ?? r.label}-${i}`} r={r} compare={compare} open={!!expanded?.has(r.key)} onToggle={() => toggle?.(r.key)} />
          ))}
        </Table.Tbody>
      </Table>
    </Box>
  );
}

const SheetHead = ({ title, period }) => (
  <Stack gap={2} align="center" px="lg" pt="lg" pb="md">
    <Text fz="sm" c="slate.7">{COMPANY.name}</Text>
    <Text fz="lg" fw={700} c="slate.9">{title}</Text>
    <Text fz="sm" c="slate.7" ta="center">{period}</Text>
  </Stack>
);
const Foot = ({ children }) => (
  <Text fz="xs" c="slate.6" px="lg" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>{children}</Text>
);

// Saldo Kas & Bank menurut Neraca: aset Kas & Bank dikurangi Cerukan Bank (rekening minus).
function cashInBalanceSheet(bs) {
  let n = 0;
  bs.sections.forEach((s) => s.groups.forEach((g) => g.accounts.forEach((a) => {
    if (a.category === 'Kas & Bank') n += a.balance;
    if (a.category === OVERDRAFT_CAT) n -= a.balance;
  })));
  return n;
}

export default function ArusKas({ onBack }) {
  const data = useData();
  const ledger = useMemo(
    () => buildLedger(data),
    [data.sales, data.salesReturns, data.pb, data.stockMoves, data.products], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const { range, cmpRange, compare, fieldProps } = usePeriodFilter();
  const cf = useMemo(() => cashFlow(ledger, range[0], range[1]), [ledger, range[0], range[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => (cmpRange ? cashFlow(ledger, cmpRange[0], cmpRange[1]) : null), [ledger, cmpRange?.[0], cmpRange?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const kasNeraca = useMemo(() => cashInBalanceSheet(balanceSheet(ledger, range[1])), [ledger, range[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const [hideZero, setHideZero] = useState(true);
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (k) => setExpanded((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const t = cf.totals;
  const pt = prev?.totals ?? null;
  const rows = statementRows(cf, prev, { hideZero });
  const recon = reconRows(cf, prev);
  const selisih = Math.round(t.closing - kasNeraca);
  const labelA = shortLabel(range);
  const labelB = cmpRange ? shortLabel(cmpRange) : null;
  const periodLine = `${rangeText(range)}${compare ? ` dibandingkan ${rangeText(cmpRange)}` : ''}`;
  const itemRows = rows.filter((r) => r.type === 'item' && r.rows?.length).map((r) => r.key);
  const allOpen = itemRows.length > 0 && itemRows.every((k) => expanded.has(k));

  const delta = (a, b) => {
    if (!compare || b == null) return null;
    const d = Math.round(a - b);
    const since = `sejak ${labelB}`;
    return d === 0 ? `Tetap ${since}` : `${d > 0 ? 'Naik' : 'Turun'} ${rupiahShort(Math.abs(d))} ${since}`;
  };

  const exportAs = (format) => {
    const toLine = (r) => (r.type === 'item' ? { type: 'account', code: '', label: r.label, sub: '', a: r.a, b: r.b }
      : r.type === 'empty' ? null
        : { type: r.type, label: r.label, a: r.a, b: r.b });
    const lines = [
      ...statementRows(cf, prev, { hideZero }).map(toLine).filter(Boolean),
      { type: 'section', label: 'Rekonsiliasi laba bersih ke kas bersih dari aktivitas operasi' },
      ...recon.map((r) => ({ ...toLine(r), type: r.type === 'grand' ? 'result' : 'account' })),
    ];
    const spec = {
      filename: `arus-kas-${range[0]}_${range[1]}.${format}`,
      title: 'Arus Kas',
      company: COMPANY.name,
      period: periodLine,
      headers: ['Keterangan', '', labelA, ...(compare ? [labelB, 'Perubahan', '%'] : [])],
      compare,
      lines,
      footnote: `Metode langsung (PSAK 2), dari ${cf.count} jurnal kas. Angka dalam kurung = kas keluar. Diekspor ${formatDate(TODAY)}.`,
      num,
    };
    if (format === 'pdf') exportStatementPdf(spec);
    else if (format === 'xlsx') exportStatementXlsx(spec);
    else exportStatementCsv(spec);
  };

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" w="100%">
      <BackLink label="Kembali ke Pusat Laporan" onClick={onBack} />
      <PageIntro
        icon={Money}
        title="Arus Kas"
        description="Uang yang benar-benar masuk dan keluar dari kas dan rekening bank, dikelompokkan ke aktivitas operasi, investasi, dan pendanaan. Klik pos untuk melihat jurnal pembentuknya."
        actions={
          <>
            <ActionIcon variant="default" size={36} radius="md" aria-label="Cetak arus kas" onClick={() => window.print()}><Printer size={16} /></ActionIcon>
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

      {selisih !== 0 && (
        <Callout tone="warn" title="Kas akhir tidak sama dengan Neraca">
          Kas akhir arus kas {rupiah(t.closing)}, sedangkan Kas & Bank di Neraca per {formatDate(range[1])} {rupiah(kasNeraca)}. Periksa kategori akun Kas & Bank di Daftar Akun.
        </Callout>
      )}
      {Math.round(t.closing) < 0 && (
        <Callout tone="info" title="Kas akhir minus">
          Pengeluaran kas lebih besar dari kas yang tersedia, jadi kas akhir {moneyShort(t.closing)}. Biasanya karena saldo awal kas atau penerimaan belum dicatat; di Neraca rekening yang minus tampil sebagai Cerukan Bank.
        </Callout>
      )}

      <Card withBorder radius="lg" padding={0} bg="white">
        <Box className="bs-stats">
          <Stat label="Kas awal periode" value={moneyShort(t.opening)} negative={Math.round(t.opening) < 0} delta={`Per ${formatDate(addDays(range[0], -1))}`} />
          <Stat
            label="Kas masuk"
            value={moneyShort(t.inflow)}
            delta={delta(t.inflow, pt?.inflow) ?? `${cf.count} jurnal kas`}
            parts={cf.sections.map((s) => [s.label.replace('Arus kas dari aktivitas ', 'Dari '), s.items.reduce((n, i) => n + i.inflow, 0)])}
          />
          <Stat
            label="Kas keluar"
            value={moneyShort(t.outflow)}
            delta={delta(t.outflow, pt?.outflow)}
            parts={cf.sections.map((s) => [s.label.replace('Arus kas dari aktivitas ', 'Untuk '), s.items.reduce((n, i) => n + i.outflow, 0)])}
          />
          <Stat
            label="Kas akhir periode"
            value={moneyShort(t.closing)}
            negative={Math.round(t.closing) < 0}
            delta={delta(t.closing, pt?.closing) ?? `Per ${formatDate(range[1])}`}
            parts={[['Kenaikan (penurunan) kas', t.net], ['Kas & Bank di Neraca', selisih === 0 ? 'Cocok' : moneyShort(kasNeraca)]]}
          />
        </Box>
      </Card>

      <Card withBorder radius="lg" padding={0} bg="white">
        <Group justify="flex-end" gap="lg" px="lg" py="sm" bg="slate.0" className="no-print" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
          <Switch size="sm" label="Sembunyikan pos nol" checked={hideZero} onChange={(e) => setHideZero(e.currentTarget.checked)} />
          <Button size="sm" variant="default" radius="md" disabled={!itemRows.length} onClick={() => setExpanded(allOpen ? new Set() : new Set(itemRows))}>
            {allOpen ? 'Tutup semua rincian' : 'Buka semua rincian'}
          </Button>
        </Group>
        <SheetHead title="Arus Kas" period={periodLine} />
        <StatementTable rows={rows} compare={compare} labelA={labelA} labelB={labelB} expanded={expanded} toggle={toggle} />
        <Foot>
          Metode langsung: dihitung dari {cf.count} jurnal yang menyentuh akun Kas & Bank antara {formatDate(range[0])} dan {formatDate(range[1])}
          {cf.transfers.length > 0 && `, tidak termasuk ${cf.transfers.length} pindah dana antar rekening sendiri`}. Pos ditentukan dari akun lawan kas; pelunasan faktur yang barangnya aset tetap ditelusuri sampai penerimaan barangnya dan dicatat sebagai investasi. Angka dalam kurung berarti kas keluar.
        </Foot>
      </Card>

      <Card withBorder radius="lg" padding={0} bg="white">
        <SheetHead title="Rekonsiliasi laba bersih ke kas operasi" period="Metode tidak langsung" />
        <StatementTable rows={recon} compare={compare} labelA={labelA} labelB={labelB} />
        <Foot>
          Menjelaskan kenapa laba berbeda dengan kas: pendapatan yang belum ditagih menambah piutang, pembelian yang belum dibayar menambah utang. Hasil akhirnya selalu sama dengan kas bersih operasi di laporan utama.
        </Foot>
      </Card>

      <Card withBorder radius="lg" padding={0} bg="white">
        <Group px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
          <Text fw={700} c="slate.9">Saldo per rekening</Text>
          <Text fz="sm" c="slate.6">{rangeText(range)}</Text>
        </Group>
        <Box className="bs-sheet">
          <Table horizontalSpacing="md" verticalSpacing="sm" miw={760} className="bs-table">
            <Table.Thead>
              <Table.Tr>
                {['Rekening', 'Saldo awal', 'Masuk', 'Keluar', 'Saldo akhir'].map((h, i) => (
                  <Table.Th key={h} fz="xs" c="slate.7" ta={i ? 'right' : undefined} w={i ? 160 : undefined}>{h}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {cf.accounts.map((a) => (
                <Table.Tr key={a.code}>
                  <Table.Td>
                    <Group gap={8} wrap="nowrap">
                      <Text span fz="sm" c="slate.6" style={{ fontVariantNumeric: 'tabular-nums' }}>{a.code}</Text>
                      <AccountLink code={a.code} range={range}>{a.name}</AccountLink>
                    </Group>
                  </Table.Td>
                  {[a.opening, a.inflow, -a.outflow, a.closing].map((v, i) => (
                    <Table.Td key={i} style={numCell}><Text span fz="sm" fw={i === 3 ? 600 : 400} c={Math.round(v) < 0 ? 'red.8' : 'slate.9'}>{num(v)}</Text></Table.Td>
                  ))}
                </Table.Tr>
              ))}
              {!cf.accounts.length && (
                <Table.Tr><Table.Td colSpan={5}><Text fz="sm" c="slate.6" ta="center">Belum ada transaksi kas sampai tanggal ini.</Text></Table.Td></Table.Tr>
              )}
              {cf.accounts.length > 0 && (
                <Table.Tr className="bs-total bs-grand">
                  <Table.Td><Text fz="sm" fw={700} c="slate.9">Total kas dan setara kas</Text></Table.Td>
                  {[t.opening, cf.accounts.reduce((n, a) => n + a.inflow, 0), -cf.accounts.reduce((n, a) => n + a.outflow, 0), t.closing].map((v, i) => (
                    <Table.Td key={i} style={numCell}><Text span fz="sm" fw={700} c={Math.round(v) < 0 ? 'red.8' : 'slate.9'}>{num(v)}</Text></Table.Td>
                  ))}
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>
        <Foot>Masuk dan keluar per rekening termasuk pindah dana antar rekening sendiri; di laporan utama pindah dana tidak dihitung karena kas perusahaan tidak berubah.</Foot>
      </Card>

      {cf.nonCash.length > 0 && (
        <Card withBorder radius="lg" padding={0} bg="white">
          <Group px="lg" py="md" gap="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
            <Text fw={700} c="slate.9">Aktivitas investasi dan pendanaan tanpa kas</Text>
            <Badge size="sm" radius="sm" variant="light" color="slate">{cf.nonCash.length} jurnal</Badge>
          </Group>
          <Box className="bs-sheet">
            <Table horizontalSpacing="md" verticalSpacing="sm" miw={760} className="bs-table">
              <Table.Thead>
                <Table.Tr>
                  {['Tanggal', 'No. Jurnal', 'Transaksi', 'Akun', 'Nilai'].map((h, i) => (
                    <Table.Th key={h} fz="xs" c="slate.7" ta={i === 4 ? 'right' : undefined}>{h}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cf.nonCash.map(({ entry: e, lines }) => (
                  <Table.Tr key={e.id} className="bs-line" onClick={() => openHref(e.journalHref)} style={{ cursor: 'pointer' }}>
                    <Table.Td style={{ whiteSpace: 'nowrap' }}><Text fz="sm" c="slate.8">{formatDate(e.date)}</Text></Table.Td>
                    <Table.Td><Text fz="sm" fw={700} c="primary.9">#{e.no}</Text></Table.Td>
                    <Table.Td><Text fz="sm" c="slate.9">{describe(e)}</Text></Table.Td>
                    <Table.Td>
                      {lines.map((l, i) => (
                        <Group key={i} gap={6} wrap="nowrap">
                          <Text span fz="xs" c="slate.6">{l.code}</Text>
                          <AccountLink code={l.code} range={range} fz="xs">{accountsByCode[l.code]?.name ?? l.name ?? l.code}</AccountLink>
                        </Group>
                      ))}
                    </Table.Td>
                    <Table.Td style={numCell}><Text span fz="sm" c="slate.9">{num(lines.reduce((n, l) => n + Math.abs(l.debit - l.credit), 0))}</Text></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
          <Foot>
            Transaksi ini mengubah aset atau ekuitas tanpa memakai kas, misalnya aset tetap yang diterima tapi belum dibayar atau saldo awal persediaan. Sesuai PSAK 2 tidak masuk laporan arus kas, tapi diungkapkan di sini. Saat utangnya dilunasi, pembayarannya masuk aktivitas investasi sebagai perolehan aset tetap.
          </Foot>
        </Card>
      )}
    </Stack>
  );
}
