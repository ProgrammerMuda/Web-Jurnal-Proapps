// Detail penerimaan: FPB (barang) atau BAST (jasa) yang dicatat dari sebuah PO.
import { Badge, Box, Button, Card, Grid, Group, SimpleGrid, Stack, Table, Text, ThemeIcon, Title } from '@mantine/core';
import { Check, Info, Package, Receipt, Truck } from '@/components/Icon.jsx';
import { BackLink, CardHead, CopyIcon, DataTable, DocNumber, RoleChip, Section } from './components.jsx';
import { canApprove, canCreate } from './permissions.js';
import PurchaseFlow from './PurchaseFlow.jsx';
import { personLabel } from './data.js';
import { toast } from './usePb.js';
import { formatDate, INV_STATUS, invStatus, invTotals, invoicedQty, RECEIPT_STATUS, receiptConfirmed, rupiah, uninvoicedLines } from './utils.js';
import { StatusPill } from './components.jsx';

const th = { th: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600, color: 'var(--mantine-color-slate-7)', whiteSpace: 'nowrap' } };

export default function ReceiptDetail({ receipt: r, pb, onBack, go, openDialog }) {
  const po = pb.posById[r.poId];
  const vendor = pb.vendorsById[r.vendorId];
  const isJasa = r.kind === 'jasa';
  const docName = isJasa ? 'BAST' : 'FPB';
  const itemOf = (id) => po?.items.find((i) => i.id === id);
  const confirmed = receiptConfirmed(r);
  const open = uninvoicedLines(r, pb.invoices).length > 0;
  // BAST jasa disetujui Atasan dulu (spesifikasi 2.2) sebelum Accounting bisa memfakturkan.
  const approveBast = () => {
    pb.update('receipts', r.id, (d) => ({ ...d, status: 'dikonfirmasi', approvedBy: personLabel(pb.role) }));
    toast('BAST disetujui. Sudah bisa difaktur.');
  };
  const invoices = pb.invoices.filter((i) => i.lines.some((l) => l.receiptId === r.id));
  const totalQty = r.lines.reduce((n, l) => n + l.qty, 0);
  const totalRejected = r.lines.reduce((n, l) => n + (l.rejected || 0), 0);
  const count = (n, unit) => <Badge size="sm" radius="sm" variant="light" color="slate" tt="none">{n} {unit}</Badge>;

  const cells = [
    ['Vendor', vendor?.name],
    ['Tanggal diterima', formatDate(r.date)],
    ['PO', po ? <DocNumber onClick={() => go({ name: 'po', id: po.id })}>{po.number}</DocNumber> : '—'],
    [isJasa ? 'No. BAST vendor' : 'Surat jalan', r.doNumber || '—'],
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
                {!confirmed
                  ? <StatusPill map={RECEIPT_STATUS} status={r.status} />
                  : <Badge size="sm" radius="sm" variant="light" color={open ? 'orange' : 'green'} fw={700} tt="none">{open ? 'Belum difaktur' : 'Sudah difaktur'}</Badge>}
                <Badge size="sm" radius="sm" variant="outline" color="slate" tt="none">{docName}</Badge>
              </Group>
              <Text fz="sm" c="slate.6">{vendor?.name}{po && <> · dari <DocNumber onClick={() => go({ name: 'po', id: po.id })}>{po.number}</DocNumber></>}</Text>
            </Box>
          </Group>
          <Group gap="xs">
            {!confirmed && (canApprove(pb.role, 'bast') ? (
              <Button radius="md" leftSection={<Check size={16} />} onClick={approveBast}>Setujui BAST</Button>
            ) : <Group gap={6}><Text fz="xs" c="slate.7">Menunggu</Text><RoleChip role="bm" /></Group>)}
            {confirmed && open && (canCreate(pb.role, 'invoice') ? (
              <Button radius="md" onClick={() => openDialog({ type: 'invoice', receiptIds: [r.id] })}>Buat faktur</Button>
            ) : <Group gap={6}><Text fz="xs" c="slate.7">Faktur oleh</Text><RoleChip role="accounting" /></Group>)}
          </Group>
        </Group>
      </Card>

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8.5 }}>
          <Stack gap="lg">
            <Card withBorder radius="lg" padding={0} bg="white">
              <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                <CardHead icon={Info} desc={`Vendor, PO, dan ${isJasa ? 'berita acara' : 'surat jalan'} penerimaan`}>Informasi {docName}</CardHead>
              </Box>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={0}>
                {cells.map(([k, v], i) => (
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
              {r.note && (
                <Box px="lg" py="md" bg="slate.0" style={{ borderTop: '1px solid var(--mantine-color-gray-2)', borderRadius: '0 0 var(--mantine-radius-lg) var(--mantine-radius-lg)' }}>
                  <Text fz={11} fw={600} c="slate.6" mb={2}>Catatan</Text>
                  <Text fz="sm" c="slate.8" style={{ whiteSpace: 'pre-wrap' }}>{r.note}</Text>
                </Box>
              )}
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
              <Stack gap={6} p="lg">
                <Group justify="space-between"><Text fz="xs" c="slate.7">Jumlah item</Text><Text fz="xs" fw={600}>{r.lines.length}</Text></Group>
                <Group justify="space-between"><Text fz="xs" c="slate.7">Total diterima</Text><Text fz="xs" fw={600}>{totalQty}</Text></Group>
                <Group justify="space-between"><Text fz="xs" c="slate.7">Ditolak</Text><Text fz="xs" fw={600} c={totalRejected ? 'red.7' : undefined}>{totalRejected}</Text></Group>
              </Stack>
            </Card>
            <PurchaseFlow pb={pb} go={go} current={{ kind: 'receipt', id: r.id }} />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
