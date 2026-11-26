// Halaman penuh "Catat Faktur Pembelian" — polanya mengikuti form faktur di modul Penjualan:
// dokumen sumber dipilih di dalam halaman (bukan lewat modal pemilih), lalu diisi bertahap
// lewat stepper. Form sepanjang ini terlalu sesak di dalam modal.
//
// Dua jalur dalam satu form:
//   'receipt' — menagih dari FPB/BAPP yang sudah dikonfirmasi; qty dan harga terikat PO.
//   'po'      — menagih langsung dari PO/SPK: faktur uang muka (DP/CBD), atau pesanan tanpa
//               serah terima. Jalur 'manual' (non-PO) masih ada di kode tapi kartunya disembunyikan.
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  Grid,
  Group,
  SimpleGrid,
  Select,
  Stack,
  Stepper,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CaretRight,
  Check,
  ClipboardText,
  Invoice,
  Package,
  Plus,
  Storefront,
  Trash,
  Truck,
  Warning,
} from '@/components/Icon.jsx';
import DateField from '@/components/DateField.jsx';
import NumberField from '@/components/NumberField.jsx';
import {
  BackLink,
  blockedProps,
  Callout,
  EmptyState,
  FormModal,
  PageIntro,
  renderVendorOption,
  vendorSelectData,
} from './components.jsx';
import { FileField } from './Dialogs.jsx';
import { personLabel, productCatalog, RULES, TODAY } from './data.js';
import { termMechanics } from './paymentTerms.js';
import {
  addDays,
  advancePct,
  dueDaysOf,
  formatDate,
  invTotals,
  nextNumber,
  poDocLabel,
  poDpAmount,
  poDpDpp,
  poPpnRate,
  poPphPct,
  poDue,
  poTotal,
  ppnLabel,
  receiptDue,
  priceChangePending,
  rupiah,
  termKey,
  dpBlockReason,
  dpState,
  termParts,
  uid,
  uninvoicedLines,
  uninvoicedPoLines,
  poPending,
} from './utils.js';
import { toast } from './usePb.js';
import PriceChangeModal from './PriceChangeModal.jsx';

// Urutan langkah: sumber dulu, lalu data faktur dari vendor, baru rinciannya.
// Nomor, tanggal, dan berkas disalin dari lembar invoice yang ada di tangan, jadi lebih
// enak diketik sekalian sebelum masuk ke penyesuaian qty baris per baris.
const STEPS = [
  { value: 'source', label: 'Sumber Tagihan', description: 'Vendor & penerimaan yang ditagih', icon: Truck },
  { value: 'invoice', label: 'Data Faktur', description: 'Nomor, tanggal, pajak, berkas', icon: Invoice },
  { value: 'items', label: 'Rincian Item', description: 'Qty dan harga yang difaktur', icon: ClipboardText },
];

const th = {
  th: { fontSize: 'var(--mantine-font-size-xs)', color: 'var(--mantine-color-slate-7)', fontWeight: 600, whiteSpace: 'nowrap' },
};
const tableFrame = {
  border: '1px solid var(--mantine-color-gray-3)',
  borderRadius: 'var(--mantine-radius-md)',
  overflow: 'auto',
};

const blankLine = () => ({ key: uid('ml'), kind: 'barang', productId: null, desc: '', spec: '', unit: 'pcs', qty: 1, price: 0, ppnRate: RULES.ppn, received: true });

// Pilihan barang/jasa diambil dari katalog produk, sama seperti form permintaan — bukan
// kolom teks bebas. Dengan begitu nama, satuan, dan jenisnya konsisten dengan dokumen lain,
// dan laporan per barang tidak pecah hanya karena ejaan yang berbeda.
const KIND_OPTIONS = [{ value: 'barang', label: 'Barang' }, { value: 'jasa', label: 'Jasa' }];
const productOptions = (kind) => productCatalog.filter((p) => p.kind === kind).map((p) => ({ value: p.id, label: p.name }));

// --- Langkah 1: sumber tagihan -----------------------------------------------------------------
// Dua pilihan jalur ditampilkan sebagai kartu, bukan dropdown: keduanya mengubah isi seluruh
// form, jadi konsekuensinya perlu terbaca sebelum dipilih.
function ModeCard({ icon: Icon, title, text, active, onClick }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      ta="left"
      p="md"
      style={{
        cursor: 'pointer',
        borderRadius: 'var(--mantine-radius-md)',
        border: `1px solid ${active ? 'var(--mantine-color-primary-6)' : 'var(--mantine-color-gray-3)'}`,
        background: active ? 'var(--mantine-color-primary-0)' : 'white',
        boxShadow: active ? '0 0 0 1px var(--mantine-color-primary-6) inset' : undefined,
      }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <ThemeIcon variant="light" color={active ? 'primary' : 'slate'} size={32} radius="md">
          <Icon size={16} />
        </ThemeIcon>
        <Box>
          <Text fz="sm" fw={700} c="slate.9">{title}</Text>
          <Text fz={11} c="slate.6">{text}</Text>
        </Box>
      </Group>
    </Box>
  );
}

// Batas badge di kepala kartu. Lebih dari ini, deretan nomornya lebih panjang daripada
// judul langkahnya sendiri dan tidak lagi terbaca sekilas — diringkas jadi satu badge
// berisi jumlahnya, daftarnya dibuka di modal.
const MAX_BADGE = 5;

// Daftar penerimaan yang ditagih dalam faktur ini. Isinya sama dengan tabel pilihan di
// langkah 1, dalam bentuk baca saja: dipakai saat sedang mengisi langkah berikutnya dan
// perlu memastikan ulang FPB/BAPP mana saja yang masuk.
function SourceListModal({ opened, onClose, docs, fromPo, vendor, pb }) {
  const noun = fromPo ? 'pesanan' : 'penerimaan';
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={720}
      icon={fromPo ? Package : Truck}
      title={`${docs.length} ${noun} ditagih`}
      subtitle={vendor?.name}
      footer={<Button variant="default" radius="md" onClick={onClose}>Tutup</Button>}
    >
      <Box p="lg">
        <Box style={tableFrame}>
          <Table verticalSpacing="xs" horizontalSpacing="sm" miw={600} styles={th}>
            <Table.Thead bg="slate.0">
              <Table.Tr>
                <Table.Th>{fromPo ? 'No. PO/SPK' : 'No. penerimaan'}</Table.Th>
                <Table.Th>{fromPo ? 'Dari permintaan' : 'Dari pesanan'}</Table.Th>
                <Table.Th>Tanggal</Table.Th>
                <Table.Th>Jatuh tempo</Table.Th>
                <Table.Th ta="right">Belum difaktur</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {docs.map((r) => {
                const po = fromPo ? r : pb.posById[r.poId];
                const due = fromPo ? poDue(po) : receiptDue(po, r.date);
                const sisa = fromPo ? uninvoicedPoLines(r, pb.invoices) : uninvoicedLines(r, pb.invoices);
                return (
                  <Table.Tr key={r.id}>
                    <Table.Td fz="sm" fw={700}>{r.number}</Table.Td>
                    <Table.Td fz="xs" c="slate.7">{(fromPo ? pb.fppbjById?.[r.fppbjId]?.number : po?.number) ?? '—'}</Table.Td>
                    <Table.Td fz="xs" c="slate.7">{formatDate(r.date)}</Table.Td>
                    <Table.Td fz="xs" fw={due.exact ? 700 : 400} c={due.exact ? 'slate.9' : 'slate.6'}>{due.text}</Table.Td>
                    <Table.Td ta="right" fz="xs" c="slate.7">{sisa.length} baris</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Box>
      </Box>
    </FormModal>
  );
}

// Kaki angka faktur: menurun dan rata kanan seperti kaki faktur cetak, tiap baris memotong
// baris di atasnya, dan Hutang Usaha jadi angka terakhir yang dibaca. Baris bernilai nol
// disembunyikan — "-Rp 0,00" hanya menambah baris tanpa menambah keterangan.
function TotalsBand({ rows, totalLabel, total, children }) {
  return (
    <Box px="lg" py="md" bg="slate.0" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
      <Box ml="auto" w={{ base: '100%', sm: 340 }}>
        {rows.filter(Boolean).map((r) => (
          <Group key={r.label} justify="space-between" gap="md" py={3} wrap="nowrap">
            <Text fz="xs" c="slate.7">{r.label}</Text>
            <Text fz="xs" fw={600} c={r.color ?? 'slate.9'} style={{ whiteSpace: 'nowrap' }}>{r.value}</Text>
          </Group>
        ))}
        <Divider my={8} color="gray.3" />
        <Group justify="space-between" align="center" gap="md" wrap="nowrap">
          <Text fz="sm" fw={700} c="primary.9">{totalLabel}</Text>
          <Text fz={20} fw={700} c="primary.9" lh={1.2} style={{ whiteSpace: 'nowrap' }}>{rupiah(total)}</Text>
        </Group>
        {children}
      </Box>
    </Box>
  );
}

// Label baris uang muka, dipakai di kartu langkah, rincian, dan baris fakturnya.
const dpLabelOf = (po) => (advancePct(po?.term) >= 100 ? 'Bayar penuh di muka' : `Uang muka ${advancePct(po?.term)}%`);

function SourceStep({ mode, setMode, vendorId, setVendorId, picked, togglePick, ready, pb, errors, keyOf, dpIds }) {
  const fromPo = mode === 'po';
  // Faktur uang muka tidak punya jalur sendiri: ia tetap ditagih dari PO/SPK. Pesanan yang
  // menunggu faktur DP-nya ikut tampil di tabel PO/SPK, ditandai, dan dipilih sendirian.
  const isDp = fromPo && picked.length === 1 && dpIds.has(picked[0]);
  // Vendor dibatasi yang benar-benar punya penerimaan siap difaktur: daftar vendor penuh
  // hanya akan berujung pada tabel kosong.
  // 'receipt' dan 'po' sama-sama memilih dokumen sumber; 'manual' tidak.
  const dariDokumen = mode !== 'manual';
  const nounJalur = fromPo ? 'pesanan' : 'penerimaan';
  const vendorsWithReady = pb.vendors.filter((v) => ready.some((r) => r.vendorId === v.id));
  // Diurutkan per termin lalu per tanggal, supaya yang bisa digabung berkumpul berdampingan
  // dan yang terkunci tidak berserak di antara yang bisa dipilih.
  const rows = ready
    .filter((r) => r.vendorId === vendorId)
    .sort((a, b) => keyOf(a).localeCompare(keyOf(b)) || a.date.localeCompare(b.date));
  // Termin penerimaan yang dipilih pertama mengunci termin sisanya.
  const docById = (id) => (fromPo ? pb.posById[id] : pb.receiptsById[id]);
  // Faktur uang muka tidak digabung dengan apa pun, jadi tidak mengunci termin baris lain.
  const lockedKey = picked.length && !isDp ? keyOf(docById(picked[0])) : null;
  const lockedTerm = lockedKey
    ? termParts(fromPo ? docById(picked[0])?.term : pb.posById[docById(picked[0])?.poId]?.term).label
    : null;

  // Termin boleh sama sementara tanggal penerimaannya berbeda — kiriman bertahap atas satu PO,
  // misalnya. Satu faktur hanya punya satu jatuh tempo, dan yang dipakai adalah penerimaan
  // TERAKHIR: kewajiban bayarnya baru genap setelah kiriman terakhir datang. Memakai yang
  // paling awal akan membuat sebagian faktur lahir sudah lewat tempo.
  const terpilih = fromPo ? [] : picked.map((id) => pb.receiptsById[id]).filter(Boolean);
  const penentu = terpilih.length > 1 ? terpilih.reduce((a, b) => (b.date > a.date ? b : a)) : null;
  const temponya = (r) => receiptDue(pb.posById[r.poId], r.date);
  const tempoBeda = penentu && new Set(terpilih.map((r) => temponya(r).text)).size > 1;

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <ModeCard
          icon={Truck}
          title="Dari penerimaan (FPB/BAPP)"
          text="Satu faktur boleh mencakup beberapa penerimaan dari vendor yang sama."
          active={mode === 'receipt'}
          onClick={() => setMode('receipt')}
        />
        <ModeCard
          icon={Package}
          title="Dari PO/SPK"
          text="Uang muka (DP/CBD) sebelum barang datang, atau pesanan yang memang tidak lewat gudang."
          active={mode === 'po'}
          onClick={() => setMode('po')}
        />
      </SimpleGrid>

      <Select
        label="Vendor"
        withAsterisk
        size="sm"
        radius="md"
        searchable
        placeholder={dariDokumen && !vendorsWithReady.length ? `Tidak ada vendor dengan ${nounJalur} siap difaktur` : 'Pilih vendor'}
        description={dariDokumen ? `Satu faktur hanya untuk satu vendor. Mengganti vendor mengosongkan pilihan ${nounJalur}.` : undefined}
        disabled={dariDokumen && !vendorsWithReady.length}
        data={vendorSelectData(dariDokumen ? vendorsWithReady : pb.vendors)}
        renderOption={renderVendorOption}
        value={vendorId}
        error={errors.vendor}
        onChange={setVendorId}
        leftSection={<Storefront size={14} />}
      />

      {dariDokumen && (
        !vendorId ? (
          <Callout>Pilih vendor dulu untuk melihat {nounJalur} yang siap difaktur.</Callout>
        ) : !rows.length ? (
          <EmptyState
            icon={fromPo ? Package : Truck}
            title={`Belum ada ${nounJalur} yang siap difaktur`}
            text={fromPo
              ? 'Tidak ada pesanan vendor ini yang menunggu faktur uang muka atau bisa ditagih langsung tanpa FPB/BAPP. Jalur ini hanya untuk pesanan yang belum punya FPB/BAPP sama sekali. Pesanan vendor ini sudah punya penerimaan, atau sudah difaktur penuh.'
              : 'Semua FPB/BAPP vendor ini sudah difaktur penuh, atau belum dikonfirmasi.'}
          />
        ) : (
          <>
            <Box style={tableFrame}>
              <Table verticalSpacing="xs" horizontalSpacing="sm" miw={940} styles={th}>
                <Table.Thead bg="slate.0">
                  <Table.Tr>
                    <Table.Th w={44} />
                    <Table.Th>{fromPo ? 'No. PO/SPK' : 'No. penerimaan'}</Table.Th>
                    <Table.Th>{fromPo ? 'Dari permintaan' : 'Dari pesanan'}</Table.Th>
                    <Table.Th>Tanggal</Table.Th>
                    <Table.Th>Termin bayar</Table.Th>
                    <Table.Th>Jatuh tempo</Table.Th>
                    <Table.Th ta="right">Belum difaktur</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((r) => {
                    // Pada jalur PO/SPK, dokumennya adalah pesanan itu sendiri.
                    const po = fromPo ? r : pb.posById[r.poId];
                    const { label, detail } = termParts(po?.term);
                    const due = fromPo ? poDue(po) : receiptDue(po, r.date);
                    const dipilih = picked.includes(r.id);
                    // Tertahan uang muka: faktur pelunasan menunggu DP pesanannya lunas atau
                    // dibatalkan resmi. Barisnya tetap tampil supaya alasannya terbaca.
                    // Baris uang muka: justru faktur DP inilah yang sedang dicatat.
                    const rowDp = fromPo && dpIds.has(r.id);
                    const dpTahan = rowDp ? null : dpBlockReason(dpState(po, pb.calc));
                    // Terkunci: terminnya berbeda dari penerimaan yang sudah dipilih.
                    const beda = !!lockedKey && !dipilih && !rowDp && keyOf(r) !== lockedKey;
                    const terkunci = beda || (!!dpTahan && !dipilih);
                    const alasan = dpTahan ?? `Termin ${label} tidak bisa digabung dengan ${lockedTerm} dalam satu faktur`;
                    const baris = (
                      <Table.Tr
                        key={r.id}
                        onClick={() => !terkunci && togglePick(r.id)}
                        style={{ cursor: terkunci ? 'not-allowed' : 'pointer', opacity: terkunci ? 0.45 : 1 }}
                        bg={dipilih ? 'primary.0' : undefined}
                      >
                        <Table.Td>
                          <Checkbox
                            size="xs"
                            aria-label={`Pilih ${r.number}`}
                            checked={dipilih}
                            disabled={terkunci}
                            onChange={() => togglePick(r.id)}
                          />
                        </Table.Td>
                        <Table.Td fz="sm" fw={700}>{r.number}</Table.Td>
                        <Table.Td fz="xs" c="slate.7">{fromPo ? (pb.fppbjById?.[r.fppbjId]?.number ?? '—') : (po?.number ?? '—')}</Table.Td>
                        <Table.Td fz="xs" c="slate.7">{formatDate(r.date)}</Table.Td>
                        <Table.Td>
                          <Badge size="sm" radius="sm" variant="light" color={terkunci ? 'slate' : 'primary'} fw={700} tt="none">{label}</Badge>
                          {/* Alasan terkuncinya ditulis di barisnya, bukan hanya di tooltip:
                              kotak centang yang mati tanpa keterangan terbaca seperti kerusakan. */}
                          {terkunci
                            ? <Text fz={10} fw={600} c="orange.8" mt={2}>{dpTahan ?? 'Termin berbeda · tidak bisa digabung'}</Text>
                            : detail && <Text fz={10} c="slate.6" mt={2}>{detail}</Text>}
                        </Table.Td>
                        {/* Jatuh tempo yang sudah pasti dicetak tegas; yang masih bergantung
                            tanggal faktur ditulis sebagai rumusnya, bukan tanggal palsu. */}
                        <Table.Td fz="xs" fw={due.exact ? 700 : 400} c={due.exact ? 'slate.9' : 'slate.6'}>
                          {due.text}
                        </Table.Td>
                        <Table.Td ta="right">
                          {rowDp ? (
                            <>
                              <Badge size="sm" radius="sm" variant="light" color="orange" fw={700} tt="none">{dpLabelOf(r)}</Badge>
                              <Text fz="sm" fw={700} c="slate.9" mt={2}>{rupiah(poDpAmount(r))}</Text>
                            </>
                          ) : (
                            <Text fz="xs" c="slate.7">{(fromPo ? uninvoicedPoLines(r, pb.invoices) : uninvoicedLines(r, pb.invoices)).length} baris</Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                    return terkunci ? (
                      <Tooltip key={r.id} label={alasan} withArrow fz="xs" position="top-start" multiline w={280}>
                        {baris}
                      </Tooltip>
                    ) : baris;
                  })}
                </Table.Tbody>
              </Table>
            </Box>
            {/* Satu callout, bukan dua. Penguncian termin dan pemilihan jatuh tempo berangkat
                dari premis yang sama — satu faktur hanya punya satu syarat bayar — jadi premis
                itu ditulis sekali, lalu akibatnya menyusul. Dua kotak terpisah dulu membuka
                dengan kalimat yang persis sama. */}
            {isDp ? (
              <Callout title="Faktur uang muka">
                Pesanan ini menunggu tagihan uang muka, jadi fakturnya dicatat sendiri per PO/SPK tanpa digabung. Setelah disimpan, hutangnya tinggal diajukan lewat
                Payment Request, dan faktur pelunasan nanti otomatis dipotong uang muka ini.
              </Callout>
            ) : lockedKey ? (
              <Callout title={`Terkunci pada termin ${lockedTerm}`}>
                <Stack gap={6}>
                  <Text fz="xs">
                    Satu faktur hanya punya satu jatuh tempo dan satu aturan potongan uang muka, jadi
                    {' '}{nounJalur} bertermin lain ikut dinonaktifkan. Kosongkan pilihan untuk berganti termin.
                  </Text>
                  {/* Jatuh tempo tiap penerimaan sudah tertera di kolomnya masing-masing,
                      jadi di sini cukup disebut mana yang menang. */}
                  {tempoBeda && (
                    <Text fz="xs">
                      Tanggal penerimaannya berbeda, jadi jatuh tempo diambil dari yang paling akhir:{' '}
                      <Text span fz="xs" fw={700}>{temponya(penentu).text}</Text>, dari {penentu.number}.
                      Bisa diubah di langkah Data Faktur.
                    </Text>
                  )}
                </Stack>
              </Callout>
            ) : (
              <Callout>
                {fromPo ? 'Beberapa PO/SPK' : 'Beberapa FPB/BAPP'} boleh digabung jadi satu faktur selama vendor dan
                termin bayarnya sama. Termin {nounJalur} yang dipilih pertama akan mengunci sisanya.
              </Callout>
            )}
          </>
        )
      )}

      {mode === 'manual' && (
        <Callout tone="warn" title="Tanpa penerimaan">
          Faktur ini tidak bersandar pada FPB/BAPP, jadi tidak ada pencocokan 3 arah: qty dan harganya tidak diadu
          dengan pesanan mana pun.
        </Callout>
      )}
    </Stack>
  );
}

// --- Halaman ------------------------------------------------------------------------------------
export default function InvoiceForm({ pb, initialReceiptIds = [], initialPoId = null, initialDpPoId = null, onBack, onSaved }) {
  const readyReceipts = pb.receipts.filter((r) => uninvoicedLines(r, pb.invoices).length > 0);
  // Pesanan yang boleh ditagih LANGSUNG: sudah dikirim, masih punya qty belum difaktur, dan
  // memang disepakati TANPA serah terima sejak penawaran (`withReceipt: false`).
  //
  // Penandanya dipakai, bukan ditebak dari "belum ada FPB/BAPP". Tebakan itu rapuh di dua sisi:
  // pesanan berserah-terima yang penerimaannya belum dicatat akan ikut terbuka untuk ditagih
  // langsung, dan sekali ditagih begitu, sisa FPB-nya tetap terlihat belum difaktur — sisa
  // penerimaan dihitung per FPB/BAPP (`invoicedQty`), sisa pesanan per PO (`invoicedQtyOfPo`).
  // Vendor bisa tertagih dua kali untuk barang yang sama.
  const readyPos = pb.pos.filter((p) => uninvoicedPoLines(p, pb.invoices).length > 0);
  // Pesanan yang menunggu faktur uang muka: masih berjalan (tidak harus sudah dikirim),
  // terminnya ber-DP, belum ada faktur DP-nya, dan tidak sedang diajukan pembatalan uang muka.
  const readyDpPos = pb.pos.filter((p) => !p.closedAs && !poPending(p)
    && dpState(p, pb.calc)?.state === 'belum_faktur'
    && p.dpWaiver?.status !== 'diajukan');
  // Pilihan awal dari alamat halaman disaring: vendor dan termin harus sama dengan
  // penerimaan pertama, supaya ?from=... tidak bisa menyelundupkan gabungan yang terlarang.
  // Uang muka pesanan belum beres -> faktur pelunasannya ditahan (lihat dpBlocks di utils.js).
  const dpTahanOf = (d) => dpBlockReason(dpState(d?.items ? d : pb.posById[d?.poId], pb.calc));
  const seeded = (() => {
    const ada = initialReceiptIds.map((id) => readyReceipts.find((r) => r.id === id)).filter((r) => r && !dpTahanOf(r));
    if (!ada.length) return [];
    const k = (r) => termKey(pb.posById[r.poId]?.term);
    const first = ada[0];
    return ada.filter((r) => r.vendorId === first.vendorId && k(r) === k(first)).map((r) => r.id);
  })();

  const [active, setActive] = useState(0);
  const [reached, setReached] = useState(0);
  const [sub, setSub] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  // Dibuka dari detail PO/SPK tanpa serah terima: jalurnya langsung ke pesanan itu.
  const seededPo = readyPos.some((p) => p.id === initialPoId && !dpTahanOf(p)) ? initialPoId : null;
  // Dibuka dari tombol "Catat faktur uang muka" di detail PO: langkah 1 sudah terisi.
  const seededDp = readyDpPos.some((p) => p.id === initialDpPoId) ? initialDpPoId : null;
  const dpIds = new Set(readyDpPos.map((p) => p.id));
  const [mode, setMode] = useState(seededDp || seededPo ? 'po' : 'receipt');
  const [vendorId, setVendorId] = useState(
    () => (seededDp ? pb.posById[seededDp]?.vendorId : seededPo ? pb.posById[seededPo]?.vendorId : pb.receiptsById[seeded[0]]?.vendorId) ?? null,
  );
  const [picked, setPicked] = useState(seededDp ? [seededDp] : seededPo ? [seededPo] : seeded);
  // Nilai uang muka: null = ikut termin pesanan yang dipilih.
  const [dpInput, setDpInput] = useState(null);
  const [manualLines, setManualLines] = useState([blankLine()]);

  const [vendorNo, setVendorNo] = useState('');
  // Nomor seri faktur pajak (e-Faktur) dari vendor. Opsional: vendor non-PKP tidak menerbitkannya.
  const [taxNo, setTaxNo] = useState('');
  const [date, setDate] = useState(TODAY);
  const [dueInput, setDueInput] = useState(null);
  const [pphInput, setPphInput] = useState(null);
  const [inv, setInv] = useState('');
  const [tax, setTax] = useState('');

  const manual = mode === 'manual';
  const fromPo = mode === 'po';
  // Faktur uang muka = jalur PO/SPK dengan satu pesanan yang menunggu tagihan DP-nya.
  const isDp = fromPo && picked.length === 1 && dpIds.has(picked[0]);
  const vendor = pb.vendorsById[vendorId];
  // Dokumen sumber yang bisa dipilih di langkah 1, menurut jalurnya.
  const ready = fromPo
    ? [...readyDpPos, ...readyPos.filter((p) => !dpIds.has(p.id))]
    : readyReceipts;
  const docById = (id) => (fromPo ? pb.posById[id] : pb.receiptsById[id]);
  const receipts = manual || fromPo ? [] : picked.map((id) => pb.receiptsById[id]).filter(Boolean);
  const orders = fromPo ? picked.map((id) => pb.posById[id]).filter(Boolean) : [];
  // Dokumen sumber yang sedang ditagih, apa pun jalurnya — dipakai kepala kartu dan modal daftar.
  const sumber = fromPo ? orders : receipts;

  // Mengganti vendor membuang pilihan dokumen: menyisakan pilihan vendor lama akan
  // menagihkan barang vendor A ke vendor B tanpa terlihat.
  const pickVendor = (id) => { setVendorId(id); setPicked([]); setDpInput(null); };
  // Identitas termin satu dokumen sumber. Penerimaan mewarisi termin pesanan asalnya;
  // pesanan membawa terminnya sendiri.
  const keyOf = (d) => termKey(fromPo ? d?.term : pb.posById[d?.poId]?.term);
  // Dokumen bertermin lain ditolak di sini juga, bukan hanya dinonaktifkan di tabel:
  // pilihan awal bisa datang dari alamat halaman (?from=...), yang tidak lewat tabel itu.
  const togglePick = (id) => setPicked((p) => {
    if (p.includes(id)) return p.filter((x) => x !== id);
    // Uang muka: satu faktur untuk satu pesanan, memilih yang lain menggantikan pilihan.
    // Uang muka: satu faktur untuk satu pesanan, tidak digabung dengan baris lain.
    if (fromPo && (dpIds.has(id) || (p.length && dpIds.has(p[0])))) { setDpInput(null); return [id]; }
    if (dpTahanOf(docById(id))) return p;
    if (p.length && keyOf(docById(id)) !== keyOf(docById(p[0]))) return p;
    return [...p, id];
  });

  // --- baris faktur ---
  const base = fromPo
    ? orders.flatMap((po) => uninvoicedPoLines(po, pb.invoices).map((it) => ({
      key: `${po.id}:${it.id}`,
      poId: po.id,
      sourceNo: po.number,
      itemId: it.id,
      desc: it.desc,
      unit: it.unit,
      price: it.price,
      ppnRate: it.ppnRate,
      pphRate: it.pphRate ?? 0,
      open: it.open,
    })))
    : receipts.flatMap((r) => {
    const po = pb.posById[r.poId];
    return uninvoicedLines(r, pb.invoices).map((l) => {
      const it = po.items.find((i) => i.id === l.itemId);
      return {
        key: `${r.id}:${l.itemId}`,
        receiptId: r.id,
        sourceNo: r.number,
        poId: po.id,
        itemId: l.itemId,
        desc: it.desc,
        unit: it.unit,
        price: it.price,
        ppnRate: it.ppnRate,
        pphRate: it.pphRate ?? 0,
        open: l.open,
      };
    });
  });
  // Qty default = seluruh sisa yang belum difaktur. Disimpan terpisah supaya pilihan
  // penerimaan bisa berubah tanpa membuang angka yang sudah disesuaikan.
  const [qtys, setQtys] = useState({});
  const dpPo = isDp ? orders[0] : null;
  // Uang muka dicatat sebagai DPP + PPN terpisah (faktur pajak uang muka), seperti invoice
  // vendor. Faktur termin berikutnya memotong DPP-nya dan hanya mengenakan PPN atas sisanya.
  const dpBase = dpPo ? poDpDpp(dpPo) : 0;
  const dpAmount = dpInput ?? dpBase;
  const dpLine = dpPo && {
    key: 'dp', kind: 'dp', poId: dpPo.id, sourceNo: dpPo.number,
    desc: `${dpLabelOf(dpPo)} atas ${poDocLabel(dpPo)} ${dpPo.number}`,
    unit: 'ls', qty: 1, price: dpAmount, ppnRate: poPpnRate(dpPo), pphRate: poPphPct(dpPo) / 100,
  };
  const lines = isDp
    ? (dpLine ? [dpLine] : [])
    : manual ? manualLines : base.map((b) => ({ ...b, qty: qtys[b.key] ?? b.open }));
  const setManualLine = (key, patch) => setManualLines((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  // --- jatuh tempo ---
  // Jatuh tempo mengikuti termin pesanan; titik hitungnya diatur di Pengaturan (sejak
  // penerimaan atau sejak tanggal faktur vendor). Faktur manual tidak punya pesanan,
  // jadi selalu dihitung dari tanggal fakturnya sendiri.
  const poTerm = fromPo ? orders[0]?.term : pb.posById[receipts[0]?.poId]?.term;
  // Uang muka ditagih saat itu juga, bukan menurut tempo pelunasan pesanannya.
  const termDue = isDp ? 0 : dueDaysOf(poTerm);
  // Tanpa FPB/BAPP tidak ada tanggal penerimaan untuk dijadikan acuan, jadi tempo apa pun
  // yang disepakati dihitung dari tanggal faktur vendor.
  const dueFrom = manual || fromPo ? 'invoice' : termMechanics(poTerm).dueFrom;
  // Beberapa penerimaan sekaligus: acuannya yang paling akhir, karena kewajiban bayar baru
  // genap setelah kiriman terakhir diterima. Penerimaan penentunya disebut namanya di layar,
  // supaya satu jatuh tempo dari tiga tanggal penerimaan tidak terlihat sewenang-wenang.
  const anchorReceipt = receipts.length
    ? receipts.filter((r) => r.date).reduce((a, b) => (b.date > a.date ? b : a), receipts[0])
    : null;
  const receiptDate = anchorReceipt?.date ?? TODAY;
  const countDue = (d) => addDays(dueFrom === 'invoice' ? d : receiptDate, termDue);
  const dueDate = dueInput ?? countDue(date);

  // --- angka ---
  const activeLines = lines.filter((l) => l.qty > 0);
  const baseDpp = activeLines.reduce((n, l) => n + l.qty * l.price, 0);
  const autoPph = baseDpp
    ? Math.round((activeLines.reduce((n, l) => n + l.qty * l.price * (l.pphRate ?? 0), 0) / baseDpp) * 10000) / 100
    : 0;
  const pph = pphInput ?? autoPph;
  const draft = { ...(isDp && { type: 'dp' }), lines: lines.map((l) => ({ ...l })), pphPct: pph, poId: lines[0]?.poId };
  // Satu sumber angka dengan detail faktur dan jurnalnya: potongan DP, PPN atas sisa,
  // retensi, dan PPh atas nilai yang dibayar dihitung oleh invTotals.
  const draftTotals = invTotals({ ...draft }, { pos: pb.pos, prs: pb.prs, returns: [], invoices: pb.invoices });
  // Total yang dibandingkan dengan invoice vendor bila sebagian harga diganti (modal ubah harga).
  // Rumusnya sama dengan total di atas: potongan DP, PPN, retensi, dan PPh ikut dihitung.
  const totalWith = (priceByKey) => invTotals({
    ...draft,
    lines: draft.lines.map((l) => {
      const p = priceByKey[`${l.poId}:${l.itemId}`];
      return p != null ? { ...l, price: p } : l;
    }),
  }, { pos: pb.pos, prs: pb.prs, returns: [], invoices: pb.invoices }).total;
  const dpp = draftTotals.dpp;
  const ppn = draftTotals.ppn;
  const retensi = draftTotals.retensi;
  const pphVal = draftTotals.pph;
  const dpDpp = draftTotals.dpDpp;
  const dpGross = draftTotals.dp - dpDpp;
  const total = draftTotals.total;
  // Total yang tertulis di invoice vendor, untuk dicocokkan dengan hitungan aplikasi.
  const [vendorTotal, setVendorTotal] = useState(null);
  const selisihVendor = vendorTotal > 0 ? vendorTotal - total : 0;
  const [priceOpen, setPriceOpen] = useState(false);
  // Pesanan yang harganya sedang diajukan berubah: fakturnya ditahan sampai diputuskan,
  // supaya tidak tercatat dengan harga yang mungkin segera diganti.
  const pricePending = manual || isDp ? [] : [...new Set(activeLines.map((l) => l.poId))].map((id) => pb.posById[id]).filter(priceChangePending);
  const canAskPrice = !manual && !isDp && activeLines.length > 0 && !pricePending.length;

  // --- isian wajib per langkah ---
  const required = {
    source: {
      vendor: !vendorId && 'Vendor wajib dipilih',
      picked: !manual && !picked.length && (isDp ? 'Pilih pesanan yang uang mukanya ditagih' : `Pilih minimal satu ${fromPo ? 'pesanan' : 'penerimaan'} untuk difaktur`),
      term: !manual && new Set((fromPo ? orders : receipts).map(keyOf)).size > 1
        && `Termin bayar ${fromPo ? 'pesanan' : 'penerimaan'} yang dipilih berbeda — satu faktur hanya untuk satu termin`,
    },
    items: {
      qty: !activeLines.length && 'Isi minimal satu qty',
      desc: manual && manualLines.some((l) => l.qty > 0 && !l.productId) && 'Pilih barang atau jasa untuk setiap baris',
      price: manual && manualLines.some((l) => l.qty > 0 && !(l.price > 0)) && 'Isi harga untuk setiap baris',
      pricePending: pricePending.length > 0 && `Ubah harga ${pricePending.map((p) => p.number).join(', ')} masih menunggu approval. Faktur bisa dicatat setelah diputuskan.`,
    },
    invoice: {
      no: !vendorNo.trim() && 'No. invoice vendor wajib diisi',
      date: (!date && 'Tanggal faktur wajib diisi') || (date > TODAY && 'Tanggal faktur tidak boleh setelah hari ini'),
      amount: isDp && ((!(dpAmount > 0) && 'Nilai uang muka wajib diisi')
        || (dpPo && dpAmount > poTotal(dpPo) && `Melebihi nilai ${poDocLabel(dpPo)} (${rupiah(poTotal(dpPo))})`)),
      // Faktur pajak uang muka belum tentu terbit, jadi untuk DP cukup invoice vendornya.
      files: isDp ? (!inv && 'Unggah invoice uang muka dari vendor') : (!inv || !tax) && 'Unggah invoice vendor dan faktur pajak',
    },
  };
  const blockOf = (i) => Object.values(required[STEPS[i].value]).find(Boolean) ?? null;
  const stepValid = (i) => !blockOf(i);
  const canGoTo = (i) => STEPS.slice(0, i).every((_, j) => stepValid(j));
  const errors = sub ? { ...required.source, ...required.items, ...required.invoice } : {};

  const go = (i) => {
    setSub(false);
    setActive(i);
    setReached((r) => Math.max(r, i));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = () => {
    // Isian wajib bisa saja ada di langkah lain; yang pertama kurang itulah yang dibuka.
    const kurang = STEPS.findIndex((_, i) => !stepValid(i));
    if (kurang >= 0) {
      go(kurang);
      setSub(true);
      return;
    }
    if (isDp) {
      const doc = {
        id: uid('fkt'),
        number: nextNumber('FKT', pb.invoices),
        type: 'dp',
        vendorNo: vendorNo.trim(),
        taxNo: taxNo.trim(),
        poId: dpPo.id,
        vendorId: dpPo.vendorId,
        date,
        dueDate,
        lines: [{ kind: 'dp', desc: dpLine.desc, unit: 'ls', qty: 1, price: dpAmount, ppnRate: dpLine.ppnRate }],
        pphPct: pph || 0,
        files: [inv, tax].filter(Boolean),
        createdBy: personLabel(pb.role),
      };
      pb.add('invoices', doc);
      toast('Faktur uang muka dicatat. Hutang ke vendor tercatat, tinggal diajukan Payment Request.');
      onSaved(doc.id);
      return;
    }
    const doc = {
      id: uid('fkt'),
      number: nextNumber('FKT', pb.invoices),
      vendorNo,
      taxNo: taxNo.trim(),
      poId: lines[0]?.poId,
      vendorId: vendor.id,
      date,
      dueDate,
      // Baris manual menyimpan keterangannya sendiri dan tidak merujuk penerimaan mana pun,
      // jadi tidak mengurangi sisa FPB/BAPP dan tidak ikut pencocokan 3 arah.
      lines: lines.filter((l) => l.qty > 0).map((l) => (manual
        ? { productId: l.productId, kind: l.kind, desc: l.desc.trim(), spec: l.spec.trim(), unit: l.unit, qty: l.qty, price: l.price, ppnRate: l.ppnRate, received: !!l.received }
        : { ...(l.receiptId ? { receiptId: l.receiptId } : {}), poId: l.poId, itemId: l.itemId, qty: l.qty, price: l.price, ppnRate: l.ppnRate })),
      pphPct: pph || 0,
      ...(vendorTotal > 0 && { vendorTotal }),
      files: [inv, tax],
    };
    pb.add('invoices', doc);
    toast(manual ? 'Faktur manual dibuat. Hutang ke vendor tercatat.' : 'Faktur dibuat. Hutang ke vendor tercatat.');
    onSaved(doc.id);
  };

  const step = STEPS[active];
  const last = active === STEPS.length - 1;
  const stepError = blockOf(active);
  const saveBlock = blockOf(0) ?? blockOf(1) ?? blockOf(2);

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" className="pb-form">
      <BackLink label="Kembali ke Tagihan Vendor" onClick={onBack} />

      <PageIntro
        icon={Invoice}
        title="Catat Faktur"
        description={
          isDp
            ? 'Tagihan uang muka dari vendor atas PO/SPK bertermin DP. Setelah dicatat, hutangnya diajukan lewat Payment Request dan nanti memotong faktur pelunasan.'
            : manual
            ? 'Tagihan vendor tanpa FPB/BAPP, untuk biaya non-PO seperti listrik, sewa, atau jasa berulang.'
            : fromPo
              ? 'Tagihan vendor langsung dari pesanan, untuk PO/SPK yang memang tidak melewati gudang. Harga dikunci sama dengan PO/SPK.'
              : 'Tagihan vendor atas barang/jasa yang sudah diterima. Qty dibatasi penerimaan dan harga dikunci sama dengan PO.'
        }
      />

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Stepper
          active={active}
          onStepClick={(i) => canGoTo(i) && go(i)}
          size="sm"
          iconSize={32}
          color="secondary.7"
          className="app-stepper"
          styles={{
            stepLabel: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 700 },
            stepDescription: { fontSize: 11 },
            separator: { marginInline: 8 },
          }}
        >
          {STEPS.map((s, i) => (
            <Stepper.Step
              key={s.value}
              allowStepSelect={canGoTo(i)}
              className={i <= reached ? 'step-reached' : undefined}
              label={
                <>
                  <Text component="span" display="block" fz={10} fw={600} tt="uppercase" c={i <= reached ? 'secondary.7' : 'slate.5'} style={{ letterSpacing: 0.5 }}>
                    Langkah {i + 1}
                  </Text>
                  {s.label}
                </>
              }
              description={s.description}
              icon={<s.icon size={16} />}
              completedIcon={<s.icon size={16} />}
            />
          ))}
        </Stepper>
      </Card>

      <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
        <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
          <Group gap="sm" wrap="nowrap" justify="space-between">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon variant="light" bg="slate.0" c="slate.7" size={32} radius="md">
                <step.icon size={16} />
              </ThemeIcon>
              <Box>
                <Text fw={700} fz="sm" c="slate.9">{step.label}</Text>
                <Text fz={11} c="slate.6">{step.description}</Text>
              </Box>
            </Group>
            {/* Siapa yang ditagih dan atas dasar apa. Dulu satu baris abu-abu yang menyambung
                nama vendor dengan deretan nomor FPB memakai titik — pada tiga penerimaan,
                nama PT-nya tenggelam di antara nomor yang bentuknya serupa. Sekarang nama
                vendor jadi barisnya sendiri, nomor penerimaan turun jadi keterangan. */}
            {vendor && (
              <Stack gap={4} align="flex-end" maw={420} style={{ flexShrink: 0 }}>
                <Text fz="sm" fw={700} c="slate.9" ta="right" lh={1.25}>{vendor.name}</Text>
                {manual ? (
                  <Text fz={11} c="slate.6">Tanpa penerimaan</Text>
                ) : sumber.length > MAX_BADGE ? (
                  <Badge
                    component="button"
                    type="button"
                    size="sm"
                    radius="sm"
                    variant="light"
                    color="primary"
                    fw={700}
                    tt="none"
                    rightSection={<CaretRight size={12} />}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setListOpen(true)}
                  >
                    {sumber.length} {fromPo ? 'PO/SPK' : 'FPB/BAPP'}
                  </Badge>
                ) : sumber.length ? (
                  <Group gap={4} justify="flex-end" wrap="wrap">
                    {sumber.map((r) => (
                      <Badge key={r.id} size="sm" radius="sm" variant="light" color="slate" fw={600} tt="none">
                        {r.number}
                      </Badge>
                    ))}
                  </Group>
                ) : (
                  <Text fz={11} c="slate.6">Belum ada {fromPo ? 'pesanan' : 'penerimaan'} dipilih</Text>
                )}
              </Stack>
            )}
          </Group>
        </Box>

        <Box p="lg">
          {pricePending.length > 0 && step.value !== 'source' && (
            <Box mb="md">
              <Callout tone="wait" title={`Ubah harga ${pricePending.map((p) => p.number).join(', ')} menunggu approval`}>
                Faktur ini belum bisa disimpan. Setelah Chief Finance dan Building Manager menyetujui, buka lagi
                form faktur: harganya otomatis memakai harga baru. Kalau ditolak, minta vendor merevisi invoice sesuai harga PO.
              </Callout>
            </Box>
          )}
          {sub && stepError && !(pricePending.length && step.value !== 'source') && (
            <Alert variant="light" color="red" radius="md" icon={<Warning size={16} />} mb="md">
              <Text fz="xs">{stepError}</Text>
            </Alert>
          )}

          {step.value === 'source' && (
            <SourceStep
              mode={mode}
              setMode={(m) => { setMode(m); setPicked([]); setQtys({}); setDpInput(null); }}
              vendorId={vendorId}
              setVendorId={pickVendor}
              picked={picked}
              togglePick={togglePick}
              ready={ready}
              pb={pb}
              errors={errors}
              keyOf={keyOf}
              dpIds={dpIds}
            />
          )}

          {step.value === 'items' && isDp && (
            <Stack gap="md">
              <Box style={tableFrame}>
                <Table verticalSpacing="xs" horizontalSpacing="sm" miw={600} styles={th}>
                  <Table.Thead bg="slate.0">
                    <Table.Tr>
                      <Table.Th>Item</Table.Th>
                      <Table.Th>Dari pesanan</Table.Th>
                      <Table.Th>Qty</Table.Th>
                      <Table.Th ta="right">Jumlah</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {lines.map((l) => (
                      <Table.Tr key={l.key}>
                        <Table.Td fz="sm" fw={600}>{l.desc}</Table.Td>
                        <Table.Td fz="xs" c="slate.7">{l.sourceNo}</Table.Td>
                        <Table.Td fz="sm">1 ls</Table.Td>
                        <Table.Td ta="right" fz="sm" fw={600}>{rupiah(l.price)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Box>
              <Callout title="Tanpa pencocokan barang">
                Uang muka dibayar sebelum barang/jasa diterima, jadi barisnya hanya satu: nilai uang muka.
                Nilainya bisa diubah di langkah Data Faktur bila invoice vendor berbeda dari termin.
              </Callout>
            </Stack>
          )}

          {step.value === 'items' && !isDp && (
            <Stack gap="md">
              <Box style={tableFrame}>
                <Table verticalSpacing="xs" horizontalSpacing="sm" miw={manual ? 880 : 720} styles={th}>
                  <Table.Thead bg="slate.0">
                    <Table.Tr>
                      {manual && <Table.Th w={110}>Jenis</Table.Th>}
                      <Table.Th>{manual ? 'Barang / jasa' : 'Item'}</Table.Th>
                      {!manual && <Table.Th>{fromPo ? 'Dari pesanan' : 'Penerimaan'}</Table.Th>}
                      {!manual && <Table.Th ta="right">Belum difaktur</Table.Th>}
                      <Table.Th w={manual ? 120 : 110}>Qty</Table.Th>
                      <Table.Th w={manual ? 150 : undefined} ta={manual ? undefined : 'right'}>{manual ? 'Harga satuan' : 'Harga PO'}</Table.Th>
                      <Table.Th ta="right">Jumlah</Table.Th>
                      {manual && <Table.Th w={44} />}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {manual
                      ? manualLines.map((l) => (
                        <Table.Tr key={l.key}>
                          <Table.Td>
                            {/* Ganti jenis mengosongkan pilihan: daftar barang dan daftar jasa
                                tidak saling tumpang tindih. */}
                            <Select
                              size="xs"
                              radius="md"
                              allowDeselect={false}
                              aria-label="Jenis baris"
                              data={KIND_OPTIONS}
                              value={l.kind}
                              onChange={(v) => setManualLine(l.key, { kind: v, productId: null, desc: '', unit: v === 'jasa' ? 'bulan' : 'pcs' })}
                            />
                          </Table.Td>
                          <Table.Td>
                            <Stack gap={6}>
                              <Select
                                size="xs"
                                radius="md"
                                searchable
                                aria-label={l.kind === 'jasa' ? 'Pilih jasa' : 'Pilih barang'}
                                placeholder={l.kind === 'jasa' ? 'Pilih jasa' : 'Pilih barang'}
                                data={productOptions(l.kind)}
                                value={l.productId}
                                error={sub && l.qty > 0 && !l.productId}
                                onChange={(id) => {
                                  const p = productCatalog.find((x) => x.id === id);
                                  // Deskripsi, satuan, dan harga katalog ikut terisi — sama seperti
                                  // memilih produk di faktur penjualan. Ketiganya tetap bisa diubah:
                                  // tagihan vendor belum tentu sama dengan acuan katalog.
                                  setManualLine(l.key, p
                                    ? { productId: p.id, desc: p.name, spec: p.description ?? '', unit: p.unit, ...(p.price ? { price: p.price } : {}) }
                                    : { productId: null, desc: '', spec: '' });
                                }}
                              />
                              {/* Deskripsi baris: terisi dari katalog lalu boleh disesuaikan —
                                  nama katalog menyebut APA yang ditagih, deskripsi menyebut
                                  yang MANA: periode, lokasi, nomor meteran. */}
                              <TextInput
                                size="xs"
                                radius="md"
                                aria-label="Deskripsi baris"
                                placeholder="Deskripsi baris (opsional)..."
                                value={l.spec}
                                onChange={(e) => setManualLine(l.key, { spec: e.currentTarget.value })}
                              />
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={6} wrap="nowrap">
                              <NumberField size="xs" radius="md" min={0} w={64} aria-label="Qty" value={l.qty} onChange={(v) => setManualLine(l.key, { qty: Number(v) || 0 })} />
                              <Text fz={11} c="slate.6">{l.unit}</Text>
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <NumberField size="xs" radius="md" money prefix="Rp " aria-label="Harga satuan" value={l.price} error={sub && l.qty > 0 && !(l.price > 0)} onChange={(v) => setManualLine(l.key, { price: Number(v) || 0 })} />
                          </Table.Td>
                          <Table.Td ta="right" fz="sm" fw={600}>{rupiah(l.qty * l.price)}</Table.Td>
                          <Table.Td>
                            <ActionIcon variant="subtle" color="red" aria-label="Hapus baris" disabled={manualLines.length === 1} onClick={() => setManualLines((x) => x.filter((y) => y.key !== l.key))}>
                              <Trash size={16} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))
                      : lines.map((l) => (
                        <Table.Tr key={l.key}>
                          <Table.Td fz="sm" fw={600}>{l.desc}</Table.Td>
                          <Table.Td fz="xs" c="slate.7">{l.sourceNo}</Table.Td>
                          <Table.Td ta="right" fz="sm">{l.open} {l.unit}</Table.Td>
                          <Table.Td>
                            <NumberField size="xs" radius="md" min={0} max={l.open} value={l.qty} onChange={(v) => setQtys((q) => ({ ...q, [l.key]: Math.min(Number(v) || 0, l.open) }))} />
                          </Table.Td>
                          <Table.Td ta="right" fz="sm">{rupiah(l.price)}</Table.Td>
                          <Table.Td ta="right" fz="sm" fw={600}>{rupiah(l.qty * l.price)}</Table.Td>
                        </Table.Tr>
                      ))}
                  </Table.Tbody>
                </Table>
              </Box>

              {manual && (
                <Group>
                  <Button size="xs" radius="md" variant="light" leftSection={<Plus size={14} />} onClick={() => setManualLines((l) => [...l, blankLine()])}>
                    Tambah baris
                  </Button>
                </Group>
              )}

              {manual ? null : fromPo ? (
                <Callout tone="warn" title="Pencocokan 2 arah">
                  Tanpa FPB/BAPP, qty faktur hanya diadu dengan qty pesanan — tidak ada bukti terima
                  yang membatasinya. Harga tetap dikunci sama dengan PO/SPK.
                </Callout>
              ) : (
                <Callout tone="warn" title="Pencocokan 3 arah">
                  Qty faktur dibatasi qty diterima (FPB/BAPP) dan harga dikunci sama dengan PO.
                </Callout>
              )}
            </Stack>
          )}

          {step.value === 'invoice' && (
            <Grid gutter="md">
              <Grid.Col span={{ base: 12, sm: 4 }}>
                <TextInput label="No. invoice vendor" placeholder="Contoh: INV-2026-0123" withAsterisk size="sm" radius="md" value={vendorNo} error={errors.no} onChange={(e) => setVendorNo(e.currentTarget.value)} />
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 4 }}>
                <DateField label="Tanggal faktur" withAsterisk size="sm" radius="md" max={TODAY} error={errors.date} value={date} onChange={(e) => setDate(e.currentTarget.value)} />
              </Grid.Col>
              <Grid.Col span={{ base: 6, sm: 4 }}>
                {/* Tanpa keterangan di bawahnya: tanggalnya sudah terisi, dan dasar
                    perhitungannya sudah diterangkan di langkah Sumber Tagihan. */}
                <DateField
                  label="Jatuh tempo"
                  size="sm"
                  radius="md"
                  min={date}
                  value={dueDate}
                  onChange={(e) => setDueInput(e.currentTarget.value)}
                />
              </Grid.Col>
              {/* Baris kedua sejajar dengan unggahan di bawahnya: PPh dan no. faktur pajak.
                  Nilai uang muka mengikuti termin pesanan dan tampil di ringkasan. */}
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <NumberField label="Potongan PPh" suffix=" %" size="sm" radius="md" min={0} max={100} decimalScale={2} value={pph} onChange={(v) => setPphInput(Number(v) || 0)} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <TextInput label="No. faktur pajak (opsional)" placeholder="Contoh: 04002600123456789" size="sm" radius="md" value={taxNo} onChange={(e) => setTaxNo(e.currentTarget.value)} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <FileField label="Invoice vendor" withAsterisk value={inv} error={errors.files} onChange={setInv} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <FileField label={isDp ? 'Faktur pajak (opsional)' : 'Faktur pajak'} withAsterisk={!isDp} value={tax} error={isDp ? undefined : errors.files} onChange={setTax} />
              </Grid.Col>
            </Grid>
          )}
        </Box>

        {/* Angka tagihan baru ada artinya setelah barisnya terisi, jadi pitanya hanya
            muncul di langkah rincian — bukan di dua langkah sebelumnya yang masih Rp 0. */}
        {step.value === 'items' && (
          <TotalsBand
            rows={[
              // Urutannya meniru invoice vendor: nilai, potongan DP, DPP, PPN, retensi, PPh.
              { label: isDp ? 'Uang muka (DPP)' : dpDpp > 0 ? 'Nilai tagihan' : 'DPP', value: rupiah(dpp) },
              dpDpp > 0 && { label: 'Potongan uang muka', value: `-${rupiah(dpDpp)}`, color: 'red.7' },
              dpDpp > 0 && { label: 'DPP', value: rupiah(dpp - dpDpp) },
              ppn > 0 && { label: ppnLabel(activeLines), value: `+${rupiah(ppn)}` },
              retensi > 0 && { label: `Retensi ${pb.posById[draft.poId]?.term?.retentionPct ?? ''}% ditahan`, value: `-${rupiah(retensi)}`, color: 'red.7' },
              pphVal > 0 && { label: `PPh ${pph}%${retensi > 0 || dpDpp > 0 ? ' atas nilai dibayar' : ''}`, value: `-${rupiah(pphVal)}`, color: 'red.7' },
              dpGross > 0 && { label: 'Potongan uang muka', value: `-${rupiah(dpGross)}`, color: 'red.7' },
            ]}
            totalLabel="Hutang ke vendor"
            total={total}
          >
            {/* Harga dan totalnya sudah otomatis dari PO + FPB/BAPP. Kolom ini hanya alat cek:
                ketik angka bawah invoice vendor kalau mau dicocokkan, boleh dilewati. */}
            <Box mt="sm" pt="sm" style={{ borderTop: '1px dashed var(--mantine-color-gray-3)' }}>
              <NumberField
                label="Cek dengan invoice vendor (opsional)"
                description="Total sudah dihitung otomatis. Isi angka total di invoice vendor hanya kalau mau dicocokkan."
                placeholder={rupiah(total)}
                money
                prefix="Rp "
                size="xs"
                radius="md"
                value={vendorTotal ?? ''}
                onChange={(v) => setVendorTotal(Number(v) || null)}
              />
              {vendorTotal > 0 && (
                <Box mt={8}>
                  {Math.abs(selisihVendor) <= 1 ? (
                    <Callout tone="ok" title="Cocok dengan invoice vendor">Hutang ke vendor {rupiah(total)}.</Callout>
                  ) : (
                    <Callout tone="warn" title={`Selisih ${rupiah(Math.abs(selisihVendor))}`}>
                      <Stack gap={8} align="flex-start">
                        <Text fz="xs">
                          Invoice vendor {selisihVendor > 0 ? 'lebih besar' : 'lebih kecil'} dari hitungan aplikasi ({rupiah(total)}). Cek dulu qty,
                          potongan uang muka, retensi, dan PPh-nya. Kalau harga satuannya yang beda, ajukan ubah harga PO.
                        </Text>
                        {canAskPrice && (
                          <Button size="xs" radius="md" variant="default" onClick={() => setPriceOpen(true)}>Ajukan ubah harga PO</Button>
                        )}
                      </Stack>
                    </Callout>
                  )}
                </Box>
              )}
            </Box>
          </TotalsBand>
        )}

        <Group justify="space-between" gap="sm" px="lg" py="md" bg="white" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
          <Button variant="outline" color="slate" radius="md" onClick={onBack}>Batal</Button>
          <Group gap="sm">
            {active > 0 && (
              <Button variant="default" radius="md" leftSection={<ArrowLeft size={16} />} onClick={() => go(active - 1)}>
                Langkah sebelumnya
              </Button>
            )}
            {last ? (
              <Tooltip label={saveBlock} disabled={!saveBlock} withArrow fz="xs" position="top">
                <Button radius="md" leftSection={<Check size={16} />} onClick={submit} {...blockedProps(saveBlock, () => setSub(true))}>
                  Simpan faktur
                </Button>
              </Tooltip>
            ) : (
              <Tooltip label={stepError} disabled={!stepError} withArrow fz="xs" position="top">
                <Button radius="md" rightSection={<ArrowRight size={16} />} onClick={() => go(active + 1)} {...blockedProps(stepError, () => setSub(true))}>
                  Lanjut
                </Button>
              </Tooltip>
            )}
          </Group>
        </Group>
      </Card>

      {priceOpen && (
        <PriceChangeModal
          opened
          onClose={() => setPriceOpen(false)}
          pb={pb}
          lines={activeLines}
          vendorNo={vendorNo}
          file={inv}
          vendorTotal={vendorTotal}
          totalWith={totalWith}
          onSent={() => setPriceOpen(false)}
        />
      )}

      <SourceListModal
        opened={listOpen}
        onClose={() => setListOpen(false)}
        docs={sumber}
        fromPo={fromPo}
        vendor={vendor}
        pb={pb}
      />
    </Stack>
  );
}
