// Detail Payment Request: dasar pembayaran, approval, dan bukti transfer.
import { Badge, Box, Button, Card, Grid, Group, SimpleGrid, Stack, Table, Text, ThemeIcon, Title } from '@mantine/core';
import { Calculator, Check, Info, Money, Paperclip, Receipt, X } from '@/components/Icon.jsx';
import AttachmentList from './Attachments.jsx';
import { BackLink, Callout, CardHead, CopyIcon, DataTable, DocNumber, RoleChip, Section, StatusPill } from './components.jsx';
import PurchaseFlow from './PurchaseFlow.jsx';
import { TODAY } from './data.js';
import { advancePct, bankLine, formatDate, INV_STATUS, invStatus, invTotals, poDpAmount, poDocLabel, poTotal, PR_STATUS, proofFiles, rupiah, termText } from './utils.js';
import { approvalState, canCreate, isApproverTurn, prBlockedBySoD, roleLabel, signApproval } from './permissions.js';
import { toast } from './usePb.js';

export default function PrDetail({ pr, pb, onBack, go, openDialog }) {
  const role = pb.role;
  const vendor = pb.vendorsById[pr.vendorId];
  // Satu PR bisa menerbitkan beberapa PV bila fakturnya dari vendor berbeda.
  const vouchers = pb.vouchers.filter((v) => v.prIds?.includes(pr.id));
  const po = pb.posById[pr.poId];
  const isDp = pr.kind === 'dp';
  const invoices = (pr.invoiceIds ?? []).map((id) => pb.invoicesById[id]).filter(Boolean);
  // Payment Voucher terbit saat Finance membayar; bukti transfernya menempel di sana.
  const voucher = pb.voucherOfPr(pr.id);
  const proofs = proofFiles(voucher ?? pr);
  // Approval PR berjenjang dua: Chief Finance lalu Building Manager.
  const ap = approvalState(pr, 'pr', { settled: pr.status !== 'diajukan' && pr.status !== 'ditolak' });
  const count = (n, unit) => <Badge size="sm" radius="sm" variant="light" color="slate" tt="none">{n} {unit}</Badge>;

  const cells = [
    ['Vendor', vendor?.name],
    ['Jenis pembayaran', isDp ? `Di muka · ${termText(po?.term)}` : 'Pelunasan faktur'],
    ['Tanggal pengajuan', formatDate(pr.date)],
    [po ? poDocLabel(po) : 'Pesanan', po ? <DocNumber onClick={() => go({ name: 'po', id: po.id })}>{po.number}</DocNumber> : '—'],
    ['Rekening tujuan', bankLine(vendor)],
    ['Tanggal bayar', pr.paidAt ? formatDate(pr.paidAt) : 'Belum dibayar'],
    ...ap.chain.map((r) => [`Approval ${roleLabel(r)}`, ap.got[r] ? `${ap.got[r].by}${ap.got[r].at ? ` · ${formatDate(ap.got[r].at)}` : ''}` : 'Menunggu']),
    ['Payment Voucher', vouchers.length
      ? <Group key="pv" gap={6} wrap="wrap">{vouchers.map((v) => <DocNumber key={v.id} onClick={() => go({ name: 'voucher', id: v.id })}>{v.number}</DocNumber>)}</Group>
      : 'Belum terbit'],
  ];

  const lineRow = (label, value, extra) => (
    <Group justify="space-between" wrap="nowrap" align="flex-start" gap="md">
      <Text fz="xs" c="slate.7">{label}</Text>
      <Text fz="xs" fw={600} ta="right" {...extra}>{value}</Text>
    </Group>
  );

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" className="pb-form">
      <BackLink label="Kembali ke daftar pembayaran" onClick={onBack} />

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" align="center" gap="md">
          <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
            <ThemeIcon size={52} radius="md" color="primary.9"><Money size={26} /></ThemeIcon>
            <Box style={{ minWidth: 0 }}>
              <Group gap="xs" wrap="wrap">
                <Title order={2} fz={{ base: 20, md: 24 }} c="slate.9">{pr.number}</Title>
                <CopyIcon value={pr.number} size={16} />
                <StatusPill map={PR_STATUS} status={pr.status} />
                <Badge size="sm" radius="sm" variant="light" color="gray" c="slate.6" fw={700} tt="none">{isDp ? 'Di muka' : 'Pelunasan'}</Badge>
              </Group>
              {/* Cukup tanggal pengajuannya; vendor dan pesanannya ada di kartu informasi. */}
              <Text fz="sm" c="slate.6">{formatDate(pr.date)}</Text>
            </Box>
          </Group>
          <Group gap="xs">
            {pr.status === 'diajukan' && (isApproverTurn(role, pr, 'pr') && !prBlockedBySoD(role, pr) ? (
              <>
                <Button radius="md" variant="default" color="red" leftSection={<X size={16} />} onClick={() => openDialog({ type: 'pr-reject', prId: pr.id })}>Tolak</Button>
                <Button
                  radius="md"
                  leftSection={<Check size={16} />}
                  onClick={() => {
                    pb.update('prs', pr.id, (d) => {
                      const { doc, complete } = signApproval(d, 'pr', role);
                      return complete ? { ...doc, status: 'disetujui', approvedAt: TODAY } : doc;
                    });
                    toast(ap.done.length + 1 >= ap.total ? 'Payment Request disetujui penuh.' : `Approval ${ap.done.length + 1} dari ${ap.total} dicatat.`);
                  }}
                >
                  Setujui{ap.total > 1 ? ` (${ap.done.length + 1}/${ap.total})` : ''}
                </Button>
              </>
            ) : <Group gap={6}><Text fz="xs" c="slate.7">Menunggu</Text><RoleChip role={ap.next ?? 'cfo'} /></Group>)}
            {pr.status === 'disetujui' && (canCreate(role, 'pv') ? (
              <Button radius="md" onClick={() => openDialog({ type: 'pv', prId: pr.id })}>Terbitkan Payment Voucher</Button>
            ) : <Group gap={6}><Text fz="xs" c="slate.7">Pembayaran oleh</Text><RoleChip role="kasir" /></Group>)}
          </Group>
        </Group>
      </Card>

      {pr.status === 'diproses' && pb.voucherOfPr(pr.id) && (
        <Callout title="Payment Voucher sudah terbit">
          Perintah bayar <DocNumber onClick={() => go({ name: 'voucher', id: pb.voucherOfPr(pr.id).id })}>{pb.voucherOfPr(pr.id).number}</DocNumber> menunggu
          pembayaran. Kas belum berkurang sampai transfernya dicatat di PV itu.
        </Callout>
      )}
      {pr.status === 'ditolak' && (
        <Callout tone="stop" title="Payment Request ditolak">{pr.note || 'Tanpa catatan.'}</Callout>
      )}

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8.5 }}>
          <Stack gap="lg">
            <Card withBorder radius="lg" padding={0} bg="white">
              <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                <CardHead icon={Info} desc="Vendor, jenis, dan rekening tujuan">Informasi pembayaran</CardHead>
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
              {pr.note && pr.status !== 'ditolak' && (
                <Box px="lg" py="md" bg="slate.0" style={{ borderTop: '1px solid var(--mantine-color-gray-2)', borderRadius: '0 0 var(--mantine-radius-lg) var(--mantine-radius-lg)' }}>
                  <Text fz={11} fw={600} c="slate.6" mb={2}>Catatan</Text>
                  <Text fz="sm" c="slate.8" style={{ whiteSpace: 'pre-wrap' }}>{pr.note}</Text>
                </Box>
              )}
            </Card>

            {isDp ? (
              <Section divided flush icon={Receipt} title="Dasar pembayaran" description="Nilai yang ditagih di muka, dihitung dari nilai pesanan">
                {po ? (
                  <Stack gap={6} p="lg">
                    {lineRow(`Total ${poDocLabel(po)}`, rupiah(poTotal(po)))}
                    {lineRow(advancePct(po.term) >= 100 ? 'Bayar penuh di muka' : `Uang muka ${advancePct(po.term)}%`, rupiah(poDpAmount(po)))}
                    {lineRow('Termin', termText(po.term))}
                    {poDpAmount(po) !== pr.amount && lineRow('Diajukan pada PR ini', rupiah(pr.amount), { c: 'orange.8' })}
                  </Stack>
                ) : (
                  <Text fz="xs" c="slate.6" p="lg">Pesanan asalnya tidak ditemukan.</Text>
                )}
              </Section>
            ) : (
              <Section divided flush icon={Receipt} title="Faktur yang dilunasi" description="Tagihan vendor yang dibayar lewat PR ini" right={count(invoices.length, 'faktur')}>
                {invoices.length === 0 ? (
                  <Text fz="xs" c="slate.6" p="lg">Tidak ada faktur yang ditunjuk.</Text>
                ) : (
                  <DataTable bare head={[{ label: 'Nomor' }, { label: 'Jatuh tempo' }, { label: 'Status' }, { label: 'Dialokasikan', align: 'right' }, { label: 'Sisa hutang', align: 'right' }]} minWidth={640}>
                    {invoices.map((i) => {
                      const t = invTotals(i, pb.calc);
                      return (
                        <Table.Tr key={i.id}>
                          <Table.Td><DocNumber onClick={() => go({ name: 'invoice', id: i.id })}>{i.number}</DocNumber><Text fz={11} c="slate.6">{i.vendorNo}</Text></Table.Td>
                          <Table.Td fz="sm" style={{ whiteSpace: 'nowrap' }}>{formatDate(i.dueDate)}</Table.Td>
                          <Table.Td><StatusPill map={INV_STATUS} status={invStatus(i, t)} size="xs" /></Table.Td>
                          <Table.Td ta="right" fz="sm" fw={700}>{rupiah(pr.alloc?.[i.id] ?? (invoices.length === 1 ? pr.amount : 0))}</Table.Td>
                          <Table.Td ta="right" fz="sm">{rupiah(t.balance)}</Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </DataTable>
                )}
              </Section>
            )}

            {proofs.length > 0 && (
              <Section divided flush icon={Paperclip} title="Bukti transfer" description="Berkas yang diunggah saat pembayaran dicatat" right={count(proofs.length, 'berkas')}>
                <Box p="lg"><AttachmentList names={proofs} label="Bukti transfer" /></Box>
              </Section>
            )}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 3.5 }}>
          <Stack gap="lg">
            <Card withBorder radius="lg" padding={0} bg="white">
              <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                <CardHead icon={Calculator} desc="Nilai yang diajukan ke vendor">Ringkasan</CardHead>
              </Box>
              <Stack gap={6} p="lg">
                {lineRow('Jenis', isDp ? 'Di muka' : 'Pelunasan')}
                {lineRow('Status', PR_STATUS[pr.status]?.label ?? pr.status)}
                {lineRow('Rekening tujuan', bankLine(vendor))}
              </Stack>
              <Group
                justify="space-between"
                px="lg"
                py="md"
                bg={pr.status === 'dibayar' ? 'green.0' : 'primary.0'}
                style={{ borderTop: '1px solid var(--mantine-color-gray-2)', borderRadius: '0 0 var(--mantine-radius-lg) var(--mantine-radius-lg)' }}
              >
                <Text fz="sm" fw={600} c={pr.status === 'dibayar' ? 'green.9' : 'primary.9'}>
                  {pr.status === 'dibayar' ? 'Dibayar' : 'Nominal diajukan'}
                </Text>
                <Text fz="lg" fw={700} c={pr.status === 'dibayar' ? 'green.9' : 'primary.9'}>{rupiah(pr.amount)}</Text>
              </Group>
            </Card>
            <PurchaseFlow pb={pb} go={go} current={{ kind: 'pr', id: pr.id }} />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
