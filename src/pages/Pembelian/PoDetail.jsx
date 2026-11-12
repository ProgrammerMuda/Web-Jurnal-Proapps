// Detail PO: penerimaan, faktur, payment request, dan retur yang turun dari dokumen ini.
import { useState } from 'react';
import { ActionIcon, Badge, Box, Button, Card, Divider, Grid, Group, Menu, SimpleGrid, Stack, Table, Text, ThemeIcon, Title } from '@mantine/core';
import { ArrowCounterClockwise, Calculator, Check, DotsThreeVertical, DownloadSimple, Info, Money, Package, PaperPlaneTilt, Prohibit, Receipt, ShoppingCart, Truck, X } from '@/components/Icon.jsx';
import { BackLink, Callout, CardHead, CopyIcon, DataTable, DocNumber, RoleChip, Section, StatusPill } from './components.jsx';
import PurchaseFlow from './PurchaseFlow.jsx';
import { ReasonModal, SendPoModal } from './Dialogs.jsx';
import { personLabel, TODAY } from './data.js';
import { canApprove, canCreate, hidesPrices, prBlockedBySoD, receiptDoc } from './permissions.js';
import {
  formatDate,
  INV_STATUS,
  invStatus,
  invTotals,
  invoicedQty,
  PO_STATUS,
  canReturn as canReturnInv,
  advancePct,
  advanceLabel,
  poAllBarang,
  poAllJasa,
  poDocLabel,
  vendorEmail,
  poDpAmount,
  poStatus,
  termText,
  poSubtotal,
  poPpn,
  ppnLabel,
  poTotal,
  PR_STATUS,
  receivedQty,
  receiptsOf,
  remainingQty,
  rupiah,
  uninvoicedLines,
} from './utils.js';
import { downloadPo } from './poPdf.js';
import { toast } from './usePb.js';

const th = { th: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600, color: 'var(--mantine-color-slate-7)', whiteSpace: 'nowrap' } };

// Tombol aksi Payment Request sesuai peran: Approver setujui/tolak, Finance bayar.
export function PrActions({ pr, pb, openDialog }) {
  const role = pb.role;
  if (pr.status === 'diajukan') {
    // Approval PR ada di Finance Manager (spesifikasi 2.2), bukan approver pengadaan.
    if (prBlockedBySoD(role, pr)) return <RoleChip role="finance_manager" />;
    return canApprove(role, 'pr') ? (
      <Group gap={6} wrap="nowrap">
        <Button size="compact-xs" radius="md" color="red" variant="light" onClick={() => openDialog({ type: 'pr-reject', prId: pr.id })}>Tolak</Button>
        <Button size="compact-xs" radius="md" leftSection={<Check size={12} />} onClick={() => { pb.update('prs', pr.id, (d) => ({ ...d, status: 'disetujui' })); toast('Payment Request disetujui.'); }}>Setujui</Button>
      </Group>
    ) : (
      <RoleChip role="finance_manager" />
    );
  }
  if (pr.status === 'disetujui') {
    return canCreate(role, 'pv') ? (
      <Button size="compact-xs" radius="md" onClick={() => openDialog({ type: 'pay', prId: pr.id })}>Bayar</Button>
    ) : (
      <RoleChip role="kasir" />
    );
  }
  return null;
}

export default function PoDetail({ po, pb, onBack, go, openDialog }) {
  const role = pb.role;
  const label = poDocLabel(po);
  const isJasa = poAllJasa(po);
  // Spesifikasi 2.1: Gudang melihat pesanan dan tanggal kirim, tanpa harga.
  const noPrice = hidesPrices(role);
  const pphCut = Math.round(po.items.reduce((n, i) => n + i.qty * i.price * (i.pphRate ?? 0), 0));
  const vendor = pb.vendorsById[po.vendorId];
  const status = poStatus(po, pb.calc);
  const fpbj = pb.fpbjById[po.fpbjId];
  const receipts = receiptsOf(po, pb.receipts);
  const invoices = pb.invoices.filter((i) => i.poId === po.id || i.lines.some((l) => l.poId === po.id));
  const prs = pb.prs.filter((p) => p.poId === po.id);
  const returns = pb.returns.filter((r) => invoices.some((i) => i.id === r.invoiceId));
  // Ada pembayaran di muka? CBD/DP (barang) maupun termin jasa yang menagih di awal.
  const hasDp = advancePct(po.term) > 0;
  const dpPr = prs.find((p) => p.kind === 'dp' && p.status !== 'ditolak');
  const anyRemaining = po.items.some((i) => remainingQty(po, i.id, pb.receipts) > 0);
  const openLines = receipts.flatMap((r) => uninvoicedLines(r, pb.invoices));
  // Batalkan / tutup pesanan hanya selama belum ada penerimaan yang dicatat.
  const closed = !!po.closedAs;
  const canClose = !closed && receipts.length === 0 && canCreate(role, 'po');
  const [closing, setClosing] = useState(null);
  const [sendOpen, setSendOpen] = useState(false);
  // Kirim ke vendor = dokumen lepas ke luar, jadi dikonfirmasi dulu lewat modal.
  const sendPo = ({ cc, note }) => {
    pb.update('pos', po.id, (d) => ({ ...d, sent: true, sentAt: TODAY, sentBy: personLabel(role), sentCc: cc, sentNote: note }));
    setSendOpen(false);
    toast(`${label} dikirim ke ${vendorEmail(vendor) || 'vendor'}.`);
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
                <StatusPill map={PO_STATUS} status={status} />
              </Group>
              <Text fz="sm" c="slate.6">{vendor?.name}{fpbj && <> · dari <DocNumber onClick={() => go({ name: 'fpbj', id: fpbj.id })}>{fpbj.number}</DocNumber></>}</Text>
              {po.note && <Text fz={11} c="teal.8" fw={600}>{po.note}</Text>}
            </Box>
          </Group>
          <Group gap="xs">
            {/* Dokumen yang sudah terbuat selalu bisa diunduh, oleh peran mana pun. */}
            <Button
              radius="md"
              variant="default"
              leftSection={<DownloadSimple size={16} />}
              onClick={() => { downloadPo(po, { vendor, fpbj }); toast(`${label} diunduh sebagai PDF.`); }}
            >
              Unduh PDF
            </Button>
            {!closed && !po.sent && (canCreate(role, 'po') ? (
              <Button radius="md" leftSection={<PaperPlaneTilt size={16} />} onClick={() => setSendOpen(true)}>Kirim ke vendor</Button>
            ) : <RoleChip role="accounting" />)}
            {!closed && po.sent && hasDp && !dpPr && canCreate(role, 'pr') && (
              <Button radius="md" variant="light" onClick={() => openDialog({ type: 'pr', kind: 'dp', poId: po.id })}>Buat Payment Request {advanceLabel(po.term)}</Button>
            )}
            {!closed && po.sent && anyRemaining && canCreate(role, receiptDoc(isJasa)) && (
              <Button radius="md" onClick={() => openDialog({ type: 'receipt', poId: po.id })}>{poAllJasa(po) ? 'Catat BAST' : 'Catat penerimaan'}</Button>
            )}
            {openLines.length > 0 && canCreate(role, 'invoice') && (
              <Button radius="md" onClick={() => openDialog({ type: 'invoice', receiptIds: receipts.filter((r) => uninvoicedLines(r, pb.invoices).length).map((r) => r.id) })}>Buat faktur</Button>
            )}
            {status === 'selesai' && canCreate(role, 'fpbj') && (
              <Button radius="md" variant="light" onClick={() => go({ name: 'fpbj-new', prefill: { poId: po.id } })}>Pesan ulang</Button>
            )}
            {canClose && (
              <>
                <Divider orientation="vertical" mx={2} />
                <Menu position="bottom-end" width={240} shadow="md" withinPortal>
                  <Menu.Target>
                    <ActionIcon variant="default" size={36} radius="md" aria-label="Aksi lainnya">
                      <DotsThreeVertical size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Hentikan pesanan</Menu.Label>
                    <Menu.Item leftSection={<Prohibit size={16} />} onClick={() => setClosing('ditutup')}>Tutup pesanan</Menu.Item>
                    <Menu.Item color="red" leftSection={<X size={16} />} onClick={() => setClosing('dibatalkan')}>Batalkan pesanan</Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </>
            )}
          </Group>
        </Group>
      </Card>

      {closed && (
        <Callout tone="stop" title={po.closedAs === 'dibatalkan' ? `${label} dibatalkan` : `${label} ditutup`}>
          {po.closeNote}
          {po.closedBy && <> — {po.closedBy}</>}
        </Callout>
      )}

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
                <CardHead icon={Info} desc={isJasa ? 'Vendor, tanggal, dan termin bayar' : 'Vendor, tanggal, gudang, dan termin bayar'}>Informasi {label}</CardHead>
              </Box>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={0}>
                {[
                  ['Vendor', vendor?.name],
                  [`Tanggal ${label}`, formatDate(po.date)],
                  // SPK tidak mengirim barang ke gudang: istilahnya target selesai, bukan perkiraan tiba.
                  [isJasa ? 'Target selesai' : 'Perkiraan tiba', formatDate(po.expectedAt)],
                  ...(isJasa ? [] : [['Gudang tujuan', po.warehouse]]),
                  ['Dari permintaan', fpbj ? <DocNumber onClick={() => go({ name: 'fpbj', id: fpbj.id })}>{fpbj.number}</DocNumber> : '—'],
                  ['Termin bayar', termText(po.term)],
                  // Jejak pengiriman hanya muncul setelah dokumen benar-benar dikirim.
                  ...(po.sent
                    ? [[
                      'Dikirim ke vendor',
                      <>
                        {vendorEmail(vendor) || '—'}
                        <Text fz={11} fw={400} c="slate.6">
                          {[po.sentAt && formatDate(po.sentAt), po.sentBy].filter(Boolean).join(' · ') || 'Tanggal tidak tercatat'}
                          {po.sentCc ? ` · cc ${po.sentCc}` : ''}
                        </Text>
                      </>,
                    ]]
                    : []),
                ].map(([k, v], i) => (
                  <Box
                    key={k}
                    px="lg"
                    py="md"
                    style={{
                      minWidth: 0,
                      borderTop: i >= 2 ? '1px solid var(--mantine-color-gray-2)' : undefined,
                      borderLeft: i % 2 ? '1px solid var(--mantine-color-gray-2)' : undefined,
                    }}
                  >
                    <Text fz={11} fw={600} c="slate.6">{k}</Text>
                    <Text fz="sm" fw={700} c="slate.9" lh={1.35} component="div" style={{ overflowWrap: 'anywhere' }}>{v}</Text>
                  </Box>
                ))}
              </SimpleGrid>
            </Card>

            <Section divided flush icon={Package} title="Item pesanan" description="Jumlah dipesan, diterima, dan difaktur per item" right={count(po.items.length, 'item')}>
              <Box style={{ overflow: 'auto' }}>
                <Table verticalSpacing="xs" horizontalSpacing="sm" miw={560} styles={th}>
                  <Table.Thead bg="slate.0">
                    <Table.Tr>
                      <Table.Th w={240}>Item</Table.Th>
                      <Table.Th ta="right">Dipesan</Table.Th>
                      <Table.Th ta="right">Diterima</Table.Th>
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
                        <Table.Td ta="right" fz="sm">{receivedQty(po, i.id, pb.receipts)}</Table.Td>
                        <Table.Td ta="right" fz="sm">{receipts.reduce((n, r) => n + invoicedQty(r.id, i.id, pb.invoices), 0)}</Table.Td>
                        {!noPrice && <Table.Td ta="right" fz="sm">{rupiah(i.price)}</Table.Td>}
                        {!noPrice && <Table.Td ta="right" fz="sm" fw={700}>{rupiah(i.qty * i.price)}</Table.Td>}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Box>
              {!poAllBarang(po) && <Box p="lg" pt={0}><Callout>Item jasa: lingkup, periode, dan milestone mengikuti penawaran pemenang.</Callout></Box>}
            </Section>

            <Section divided flush icon={Truck} title={poAllJasa(po) ? 'Serah terima (BAST)' : poAllBarang(po) ? 'Penerimaan barang (FPB)' : 'Penerimaan (FPB / BAST)'} description="Surat jalan dan serah terima yang dicatat gudang" right={count(receipts.length, 'dokumen')}>
              {receipts.length === 0 ? (
                <Text fz="xs" c="slate.6" p="lg">Belum ada penerimaan. {po.sent ? '' : `Kirim ${label} ke vendor lebih dulu.`}</Text>
              ) : (
                <DataTable bare head={[{ label: 'Nomor' }, { label: 'Tanggal' }, { label: poAllJasa(po) ? 'No. BAST' : poAllBarang(po) ? 'Surat jalan' : 'Surat jalan / BAST' }, { label: 'Diterima', align: 'right' }, { label: 'Faktur' }, { label: '', w: 120 }]} minWidth={600}>
                  {receipts.map((r) => {
                    const open = uninvoicedLines(r, pb.invoices).length > 0;
                    return (
                      <Table.Tr key={r.id}>
                        <Table.Td><DocNumber onClick={() => go({ name: 'receipt', id: r.id })}>{r.number}</DocNumber></Table.Td>
                        <Table.Td fz="sm" style={{ whiteSpace: 'nowrap' }}>{formatDate(r.date)}</Table.Td>
                        <Table.Td fz="sm">{r.doNumber}</Table.Td>
                        <Table.Td ta="right" fz="sm">{r.lines.reduce((n, l) => n + l.qty, 0)}</Table.Td>
                        <Table.Td fz="xs" c={open ? 'orange.8' : 'green.8'} fw={600}>{open ? 'Belum difaktur' : 'Sudah difaktur'}</Table.Td>
                        <Table.Td ta="right">
                          {open && canCreate(role, 'invoice') && <Button size="compact-xs" radius="md" variant="light" onClick={() => openDialog({ type: 'invoice', receiptIds: [r.id] })}>Buat faktur</Button>}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </DataTable>
              )}
            </Section>

            <Section divided flush icon={Receipt} title="Faktur pembelian" description="Tagihan vendor yang dibuat dari penerimaan" right={count(invoices.length, 'faktur')}>
              {invoices.length === 0 ? (
                <Text fz="xs" c="slate.6" p="lg">Faktur dibuat dari penerimaan yang sudah dikonfirmasi.</Text>
              ) : (
                <DataTable bare head={[{ label: 'Nomor' }, { label: 'Jatuh tempo' }, { label: 'Status' }, { label: 'Sisa hutang', align: 'right' }, { label: '', w: 190 }]} minWidth={700}>
                  {invoices.map((i) => {
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
                              {t.free > 0 && <Button size="compact-xs" radius="md" onClick={() => openDialog({ type: 'pr', kind: 'pelunasan', invoiceIds: [i.id] })}>Bayar</Button>}
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
                <Text fz="xs" c="slate.6" p="lg">{hasDp ? `Termin ini menagih di muka. Buat Payment Request ${advanceLabel(po.term)} dari tombol di atas.` : 'Payment Request pelunasan dibuat dari faktur.'}</Text>
              ) : (
                <DataTable bare head={[{ label: 'Nomor' }, { label: 'Jenis' }, { label: 'Status' }, { label: 'Nominal', align: 'right' }, { label: '', w: 160 }]} minWidth={640}>
                  {prs.map((p) => (
                    <Table.Tr key={p.id}>
                      <Table.Td><DocNumber onClick={() => go({ name: 'pr', id: p.id })}>{p.number}</DocNumber></Table.Td>
                      <Table.Td fz="sm">{p.kind === 'dp' ? 'Di muka' : 'Pelunasan'}</Table.Td>
                      <Table.Td><StatusPill map={PR_STATUS} status={p.status} size="xs" /></Table.Td>
                      <Table.Td ta="right" fz="sm" fw={700}>{rupiah(p.amount)}</Table.Td>
                      <Table.Td ta="right"><PrActions pr={p} pb={pb} openDialog={openDialog} /></Table.Td>
                    </Table.Tr>
                  ))}
                </DataTable>
              )}
            </Section>

            {returns.length > 0 && (
              <Section divided flush icon={ArrowCounterClockwise} title="Retur pembelian" description="Barang yang dikembalikan ke vendor" right={count(returns.length, 'retur')}>
                <DataTable bare head={[{ label: 'Nomor' }, { label: 'Alasan' }, { label: 'Penyelesaian' }, { label: 'Nilai', align: 'right' }]} minWidth={560}>
                  {returns.map((r) => (
                    <Table.Tr key={r.id}>
                      <Table.Td><DocNumber onClick={() => openDialog({ type: 'detail', kind: 'returns', id: r.id })}>{r.number}</DocNumber></Table.Td>
                      <Table.Td fz="sm">{r.reason}</Table.Td>
                      <Table.Td fz="sm">{{ potong: 'Potong hutang', kredit: 'Kredit vendor', refund: 'Refund' }[r.settlement]}</Table.Td>
                      <Table.Td ta="right" fz="sm" fw={700}>{rupiah(Math.round(r.lines.reduce((n, l) => n + l.qty * l.price, 0) * 1.11))}</Table.Td>
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
            <PurchaseFlow pb={pb} go={go} current={{ kind: 'po', id: po.id }} />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
