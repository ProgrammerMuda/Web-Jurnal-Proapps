// Laporan Hutang: sisa hutang per vendor menurut umur jatuh tempo, plus rincian faktur.
import { ActionIcon, Badge, Button, Card, Group, Select, SimpleGrid, Table, Text } from '@mantine/core';
import { useState } from 'react';
import { ArrowsClockwise, ChartBar, DownloadSimple } from '@/components/Icon.jsx';
import { downloadCsv } from '@/pages/Kontak/utils.js';
import { BackLink, DataTable, DocNumber, PageIntro } from './components.jsx';
import { aging, daysLate } from './selectors.js';
import { formatDate, invTotals, rupiah, sum } from './utils.js';

const bucketOf = (d) => (d <= 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : d <= 90 ? 3 : 4);
const labels = ['Belum jatuh tempo', '1–30 hari', '31–60 hari', '61–90 hari', '> 90 hari'];

export default function LaporanHutang({ pb, onBack, go }) {
  const [vendorFilter, setVendorFilter] = useState(null);
  const rows = pb.invoices
    .filter((i) => !vendorFilter || i.vendorId === vendorFilter)
    .map((i) => ({ i, t: invTotals(i, pb.calc) }))
    .filter((x) => x.t.balance > 0)
    .map((x) => ({ ...x, late: daysLate(x.i.dueDate) }));
  const byVendor = Object.values(
    rows.reduce((acc, r) => {
      const v = (acc[r.i.vendorId] ??= { id: r.i.vendorId, buckets: [0, 0, 0, 0, 0] });
      v.buckets[bucketOf(r.late)] += r.t.balance;
      return acc;
    }, {}),
  );
  const buckets = aging(pb);
  const total = sum(rows, (r) => r.t.balance);
  const vname = (id) => pb.vendorsById[id]?.name ?? '—';

  const exportCsv = () =>
    downloadCsv('laporan-hutang.csv', [
      ['Faktur', 'Vendor', 'No. invoice vendor', 'Jatuh tempo', 'Terlambat (hari)', 'Sisa hutang'],
      ...rows.map((r) => [r.i.number, vname(r.i.vendorId), r.i.vendorNo, r.i.dueDate, Math.max(r.late, 0), r.t.balance]),
    ]);

  return (
    <>
      <BackLink label="Kembali ke Pembelian" onClick={onBack} />
      <PageIntro
        icon={ChartBar}
        title="Laporan Hutang per Vendor"
        description="Sisa hutang tiap vendor, dikelompokkan menurut umur jatuh tempo (per 4 Nov 2026)."
        actions={
          <>
            <ActionIcon variant="default" size="lg" radius="md" aria-label="Segarkan laporan"><ArrowsClockwise size={16} /></ActionIcon>
            <Button variant="default" radius="md" leftSection={<DownloadSimple size={16} />} onClick={exportCsv}>Ekspor Excel</Button>
          </>
        }
      />
      <Group gap="md">
        <Select size="sm" radius="md" w={260} clearable placeholder="Semua vendor" label="Vendor" data={pb.vendors.map((v) => ({ value: v.id, label: v.name }))} value={vendorFilter} onChange={setVendorFilter} />
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="md">
        <Card withBorder radius="md" padding="md" bg="white">
          <Text fz={11} fw={600} c="slate.6">Total hutang</Text>
          <Text fz={18} fw={700}>{rupiah(total)}</Text>
          <Text fz={11} c="slate.6">{rows.length} faktur</Text>
        </Card>
        {buckets.map((b) => (
          <Card key={b.key} withBorder radius="md" padding="md" bg="white">
            <Text fz={11} fw={600} c="slate.6">{b.label}</Text>
            <Text fz={18} fw={700}>{rupiah(b.value)}</Text>
          </Card>
        ))}
      </SimpleGrid>

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Text fw={700} fz="sm" mb="sm">Per vendor</Text>
        <DataTable head={[{ label: 'Vendor' }, ...labels.map((l) => ({ label: l, align: 'right' })), { label: 'Total', align: 'right' }]} minWidth={900}>
          {byVendor.map((v) => (
            <Table.Tr key={v.id}>
              <Table.Td fz="sm" fw={600}>{vname(v.id)}</Table.Td>
              {v.buckets.map((n, idx) => <Table.Td key={idx} ta="right" fz="sm" c={n ? (idx > 0 ? 'red.8' : undefined) : 'slate.4'}>{n ? rupiah(n) : '—'}</Table.Td>)}
              <Table.Td ta="right" fz="sm" fw={700}>{rupiah(sum(v.buckets, (n) => n))}</Table.Td>
            </Table.Tr>
          ))}
        </DataTable>
        {byVendor.length === 0 && <Text fz="xs" c="slate.6" ta="center" py="md">Tidak ada hutang berjalan.</Text>}
      </Card>

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Text fw={700} fz="sm" mb="sm">Rincian faktur</Text>
        <DataTable head={[{ label: 'Faktur' }, { label: 'Vendor' }, { label: 'Jatuh tempo' }, { label: 'Umur' }, { label: 'Sisa hutang', align: 'right' }]} minWidth={760}>
          {rows.sort((a, b) => b.late - a.late).map(({ i, t, late }) => (
            <Table.Tr key={i.id}>
              <Table.Td><DocNumber onClick={() => go({ name: 'po', id: i.poId })}>{i.number}</DocNumber><Text fz={11} c="slate.6">{i.vendorNo}</Text></Table.Td>
              <Table.Td fz="sm">{vname(i.vendorId)}</Table.Td>
              <Table.Td fz="sm">{formatDate(i.dueDate)}</Table.Td>
              <Table.Td><Badge size="xs" radius="sm" variant="light" color={late > 0 ? 'red' : 'green'} tt="none">{late > 0 ? `Terlambat ${late} hari` : 'Belum jatuh tempo'}</Badge></Table.Td>
              <Table.Td ta="right" fz="sm" fw={700}>{rupiah(t.balance)}</Table.Td>
            </Table.Tr>
          ))}
        </DataTable>
      </Card>
    </>
  );
}
