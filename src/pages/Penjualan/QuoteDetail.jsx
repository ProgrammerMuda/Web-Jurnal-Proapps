// Rincian Penawaran. Susunannya sama dengan rincian faktur dan pesanan,
// aksinya mengikuti daur hidup penawaran.
import {
  ActionIcon,
  Alert,
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
  Clock,
  Copy,
  DotsThreeVertical,
  DownloadSimple,
  EnvelopeSimple,
  FileText,
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
  canAnswerQuote,
  canCancelQuote,
  canConvertQuote,
  canDeleteQuote,
  canEditQuote,
  canResendQuote,
  canReviseQuote,
  canSendQuote,
  isExpired,
  isExpiring,
  QUOTE_STATUS,
  quoteBadge,
  quoteStatus,
} from './quotes.js';
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

export default function QuoteDetail({ quote, order, invoice, revisedTo, onBack, actions }) {
  const t = computeTotals(quote);
  const status = quoteStatus(quote);
  const expired = isExpired(quote);
  const customer = useCustomer(quote.customerId);
  const term = paymentTerms.find((p) => p.value === quote.term)?.label ?? '—';
  const sent = lastSend(quote);
  const hasTax = quote.items.some((l) => l.tax);

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <BackLink label="Daftar penawaran" onClick={onBack} />

      <PageIntro
        icon={FileText}
        title="Detail penawaran"
        description="Rincian harga yang ditawarkan, jawaban pelanggan, dan pesanan turunannya."
      />

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" align="flex-start" gap="md">
          <Box>
            <Text fz={11} fw={600} c="slate.7" tt="uppercase" style={{ letterSpacing: 0.5 }}>
              Nomor penawaran
            </Text>
            <Group gap={6} wrap="nowrap">
              <Title
                order={2}
                fz={{ base: 22, md: 26 }}
                c="slate.9"
                style={{ wordBreak: 'break-all' }}
              >
                {quote.number}
              </Title>
              <CopyIcon value={quote.number} size={16} />
            </Group>
            <Box my={6}>
              <StatusBadge status={quoteBadge(quote)} map={QUOTE_STATUS} />
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
              onClick={() => downloadInvoice(quote, { customer, doc: DOC.quote })}
            >
              Unduh PDF
            </Button>
            {canSendQuote(quote) && (
              <Button
                radius="md"
                leftSection={<PaperPlaneTilt size={16} />}
                onClick={() => actions.send(quote)}
              >
                Kirim penawaran
              </Button>
            )}
            {canAnswerQuote(quote) && (
              <>
                <Button
                  variant="default"
                  radius="md"
                  leftSection={<Prohibit size={16} />}
                  onClick={() => actions.reject(quote)}
                >
                  Tandai ditolak
                </Button>
                <Button
                  radius="md"
                  color="green"
                  leftSection={<CheckCircle size={16} />}
                  onClick={() => actions.accept(quote)}
                >
                  Tandai diterima
                </Button>
              </>
            )}
            {canConvertQuote(quote) && (
              <>
                <Button
                  radius="md"
                  leftSection={<ClipboardText size={16} />}
                  onClick={() => actions.convert(quote)}
                >
                  Buat pesanan
                </Button>
                <Button
                  variant="default"
                  radius="md"
                  leftSection={<Invoice size={16} />}
                  onClick={() => actions.invoice(quote)}
                >
                  Buat faktur
                </Button>
              </>
            )}
            <Menu position="bottom-end" withinPortal shadow="md" width={230}>
              <Menu.Target>
                <ActionIcon variant="default" size="lg" radius="md" aria-label="Aksi lainnya">
                  <DotsThreeVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {canEditQuote(quote) && (
                  <Menu.Item
                    fz="xs"
                    leftSection={<PencilSimple size={14} />}
                    onClick={() => actions.edit(quote)}
                  >
                    Ubah penawaran
                  </Menu.Item>
                )}
                {canReviseQuote(quote) && (
                  <Menu.Item
                    fz="xs"
                    leftSection={<PencilSimple size={14} />}
                    onClick={() => actions.revise(quote)}
                  >
                    Revisi penawaran
                  </Menu.Item>
                )}
                {canResendQuote(quote) && (
                  <Menu.Item
                    fz="xs"
                    leftSection={<EnvelopeSimple size={14} />}
                    onClick={() => actions.resend(quote)}
                  >
                    Kirim ulang email
                  </Menu.Item>
                )}
                <Menu.Item
                  fz="xs"
                  leftSection={<Copy size={14} />}
                  onClick={() => actions.duplicate(quote)}
                >
                  {expired ? 'Tawarkan ulang (salin)' : 'Duplikat penawaran'}
                </Menu.Item>
                {(canCancelQuote(quote) || canDeleteQuote(quote)) && <Menu.Divider />}
                {canCancelQuote(quote) && (
                  <Menu.Item
                    fz="xs"
                    color="red"
                    leftSection={<Prohibit size={14} />}
                    onClick={() => actions.cancel(quote)}
                  >
                    Batalkan penawaran
                  </Menu.Item>
                )}
                {canDeleteQuote(quote) && (
                  <>
                    <Menu.Item
                      fz="xs"
                      color="red"
                      leftSection={<Trash size={14} />}
                      onClick={() => actions.remove(quote)}
                    >
                      Hapus penawaran
                    </Menu.Item>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        <Divider my="md" color="gray.3" />

        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
          <Box py="sm">
            <Field label="Tanggal penawaran">{formatDate(quote.date)}</Field>
          </Box>
          <Box py="sm">
            <Field label="Berlaku sampai" valueProps={{ c: expired ? 'orange.8' : undefined }}>
              {formatDate(quote.dueDate)}
            </Field>
          </Box>
          <Box py="sm">
            <Field label="Jawaban pelanggan">
              {quote.acceptedAt
                ? `Diterima ${formatDateTime(quote.acceptedAt)}`
                : quote.rejectedAt
                  ? `Ditolak ${formatDateTime(quote.rejectedAt)}`
                  : '—'}
              {quote.rejectReason && (
                <Text fz={11} c="slate.6" fw={400}>
                  {quote.rejectReason}
                </Text>
              )}
            </Field>
          </Box>
          <Box p="sm" bg="slate.0" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
            <Text fz={11} fw={600} c="primary.9">
              Nilai penawaran
            </Text>
            <Text fz="lg" fw={700} c="primary.9">
              {rupiah(t.total)}
            </Text>
          </Box>
        </SimpleGrid>

        {isExpiring(quote) && (
          <Alert variant="light" color="orange" radius="md" icon={<Clock size={16} />} mt="md">
            <Text fz="xs">
              Masa berlakunya tinggal beberapa hari lagi ({formatDate(quote.dueDate)}). Sebaiknya
              ditindaklanjuti sebelum harganya kedaluwarsa.
            </Text>
          </Alert>
        )}
        {expired && (
          <Alert variant="light" color="orange" radius="md" icon={<Clock size={16} />} mt="md">
            <Group justify="space-between" gap="sm" wrap="nowrap">
              <Text fz="xs">
                Masa berlakunya sudah lewat, jadi penawaran ini tidak bisa dijawab atau dijadikan
                pesanan. Salin menjadi penawaran baru bila harga ini masih mau ditawarkan.
              </Text>
              <Button
                size="compact-xs"
                radius="md"
                variant="light"
                color="orange"
                onClick={() => actions.duplicate(quote)}
              >
                Tawarkan ulang
              </Button>
            </Group>
          </Alert>
        )}
        {status === 'accepted' && (
          <Alert variant="light" color="green" radius="md" icon={<CheckCircle size={16} />} mt="md">
            <Text fz="xs">
              Pelanggan menerima penawaran ini. Lanjutkan menjadi pesanan penjualan untuk mengunci
              kesepakatannya.
            </Text>
          </Alert>
        )}
        {status === 'converted' && order && (
          <Alert
            variant="light"
            color="primary"
            radius="md"
            icon={<ClipboardText size={16} />}
            mt="md"
          >
            <Group justify="space-between" gap="sm" wrap="nowrap">
              <Text fz="xs">
                Penawaran ini sudah menjadi pesanan <b>{order.number}</b> dan terkunci.
              </Text>
              <Button
                size="compact-xs"
                radius="md"
                variant="light"
                onClick={() => {
                  window.location.hash = formatHash({ name: 'order', id: order.id });
                  window.scrollTo({ top: 0 });
                }}
              >
                Buka pesanan
              </Button>
            </Group>
          </Alert>
        )}
        {status === 'rejected' && (
          <Alert variant="light" color="red" radius="md" icon={<Prohibit size={16} />} mt="md">
            <Text fz="xs">
              Ditolak pelanggan pada {formatDateTime(quote.rejectedAt)}
              {quote.rejectReason ? ` — ${quote.rejectReason}` : ''}. Penawaran ditutup.
            </Text>
          </Alert>
        )}
        {status === 'cancelled' && (
          <Alert variant="light" color="red" radius="md" icon={<Prohibit size={16} />} mt="md">
            <Text fz="xs">
              Dibatalkan pada {formatDateTime(quote.cancelledAt)}
              {quote.cancelReason ? ` — ${quote.cancelReason}` : ''}.
            </Text>
          </Alert>
        )}
        {status === 'revised' && revisedTo && (
          <Alert variant="light" color="gray" radius="md" icon={<PencilSimple size={16} />} mt="md">
            <Group justify="space-between" gap="sm" wrap="nowrap">
              <Text fz="xs">
                Penawaran ini sudah diganti oleh revisi <b>{revisedTo.number}</b>.
              </Text>
              <Button
                size="compact-xs"
                radius="md"
                variant="light"
                color="gray"
                onClick={() => {
                  window.location.hash = formatHash({ name: 'quote', id: revisedTo.id });
                  window.scrollTo({ top: 0 });
                }}
              >
                Buka revisi
              </Button>
            </Group>
          </Alert>
        )}
        {status === 'invoiced' && invoice && (
          <Alert variant="light" color="primary" radius="md" icon={<Invoice size={16} />} mt="md">
            <Group justify="space-between" gap="sm" wrap="nowrap">
              <Text fz="xs">
                Penawaran ini sudah difakturkan menjadi <b>{invoice.number}</b> dan terkunci.
              </Text>
              <Button
                size="compact-xs"
                radius="md"
                variant="light"
                onClick={() => {
                  window.location.hash = formatHash({ name: 'invoice', id: invoice.id });
                  window.scrollTo({ top: 0 });
                }}
              >
                Buka faktur
              </Button>
            </Group>
          </Alert>
        )}
      </Card>

      <Grid gutter="md" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card withBorder radius="lg" padding="lg" bg="white">
            <Group gap="sm" mb="md" wrap="nowrap">
              <ThemeIcon variant="light" bg="slate.0" c="slate.7" size={32} radius="md">
                <FileText size={16} />
              </ThemeIcon>
              <Box>
                <Text fw={700} fz="sm" c="slate.9">
                  Barang dan jasa
                </Text>
                <Text fz={11} c="slate.6">
                  {quote.items.length} baris ditawarkan
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
                  {quote.items.map((line, i) => (
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
              <SummaryRow strong label="Total penawaran" value={rupiah(t.total)} />
            </Box>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="md">
            <SideCard icon={User} title="Pelanggan">
              <Stack gap="sm">
                <Field label="Pelanggan">{customer?.name}</Field>
                <Field label="Email">{customer?.email || '—'}</Field>
                <Field label="Termin pembayaran">{term}</Field>
              </Stack>
            </SideCard>

            <SideCard icon={PaperPlaneTilt} title="Pengiriman dokumen">
              {sent ? (
                <Field label={`Terakhir dikirim (${quote.sends.length}x)`}>
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
                {quote.ref && <Field label="Referensi pelanggan">{quote.ref}</Field>}
                {quote.terms && <Field label="Syarat & ketentuan">{quote.terms}</Field>}
                {quote.message && <Field label="Pesan untuk pelanggan">{quote.message}</Field>}
                {quote.memo && <Field label="Memo internal">{quote.memo}</Field>}
                <Field label="Dibuat">{formatDateTime(quote.createdAt)}</Field>
                <Field label="Terakhir diperbarui">{formatDateTime(quote.updatedAt)}</Field>
              </Stack>
            </SideCard>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
