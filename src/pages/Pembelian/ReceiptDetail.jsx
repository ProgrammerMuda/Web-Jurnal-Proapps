// Detail penerimaan: FPB (barang) atau BAPP (jasa) yang dicatat dari sebuah PO.
import { approvalMessage, askConfirm } from './confirm.jsx';
import { Badge, Box, Button, Card, Grid, Group, SimpleGrid, Stack, Table, Text, ThemeIcon, Title, Tooltip } from '@mantine/core';
import { ArrowCounterClockwise, Check, DownloadSimple, Info, Package, Paperclip, Receipt, Truck, X } from '@/components/Icon.jsx';
import { BackLink, Callout, CardHead, CopyIcon, DataTable, DocNumber, RoleChip, Section } from './components.jsx';
import { approvalState, canCreate, hidesPrices, isApproverTurn, receiptDoc } from './permissions.js';
import { useApproveReceipt } from './Dialogs.jsx';
import { landedUnitCost } from './landedCost.js';
import { useData } from '@/lib/store.jsx';
import PurchaseFlow from './PurchaseFlow.jsx';
import JournalCard from './JournalCard.jsx';
import ApprovalLog, { chainSteps, legacyLog } from './ApprovalLog.jsx';
import { receiptJournal } from './journal.js';
import AttachmentList from './Attachments.jsx';
import { downloadReceipt } from './receiptPdf.js';
import { toast } from './usePb.js';
import { dpBlockReason, dpState, DP_STATE, formatDate, INV_STATUS, invStatus, invTotals, invoicedQty, RECEIPT_STATUS, receiptConfirmed, receiptStatus, rupiah, uninvoicedLines } from './utils.js';
import { StatusPill } from './components.jsx';

const th = { th: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600, color: 'var(--mantine-color-slate-7)', whiteSpace: 'nowrap' } };

export default function ReceiptDetail({ receipt: r, pb, onBack, go, openDialog }) {
  const { companySettings, stockMoves, products } = useData();
  const po = pb.posById[r.poId];
  const vendor = pb.vendorsById[r.vendorId];
  const isJasa = r.kind === 'jasa';
  const docName = isJasa ? 'BAPP' : 'FPB';
  const itemOf = (id) => po?.items.find((i) => i.id === id);
  const confirmed = receiptConfirmed(r);
  const pending = r.status === 'draf';
  const rejected = r.status === 'ditolak';
  const cancelled = r.status === 'dibatalkan';
  // Pencatat (Gudang untuk FPB, PIC jasa untuk BAPP) yang memperbaiki dokumen yang ditolak.
  const isCreator = canCreate(pb.role, receiptDoc(isJasa));
  // Harga perolehan per unit: DPP ditambah ongkir dan PPN sejauh keduanya
  // dikapitalisasi. Angka inilah yang masuk persediaan, bukan harga PO.
  const showCost = !isJasa && !hidesPrices(pb.role);
  const costOf = (itemId) => landedUnitCost(po, itemId, companySettings, r);
  const costHint = (c) => {
    const bagian = [`DPP ${rupiah(Math.round(c.dpp))}`];
    if (c.vat) bagian.push(`PPN ${rupiah(Math.round(c.vat))}`);
    if (c.freight) bagian.push(`ongkir ${rupiah(Math.round(c.freight))}`);
    return bagian.join(' + ');
  };
  const open = uninvoicedLines(r, pb.invoices).length > 0;
  // Faktur pelunasan menunggu uang muka pesanannya beres (lunas atau dibatalkan resmi).
  const dp = dpState(po, pb.calc);
  const dpTahan = dpBlockReason(dp);
  // FPB dan BAPP disetujui dulu sebelum Accounting bisa memfakturkan.
  // Approval berjenjang dua: Chief Finance lalu Building Manager.
  const kind = isJasa ? 'bapp' : 'fpb';
  const ap = approvalState(r, kind, { settled: confirmed });
  const approveReceipt = useApproveReceipt(pb);
  const approveBast = () => {
    approveReceipt(r, pb.role);
    toast(ap.done.length + 1 >= ap.total ? `${docName} disetujui penuh. Sudah bisa difaktur.` : `Approval ${ap.done.length + 1} dari ${ap.total} dicatat.`);
  };
  const invoices = pb.invoices.filter((i) => i.lines.some((l) => l.receiptId === r.id));
  const totalQty = r.lines.reduce((n, l) => n + l.qty, 0);
  const totalRejected = r.lines.reduce((n, l) => n + (l.rejected || 0), 0);
  // Qty yang dipesan pada PO untuk baris-baris di dokumen ini — pembanding "diterima".
  const totalOrdered = r.lines.reduce((n, l) => n + (itemOf(l.itemId)?.qty ?? 0), 0);
  const count = (n, unit) => <Badge size="sm" radius="sm" variant="light" color="slate" tt="none">{n} {unit}</Badge>;

  const cells = [
    ['Vendor', vendor?.name],
    ['Dicatat oleh', r.createdBy || '—'],
    ['Dari pesanan', po ? <DocNumber onClick={() => go({ name: 'po', id: po.id })}>{po.number}</DocNumber> : '—'],
    [isJasa ? 'No. BAPP vendor' : 'No. surat jalan', r.doNumber || '—'],
  ];

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" className="pb-form">
      <BackLink label="Kembali ke daftar penerimaan" onClick={onBack} />

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" align="center" gap="md">
          <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
            <ThemeIcon size={52} radius="md" color="primary.9"><Truck size={26} /></ThemeIcon>
            <Box style={{ minWidth: 0 }}>
              <Group gap="xs" wrap="wrap">
                <Title order={2} fz={{ base: 20, md: 24 }} c="slate.9">{r.number}</Title>
                <CopyIcon value={r.number} size={16} />
                <StatusPill map={RECEIPT_STATUS} status={receiptStatus(r, pb.invoices)} approval={{ doc: r, kind }} />
              </Group>
              <Text fz="sm" c="slate.6">{formatDate(r.date)}</Text>
            </Box>
          </Group>
          <Group gap="xs">
            {/* Dokumen yang sudah tercatat selalu bisa diunduh, oleh peran mana pun. */}
            <Button
              radius="md"
              variant="default"
              leftSection={<DownloadSimple size={16} />}
              onClick={() => { downloadReceipt(r, { vendor, po }); toast(`${docName} diunduh sebagai PDF.`); }}
            >
              Unduh PDF
            </Button>
            {pending && (isApproverTurn(pb.role, r, kind) ? (
              <>
                <Button radius="md" variant="default" c="red.8" leftSection={<X size={16} />} onClick={() => openDialog({ type: 'receipt-reject', receiptId: r.id })}>Tolak</Button>
                <Button
                  radius="md"
                  leftSection={<Check size={16} />}
                  onClick={() => askConfirm({
                    title: `Setujui ${r.number}?`,
                    message: approvalMessage(ap, { final: isJasa ? 'Ini approval terakhir: BAPP sah, beban dan jurnalnya terbentuk, dan sudah bisa difaktur.' : 'Ini approval terakhir: FPB sah, stok masuk gudang, jurnal terbentuk, dan sudah bisa difaktur.' }),
                    confirmLabel: 'Ya, setujui',
                    onConfirm: approveBast,
                  })}
                >Setujui {docName} ({ap.done.length + 1}/{ap.total})</Button>
              </>
            ) : <Group gap={6}><Text fz="xs" c="slate.7">Menunggu</Text><RoleChip role={ap.next ?? 'cfo'} /></Group>)}
            {rejected && (isCreator ? (
              <>
                <Button radius="md" variant="default" c="red.8" leftSection={<X size={16} />} onClick={() => openDialog({ type: 'receipt-cancel', receiptId: r.id })}>Batalkan</Button>
                <Button radius="md" leftSection={<ArrowCounterClockwise size={16} />} onClick={() => openDialog({ type: 'receipt', poId: r.poId, receiptId: r.id })}>Ajukan ulang</Button>
              </>
            ) : <Group gap={6}><Text fz="xs" c="slate.7">Diperbaiki oleh</Text><RoleChip role="gudang" /></Group>)}
            {confirmed && open && (canCreate(pb.role, 'invoice') ? (
              <Tooltip label={dpTahan} disabled={!dpTahan} withArrow fz="xs" multiline w={260}>
                <Button radius="md" leftSection={<Receipt size={16} />} disabled={!!dpTahan} onClick={() => go({ name: 'invoice-new', receiptIds: [r.id] })}>Catat faktur</Button>
              </Tooltip>
            ) : <Group gap={6}><Text fz="xs" c="slate.7">Faktur oleh</Text><RoleChip role="accounting" /></Group>)}
          </Group>
        </Group>
      </Card>

      {rejected && (
        <Callout tone="stop" title={`${docName} ditolak`}>
          {(r.rejectNote || 'Tanpa alasan').replace(/[.\s]*$/, '.')} Qty pada {docName} ini tetap tertahan sampai diajukan ulang atau dibatalkan. Stok dan jurnal belum bergerak.
        </Callout>
      )}
      {cancelled && (
        <Callout tone="info" title={`${docName} dibatalkan`}>
          {r.cancelNote ? `${r.cancelNote.replace(/[.\s]*$/, '')}. ` : ''}Qty-nya sudah dilepas dan bisa dicatat di {docName} lain.
        </Callout>
      )}

      {confirmed && open && dpTahan && (
        <Callout tone="warn" title={DP_STATE[dp.state].label}>
          <Group gap={6} wrap="wrap">
            <span>{dpTahan}. Faktur pelunasan untuk {docName} ini baru bisa dibuat setelah uang muka beres.</span>
            {po && <DocNumber onClick={() => go({ name: 'po', id: po.id })}>Lihat {po.number}</DocNumber>}
          </Group>
        </Callout>
      )}

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8.5 }}>
          <Stack gap="lg">
            <Card withBorder radius="lg" padding={0} bg="white">
              <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                <CardHead icon={Info} desc={`Vendor, pencatat, pesanan asal, dan nomor ${isJasa ? 'berita acara' : 'surat jalan'}`}>Informasi {docName}</CardHead>
              </Box>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={1} verticalSpacing={1} bg="gray.2">
                {cells.map(([k, v], i, all) => (
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
              {r.note && (
                <Box px="lg" py="md" bg="slate.0" style={{ borderTop: '1px solid var(--mantine-color-gray-2)', borderRadius: '0 0 var(--mantine-radius-lg) var(--mantine-radius-lg)' }}>
                  <Text fz={11} fw={600} c="slate.6" mb={2}>Catatan</Text>
                  <Text fz="sm" c="slate.8" style={{ whiteSpace: 'pre-wrap' }}>{r.note}</Text>
                </Box>
              )}
            </Card>

            <Card withBorder radius="lg" padding={0} bg="white">
              <Group justify="space-between" px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                <CardHead icon={Paperclip} desc={isJasa ? 'Berita acara bertanda tangan dari vendor' : 'Surat jalan atau bukti kirim dari vendor'}>
                  Berkas {docName}
                </CardHead>
                {r.file && <Badge size="sm" radius="sm" variant="light" color="slate" tt="none">1 berkas</Badge>}
              </Group>
              <Box px="lg" py="md">
                {r.file ? (
                  <AttachmentList names={[r.file]} label={`${docName} ${r.number}`} />
                ) : (
                  <Text fz="xs" c="slate.6">
                    {isJasa ? 'Belum ada berkas BAPP bertanda tangan.' : 'Tidak ada berkas dilampirkan. Pada FPB, unggahan memang opsional.'}
                  </Text>
                )}
              </Box>
            </Card>

            <Section divided flush icon={Package} title={isJasa ? 'Jasa diterima' : 'Barang diterima'} description="Jumlah pada penerimaan ini dibanding pesanan" right={count(r.lines.length, 'item')}>
              <Box style={{ overflow: 'auto' }}>
                <Table verticalSpacing="xs" horizontalSpacing="sm" miw={520} styles={th}>
                  <Table.Thead bg="slate.0">
                    <Table.Tr>
                      <Table.Th>Item</Table.Th>
                      <Table.Th ta="right">Dipesan</Table.Th>
                      <Table.Th ta="right">Diterima</Table.Th>
                      <Table.Th ta="right">Ditolak</Table.Th>
                      <Table.Th ta="right">Difaktur</Table.Th>
                      {showCost && <Table.Th ta="right">Harga perolehan</Table.Th>}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {r.lines.map((l, i) => {
                      const it = itemOf(l.itemId);
                      return (
                        <Table.Tr key={i}>
                          <Table.Td fz="sm" fw={600}>{it?.desc}{it?.spec && <Text fz={11} c="slate.6" fw={400}>{it.spec}</Text>}</Table.Td>
                          <Table.Td ta="right" fz="sm">{it?.qty} {it?.unit}</Table.Td>
                          <Table.Td ta="right" fz="sm" fw={700}>{l.qty} {it?.unit}</Table.Td>
                          <Table.Td ta="right" fz="sm" c={l.rejected ? 'red.7' : undefined}>{l.rejected || 0}</Table.Td>
                          <Table.Td ta="right" fz="sm">{invoicedQty(r.id, l.itemId, pb.invoices)}</Table.Td>
                          {showCost && (
                            <Table.Td ta="right" fz="sm">
                              <Tooltip label={costHint(costOf(l.itemId))} withArrow fz="xs">
                                <Text fz="sm" fw={600} style={{ cursor: 'help' }}>
                                  {rupiah(Math.round(costOf(l.itemId).total))}
                                </Text>
                              </Tooltip>
                            </Table.Td>
                          )}
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Box>
            </Section>

            <Section divided flush icon={Receipt} title="Faktur pembelian" description="Tagihan vendor yang dibuat dari penerimaan ini" right={count(invoices.length, 'faktur')}>
              {invoices.length === 0 ? (
                <Text fz="xs" c="slate.6" p="lg">Belum ada faktur dari penerimaan ini.</Text>
              ) : (
                <DataTable bare head={[{ label: 'Nomor' }, { label: 'Jatuh tempo' }, { label: 'Status' }, { label: 'Sisa hutang', align: 'right' }]} minWidth={520}>
                  {invoices.map((i) => {
                    const t = invTotals(i, pb.calc);
                    return (
                      <Table.Tr key={i.id}>
                        <Table.Td><DocNumber onClick={() => go({ name: 'invoice', id: i.id })}>{i.number}</DocNumber><Text fz={11} c="slate.6">{i.vendorNo}</Text></Table.Td>
                        <Table.Td fz="sm" style={{ whiteSpace: 'nowrap' }}>{formatDate(i.dueDate)}</Table.Td>
                        <Table.Td><StatusPill map={INV_STATUS} status={invStatus(i, t)} size="xs" /></Table.Td>
                        <Table.Td ta="right" fz="sm" fw={700}>{rupiah(t.balance)}</Table.Td>
                      </Table.Tr>
                    );
                  })}
                </DataTable>
              )}
            </Section>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 3.5 }}>
          <Stack gap="lg">
            <Card withBorder radius="lg" padding={0} bg="white">
              <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                <CardHead icon={Truck} desc="Total yang tercatat pada dokumen ini">Ringkasan</CardHead>
              </Box>
              {/* Empat angka dokumen ini. Kartunya sempit (kolom 3.5/12), jadi disusun 2x2
                  — empat kolom membuat labelnya terpotong. "item" berarti baris, sama seperti
                  chip "{n} item" di kepala seksi. */}
              <SimpleGrid cols={2} spacing={0}>
                {[
                  ['Total item', r.lines.length, 'slate.9'],
                  ['Total dipesan', totalOrdered, 'slate.9'],
                  ['Total diterima', totalQty, 'slate.9'],
                  ['Total ditolak', totalRejected, totalRejected ? 'red.7' : 'slate.9'],
                ].map(([label, value, color], i) => (
                  <Box
                    key={label}
                    px="lg"
                    py="md"
                    style={{
                      borderLeft: i % 2 ? '1px solid var(--mantine-color-gray-2)' : undefined,
                      borderTop: i > 1 ? '1px solid var(--mantine-color-gray-2)' : undefined,
                    }}
                  >
                    <Text fz={11} fw={600} c="slate.6">{label}</Text>
                    <Text fz={22} fw={700} c={color} lh={1.3}>{value}</Text>
                  </Box>
                ))}
              </SimpleGrid>
              {totalRejected > 0 && (
                <Text fz={11} c="slate.6" px="lg" pb="lg">
                  Qty ditolak tidak dihitung sebagai diterima, jadi sisa pesanannya tetap terbuka.
                </Text>
              )}
            </Card>
            <ApprovalLog steps={chainSteps(r, kind, { settled: confirmed, rejected, active: !cancelled })} log={legacyLog(r)} />
            <JournalCard
              lines={confirmed ? receiptJournal(r, pb, { stockMoves, products }) : []}
              description={`Atas ${r.number}`}
              onDetail={() => go({ name: 'journal', kind: 'receipt', id: r.id })}
              empty={confirmed ? 'Penerimaan ini tidak bernilai, jadi tidak membentuk jurnal.' : `Jurnal terbentuk setelah ${docName} disetujui penuh.`}
            />
            <PurchaseFlow pb={pb} go={go} current={{ kind: 'receipt', id: r.id }} />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
