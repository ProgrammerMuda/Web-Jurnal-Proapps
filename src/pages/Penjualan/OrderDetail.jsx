// Rincian Pesanan Penjualan. Susunannya sengaja sama dengan rincian faktur,
// hanya aksinya yang mengikuti daur hidup pesanan.
import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Menu,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  CheckCircle,
  ClipboardText,
  Copy,
  DotsThreeVertical,
  DownloadSimple,
  EnvelopeSimple,
  Invoice,
  PaperPlaneTilt,
  PencilSimple,
  Prohibit,
  Tag,
  Trash,
  User,
} from '@/components/Icon.jsx';
import { BackLink, CopyIcon, Field, PageIntro, StatusBadge } from './components.jsx';
import { paymentTerms, products } from './data.js';
import { DOC } from './docTypes.js';
import { downloadInvoice } from './invoicePdf.js';
import { formatHash } from './routes.js';
import {
  canCancelOrder,
  canConfirmOrder,
  canDeleteOrder,
  canEditOrder,
  canInvoiceOrder,
  canResendOrder,
  canSendOrder,
  ORDER_STATUS,
  orderRemaining,
  orderStatus,
} from './orders.js';
import {
  computeTotals,
  formatDate,
  formatDateTime,
  lastSend,
  lineAmount,
  rupiah,
  taxLabel,
  useCustomer,
} from './utils.js';

const productName = (l) => products.find((p) => p.id === l.productId)?.name ?? l.description;

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

const goTo = (v) => {
  window.location.hash = formatHash(v);
  window.scrollTo({ top: 0 });
};

// Tautan ke dokumen lain dalam rantai yang sama (S5).
function DocLink({ label, number, onClick }) {
  return (
    <Box>
      <Text fz={11} c="slate.6">
        {label}
      </Text>
      <Anchor fz="sm" fw={600} component="button" onClick={onClick}>
        {number}
      </Anchor>
    </Box>
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

export default function OrderDetail({ order, invoices = [], quote, onBack, actions }) {
  const t = computeTotals(order);
  const status = orderStatus(order);
  const customer = useCustomer(order.customerId);
  const term = paymentTerms.find((p) => p.value === order.term)?.label ?? '—';
  const sent = lastSend(order);
  const hasTax = order.items.some((l) => l.tax);

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <BackLink label="Daftar pesanan" onClick={onBack} />

      <PageIntro
        icon={ClipboardText}
        title="Detail pesanan"
        description="Rincian pesanan penjualan, status kesepakatan, dan faktur turunannya."
      />

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" align="flex-start" gap="md">
          <Box>
            <Text fz={11} fw={600} c="slate.7" tt="uppercase" style={{ letterSpacing: 0.5 }}>
              Nomor pesanan
            </Text>
            <Group gap={6} wrap="nowrap">
              <Title order={2} fz={{ base: 22, md: 26 }} c="slate.9" style={{ wordBreak: 'break-all' }}>
                {order.number}
              </Title>
              <CopyIcon value={order.number} size={16} />
            </Group>
            <Box my={6}>
              <StatusBadge status={status} map={ORDER_STATUS} />
            </Box>
            <Text fz="xs" c="slate.7">
              {customer?.name}
            </Text>
          </Box>

          <Group gap="xs" wrap="nowrap">
            <Button
              variant="default"
              radius="md"
              leftSection={<DownloadSimple size={16} />}
              onClick={() => downloadInvoice(order, { customer, doc: DOC.order })}
            >
              Unduh PDF
            </Button>
            {canSendOrder(order) && (
              <Button
                radius="md"
                leftSection={<PaperPlaneTilt size={16} />}
                onClick={() => actions.send(order)}
              >
                Kirim pesanan
              </Button>
            )}
            {canConfirmOrder(order) && (
              <Button
                radius="md"
                color="green"
                leftSection={<CheckCircle size={16} />}
                onClick={() => actions.confirm(order)}
              >
                Tandai dikonfirmasi
              </Button>
            )}
            {canInvoiceOrder(order) && (
              <Button
                radius="md"
                leftSection={<Invoice size={16} />}
                onClick={() => actions.invoice(order)}
              >
                Buat faktur
              </Button>
            )}
            <Menu position="bottom-end" withinPortal shadow="md" width={220}>
              <Menu.Target>
                <ActionIcon variant="default" size="lg" radius="md" aria-label="Aksi lainnya">
                  <DotsThreeVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {canEditOrder(order) && (
                  <Menu.Item
                    fz="xs"
                    leftSection={<PencilSimple size={14} />}
                    onClick={() => actions.edit(order)}
                  >
                    Ubah pesanan
                  </Menu.Item>
                )}
                {canResendOrder(order) && (
                  <Menu.Item
                    fz="xs"
                    leftSection={<EnvelopeSimple size={14} />}
                    onClick={() => actions.resend(order)}
                  >
                    Kirim ulang email
                  </Menu.Item>
                )}
                <Menu.Item
                  fz="xs"
                  leftSection={<Copy size={14} />}
                  onClick={() => actions.duplicate(order)}
                >
                  Duplikat pesanan
                </Menu.Item>
                {(canCancelOrder(order) || canDeleteOrder(order)) && <Menu.Divider />}
                {canCancelOrder(order) && (
                  <Menu.Item
                    fz="xs"
                    color="red"
                    leftSection={<Prohibit size={14} />}
                    onClick={() => actions.cancel(order)}
                  >
                    Batalkan pesanan
                  </Menu.Item>
                )}
                {canDeleteOrder(order) && (
                  <Menu.Item
                    fz="xs"
                    color="red"
                    leftSection={<Trash size={14} />}
                    onClick={() => actions.remove(order)}
                  >
                    Hapus pesanan
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        <Divider my="md" color="gray.3" />

        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
          <Box py="sm">
            <Field label="Tanggal pesanan">{formatDate(order.date)}</Field>
          </Box>
          <Box py="sm">
            <Field label="Target selesai">{formatDate(order.dueDate)}</Field>
          </Box>
          <Box py="sm">
            <Field label="Dikonfirmasi">
              {order.confirmedAt ? formatDateTime(order.confirmedAt) : '—'}
            </Field>
          </Box>
          <Box p="sm" bg="slate.0" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
            <Text fz={11} fw={600} c="primary.9">
              Nilai pesanan
            </Text>
            <Text fz="lg" fw={700} c="primary.9">
              {rupiah(t.total)}
            </Text>
          </Box>
        </SimpleGrid>

        {/* Pesanan tidak menagih apa pun; yang menagih adalah faktur turunannya. */}
        {status === 'confirmed' && (
          <Alert variant="light" color="green" radius="md" icon={<CheckCircle size={16} />} mt="md">
            <Text fz="xs">
              Pelanggan sudah mengonfirmasi pesanan ini. Terbitkan faktur untuk mulai menagih.
            </Text>
          </Alert>
        )}
        {status === 'partial' && (
          <Alert variant="light" color="orange" radius="md" icon={<Invoice size={16} />} mt="md">
            <Text fz="xs">
              Sebagian sudah difakturkan. Sisa {orderRemaining(order)} unit masih bisa ditagih
              lewat faktur berikutnya.
            </Text>
          </Alert>
        )}
        {status === 'invoiced' && (
          <Alert variant="light" color="primary" radius="md" icon={<Invoice size={16} />} mt="md">
            <Text fz="xs">
              Seluruh baris pesanan ini sudah difakturkan. Pesanan terkunci.
            </Text>
          </Alert>
        )}
        {status === 'cancelled' && (
          <Alert variant="light" color="red" radius="md" icon={<Prohibit size={16} />} mt="md">
            <Text fz="xs">
              Pesanan dibatalkan pada {formatDateTime(order.cancelledAt)} dan tidak bisa
              dilanjutkan.
            </Text>
          </Alert>
        )}
      </Card>

      <Grid gutter="md" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card withBorder radius="lg" padding="lg" bg="white">
            <Group gap="sm" mb="md" wrap="nowrap">
              <ThemeIcon variant="light" bg="slate.0" c="slate.7" size={32} radius="md">
                <ClipboardText size={16} />
              </ThemeIcon>
              <Box>
                <Text fw={700} fz="sm" c="slate.9">
                  Barang dan jasa
                </Text>
                <Text fz={11} c="slate.6">
                  {order.items.length} baris dipesan
                </Text>
              </Box>
            </Group>

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
                miw={620}
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
                    <Table.Th w={80} ta="right">
                      Qty
                    </Table.Th>
                    <Table.Th w={140} ta="right">
                      Harga satuan
                    </Table.Th>
                    <Table.Th w={110}>Pajak</Table.Th>
                    <Table.Th w={150} ta="right">
                      Total
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {order.items.map((line, i) => (
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
                      </Table.Td>
                      <Table.Td ta="right" fz="sm">
                        {line.qty}
                        {(line.invoicedQty ?? 0) > 0 && (
                          <Text fz={11} c="slate.6">
                            {line.invoicedQty} difaktur
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td ta="right" fz="sm" style={{ whiteSpace: 'nowrap' }}>
                        {rupiah(line.price)}
                      </Table.Td>
                      <Table.Td fz="xs" c={line.tax ? 'slate.8' : 'slate.5'}>
                        {taxLabel(line.tax) ?? 'Tanpa pajak'}
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
              <SummaryRow label="Subtotal" value={rupiah(t.subtotal)} />
              {t.discount > 0 && (
                <SummaryRow label="Diskon" value={`-${rupiah(t.discount)}`} color="red.7" />
              )}
              {hasTax && <SummaryRow label="PPN" value={`+${rupiah(t.tax)}`} />}
              {t.withholding > 0 && (
                <SummaryRow
                  label="Potongan (PPh)"
                  value={`-${rupiah(t.withholding)}`}
                  color="red.7"
                />
              )}
              <Divider my={8} color="gray.3" />
              <SummaryRow strong label="Total pesanan" value={rupiah(t.total)} />
            </Box>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            <SideCard icon={User} title="Pelanggan dan pengiriman">
              <Stack gap="sm">
                <Field label="Pelanggan">{customer?.name}</Field>
                <Field label="Email">{customer?.email || '—'}</Field>
                <Field label="Alamat pengiriman">{order.billingAddress || '—'}</Field>
                <Field label="Termin pembayaran">{term}</Field>
              </Stack>
            </SideCard>

            {(quote || invoices.length > 0) && (
              <SideCard icon={Invoice} title="Dokumen terkait">
                <Stack gap="xs">
                  {quote && (
                    <DocLink
                      label="Dari penawaran"
                      number={quote.number}
                      onClick={() => goTo({ name: 'quote', id: quote.id })}
                    />
                  )}
                  {invoices.map((inv) => (
                    <DocLink
                      key={inv.id}
                      label="Faktur dari pesanan ini"
                      number={inv.number}
                      onClick={() => goTo({ name: 'invoice', id: inv.id })}
                    />
                  ))}
                </Stack>
              </SideCard>
            )}

            <SideCard icon={PaperPlaneTilt} title="Pengiriman dokumen">
              {sent ? (
                <Field label={`Terakhir dikirim (${order.sends.length}x)`}>
                  {formatDateTime(sent.at)} · {sent.to}
                </Field>
              ) : (
                <Field label="Riwayat kirim">
                  {status === 'draft' ? 'Belum pernah dikirim' : '—'}
                </Field>
              )}
            </SideCard>

            <SideCard icon={Tag} title="Informasi lainnya">
              <Stack gap="sm">
                {order.ref && <Field label="Referensi pelanggan">{order.ref}</Field>}
                {order.message && <Field label="Pesan untuk pelanggan">{order.message}</Field>}
                {order.memo && <Field label="Memo internal">{order.memo}</Field>}
                <Field label="Dibuat">{formatDateTime(order.createdAt)}</Field>
                <Field label="Terakhir diperbarui">{formatDateTime(order.updatedAt)}</Field>
              </Stack>
            </SideCard>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
