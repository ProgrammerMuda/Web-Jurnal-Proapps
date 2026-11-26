// Detail faktur pembelian: baris yang ditagih, pembayaran, retur, dan rincian nilai.
import { useState } from 'react';
import { ActionIcon, Badge, Box, Button, Card, Grid, Group, Menu, SimpleGrid, Stack, Table, Text, ThemeIcon, Title } from '@mantine/core';
import { ArrowCounterClockwise, Calculator, CurrencyCircleDollar, DotsThreeVertical, DownloadSimple, Info, Money, Package, Paperclip, Receipt, X } from '@/components/Icon.jsx';
import AttachmentList from './Attachments.jsx';
import { BackLink, Callout, CardHead, CopyIcon, DataTable, DocNumber, RoleChip, Section, StatusPill } from './components.jsx';
import PurchaseFlow from './PurchaseFlow.jsx';
import JournalCard from './JournalCard.jsx';
import { invoiceJournal } from './journal.js';
import { useData } from '@/lib/store.jsx';
import { personLabel, TODAY } from './data.js';
import { ReasonModal } from './Dialogs.jsx';
import { downloadInvoice } from './invoicePdf.js';
import { PrActions } from './PoDetail.jsx';
import { canCreate } from './permissions.js';
import { toast } from './usePb.js';
import {
  canReturn as canReturnInv,
  formatDate,
  INV_STATUS,
  invOverdue,
  invStatus,
  invLineDesc,
  invTotals,
  isDpInvoice,
  isRetentionRelease,
  PR_STATUS,
  poDocLabel,
  ppnLabel,
  returnedQty,
  rupiah,
  vendorCredit,
  retentionDocName,
  RETURN_STATUS,
  returnGross,
  returnState,
  SETTLEMENT_LABEL,
} from './utils.js';

const th = { th: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600, color: 'var(--mantine-color-slate-7)', whiteSpace: 'nowrap' } };

export default function InvoiceDetail({ invoice: inv, pb, onBack, go, openDialog }) {
  const role = pb.role;
  const po = pb.posById[inv.poId] ?? pb.posById[inv.lines[0]?.poId];
  const vendor = pb.vendorsById[inv.vendorId];
  const { stockMoves, products } = useData();
  const t = invTotals(inv, pb.calc);
  const status = invStatus(inv, t);
  const overdue = invOverdue(inv, t);
  const canReturn = canReturnInv(inv, po, pb.returns);
  // Faktur hanya bisa dibatalkan selama belum ada pembayaran dan belum pernah diretur.
  const cancelled = !!inv.cancelled;
  const canCancel = !cancelled && t.paid === 0 && pb.prs.every((p) => !p.invoiceIds?.includes(inv.id) || p.status === 'ditolak') && !pb.returns.some((r) => r.invoiceId === inv.id);
  const [cancelOpen, setCancelOpen] = useState(false);
  // Saldo kredit vendor yang masih bisa dialokasikan ke faktur ini.
  const credit = cancelled ? 0 : vendorCredit(inv.vendorId, pb) + (inv.credit ?? 0);
  const cancelInvoice = (note) => {
    pb.update('invoices', inv.id, (d) => ({ ...d, cancelled: true, cancelledAt: TODAY, cancelNote: note, cancelledBy: personLabel(role) }));
    // Qty yang kembali terbuka dicatat di faktur ini dengan harga sebelum ubah harga PO disetujui.
    // Sekarang qty itu ikut harga baru, jadi nilainya disesuaikan di tanggal pembatalan supaya
    // faktur ulangnya tetap menutup Belum Ditagih pas.
    const byReceipt = Object.groupBy(inv.lines.filter((l) => l.receiptId && l.itemId), (l) => l.receiptId);
    Object.entries(byReceipt).forEach(([rid, lines]) => {
      const rec = pb.receiptsById[rid];
      const rpo = rec && pb.posById[rec.poId];
      if (!rpo) return;
      pb.update('receipts', rid, (d) => ({ ...d, lines: d.lines.map((rl) => {
        const it = rpo.items.find((i) => i.id === rl.itemId);
        const done = lines.filter((l) => l.itemId === rl.itemId);
        if (rl.price == null || !it || !done.length) return rl;
        const adjs = done.map((l) => {
          const paid = rl.price + (l.priceAdj ?? 0);
          return { qty: l.qty, from: paid, to: it.price, delta: it.price - paid, at: TODAY, ref: inv.number, kind: 'batal' };
        }).filter((a) => a.delta !== 0);
        return adjs.length ? { ...rl, priceAdjs: [...(rl.priceAdjs ?? []), ...adjs] } : rl;
      }) }));
    });
    setCancelOpen(false);
    toast('Faktur dibatalkan. Qty-nya kembali terbuka untuk difaktur ulang.');
  };
  // Payment Request yang menyentuh faktur ini, termasuk yang masih menunggu approval.
  const prs = pb.prs.filter((p) => p.invoiceIds?.includes(inv.id) || (p.kind !== 'dp' && p.poId === inv.poId && !p.invoiceIds));
  const returns = pb.returns.filter((r) => r.invoiceId === inv.id);
  const receiptNos = [...new Set(inv.lines.map((l) => pb.receiptsById[l.receiptId]?.number).filter(Boolean))];
  const itemOf = (l) => (pb.posById[l.poId ?? inv.poId] ?? po)?.items.find((i) => i.id === l.itemId);
  const count = (n, unit) => <Badge size="sm" radius="sm" variant="light" color="slate" tt="none">{n} {unit}</Badge>;

  // Pelepasan retensi: bukan faktur baru dari vendor, melainkan saldo Hutang Retensi yang
  // dicairkan setelah masa pemeliharaan selesai.
  const release = isRetentionRelease(inv);
  const heldBy = release ? (inv.sources ?? []).map((x) => ({ ...x, doc: pb.invoicesById[x.invoiceId] })).filter((x) => x.doc) : [];
  const cells = release ? [
    ['Vendor', vendor?.name],
    [`No. ${retentionDocName(po)}`, inv.bastNo || '—'],
    ['Tanggal pelepasan', formatDate(inv.date)],
    ['Jatuh tempo', <Text key="d" span fz="sm" fw={700} c={overdue ? 'red.7' : 'slate.9'}>{formatDate(inv.dueDate)}{overdue && ' · lewat jatuh tempo'}</Text>],
    [po ? poDocLabel(po) : 'Pesanan', po ? <DocNumber onClick={() => go({ name: 'po', id: po.id })}>{po.number}</DocNumber> : '—'],
    ['Masa pemeliharaan selesai', inv.maintenanceEnd ? formatDate(inv.maintenanceEnd) : '—'],
  ] : [
    ['Vendor', vendor?.name],
    ['No. invoice vendor', inv.vendorNo || '—'],
    ['No. faktur pajak', inv.taxNo || '—'],
    ['Tanggal faktur', formatDate(inv.date)],
    ['Jatuh tempo', <Text key="d" span fz="sm" fw={700} c={overdue ? 'red.7' : 'slate.9'}>{formatDate(inv.dueDate)}{overdue && ' · lewat jatuh tempo'}</Text>],
    [po ? poDocLabel(po) : 'Pesanan', po ? <DocNumber onClick={() => go({ name: 'po', id: po.id })}>{po.number}</DocNumber> : '—'],
    ['Dari penerimaan', receiptNos.join(', ') || '—'],
  ];

  const lineRow = (label, value, extra) => (
    <Group justify="space-between" wrap="nowrap" align="flex-start" gap="md">
      <Text fz="xs" c="slate.7">{label}</Text>
      <Text fz="xs" fw={600} ta="right" {...extra}>{value}</Text>
    </Group>
  );

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" className="pb-form">
      <BackLink label="Kembali ke daftar tagihan vendor" onClick={onBack} />

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" align="center" gap="md">
          <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
            <ThemeIcon size={52} radius="md" color="primary.9"><Receipt size={26} /></ThemeIcon>
            <Box style={{ minWidth: 0 }}>
              <Group gap="xs" wrap="wrap">
                <Title order={2} fz={{ base: 20, md: 24 }} c="slate.9">{inv.number}</Title>
                <CopyIcon value={inv.number} size={16} />
                {/* Status sudah berbunyi "Jatuh tempo" sendiri; badge kedua cuma mengulang. */}
                <StatusPill map={INV_STATUS} status={status} />
                {release && <Badge size="sm" radius="sm" variant="light" color="violet" tt="none" fw={700}>Pelepasan retensi</Badge>}
              </Group>
              {/* Cukup tanggal dokumennya — vendor, no. invoice vendor, dan pesanan asalnya
                  sudah tertera di kartu Informasi faktur. */}
              <Text fz="sm" c="slate.6">{formatDate(inv.date)}</Text>
            </Box>
          </Group>
          {/* Aksi utama satu tombol; sisanya masuk menu titik tiga. */}
          <Group gap="xs">
            {/* Dokumen yang sudah terbuat selalu bisa diunduh, oleh peran mana pun. */}
            <Button
              radius="md"
              variant="default"
              leftSection={<DownloadSimple size={16} />}
              onClick={() => {
                downloadInvoice(inv, { vendor, po, posById: pb.posById, receiptsById: pb.receiptsById, prs, totals: t });
                toast('Faktur diunduh sebagai PDF.');
              }}
            >
              Unduh PDF
            </Button>
            {!cancelled && canCreate(role, 'invoice') ? (
              <>
                {/* Tombol ini membuat Payment Request, bukan mengeluarkan uang — kasnya baru
                    berkurang tiga tahap kemudian, setelah approval dan Payment Voucher. */}
                {t.free > 0 && (
                  <Button radius="md" leftSection={<Money size={16} />} onClick={() => go({ name: 'pr-new', invoiceIds: [inv.id] })}>
                    Ajukan Pembayaran
                  </Button>
                )}
                {!release && (credit > 0 || canReturn || canCancel) && (
                  <Menu position="bottom-end" width={230} shadow="md" withinPortal>
                    <Menu.Target>
                      <ActionIcon variant="default" size={36} radius="md" aria-label="Aksi lainnya">
                        <DotsThreeVertical size={18} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {credit > 0 && (
                        <Menu.Item leftSection={<CurrencyCircleDollar size={16} />} onClick={() => openDialog({ type: 'credit', invoiceId: inv.id })}>
                          Alokasikan Kredit
                        </Menu.Item>
                      )}
                      {canReturn && (
                        <Menu.Item leftSection={<ArrowCounterClockwise size={16} />} onClick={() => openDialog({ type: 'return', invoiceId: inv.id })}>
                          Buat Retur
                        </Menu.Item>
                      )}
                      {canCancel && (
                        <Menu.Item color="red" leftSection={<X size={16} />} onClick={() => setCancelOpen(true)}>
                          Batalkan Tagihan
                        </Menu.Item>
                      )}
                    </Menu.Dropdown>
                  </Menu>
                )}
              </>
            ) : !cancelled && t.balance > 0 ? (
              <Group gap={6}><Text fz="xs" c="slate.7">Diajukan oleh</Text><RoleChip role="accounting" /></Group>
            ) : null}
          </Group>
        </Group>
      </Card>

      {cancelled && (
        <Callout tone="stop" title="Faktur dibatalkan">
          {inv.cancelNote}
          {inv.cancelledBy && <> — {inv.cancelledBy}</>}
          {inv.cancelledAt && <>, {formatDate(inv.cancelledAt)}</>}
          <Text fz="xs" mt={4}>Qty pada penerimaan kembali terbuka dan bisa difaktur ulang.</Text>
        </Callout>
      )}

      <ReasonModal
        opened={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Batalkan faktur"
        label="Alasan pembatalan"
        confirmLabel="Batalkan faktur"
        onConfirm={cancelInvoice}
      />

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8.5 }}>
          <Stack gap="lg">
            <Card withBorder radius="lg" padding={0} bg="white">
              <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                <CardHead icon={Info} desc={release ? `Vendor, ${retentionDocName(po)}, dan pesanan asalnya` : 'Vendor, tanggal, dan dokumen asalnya'}>{release ? 'Informasi pelepasan retensi' : 'Informasi faktur'}</CardHead>
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
            </Card>

            {release ? (
            <Section divided flush icon={Package} title="Retensi yang dilepas" description="Ditahan dari faktur termin; PPN-nya sudah ikut di faktur tersebut" right={count(heldBy.length, 'faktur')}>
              <DataTable bare head={[{ label: 'Faktur termin' }, { label: 'Tanggal' }, { label: 'Retensi ditahan', align: 'right' }]} minWidth={420}>
                {heldBy.map((x) => (
                  <Table.Tr key={x.invoiceId}>
                    <Table.Td><DocNumber onClick={() => go({ name: 'invoice', id: x.invoiceId })}>{x.doc.number}</DocNumber></Table.Td>
                    <Table.Td fz="sm">{formatDate(x.doc.date)}</Table.Td>
                    <Table.Td ta="right" fz="sm" fw={700}>{rupiah(x.amount)}</Table.Td>
                  </Table.Tr>
                ))}
              </DataTable>
            </Section>
            ) : (
            <Section divided flush icon={Package} title="Item difaktur" description="Qty dan harga yang ditagih vendor" right={count(inv.lines.length, 'item')}>
              <Box style={{ overflow: 'auto' }}>
                <Table verticalSpacing="xs" horizontalSpacing="sm" miw={560} styles={th}>
                  <Table.Thead bg="slate.0">
                    <Table.Tr>
                      <Table.Th w={240}>Item</Table.Th>
                      <Table.Th ta="right">Qty</Table.Th>
                      <Table.Th ta="right">Harga</Table.Th>
                      <Table.Th ta="right">Diretur</Table.Th>
                      <Table.Th ta="right">Jumlah</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {inv.lines.map((l, i) => {
                      const it = itemOf(l);
                      const back = returnedQty(inv.id, l.itemId, pb.returns);
                      return (
                        <Table.Tr key={i}>
                          <Table.Td fz="sm" fw={600}>
                            {invLineDesc(l, it)}
                            {/* Keterangan baris (periode, lokasi) hanya ada pada baris manual;
                                baris dari penerimaan sudah dijelaskan nomor FPB/BAPP-nya. */}
                            {l.spec && <Text fz={11} c="slate.7" fw={400}>{l.spec}</Text>}
                            {pb.receiptsById[l.receiptId]
                              ? <Text fz={11} c="slate.6" fw={400}>{pb.receiptsById[l.receiptId].number}</Text>
                              : <Text fz={11} c="slate.6" fw={400}>Tanpa penerimaan</Text>}
                          </Table.Td>
                          <Table.Td ta="right" fz="sm">{l.qty} {it?.unit ?? l.unit ?? ''}</Table.Td>
                          <Table.Td ta="right" fz="sm">{rupiah(l.price)}</Table.Td>
                          <Table.Td ta="right" fz="sm" c={back ? 'red.7' : 'slate.5'}>{back || 0}</Table.Td>
                          <Table.Td ta="right" fz="sm" fw={700}>{rupiah(l.qty * l.price)}</Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Box>
            </Section>
            )}

            <Section divided flush icon={Money} title="Pembayaran" description="Payment Request yang melunasi faktur ini" right={count(prs.length, 'dokumen')}>
              {prs.length === 0 ? (
                <Text fz="xs" c="slate.6" p="lg">Belum ada Payment Request. {t.free > 0 ? 'Buat pembayaran dari tombol di atas.' : ''}</Text>
              ) : (
                <DataTable bare head={[{ label: 'Nomor' }, { label: 'Jenis' }, { label: 'Status' }, { label: 'Nominal', align: 'right' }, { label: '', w: 160 }]} minWidth={600}>
                  {prs.map((p) => (
                    <Table.Tr key={p.id}>
                      <Table.Td><DocNumber onClick={() => go({ name: 'pr', id: p.id })}>{p.number}</DocNumber></Table.Td>
                      <Table.Td fz="sm">{p.kind === 'dp' ? 'Di muka' : 'Pelunasan'}</Table.Td>
                      <Table.Td><StatusPill map={PR_STATUS} status={p.status} size="xs" approval={{ doc: p, kind: 'pr' }} /></Table.Td>
                      <Table.Td ta="right" fz="sm" fw={700}>{rupiah(p.alloc?.[inv.id] ?? p.amount)}</Table.Td>
                      <Table.Td ta="right"><PrActions pr={p} pb={pb} openDialog={openDialog} /></Table.Td>
                    </Table.Tr>
                  ))}
                </DataTable>
              )}
            </Section>

            {returns.length > 0 && (
              <Section divided flush icon={ArrowCounterClockwise} title="Retur pembelian" description="Barang yang dikembalikan dari faktur ini" right={count(returns.length, 'retur')}>
                <DataTable bare head={[{ label: 'Nomor' }, { label: 'Alasan' }, { label: 'Penyelesaian' }, { label: 'Status' }, { label: 'Nilai', align: 'right' }]} minWidth={520}>
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

            {inv.files?.length > 0 && (
              <Section divided flush icon={Paperclip} title="Berkas" description="Invoice vendor dan faktur pajak" right={count(inv.files.length, 'berkas')}>
                <Box p="lg"><AttachmentList names={inv.files} label="Berkas faktur" /></Box>
              </Section>
            )}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 3.5 }}>
          <Stack gap="lg">
            <Card withBorder radius="lg" padding={0} bg="white">
              <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                <CardHead icon={Calculator} desc="Nilai tagihan dan sisa hutang">Ringkasan biaya</CardHead>
              </Box>
              <Stack gap={6} p="lg">
                {/* Urutan sama dengan invoice vendor: nilai, potongan DP, DPP, PPN, retensi, PPh. */}
                {release
                  ? lineRow('Retensi dilepas', rupiah(t.dpp))
                  : lineRow(isDpInvoice(inv) ? 'Uang muka (DPP)' : t.dpDpp > 0 ? 'Nilai tagihan' : 'DPP', rupiah(t.dpp))}
                {t.dpDpp > 0 && lineRow('Potongan uang muka', `-${rupiah(t.dpDpp)}`, { c: 'red.7' })}
                {t.dpDpp > 0 && lineRow('DPP', rupiah(t.dpp - t.dpDpp))}
                {!release && lineRow(ppnLabel(inv.lines), rupiah(t.ppn))}
                {t.retensi > 0 && lineRow(`Retensi ${pb.posById[inv.poId]?.term?.retentionPct ?? ''}% ditahan`, `-${rupiah(t.retensi)}`, { c: 'red.7' })}
                {t.pph > 0 && lineRow(`PPh ${inv.pphPct}%${t.retensi > 0 || t.dpDpp > 0 ? ' atas nilai dibayar' : ''}`, `-${rupiah(t.pph)}`, { c: 'red.7' })}
                {t.dp - t.dpDpp > 0 && lineRow('Potongan uang muka', `-${rupiah(t.dp - t.dpDpp)}`, { c: 'red.7' })}
                {t.ret > 0 && lineRow('Potongan retur', `-${rupiah(t.ret)}`, { c: 'red.7' })}
                {t.credit > 0 && lineRow('Alokasi kredit vendor', `-${rupiah(t.credit)}`, { c: 'red.7' })}
                {lineRow('Dibayar ke vendor', rupiah(t.total), { fw: 700 })}
                {inv.vendorTotal > 0 && Math.abs(inv.vendorTotal - t.total) > 1 && lineRow('Total di invoice vendor', rupiah(inv.vendorTotal), { c: 'orange.8' })}
                {lineRow('Sudah dibayar', rupiah(t.paid), { c: 'green.8' })}
              </Stack>
              <Group
                justify="space-between"
                px="lg"
                py="md"
                bg={cancelled ? 'slate.0' : t.balance ? 'primary.0' : 'green.0'}
                style={{ borderTop: '1px solid var(--mantine-color-gray-2)', borderRadius: '0 0 var(--mantine-radius-lg) var(--mantine-radius-lg)' }}
              >
                <Text fz="sm" fw={600} c={cancelled ? 'slate.6' : t.balance ? 'primary.9' : 'green.9'}>Sisa hutang</Text>
                <Text fz="lg" fw={700} c={cancelled ? 'slate.6' : t.balance ? 'primary.9' : 'green.9'}>
                  {cancelled ? 'Dibatalkan' : rupiah(t.balance)}
                </Text>
              </Group>
            </Card>
            <JournalCard
              lines={inv.cancelled ? [] : invoiceJournal(inv, pb, { stockMoves, products })}
              description={`Atas ${inv.number}`}
              onDetail={() => go({ name: 'journal', kind: 'invoice', id: inv.id })}
              empty={inv.cancelledAt
                ? `Faktur dibatalkan — jurnalnya dibalik pada ${formatDate(inv.cancelledAt)}.`
                : 'Faktur dibatalkan — jurnal dan pembaliknya tidak dibukukan.'}
            />
            <PurchaseFlow pb={pb} go={go} current={{ kind: 'invoice', id: inv.id }} />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
