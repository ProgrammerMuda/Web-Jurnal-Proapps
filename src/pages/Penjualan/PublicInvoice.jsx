// Halaman faktur untuk pelanggan: inilah yang dibuka oleh "tautan faktur".
// Tanpa sidebar dan tanpa aksi internal — hanya isi faktur dan tombol unduh.
import { Box, Button, Card, Center, Divider, Group, Stack, Table, Text, Title } from '@mantine/core';
import { DownloadSimple, Invoice as InvoiceIcon } from '@/components/Icon.jsx';
import mark from '@/assets/mark.svg';
import { useData } from '@/lib/store.jsx';
import { StatusBadge } from './components.jsx';
import { paymentTerms, products } from './data.js';
import { downloadInvoice } from './invoicePdf.js';
import {
  badgeOf,
  computeTotals,
  formatDate,
  lineAmount,
  rupiah,
  taxLabel,
  useCustomer,
} from './utils.js';

const productName = (l) => products.find((p) => p.id === l.productId)?.name ?? l.description;

function Row({ label, value, strong, color }) {
  return (
    <Group justify="space-between" py={3} wrap="nowrap">
      <Text fz={strong ? 'sm' : 'xs'} fw={strong ? 700 : 400} c={strong ? 'primary.9' : 'slate.7'}>
        {label}
      </Text>
      <Text
        fz={strong ? 'md' : 'xs'}
        fw={strong ? 700 : 600}
        c={color ?? (strong ? 'primary.9' : 'slate.9')}
        style={{ whiteSpace: 'nowrap' }}
      >
        {value}
      </Text>
    </Group>
  );
}

function NotFound() {
  return (
    <Center mih="100vh" p="lg">
      <Card withBorder radius="lg" padding="xl" bg="white" maw={420}>
        <Stack align="center" gap={6}>
          <InvoiceIcon size={32} color="var(--mantine-color-slate-5)" />
          <Text fz="sm" fw={700} c="slate.9">
            Faktur tidak ditemukan
          </Text>
          <Text fz="xs" c="slate.6" ta="center">
            Tautan ini sudah tidak berlaku, atau fakturnya dibuat di perangkat lain. Minta tautan
            baru ke penerbit faktur.
          </Text>
        </Stack>
      </Card>
    </Center>
  );
}

export default function PublicInvoice({ id }) {
  const { sales } = useData();
  const sale = sales.find((s) => s.id === id);
  const customer = useCustomer(sale?.customerId);

  if (!sale) return <NotFound />;

  const t = computeTotals(sale);
  const term = paymentTerms.find((p) => p.value === sale.term)?.label;
  const hasTax = sale.items.some((l) => l.tax);

  return (
    <Box bg="slate.0" mih="100vh" py={{ base: 'md', sm: 'xl' }} px="md">
      <Stack gap="md" maw={860} mx="auto">
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <img src={mark} alt="" width={28} height={28} />
            <Box>
              <Text fz="sm" fw={700} c="slate.9">
                Jurnal Accounting
              </Text>
              <Text fz={11} c="slate.6">
                Faktur penjualan
              </Text>
            </Box>
          </Group>
          <Button
            radius="md"
            leftSection={<DownloadSimple size={16} />}
            onClick={() => downloadInvoice(sale, { customer })}
          >
            Unduh PDF
          </Button>
        </Group>

        <Card withBorder radius="lg" padding="lg" bg="white">
          <Group justify="space-between" align="flex-start" gap="md">
            <Box>
              <Text fz={11} fw={600} c="slate.7" tt="uppercase" style={{ letterSpacing: 0.5 }}>
                Nomor faktur
              </Text>
              <Title order={2} fz={{ base: 20, sm: 24 }} c="slate.9" style={{ wordBreak: 'break-all' }}>
                {sale.number}
              </Title>
              <Box mt={6}>
                <StatusBadge status={badgeOf(sale)} />
              </Box>
            </Box>
            <Box ta="right">
              <Text fz={11} c="slate.6">
                Sisa tagihan
              </Text>
              <Text fz={{ base: 20, sm: 24 }} fw={700} c="primary.9">
                {rupiah(t.balance)}
              </Text>
              <Text fz={11} c="slate.6">
                Jatuh tempo {formatDate(sale.dueDate)}
              </Text>
            </Box>
          </Group>

          <Divider my="md" color="gray.3" />

          <Group justify="space-between" align="flex-start" gap="xl" wrap="wrap">
            <Box>
              <Text fz={11} c="slate.6">
                Ditagihkan kepada
              </Text>
              <Text fz="sm" fw={700} c="slate.9">
                {customer?.name ?? '—'}
              </Text>
              {customer?.email && (
                <Text fz="xs" c="slate.6">
                  {customer.email}
                </Text>
              )}
              {sale.billingAddress && (
                <Text fz="xs" c="slate.6" maw={320}>
                  {sale.billingAddress}
                </Text>
              )}
            </Box>
            <Box>
              <Text fz={11} c="slate.6">
                Tanggal faktur
              </Text>
              <Text fz="sm" fw={600} c="slate.9">
                {formatDate(sale.date)}
              </Text>
              {term && (
                <>
                  <Text fz={11} c="slate.6" mt={6}>
                    Termin pembayaran
                  </Text>
                  <Text fz="sm" fw={600} c="slate.9">
                    {term}
                  </Text>
                </>
              )}
            </Box>
          </Group>
        </Card>

        <Card withBorder radius="lg" padding="lg" bg="white">
          <Box
            className="table-frame"
            style={{
              border: '1px solid var(--mantine-color-gray-3)',
              borderRadius: 'var(--mantine-radius-md)',
              overflow: 'auto',
            }}
          >
            <Table
              verticalSpacing="sm"
              horizontalSpacing="md"
              miw={560}
              styles={{
                th: {
                  fontSize: 'var(--mantine-font-size-xs)',
                  color: 'var(--mantine-color-slate-7)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                },
              }}
            >
              <Table.Thead bg="slate.0">
                <Table.Tr>
                  <Table.Th w={40}>No</Table.Th>
                  <Table.Th>Produk / jasa</Table.Th>
                  <Table.Th w={70} ta="right">
                    Qty
                  </Table.Th>
                  <Table.Th w={140} ta="right">
                    Harga satuan
                  </Table.Th>
                  <Table.Th w={150} ta="right">
                    Total
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sale.items.map((line, i) => (
                  <Table.Tr key={i}>
                    <Table.Td fz="xs" c="slate.6">
                      {i + 1}
                    </Table.Td>
                    <Table.Td>
                      <Text fz="sm" fw={600} c="slate.9">
                        {productName(line)}
                      </Text>
                      {line.description && line.description !== productName(line) && (
                        <Text fz={11} c="slate.6">
                          {line.description}
                        </Text>
                      )}
                      {line.tax && (
                        <Text fz={11} c="slate.6">
                          {taxLabel(line.tax)}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td ta="right" fz="sm">
                      {line.qty}
                    </Table.Td>
                    <Table.Td ta="right" fz="sm" style={{ whiteSpace: 'nowrap' }}>
                      {rupiah(line.price)}
                    </Table.Td>
                    <Table.Td ta="right" fz="sm" fw={700} style={{ whiteSpace: 'nowrap' }}>
                      {rupiah(lineAmount(line))}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>

          <Box
            ml="auto"
            mt="md"
            p="md"
            bg="slate.0"
            w={{ base: '100%', sm: 340 }}
            style={{ borderRadius: 'var(--mantine-radius-md)' }}
          >
            <Row label="Subtotal" value={rupiah(t.subtotal)} />
            {t.discount > 0 && (
              <Row label="Diskon" value={`-${rupiah(t.discount)}`} color="red.7" />
            )}
            {hasTax && <Row label="PPN" value={`+${rupiah(t.tax)}`} />}
            {t.withholding > 0 && (
              <Row label="Potongan (PPh)" value={`-${rupiah(t.withholding)}`} color="red.7" />
            )}
            <Divider my={8} color="gray.3" />
            <Row strong label="Total faktur" value={rupiah(t.total)} />
            {/* Pelanggan perlu tahu kenapa sisanya berkurang tanpa ada pembayaran. */}
            {t.returned > 0 && (
              <Row label="Retur / nota kredit" value={`-${rupiah(t.returned)}`} color="orange.8" />
            )}
            {(t.paid > 0 || t.returned > 0) && (
              <>
                {t.paid > 0 && (
                  <Row label="Sudah dibayar" value={`-${rupiah(t.paid)}`} color="green.8" />
                )}
                <Row strong label="Sisa tagihan" value={rupiah(t.balance)} />
              </>
            )}
          </Box>

          {sale.message && (
            <Box mt="md">
              <Text fz={11} c="slate.6">
                Pesan
              </Text>
              <Text fz="sm" c="slate.8">
                {sale.message}
              </Text>
            </Box>
          )}
        </Card>

        <Text fz={11} c="slate.6" ta="center">
          Dokumen ini diterbitkan dari Dashboard Jurnal. Hubungi penerbit faktur bila ada
          pertanyaan.
        </Text>
      </Stack>
    </Box>
  );
}
