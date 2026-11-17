// Rincian satu retur / nota kredit. Satu aksi utama menurut statusnya, sisanya di kebab.
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Menu,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Timeline,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  ArrowCounterClockwise,
  Check,
  DotsThreeVertical,
  Invoice as InvoiceIcon,
  Notebook,
  PencilSimple,
  Prohibit,
  Trash,
  Warning,
} from '@/components/Icon.jsx';
import { BackLink, CopyIcon, Field, StatusBadge } from './components.jsx';
import { products } from './data.js';
import {
  canDeleteReturn,
  creditPart,
  deductPart,
  canEditReturn,
  canIssueReturn,
  canVoidReturn,
  netUnitPrice,
  reasonLabel,
  RETURN_STATUS,
  returnStatus,
  settlementLabel,
} from './returns.js';
import { ACTIVITY, formatDate, formatDateTime, rupiah, taxLabel, useCustomer } from './utils.js';

const productName = (l) => products.find((p) => p.id === l.productId)?.name ?? l.description;

export default function ReturnDetail({ ret, sale, onBack, onOpenInvoice, actions }) {
  const customer = useCustomer(ret.customerId);
  const status = returnStatus(ret);
  const dipotong = deductPart(ret);
  const kredit = creditPart(ret);
  const sisaKredit = kredit - (ret.creditUsed ?? 0);

  const primary = canIssueReturn(ret) ? (
    <Button radius="md" leftSection={<Check size={16} />} onClick={() => actions.issue(ret)}>
      Terbitkan Retur
    </Button>
  ) : null;

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <BackLink label="Daftar retur" onClick={onBack} />

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
          <Box>
            <Group gap={6} wrap="nowrap">
              <Title order={3} fz="lg" c="slate.9">
                {ret.number}
              </Title>
              <CopyIcon value={ret.number} />
              <StatusBadge status={status} map={RETURN_STATUS} size="sm" />
            </Group>
            <Text fz="xs" c="slate.6">
              Nota kredit atas{' '}
              <UnstyledButton onClick={onOpenInvoice}>
                <Text component="span" fz="xs" fw={700} c="primary.9">
                  {ret.invoiceNumber}
                </Text>
              </UnstyledButton>{' '}
              · {reasonLabel(ret.reason)}
            </Text>
          </Box>
          <Group gap="xs">
            {primary}
            <Menu position="bottom-end" withinPortal shadow="md" width={220}>
              <Menu.Target>
                <ActionIcon variant="default" size="lg" radius="md" aria-label="Aksi lain">
                  <DotsThreeVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  fz="xs"
                  leftSection={<InvoiceIcon size={14} />}
                  onClick={onOpenInvoice}
                >
                  Buka Faktur Sumber
                </Menu.Item>
                <Menu.Item
                  fz="xs"
                  leftSection={<Notebook size={14} />}
                  onClick={() => actions.journal(ret)}
                >
                  Lihat Jurnal
                </Menu.Item>
                {canEditReturn(ret) && (
                  <Menu.Item
                    fz="xs"
                    leftSection={<PencilSimple size={14} />}
                    onClick={() => actions.edit(ret)}
                  >
                    Ubah Retur
                  </Menu.Item>
                )}
                {(canVoidReturn(ret) || canDeleteReturn(ret)) && <Menu.Divider />}
                {canVoidReturn(ret) && (
                  <Menu.Item
                    fz="xs"
                    color="red"
                    leftSection={<Prohibit size={14} />}
                    onClick={() => actions.void(ret)}
                  >
                    Batalkan Retur
                  </Menu.Item>
                )}
                {canDeleteReturn(ret) && (
                  <Menu.Item
                    fz="xs"
                    color="red"
                    leftSection={<Trash size={14} />}
                    onClick={() => actions.remove(ret)}
                  >
                    Hapus Retur
                  </Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        {ret.cancelledAt && (
          <Alert variant="light" color="red" radius="md" icon={<Warning size={16} />} mt="md">
            <Text fz="xs">
              Retur ini dibatalkan {formatDateTime(ret.cancelledAt)}
              {ret.cancelReason ? ` — ${ret.cancelReason}` : ''}. Jurnal pembaliknya sudah
              dibentuk, dan koreksi tagihannya tidak lagi berlaku.
            </Text>
          </Alert>
        )}

        <Divider my="md" color="gray.3" />

        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <Field label="Pelanggan">{customer?.name ?? '—'}</Field>
          <Field label="Tanggal retur">{formatDate(ret.date)}</Field>
          <Field label="Penyelesaian">
            {settlementLabel(ret.settlement)}
            {dipotong > 0 && kredit > 0 && (
              <Text fz={11} fw={400} c="slate.6">
                {rupiah(dipotong)} memotong tagihan · {rupiah(kredit)} jadi kredit
              </Text>
            )}
          </Field>
          <Field label="Nilai retur" valueProps={{ c: 'primary.9' }}>
            {rupiah(ret.total)}
          </Field>
        </SimpleGrid>

        {ret.note && (
          <Box mt="md">
            <Field label="Catatan">{ret.note}</Field>
          </Box>
        )}
      </Card>

      {kredit > 0 && !ret.draft && !ret.cancelledAt && (
        <Alert
          variant="light"
          color={sisaKredit > 0 ? 'blue' : 'green'}
          radius="md"
          icon={<ArrowCounterClockwise size={16} />}
        >
          <Text fz="xs">
            {sisaKredit > 0
              ? `Saldo kredit ${rupiah(sisaKredit)} tersedia untuk ${customer?.name ?? 'pelanggan ini'} dan bisa dipakai saat mencatat pembayaran faktur lain.`
              : `Kredit ${rupiah(kredit)} sudah terpakai seluruhnya.`}
          </Text>
        </Alert>
      )}

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Text fw={700} fz="sm" c="slate.9" mb="sm">
          Baris yang diretur
        </Text>
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
            miw={720}
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
                <Table.Th w={150} ta="right">
                  Harga netto
                </Table.Th>
                <Table.Th w={110}>Pajak</Table.Th>
                <Table.Th w={150} ta="right">
                  Total
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {ret.lines.map((l, i) => {
                const asal = sale?.items?.[l.index];
                if (!asal) return null;
                const netto = netUnitPrice(sale, asal);
                return (
                  <Table.Tr key={l.index}>
                    <Table.Td fz="xs" c="slate.6">
                      {i + 1}
                    </Table.Td>
                    <Table.Td>
                      <Text fz="sm" fw={600} c="slate.9">
                        {productName(asal)}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right" fz="sm">
                      {l.qty}
                    </Table.Td>
                    <Table.Td ta="right" fz="sm" style={{ whiteSpace: 'nowrap' }}>
                      {rupiah(netto)}
                    </Table.Td>
                    <Table.Td fz="xs" c={asal.tax ? 'slate.8' : 'slate.5'}>
                      {taxLabel(asal.tax) ?? 'Tanpa pajak'}
                    </Table.Td>
                    <Table.Td ta="right" fz="sm" fw={700} style={{ whiteSpace: 'nowrap' }}>
                      {rupiah(Math.round(netto * l.qty))}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
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
          <Group justify="space-between" py={3}>
            <Text fz="xs" c="slate.7">
              Subtotal retur
            </Text>
            <Text fz="xs" fw={600} c="slate.9">
              {rupiah(ret.subtotal)}
            </Text>
          </Group>
          {ret.tax > 0 && (
            <Group justify="space-between" py={3}>
              <Text fz="xs" c="slate.7">
                PPN dikoreksi
              </Text>
              <Text fz="xs" fw={600} c="slate.9">
                {rupiah(ret.tax)}
              </Text>
            </Group>
          )}
          <Divider my={8} color="gray.3" />
          <Group justify="space-between">
            <Text fz="sm" fw={700} c="primary.9">
              Total Retur
            </Text>
            <Text fz="md" fw={700} c="primary.9" style={{ whiteSpace: 'nowrap' }}>
              {rupiah(ret.total)}
            </Text>
          </Group>
        </Box>
      </Card>

      {ret.activity?.length > 0 && (
        <Card withBorder radius="lg" padding="lg" bg="white">
          <Text fw={700} fz="sm" c="slate.9" mb="md">
            Riwayat aktivitas
          </Text>
          <Timeline active={ret.activity.length} bulletSize={14} lineWidth={2} color="primary.9">
            {ret.activity.map((a, i) => (
              <Timeline.Item key={i} title={<Text fz="xs" fw={700}>{ACTIVITY[a.type] ?? a.type}</Text>}>
                <Text fz={11} c="slate.6">
                  {formatDateTime(a.at)} · {a.by}
                </Text>
                {a.note && (
                  <Text fz={11} c="slate.7">
                    {a.note}
                  </Text>
                )}
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      )}

      {!sale && (
        <Alert variant="light" color="orange" radius="md" icon={<Warning size={16} />}>
          <Text fz="xs">
            Faktur sumber retur ini sudah tidak ada, jadi rincian barisnya tidak bisa ditampilkan.
          </Text>
        </Alert>
      )}

      <Group gap={6}>
        <Badge size="xs" radius="sm" variant="light" color="slate" fw={700} tt="none">
          Dibuat {ret.createdAt ? formatDateTime(ret.createdAt) : '—'}
        </Badge>
        {ret.updatedAt && ret.updatedAt !== ret.createdAt && (
          <Badge size="xs" radius="sm" variant="light" color="slate" fw={700} tt="none">
            Diubah {formatDateTime(ret.updatedAt)}
          </Badge>
        )}
      </Group>
    </Stack>
  );
}
