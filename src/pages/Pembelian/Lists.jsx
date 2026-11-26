// Daftar dokumen per tab (permintaan, PO, Penerimaan, Faktur, Pembayaran, Retur) dengan pola tabel seperti halaman Kontak.
import { approvalMessage, askConfirm } from './confirm.jsx';
import { Badge, Box, Button, Group, Select, Stack, Table, Text, Tooltip } from '@mantine/core';
import { useState } from 'react';
import {
  ArrowCounterClockwise,
  Check,
  ClipboardText,
  CurrencyCircleDollar,
  Eye,
  Invoice,
  PencilSimple,
  ShoppingCart,
  Truck,
  Wallet,
  X,
  ArrowsClockwise,
} from '@/components/Icon.jsx';
import { DocNumber, EmptyState, ListShell, RowMenu, StatusPill } from './components.jsx';
import { TODAY } from './data.js';
import { ROUTE_OPTIONS } from './procurement.jsx';
import {
  formatDate,
  canReturn as canReturnInv,
  requesterOf,
  routeLabel,
  poAllJasa,
  poDocLabel,
  FPPBJ_STATUS,
  INV_STATUS,
  invStatus,
  invTotals,
  PO_STATUS,
  poStatus,
  poTotal,
  PR_ACTIVE,
  PR_STATUS,
  prCancelledPo,
  returnValue,
  RECEIPT_STATUS,
  receiptConfirmed,
  receiptStatus,
  receiptPending,
  pvPaid,
  pvStatus,
  PV_STATUS,
  rupiah,
  sum,
  uninvoicedLines,
  dpState,
  invoicedQtyOfPo,
  poStatusMap,
  reorderBlock,
  fppbjStatus,
} from './utils.js';
import { approvalState, canCreate, hidesPrices, isApproverTurn, prBlockedBySoD, receiptDoc, receiptKind, receiptName, signApproval } from './permissions.js';
import { toast } from './usePb.js';
import { useApproveReceipt } from './Dialogs.jsx';

const Money = ({ children, c }) => (
  <Text fz="sm" fw={700} c={c ?? 'slate.9'} ta="right" style={{ whiteSpace: 'nowrap' }}>{children}</Text>
);
const Sub = ({ children }) => <Text fz={11} c="slate.6" style={{ whiteSpace: 'nowrap' }}>{children}</Text>;
const statusOptions = (map) => Object.entries(map).map(([value, s]) => ({ value, label: s.label }));
const match = (q, ...vals) => !q.trim() || vals.some((v) => v?.toLowerCase().includes(q.trim().toLowerCase()));
const settleLabel = { potong: 'Potong hutang', kredit: 'Kredit vendor', refund: 'Refund' };

// Badge jalur pengadaan: latar abu muda, teks abu, dengan ikon sesuai jalur.
function RouteBadge({ f }) {
  const key = f.single?.on ? 'single' : f.route;
  const Icon = ROUTE_OPTIONS.find((o) => o.value === key)?.icon;
  return (
    <Badge size="sm" radius="sm" variant="light" color="gray" c="slate.6" fw={700} tt="none" leftSection={Icon ? <Icon size={12} /> : null}>
      {routeLabel(f)}
    </Badge>
  );
}

export default function ListTab({ tab, pb, go, openDialog }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');
  const approveReceipt = useApproveReceipt(pb);
  // Setiap perubahan pencarian/filter mengembalikan ke halaman pertama.
  const reset = (fn) => (v) => {
    fn(v);
    setPage(1);
  };
  const vendor = (id) => pb.vendorsById[id]?.name ?? '—';
  const role = pb.role;
  const shell = { query: q, onQuery: reset(setQ), page, setPage, pageSize, setPageSize };
  const statusFilter = (map) => (
    <Select size="sm" radius="md" w={220} clearable placeholder="Semua status" data={statusOptions(map)} value={status} onChange={reset(setStatus)} />
  );

  if (tab === 'fppbj') {
    const rows = pb.fppbj.filter((f) => match(q, f.number, f.purpose, f.dept, requesterOf(f)) && (!status || fppbjStatus(f, pb.calc) === status));
    return (
      <ListShell
        {...shell}
        noun="permintaan"
        placeholder="Cari nomor, keperluan, departemen, atau peminta..."
        filters={statusFilter(FPPBJ_STATUS)}
        head={[{ label: 'Permintaan & Tanggal' }, { label: 'Keperluan' }, { label: 'Departemen' }, { label: 'Jalur' }, { label: 'Status' }, { label: 'Aksi', align: 'right', w: 70 }]}
        minWidth={900}
        empty={pb.fppbj.length === 0 ? <EmptyState icon={ClipboardText} title="Belum ada permintaan" text="Pembelian dimulai dari permintaan dan IOM yang disetujui atasan." actions={canCreate(role, 'fppbj') ? [<Button key="n" size="xs" radius="md" onClick={() => go({ name: 'fppbj-new' })}>Buat permintaan</Button>] : null} /> : undefined}
        rows={rows.map((f) => (
          <Table.Tr key={f.id}>
            <Table.Td>
              <DocNumber onClick={() => go({ name: 'fppbj', id: f.id })}>{f.number}</DocNumber>
              <Sub>{formatDate(f.date)} · {requesterOf(f)}</Sub>
            </Table.Td>
            <Table.Td maw={320}>
              <Text fz="sm" fw={600} c="slate.9" truncate>{f.purpose}</Text>
              <Sub>Dibutuhkan {formatDate(f.neededBy)}</Sub>
            </Table.Td>
            <Table.Td fz="sm">{f.dept}</Table.Td>
            <Table.Td>{f.route ? <RouteBadge f={f} /> : <Text fz="xs" c="slate.6">Belum dipilih</Text>}</Table.Td>
            <Table.Td><StatusPill map={FPPBJ_STATUS} status={fppbjStatus(f, pb.calc)} size="xs" /></Table.Td>
            <Table.Td ta="right">
              <RowMenu label={f.number} items={[
                { label: 'Lihat Rincian', icon: Eye, onClick: () => go({ name: 'fppbj', id: f.id }) },
                ['draft', 'dikembalikan'].includes(f.status) && canCreate(role, 'fppbj') && { label: 'Ubah permintaan', icon: PencilSimple, onClick: () => go({ name: 'fppbj-edit', id: f.id }) },
              ]} />
            </Table.Td>
          </Table.Tr>
        ))}
      />
    );
  }

  // Langkah berikutnya untuk PO yang menunggu uang muka: badge-nya tidak menyebut siapa
  // yang ditunggu, padahal bolanya ada di tim sendiri.
  const dpNextStep = (p, dp) => {
    if (dp?.state === 'belum_bayar') return 'Bayar uang muka';
    if (p.dpWaiver?.status === 'diajukan') return 'Pembatalan DP menunggu approval';
    return 'Catat faktur uang muka';
  };

  // Progres pesanan tanpa FPB/BAPP: tanpa ini kontrak berkala tertahan di "Menunggu tagihan"
  // berbulan-bulan tanpa terlihat sudah sampai mana.
  const billProgress = (p) => {
    const done = p.items.filter((i) => invoicedQtyOfPo(p.id, i.id, pb.invoices) >= i.qty).length;
    const unit = p.items.some((i) => i.slot) ? 'termin' : 'item';
    return `${done} dari ${p.items.length} ${unit} ditagih`;
  };

  if (tab === 'orders') {
    // Spesifikasi 2.1: Gudang tidak melihat harga.
    const noPrice = hidesPrices(role);
    const rows = pb.pos.filter((p) => match(q, p.number, vendor(p.vendorId)) && (!status || poStatus(p, pb.calc) === status));
    return (
      <ListShell
        {...shell}
        noun="pesanan"
        placeholder="Cari nomor atau vendor..."
        filters={statusFilter(PO_STATUS)}
        head={[{ label: 'Nomor & Tanggal' }, { label: 'Vendor' }, { label: 'Perkiraan Tiba' }, { label: 'Status' }, ...(noPrice ? [] : [{ label: 'Nilai', align: 'right' }, { label: 'Hutang ke Vendor', align: 'right' }]), { label: 'Aksi', align: 'right', w: 70 }]}
        minWidth={1000}
        empty={pb.pos.length === 0 ? <EmptyState icon={ShoppingCart} title="Belum ada pesanan" text="PO (barang) dan SPK (jasa) dibuat dari permintaan yang pengadaannya sudah disetujui." /> : undefined}
        rows={rows.map((p) => {
          const st = poStatus(p, pb.calc);
          const debt = sum(pb.invoices.filter((i) => i.poId === p.id), (i) => invTotals(i, pb.calc).balance);
          return (
            <Table.Tr key={p.id}>
              <Table.Td>
                <DocNumber onClick={() => go({ name: 'po', id: p.id })}>{p.number}</DocNumber>
                <Sub>{poDocLabel(p)} · {formatDate(p.date)}</Sub>
                {p.reorderOf && <Sub>Pesan ulang dari {pb.posById[p.reorderOf]?.number ?? '—'}</Sub>}
              </Table.Td>
              <Table.Td fz="sm" fw={600} c="slate.9">{vendor(p.vendorId)}</Table.Td>
              <Table.Td fz="sm">{formatDate(p.expectedAt)}</Table.Td>
              <Table.Td>
                <StatusPill map={poStatusMap(p)} status={st} size="xs" />
                {st === 'menunggu_dp' && <Sub>{dpNextStep(p, dpState(p, pb.calc))}</Sub>}
                {st === 'menunggu_tagihan' && <Sub>{billProgress(p)}</Sub>}
              </Table.Td>
              {!noPrice && <Table.Td><Money>{rupiah(poTotal(p))}</Money></Table.Td>}
              {!noPrice && <Table.Td><Money c={debt ? 'red.8' : 'slate.6'}>{rupiah(debt)}</Money></Table.Td>}
              <Table.Td ta="right">
                <RowMenu label={p.number} items={[
                  { label: 'Lihat Rincian', icon: Eye, onClick: () => go({ name: 'po', id: p.id }) },
                  canCreate(role, receiptDoc(poAllJasa(p))) && ['menunggu_dp', 'menunggu', 'sebagian'].includes(st) && { label: poAllJasa(p) ? 'Catat BAPP' : 'Catat Penerimaan', icon: Truck, onClick: () => openDialog({ type: 'receipt', poId: p.id }) },
                  canCreate(role, 'po') && st === 'selesai' && !reorderBlock(p) && { label: 'Pesan ulang', icon: ArrowsClockwise, onClick: () => openDialog({ type: 'reorder', poId: p.id }) },
                ]} />
              </Table.Td>
            </Table.Tr>
          );
        })}
      />
    );
  }

  if (tab === 'receipts') {
    const rows = pb.receipts.filter((r) => match(q, r.number, vendor(r.vendorId), r.doNumber, pb.posById[r.poId]?.number) && (!status || receiptStatus(r, pb.invoices) === status));
    return (
      <ListShell
        {...shell}
        noun="penerimaan"
        placeholder="Cari nomor, vendor, atau surat jalan..."
        filters={statusFilter(RECEIPT_STATUS)}
        head={[{ label: 'Penerimaan & Tanggal' }, { label: 'Vendor' }, { label: 'Surat Jalan / BAPP' }, { label: 'Jumlah Diterima', align: 'right' }, { label: 'Status' }, { label: 'Aksi', align: 'right', w: 70 }]}
        minWidth={940}
        empty={pb.receipts.length === 0 ? <EmptyState icon={Truck} title="Belum ada penerimaan" text="Penerimaan dicatat dari pesanan yang ada, saat barang sudah sampai atau pekerjaan sudah diserahterimakan." /> : undefined}
        rows={rows.map((r) => {
          const open = uninvoicedLines(r, pb.invoices).length > 0;
          return (
            <Table.Tr key={r.id}>
              <Table.Td>
                <DocNumber onClick={() => go({ name: 'receipt', id: r.id })}>{r.number}</DocNumber>
                <Sub>{formatDate(r.date)} · {pb.posById[r.poId]?.number}</Sub>
              </Table.Td>
              <Table.Td fz="sm" fw={600} c="slate.9">{vendor(r.vendorId)}</Table.Td>
              <Table.Td fz="sm">{r.doNumber}</Table.Td>
              <Table.Td><Money>{r.lines.reduce((n, l) => n + l.qty, 0)}</Money></Table.Td>
              <Table.Td><StatusPill map={RECEIPT_STATUS} status={receiptStatus(r, pb.invoices)} size="xs" approval={{ doc: r, kind: receiptKind(r) }} /></Table.Td>
              <Table.Td ta="right">
                <RowMenu label={r.number} items={[
                  { label: 'Lihat Rincian', icon: Eye, onClick: () => go({ name: 'receipt', id: r.id }) },
                  receiptPending(r) && isApproverTurn(role, r, receiptKind(r)) && { label: `Setujui ${receiptName(r)} (${approvalState(r, receiptKind(r)).done.length + 1}/${approvalState(r, receiptKind(r)).total})`, icon: Check, onClick: () => askConfirm({ title: `Setujui ${r.number}?`, message: approvalMessage(approvalState(r, receiptKind(r))), confirmLabel: 'Ya, setujui', onConfirm: () => { approveReceipt(r, role); toast('Approval dicatat.'); } }) },
                  receiptConfirmed(r) && open && canCreate(role, 'invoice') && { label: 'Buat Faktur', icon: Invoice, onClick: () => go({ name: 'invoice-new', receiptIds: [r.id] }) },
                ]} />
              </Table.Td>
            </Table.Tr>
          );
        })}
      />
    );
  }

  if (tab === 'bills') {
    const rows = pb.invoices
      .map((i) => ({ i, t: invTotals(i, pb.calc) }))
      .filter(({ i, t }) => match(q, i.number, i.vendorNo, vendor(i.vendorId)) && (!status || invStatus(i, t) === status));
    return (
      <ListShell
        {...shell}
        noun="faktur"
        placeholder="Cari nomor faktur, no. invoice vendor, atau vendor..."
        filters={
          <>
            {/* Jatuh tempo sekarang salah satu status, jadi saringan terpisahnya dibuang:
                dua kontrol untuk satu pertanyaan hanya bikin hasilnya saling meniadakan. */}
            {statusFilter(INV_STATUS)}
          </>
        }
        head={[{ label: 'Faktur & No. Vendor' }, { label: 'Vendor' }, { label: 'Jatuh Tempo' }, { label: 'Status' }, { label: 'Hutang', align: 'right' }, { label: 'Sisa Hutang', align: 'right' }, { label: 'Aksi', align: 'right', w: 70 }]}
        minWidth={1040}
        empty={pb.invoices.length === 0 ? <EmptyState icon={Invoice} title="Belum ada faktur" text="Faktur dibuat dari penerimaan (FPB/BAPP) yang sudah dikonfirmasi, lalu dicocokkan 3 arah dengan PO." /> : undefined}
        rows={rows.map(({ i, t }) => {
          const late = t.balance > 0 && i.dueDate < TODAY;
          const po = pb.posById[i.poId];
          const canReturn = canReturnInv(i, po, pb.returns);
          return (
            <Table.Tr key={i.id}>
              <Table.Td>
                <DocNumber onClick={() => go({ name: 'invoice', id: i.id })}>{i.number}</DocNumber>
                <Sub>{i.vendorNo}</Sub>
              </Table.Td>
              <Table.Td fz="sm" fw={600} c="slate.9">{vendor(i.vendorId)}</Table.Td>
              <Table.Td fz="sm" c={late ? 'red.7' : 'slate.8'} fw={late ? 600 : 400} style={{ whiteSpace: 'nowrap' }}>{formatDate(i.dueDate)}</Table.Td>
              <Table.Td><StatusPill map={INV_STATUS} status={invStatus(i, t)} size="xs" /></Table.Td>
              <Table.Td>
                <Money>{rupiah(t.total)}</Money>
                {t.paid > 0 && <Text fz={11} c="green.8" ta="right">Terbayar: {rupiah(t.paid)}</Text>}
              </Table.Td>
              <Table.Td><Money c={t.balance ? 'red.8' : 'green.8'}>{rupiah(t.balance)}</Money></Table.Td>
              <Table.Td ta="right">
                <RowMenu label={i.number} items={[
                  { label: 'Lihat Rincian', icon: Eye, onClick: () => go({ name: 'invoice', id: i.id }) },
                  t.free > 0 && canCreate(role, 'pr') && { label: 'Ajukan Pembayaran', icon: Wallet, onClick: () => go({ name: 'pr-new', invoiceIds: [i.id] }) },
                  canReturn && canCreate(role, 'return') && { label: 'Buat Retur', icon: ArrowCounterClockwise, onClick: () => openDialog({ type: 'return', invoiceId: i.id }) },
                ]} />
              </Table.Td>
            </Table.Tr>
          );
        })}
      />
    );
  }

  if (tab === 'payments') {
    const vendorsOf = (p) => (p.vendorIds?.length ? p.vendorIds : [p.vendorId]);
    const rows = pb.prs.filter((p) => match(q, p.number, ...vendorsOf(p).map(vendor), p.note) && (!status || p.status === status));
    return (
      <ListShell
        {...shell}
        noun="Payment Request"
        placeholder="Cari nomor, vendor, atau catatan..."
        filters={statusFilter(PR_STATUS)}
        head={[{ label: 'Payment Request & Tanggal' }, { label: 'Vendor' }, { label: 'Jenis' }, { label: 'Status' }, { label: 'Payment Voucher' }, { label: 'Jumlah', align: 'right' }, { label: 'Aksi', align: 'right', w: 70 }]}
        minWidth={1100}
        empty={pb.prs.length === 0 ? <EmptyState icon={Wallet} title="Belum ada Payment Request" text="Payment Request DP dibuat dari PO, pelunasan dibuat dari faktur. Approver menyetujui, Finance membayar." /> : undefined}
        rows={rows.map((p) => {
          const pvs = pb.vouchersOfPr(p.id);
          const pv = pvs[0];
          const vids = vendorsOf(p);
          // PR atas pesanan yang dibatalkan tidak boleh diproses lagi (lihat prCancelledPo).
          const stopped = PR_ACTIVE.includes(p.status) && !!prCancelledPo(p, pb.calc);
          const unpaid = stopped ? [] : pvs.filter((x) => !pvPaid(x));
          return (
          <Table.Tr key={p.id}>
            <Table.Td>
              <DocNumber onClick={() => go({ name: 'pr', id: p.id })}>{p.number}</DocNumber>
              <Sub>{formatDate(p.date)}</Sub>
            </Table.Td>
            <Table.Td>
              {vids.length > 1 ? (
                <>
                  <Text fz="sm" fw={600} c="slate.9">{vids.length} vendor</Text>
                  <Sub>{vids.map(vendor).join(', ')}</Sub>
                </>
              ) : <Text fz="sm" fw={600} c="slate.9">{vendor(p.vendorId)}</Text>}
            </Table.Td>
            <Table.Td fz="sm">{p.kind === 'dp' ? 'Di muka' : 'Pelunasan'}</Table.Td>
            <Table.Td>
              <Tooltip label={p.note} disabled={p.status !== 'ditolak' || !p.note} withArrow fz="xs"><span><StatusPill map={PR_STATUS} status={p.status} size="xs" approval={{ doc: p, kind: 'pr' }} /></span></Tooltip>
            </Table.Td>
            <Table.Td>
              {pvs.length > 1 ? (
                <Stack gap={4}>
                  {pvs.map((x) => (
                    <Box key={x.id}>
                      <Group gap={6} wrap="nowrap">
                        <DocNumber onClick={() => go({ name: 'voucher', id: x.id })}>{x.number}</DocNumber>
                        <StatusPill map={PV_STATUS} status={pvStatus(x)} size="xs" />
                      </Group>
                      <Sub>{vendor(x.vendorId)} · {rupiah(x.amount)}</Sub>
                    </Box>
                  ))}
                </Stack>
              ) : pv ? (
                <>
                  <DocNumber onClick={() => go({ name: 'voucher', id: pv.id })}>{pv.number}</DocNumber>
                  <Sub>{formatDate(pv.date)}</Sub>
                </>
              ) : (
                <Text fz="xs" c="slate.5">Belum terbit</Text>
              )}
            </Table.Td>
            <Table.Td><Money>{rupiah(p.amount)}</Money></Table.Td>
            <Table.Td ta="right">
              <RowMenu label={p.number} items={[
                { label: 'Lihat Rincian', icon: Eye, onClick: () => go({ name: 'pr', id: p.id }) },
                !stopped && p.status === 'diajukan' && isApproverTurn(role, p, 'pr') && !prBlockedBySoD(role, p) && { label: `Setujui (${approvalState(p, 'pr').done.length + 1}/${approvalState(p, 'pr').total})`, icon: Check, onClick: () => askConfirm({ title: `Setujui ${p.number}?`, message: approvalMessage(approvalState(p, 'pr')), confirmLabel: 'Ya, setujui', onConfirm: () => { pb.update('prs', p.id, (d) => { const { doc, complete } = signApproval(d, 'pr', role); return complete ? { ...doc, status: 'disetujui', approvedAt: TODAY } : doc; }); toast('Approval dicatat.'); } }) },
                !stopped && p.status === 'diajukan' && isApproverTurn(role, p, 'pr') && !prBlockedBySoD(role, p) && { label: 'Tolak', icon: X, color: 'red', onClick: () => openDialog({ type: 'pr-reject', prId: p.id }) },
                !stopped && p.status === 'disetujui' && canCreate(role, 'pv') && { label: 'Terbitkan Payment Voucher', icon: CurrencyCircleDollar, onClick: () => openDialog({ type: 'pv', prId: p.id }) },
                ...(canCreate(role, 'pv') ? unpaid.map((x) => ({ label: pvs.length > 1 ? `Catat pembayaran ${x.number} (${vendor(x.vendorId)})` : 'Catat pembayaran', icon: CurrencyCircleDollar, onClick: () => openDialog({ type: 'pay', voucherId: x.id }) })) : []),
                ...pvs.map((x) => ({ label: pvs.length > 1 ? `Lihat ${x.number}` : 'Lihat Payment Voucher', icon: CurrencyCircleDollar, onClick: () => go({ name: 'voucher', id: x.id }) })),
              ]} />
            </Table.Td>
          </Table.Tr>
          );
        })}
      />
    );
  }

  // retur
  const rows = pb.returns.filter((r) => match(q, r.number, vendor(r.vendorId), r.reason, pb.invoicesById[r.invoiceId]?.number));
  return (
    <ListShell
      {...shell}
      noun="retur"
      placeholder="Cari nomor, vendor, alasan, atau faktur..."
      head={[{ label: 'Retur & Tanggal' }, { label: 'Vendor' }, { label: 'Referensi Faktur' }, { label: 'Alasan' }, { label: 'Penyelesaian' }, { label: 'Nilai Retur', align: 'right' }, { label: 'Aksi', align: 'right', w: 70 }]}
      minWidth={1000}
      empty={pb.returns.length === 0 ? <EmptyState icon={ArrowCounterClockwise} title="Belum ada retur pembelian" text="Barang ditolak saat diterima cukup dicatat di FPB. Retur dibuat dari faktur bila barang dikembalikan ke vendor setelah difaktur." /> : undefined}
      rows={rows.map((r) => (
        <Table.Tr key={r.id}>
          <Table.Td>
            <DocNumber onClick={() => openDialog({ type: 'detail', kind: 'returns', id: r.id })}>{r.number}</DocNumber>
            <Sub>{formatDate(r.date)}</Sub>
          </Table.Td>
          <Table.Td fz="sm" fw={600} c="slate.9">{vendor(r.vendorId)}</Table.Td>
          <Table.Td fz="sm">{pb.invoicesById[r.invoiceId]?.number}</Table.Td>
          <Table.Td fz="sm">{r.reason}</Table.Td>
          <Table.Td fz="sm">{settleLabel[r.settlement]}</Table.Td>
          <Table.Td><Money>{rupiah(Math.round(returnValue(r) * 1.11))}</Money></Table.Td>
          <Table.Td ta="right">
            <RowMenu label={r.number} items={[{ label: 'Lihat Rincian', icon: Eye, onClick: () => openDialog({ type: 'detail', kind: 'returns', id: r.id }) }]} />
          </Table.Td>
        </Table.Tr>
      ))}
    />
  );
}
