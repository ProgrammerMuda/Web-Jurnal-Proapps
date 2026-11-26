// Detail PO: penerimaan, faktur, payment request, dan retur yang turun dari dokumen ini.
import { approvalMessage, askConfirm } from './confirm.jsx';
import { useState } from 'react';
import { ActionIcon, Badge, Box, Button, Card, Divider, Grid, Group, Menu, Select, SimpleGrid, Stack, Table, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { ArrowCounterClockwise, ArrowsClockwise, Calculator, Check, ClipboardText, CurrencyCircleDollar, DotsThreeVertical, DownloadSimple, Info, Money, Package, PaperPlaneTilt, Prohibit, Receipt, ShoppingCart, Truck, X } from '@/components/Icon.jsx';
import { BackLink, Callout, CardHead, CopyIcon, DataTable, DocNumber, RoleChip, Section, StatusPill } from './components.jsx';
import PurchaseFlow from './PurchaseFlow.jsx';
import TermBreakdown from './TermBreakdown.jsx';
import ApprovalLog, { chainSteps } from './ApprovalLog.jsx';
import SpkScope from './SpkScope.jsx';
import { ReasonModal, SendPoModal } from './Dialogs.jsx';
import { personLabel, TODAY } from './data.js';
import { freightShare } from './landedCost.js';
import { freightCapitalized } from '@/pages/Pengaturan/settings.js';
import { useData } from '@/lib/store.jsx';
import { picName, warehouseById, warehouseOptions } from '@/pages/Gudang/data.js';
import { roleLabel, approvalState, isApproverTurn, signApproval, canApprove, canCreate, hidesPrices, prBlockedBySoD, receiptDoc, receiptKind, logEntry } from './permissions.js';
import {
  formatDate,
  INV_STATUS,
  RECEIPT_STATUS,
  receiptStatus,
  invStatus,
  invTotals,
  invoicedQty,
  invoicedQtyOfPo,
  canReturn as canReturnInv,
  advancePct,
  advanceLabel,
  dpInvoiceOf,
  dpBlockReason,
  dpBlocks,
  dpState,
  DP_STATE,
  poAllBarang,
  poAllJasa,
  poDocLabel,
  vendorEmail,
  poDpAmount,
  poStatus,
  poSubtotal,
  scheduleCount,
  scheduleExcludesDp,
  poPpn,
  ppnLabel,
  poTotal,
  PR_STATUS,
  receivedQty,
  receiptsOf,
  receiptLive,
  remainingQty,
  rupiah,
  poHasReceipt,
  uninvoicedLines,
  uninvoicedPoLines,
  isRetentionRelease,
  poRetention,
  retentionDocName,
  poStatusMap,
  poStopBlock,
  PR_ACTIVE,
  prCancelledPo,
  poPending,
  applyPriceChange,
  priceChangeOf,
  priceChangePending,
  reorderBlock,
  reordersOf,
  poOriginFppbj,
  RETURN_STATUS,
  returnGross,
  returnState,
  SETTLEMENT_LABEL,
} from './utils.js';
import { downloadPo } from './poPdf.js';
import { toast } from './usePb.js';

const th = { th: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600, color: 'var(--mantine-color-slate-7)', whiteSpace: 'nowrap' } };

// Tombol aksi Payment Request sesuai peran: Approver setujui/tolak, Finance bayar.
export function PrActions({ pr, pb, openDialog }) {
  const role = pb.role;
  if (PR_ACTIVE.includes(pr.status) && prCancelledPo(pr, pb.calc)) return <Text fz="xs" c="slate.6">Pesanan dibatalkan</Text>;
  if (pr.status === 'diajukan') {
    // Approval PR berjenjang dua: Chief Finance lalu Building Manager.
    const ap = approvalState(pr, 'pr');
    if (prBlockedBySoD(role, pr)) return <RoleChip role={ap.next ?? 'cfo'} />;
    return isApproverTurn(role, pr, 'pr') ? (
      <Group gap={6} wrap="nowrap">
        <Button size="compact-xs" radius="md" color="red" variant="light" onClick={() => openDialog({ type: 'pr-reject', prId: pr.id })}>Tolak</Button>
        <Button
          size="compact-xs"
          radius="md"
          leftSection={<Check size={12} />}
          onClick={() => askConfirm({
            title: `Setujui ${pr.number}?`,
            message: approvalMessage(ap, { final: 'Ini approval terakhir: Payment Request disetujui penuh dan siap diterbitkan Payment Voucher.' }),
            confirmLabel: 'Ya, setujui',
            onConfirm: () => {
              pb.update('prs', pr.id, (d) => {
                const { doc, complete } = signApproval(d, 'pr', role);
                return complete ? { ...doc, status: 'disetujui', approvedAt: TODAY } : doc;
              });
              toast('Approval dicatat.');
            },
          })}
        >
          Setujui ({ap.done.length + 1}/{ap.total})
        </Button>
      </Group>
    ) : (
      <RoleChip role={ap.next ?? 'cfo'} />
    );
  }
  if (pr.status === 'disetujui') {
    return canCreate(role, 'pv') ? (
      <Button size="compact-xs" radius="md" leftSection={<CurrencyCircleDollar size={12} />} onClick={() => openDialog({ type: 'pv', prId: pr.id })}>Terbitkan PV</Button>
    ) : (
      <RoleChip role="kasir" />
    );
  }
  return null;
}

export default function PoDetail({ po, pb, onBack, go, openDialog }) {
  const role = pb.role;
  const { warehouses, companySettings } = useData();
  const gudang = warehouseById(warehouses, po.warehouseId);
  // Gudang tujuan boleh diubah selama belum dikirim ke vendor (sesudahnya alamatnya sudah
  // tercetak di dokumen vendor) dan belum ada barang yang diterima ke gudang itu. Pesanan
  // lama yang gudangnya masih kosong tetap bisa dilengkapi.
  const anyReceived = pb.receipts.some((r) => r.poId === po.id && receiptLive(r));
  // Pesan ulang mengikuti gudang pesanan lamanya: terkunci, kecuali memang kosong.
  const canSetWarehouse = canCreate(role, 'po') && ((!po.sent && !anyReceived && !po.reorderOf) || !po.warehouseId);
  const label = poDocLabel(po);
  const isJasa = poAllJasa(po);
  // Spesifikasi 2.1: Gudang melihat pesanan dan tanggal kirim, tanpa harga.
  const noPrice = hidesPrices(role);
  // Ongkir yang dikapitalisasi ikut jadi harga barang, jadi harga baris di PO
  // bukan lagi harga yang nanti masuk persediaan — dijelaskan per baris.
  const ongkirMasuk = freightCapitalized(companySettings) && (Number(po.shipping) || 0) > 0;
  const ongkirPerUnit = (i) =>
    ongkirMasuk && (i.kind ?? 'barang') === 'barang' && i.qty > 0
      ? freightShare(po, i.id) / i.qty
      : 0;
  const pphCut = Math.round(po.items.reduce((n, i) => n + i.qty * i.price * (i.pphRate ?? 0), 0));
  const vendor = pb.vendorsById[po.vendorId];
  const status = poStatus(po, pb.calc);
  const fppbj = poOriginFppbj(po, pb.posById, pb.fppbjById);
  const receipts = receiptsOf(po, pb.receipts);
  const invoices = pb.invoices.filter((i) => i.poId === po.id || i.lines.some((l) => l.poId === po.id));
  const retensi = poRetention(po, pb.invoices);
  const prs = pb.prs.filter((p) => p.poId === po.id);
  const returns = pb.returns.filter((r) => invoices.some((i) => i.id === r.invoiceId));
  // Ada pembayaran di muka? CBD/DP (barang) maupun termin jasa yang menagih di awal.
  const hasDp = advancePct(po.term) > 0;
  const dpPr = prs.find((p) => p.kind === 'dp' && p.status !== 'ditolak');
  // Uang muka ditagih vendor lewat faktur uang muka dulu; PR-nya dibuat dari faktur itu.
  const dpInv = dpInvoiceOf(po.id, pb.invoices);
  // Status uang muka bertahap: belum ditagih -> belum dibayar -> lunas (atau dibatalkan resmi).
  const dp = dpState(po, pb.calc);
  const waiver = po.dpWaiver;
  const waiverPending = waiver?.status === 'diajukan';
  // Jalan keluar resmi bila vendor tidak pernah menagih DP: selama faktur uang mukanya belum ada.
  // Termin "DP di luar termin" tidak bisa: jadwal terminnya sudah dikurangi DP, jadi bagian
  // DP tidak akan pernah tertagih. Pesanan seperti itu harus direvisi terminnya.
  const canWaive = !po.closedAs && dp?.state === 'belum_faktur' && !waiverPending && !scheduleExcludesDp(po.term) && canCreate(role, 'invoice');
  const canDecideWaiver = waiverPending && canApprove(role, 'dpWaiver');
  const [waiverOpen, setWaiverOpen] = useState(false);
  const [waiverReject, setWaiverReject] = useState(false);
  const askWaiver = (note) => {
    pb.update('pos', po.id, (d) => ({ ...d, dpWaiver: { status: 'diajukan', reason: note, by: personLabel(role), at: TODAY, log: [...(d.dpWaiver?.log ?? []), logEntry(role, 'ajukan', { note })] } }));
    setWaiverOpen(false);
    toast('Pembatalan uang muka diajukan ke Chief Finance.');
  };
  const decideWaiver = (ok, note) => {
    pb.update('pos', po.id, (d) => ({
      ...d,
      dpWaiver: { ...d.dpWaiver, status: ok ? 'disetujui' : 'ditolak', decidedBy: personLabel(role), decidedAt: TODAY, ...(ok ? {} : { rejectNote: note }), log: [...(d.dpWaiver?.log ?? []), logEntry(role, ok ? 'setuju' : 'tolak', { step: 'cfo', ...(ok ? {} : { note }) })] },
    }));
    setWaiverReject(false);
    toast(ok ? 'Uang muka dibatalkan. Pesanan ditagih penuh di faktur pelunasan.' : 'Pembatalan uang muka ditolak.');
  };
  const anyRemaining = po.items.some((i) => remainingQty(po, i.id, pb.receipts) > 0);
  // Pesanan tanpa serah terima tidak pernah menghasilkan FPB/BAPP; fakturnya langsung dari sini.
  const pakaiTerima = poHasReceipt(po);
  const openLines = pakaiTerima
    ? receipts.flatMap((r) => uninvoicedLines(r, pb.invoices))
    : uninvoicedPoLines(po, pb.invoices);
  // Batalkan / tutup pesanan hanya selama belum ada penerimaan, faktur, atau Payment Request
  // yang berjalan. Menunya tetap tampil dengan alasannya supaya orang tahu apa yang harus
  // dibereskan dulu.
  const closed = !!po.closedAs;
  // Pesan ulang yang menunggu approval belum berlaku: belum bisa dikirim,
  // diterima, atau ditagih. Tombol-tombol itu disembunyikan, bukan dinonaktifkan.
  const pending = poPending(po);
  const inactive = closed || pending;
  const ro = po.reorder;
  const roFrom = po.reorderOf ? pb.posById[po.reorderOf] : null;
  const roChildren = reordersOf(po, pb.pos);
  const roChange = (itemId) => ro?.changes?.find((c) => c.itemId === itemId);
  const canDecideReorder = pending && isApproverTurn(role, ro, 'reorder');
  const [roReject, setRoReject] = useState(false);
  const canReorder = status === 'selesai' && canCreate(role, 'po');
  const roBlock = canReorder ? reorderBlock(po) : null;
  const approveReorder = () => {
    pb.update('pos', po.id, (d) => {
      const { doc, complete } = signApproval(d.reorder, 'reorder', role);
      return { ...d, reorder: complete ? { ...doc, status: 'disetujui', approvedAt: TODAY } : doc };
    });
    toast(approvalState(ro, 'reorder').done.length + 1 >= approvalState(ro, 'reorder').total ? `${po.number} disetujui dan mulai berlaku.` : 'Approval dicatat. Menunggu Building Manager.');
  };
  const rejectReorder = (note) => {
    pb.update('pos', po.id, (d) => ({
      ...d,
      closedAs: 'ditolak',
      closeNote: note,
      closedBy: personLabel(role),
      reorder: { ...d.reorder, status: 'ditolak', log: [...(d.reorder.log ?? []), logEntry(role, 'tolak', { step: approvalState(d.reorder, 'reorder').next, note })] },
    }));
    setRoReject(false);
    toast(`${po.number} ditolak dan tidak berlaku.`);
  };
  // Ubah harga dari form faktur (invoice vendor beda harga). Naik maupun turun perlu approval.
  const pc = po.priceChange;
  const pcPending = priceChangePending(po);
  const canDecidePrice = pcPending && isApproverTurn(role, pc, 'priceChange');
  // Qty yang belum difaktur per item: hanya itu yang terkena harga baru.
  const pcOpenQty = (itemId) => {
    const it = po.items.find((i) => i.id === itemId);
    const billed = pakaiTerima
      ? receipts.reduce((n, r) => n + invoicedQty(r.id, itemId, pb.invoices), 0)
      : invoicedQtyOfPo(po.id, itemId, pb.invoices);
    return Math.max((it?.qty ?? 0) - billed, 0);
  };
  const pcImpact = pc ? pc.items.reduce((n, c) => n + (c.price - c.oldPrice) * pcOpenQty(c.itemId), 0) : 0;
  const [pcReject, setPcReject] = useState(false);
  const approvePrice = () => {
    const final = approvalState(pc, 'priceChange').done.length + 1 >= approvalState(pc, 'priceChange').total;
    if (final) {
      // Penerimaan yang sudah tercatat dikunci di harga lama: jurnalnya tidak berubah ke belakang.
      const oldPrice = Object.fromEntries(pc.items.map((c) => [c.itemId, c.oldPrice]));
      receipts.filter((r) => r.lines.some((l) => oldPrice[l.itemId] != null && l.price == null)).forEach((r) => {
        pb.update('receipts', r.id, (d) => ({
          ...d,
          lines: d.lines.map((l) => (oldPrice[l.itemId] != null && l.price == null ? { ...l, price: oldPrice[l.itemId] } : l)),
        }));
      });
    }
    pb.update('pos', po.id, (d) => {
      const { doc, complete } = signApproval(d.priceChange, 'priceChange', role);
      if (!complete) return { ...d, priceChange: doc };
      return applyPriceChange({ ...d, priceChange: { ...doc, status: 'disetujui', approvedAt: TODAY } });
    });
    toast(final ? `Harga ${po.number} diperbarui. Fakturnya sekarang bisa dicatat dengan harga baru.` : 'Approval dicatat. Menunggu Building Manager.');
  };
  const rejectPrice = (note) => {
    pb.update('pos', po.id, (d) => ({
      ...d,
      priceChange: { ...d.priceChange, status: 'ditolak', rejectNote: note, log: [...(d.priceChange.log ?? []), logEntry(role, 'tolak', { step: approvalState(d.priceChange, 'priceChange').next, note })] },
    }));
    setPcReject(false);
    toast(`Ubah harga ${po.number} ditolak. Harga PO tetap.`);
  };
  const stopBlock = closed ? null : poStopBlock(po, pb.calc);
  const canClose = !closed && canCreate(role, 'po');
  const [closing, setClosing] = useState(null);
  const [sendOpen, setSendOpen] = useState(false);
  // Kirim ke vendor = dokumen lepas ke luar, jadi dikonfirmasi dulu lewat modal.
  // Tombolnya tidak hilang sesudah terkirim: vendor sering minta dokumennya dikirim ulang
  // (salah alamat, email hilang, ganti PIC). Tanggal kirim pertama dipertahankan — itu
  // yang jadi dasar SLA — dan pengiriman ulang dicatat terpisah.
  const sendPo = ({ cc, note }) => {
    pb.update('pos', po.id, (d) => ({
      ...d,
      sent: true,
      sentAt: d.sentAt ?? TODAY,
      sentBy: d.sentBy ?? personLabel(role),
      sentCc: cc,
      sentNote: note,
      ...(d.sent ? { resentAt: TODAY, resentBy: personLabel(role) } : {}),
    }));
    setSendOpen(false);
    toast(`${label} ${po.sent ? 'dikirim ulang' : 'dikirim'} ke ${vendorEmail(vendor) || 'vendor'}.`);
  };
  const dpPaid = prs.some((p) => p.kind === 'dp' && p.status === 'dibayar');
  const closePo = (as) => (note) => {
    pb.update('pos', po.id, (d) => ({ ...d, closedAs: as, closeNote: note, closedBy: personLabel(role) }));
    setClosing(null);
    toast(as === 'dibatalkan' ? `${label} dibatalkan.` : `${label} ditutup. Sisa qty tidak ditunggu lagi.`);
  };

  const lineRow = (label, value, extra) => (
    <Group justify="space-between" wrap="nowrap" align="flex-start" gap="md">
      <Text fz="xs" c="slate.7">{label}</Text>
      <Text fz="xs" fw={600} ta="right" {...extra}>{value}</Text>
    </Group>
  );
  const count = (n, unit) => <Badge size="sm" radius="sm" variant="light" color="slate" tt="none">{n} {unit}</Badge>;

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" className="pb-form">
      {/* Daftarnya satu (Pesanan), memuat PO maupun SPK — jadi teksnya tidak ikut label dokumen. */}
      <BackLink label="Kembali ke daftar pesanan" onClick={onBack} />

      <Card withBorder radius="lg" padding={0} bg="white">
        <Group justify="space-between" align="center" gap="md" p="lg">
          <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
            <ThemeIcon size={52} radius="md" color="primary.9"><ShoppingCart size={26} /></ThemeIcon>
            <Box style={{ minWidth: 0 }}>
              <Group gap="xs" wrap="wrap">
                <Title order={2} fz={{ base: 20, md: 24 }} c="slate.9">{po.number}</Title>
                <CopyIcon value={po.number} size={16} />
                <StatusPill map={poStatusMap(po)} status={status} />
                {/* Status utama tetap posisi barangnya; ubah harga yang menahan faktur ditandai terpisah. */}
                {pcPending && <Badge size="sm" radius="sm" variant="light" color="orange" fw={700} tt="none">Ubah harga diajukan</Badge>}
              </Group>
              <Text fz="sm" c="slate.6">{formatDate(po.date)}</Text>
              {po.note && <Text fz={11} c="teal.8" fw={600}>{po.note}</Text>}
            </Box>
          </Group>
          <Group gap="xs">
            {/* Dokumen yang sudah terbuat selalu bisa diunduh, oleh peran mana pun. */}
            <Button
              radius="md"
              variant="default"
              leftSection={<DownloadSimple size={16} />}
              onClick={() => { downloadPo(po, { vendor, fppbj, warehouse: gudang && { ...gudang, picName: picName(gudang.picUserId) } }); toast(`${label} diunduh sebagai PDF.`); }}
            >
              Unduh PDF
            </Button>
            {!inactive && (canCreate(role, 'po') ? (
              <Button
                radius="md"
                variant="default"
                leftSection={<PaperPlaneTilt size={16} />}
                onClick={() => setSendOpen(true)}
              >
                {po.sent ? 'Kirim ulang' : 'Kirim ke vendor'}
              </Button>
            ) : !po.sent && <RoleChip role="accounting" />)}
            {/* Faktur uang muka tidak menunggu PO/SPK terkirim: tagihan DP vendor sering terbit
                begitu pesanan disepakati. Ia jadi aksi utama di sebelah tombol kirim. */}
            {!inactive && dp?.state === 'belum_faktur' && !waiverPending && canCreate(role, 'invoice') && (
              <Button radius="md" leftSection={<Receipt size={16} />} onClick={() => go({ name: 'invoice-new', dpPoId: po.id })}>Catat faktur {advanceLabel(po.term) === 'DP' ? 'uang muka' : 'bayar di muka'}</Button>
            )}
            {canDecideWaiver && (
              <>
                <Button radius="md" variant="default" color="red" leftSection={<X size={16} />} onClick={() => setWaiverReject(true)}>Tolak pembatalan DP</Button>
                <Button radius="md" leftSection={<Check size={16} />} onClick={() => askConfirm({ title: 'Setujui pembatalan uang muka?', message: `${po.number} tidak lagi menagih uang muka; seluruh nilainya ditagih di faktur pelunasan. Keputusan ini tercatat di log approval dan tidak bisa dibatalkan.`, confirmLabel: 'Ya, setujui', onConfirm: () => decideWaiver(true) })}>Setujui pembatalan DP</Button>
              </>
            )}
            {!inactive && dp?.state === 'belum_bayar' && !dpPr && dpInv && canCreate(role, 'pr') && (
              <Button radius="md" variant="light" leftSection={<Money size={16} />} onClick={() => go({ name: 'pr-new', invoiceIds: [dpInv.id] })}>Buat Payment Request {advanceLabel(po.term)}</Button>
            )}
            {/* Tidak menunggu dokumen terkirim: barang sering datang duluan dan pekerjaan
                sering sudah jalan sebelum PO/SPK-nya sempat dikirim. */}
            {!inactive && pakaiTerima && anyRemaining && canCreate(role, receiptDoc(isJasa)) && (
              <Button radius="md" leftSection={<Truck size={16} />} onClick={() => openDialog({ type: 'receipt', poId: po.id })}>{poAllJasa(po) ? 'Catat BAPP' : 'Catat penerimaan'}</Button>
            )}
            {!inactive && openLines.length > 0 && canCreate(role, 'invoice') && (
              <Tooltip label={pcPending ? 'Ubah harga masih menunggu approval. Faktur bisa dicatat setelah diputuskan.' : dpBlockReason(dp)} disabled={!pcPending && !dpBlocks(dp)} withArrow fz="xs" multiline w={260}>
              <Button
                radius="md"
                leftSection={<Receipt size={16} />}
                disabled={pcPending || dpBlocks(dp)}
                onClick={() => (pakaiTerima
                  ? go({ name: 'invoice-new', receiptIds: receipts.filter((r) => uninvoicedLines(r, pb.invoices).length).map((r) => r.id) })
                  : go({ name: 'invoice-new', poId: po.id }))}
              >
                Catat faktur
              </Button>
              </Tooltip>
            )}
            {canDecideReorder && (
              <>
                <Button radius="md" variant="default" color="red" leftSection={<X size={16} />} onClick={() => setRoReject(true)}>Tolak</Button>
                <Button
                  radius="md"
                  leftSection={<Check size={16} />}
                  onClick={() => askConfirm({
                    title: `Setujui ${po.number}?`,
                    message: approvalMessage(approvalState(ro, 'reorder'), { final: `Ini approval terakhir: ${po.number} langsung berlaku dengan harga baru.` }),
                    confirmLabel: 'Ya, setujui',
                    onConfirm: approveReorder,
                  })}
                >
                  Setujui ({approvalState(ro, 'reorder').done.length + 1}/{approvalState(ro, 'reorder').total})
                </Button>
              </>
            )}
            {canDecidePrice && (
              <>
                <Button radius="md" variant="default" color="red" leftSection={<X size={16} />} onClick={() => setPcReject(true)}>Tolak ubah harga</Button>
                <Button
                  radius="md"
                  leftSection={<Check size={16} />}
                  onClick={() => askConfirm({
                    title: `Setujui ubah harga ${po.number}?`,
                    message: approvalMessage(approvalState(pc, 'priceChange'), { final: `Ini approval terakhir: harga ${po.number} langsung berubah untuk qty yang belum difaktur.` }),
                    confirmLabel: 'Ya, setujui',
                    onConfirm: approvePrice,
                  })}
                >
                  Setujui ubah harga ({approvalState(pc, 'priceChange').done.length + 1}/{approvalState(pc, 'priceChange').total})
                </Button>
              </>
            )}
            {canReorder && (
              <Tooltip label={roBlock} disabled={!roBlock} withArrow fz="xs" multiline w={260}>
                <Button radius="md" leftSection={<ArrowsClockwise size={16} />} disabled={!!roBlock} onClick={() => openDialog({ type: 'reorder', poId: po.id })}>Pesan ulang</Button>
              </Tooltip>
            )}
            {(canClose || canWaive) && (
              <>
                <Divider orientation="vertical" mx={2} />
                <Menu position="bottom-end" width={240} shadow="md" withinPortal>
                  <Menu.Target>
                    <ActionIcon variant="default" size={36} radius="md" aria-label="Aksi lainnya">
                      <DotsThreeVertical size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {canWaive && (
                      <>
                        <Menu.Label>Uang muka</Menu.Label>
                        <Menu.Item leftSection={<Prohibit size={16} />} onClick={() => setWaiverOpen(true)}>Batalkan uang muka</Menu.Item>
                      </>
                    )}
                    {canClose && (
                      <>
                        <Menu.Label>Hentikan pesanan</Menu.Label>
                        <Menu.Item disabled={!!stopBlock} leftSection={<Prohibit size={16} />} onClick={() => setClosing('ditutup')}>Tutup pesanan</Menu.Item>
                        <Menu.Item disabled={!!stopBlock} color="red" leftSection={<X size={16} />} onClick={() => setClosing('dibatalkan')}>Batalkan pesanan</Menu.Item>
                        {stopBlock && <Text fz="xs" c="slate.6" px="sm" pb={6}>{stopBlock}</Text>}
                      </>
                    )}
                  </Menu.Dropdown>
                </Menu>
              </>
            )}
          </Group>
        </Group>
      </Card>

      {closed && (
        <Callout tone="stop" title={{ dibatalkan: `${label} dibatalkan`, ditolak: `Pesan ulang ditolak · ${label} tidak berlaku` }[po.closedAs] ?? `${label} ditutup`}>
          {po.closeNote}
          {po.closedBy && <> — {po.closedBy}</>}
        </Callout>
      )}

      {pending && (
        <Callout tone="wait" title={`Menunggu approval ${roleLabel(approvalState(ro, 'reorder').next)} · ${label} belum berlaku`}>
          {ro.increased === false
            ? `Pesan ulang dari ${roFrom?.number ?? 'pesanan sebelumnya'}, harga tidak naik.${ro.reason ? ` Catatan: ${ro.reason}` : ''}`
            : `Harga atau total lebih tinggi dari ${roFrom?.number ?? 'pesanan sebelumnya'}. Alasan: ${ro.reason || '—'}`}
        </Callout>
      )}
      <ReasonModal
        opened={roReject}
        onClose={() => setRoReject(false)}
        title={`Tolak ${po.number}`}
        label="Alasan penolakan. Pesanan ini tidak akan berlaku."
        confirmLabel="Tolak"
        onConfirm={rejectReorder}
      />
      {pcPending && (
        <Callout tone="wait" title={`Ubah harga menunggu approval ${roleLabel(approvalState(pc, 'priceChange').next)} · faktur ditahan`}>
          <Stack gap={8}>
            <Text fz="xs">
              Diajukan oleh {pc.by}{pc.invoiceNo ? ` sesuai invoice vendor ${pc.invoiceNo}` : ''}. Alasan: {pc.reason || '—'}
            </Text>
            {/* Approver memutuskan dari angka ini: harga lama, harga baru, dan dampaknya ke sisa pesanan. */}
            {!noPrice && (
              <Box style={{ overflowX: 'auto', background: 'var(--mantine-color-white)', border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
                <Table verticalSpacing={6} horizontalSpacing="sm" miw={640} fz="xs" styles={{ th: { whiteSpace: 'nowrap' }, td: { whiteSpace: 'nowrap' } }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Item</Table.Th>
                      <Table.Th ta="right">Harga PO</Table.Th>
                      <Table.Th ta="right">Diajukan</Table.Th>
                      <Table.Th ta="right">Per unit</Table.Th>
                      <Table.Th ta="right">Belum difaktur</Table.Th>
                      <Table.Th ta="right">Dampak</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {pc.items.map((c) => {
                      const it = po.items.find((i) => i.id === c.itemId);
                      const d = c.price - c.oldPrice;
                      const open = pcOpenQty(c.itemId);
                      return (
                        <Table.Tr key={c.itemId}>
                          <Table.Td fw={600}>{it?.desc ?? c.itemId}</Table.Td>
                          <Table.Td ta="right">{rupiah(c.oldPrice)}</Table.Td>
                          <Table.Td ta="right" fw={700}>{rupiah(c.price)}</Table.Td>
                          <Table.Td ta="right" fw={600} c={d > 0 ? 'red.7' : 'green.8'} style={{ whiteSpace: 'nowrap' }}>{d > 0 ? 'naik' : 'turun'} {rupiah(Math.abs(d))}</Table.Td>
                          <Table.Td ta="right">{open} {it?.unit}</Table.Td>
                          <Table.Td ta="right" fw={600} c={d > 0 ? 'red.7' : 'green.8'} style={{ whiteSpace: 'nowrap' }}>{d > 0 ? '+' : '−'}{rupiah(Math.abs(d * open))}</Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Box>
            )}
            {!noPrice && (
              <Text fz="xs" fw={600}>
                Total dampak ke sisa {label}: {pcImpact > 0 ? 'naik' : pcImpact < 0 ? 'turun' : 'tetap'} {rupiah(Math.abs(pcImpact))} sebelum pajak
              </Text>
            )}
          </Stack>
        </Callout>
      )}
      {pc?.status === 'ditolak' && (
        <Callout tone="stop" title="Ubah harga ditolak · harga PO tetap">
          {pc.rejectNote} Minta vendor merevisi invoice sesuai harga PO.
        </Callout>
      )}
      <ReasonModal
        opened={pcReject}
        onClose={() => setPcReject(false)}
        title={`Tolak ubah harga ${po.number}`}
        label="Alasan penolakan. Harga PO tetap dan vendor perlu merevisi invoice-nya."
        confirmLabel="Tolak"
        onConfirm={rejectPrice}
      />
      {dp && !inactive && <DpStatusStrip dp={dp} po={po} go={go} />}
      <ReasonModal
        opened={waiverOpen}
        onClose={() => setWaiverOpen(false)}
        title="Batalkan uang muka"
        label="Alasan uang muka dibatalkan (mis. vendor menagih penuh di akhir). Perlu persetujuan Chief Finance."
        confirmLabel="Ajukan ke Chief Finance"
        onConfirm={askWaiver}
      />
      <ReasonModal
        opened={waiverReject}
        onClose={() => setWaiverReject(false)}
        title="Tolak pembatalan uang muka"
        label="Alasan penolakan"
        confirmLabel="Tolak"
        onConfirm={(note) => decideWaiver(false, note)}
      />

      <SendPoModal opened={sendOpen} onClose={() => setSendOpen(false)} po={po} pb={pb} onConfirm={sendPo} />
      <ReasonModal
        opened={closing === 'ditutup'}
        onClose={() => setClosing(null)}
        title={`Tutup ${label}`}
        label="Alasan menutup pesanan"
        confirmLabel="Tutup pesanan"
        onConfirm={closePo('ditutup')}
      />
      <ReasonModal
        opened={closing === 'dibatalkan'}
        onClose={() => setClosing(null)}
        title={`Batalkan ${label}`}
        label={dpPaid ? 'Alasan pembatalan (uang muka sudah dibayar — tuliskan rencana penyelesaiannya)' : 'Alasan pembatalan'}
        confirmLabel="Batalkan pesanan"
        onConfirm={closePo('dibatalkan')}
      />

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8.5 }}>
          <Stack gap="lg">
            <Card withBorder radius="lg" padding={0} bg="white">
              <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                <CardHead icon={Info} desc={isJasa ? 'Vendor, target selesai, jadwal tagihan, dan termin bayar' : 'Vendor, perkiraan tiba, gudang, dan termin bayar'}>Informasi {label}</CardHead>
              </Box>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={1} verticalSpacing={1} bg="gray.2">
                {[
                  ['Vendor', vendor?.name],
                  // SPK tidak mengirim barang ke gudang: istilahnya target selesai, bukan perkiraan tiba.
                  [isJasa ? 'Target selesai' : 'Perkiraan tiba', formatDate(po.expectedAt)],
                  isJasa
                    ? ['Jadwal tagihan', scheduleCount(po.term) > 1
                      ? `${scheduleCount(po.term)} ${po.items.some((i) => i.unit === 'periode') ? 'periode' : 'termin'}`
                      : 'Sekali tagih']
                    : [
                      'Kirim ke gudang',
                      !canSetWarehouse ? (
                        <>
                          {gudang ? `${gudang.name}${gudang.status === 'inactive' ? ' (nonaktif)' : ''}` : 'Belum ditentukan'}
                          {gudang?.address && (
                            <Text fz={11} fw={400} c="slate.6">
                              {[gudang.address, gudang.city, gudang.postalCode].filter(Boolean).join(', ')}
                            </Text>
                          )}
                        </>
                      ) : (
                        <Select
                          size="xs"
                          radius="md"
                          searchable
                          clearable
                          placeholder="Pilih gudang"
                          data={warehouseOptions(warehouses, po.warehouseId)}
                          value={po.warehouseId ?? null}
                          onChange={(v) => pb.update('pos', po.id, (d) => ({ ...d, warehouseId: v }))}
                        />
                      ),
                    ],
                  // PO pesan ulang tidak punya permintaan sendiri: satu baris "Asal pesanan" menyebut
                  // PO yang diulang sekaligus permintaan awal yang ditumpanginya.
                  roFrom
                    ? ['Asal pesanan', (
                      <>
                        <Group gap={6} wrap="wrap">
                          <span>Pesan ulang dari</span>
                          <DocNumber onClick={() => go({ name: 'po', id: roFrom.id })}>{roFrom.number}</DocNumber>
                        </Group>
                        <Text fz={11} fw={400} c="slate.6" component="div">
                          Permintaan awal:{' '}
                          {fppbj ? (
                            <>
                              <Text span fz={11} fw={600} c="primary.9" style={{ cursor: 'pointer' }} onClick={() => go({ name: 'fppbj', id: fppbj.id })}>{fppbj.number}</Text>
                              {fppbj.purpose ? ` · ${fppbj.purpose}` : ''}
                            </>
                          ) : 'tidak tercatat (data lama)'}
                        </Text>
                      </>
                    )]
                    : ['Dari permintaan', fppbj ? (
                      <>
                        <DocNumber onClick={() => go({ name: 'fppbj', id: fppbj.id })}>{fppbj.number}</DocNumber>
                        {fppbj.purpose && <Text fz={11} fw={400} c="slate.6">{fppbj.purpose}</Text>}
                      </>
                    ) : <Text span fz="sm" fw={400} c="slate.6">Tanpa permintaan (data lama)</Text>],
                  ro?.reason && [ro.increased === false ? 'Catatan pesan ulang' : 'Alasan kenaikan harga', ro.reason],
                  roChildren.length > 0 && ['Dipesan ulang di', <Group key="rc" gap={8}>{roChildren.map((c) => <DocNumber key={c.id} onClick={() => go({ name: 'po', id: c.id })}>{c.number}</DocNumber>)}</Group>],
                  ['Termin bayar', <TermBreakdown key="term" po={po} noPrice={noPrice} />],
                  // Mengirim ke vendor opsional: barisnya hanya muncul setelah terkirim. Selama belum,
                  // tidak ada yang perlu dibaca di sini; tombol Kirim ke vendor ada di kepala halaman.
                  po.sent && [
                    'Dikirim ke vendor',
                    <>
                      {vendorEmail(vendor) || '—'}
                      <Text fz={11} fw={400} c="slate.6">
                        {[po.sentAt && formatDate(po.sentAt), po.sentBy].filter(Boolean).join(' · ') || 'Tanggal tidak tercatat'}
                        {po.sentCc ? ` · cc ${po.sentCc}` : ''}
                      </Text>
                      {po.resentAt && (
                        <Text fz={11} fw={400} c="slate.6">
                          Dikirim ulang {formatDate(po.resentAt)}{po.resentBy ? ` · ${po.resentBy}` : ''}
                        </Text>
                      )}
                    </>,
                  ],
                ].filter(Boolean).map(([k, v], i, all) => (
                  <Box
                    key={k}
                    px="lg"
                    py="md"
                    style={{
                      minWidth: 0,
                      // Garis antar sel digambar oleh celah 1px di atas latar abu-abu, jadi selalu
                      // utuh. Sel terakhir yang sendirian melebar penuh supaya tidak ada sel kosong.
                      background: 'white',
                      gridColumn: i === all.length - 1 && i % 2 === 0 ? '1 / -1' : undefined,
                    }}
                  >
                    <Text fz={11} fw={600} c="slate.6">{k}</Text>
                    <Text fz="sm" fw={700} c="slate.9" lh={1.35} component="div" style={{ overflowWrap: 'anywhere' }}>{v}</Text>
                  </Box>
                ))}
              </SimpleGrid>
            </Card>

            {isJasa ? (
              <Section divided flush icon={ClipboardText} title="Lingkup pekerjaan" description={pakaiTerima ? 'Jadwal tagihan, serah terima (BAPP), dan faktur per tahap' : 'Jadwal tagihan dan faktur per tahap'}>
                <SpkScope po={po} pb={pb} receipts={receipts} pakaiTerima={pakaiTerima} noPrice={noPrice} />
              </Section>
            ) : (
            <Section divided flush icon={Package} title="Item pesanan" description={pakaiTerima ? 'Jumlah dipesan, diterima, dan difaktur per item' : 'Jumlah dipesan dan difaktur per item'} right={count(po.items.length, 'item')}>
              <Box style={{ overflow: 'auto' }}>
                <Table verticalSpacing="xs" horizontalSpacing="sm" miw={560} styles={th}>
                  <Table.Thead bg="slate.0">
                    <Table.Tr>
                      <Table.Th w={240}>Item</Table.Th>
                      <Table.Th ta="right">Dipesan</Table.Th>
                      {/* Tanpa serah terima tidak ada qty diterima — kolomnya akan selalu 0
                          dan terbaca seperti barang yang tak kunjung datang. */}
                      {pakaiTerima && <Table.Th ta="right">Diterima</Table.Th>}
                      <Table.Th ta="right">Difaktur</Table.Th>
                      {!noPrice && <Table.Th ta="right">Harga</Table.Th>}
                      {!noPrice && <Table.Th ta="right">Jumlah</Table.Th>}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {po.items.map((i) => (
                      <Table.Tr key={i.id}>
                        <Table.Td fz="sm" fw={600}>{i.desc}{i.spec && <Text fz={11} c="slate.6" fw={400}>{i.spec}</Text>}</Table.Td>
                        <Table.Td ta="right" fz="sm">{i.qty} {i.unit}</Table.Td>
                        {pakaiTerima && <Table.Td ta="right" fz="sm">{receivedQty(po, i.id, pb.receipts)}</Table.Td>}
                        <Table.Td ta="right" fz="sm">{pakaiTerima
                          ? receipts.reduce((n, r) => n + invoicedQty(r.id, i.id, pb.invoices), 0)
                          : invoicedQtyOfPo(po.id, i.id, pb.invoices)}</Table.Td>
                        {!noPrice && (
                          <Table.Td ta="right" fz="sm">
                            {rupiah(i.price)}
                            {roChange(i.id) && roChange(i.id).price !== roChange(i.id).oldPrice && (
                              <Text fz={11} fw={600} c={roChange(i.id).price > roChange(i.id).oldPrice ? 'red.7' : 'green.8'}>
                                {roChange(i.id).price > roChange(i.id).oldPrice ? 'Naik' : 'Turun'} {rupiah(Math.abs(roChange(i.id).price - roChange(i.id).oldPrice))} dari {roFrom?.number ?? 'pesanan lama'}
                              </Text>
                            )}
                            {priceChangeOf(po, i.id) && pc.status !== 'ditolak' && (() => {
                              const c = priceChangeOf(po, i.id);
                              const up = c.price > c.oldPrice;
                              return pc.status === 'diajukan' ? (
                                <Text fz={11} fw={600} c="orange.8">Diajukan jadi {rupiah(c.price)}</Text>
                              ) : (
                                <Text fz={11} fw={600} c={up ? 'red.7' : 'green.8'}>{up ? 'Naik' : 'Turun'} dari {rupiah(c.oldPrice)} (ubah harga)</Text>
                              );
                            })()}
                            {ongkirPerUnit(i) > 0 && (
                              <Text fz={11} c="slate.6" fw={400}>
                                Termasuk ongkir {rupiah(Math.round(ongkirPerUnit(i)))}/{i.unit}
                              </Text>
                            )}
                          </Table.Td>
                        )}
                        {!noPrice && <Table.Td ta="right" fz="sm" fw={700}>{rupiah(i.qty * i.price)}</Table.Td>}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Box>
              {!poAllBarang(po) && <Box p="lg" pt={0}><Callout>Item jasa: lingkup, periode, dan milestone mengikuti penawaran pemenang.</Callout></Box>}
            </Section>
            )}

            {/* Pesanan tanpa serah terima tidak akan pernah punya FPB/BAPP, jadi kartunya
                tidak ditampilkan — bukan ditampilkan kosong. Kartu kosong mengundang
                pertanyaan "kenapa belum ada penerimaannya?" yang tidak ada jawabannya. */}
            {pakaiTerima && (
            <Section divided flush icon={Truck} title={poAllJasa(po) ? 'Serah terima (BAPP)' : poAllBarang(po) ? 'Penerimaan barang (FPB)' : 'Penerimaan (FPB / BAPP)'} description="Surat jalan dan serah terima yang dicatat gudang" right={count(receipts.length, 'dokumen')}>
              {receipts.length === 0 ? (
                <Text fz="xs" c="slate.6" p="lg">Belum ada penerimaan dicatat untuk {label} ini.</Text>
              ) : (
                <DataTable bare head={[{ label: 'Nomor' }, { label: 'Tanggal' }, { label: poAllJasa(po) ? 'No. BAPP' : poAllBarang(po) ? 'No. surat jalan' : 'No. surat jalan / BAPP' }, { label: 'Diterima', align: 'right' }, { label: 'Status' }]} minWidth={520}>
                  {receipts.map((r) => {
                    return (
                      <Table.Tr key={r.id}>
                        <Table.Td><DocNumber onClick={() => go({ name: 'receipt', id: r.id })}>{r.number}</DocNumber></Table.Td>
                        <Table.Td fz="sm" style={{ whiteSpace: 'nowrap' }}>{formatDate(r.date)}</Table.Td>
                        <Table.Td fz="sm">{r.doNumber}</Table.Td>
                        <Table.Td ta="right" fz="sm">{r.lines.reduce((n, l) => n + l.qty, 0)}</Table.Td>
                        <Table.Td><StatusPill map={RECEIPT_STATUS} status={receiptStatus(r, pb.invoices)} size="xs" approval={{ doc: r, kind: receiptKind(r) }} /></Table.Td>
                      </Table.Tr>
                    );
                  })}
                </DataTable>
              )}
            </Section>
            )}

            {retensi && (
              <Section
                divided
                flush
                icon={Receipt}
                title={`Retensi ${retensi.pct}%`}
                description={`Ditahan dari tiap faktur termin, dilepas setelah masa pemeliharaan ${retensi.months} bulan (${retentionDocName(po)})`}
                // Bukan tempat tombolnya: pelepasan dikerjakan dari tugas "Lepas retensi" di Perlu
                // tindakan (atau Buat baru). Di sini cukup keadaannya dan hitung mundurnya.
                right={retensi.balance <= 0
                  ? <Badge size="sm" radius="sm" variant="light" color="green" tt="none">Sudah dilepas</Badge>
                  : !retensi.billedAll
                    ? <Badge size="sm" radius="sm" variant="light" color="gray" tt="none">Menunggu termin terakhir</Badge>
                    : <Badge size="sm" radius="sm" variant="light" color={retensi.maintenanceEnd <= TODAY ? 'green' : 'violet'} tt="none">{retensi.maintenanceEnd <= TODAY ? 'Bisa dilepas' : `Dilepas ${formatDate(retensi.maintenanceEnd)}`}</Badge>}
              >
                <SimpleGrid cols={{ base: 2, sm: 4 }} spacing={1} verticalSpacing={1} bg="gray.2">
                  {[
                    ['Total retensi', rupiah(retensi.target)],
                    ['Sudah ditahan', rupiah(retensi.held)],
                    ['Sudah dilepas', rupiah(retensi.released)],
                    ['Saldo Hutang Retensi', rupiah(retensi.balance)],
                  ].map(([k, v]) => (
                    <Box key={k} px="lg" py="sm" bg="white">
                      <Text fz={11} fw={600} c="slate.6">{k}</Text>
                      <Text fz="sm" fw={700} c="slate.9">{v}</Text>
                    </Box>
                  ))}
                </SimpleGrid>
                <Text fz="xs" c="slate.6" px="lg" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                  {!retensi.billedAll
                    ? 'Masa pemeliharaan mulai dihitung setelah termin terakhir difaktur.'
                    : retensi.balance > 0
                      ? retensi.maintenanceEnd <= TODAY
                        ? <>Masa pemeliharaan sudah selesai. Tugas &quot;Lepas retensi&quot; menunggu di Perlu tindakan{canCreate(role, 'invoice') && <>{' · '}<Text span fz="inherit" fw={700} c="primary.9" style={{ cursor: 'pointer' }} onClick={() => openDialog({ type: 'retention-release', poId: po.id })}>Kerjakan sekarang</Text></>}</>
                        : `Masa pemeliharaan selesai ${formatDate(retensi.maintenanceEnd)}. Pengingat minta ${retentionDocName(po)} muncul di Perlu tindakan 30 hari sebelumnya, lalu retensinya dilepas ke Hutang Usaha dan diajukan Payment Request.`
                      : 'Retensi sudah dilepas seluruhnya.'}
                </Text>
                {retensi.releases.length > 0 && (
                  <DataTable bare head={[{ label: 'Pelepasan' }, { label: `No. ${retentionDocName(po)}` }, { label: 'Status' }, { label: 'Sisa hutang', align: 'right' }]} minWidth={520}>
                    {retensi.releases.map((i) => {
                      const t = invTotals(i, pb.calc);
                      return (
                        <Table.Tr key={i.id}>
                          <Table.Td><DocNumber onClick={() => go({ name: 'invoice', id: i.id })}>{i.number}</DocNumber><Text fz={11} c="slate.6">{formatDate(i.date)}</Text></Table.Td>
                          <Table.Td fz="sm">{i.bastNo}</Table.Td>
                          <Table.Td><StatusPill map={INV_STATUS} status={invStatus(i, t)} size="xs" /></Table.Td>
                          <Table.Td ta="right" fz="sm" fw={700}>{rupiah(t.balance)}</Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </DataTable>
                )}
              </Section>
            )}

            <Section divided flush icon={Receipt} title="Faktur pembelian" description={pakaiTerima ? 'Tagihan vendor yang dibuat dari penerimaan' : `Tagihan vendor yang dibuat langsung dari ${label}`} right={count(invoices.length, 'faktur')}>
              {invoices.length === 0 ? (
                <Text fz="xs" c="slate.6" p="lg">{pakaiTerima
                  ? 'Faktur dibuat dari penerimaan yang sudah dikonfirmasi.'
                  : `Pesanan ini tanpa serah terima, jadi fakturnya dibuat langsung dari ${label}.`}</Text>
              ) : (
                <DataTable bare head={[{ label: 'Nomor' }, { label: 'Jatuh tempo' }, { label: 'Status' }, { label: 'Sisa hutang', align: 'right' }, { label: '', w: 190 }]} minWidth={700}>
                  {invoices.filter((i) => !isRetentionRelease(i)).map((i) => {
                    const t = invTotals(i, pb.calc);
                    const canReturn = canReturnInv(i, po, pb.returns);
                    return (
                      <Table.Tr key={i.id}>
                        <Table.Td><DocNumber onClick={() => go({ name: 'invoice', id: i.id })}>{i.number}</DocNumber><Text fz={11} c="slate.6">{i.vendorNo}</Text></Table.Td>
                        <Table.Td fz="sm" c={t.balance > 0 && i.dueDate < '2026-11-04' ? 'red.7' : undefined}>{formatDate(i.dueDate)}</Table.Td>
                        <Table.Td><StatusPill map={INV_STATUS} status={invStatus(i, t)} size="xs" /></Table.Td>
                        <Table.Td ta="right" fz="sm" fw={700}>{rupiah(t.balance)}</Table.Td>
                        <Table.Td ta="right">
                          {canCreate(role, 'pr') && (
                            <Group gap={6} justify="flex-end" wrap="nowrap">
                              {t.free > 0 && <Button size="compact-xs" radius="md" onClick={() => go({ name: 'pr-new', invoiceIds: [i.id] })}>Ajukan bayar</Button>}
                              {canReturn && <Button size="compact-xs" radius="md" variant="default" onClick={() => openDialog({ type: 'return', invoiceId: i.id })}>Retur</Button>}
                            </Group>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </DataTable>
              )}
            </Section>

            <Section divided flush icon={Money} title="Payment Request" description="Pembayaran DP dan pelunasan ke vendor" right={count(prs.length, 'dokumen')}>
              {prs.length === 0 ? (
                <Text fz="xs" c="slate.6" p="lg">{hasDp ? (dpInv ? `Faktur uang muka ${dpInv.number} sudah dicatat. Buat Payment Request ${advanceLabel(po.term)} dari tombol di atas.` : 'Termin ini menagih di muka. Catat dulu faktur uang muka dari vendor, lalu ajukan Payment Request-nya.') : 'Payment Request pelunasan dibuat dari faktur.'}</Text>
              ) : (
                <DataTable bare head={[{ label: 'Nomor' }, { label: 'Jenis' }, { label: 'Status' }, { label: 'Nominal', align: 'right' }, { label: '', w: 160 }]} minWidth={640}>
                  {prs.map((p) => (
                    <Table.Tr key={p.id}>
                      <Table.Td><DocNumber onClick={() => go({ name: 'pr', id: p.id })}>{p.number}</DocNumber></Table.Td>
                      <Table.Td fz="sm">{p.kind === 'dp' ? 'Di muka' : 'Pelunasan'}</Table.Td>
                      <Table.Td><StatusPill map={PR_STATUS} status={p.status} size="xs" approval={{ doc: p, kind: 'pr' }} /></Table.Td>
                      <Table.Td ta="right" fz="sm" fw={700}>{rupiah(p.amount)}</Table.Td>
                      <Table.Td ta="right"><PrActions pr={p} pb={pb} openDialog={openDialog} /></Table.Td>
                    </Table.Tr>
                  ))}
                </DataTable>
              )}
            </Section>

            {returns.length > 0 && (
              <Section divided flush icon={ArrowCounterClockwise} title="Retur pembelian" description="Barang yang dikembalikan ke vendor" right={count(returns.length, 'retur')}>
                <DataTable bare head={[{ label: 'Nomor' }, { label: 'Alasan' }, { label: 'Penyelesaian' }, { label: 'Status' }, { label: 'Nilai', align: 'right' }]} minWidth={560}>
                  {returns.map((r) => (
                    <Table.Tr key={r.id}>
                      <Table.Td><DocNumber onClick={() => openDialog({ type: 'detail', kind: 'returns', id: r.id })}>{r.number}</DocNumber></Table.Td>
                      <Table.Td fz="sm">{r.reason}</Table.Td>
                      <Table.Td fz="sm">{SETTLEMENT_LABEL[r.settlement]}</Table.Td>
                      <Table.Td><StatusPill map={RETURN_STATUS} status={returnState(r, pb)} size="xs" /></Table.Td>
                      <Table.Td ta="right" fz="sm" fw={700}>{rupiah(returnGross(r, pb.invoices))}</Table.Td>
                    </Table.Tr>
                  ))}
                </DataTable>
              </Section>
            )}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 3.5 }}>
          <Stack gap="lg">
            {!noPrice && (
            <Card withBorder radius="lg" padding={0} bg="white">
              <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                <CardHead icon={Calculator} desc="Rincian nilai sebelum dan sesudah pajak">Ringkasan biaya</CardHead>
              </Box>
              <Stack gap={6} p="lg">
                {lineRow('DPP', rupiah(poSubtotal(po)))}
                {lineRow(ppnLabel(po.items), rupiah(poPpn(po)))}
                {pphCut > 0 && lineRow('Potongan PPh (saat bayar)', `-${rupiah(pphCut)}`, { c: 'red.7' })}
                {hasDp && lineRow(advancePct(po.term) >= 100 ? 'Dibayar di muka' : 'Uang muka', rupiah(poDpAmount(po)))}
                {po.ppnIncluded && <Text fz={11} c="slate.6">Harga penawaran sudah termasuk PPN.</Text>}
              </Stack>
              <Group
                justify="space-between"
                px="lg"
                py="md"
                bg="primary.0"
                style={{ borderTop: '1px solid var(--mantine-color-primary-1)', borderRadius: '0 0 var(--mantine-radius-lg) var(--mantine-radius-lg)' }}
              >
                <Text fz="sm" fw={600} c="primary.9">Total</Text>
                <Text fz="lg" fw={700} c="primary.9">{rupiah(poTotal(po))}</Text>
              </Group>
            </Card>
            )}
            {/* Approval pesan ulang. Data lama tanpa approval (status disetujui langsung) tidak menampilkannya. */}
            {ro && (ro.status !== 'disetujui' || ro.approvals) ? (
              <ApprovalLog
                title="Log approval pesan ulang"
                steps={chainSteps(ro, 'reorder', { rejected: ro.status === 'ditolak', active: ro.status !== 'disetujui' })}
                log={ro.log ?? []}
              />
            ) : null}
            {pc && (
              <ApprovalLog
                title="Log ubah harga"
                steps={chainSteps(pc, 'priceChange', { rejected: pc.status === 'ditolak', active: pc.status === 'diajukan' })}
                log={pc.log ?? []}
              />
            )}
            {/* Pembatalan uang muka; kartunya muncul begitu diajukan. */}
            {po.dpWaiver && (
              <ApprovalLog
                title="Log pembatalan uang muka"
                steps={[{
                  key: 'dw',
                  verb: 'Approval',
                  role: 'cfo',
                  done: po.dpWaiver.status === 'disetujui' ? { by: po.dpWaiver.decidedBy, at: po.dpWaiver.decidedAt } : null,
                  state: { disetujui: 'done', ditolak: 'rejected', diajukan: 'current' }[po.dpWaiver.status] ?? 'idle',
                }]}
                log={po.dpWaiver.log ?? [
                  { action: 'ajukan', role: 'accounting', by: po.dpWaiver.by, at: po.dpWaiver.at, note: po.dpWaiver.reason },
                  ...(po.dpWaiver.decidedAt ? [{ action: po.dpWaiver.status === 'disetujui' ? 'setuju' : 'tolak', role: 'cfo', step: 'cfo', by: po.dpWaiver.decidedBy, at: po.dpWaiver.decidedAt, note: po.dpWaiver.rejectNote }] : []),
                ]}
              />
            )}
            <PurchaseFlow pb={pb} go={go} current={{ kind: 'po', id: po.id }} />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

// Status uang muka di bawah kepala halaman PO/SPK: tahap sekarang, siapa yang harus
// bertindak, dan satu tautan ke dokumennya. Warnanya mengikuti tahap, bukan peran yang membaca.
function DpStatusStrip({ dp, po, go }) {
  const w = po.dpWaiver;
  const tone = { belum_faktur: 'wait', belum_bayar: 'wait', lunas: 'ok', dibatalkan: 'info' }[dp.state];
  const nominal = rupiah(poDpAmount(po));
  const pct = advancePct(po.term);
  const judul = `${pct >= 100 ? 'Bayar penuh di muka' : `Uang muka ${pct}%`} · ${nominal} · ${DP_STATE[dp.state].label}`;
  const link = (doc, view) => <DocNumber onClick={() => go(view)}>{doc}</DocNumber>;
  return (
    <Callout tone={tone} title={judul}>
      {dp.state === 'belum_faktur' && (w?.status === 'diajukan'
        ? <>Pembatalan uang muka diajukan {w.by} ({w.reason}). Menunggu approval Chief Finance.</>
        : <>
          {poHasReceipt(po)
            ? 'Vendor belum menagih uang muka. Penerimaan tetap bisa dicatat, tapi faktur pelunasan baru bisa dibuat setelah uang muka dibayar.'
            : `Vendor belum menagih uang muka. Faktur dari ${poDocLabel(po)} ini baru bisa dicatat setelah uang muka dibayar.`}
          {scheduleExcludesDp(po.term)
            ? ' Termin ini memisahkan DP dari jadwal termin, jadi uang mukanya tidak bisa dibatalkan. Bila vendor tidak menagih DP, revisi terminnya.'
            : ' Bila vendor menagih penuh di akhir, batalkan uang muka lewat menu ⋮ “Batalkan uang muka”.'}
          {w?.status === 'ditolak' && <> Pengajuan pembatalan sebelumnya ditolak{w.rejectNote ? `: ${w.rejectNote}` : ''}.</>}
        </>)}
      {dp.state === 'belum_bayar' && (
        <Group gap={6} wrap="wrap">
          <span>Ditagih lewat</span>
          {dp.inv ? link(dp.inv.number, { name: 'invoice', id: dp.inv.id }) : null}
          {dp.pr
            ? <><span>· dibayar lewat</span>{link(dp.pr.number, { name: 'pr', id: dp.pr.id })}<span>({PR_STATUS[dp.pr.status]?.label})</span></>
            : <span>· Payment Request belum diajukan.</span>}
          <span>Faktur pelunasan menunggu uang muka ini lunas.</span>
        </Group>
      )}
      {dp.state === 'lunas' && (
        <Group gap={6} wrap="wrap">
          <span>Dibayar lewat</span>
          {dp.pr ? link(dp.pr.number, { name: 'pr', id: dp.pr.id }) : null}
          {dp.inv && <><span>atas</span>{link(dp.inv.number, { name: 'invoice', id: dp.inv.id })}</>}
          <span>. Dipotongkan otomatis di faktur pelunasan.</span>
        </Group>
      )}
      {dp.state === 'dibatalkan' && (
        <>Disetujui {w?.decidedBy}: {w?.reason}. Pesanan ditagih penuh di faktur pelunasan, tanpa potongan uang muka.</>
      )}
    </Callout>
  );
}
