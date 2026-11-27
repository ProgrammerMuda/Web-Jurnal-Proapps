// Panel "Alur pembelian": rantai dokumen dari permintaan sampai pembayaran.
// Dipakai di semua halaman detail; dokumen yang sedang dibuka ditandai "Dokumen ini".
//
// Uang muka punya rantainya sendiri (faktur DP -> PR -> PV) yang terjadi SEBELUM barang
// datang. Dulu dokumen-dokumennya tersebar ke langkah Faktur dan Payment Voucher di ujung
// alur, sehingga PO yang baru lunas DP-nya terbaca seperti sudah hampir selesai: Faktur
// tercentang, PV tercentang, padahal penerimaan dan pelunasannya belum ada. Sekarang tiap
// pembayaran (uang muka, pelunasan) mengelompokkan dokumennya sendiri, dan hanya satu
// langkah yang menyala: yang harus dikerjakan berikutnya.
import { Badge, Box, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { Check, TreeStructure } from '@/components/Icon.jsx';
import { DocNumber, Section, StatusPill } from './components.jsx';
import { termMechanics } from './paymentTerms.js';
import { TODAY } from './data.js';
import {
  advancePct,
  effectivePoTerm,
  dpState,
  poAllJasa,
  isDpInvoice,
  isRetentionRelease,
  formatDate,
  poDpAmount,
  poRetention,
  PR_STATUS,
  PROC_STATUS,
  PV_STATUS,
  pvStatus,
  routeLabel,
  rupiah,
  retentionDocName,
  poOriginFppbj,
  poPending,
} from './utils.js';
import { approvalState, roleLabel } from './permissions.js';

// Satu langkah: titik status + judul (+ status di kanan) + isi.
export function FlowStep({ index, current, last, title, meta, right, children, mark, state }) {
  const done = state ? state === 'done' : index < current;
  const active = state ? state === 'active' : index === current;
  const skipped = state === 'skipped';
  return (
    <Group gap="sm" align="flex-start" wrap="nowrap">
      <Stack align="center" gap={0} style={{ alignSelf: 'stretch', flexShrink: 0 }}>
        <ThemeIcon
          size={26}
          radius="xl"
          variant={done ? 'filled' : 'default'}
          color={done ? 'secondary.7' : 'slate'}
          style={active ? { background: 'var(--mantine-color-secondary-1)', borderColor: 'var(--mantine-color-secondary-3)' } : undefined}
        >
          {done ? <Check size={14} /> : <Text fz={11} fw={700} c={active ? 'secondary.9' : 'slate.5'}>{skipped ? '—' : mark ?? index + 1}</Text>}
        </ThemeIcon>
        {!last && <Box w={2} mt={4} style={{ flex: 1, minHeight: 16, background: done ? 'var(--mantine-color-secondary-7)' : 'var(--mantine-color-gray-3)' }} />}
      </Stack>
      <Box pb={last ? 0 : 'md'} style={{ minWidth: 0, flex: 1 }}>
        <Group justify="space-between" gap="xs" wrap="nowrap" mih={26}>
          <Box style={{ minWidth: 0 }}>
            <Text fz="sm" fw={active ? 700 : 600} c={done || active ? 'slate.9' : 'slate.6'} lh={1.3}>{title}</Text>
            {meta && <Text fz={11} c="slate.6" lh={1.3}>{meta}</Text>}
          </Box>
          {right}
        </Group>
        {children && <Box mt={4}>{children}</Box>}
      </Box>
    </Group>
  );
}

const Empty = ({ children }) => <Text fz="xs" c="slate.6">{children}</Text>;

// Baris dokumen di dalam kelompok pembayaran: nama dokumen kecil di atas, nomornya di bawah.
// Kolom samping terlalu sempit untuk label + nomor + dua status sebaris (badge terpotong),
// jadi label ditaruh di atas dan tiap baris dipisah garis tipis.
function SubRow({ label, children }) {
  return (
    <Box py={8} className="pb-subrow">
      <Text fz={11} c="slate.6" mb={4}>{label}</Text>
      <Stack gap={6}>{children}</Stack>
    </Box>
  );
}
const SubGroup = ({ children }) => (
  <Box
    px="sm"
    py={2}
    style={{ border: '1px solid var(--mantine-color-gray-2)', borderRadius: 'var(--mantine-radius-md)', background: 'var(--mantine-color-slate-0)' }}
  >
    {children}
  </Box>
);

// Status uang muka dalam kata pendek, untuk pil di kanan judul langkah.
const DP_PILL = {
  belum_faktur: { label: 'Belum ditagih', color: 'orange' },
  belum_bayar: { label: 'Belum dibayar', color: 'orange' },
  lunas: { label: 'Lunas', color: 'green' },
  dibatalkan: { label: 'Dibatalkan', color: 'gray' },
};
const Pill = ({ label, color }) => (
  <Badge size="sm" radius="xl" variant="light" color={color} tt="none" fw={600} style={{ flexShrink: 0 }}>{label}</Badge>
);

// Telusuri rantai dokumen mulai dari dokumen yang sedang dibuka.
// current = { kind: 'fppbj' | 'po' | 'receipt' | 'invoice' | 'pr' | 'voucher', id }
export function resolveChain(current, pb) {
  const { kind, id } = current;
  let fppbj = null;
  let pos = [];

  if (kind === 'fppbj') {
    fppbj = pb.fppbjById[id];
    pos = pb.pos.filter((p) => p.fppbjId === id);
  } else {
    // Dokumen hilir selalu bisa ditarik balik ke satu PO.
    let poId = null;
    if (kind === 'po') poId = id;
    if (kind === 'receipt') poId = pb.receiptsById[id]?.poId;
    if (kind === 'invoice') poId = pb.invoicesById[id]?.poId;
    if (kind === 'pr' || kind === 'voucher') {
      const pr = kind === 'pr' ? pb.prsById[id] : pb.prsById[(pb.vouchersById[id]?.prIds ?? [])[0]];
      poId = pr?.poId ?? pb.invoicesById[(pr?.invoiceIds ?? [])[0]]?.poId;
    }
    const po = poId ? pb.posById[poId] : null;
    pos = po ? [po] : [];
    // PO pesan ulang menumpang permintaan PO lamanya.
    fppbj = po ? poOriginFppbj(po, pb.posById, pb.fppbjById) : null;
  }

  const poIds = pos.map((p) => p.id);
  const receipts = pb.receipts.filter((r) => poIds.includes(r.poId));
  const invoices = pb.invoices.filter((i) => poIds.includes(i.poId));
  const prs = pb.prs.filter(
    (p) => p.status !== 'ditolak' && (poIds.includes(p.poId) || invoices.some((i) => p.invoiceIds?.includes(i.id))),
  );
  // Uang muka dipisah dari pelunasan di setiap jenis dokumen: faktur, PR, dan PV.
  const dpInvoices = invoices.filter(isDpInvoice);
  // Pelepasan retensi punya langkahnya sendiri di ujung alur, terpisah dari faktur termin.
  const releases = invoices.filter(isRetentionRelease);
  const billInvoices = invoices.filter((i) => !isDpInvoice(i) && !isRetentionRelease(i));
  const dps = prs.filter((p) => p.kind === 'dp');
  const touchesRelease = (p) => (p.invoiceIds ?? []).some((x) => releases.some((r) => r.id === x));
  const retPrs = prs.filter((p) => p.kind !== 'dp' && touchesRelease(p));
  const pays = prs.filter((p) => p.kind !== 'dp' && !touchesRelease(p));
  const vouchers = pb.vouchers.filter((v) => (v.prIds ?? []).some((x) => prs.some((p) => p.id === x)));
  const isDpVoucher = (v) => (v.prIds ?? []).some((x) => dps.some((p) => p.id === x));
  const isRetVoucher = (v) => (v.prIds ?? []).some((x) => retPrs.some((p) => p.id === x));
  return {
    fppbj,
    pos,
    receipts,
    invoices,
    dpInvoices,
    billInvoices,
    dps,
    pays,
    vouchers,
    releases,
    retPrs,
    dpVouchers: vouchers.filter(isDpVoucher),
    retVouchers: vouchers.filter(isRetVoucher),
    payVouchers: vouchers.filter((v) => !isDpVoucher(v) && !isRetVoucher(v)),
  };
}

export default function PurchaseFlow({ pb, go, current, description = 'Dokumen yang saling terkait' }) {
  const { fppbj, pos, receipts, dpInvoices, billInvoices, dps, pays, dpVouchers, payVouchers, releases, retPrs, retVouchers } = resolveChain(current, pb);
  const proc = fppbj?.procurement;
  // Pesan ulang tidak melewati pengadaan lagi: vendor dan harganya dari PO lama, dan yang
  // ditinjau adalah approval pesan ulang (Chief Finance lalu Building Manager).
  const ro = pos.length === 1 && pos[0].reorderOf ? pos[0] : null;
  const roFrom = ro ? pb.posById[ro.reorderOf] : null;
  const roPending = ro ? poPending(ro) : false;
  const roRejected = ro?.reorder?.status === 'ditolak';
  const roAp = ro?.reorder ? approvalState(ro.reorder, 'reorder') : null;

  const here = (kind, id) => current.kind === kind && current.id === id;

  // Satu baris dokumen: nomor (klik = pindah halaman) + penanda + status opsional.
  const docRow = (route, id, number, extra) => (
    <Group key={id} gap={6} rowGap={4} wrap="wrap">
      {here(route, id) ? (
        <Text fz="xs" fw={700} c="primary.9">{number}</Text>
      ) : (
        <DocNumber onClick={() => go({ name: route, id })}>{number}</DocNumber>
      )}
      {here(route, id) && <Badge size="xs" radius="sm" variant="light" color="primary" tt="none">Dokumen ini</Badge>}
      {extra}
    </Group>
  );
  const prRow = (p) => docRow('pr', p.id, p.number, <StatusPill map={PR_STATUS} status={p.status} size="xs" approval={{ doc: p, kind: 'pr' }} />);
  const pvRow = (v) => docRow('voucher', v.id, v.number, <StatusPill map={PV_STATUS} status={pvStatus(v)} size="xs" />);
  // Faktur yang dibatalkan tetap ditampilkan (dokumen nyata), di bawah yang masih berlaku dan
  // diberi tanda, supaya tidak terbaca sebagai dua tagihan aktif.
  const invRows = (list) => [...list].sort((x, y) => !!x.cancelled - !!y.cancelled).map((i) => docRow('invoice', i.id, i.number,
    i.cancelled ? <Badge size="xs" radius="sm" variant="light" color="gray" tt="none">Dibatalkan</Badge> : null));

  // --- Uang muka ---------------------------------------------------------------------------
  // Ditampilkan bila termin pesanan memuat pembayaran di muka, atau dokumennya sudah ada
  // (dokumen nyata tidak boleh disembunyikan). Sebelum pesanan terbit terminnya belum pasti,
  // jadi langkahnya belum ditampilkan — alur cukup berhenti di Pesanan.
  const dpPos = pos.filter((p) => advancePct(p.term) > 0);
  const showDp = dpPos.length > 0 || dps.length > 0 || dpInvoices.length > 0;
  const dpStates = dpPos.map((p) => dpState(p, pb.calc)).filter(Boolean);
  // Beberapa pesanan sekaligus (dari satu permintaan): yang paling belum beres yang dilaporkan.
  const RANK = ['belum_faktur', 'belum_bayar', 'lunas', 'dibatalkan'];
  const dp = dpStates.length
    ? dpStates.reduce((a, b) => (RANK.indexOf(b.state) < RANK.indexOf(a.state) ? b : a))
    : dps.some((p) => p.status === 'dibayar') ? { state: 'lunas' } : { state: dps.length ? 'belum_bayar' : 'belum_faktur' };
  const activeDpPos = dpPos.filter((p) => advancePct(effectivePoTerm(p)) > 0);
  const dpPct = activeDpPos.length ? advancePct(activeDpPos[0].term) : null;
  const dpAmount = activeDpPos.reduce((n, p) => n + poDpAmount(p), 0);
  // PR uang muka lama (sebelum ada faktur DP) tidak punya faktur; barisnya tidak ditampilkan
  // agar tidak terbaca "belum dicatat" padahal memang tidak akan pernah ada.
  const legacyDp = !dpInvoices.length && dps.length > 0;
  // SPK tidak menunggu barang datang, dan termin progres / berkala tidak punya "pelunasan":
  // tiap termin atau periode ditagih sendiri-sendiri.
  const jasa = pos.length > 0 && pos.every(poAllJasa);
  const split = pos.length ? termMechanics(pos[0].term).split : 'none';
  const sebelum = jasa ? 'sebelum pekerjaan dimulai' : 'sebelum barang datang';
  const tagihan = split === 'terms' ? 'termin' : split === 'periods' ? 'per periode' : showDp ? 'pelunasan' : null;

  // Retensi: langkah terakhir, selama masa pemeliharaan berjalan pesanan belum tuntas.
  const retensi = pos.length === 1 ? poRetention(pos[0], pb.invoices) : null;
  const sisaBulan = retensi?.maintenanceEnd
    ? Math.max(0, Math.round((new Date(retensi.maintenanceEnd) - new Date(TODAY)) / (30.44 * 864e5)))
    : null;

  // --- Keadaan tiap langkah -------------------------------------------------------------------
  const steps = [
    { key: 'fppbj', done: !!fppbj && (pos.length > 0 || fppbj.status === 'selesai'), skipped: !fppbj },
    ro
      ? { key: 'reorder', done: !roPending && !roRejected }
      : { key: 'proc', done: !!fppbj && (proc?.status === 'disetujui' || pos.length > 0), skipped: !fppbj },
    { key: 'po', done: pos.length > 0 && !roPending && !roRejected },
    showDp && { key: 'dp', done: dp.state === 'lunas' || dp.state === 'dibatalkan' },
    { key: 'receipt', done: receipts.length > 0 },
    { key: 'invoice', done: billInvoices.length > 0 },
    { key: 'pay', done: pays.length > 0 && pays.every((p) => p.status === 'dibayar') },
    retensi && { key: 'ret', done: retensi.balance <= 0 && retPrs.length > 0 && retPrs.every((p) => p.status === 'dibayar') },
  ].filter(Boolean);
  // Satu langkah saja yang menyala: yang pertama belum selesai. Langkah lain yang belum
  // selesai tetap abu, supaya mata langsung tertuju ke pekerjaan berikutnya.
  const next = steps.find((s) => !s.done && !s.skipped)?.key;
  const stateOf = (key) => {
    const s = steps.find((x) => x.key === key);
    if (s.skipped) return 'skipped';
    return s.done ? 'done' : key === next ? 'active' : 'pending';
  };
  const indexOf = (key) => steps.findIndex((s) => s.key === key);
  const lastKey = steps[steps.length - 1].key;
  const step = (key, props, children) => (
    <FlowStep index={indexOf(key)} state={stateOf(key)} last={key === lastKey} {...props}>{children}</FlowStep>
  );

  return (
    <Section divided icon={TreeStructure} title="Alur pembelian" description={description}>
      <Stack gap={0}>
        {step('fppbj', { title: 'Permintaan Pembelian' },
          fppbj ? docRow('fppbj', fppbj.id, fppbj.number) : <Empty>Tanpa permintaan (PO langsung)</Empty>)}

        {ro && step('reorder', {
          title: 'Approval pesan ulang',
          right: roRejected
            ? <Pill label="Ditolak" color="red" />
            : roPending
              ? <Pill label={`${roAp.done.length}/${roAp.total}`} color="orange" />
              : <Pill label="Disetujui" color="green" />,
        },
        <Stack gap={2}>
          <Group gap={4} wrap="wrap">
            <Text fz="xs" c="slate.6">Pesan ulang dari</Text>
            {roFrom ? docRow('po', roFrom.id, roFrom.number) : <Empty>—</Empty>}
          </Group>
          <Text fz={11} c="slate.6">
            {roRejected
              ? 'Ditolak, pesanan tidak berlaku'
              : roPending
                ? `Menunggu ${roleLabel(roAp.next)}`
                : ro.reorder?.approvals ? 'Chief Finance dan Building Manager menyetujui' : 'Tanpa approval (data lama)'}
          </Text>
        </Stack>)}

        {!ro && step('proc', { title: 'Pengadaan' },
          fppbj?.route ? (
            <Text fz="xs" c="slate.6">
              {routeLabel(fppbj)}{proc?.status ? ` · ${PROC_STATUS[proc.status]?.label ?? proc.status}` : ''}
            </Text>
          ) : <Empty>{fppbj ? 'Belum dimulai' : 'Dilewati'}</Empty>)}

        {step('po', { title: 'Pesanan (PO / SPK)' },
          pos.length ? <Stack gap={2}>{pos.map((p) => docRow('po', p.id, p.number))}</Stack> : <Empty>Belum dibuat</Empty>)}

        {showDp && step('dp', {
          title: dpPct != null ? `Uang muka ${dpPct}%` : 'Uang muka',
          meta: dp.state === 'dibatalkan' ? null : dpAmount > 0 ? `${rupiah(dpAmount)} · dibayar ${sebelum}` : `Dibayar ${sebelum}`,
          right: <Pill {...DP_PILL[dp.state]} />,
        }, dp.state === 'dibatalkan' ? (
          <Empty>Uang muka dibatalkan (disetujui Chief Finance), ditagih penuh di akhir</Empty>
        ) : (
          <SubGroup>
            {!legacyDp && (
              <SubRow label="Faktur uang muka">
                {dpInvoices.length ? invRows(dpInvoices) : <Empty>Belum dicatat</Empty>}
              </SubRow>
            )}
            <SubRow label="Payment Request">
              {dps.length ? dps.map(prRow) : <Empty>Belum diajukan</Empty>}
            </SubRow>
            <SubRow label="Payment Voucher">
              {dpVouchers.length ? dpVouchers.map(pvRow) : <Empty>Belum terbit</Empty>}
            </SubRow>
          </SubGroup>
        ))}

        {step('receipt', { title: 'Penerimaan barang / jasa' },
          receipts.length ? <Stack gap={2}>{receipts.map((r) => docRow('receipt', r.id, r.number))}</Stack> : <Empty>Belum ada</Empty>)}

        {step('invoice', { title: tagihan ? `Faktur ${tagihan}` : 'Faktur' },
          billInvoices.length ? <Stack gap={4}>{invRows(billInvoices)}</Stack> : <Empty>Belum dibuat</Empty>)}

        {step('pay', { title: tagihan ? `Pembayaran ${tagihan}` : 'Pembayaran' },
          <SubGroup>
            <SubRow label="Payment Request">
              {pays.length ? pays.map(prRow) : <Empty>Belum diajukan</Empty>}
            </SubRow>
            <SubRow label="Payment Voucher">
              {payVouchers.length ? payVouchers.map(pvRow) : <Empty>Belum terbit</Empty>}
            </SubRow>
          </SubGroup>)}

        {retensi && step('ret', {
          title: `Pelepasan retensi ${retensi.pct}%`,
          meta: `${rupiah(retensi.target)} · setelah masa pemeliharaan ${retensi.months} bulan`,
          right: retensi.balance <= 0 && retensi.released > 0
            ? <Pill label="Dilepas" color="green" />
            : retensi.maintenanceEnd
              ? <Pill label={sisaBulan > 0 ? `${sisaBulan} bulan lagi` : 'Bisa dilepas'} color="violet" />
              : <Pill label="Menunggu termin" color="gray" />,
        },
        <SubGroup>
          <SubRow label={`Pelepasan (${retentionDocName(pos[0])})`}>
            {releases.length ? invRows(releases) : <Empty>{retensi.maintenanceEnd ? `Tersedia ${formatDate(retensi.maintenanceEnd)}` : 'Setelah termin terakhir difaktur'}</Empty>}
          </SubRow>
          <SubRow label="Payment Request">
            {retPrs.length ? retPrs.map(prRow) : <Empty>Belum diajukan</Empty>}
          </SubRow>
          <SubRow label="Payment Voucher">
            {retVouchers.length ? retVouchers.map(pvRow) : <Empty>Belum terbit</Empty>}
          </SubRow>
        </SubGroup>)}
      </Stack>
    </Section>
  );
}
