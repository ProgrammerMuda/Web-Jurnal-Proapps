// Rincian piutang satu pelanggan: total, kredit, umur, faktur terbuka, pesanan yang akan
// ditagih, dan pembayaran terakhir. Dibuka dari halaman Piutang Usaha.
import { Anchor, Badge, Box, Button, Divider, Drawer, Group, Progress, Stack, Table, Text } from '@mantine/core';
import { Receipt, User } from '@/components/Icon.jsx';
import { Legend } from '@/components/overview.jsx';
import { DocNumber, RowMenu } from '@/pages/Pembelian/components.jsx';
import { allPayments, cashReceived } from './payments.js';
import { BUCKETS } from './receivables.js';
import { formatDate, rupiah, rupiahShort } from './utils.js';

const tabular = { fontVariantNumeric: 'tabular-nums' };

export function AgeBadge({ late }) {
  if (late > 0)
    return (
      <Badge size="sm" radius="xl" variant="light" color="red" tt="none" fw={600}>
        Terlambat {late} hari
      </Badge>
    );
  if (late === 0)
    return (
      <Badge size="sm" radius="xl" variant="light" color="orange" tt="none" fw={600}>
        Jatuh tempo hari ini
      </Badge>
    );
  return (
    <Text fz="xs" c="slate.6" style={{ whiteSpace: 'nowrap' }}>
      {-late} hari lagi
    </Text>
  );
}

function Figure({ label, value, hint }) {
  return (
    <Box>
      <Text fz={11} c="slate.6">{label}</Text>
      <Text fz="lg" fw={700} c="slate.9" style={tabular}>{value}</Text>
      {hint && <Text fz={11} c="slate.5">{hint}</Text>}
    </Box>
  );
}

export default function CustomerReceivableDrawer({
  customer,
  group,
  sales,
  upcoming,
  onClose,
  onOpenContact,
  onOpenOrders,
  onOpenPayments,
  invoiceActions,
}) {
  const opened = !!group;
  const payments = group
    ? allPayments(sales.filter((s) => s.customerId === group.customerId))
        .filter((p) => !p.cancelledAt)
        .slice(0, 5)
    : [];

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={620}
      padding="lg"
      title={
        <Group gap="sm" wrap="nowrap">
          <User size={18} />
          <Text fw={700} c="slate.9">{customer?.name ?? 'Pelanggan'}</Text>
        </Group>
      }
    >
      {group && (
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start">
            <Group gap="xl">
              <Figure label="Sisa piutang" value={rupiah(group.total)} hint={`${group.count} faktur terbuka`} />
              <Figure
                label="Kredit tersedia"
                value={group.credit ? rupiah(group.credit) : '–'}
                hint={group.credit ? 'Bisa dipakai saat terima pembayaran' : 'Tidak ada'}
              />
            </Group>
            <Button variant="default" size="compact-sm" radius="xl" onClick={onOpenContact}>
              Buka kontak
            </Button>
          </Group>

          <Box>
            <Progress.Root size={8} radius="xl" bg="gray.1">
              {BUCKETS.map(
                (b) =>
                  group.buckets[b.key] > 0 && (
                    <Progress.Section key={b.key} value={(group.buckets[b.key] / group.total) * 100} color={b.color} />
                  ),
              )}
            </Progress.Root>
            <Box mt="sm">
              <Legend
                items={BUCKETS.map((b) => ({
                  key: b.key,
                  label: b.label,
                  color: b.color,
                  value: group.buckets[b.key] ? rupiahShort(group.buckets[b.key]) : '–',
                  muted: !group.buckets[b.key],
                }))}
              />
            </Box>
          </Box>

          <Divider color="gray.2" />

          <Box>
            <Text fw={700} fz="sm" c="slate.9" mb="xs">Faktur belum lunas</Text>
            <Box style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }}>
              <Table verticalSpacing="xs" horizontalSpacing="sm" fz="xs">
                <Table.Thead bg="slate.0">
                  <Table.Tr>
                    <Table.Th>No. Faktur</Table.Th>
                    <Table.Th>Jatuh tempo</Table.Th>
                    <Table.Th ta="right">Sisa</Table.Th>
                    <Table.Th w={40} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {[...group.rows]
                    .sort((a, b) => b.late - a.late)
                    .map((r) => (
                      <Table.Tr key={r.id}>
                        <Table.Td>
                          <DocNumber onClick={() => invoiceActions.open(r.sale)}>{r.sale.number}</DocNumber>
                          <Box mt={2}><AgeBadge late={r.late} /></Box>
                        </Table.Td>
                        <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDate(r.sale.dueDate)}</Table.Td>
                        <Table.Td ta="right" fw={600} style={{ whiteSpace: 'nowrap', ...tabular }}>{rupiah(r.balance)}</Table.Td>
                        <Table.Td>
                          <RowMenu label={r.sale.number} items={invoiceActions.items(r)} />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                </Table.Tbody>
              </Table>
            </Box>
          </Box>

          {upcoming.count > 0 && (
            <Group justify="space-between" p="sm" style={{ background: 'var(--mantine-color-gray-0)', borderRadius: 'var(--mantine-radius-md)' }}>
              <Box>
                <Text fz="xs" fw={600} c="slate.8">
                  Pesanan belum difakturkan: {upcoming.count} · {rupiah(upcoming.value)}
                </Text>
                <Text fz={11} c="slate.6">Tagihan yang akan datang, belum masuk piutang.</Text>
              </Box>
              <Anchor fz="xs" c="primary.9" onClick={onOpenOrders}>Lihat pesanan</Anchor>
            </Group>
          )}

          <Box>
            <Group justify="space-between" mb="xs">
              <Text fw={700} fz="sm" c="slate.9">Pembayaran terakhir</Text>
              <Anchor fz="xs" c="primary.9" onClick={onOpenPayments}>Pembayaran masuk</Anchor>
            </Group>
            {payments.length === 0 ? (
              <Group gap="sm" p="sm" style={{ background: 'var(--mantine-color-gray-0)', borderRadius: 'var(--mantine-radius-md)' }}>
                <Receipt size={16} color="var(--mantine-color-slate-5)" />
                <Text fz="xs" c="slate.6">Belum ada pembayaran dari pelanggan ini.</Text>
              </Group>
            ) : (
              <Stack gap={0}>
                {payments.map((p, i) => (
                  <Group key={p.key} justify="space-between" py={8} style={{ borderTop: i ? '1px solid var(--mantine-color-gray-1)' : undefined }}>
                    <Box>
                      <Text fz="xs" fw={600} c="slate.9">{formatDate(p.date)} · {p.fromCredit ? 'Pemakaian kredit' : p.method}</Text>
                      <Text fz={11} c="slate.6">{p.saleNumber}</Text>
                    </Box>
                    <Text fz="xs" fw={600} c="slate.9" style={tabular}>{rupiah(p.fromCredit ? p.amount : cashReceived(p))}</Text>
                  </Group>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      )}
    </Drawer>
  );
}
