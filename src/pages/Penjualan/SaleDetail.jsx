import {
  ActionIcon,
  Alert,
  Badge,
  Anchor,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Menu,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  ArrowCounterClockwise,
  ArrowUpRight,
  Check,
  ClipboardText,
  ClockCounterClockwise,
  Copy,
  DotsThreeVertical,
  DownloadSimple,
  EnvelopeSimple,
  FileText,
  HandCoins,
  Invoice,
  Link,
  Notebook,
  Paperclip,
  PaperPlaneTilt,
  PencilSimple,
  Prohibit,
  Tag,
  Trash,
  Warning,
  User,
} from '@/components/Icon.jsx';
import { BackLink, CopyIcon, Field, PageIntro, StatusBadge } from './components.jsx';
import { downloadInvoice } from './invoicePdf.js';
import { formatHash } from './routes.js';
import { depositAccounts, paymentTerms, products } from './data.js';
import { canReturnInvoice } from './returns.js';
import { downloadFile } from '@/lib/fileStore.js';
import {
  ACTIVITY,
  badgeOf,
  canDelete,
  canEdit,
  canPay,
  canRequestWaiver,
  canResend,
  canSend,
  canVoid,
  activePayments,
  computeTotals,
  formatDate,
  formatDateTime,
  lastSend,
  lateFeePolicyLabel,
  lineAmount,
  rupiah,
  statusOf,
  taxLabel,
  useCustomer,
  waiverPending,
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

// Satu penerimaan pembayaran, lengkap dengan bukti transfer yang diunggah.
function PaymentRow({ payment, onVoid }) {
  const account = depositAccounts.find((a) => a.value === payment.account)?.label ?? payment.account;
  const proofs = payment.proofs ?? [];
  const batal = !!payment.cancelledAt;
  return (
    <Box
      p="sm"
      style={{
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 'var(--mantine-radius-md)',
      }}
    >
      <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
        <Box style={{ minWidth: 0 }}>
          <Group gap={6} wrap="nowrap">
            <Text fz="sm" fw={600} c={batal ? 'slate.5' : 'slate.9'}>
              {formatDate(payment.date)} · {payment.method}
            </Text>
            {batal && (
              <Badge size="xs" radius="sm" variant="light" color="red">
                DIBATALKAN
              </Badge>
            )}
          </Group>
          <Text fz={11} c="slate.6">
            Disetor ke {account}
          </Text>
          {payment.memo && (
            <Text fz={11} c="slate.6">
              {payment.memo}
            </Text>
          )}
          {/* B3: alasan dan waktu pembatalan ikut terbaca, supaya koreksinya bisa ditelusuri. */}
          {batal && (
            <Text fz={11} c="red.7">
              Dibatalkan {formatDateTime(payment.cancelledAt)}
              {payment.cancelReason ? ` — ${payment.cancelReason}` : ''}
            </Text>
          )}
        </Box>
        <Stack gap={4} align="flex-end">
          <Text
            fz="sm"
            fw={700}
            c={batal ? 'slate.5' : 'green.8'}
            style={{ whiteSpace: 'nowrap', textDecoration: batal ? 'line-through' : 'none' }}
          >
            {rupiah(payment.amount)}
          </Text>
          {!batal && onVoid && (
            <Button
              size="compact-xs"
              variant="subtle"
              color="red"
              radius="md"
              leftSection={<Prohibit size={13} />}
              onClick={onVoid}
            >
              Batalkan
            </Button>
          )}
        </Stack>
      </Group>
      {payment.tags?.length > 0 && (
        <Group gap={6} mt="xs">
          {payment.tags.map((name) => (
            <Badge key={name} size="sm" radius="sm" variant="light" color="slate" tt="none">
              {name}
            </Badge>
          ))}
        </Group>
      )}
      {proofs.length > 0 && (
        <Group gap="xs" mt="xs">
          {proofs.map((name) => (
            <Button
              key={name}
              size="compact-xs"
              variant="light"
              color="slate"
              radius="md"
              leftSection={<Paperclip size={13} />}
              onClick={() => downloadFile(name)}
            >
              {name}
            </Button>
          ))}
        </Group>
      )}
    </Box>
  );
}

export default function SaleDetail({ sale, source, onBack, onPay, onCreateLink, actions }) {
  const t = computeTotals(sale);
  const status = statusOf(sale);
  const badge = badgeOf(sale);
  const customer = useCustomer(sale.customerId);
  const term = paymentTerms.find((p) => p.value === sale.term)?.label ?? '—';
  const sent = lastSend(sale);
  const hasTax = sale.items.some((l) => l.tax);
  // B7: dasar progres adalah tagihan setelah retur, bukan nilai faktur mula-mula.
  const paidPct = t.billed > 0 ? Math.min(100, Math.round((t.paid / t.billed) * 100)) : 100;
  // B3: pembayaran batal tetap tampil di riwayat, tapi tidak ikut dihitung.
  const berlaku = activePayments(sale);
  const dibatalkan = (sale.payments ?? []).length - berlaku.length;
  const docReturns = sale.returns ?? [];
  // #29: denda keterlambatan. Faktur biasa: denda yang belum ditagih dan faktur dendanya.
  // Faktur denda: faktur asal, periodenya, dan status penghapusannya.
  const feeFor = sale.lateFeeFor;
  const policy = actions.lateFeePolicy(sale);
  const fee = actions.lateFeeOf(sale);
  const feeInvoices = feeFor ? [] : actions.lateFeeInvoices(sale);
  const showFeeCard = !feeFor && !sale.draft && !sale.cancelledAt && (fee.amount > 0 || fee.inGrace || feeInvoices.length > 0);
  const waived = sale.waiver?.status === 'disetujui';
  const returnsDeducted = docReturns
    .filter((r) => r.settlement === 'deduct')
    .reduce((n, r) => n + r.amount, 0);

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <BackLink label="Daftar faktur" onClick={onBack} />

      <PageIntro
        icon={Invoice}
        title="Detail penjualan"
        description="Rincian faktur, pembayaran, dan dokumen penjualan."
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
              <StatusBadge status={badge} />
            </Box>
            <Text fz="xs" c="slate.7">
              {customer?.name}
            </Text>
          </Box>
          {/* Satu tombol utama sesuai keadaan faktur, satu tombol unduh, sisanya di menu.
              Sebelumnya sampai lima tombol berjajar dan tidak ada yang menonjol. */}
          <Group gap="xs" wrap="nowrap">
            <Button
              variant="default"
              radius="md"
              leftSection={<DownloadSimple size={16} />}
              onClick={() => downloadInvoice(sale, { customer })}
            >
              Unduh PDF
            </Button>
            {canSend(sale) && (
              <Button
                radius="md"
                leftSection={<PaperPlaneTilt size={16} />}
                onClick={() => actions.send(sale)}
              >
                Kirim faktur
              </Button>
            )}
            {canPay(sale) && (
              <Button radius="md" leftSection={<Invoice size={16} />} onClick={onPay}>
                Catat pembayaran
              </Button>
            )}
            <Menu position="bottom-end" withinPortal shadow="md" width={220}>
              <Menu.Target>
                <ActionIcon variant="default" size="lg" radius="md" aria-label="Aksi lainnya">
                  <DotsThreeVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {canEdit(sale) && (
                  <Menu.Item
                    fz="xs"
                    leftSection={<PencilSimple size={14} />}
                    onClick={() => actions.edit(sale)}
                  >
                    Ubah faktur
                  </Menu.Item>
                )}
                {canResend(sale) && (
                  <Menu.Item
                    fz="xs"
                    leftSection={<EnvelopeSimple size={14} />}
                    onClick={() => actions.resend(sale)}
                  >
                    Kirim ulang email
                  </Menu.Item>
                )}
                <Menu.Item
                  fz="xs"
                  leftSection={<Notebook size={14} />}
                  onClick={() => actions.journal(sale)}
                >
                  Lihat jurnal
                </Menu.Item>
                {/* B4: faktur batal tidak dikirim atau ditautkan lagi ke pelanggan. */}
                {status !== 'cancelled' && (
                  <Menu.Item fz="xs" leftSection={<Link size={14} />} onClick={onCreateLink}>
                    {sale.invoiceLink ? 'Salin tautan faktur' : 'Buat tautan faktur'}
                  </Menu.Item>
                )}
                <Menu.Item
                  fz="xs"
                  leftSection={<Copy size={14} />}
                  onClick={() => actions.duplicate(sale)}
                >
                  Duplikat faktur
                </Menu.Item>
                {fee.amount > 0 && (
                  <Menu.Item
                    fz="xs"
                    leftSection={<Warning size={14} />}
                    onClick={() => actions.lateFee(sale)}
                  >
                    Buat faktur denda
                  </Menu.Item>
                )}
                {canRequestWaiver(sale) && (
                  <Menu.Item
                    fz="xs"
                    leftSection={<HandCoins size={14} />}
                    onClick={() => actions.requestWaiver(sale)}
                  >
                    Ajukan penghapusan denda
                  </Menu.Item>
                )}
                {canReturnInvoice(sale) && (
                  <Menu.Item
                    fz="xs"
                    leftSection={<ArrowCounterClockwise size={14} />}
                    onClick={() => actions.makeReturn(sale)}
                  >
                    Buat retur
                  </Menu.Item>
                )}
                {(canVoid(sale) || canDelete(sale)) && <Menu.Divider />}
                {canVoid(sale) && (
                  <Menu.Item
                    fz="xs"
                    color="red"
                    leftSection={<Prohibit size={14} />}
                    onClick={() => actions.void(sale)}
                  >
                    Batalkan faktur
                  </Menu.Item>
                )}
                {canDelete(sale) && (
                  <>
                    <Menu.Item
                      fz="xs"
                      color="red"
                      leftSection={<Trash size={14} />}
                      onClick={() => actions.remove(sale)}
                    >
                      Hapus faktur
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

        {waiverPending(sale) && (
          <Alert variant="light" color="orange" radius="md" icon={<HandCoins size={16} />} mt="md" title="Penghapusan denda menunggu persetujuan">
            <Text fz="xs">
              Diajukan {sale.waiver.by} pada {formatDateTime(sale.waiver.at)} — {sale.waiver.reason}. Selama menunggu,
              faktur denda ini tetap menagih.
            </Text>
            {actions.canDecideWaiver(sale) && (
              <Group gap="xs" mt="sm">
                <Button size="xs" radius="md" leftSection={<Check size={14} />} onClick={() => actions.approveWaiver(sale)}>
                  Setujui penghapusan
                </Button>
                <Button size="xs" radius="md" variant="default" onClick={() => actions.rejectWaiver(sale)}>
                  Tolak
                </Button>
              </Group>
            )}
          </Alert>
        )}
        {sale.waiver?.status === 'ditolak' && !sale.cancelledAt && (
          <Alert variant="light" color="slate" radius="md" icon={<HandCoins size={16} />} mt="md">
            <Text fz="xs">
              Penghapusan denda ditolak {sale.waiver.decidedBy} pada {formatDateTime(sale.waiver.decidedAt)}
              {sale.waiver.note ? ` — ${sale.waiver.note}` : ''}. Denda tetap ditagih.
            </Text>
          </Alert>
        )}
        {status === 'cancelled' && waived && (
          <Alert variant="light" color="green" radius="md" icon={<HandCoins size={16} />} mt="md" title="Denda dihapuskan">
            <Text fz="xs">
              Disetujui {sale.waiver.decidedBy} pada {formatDateTime(sale.waiver.decidedAt)}. Alasan: {sale.waiver.reason}.
              Jurnalnya dibalik dan periode dendanya dianggap selesai, jadi tidak ditagih ulang.
            </Text>
          </Alert>
        )}
        {status === 'cancelled' && !waived && (
          <Alert variant="light" color="red" radius="md" icon={<Prohibit size={16} />} mt="md">
            <Text fz="xs">
              Dibatalkan pada {formatDateTime(sale.cancelledAt)}
              {sale.cancelReason ? ` — ${sale.cancelReason}` : ''}. Jurnalnya sudah dibalik dan
              faktur ini tidak lagi dihitung sebagai piutang.
            </Text>
          </Alert>
        )}

        {/* Progres pembayaran: menggantikan baris "Sudah dibayar" yang dulu diulang
            di kaki tabel, dan sekaligus menunjukkan seberapa jauh tagihan tertutup. */}
        {!['draft', 'cancelled'].includes(status) && (
          <Box mt="md">
            <Group justify="space-between" gap="sm" mb={6}>
              <Text fz={11} fw={600} c="slate.7">
                Progres pembayaran
              </Text>
              <Text fz={11} c="slate.6">
                {paidPct}% terbayar
              </Text>
            </Group>
            <Progress value={paidPct} size="sm" radius="xl" color={paidPct >= 100 ? 'green' : 'primary.9'} />
            <Text fz={11} c="slate.6" mt={6}>
              {rupiah(t.paid)} diterima dari {rupiah(t.billed)}
              {t.returned > 0 && ` (setelah retur ${rupiah(t.returned)})`}
            </Text>
          </Box>
        )}
      </Card>

      <Grid gutter="md" align="flex-start">
        {/* Barang dan jasa */}
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card withBorder radius="lg" padding="lg" bg="white">
            <Group gap="sm" mb="md" wrap="nowrap">
              <ThemeIcon variant="light" bg="slate.0" c="slate.7" size={32} radius="md">
                <Invoice size={16} />
              </ThemeIcon>
              <Box>
                <Text fw={700} fz="sm" c="slate.9">
                  Barang dan jasa
                </Text>
                <Text fz={11} c="slate.6">
                  {sale.items.length} baris ditagihkan
                </Text>
              </Box>
            </Group>

            {/* Kolom dan bingkainya disamakan dengan tabel baris di form faktur,
                supaya rincian terbaca sebagai tabel yang sama dalam keadaan terkunci. */}
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
                        {line.returnedQty > 0 && (
                          <Text fz={11} c="orange.8" fw={600}>
                            {line.returnedQty} diretur
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

            {/* Berhenti di Total faktur. Sudah dibayar dan sisa tagihan sudah ada di
                kartu atas, jadi tidak diulang lagi di sini. */}
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
              <SummaryRow strong label="Total faktur" value={rupiah(t.total)} />
              {/* Retur yang memotong tagihan mengurangi sisa, bukan total fakturnya:
                  nilai faktur yang pernah terbit tidak diubah belakangan. */}
              {returnsDeducted > 0 && (
                <>
                  <SummaryRow
                    label="Retur"
                    value={`-${rupiah(returnsDeducted)}`}
                    color="orange.8"
                  />
                  <SummaryRow
                    strong
                    label="Tagihan setelah retur"
                    value={rupiah(Math.max(t.total - returnsDeducted, 0))}
                  />
                </>
              )}
            </Box>
          </Card>

          {sale.payments.length > 0 && (
            <Card withBorder radius="lg" padding="lg" bg="white" mt="md">
              <Group gap="sm" mb="md" wrap="nowrap">
                <ThemeIcon variant="light" bg="slate.0" c="slate.7" size={32} radius="md">
                  <HandCoins size={16} />
                </ThemeIcon>
                <Box>
                  <Text fw={700} fz="sm" c="slate.9">
                    Riwayat pembayaran
                  </Text>
                  <Text fz={11} c="slate.6">
                    {berlaku.length} penerimaan · {rupiah(t.paid)} diterima
                    {dibatalkan > 0 ? ` · ${dibatalkan} dibatalkan` : ''}
                  </Text>
                </Box>
              </Group>
              <Stack gap="xs">
                {sale.payments.map((p, i) => (
                  <PaymentRow
                    key={i}
                    payment={p}
                    onVoid={actions?.voidPayment && (() => actions.voidPayment(sale, i))}
                  />
                ))}
              </Stack>
            </Card>
          )}
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

            {showFeeCard && (
              <SideCard icon={Warning} title="Denda keterlambatan">
                <Stack gap="sm">
                  <Field label="Aturan">
                    {lateFeePolicyLabel(policy)}
                    {policy && <Text span fz={11} c="slate.6">{policy.custom ? ' · sesuai kontrak' : ' · aturan bawaan'}</Text>}
                  </Field>
                  {fee.inGrace && (
                    <Text fz="xs" c="slate.7">Masih dalam masa tenggang sampai {formatDate(fee.graceEnds)}. Kalau lunas sebelum itu, tidak ada denda.</Text>
                  )}
                  {fee.amount > 0 && (
                    <Box p="sm" bg="orange.0" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
                      <Text fz={11} fw={600} c="orange.9">Belum ditagih</Text>
                      <Text fz="lg" fw={700} c="orange.9">{rupiah(fee.amount)}</Text>
                      <Text fz={11} c="slate.7">
                        {fee.days} hari · {formatDate(fee.from)} – {formatDate(fee.until)}
                        {fee.segments.length > 1 ? ` · ${fee.segments.length} porsi sisa tagihan` : ''}
                      </Text>
                      <Button size="xs" radius="md" mt="xs" leftSection={<Warning size={14} />} onClick={() => actions.lateFee(sale)}>
                        Buat faktur denda
                      </Button>
                    </Box>
                  )}
                  {feeInvoices.length > 0 && (
                    <Stack gap={4}>
                      <Text fz={11} fw={600} c="slate.6">Sudah ditagih</Text>
                      {feeInvoices.map((f) => (
                        <Group key={f.id} justify="space-between" gap="xs" wrap="nowrap">
                          <Anchor fz="xs" fw={600} onClick={() => actions.open(f.id)}>{f.number}</Anchor>
                          <Text fz={11} c="slate.6" ta="right">
                            {formatDate(f.lateFeeFor.from)} – {formatDate(f.lateFeeFor.until)}
                            {f.draft ? ' · draf' : f.waiver?.status === 'disetujui' ? ' · dihapuskan' : ''}
                          </Text>
                        </Group>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </SideCard>
            )}

            {feeFor && (
              <SideCard icon={Warning} title="Denda atas faktur">
                <Stack gap="sm">
                  <Field label="Faktur asal">
                    <Anchor fz="sm" fw={600} onClick={() => actions.open(feeFor.saleId)}>{feeFor.saleNumber}</Anchor>
                  </Field>
                  <Field label="Periode denda">{formatDate(feeFor.from)} – {formatDate(feeFor.until)} ({feeFor.days} hari)</Field>
                  <Field label="Tarif">{lateFeePolicyLabel({ rate: feeFor.rate, basis: feeFor.basis, grace: 0 }).split(' · ')[0]}</Field>
                </Stack>
              </SideCard>
            )}

            {docReturns.length > 0 && (
              <SideCard icon={ArrowCounterClockwise} title="Retur dari faktur ini">
                <Stack gap="xs">
                  {docReturns.map((r) => (
                    <Group key={r.id} justify="space-between" wrap="nowrap" align="flex-start">
                      <Box>
                        <Anchor
                          fz="sm"
                          fw={600}
                          component="button"
                          onClick={() => {
                            window.location.hash = formatHash({ name: 'return', id: r.id });
                            window.scrollTo({ top: 0 });
                          }}
                        >
                          {r.number}
                        </Anchor>
                        <Text fz={11} c="slate.6">
                          {formatDate(r.date)} ·{' '}
                          {r.settlement === 'deduct' ? 'Potong tagihan' : 'Kredit pelanggan'}
                        </Text>
                      </Box>
                      <Text fz="sm" fw={700} c="orange.8" style={{ whiteSpace: 'nowrap' }}>
                        -{rupiah(r.amount)}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </SideCard>
            )}

            {source && (
              <SideCard icon={ClipboardText} title="Dokumen asal">
                <Box>
                  <Text fz={11} c="slate.6">
                    {source.kind === 'order' ? 'Dari pesanan' : 'Dari penawaran'}
                  </Text>
                  <Anchor
                    fz="sm"
                    fw={600}
                    component="button"
                    onClick={() => {
                      window.location.hash = formatHash({ name: source.kind, id: source.doc.id });
                      window.scrollTo({ top: 0 });
                    }}
                  >
                    {source.doc.number}
                  </Anchor>
                  {sale.shippingNote && (
                    <>
                      <Text fz={11} c="slate.6" mt={6}>
                        Alamat pengiriman
                      </Text>
                      <Text fz="xs" c="slate.8">
                        {sale.shippingNote}
                      </Text>
                    </>
                  )}
                </Box>
              </SideCard>
            )}

            <SideCard icon={FileText} title="Dokumen">
              <Stack gap="sm">
                {sale.invoiceLink ? (
                  <Box>
                    <Group gap={4} wrap="nowrap">
                      <Anchor href={sale.invoiceLink} target="_blank" fz="xs" truncate="end">
                        {sale.invoiceLink}
                      </Anchor>
                      <CopyIcon value={sale.invoiceLink} />
                    </Group>
                    <Button
                      size="compact-xs"
                      variant="light"
                      radius="md"
                      mt={6}
                      leftSection={<ArrowUpRight size={13} />}
                      component="a"
                      href={sale.invoiceLink}
                      target="_blank"
                    >
                      Buka halaman faktur
                    </Button>
                  </Box>
                ) : (
                  <Text fz="xs" c="slate.7">
                    Tautan faktur belum dibuat.
                  </Text>
                )}
                {/* Riwayat kirim kosong pada faktur lama yang terbit sebelum fitur ini ada. */}
                {sent ? (
                  <Field label={`Terakhir dikirim (${sale.sends.length}x)`}>
                    {formatDateTime(sent.at)} · {sent.to}
                  </Field>
                ) : (
                  <Field label="Riwayat kirim">
                    {status === 'draft' ? 'Belum pernah dikirim' : '—'}
                  </Field>
                )}
              </Stack>
            </SideCard>

            {(sale.activity ?? []).length > 0 && (
              <SideCard icon={ClockCounterClockwise} title="Riwayat aktivitas">
                <Stack gap="sm">
                  {[...sale.activity].reverse().map((a, i) => (
                    <Box key={i}>
                      <Text fz="xs" fw={600} c="slate.9">
                        {ACTIVITY[a.type] ?? a.type}
                        {a.note ? ` · ${a.note}` : ''}
                      </Text>
                      <Text fz={11} c="slate.6">
                        {formatDateTime(a.at)} · {a.by}
                      </Text>
                    </Box>
                  ))}
                </Stack>
              </SideCard>
            )}

            <SideCard icon={Tag} title="Informasi lainnya">
              <Stack gap="sm">
                {sale.unit && <Field label="Unit / Tower">{sale.unit}</Field>}
                {sale.ref && <Field label="Referensi pelanggan">{sale.ref}</Field>}
                {sale.taxInvoiceNumber && (
                  <Field label="Nomor seri faktur pajak">{sale.taxInvoiceNumber}</Field>
                )}
                {sale.dppOther > 0 && (
                  <Field label="DPP Nilai Lain">{rupiah(sale.dppOther)}</Field>
                )}
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
