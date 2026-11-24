// Detail Payment Voucher (PV / Bukti Kas Keluar): bukti kas benar-benar keluar, dasar jurnal kas keluar.
import { Badge, Box, Button, Card, Grid, Group, SimpleGrid, Stack, Table, Text, ThemeIcon, Title } from '@mantine/core';
import { CurrencyCircleDollar, Info, Paperclip, Receipt } from '@/components/Icon.jsx';
import AttachmentList from './Attachments.jsx';
import { BackLink, CardHead, CopyIcon, DataTable, DocNumber, Section } from './components.jsx';
import PurchaseFlow from './PurchaseFlow.jsx';
import { bankLine, formatDate, PR_STATUS, proofFiles, PV_STATUS, pvPaid, pvStatus, rupiah } from './utils.js';
import { voucherJournal } from './journal.js';
import JournalCard from './JournalCard.jsx';
import { canCreate } from './permissions.js';
import { StatusPill } from './components.jsx';

export default function VoucherDetail({ voucher: v, pb, onBack, go, openDialog }) {
  const role = pb.role;
  const st = pvStatus(v);
  const paid = pvPaid(v);
  const jurnal = voucherJournal(v, pb);
  const vendor = pb.vendorsById[v.vendorId];
  const prs = (v.prIds ?? []).map((id) => pb.prsById[id]).filter(Boolean);
  const proofs = proofFiles(v);
  const count = (n, unit) => <Badge size="sm" radius="sm" variant="light" color="slate" tt="none">{n} {unit}</Badge>;

  const cells = [
    ['Dibayarkan kepada', vendor?.name],
    ['Rekening tujuan', bankLine(vendor)],
    ['Dibayar dari', v.source || '—'],
    ['Tanggal PV', formatDate(v.date)],
    ['Tanggal bayar', v.paidAt ? formatDate(v.paidAt) : 'Belum dibayar'],
    ['No. referensi transfer', v.payRef || '—'],
    ['Dibayar oleh', v.paidBy || '—'],
  ];

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" className="pb-form">
      <BackLink label="Kembali ke daftar pembayaran" onClick={onBack} />

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" align="center" gap="md">
          <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
            <ThemeIcon size={52} radius="md" color="primary.9"><CurrencyCircleDollar size={26} /></ThemeIcon>
            <Box style={{ minWidth: 0 }}>
              <Group gap="xs" wrap="wrap">
                <Title order={2} fz={{ base: 20, md: 24 }} c="slate.9">{v.number}</Title>
                <CopyIcon value={v.number} size={16} />
                <StatusPill map={PV_STATUS} status={st} />
              </Group>
              {/* Cukup tanggal PV-nya; vendor dan PR-nya ada di kartu informasi dan tabel di bawah. */}
              <Text fz="sm" c="slate.6">{formatDate(v.date)}</Text>
            </Box>
          </Group>
          <Group gap="md" wrap="nowrap">
            {!paid && canCreate(role, 'pv') && (
              <Button radius="md" onClick={() => openDialog({ type: 'pay', voucherId: v.id })}>Catat pembayaran</Button>
            )}
          </Group>
        </Group>
      </Card>

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8.5 }}>
          <Stack gap="lg">
            <Card withBorder radius="lg" padding={0} bg="white">
              <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                <CardHead icon={Info} desc="Sumber dana, tujuan, dan referensi transfer">Informasi pembayaran</CardHead>
              </Box>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={0}>
                {cells.map(([k, val], i) => (
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
                    <Text fz="sm" fw={700} c="slate.9" lh={1.35} component="div" style={{ overflowWrap: 'anywhere' }}>{val}</Text>
                  </Box>
                ))}
              </SimpleGrid>
              {v.note && (
                <Box px="lg" py="md" bg="slate.0" style={{ borderTop: '1px solid var(--mantine-color-gray-2)', borderRadius: '0 0 var(--mantine-radius-lg) var(--mantine-radius-lg)' }}>
                  <Text fz={11} fw={600} c="slate.6" mb={2}>Catatan</Text>
                  <Text fz="sm" c="slate.8" style={{ whiteSpace: 'pre-wrap' }}>{v.note}</Text>
                </Box>
              )}
            </Card>

            <Section divided flush icon={Receipt} title="Payment Request yang dibayar" description="Permintaan pembayaran yang ditutup oleh bukti ini" right={count(prs.length, 'dokumen')}>
              {prs.length === 0 ? (
                <Text fz="xs" c="slate.6" p="lg">Tidak ada Payment Request yang ditautkan.</Text>
              ) : (
                <DataTable bare head={[{ label: 'Nomor' }, { label: 'Jenis' }, { label: 'Status' }, { label: 'Nominal', align: 'right' }]} minWidth={560}>
                  {prs.map((p) => (
                    <Table.Tr key={p.id}>
                      <Table.Td><DocNumber onClick={() => go({ name: 'pr', id: p.id })}>{p.number}</DocNumber></Table.Td>
                      <Table.Td fz="sm">{p.kind === 'dp' ? 'Di muka' : 'Pelunasan'}</Table.Td>
                      <Table.Td><StatusPill map={PR_STATUS} status={p.status} size="xs" approval={{ doc: p, kind: 'pr' }} /></Table.Td>
                      <Table.Td ta="right" fz="sm" fw={700}>{rupiah(p.amount)}</Table.Td>
                    </Table.Tr>
                  ))}
                </DataTable>
              )}
            </Section>

            {proofs.length > 0 && (
              <Section divided flush icon={Paperclip} title="Bukti transfer" description="Lampiran yang diunggah saat pembayaran" right={count(proofs.length, 'berkas')}>
                <Box p="lg"><AttachmentList names={proofs} label="Bukti transfer" /></Box>
              </Section>
            )}
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 3.5 }}>
          <Stack gap="lg">
            {/* Judulnya memakai Section seperti kartu lain di halaman ini — CardHead
                mencetak judul 11px huruf besar, jadi kartu ini dulu terlihat lain sendiri.
                "Debit" dan "Kredit" ditulis utuh: singkatan Dr/Cr hanya terbaca oleh yang
                sudah terbiasa jurnal. */}
            <JournalCard
              lines={jurnal}
              description={`Atas ${v.number}`}
              onDetail={() => go({ name: 'journal', kind: 'pv', id: v.id })}
              empty="Jurnal kas keluar terbentuk saat pembayaran PV ini dicatat."
            />
            <PurchaseFlow pb={pb} go={go} current={{ kind: 'voucher', id: v.id }} />
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
