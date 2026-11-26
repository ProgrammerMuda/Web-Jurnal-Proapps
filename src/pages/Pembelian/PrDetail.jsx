// Detail Payment Request: dasar pembayaran, approval, dan bukti transfer.
import { approvalMessage, askConfirm } from './confirm.jsx';
import { Badge, Box, Button, Card, Grid, Group, SimpleGrid, Stack, Table, Text, ThemeIcon, Title } from '@mantine/core';
import { Calculator, Check, CurrencyCircleDollar, Info, Money, Paperclip, Receipt, X } from '@/components/Icon.jsx';
import AttachmentList from './Attachments.jsx';
import { BackLink, Callout, CardHead, CopyIcon, DataTable, DocNumber, RoleChip, Section, StatusPill } from './components.jsx';
import PurchaseFlow from './PurchaseFlow.jsx';
import { TODAY } from './data.js';
import { advancePct, bankLine, formatDate, INV_STATUS, invStatus, invTotals, poDpAmount, poDocLabel, poTotal, PR_STATUS, proofFiles, pvPaid, pvStatus, PV_STATUS, rupiah, termText } from './utils.js';
import { approvalState, canCreate, isApproverTurn, prBlockedBySoD, signApproval } from './permissions.js';
import ApprovalLog, { chainSteps, legacyLog } from './ApprovalLog.jsx';
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
  // Bukti transfer dari semua PV-nya (PR multi-vendor = beberapa transfer).
  const proofs = vouchers.length ? vouchers.flatMap((v) => proofFiles(v)) : proofFiles(voucher ?? pr);
  // Approval PR berjenjang dua: Chief Finance lalu Building Manager.
  const ap = approvalState(pr, 'pr', { settled: pr.status !== 'diajukan' && pr.status !== 'ditolak' });
  // Satu PR boleh melunasi faktur dari beberapa vendor; tiap vendor = satu transfer (satu PV)
  // ke rekeningnya sendiri. Kelompokkan per vendor supaya rekening dan nominalnya tidak hilang.
  const payees = isDp || invoices.length === 0
    ? [{ vendor, amount: pr.amount, invoices }]
    : Object.values(invoices.reduce((acc, i) => {
      const g = (acc[i.vendorId] ??= { vendor: pb.vendorsById[i.vendorId], amount: 0, invoices: [] });
      g.amount += pr.alloc?.[i.id] ?? (invoices.length === 1 ? pr.amount : 0);
      g.invoices.push(i);
      return acc;
    }, {}));
  const multi = payees.length > 1;
  const poList = [...new Map(invoices.map((i) => pb.posById[i.poId]).filter(Boolean).map((p) => [p.id, p])).values()];
  const count = (n, unit) => <Badge size="sm" radius="sm" variant="light" color="slate" tt="none">{n} {unit}</Badge>;

  const cells = [
    ['Vendor', multi ? `${payees.length} vendor: ${payees.map((g) => g.vendor?.name).join(', ')}` : vendor?.name],
    ['Jenis pembayaran', isDp ? `Di muka · ${termText(po?.term)}` : 'Pelunasan faktur'],
    ['Tanggal pengajuan', formatDate(pr.date)],
    poList.length > 1
      ? ['Pesanan', <Group key="po" gap={6} wrap="wrap">{poList.map((p) => <DocNumber key={p.id} onClick={() => go({ name: 'po', id: p.id })}>{p.number}</DocNumber>)}</Group>]
      : [po ? poDocLabel(po) : 'Pesanan', po ? <DocNumber onClick={() => go({ name: 'po', id: po.id })}>{po.number}</DocNumber> : '—'],
    ['Rekening tujuan', multi
      ? <Stack key="rek" gap={2}>{payees.map((g) => <Text key={g.vendor?.id} fz="sm" fw={700} c="slate.9">{bankLine(g.vendor)}</Text>)}</Stack>
      : bankLine(vendor)],
    ['Tanggal bayar', pr.paidAt ? formatDate(pr.paidAt) : 'Belum dibayar'],
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
                <StatusPill map={PR_STATUS} status={pr.status} approval={{ doc: pr, kind: 'pr' }} />
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
                  onClick={() => askConfirm({
                    title: `Setujui ${pr.number}?`,
                    message: approvalMessage(ap, { final: 'Ini approval terakhir: Payment Request disetujui penuh dan siap diterbitkan Payment Voucher.' }),
                    confirmLabel: 'Ya, setujui',
                    onConfirm: () => {
                      pb.update('prs', pr.id, (d) => {
                        const { doc, complete } = signApproval(d, 'pr', role);
                        return complete ? { ...doc, status: 'disetujui', approvedAt: TODAY } : doc;
                      });
                      toast(ap.done.length + 1 >= ap.total ? 'Payment Request disetujui penuh.' : `Approval ${ap.done.length + 1} dari ${ap.total} dicatat.`);
                    },
                  })}
                >
                  Setujui{ap.total > 1 ? ` (${ap.done.length + 1}/${ap.total})` : ''}
                </Button>
              </>
            ) : <Group gap={6}><Text fz="xs" c="slate.7">Menunggu</Text><RoleChip role={ap.next ?? 'cfo'} /></Group>)}
            {pr.status === 'disetujui' && (canCreate(role, 'pv') ? (
              <Button radius="md" leftSection={<CurrencyCircleDollar size={16} />} onClick={() => openDialog({ type: 'pv', prId: pr.id })}>Terbitkan Payment Voucher</Button>
            ) : <Group gap={6}><Text fz="xs" c="slate.7">PV diterbitkan oleh</Text><RoleChip role="kasir" /></Group>)}
          </Group>
        </Group>
      </Card>

      {pr.status === 'diproses' && vouchers.length > 0 && (() => {
        const belum = vouchers.filter((x) => !pvPaid(x));
        return (
          <Callout title={vouchers.length > 1 ? `${vouchers.length} Payment Voucher terbit · ${vouchers.length - belum.length} sudah dibayar` : 'Payment Voucher sudah terbit'}>
            {belum.length > 1 ? 'Menunggu pembayaran: ' : 'Perintah bayar '}
            {belum.map((x, i) => (
              <span key={x.id}>{i > 0 && ', '}<DocNumber onClick={() => go({ name: 'voucher', id: x.id })}>{x.number}</DocNumber>{vouchers.length > 1 && ` (${pb.vendorsById[x.vendorId]?.name})`}</span>
            ))}
            {belum.length === 1 && vouchers.length === 1 ? ' menunggu pembayaran.' : '.'} Kas belum berkurang sampai transfernya dicatat di PV.
          </Callout>
        );
      })()}
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
                  <DataTable bare head={[{ label: 'Nomor' }, ...(multi ? [{ label: 'Vendor' }] : []), { label: 'Jatuh tempo' }, { label: 'Status' }, { label: 'Dialokasikan', align: 'right' }, { label: 'Sisa hutang', align: 'right' }]} minWidth={640}>
                    {invoices.map((i) => {
                      const t = invTotals(i, pb.calc);
                      return (
                        <Table.Tr key={i.id}>
                          <Table.Td><DocNumber onClick={() => go({ name: 'invoice', id: i.id })}>{i.number}</DocNumber><Text fz={11} c="slate.6">{i.vendorNo}</Text></Table.Td>
                          {multi && <Table.Td fz="sm">{pb.vendorsById[i.vendorId]?.name}</Table.Td>}
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

            {/* Perintah bayar yang terbit dari PR ini: satu per vendor, masing-masing dengan
                rekening sumber, status transfer, dan nominalnya. */}
            <Section
              divided
              flush
              icon={CurrencyCircleDollar}
              title="Payment Voucher"
              description={vouchers.length > 1 ? 'Satu PV per vendor, masing-masing satu transfer' : 'Perintah bayar yang terbit dari PR ini'}
              right={vouchers.length ? count(vouchers.length, 'PV') : undefined}
            >
              {vouchers.length === 0 ? (
                <Text fz="xs" c="slate.6" p="lg">
                  {pr.status === 'disetujui' ? 'Belum terbit. Finance menerbitkan PV dari PR yang sudah disetujui ini.' : 'Belum terbit. PV terbit setelah PR disetujui.'}
                </Text>
              ) : (
                <DataTable bare head={[{ label: 'Nomor' }, { label: 'Vendor' }, { label: 'Dibayar dari' }, { label: 'Status' }, { label: 'Nominal', align: 'right' }]} minWidth={720}>
                  {vouchers.map((v) => (
                    <Table.Tr key={v.id}>
                      <Table.Td>
                        <DocNumber onClick={() => go({ name: 'voucher', id: v.id })}>{v.number}</DocNumber>
                        <Text fz={11} c="slate.6">{pvPaid(v) && v.paidAt ? `Dibayar ${formatDate(v.paidAt)}` : `Terbit ${formatDate(v.date)}`}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm">{pb.vendorsById[v.vendorId]?.name ?? '—'}</Text>
                        <Text fz={11} c="slate.6">{bankLine(pb.vendorsById[v.vendorId])}</Text>
                      </Table.Td>
                      <Table.Td fz="sm">{v.source || '—'}</Table.Td>
                      <Table.Td><StatusPill map={PV_STATUS} status={pvStatus(v)} size="xs" /></Table.Td>
                      <Table.Td ta="right" fz="sm" fw={700}>{rupiah(v.amount)}</Table.Td>
                    </Table.Tr>
                  ))}
                </DataTable>
              )}
            </Section>

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
                {multi && lineRow('Transfer', `${payees.length} transfer · ${payees.length} PV`)}
                {!multi && lineRow('Rekening tujuan', bankLine(vendor))}
              </Stack>
              {/* Lebih dari satu vendor: satu blok per transfer, berisi rekening dan nominalnya. */}
              {multi && (
                <Stack gap={0} style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                  {payees.map((g, idx) => (
                    <Box key={g.vendor?.id ?? idx} px="lg" py="sm" style={{ borderTop: idx ? '1px solid var(--mantine-color-gray-2)' : undefined }}>
                      <Group justify="space-between" wrap="nowrap" gap="md" align="flex-start">
                        <Text fz="xs" fw={700} c="slate.9">{g.vendor?.name ?? '—'}</Text>
                        <Text fz="xs" fw={700} c="slate.9" style={{ whiteSpace: 'nowrap' }}>{rupiah(g.amount)}</Text>
                      </Group>
                      <Text fz={11} c="slate.6">{bankLine(g.vendor)}</Text>
                      <Text fz={11} c="slate.5">{g.invoices.map((i) => i.number).join(', ')}</Text>
                    </Box>
                  ))}
                </Stack>
              )}
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
            <ApprovalLog
              steps={chainSteps(pr, 'pr', { settled: pr.status !== 'diajukan' && pr.status !== 'ditolak', rejected: pr.status === 'ditolak' })}
              log={legacyLog(pr)}
            />
            <PurchaseFlow pb={pb} go={go} current={{ kind: 'pr', id: pr.id }} />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
