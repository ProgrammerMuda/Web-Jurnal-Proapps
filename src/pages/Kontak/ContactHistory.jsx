import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import {
  ArrowLeft,
  ArrowsClockwise,
  Check,
  Clock,
  DownloadSimple,
  Invoice,
  Plus,
} from '@/components/Icon.jsx';
import { computeTotals, rupiah } from '@/pages/Penjualan/utils.js';
import { ContactAvatar, TypeBadges } from './components.jsx';
import InvoiceTable from './InvoiceTable.jsx';
import { canBeInvoiced } from './utils.js';

function Stat({ label, value, hint, icon: Icon, color, highlight }) {
  return (
    <Card
      withBorder
      radius="md"
      padding="md"
      bg={highlight ? 'orange.0' : 'white'}
      style={highlight ? { borderColor: 'var(--mantine-color-orange-2)' } : undefined}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text
            fz={11}
            fw={600}
            c={highlight ? 'orange.9' : 'slate.6'}
            tt="uppercase"
            style={{ letterSpacing: 0.5 }}
          >
            {label}
          </Text>
          <Text fz={20} fw={700} c={color} lh={1.4}>
            {value}
          </Text>
          <Text fz={11} c={highlight ? 'orange.8' : 'slate.6'}>
            {hint}
          </Text>
        </Box>
        <ThemeIcon
          variant={highlight ? 'filled' : 'light'}
          color={highlight ? 'orange' : 'slate'}
          size={32}
          radius="md"
        >
          <Icon size={16} />
        </ThemeIcon>
      </Group>
    </Card>
  );
}

export default function ContactHistory({
  contact,
  sales,
  onBack,
  onCreateSale,
  onOpenSale,
  onExport,
}) {
  const active = sales.filter((s) => !s.draft).map(computeTotals);
  const sum = (k) => active.reduce((n, t) => n + t[k], 0);
  const outstanding = sum('balance');

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <Card withBorder radius="lg" padding="md" bg="white">
        <Group justify="space-between">
          <Button
            variant="subtle"
            color="slate.8"
            radius="md"
            leftSection={<ArrowLeft size={16} />}
            onClick={onBack}
          >
            Kembali ke Detail Kontak
          </Button>
          <Group gap="xs">
            <ActionIcon variant="default" size="lg" radius="md" aria-label="Segarkan transaksi">
              <ArrowsClockwise size={16} />
            </ActionIcon>
            <Button
              variant="default"
              radius="md"
              leftSection={<DownloadSimple size={16} />}
              onClick={onExport}
            >
              Ekspor Transaksi
            </Button>
            {canBeInvoiced(contact) && (
              <Button radius="md" leftSection={<Plus size={16} />} onClick={onCreateSale}>
                Buat Faktur Penjualan
              </Button>
            )}
          </Group>
        </Group>
      </Card>

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" align="center" gap="md">
          <Group gap="md" wrap="nowrap">
            <ContactAvatar name={contact.displayName} size={64} />
            <Box>
              <Group gap="xs">
                <Text fz="xl" fw={700} c="slate.9">
                  {contact.displayName}
                </Text>
                <Badge size="sm" radius="sm" variant="light" color="slate" ff="monospace" tt="none">
                  {contact.number}
                </Badge>
              </Group>
              <Box mt={6}>
                <TypeBadges types={contact.types} filled />
              </Box>
            </Box>
          </Group>
          <Box
            p="md"
            ta="right"
            style={{
              border: '1px solid var(--mantine-color-gray-3)',
              borderRadius: 'var(--mantine-radius-md)',
            }}
          >
            <Text fz={11} fw={600} c="slate.7" tt="uppercase" style={{ letterSpacing: 0.5 }}>
              Total Outstanding Piutang
            </Text>
            <Text fz={24} fw={700} c={outstanding > 0 ? 'red.8' : 'green.8'}>
              {rupiah(outstanding)}
            </Text>
            <Text fz={11} c="slate.6">
              Dari {sales.length} total transaksi tercatat
            </Text>
          </Box>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <Stat
          label="Total Nilai Transaksi"
          value={rupiah(sum('total'))}
          hint="Akumulasi seluruh faktur"
          icon={Invoice}
          color="slate.9"
        />
        <Stat
          label="Total Terbayar"
          value={rupiah(sum('paid'))}
          hint="Pembayaran yang telah lunas"
          icon={Check}
          color="green.8"
        />
        <Stat
          highlight
          label="Sisa Piutang Belum Lunas"
          value={rupiah(outstanding)}
          hint="Menunggu pelunasan"
          icon={Clock}
          color="red.8"
        />
        <Stat
          label="Jumlah Faktur"
          value={`${sales.length} Transaksi`}
          hint="Total faktur tercatat di sistem"
          icon={Invoice}
          color="slate.9"
        />
      </SimpleGrid>

      <Card withBorder radius="lg" padding="lg" bg="white">
        <InvoiceTable sales={sales} variant="history" onOpenSale={onOpenSale} />
      </Card>
    </Stack>
  );
}
