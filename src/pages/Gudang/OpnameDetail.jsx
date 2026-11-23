// Detail satu dokumen Stok Opname: tahapan, hitungan, ringkasan selisih, riwayat.
//
// Halaman ini tidak menghitung stok sendiri. Saldo buku dan harga sudah dibekukan
// di dokumennya saat hitungan dimulai (O3), dan selisih baru menyentuh stok lewat
// mutasi yang dibuat saat posting.
import { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import NumberField from '@/components/NumberField.jsx';
import { blockedProps } from '@/components/common.jsx';
import {
  Check,
  ClipboardText,
  ListChecks,
  MagnifyingGlass,
  Package,
  Plus,
  DownloadSimple,
  Printer,
  Prohibit,
  Scales,
} from '@/components/Icon.jsx';
import {
  BackLink,
  Callout,
  DataTable,
  DocNumber,
  EmptyState,
  RowMenu,
  Section,
  StatusPill,
  TabBar,
} from '@/pages/Pembelian/components.jsx';
import { FlowStep } from '@/pages/Pembelian/PurchaseFlow.jsx';
import { formatDate } from '@/pages/Pembelian/utils.js';
import { rupiah } from '@/pages/Penjualan/utils.js';
import { unitName } from '@/pages/Produk/catalog.js';
import { accountLabel } from './journal.js';
import { downloadOpname } from './opnamePdf.js';
import { picName } from './data.js';
import {
  OPNAME_ACTION,
  OPNAME_STATUS,
  OPNAME_STEPS,
  accountOfLine,
  diffQty,
  diffValue,
  isCounted,
  journalPreview,
  opnameSummary,
  reasonFitsDiff,
  reasonLabel,
  reasonOptions,
  submitBlockers,
} from './opname.js';

const number = new Intl.NumberFormat('id-ID');

const STEP_LABEL = {
  draft: 'Draf',
  counting: 'Menghitung',
  pending_approval: 'Menunggu persetujuan',
  posted: 'Diposting',
};

const STEP_HINT = {
  draft: 'Dokumen dibuat, saldo buku belum dibekukan',
  counting: 'Saldo buku dibekukan dan gudang dikunci',
  pending_approval: 'Menunggu Building Manager',
  posted: 'Mutasi dan jurnal penyesuaian terbit',
};

function InfoCell({ label, value, divider }) {
  return (
    <Box
      px="lg"
      py="md"
      style={{ minWidth: 0, borderLeft: divider ? '1px solid var(--mantine-color-gray-2)' : undefined }}
    >
      <Text fz={11} fw={600} c="slate.6">
        {label}
      </Text>
      <Box fz="sm" fw={600} c="slate.9" mt={2} style={{ overflowWrap: 'anywhere' }}>
        {value ?? '—'}
      </Box>
    </Box>
  );
}

// Satu angka ringkasan selisih.
function DiffStat({ label, qty, value, color, showValue }) {
  return (
    <Box px="lg" py="md" style={{ minWidth: 0 }}>
      <Text fz={11} fw={600} c="slate.6">
        {label}
      </Text>
      <Text fz={20} fw={700} c={color} lh={1.2} mt={2}>
        {showValue ? rupiah(Math.round(value)) : number.format(qty)}
      </Text>
      <Text fz={11} c="slate.6" mt={2}>
        {showValue ? `${number.format(qty)} unit` : 'qty lintas produk'}
      </Text>
    </Box>
  );
}


/**
 * Lembar hitung yang dicetak lewat printer, bukan halaman apa adanya. Sengaja TIDAK
 * memuat saldo buku — kalau tercetak, hitungannya berhenti jujur (prinsip blind count),
 * dan itu berlaku juga ketika Accounting yang menekan tombol cetaknya.
 *
 * Berita acaranya tidak di sini: dokumen itu untuk diarsipkan, jadi dibuat sebagai PDF
 * dengan kerangka yang sama dengan dokumen pembelian — lihat opnamePdf.js.
 */
function PrintSheet({ opname, data }) {
  const warehouse = data.warehouses.find((w) => w.id === opname.warehouseId);
  const productOf = (id) => data.products.find((p) => p.id === id);
  const satuanOf = (id) => {
    const p = productOf(id);
    return unitName(data.units, p?.baseUnitId ?? p?.buyUnitId);
  };

  return (
    <div className="print-sheet">
      <h1>Lembar Hitung Stok Opname</h1>
      <p className="meta">
        {opname.number} · {warehouse?.name ?? opname.warehouseId} · Tanggal hitung{' '}
        {formatDate(opname.date)}
      </p>
      <p className="meta">
        Petugas hitung: {picName(opname.counterUserId) ?? '—'} · Dibuat oleh: {opname.createdBy}
      </p>

      <table>
        <thead>
          <tr>
            <th style={{ width: 32 }}>No</th>
            <th>Produk</th>
            <th>SKU</th>
            <th>Satuan</th>
            <th style={{ width: 110 }}>Qty hitung</th>
            <th style={{ width: 90 }}>Paraf</th>
          </tr>
        </thead>
        <tbody>
          {(opname.lines ?? []).map((l, i) => (
            <tr key={l.productId}>
              <td className="num">{i + 1}</td>
              <td>{productOf(l.productId)?.name ?? l.productId}</td>
              <td>{productOf(l.productId)?.sku ?? ''}</td>
              <td>{satuanOf(l.productId)}</td>
              <td className="blank" />
              <td className="blank" />
            </tr>
          ))}
        </tbody>
      </table>
      <p className="meta" style={{ marginTop: 10 }}>
        Isi qty hasil hitungan fisik. Barang yang memang tidak ada ditulis 0, bukan dikosongkan.
      </p>
      <div className="sign">
        <div>
          Petugas Hitung
          <div className="line">{picName(opname.counterUserId) ?? ''}</div>
        </div>
        <div>
          Saksi
          <div className="line" />
        </div>
      </div>
    </div>
  );
}

export default function OpnameDetail({
  opname,
  data,
  moves,
  accountMap,
  showValue,
  blind,
  canCount,
  canReview,
  canApprove,
  approverLabel,
  onBack,
  onStart,
  onPatchLine,
  onAddFound,
  onSubmit,
  onApprove,
  onReject,
  onCancel,
  onOpenJournal,
  onOpenCard,
}) {
  const [tab, setTab] = useState('hitung');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [adding, setAdding] = useState(null); // productId yang akan ditambahkan
  const [tried, setTried] = useState(false);

  const warehouse = data.warehouses.find((w) => w.id === opname.warehouseId);
  const productOf = (id) => data.products.find((p) => p.id === id);
  const satuan = (id) => {
    const p = productOf(id);
    return unitName(data.units, p?.baseUnitId ?? p?.buyUnitId);
  };

  const s = opnameSummary(opname);
  const draft = opname.status === 'draft';
  const counting = opname.status === 'counting';
  const pending = opname.status === 'pending_approval';
  const posted = opname.status === 'posted';
  const cancelled = opname.status === 'cancelled';
  const editable = counting && canCount;

  const blockers = useMemo(() => submitBlockers(opname, data.products), [opname, data.products]);
  const preview = useMemo(
    () => (blind ? [] : journalPreview(opname, accountMap, data.products)),
    [opname, accountMap, data.products, blind],
  );
  const opnameMoves = useMemo(
    () => moves.filter((m) => m.sourceType === 'stock_opname' && m.sourceId === opname.id),
    [moves, opname.id],
  );

  const lines = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (opname.lines ?? [])
      .map((l, idx) => ({ l, idx }))
      .filter(
        ({ l }) =>
          !q ||
          (data.products.find((p) => p.id === l.productId)?.name ?? '')
            .toLowerCase()
            .includes(q),
      )
      .filter(({ l }) =>
        filter === 'uncounted'
          ? !isCounted(l)
          : filter === 'diff'
            ? isCounted(l) && diffQty(l) !== 0
            : true,
      );
  }, [opname.lines, query, filter, data.products]);

  // Produk yang bisa ditambahkan lewat "Tambah produk ditemukan": berstok,
  // dan belum ada di daftar hitung.
  const addable = data.products
    .filter((p) => p.tracked && !(opname.lines ?? []).some((l) => l.productId === p.id))
    .map((p) => ({ value: p.id, label: p.name }));

  const stepIndex = OPNAME_STEPS.indexOf(opname.status);

  const banner = (() => {
    if (draft)
      return {
        tone: 'info',
        title: 'Hitungan belum dimulai',
        text: `Saldo buku baru dibekukan saat Mulai hitung ditekan. ${warehouse?.name ?? 'Gudang'} masih bisa menerima dan mengeluarkan barang.`,
      };
    if (counting || pending)
      return {
        tone: 'warn',
        title: `${warehouse?.name ?? 'Gudang'} dibekukan sampai opname ini selesai`,
        text: 'Penerimaan barang, pengeluaran, pindah barang, dan penjualan ke gudang ini ditolak selama opname berjalan.',
      };
    if (posted)
      return {
        tone: 'ok',
        title: `Opname diposting ${opname.postedAt ? formatDate(opname.postedAt.slice(0, 10)) : ''}`.trim(),
        text: `${number.format(opnameMoves.length)} mutasi penyesuaian dibuat per ${formatDate(opname.date)}. Gudang sudah dibuka lagi.`,
      };
    return {
      tone: 'warn',
      title: 'Opname dibatalkan',
      text: 'Hasil hitungan tidak dipakai. Gudang sudah dibuka lagi.',
    };
  })();

  const info = [
    ['Gudang', warehouse?.name ?? opname.warehouseId],
    ['Tanggal hitung', formatDate(opname.date)],
    ['Cakupan', scopeLabel(opname, data)],
    ['Petugas hitung', picName(opname.counterUserId) ?? '—'],
    ['Dibuat oleh', opname.createdBy],
    ['Produk dihitung', `${number.format(s.counted)} dari ${number.format(s.total)}`],
  ];

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <BackLink label="Kembali ke stok opname" onClick={onBack} />

      {/* Hanya muncul saat dicetak; lihat .print-sheet di index.css. Dokumen yang sudah
          diposting tidak lagi butuh lembar hitung — buktinya berita acara PDF. */}
      {!posted && <PrintSheet opname={opname} data={data} />}

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
          <Group gap="md" wrap="nowrap" align="flex-start">
            <Box
              bg="primary.0"
              c="primary.9"
              style={{ width: 44, height: 44, borderRadius: 'var(--mantine-radius-md)', display: 'grid', placeItems: 'center' }}
            >
              <ListChecks size={24} />
            </Box>
            <Box>
              <Group gap={8} align="center">
                <Title order={3} fz="xl" c="slate.9">
                  {opname.number}
                </Title>
                <StatusPill map={OPNAME_STATUS} status={opname.status} />
              </Group>
              <Text fz="xs" c="slate.6" mt={2}>
                {formatDate(opname.date)} · {warehouse?.name ?? opname.warehouseId}
              </Text>
            </Box>
          </Group>

          <Group gap="xs">
            {/* Dua keluaran yang berbeda sifatnya: lembar hitung diisi tangan di gudang
                jadi langsung ke printer, berita acara diarsipkan jadi diunduh sebagai PDF. */}
            <Button
              variant="default"
              radius="md"
              leftSection={posted ? <DownloadSimple size={16} /> : <Printer size={16} />}
              onClick={
                posted
                  ? () =>
                      downloadOpname(opname, {
                        warehouse,
                        products: data.products,
                        units: data.units,
                        accountMap,
                        scope: scopeLabel(opname, data),
                      })
                  : () => window.print()
              }
            >
              {posted ? 'Unduh berita acara' : 'Cetak lembar hitung'}
            </Button>
            {draft && canReview && (
              <Button radius="md" leftSection={<Check size={16} />} onClick={onStart}>
                Mulai hitung
              </Button>
            )}
            {counting && canReview && (
              <Button
                radius="md"
                leftSection={<Check size={16} />}
                onClick={() => {
                  setTried(true);
                  if (!blockers.length) onSubmit();
                }}
                {...blockedProps(blockers[0] ?? null, () => setTried(true))}
              >
                Kirim untuk persetujuan
              </Button>
            )}
            {pending && canApprove && (
              <>
                <Button
                  variant="default"
                  color="red"
                  c="red.7"
                  radius="md"
                  leftSection={<Prohibit size={16} />}
                  onClick={onReject}
                >
                  Tolak
                </Button>
                <Button radius="md" leftSection={<Check size={16} />} onClick={onApprove}>
                  Setujui &amp; posting
                </Button>
              </>
            )}
            {!cancelled && canReview && (
              <RowMenu
                label={opname.number}
                items={[
                  {
                    label: posted ? 'Batalkan opname' : 'Batalkan opname',
                    icon: Prohibit,
                    color: 'red',
                    onClick: onCancel,
                  },
                ]}
              />
            )}
          </Group>
        </Group>
      </Card>

      <Callout tone={banner.tone} title={banner.title}>
        {banner.text}
      </Callout>

      {pending && !canApprove && (
        <Callout tone="info" title={`Menunggu persetujuan ${approverLabel}`}>
          Ganti peran di &quot;Lihat sebagai&quot; menjadi Building Manager untuk menyetujui atau
          menolak dokumen ini.
        </Callout>
      )}

      {tried && blockers.length > 0 && counting && (
        <Callout tone="warn" title="Belum bisa dikirim">
          {blockers.join('. ')}.
        </Callout>
      )}

      <Card withBorder radius="lg" padding={0} bg="white">
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing={0}>
          {info.map(([label, value], i) => (
            <Box
              key={label}
              style={{
                borderTop: i >= 3 ? '1px solid var(--mantine-color-gray-2)' : undefined,
              }}
            >
              <InfoCell label={label} value={value} divider={i % 3 !== 0} />
            </Box>
          ))}
        </SimpleGrid>
      </Card>

      <Section icon={Scales} title="Tahapan" description="Posisi dokumen ini dalam alur opname">
        <Box>
          {OPNAME_STEPS.map((step, i) => (
            <FlowStep
              key={step}
              index={i}
              current={cancelled ? -1 : stepIndex}
              last={i === OPNAME_STEPS.length - 1}
              title={STEP_LABEL[step]}
              state={
                cancelled
                  ? 'todo'
                  : i < stepIndex
                    ? 'done'
                    : i === stepIndex
                      ? 'active'
                      : 'todo'
              }
            >
              <Text fz="xs" c="slate.6">
                {STEP_HINT[step]}
              </Text>
            </FlowStep>
          ))}
        </Box>
      </Section>

      <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
        <TabBar
          tabs={[
            { value: 'hitung', label: 'Hitung', icon: ClipboardText },
            // Hanya peran yang menghitung yang tidak melihat pembandingnya
            // (prinsip 1); approver justru wajib melihatnya.
            ...(blind ? [] : [{ value: 'selisih', label: 'Ringkasan selisih', icon: Scales }]),
            { value: 'riwayat', label: 'Riwayat', icon: ListChecks },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'hitung' && (
          <>
            <Group
              gap="md"
              px="lg"
              py="sm"
              bg="slate.0"
              justify="space-between"
              style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
            >
              <Group gap="md">
                <TextInput
                  placeholder="Cari produk..."
                  size="sm"
                  radius="md"
                  w={220}
                  leftSection={<MagnifyingGlass size={14} />}
                  value={query}
                  onChange={(e) => setQuery(e.currentTarget.value)}
                />
                <Select
                  size="sm"
                  radius="md"
                  w={190}
                  allowDeselect={false}
                  data={[
                    { value: 'all', label: 'Semua produk' },
                    { value: 'uncounted', label: 'Belum dihitung' },
                    ...(blind ? [] : [{ value: 'diff', label: 'Ada selisih' }]),
                  ]}
                  value={filter}
                  onChange={setFilter}
                />
              </Group>
              {editable && (
                <Group gap="xs">
                  <Select
                    size="sm"
                    radius="md"
                    w={240}
                    searchable
                    clearable
                    placeholder="Produk ditemukan di rak"
                    data={addable}
                    value={adding}
                    onChange={setAdding}
                  />
                  <Button
                    variant="light"
                    size="xs"
                    radius="md"
                    leftSection={<Plus size={14} />}
                    disabled={!adding}
                    onClick={() => {
                      onAddFound(adding);
                      setAdding(null);
                    }}
                  >
                    Tambah produk ditemukan
                  </Button>
                </Group>
              )}
            </Group>

            <Box p="lg">
              <DataTable
                head={[
                  { label: 'Produk' },
                  { label: 'Satuan', w: 100 },
                  ...(blind ? [] : [{ label: 'Saldo buku', align: 'right', w: 120 }]),
                  { label: 'Qty hitung', align: 'right', w: 140 },
                  ...(blind
                    ? []
                    : [
                        { label: 'Selisih', align: 'right', w: 120 },
                        ...(showValue ? [{ label: 'Nilai selisih', align: 'right', w: 140 }] : []),
                        { label: 'Alasan', w: 190 },
                        { label: 'Catatan', w: 220 },
                      ]),
                ]}
                minWidth={blind ? 620 : 1280}
                empty={
                  lines.length ? null : (
                    <EmptyState
                      icon={Package}
                      title="Tidak ada produk"
                      text="Ubah pencarian atau filternya."
                    />
                  )
                }
              >
                {lines.map(({ l, idx }) => {
                  const d = diffQty(l);
                  const dihitung = isCounted(l);
                  const salahArah = l.reason && d !== 0 && !reasonFitsDiff(l.reason, d);
                  const perluAlasan = tried && dihitung && d !== 0 && !l.reason;
                  const perluCatatan =
                    tried && dihitung && d !== 0 && l.reason === 'lainnya' && !String(l.note ?? '').trim();
                  return (
                    <Table.Tr key={l.productId} style={{ verticalAlign: 'top' }}>
                      <Table.Td>
                        <DocNumber onClick={() => onOpenCard?.(l.productId)}>
                          {productOf(l.productId)?.name ?? l.productId}
                        </DocNumber>
                        <Group gap={6} mt={2}>
                          {l.isFound && (
                            <Badge size="xs" radius="sm" variant="light" color="green" tt="none">
                              Ditemukan
                            </Badge>
                          )}
                          {l.needsRecount && (
                            <Badge size="xs" radius="sm" variant="light" color="orange" tt="none">
                              Hitung ulang
                            </Badge>
                          )}
                          {!dihitung && !l.needsRecount && (
                            <Text fz={11} c="slate.5">
                              Belum dihitung
                            </Text>
                          )}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" c="slate.7" pt={6}>
                          {satuan(l.productId)}
                        </Text>
                      </Table.Td>
                      {!blind && (
                        <Table.Td ta="right">
                          <Text fz="sm" c="slate.7" pt={6}>
                            {number.format(l.bookQty)}
                          </Text>
                        </Table.Td>
                      )}
                      <Table.Td>
                        {editable ? (
                          <NumberField
                            size="xs"
                            radius="md"
                            min={0}
                            value={l.countedQty ?? ''}
                            onChange={(v) =>
                              onPatchLine(idx, {
                                countedQty: v === '' || v == null ? null : Math.max(0, Number(v) || 0),
                                needsRecount: false,
                              })
                            }
                          />
                        ) : (
                          <Text fz="sm" fw={600} c={dihitung ? 'slate.9' : 'slate.5'} ta="right" pt={6}>
                            {dihitung ? number.format(l.countedQty) : '—'}
                          </Text>
                        )}
                      </Table.Td>
                      {!blind && (
                        <>
                          <Table.Td ta="right">
                            <Text
                              fz="sm"
                              fw={d ? 700 : 400}
                              c={d > 0 ? 'green.8' : d < 0 ? 'red.8' : 'slate.5'}
                              pt={6}
                            >
                              {!dihitung ? '—' : d > 0 ? `+${number.format(d)}` : number.format(d)}
                            </Text>
                          </Table.Td>
                          {showValue && (
                            <Table.Td ta="right">
                              <Tooltip
                                label={`Harga rata-rata per ${formatDate(opname.date)}: ${rupiah(Math.round(l.unitCost))}`}
                                withArrow
                                fz="xs"
                                disabled={!dihitung || !d}
                              >
                                <Text
                                  fz="sm"
                                  fw={d ? 600 : 400}
                                  c={d ? 'slate.9' : 'slate.5'}
                                  pt={6}
                                  style={d ? { cursor: 'help' } : undefined}
                                >
                                  {dihitung && d ? rupiah(Math.round(diffValue(l))) : '—'}
                                </Text>
                              </Tooltip>
                            </Table.Td>
                          )}
                          <Table.Td>
                            {d === 0 ? (
                              <Text fz="sm" c="slate.5" pt={6}>
                                —
                              </Text>
                            ) : canReview && (counting || draft) ? (
                              <Select
                                size="xs"
                                radius="md"
                                placeholder="Pilih alasan"
                                data={reasonOptions(d)}
                                value={salahArah ? null : (l.reason ?? null)}
                                error={
                                  perluAlasan
                                    ? 'Pilih alasan selisih'
                                    : salahArah
                                      ? 'Arah selisih berubah, pilih alasan lagi'
                                      : undefined
                                }
                                onChange={(v) => onPatchLine(idx, { reason: v })}
                              />
                            ) : (
                              <Text fz="sm" c="slate.8" pt={6}>
                                {l.reason ? reasonLabel(l.reason) : '—'}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>
                            {d === 0 ? (
                              <Text fz="sm" c="slate.5" pt={6}>
                                —
                              </Text>
                            ) : canReview && (counting || draft) ? (
                              <TextInput
                                size="xs"
                                radius="md"
                                placeholder={l.reason === 'lainnya' ? 'Wajib diisi' : 'Opsional'}
                                value={l.note ?? ''}
                                error={perluCatatan ? 'Tulis catatan untuk alasan Lainnya' : undefined}
                                onChange={(e) => onPatchLine(idx, { note: e.currentTarget.value })}
                              />
                            ) : (
                              <Text fz="sm" c="slate.7" pt={6}>
                                {l.note || '—'}
                              </Text>
                            )}
                          </Table.Td>
                        </>
                      )}
                    </Table.Tr>
                  );
                })}
              </DataTable>

              {blind && (
                <Text fz={11} c="slate.6" mt="xs">
                  Saldo buku dan selisih sengaja disembunyikan untuk peran yang menghitung,
                  supaya angka hitungannya jujur.
                </Text>
              )}
            </Box>
          </>
        )}

        {tab === 'selisih' && !blind && (
          <>
            <SimpleGrid
              cols={{ base: 1, sm: 3 }}
              spacing={0}
              style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}
            >
              <DiffStat label="Lebih" qty={s.gainQty} value={s.gainValue} color="green.8" showValue={showValue} />
              <Box style={{ borderLeft: '1px solid var(--mantine-color-gray-2)' }}>
                <DiffStat label="Kurang" qty={s.lossQty} value={s.lossValue} color="red.8" showValue={showValue} />
              </Box>
              <Box style={{ borderLeft: '1px solid var(--mantine-color-gray-2)' }}>
                <DiffStat
                  label="Net selisih"
                  qty={s.diffCount}
                  value={s.netValue}
                  color={s.netValue > 0 ? 'green.8' : s.netValue < 0 ? 'red.8' : 'slate.9'}
                  showValue={showValue}
                />
              </Box>
            </SimpleGrid>

            <Box p="lg">
              <Stack gap="lg">
                {showValue && (
                <Box>
                  <Text fz="sm" fw={700} c="slate.9" mb={6}>
                    {posted ? 'Jurnal yang terbit' : 'Pratinjau jurnal'}
                  </Text>
                  <DataTable
                    head={[
                      { label: 'Akun perkiraan (COA)' },
                      { label: 'Alasan' },
                      { label: 'Produk', align: 'right', w: 100 },
                      { label: 'Debit', align: 'right', w: 160 },
                      { label: 'Kredit', align: 'right', w: 160 },
                    ]}
                    minWidth={880}
                    empty={
                      preview.length ? null : (
                        <EmptyState
                          icon={Scales}
                          title="Belum ada selisih"
                          text="Baris yang selisihnya nol tidak membuat jurnal."
                        />
                      )
                    }
                  >
                    {preview.map((row) => (
                      <Table.Tr key={`${row.account}-${row.reason ?? 'inv'}`}>
                        <Table.Td>
                          <Text fz="sm" fw={600} c="primary.9">
                            {accountLabel(row.account)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fz="sm" c="slate.7">
                            {row.reason ? reasonLabel(row.reason) : 'Lawan persediaan'}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz="sm" c="slate.7">
                            {number.format(row.count)}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz="sm" fw={row.debit ? 700 : 400} c={row.debit ? 'slate.9' : 'slate.5'}>
                            {row.debit ? rupiah(row.debit) : '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz="sm" fw={row.credit ? 700 : 400} c={row.credit ? 'slate.9' : 'slate.5'}>
                            {row.credit ? rupiah(row.credit) : '—'}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {preview.length > 0 && (
                      <Table.Tr bg="slate.0">
                        <Table.Td colSpan={3}>
                          <Text fz="xs" fw={700} c="slate.7" tt="uppercase">
                            Total
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz="sm" fw={700} c="slate.9">
                            {rupiah(preview.reduce((n, r) => n + r.debit, 0))}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="right">
                          <Text fz="sm" fw={700} c="slate.9">
                            {rupiah(preview.reduce((n, r) => n + r.credit, 0))}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </DataTable>
                </Box>
                )}

                <Box>
                  <Text fz="sm" fw={700} c="slate.9" mb={6}>
                    Baris yang selisihnya tidak nol
                  </Text>
                  <DataTable
                    head={[
                      { label: 'Produk' },
                      { label: 'Saldo buku', align: 'right', w: 120 },
                      { label: 'Qty hitung', align: 'right', w: 120 },
                      { label: 'Selisih', align: 'right', w: 110 },
                      ...(showValue ? [{ label: 'Nilai', align: 'right', w: 140 }] : []),
                      { label: 'Alasan' },
                      { label: 'Akun' },
                      ...(posted ? [{ label: 'Jurnal', align: 'center', w: 130 }] : []),
                    ]}
                    minWidth={1180}
                    empty={
                      s.diffCount ? null : (
                        <EmptyState
                          icon={Check}
                          title="Hitungan cocok"
                          text="Semua produk sama dengan saldo buku."
                        />
                      )
                    }
                  >
                    {(opname.lines ?? [])
                      .filter((l) => isCounted(l) && diffQty(l) !== 0)
                      .map((l) => {
                        const d = diffQty(l);
                        const move = opnameMoves.find(
                          (m) => m.productId === l.productId && !m.reversalOfId,
                        );
                        return (
                          <Table.Tr key={l.productId}>
                            <Table.Td>
                              <DocNumber onClick={() => onOpenCard?.(l.productId)}>
                                {productOf(l.productId)?.name ?? l.productId}
                              </DocNumber>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text fz="sm" c="slate.7">
                                {number.format(l.bookQty)}
                              </Text>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text fz="sm" c="slate.7">
                                {number.format(l.countedQty)}
                              </Text>
                            </Table.Td>
                            <Table.Td ta="right">
                              <Text fz="sm" fw={700} c={d > 0 ? 'green.8' : 'red.8'}>
                                {d > 0 ? `+${number.format(d)}` : number.format(d)}
                              </Text>
                            </Table.Td>
                            {showValue && (
                              <Table.Td ta="right">
                                <Text fz="sm" fw={600} c="slate.9">
                                  {rupiah(Math.round(diffValue(l)))}
                                </Text>
                              </Table.Td>
                            )}
                            <Table.Td>
                              <Text fz="sm" c="slate.8">
                                {reasonLabel(l.reason)}
                              </Text>
                              {l.note && (
                                <Text fz={11} c="slate.6">
                                  {l.note}
                                </Text>
                              )}
                            </Table.Td>
                            <Table.Td>
                              <Text fz="sm" c="slate.7">
                                {accountLabel(accountOfLine(l, opname, accountMap))}
                              </Text>
                            </Table.Td>
                            {posted && (
                              <Table.Td ta="center">
                                {move ? (
                                  <Button
                                    variant="subtle"
                                    size="xs"
                                    radius="md"
                                    fz="xs"
                                    onClick={() => onOpenJournal(move)}
                                  >
                                    Lihat jurnal
                                  </Button>
                                ) : (
                                  <Text fz={11} c="slate.5">
                                    —
                                  </Text>
                                )}
                              </Table.Td>
                            )}
                          </Table.Tr>
                        );
                      })}
                  </DataTable>
                </Box>
              </Stack>
            </Box>
          </>
        )}

        {tab === 'riwayat' && (
          <Box p="lg">
            <DataTable
              head={[{ label: 'Waktu' }, { label: 'Kejadian' }, { label: 'Oleh' }, { label: 'Catatan' }]}
              minWidth={760}
              empty={
                (opname.history ?? []).length ? null : (
                  <EmptyState icon={ListChecks} title="Belum ada riwayat" text="" />
                )
              }
            >
              {[...(opname.history ?? [])].reverse().map((h, i) => (
                <Table.Tr key={`${h.at}-${i}`}>
                  <Table.Td>
                    <Text fz="sm" c="slate.7">
                      {formatDate(h.at.slice(0, 10))}
                    </Text>
                    <Text fz={11} c="slate.6">
                      {h.at.slice(11, 16)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="sm" fw={600} c="slate.9">
                      {OPNAME_ACTION[h.action] ?? h.action}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="sm" c="slate.7">
                      {h.by}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fz="sm" c="slate.7">
                      {h.note || '—'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </DataTable>
          </Box>
        )}
      </Card>
    </Stack>
  );
}

function scopeLabel(opname, data) {
  const sc = opname.scope ?? { type: 'all' };
  if (sc.type === 'category')
    return `Kategori: ${(sc.categoryIds ?? [])
      .map((id) => data.categories.find((c) => c.id === id)?.name ?? id)
      .join(', ')}`;
  if (sc.type === 'manual') return `${(sc.productIds ?? []).length} produk dipilih`;
  return 'Semua produk di gudang ini';
}
