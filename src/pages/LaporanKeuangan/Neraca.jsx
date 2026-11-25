// Laporan Neraca (Laporan Posisi Keuangan). Angkanya dihitung dari jurnal otomatis semua modul
// transaksi (lihat ledger.js), jadi setiap dokumen yang berjurnal langsung terlihat di sini.
//
// Disajikan seperti laporan keuangan baku yang dibaca akuntan: vertikal (aset, liabilitas,
// ekuitas), kode akun di kolom sendiri, subtotal "Jumlah …" di bawah rinciannya, kolom
// pembanding beserta perubahannya, dan angka tanpa "Rp" (mata uangnya ditulis sekali di kepala).
// Klik akun untuk melihat jurnal yang membentuk saldonya.
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
  UnstyledButton,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useMemo, useState } from 'react';
import { BackLink, FormModal, PageIntro } from '@/components/common.jsx';
import { CaretDown, CaretRight, DownloadSimple, FileCsv, FilePdf, FileXls, MagnifyingGlass, Notebook, Printer, Scales } from '@/components/Icon.jsx';
import { COMPANY } from '@/lib/company.js';
import { useData } from '@/lib/store.jsx';
import { Callout } from '@/pages/Pembelian/components.jsx';
import { TODAY } from '@/pages/Penjualan/data.js';
import { formatDate, rupiah, rupiahShort } from '@/pages/Penjualan/utils.js';
import { PeriodCard, rangeText, usePeriodFilter } from './PeriodFilter.jsx';
import { AccountLink, accountHref, Amount, iso, LeadCell, MutationTable, num, NumCells, pct, Ratio, Stat, times, moneyShort } from './StatementParts.jsx';
import { exportStatementCsv, exportStatementPdf, exportStatementXlsx, statementLines } from './statementExport.js';
import { accountMutations, balanceSheet, buildLedger, LABA_DITAHAN, profitBreakdown } from './ledger.js';

function AccountModal({ target, opened, ledger, asOf, onClose }) {
  const yearStart = `${asOf.slice(0, 4)}-01-01`;
  const dayBefore = iso(new Date(Date.UTC(Number(asOf.slice(0, 4)), 0, 0)));
  const laba = target.code === null
    ? profitBreakdown(ledger, yearStart, asOf)
    : target.code === LABA_DITAHAN && target.extra
      ? profitBreakdown(ledger, null, dayBefore)
      : null;
  const rows = target.code ? accountMutations(ledger, target.code, asOf, target.sign) : [];

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={920}
      icon={Notebook}
      title={target.code ? `${target.code} · ${target.name}` : target.name}
      subtitle={`Saldo per ${formatDate(asOf)}: ${target.balance < 0 ? `(${rupiah(-target.balance)})` : rupiah(target.balance)}`}
      footer={<Button variant="default" radius="md" onClick={onClose}>Tutup</Button>}
    >
      {laba && (
        <>
          <Text fz="xs" c="slate.7">
            {target.code === null
              ? `Pendapatan dikurangi beban dari ${formatDate(yearStart)} sampai ${formatDate(asOf)}. Akun laba rugi tidak tampil di neraca; hasil bersihnya masuk ke sini.`
              : `Laba rugi sampai ${formatDate(dayBefore)} yang belum ditutup ke akun Laba Ditahan.`}
          </Text>
          <Box className="table-frame" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)', overflow: 'auto' }}>
            <Table verticalSpacing="xs" horizontalSpacing="md" miw={520}>
              <Table.Thead bg="slate.0">
                <Table.Tr>
                  <Table.Th fz="xs" c="slate.7">AKUN</Table.Th>
                  <Table.Th fz="xs" c="slate.7">KATEGORI</Table.Th>
                  <Table.Th fz="xs" c="slate.7" ta="right">LABA (RUGI)</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {laba.map((r) => (
                  <Table.Tr key={r.code}>
                    <Table.Td fz="sm">{r.code} · {r.name}</Table.Td>
                    <Table.Td fz="xs" c="slate.6">{r.category}</Table.Td>
                    <Table.Td><Amount value={r.amount} /></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {!laba.length && <Text fz="xs" c="slate.6" ta="center" py="md">Belum ada jurnal pendapatan atau beban di periode ini.</Text>}
          </Box>
        </>
      )}
      {target.code && (
        <>
          {laba && <Text fz="xs" fw={700} c="slate.9" mt="xs">Jurnal ke akun {target.code}</Text>}
          <MutationTable rows={rows} onOpen={onClose} />
        </>
      )}
    </FormModal>
  );
}

// --- Susunan laporan ---------------------------------------------------------------------------
// Gabungkan neraca tanggal laporan dan pembandingnya jadi satu pohon: pos → kelompok → kategori →
// akun. Tingkat yang hanya punya satu anak dengan nama yang sama dilewati (mis. Ekuitas).
function buildTree(cur, prev) {
  return cur.sections.map((s, si) => {
    const ps = prev?.sections[si];
    const groups = s.groups.map((g, gi) => {
      const pg = ps?.groups[gi];
      const map = new Map();
      const put = (a, side) => {
        const key = a.code ?? a.name;
        const row = map.get(key) ?? { key, code: a.code, name: a.name, category: a.category, derived: a.derived, extra: a.extra, a: 0, b: prev ? 0 : null, src: a };
        row[side] = a.balance;
        if (side === 'a') row.src = a;
        map.set(key, row);
      };
      g.accounts.forEach((a) => put(a, 'a'));
      pg?.accounts.forEach((a) => put(a, 'b'));
      const rows = [...map.values()].sort((x, y) => (x.code ?? '9').localeCompare(y.code ?? '9'));
      const cats = g.cats.map((c) => {
        const accounts = rows.filter((r) => r.category === c);
        return { label: c, accounts };
      });
      return { key: `${s.key}.${g.key}`, label: g.label, cats, a: g.total, b: pg ? pg.total : null, sign: s.sign };
    });
    return { key: s.key, label: s.label, groups, a: s.total, b: ps ? ps.total : null, sign: s.sign };
  });
}

const sumRows = (rows, side) => rows.reduce((n, r) => n + (r[side] ?? 0), 0);

// Baris-baris tabel sesuai mode, filter saldo nol, dan pencarian. Bentuknya mengikuti tabel
// neraca di aplikasi utama: nama akun rata di satu garis dengan kategorinya di bawah, dan
// baris kelompok berlatar abu yang membawa jumlah akun dan subtotalnya sendiri.
function flatten(tree, { mode, hideZero, q, compare, collapsed }) {
  const out = [];
  const keep = (r) => (!hideZero || Math.round(r.a) !== 0 || Math.round(r.b ?? 0) !== 0)
    && (!q || `${r.code ?? ''} ${r.name}`.toLowerCase().includes(q));
  const sentence = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  tree.forEach((s) => {
    out.push({ type: 'section', label: s.label });
    const multiGroup = s.groups.length > 1;
    s.groups.forEach((g) => {
      const all = g.cats.flatMap((c) => c.accounts);
      const rows = all.filter(keep);
      if (!rows.length && (hideZero || q) && multiGroup) return;
      const shut = collapsed.has(g.key);
      if (multiGroup) out.push({ type: 'group', key: g.key, label: sentence(g.label), count: rows.length, shut, a: g.a, b: g.b });
      if (shut) return;
      if (mode === 'ringkas' && g.cats.length > 1) {
        g.cats.forEach((c) => {
          const vis = c.accounts.filter(keep);
          if (!vis.length) return;
          out.push({ type: 'cat-sum', label: c.label, count: vis.length, a: sumRows(c.accounts, 'a'), b: compare ? sumRows(c.accounts, 'b') : null });
        });
      } else {
        rows.forEach((r) => out.push({ type: 'account', row: r, sign: g.sign }));
      }
      if (!rows.length) out.push({ type: 'empty', search: !!q && all.length > 0 });
    });
    out.push({ type: 'total', label: `Total ${s.label.split(' (')[0].toLowerCase()}`, a: s.a, b: s.b });
  });
  return out;
}

function StatementRow({ r, compare, phone, onToggle, onPick, range }) {
  const cols = compare ? 6 : 3;
  switch (r.type) {
    case 'section':
      return (
        <Table.Tr className="bs-section">
          <Table.Td colSpan={cols}><Text fz="sm" fw={700} c="slate.9">{r.label}</Text></Table.Td>
        </Table.Tr>
      );
    case 'group':
      return (
        <Table.Tr className="bs-group">
          <LeadCell phone={phone}>
            <UnstyledButton onClick={() => onToggle(r.key)} aria-expanded={!r.shut}>
              <Group gap={6} wrap="nowrap">
                <Box c="slate.6" style={{ display: 'flex' }}>{r.shut ? <CaretRight size={12} /> : <CaretDown size={12} />}</Box>
                <Text fz="sm" fw={600} c="slate.9">{r.label}</Text>
                <Text fz="xs" c="slate.6">{r.count}</Text>
              </Group>
            </UnstyledButton>
          </LeadCell>
          <NumCells a={r.a} b={r.b} compare={compare} fw={600} />
        </Table.Tr>
      );
    case 'cat-sum':
      return (
        <Table.Tr>
          <Table.Td className="bs-code" />
          <Table.Td>
            <Text fz="sm" c="slate.9">{r.label}</Text>
            <Text fz={11} c="slate.6">{r.count} akun</Text>
          </Table.Td>
          <NumCells a={r.a} b={r.b} compare={compare} />
        </Table.Tr>
      );
    case 'account': {
      const a = r.row;
      // Akun turunan (Laba Tahun Berjalan, laba tahun lalu di Laba Ditahan) bukan akun buku besar:
      // rinciannya dibuka di jendela. Akun lain menuju halaman detail akun dengan periode laporan.
      const derived = a.code === null || (a.code === LABA_DITAHAN && a.extra);
      const open = derived
        ? () => onPick({ ...a.src, balance: a.a, sign: r.sign })
        : () => { window.location.hash = accountHref(a.code, range).slice(1); };
      return (
        <Table.Tr className="bs-line" onClick={open} style={{ cursor: 'pointer' }}>
          <Table.Td className="bs-code"><Text fz="xs" c="slate.6" style={{ fontVariantNumeric: 'tabular-nums' }}>{a.code ?? '–'}</Text></Table.Td>
          <Table.Td>
            {derived ? (
              <UnstyledButton fz="sm" fw={500} c="primary.9" onClick={(e) => { e.stopPropagation(); open(); }} style={{ textAlign: 'left' }}>
                {a.name}
              </UnstyledButton>
            ) : <AccountLink code={a.code} range={range}>{a.name}</AccountLink>}
            <Text fz={11} c="slate.6">{a.derived ? 'Dari pendapatan dan beban' : a.category}</Text>
          </Table.Td>
          <NumCells a={a.a} b={a.b} compare={compare} />
        </Table.Tr>
      );
    }
    case 'total':
      return (
        <Table.Tr className="bs-total">
          <LeadCell phone={phone}><Text fz="sm" fw={700} c="slate.9">{r.label}</Text></LeadCell>
          <NumCells a={r.a} b={r.b} compare={compare} fw={700} />
        </Table.Tr>
      );
    case 'empty':
      return (
        <Table.Tr>
          <Table.Td colSpan={cols}><Text fz="xs" c="slate.6">{r.search ? 'Tidak ada akun yang cocok dengan pencarian.' : 'Tidak ada akun tercatat.'}</Text></Table.Td>
        </Table.Tr>
      );
    default:
      return null;
  }
}

export default function Neraca({ onBack }) {
  const data = useData();
  const phone = useMediaQuery('(max-width: 47.99em)');
  const ledger = useMemo(
    () => buildLedger(data),
    [data.sales, data.salesReturns, data.pb, data.stockMoves, data.products], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Filter sama dengan Laba Rugi; neraca memakai tanggal akhir periode sebagai tanggal posisinya.
  const { range, cmpRange, compare, fieldProps } = usePeriodFilter();
  const asOf = range[1];
  const cmpDate = cmpRange?.[1] ?? null;
  const periodLine = `${rangeText(range)}${compare ? ` dibandingkan ${rangeText(cmpRange)}` : ''}`;

  const bs = useMemo(() => balanceSheet(ledger, asOf), [ledger, asOf]);
  const prev = useMemo(() => (cmpDate ? balanceSheet(ledger, cmpDate) : null), [ledger, cmpDate]);
  const tree = useMemo(() => buildTree(bs, prev), [bs, prev]);

  const [mode, setMode] = useState('rinci');
  const [hideZero, setHideZero] = useState(true);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(() => new Set());
  // Akun terakhir yang dibuka tetap disimpan saat modal ditutup, supaya isinya tidak hilang
  // selama animasi tutup.
  const [target, setTarget] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const t = bs.totals;
  const q = query.trim().toLowerCase();

  const rows = flatten(tree, { mode: q ? 'rinci' : mode, hideZero, q, compare, collapsed });
  const toggle = (key) => setCollapsed((s) => {
    const n = new Set(s);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    return n;
  });
  const pick = (a) => { setTarget(a); setModalOpen(true); };
  const seimbang = Math.round(t.selisih) === 0;
  const pasivaA = t.liab + t.ekuitas;
  const pasivaB = prev ? prev.totals.liab + prev.totals.ekuitas : null;

  // Ekspor memakai baris yang sama dengan layar (mode & saldo nol ikut), tanpa filter cari/lipat.
  const exportAs = (format) => {
    const spec = {
      filename: `neraca-${asOf}.${format}`,
      title: 'Neraca',
      company: COMPANY.name,
      period: periodLine,
      headers: ['Kode', 'Akun', formatDate(asOf), ...(compare ? [formatDate(cmpDate), 'Perubahan', '%'] : [])],
      compare,
      lines: statementLines(flatten(tree, { mode, hideZero, q: '', compare, collapsed: new Set() }), { a: pasivaA, b: pasivaB }),
      footnote: `Dihitung dari ${bs.count} jurnal sampai ${formatDate(asOf)}. Angka dalam kurung berarti minus.${bs.overdrafts.length ? ' Rekening bank bersaldo minus disajikan sebagai Cerukan Bank (liabilitas jangka pendek).' : ''} Diekspor ${formatDate(TODAY)}.`,
      num,
    };
    if (format === 'pdf') exportStatementPdf(spec);
    else if (format === 'xlsx') exportStatementXlsx(spec);
    else exportStatementCsv(spec);
  };

  const prevT = prev?.totals;
  const delta = (a, b) => {
    if (!compare || b == null) return null;
    const d = Math.round(a - b);
    const since = `sejak ${formatDate(cmpDate)}`;
    return d === 0 ? `Tetap ${since}` : `${d > 0 ? 'Naik' : 'Turun'} ${rupiahShort(Math.abs(d))} ${since}`;
  };

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" w="100%">
      <BackLink label="Kembali ke Pusat Laporan" onClick={onBack} />
      <PageIntro
        icon={Scales}
        title="Neraca"
        description="Laporan posisi keuangan dari jurnal Penjualan, Pembelian, dan Gudang. Klik akun untuk melihat jurnal pembentuknya."
        actions={
          <>
            <ActionIcon variant="default" size={36} radius="md" aria-label="Cetak neraca" onClick={() => window.print()}><Printer size={16} /></ActionIcon>
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

      {bs.unmapped.length > 0 && (
        <Callout tone="warn" title={`${bs.unmapped.length} akun belum masuk pos neraca`}>
          Kategorinya tidak dikenali, jadi neraca tidak seimbang: {bs.unmapped.map((a) => a.code ?? a.name).join(', ')}. Atur kategorinya di Daftar Akun.
        </Callout>
      )}

      {bs.overdrafts.length > 0 && (
        <Callout tone="info" title={`${bs.overdrafts.length} rekening bank bersaldo minus disajikan sebagai cerukan`}>
          {bs.overdrafts.map((o) => `${o.name} ${rupiah(o.balance)}`).join(', ')} bersaldo kredit per {formatDate(asOf)}, jadi dicatat sebagai Cerukan Bank di Liabilitas jangka pendek, bukan aset minus. Saldo akunnya tidak berubah; periksa apakah ada penerimaan atau saldo awal yang belum dicatat.
        </Callout>
      )}

      {/* Statistik: setiap sel berbentuk sama — label, angka, perubahan, lalu rincian label-angka. */}
      <Card withBorder radius="lg" padding={0} bg="white">
        <Box className="bs-stats">
          <Stat
            label="Total aset"
            value={moneyShort(t.aset)}
            negative={Math.round(t.aset) < 0}
            delta={delta(t.aset, prevT?.aset)}
            parts={[['Aset lancar', t.asetLancar], ['Aset tidak lancar', t.asetTidakLancar + t.penyusutan]]}
          />
          <Stat
            label="Total liabilitas"
            value={moneyShort(t.liab)}
            negative={Math.round(t.liab) < 0}
            delta={delta(t.liab, prevT?.liab)}
            parts={[['Jangka pendek', t.liabPendek], ['Jangka panjang', t.liabPanjang]]}
          />
          <Stat
            label="Total ekuitas"
            value={moneyShort(t.ekuitas)}
            negative={Math.round(t.ekuitas) < 0}
            delta={delta(t.ekuitas, prevT?.ekuitas)}
            parts={[['Modal & laba ditahan', t.ekuitas - bs.labaBerjalan], ['Laba tahun ini', bs.labaBerjalan]]}
          />
          <Stat
            label="Persamaan akuntansi"
            value={seimbang ? 'Seimbang' : `Selisih ${rupiahShort(Math.abs(t.selisih))}`}
            tone={seimbang ? 'green.8' : 'red.8'}
            delta={`${bs.count} jurnal sampai ${formatDate(asOf)}`}
            parts={[['Aset', t.aset], ['Liabilitas + ekuitas', pasivaA]]}
          />
        </Box>
        <Box className="bs-stats bs-ratios">
          <Ratio
            label="Rasio lancar"
            value={t.liabPendek > 0 ? times(t.asetLancar / t.liabPendek) : '–'}
            note={t.liabPendek <= 0 ? 'Belum ada liabilitas jangka pendek'
              : t.asetLancar >= t.liabPendek ? 'Aset lancar cukup menutup utang jangka pendek'
              : 'Aset lancar belum cukup menutup utang jangka pendek'}
          />
          <Ratio
            label="Rasio utang"
            value={t.aset > 0 ? pct(t.liab / t.aset) : '–'}
            note={t.aset <= 0 ? 'Belum ada aset' : t.liab > t.aset ? 'Liabilitas melebihi total aset' : 'Bagian aset yang dibiayai liabilitas'}
          />
          <Ratio
            label="Porsi aset lancar"
            value={t.aset > 0 ? pct(t.asetLancar / t.aset) : '–'}
            note="Bagian aset yang bisa cepat dicairkan"
          />
        </Box>
      </Card>

      <Card withBorder radius="lg" padding={0} bg="white">
        {/* Alat tabel di atas datanya: cari di kiri, cara tampil di kanan. */}
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

        {/* Kepala laporan, seperti di laporan cetak. */}
        <Stack gap={2} align="center" px="lg" pt="lg" pb="md">
          <Text fz="sm" c="slate.7">{COMPANY.name}</Text>
          <Text fz="lg" fw={700} c="slate.9">Neraca</Text>
          <Text fz="sm" c="slate.7" ta="center">{periodLine}</Text>
        </Stack>
        <Box className="bs-sheet">
          <Table horizontalSpacing="md" verticalSpacing="sm" miw={compare ? 900 : 560} className={compare ? 'bs-table bs-cmp' : 'bs-table'}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={96} fz="xs" c="slate.7" className="bs-code">Kode</Table.Th>
                <Table.Th fz="xs" c="slate.7">Akun</Table.Th>
                <Table.Th w={170} fz="xs" c="slate.7" ta="right">{formatDate(asOf)}</Table.Th>
                {compare && (
                  <>
                    <Table.Th w={170} fz="xs" c="slate.7" ta="right">{formatDate(cmpDate)}</Table.Th>
                    <Table.Th w={150} fz="xs" c="slate.7" ta="right">Perubahan</Table.Th>
                    <Table.Th w={64} fz="xs" c="slate.7" ta="right">%</Table.Th>
                  </>
                )}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r, i) => <StatementRow key={`${r.type}-${r.key ?? r.row?.key ?? r.label}-${i}`} r={r} compare={compare} phone={phone} onToggle={toggle} onPick={pick} range={[range[0], asOf]} />)}
              <Table.Tr className="bs-total bs-grand">
                <LeadCell phone={phone}><Text fz="sm" fw={700} c="slate.9">Total liabilitas + ekuitas</Text></LeadCell>
                <NumCells a={pasivaA} b={pasivaB} compare={compare} fw={700} />
              </Table.Tr>
            </Table.Tbody>
          </Table>
          {q && !rows.some((r) => r.type === 'account') && (
            <Text fz="sm" c="slate.6" ta="center" py="lg">Tidak ada akun yang cocok dengan “{query}”.</Text>
          )}
        </Box>
        <Text fz="xs" c="slate.6" px="lg" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
          Dihitung dari {bs.count} jurnal sampai {formatDate(asOf)}: {Object.entries(bs.modules).map(([m, n]) => `${m} ${n}`).join(' · ') || 'belum ada jurnal'}. Angka dalam kurung berarti minus, tanda – berarti nol. Rekening Kas & Bank yang saldonya minus disajikan sebagai Cerukan Bank di liabilitas jangka pendek (PSAK 1: aset dan liabilitas tidak saling hapus).
        </Text>
      </Card>

      {target && <AccountModal target={target} opened={modalOpen} ledger={ledger} asOf={asOf} onClose={() => setModalOpen(false)} />}
    </Stack>
  );
}
