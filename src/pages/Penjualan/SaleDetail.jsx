import {
  Anchor,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  ArrowLeft,
  ArrowUpRight,
  DownloadSimple,
  FileText,
  Invoice,
  Link,
  Notebook,
  Tag,
  User,
} from '@/components/Icon.jsx';
import { CopyIcon, Field, PageIntro, StatusBadge } from './components.jsx';
import { paymentTerms, products } from './data.js';
import {
  computeTotals,
  formatDate,
  formatDateTime,
  lineAmount,
  rupiah,
  statusOf,
  taxLabel,
  useCustomer,
} from './utils.js';

function SideCard({ icon: Icon, title, children }) {
  return (
    <Card withBorder radius="lg" padding="md" bg="white">
      <Group gap="sm" mb="md">
        <ThemeIcon variant="light" bg="slate.0" c="slate.7" size={32} radius="md">
          <Icon size={16} />
        </ThemeIcon>
        <Text fw={600} fz="sm" c="slate.9">
          {title}
        </Text>
      </Group>
      {children}
    </Card>
  );
}

function SummaryRow({ label, value, strong, color }) {
  return (
    <Group justify="space-between" py={4}>
      <Text fz={strong ? 'sm' : 'xs'} fw={strong ? 700 : 400} c={strong ? 'primary.9' : 'slate.7'}>
        {label}
      </Text>
      <Text fz={strong ? 'md' : 'xs'} fw={700} c={color ?? (strong ? 'primary.9' : 'slate.9')}>
        {value}
      </Text>
    </Group>
  );
}

export default function SaleDetail({ sale, onBack, onPay, onCreateLink }) {
  const t = computeTotals(sale);
  const status = statusOf(sale);
  const customer = useCustomer(sale.customerId);
  const term = paymentTerms.find((p) => p.value === sale.term)?.label ?? '—';
  const hasTax = sale.items.some((l) => l.tax);

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro
        title="Detail penjualan"
        description="Rincian faktur, pembayaran, dan dokumen penjualan."
        actions={
          <Button
            variant="default"
            radius="md"
            leftSection={<ArrowLeft size={16} />}
            onClick={onBack}
          >
            Daftar penjualan
          </Button>
        }
      />

      {/* Ringkasan faktur */}
      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" align="flex-start" gap="md">
          <Box>
            <Text fz={11} fw={600} c="slate.7" tt="uppercase" style={{ letterSpacing: 0.5 }}>
              Nomor Faktur
            </Text>
            <Group gap={6} wrap="nowrap">
              <Title
                order={2}
                fz={{ base: 22, md: 26 }}
                c="slate.9"
                style={{ wordBreak: 'break-all' }}
              >
                {sale.number}
              </Title>
              <CopyIcon value={sale.number} size={16} />
            </Group>
            <Box my={6}>
              <StatusBadge status={status} />
            </Box>
            <Text fz="xs" c="slate.7">
              {customer?.name}
            </Text>
          </Box>
          <Group gap="xs">
            <Button variant="default" radius="md" leftSection={<DownloadSimple size={16} />}>
              Unduh PDF
            </Button>
            <Button
              variant="outline"
              radius="md"
              leftSection={<Link size={16} />}
              onClick={onCreateLink}
            >
              {sale.invoiceLink ? 'Salin tautan faktur' : 'Buat tautan faktur'}
            </Button>
            {status === 'sent' && (
              <Button radius="md" leftSection={<Invoice size={16} />} onClick={onPay}>
                Catat pembayaran
              </Button>
            )}
          </Group>
        </Group>

        <Divider my="md" color="gray.3" />

        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
          <Box py="sm">
            <Field label="Tanggal transaksi">{formatDate(sale.date)}</Field>
          </Box>
          <Box py="sm">
            <Field label="Jatuh tempo">{formatDate(sale.dueDate)}</Field>
          </Box>
          <Box py="sm">
            <Field label="Total faktur">{rupiah(t.total)}</Field>
          </Box>
          <Box p="sm" bg="slate.0" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
            <Text fz={11} fw={600} c="primary.9">
              Sisa tagihan
            </Text>
            <Text fz="lg" fw={700} c="primary.9">
              {rupiah(t.balance)}
            </Text>
          </Box>
        </SimpleGrid>
      </Card>

      <Grid gutter="md" align="flex-start">
        {/* Barang dan jasa */}
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card withBorder radius="lg" padding="md" bg="white">
            <Group justify="space-between" align="flex-start" mb="md">
              <Box>
                <Text fw={600} fz="sm" c="slate.9">
                  Barang dan jasa
                </Text>
                <Text fz={11} c="slate.6">
                  {sale.items.length} item
                </Text>
              </Box>
              <ThemeIcon variant="light" bg="slate.0" c="slate.7" size={32} radius="md">
                <Invoice size={16} />
              </ThemeIcon>
            </Group>

            <Table
              verticalSpacing="sm"
              horizontalSpacing="sm"
              styles={{
                th: {
                  fontSize: 'var(--mantine-font-size-xs)',
                  color: 'var(--mantine-color-slate-7)',
                  fontWeight: 600,
                },
              }}
            >
              <Table.Thead bg="slate.0">
                <Table.Tr>
                  <Table.Th>Barang / jasa</Table.Th>
                  <Table.Th ta="right">Kuantitas</Table.Th>
                  <Table.Th ta="right">Harga satuan</Table.Th>
                  <Table.Th>Pajak</Table.Th>
                  <Table.Th ta="right">Jumlah</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sale.items.map((line, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Text fz="xs" fw={700} c="primary.9">
                          {productName(line)}
                        </Text>
                        <ArrowUpRight size={12} color="var(--mantine-color-primary-9)" />
                      </Group>
                      <Text fz={11} c="slate.6">
                        {line.description}
                      </Text>
                      {t.paid > 0 && (
                        <Anchor fz={11} fw={600} c="primary.9" component="button">
                          <Group gap={4}>
                            <Notebook size={12} /> Lihat jurnal transaksi
                          </Group>
                        </Anchor>
                      )}
                    </Table.Td>
                    <Table.Td ta="right" fz="xs">
                      {line.qty}
                    </Table.Td>
                    <Table.Td ta="right" fz="xs">
                      {rupiah(line.price)}
                    </Table.Td>
                    <Table.Td fz="xs">{taxLabel(line.tax) ?? '—'}</Table.Td>
                    <Table.Td ta="right" fz="xs" fw={700}>
                      {rupiah(lineAmount(line))}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Box ml="auto" mt="lg" maw={340}>
              <SummaryRow label="Subtotal" value={rupiah(t.subtotal)} />
              {t.discount > 0 && (
                <SummaryRow label="Diskon" value={`-${rupiah(t.discount)}`} color="red.7" />
              )}
              {hasTax && <SummaryRow label="Pajak" value={`+${rupiah(t.tax)}`} />}
              {t.withholding > 0 && (
                <SummaryRow label="Potongan" value={`-${rupiah(t.withholding)}`} color="red.7" />
              )}
              <Divider my={6} color="gray.3" />
              <SummaryRow strong label="Total faktur" value={rupiah(t.total)} />
              <SummaryRow label="Sudah dibayar" value={rupiah(t.paid)} />
              <SummaryRow strong label="Sisa tagihan" value={rupiah(t.balance)} />
            </Box>
          </Card>
        </Grid.Col>

        {/* Sisi kanan */}
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            <SideCard icon={User} title="Pelanggan dan penagihan">
              <Stack gap="sm">
                <Field label="Pelanggan">{customer?.name}</Field>
                <Field label="Email penagihan">{customer?.email || '—'}</Field>
                <Field label="Alamat penagihan">{sale.billingAddress || '—'}</Field>
                <Field label="Termin pembayaran">{term}</Field>
              </Stack>
            </SideCard>

            <SideCard icon={FileText} title="Dokumen">
              {sale.invoiceLink ? (
                <Group gap={4} wrap="nowrap">
                  <Anchor href={sale.invoiceLink} target="_blank" fz="xs" truncate="end">
                    {sale.invoiceLink}
                  </Anchor>
                  <CopyIcon value={sale.invoiceLink} />
                </Group>
              ) : (
                <Text fz="xs" c="slate.7">
                  Tautan faktur belum dibuat.
                </Text>
              )}
            </SideCard>

            <SideCard icon={Tag} title="Informasi lainnya">
              <Stack gap="sm">
                {sale.ref && <Field label="Referensi pelanggan">{sale.ref}</Field>}
                {sale.message && <Field label="Pesan di faktur">{sale.message}</Field>}
                {sale.memo && <Field label="Memo internal">{sale.memo}</Field>}
                <Field label="Dibuat">{formatDateTime(sale.createdAt)}</Field>
                <Field label="Terakhir diperbarui">{formatDateTime(sale.updatedAt)}</Field>
              </Stack>
            </SideCard>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

// Nama produk diambil dari master produk; fallback ke deskripsi baris.
const productName = (line) =>
  products.find((p) => p.id === line.productId)?.name ?? line.description;
