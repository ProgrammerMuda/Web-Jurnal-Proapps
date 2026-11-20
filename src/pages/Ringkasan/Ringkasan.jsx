import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Paper,
  Progress,
  RingProgress,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useState } from 'react';
import {
  ArrowsClockwise,
  ArrowsLeftRight,
  ArrowUpRight,
  Bank,
  CalendarBlank,
  FileText,
  HandCoins,
  Notebook,
  PaperPlaneTilt,
  ShieldCheck,
} from '@/components/Icon.jsx';
import { auditTrail, financialPosition, quickActions, rupiah } from './data.js';
import { useSummary } from './summary.js';

const workIcons = { shield: ShieldCheck, file: FileText, calendar: CalendarBlank };
const actionIcons = {
  notebook: Notebook,
  coins: HandCoins,
  send: PaperPlaneTilt,
  transfer: ArrowsLeftRight,
};

function SectionCard({ title, description, action, children, ...rest }) {
  return (
    <Card withBorder radius="lg" p="lg" bg="white" {...rest}>
      <Group justify="space-between" align="flex-start" wrap="nowrap" mb="md">
        <Box>
          <Text fw={700} fz="sm" c="slate.9">
            {title}
          </Text>
          {description && (
            <Text fz="xs" c="slate.6">
              {description}
            </Text>
          )}
        </Box>
        {action}
      </Group>
      {children}
    </Card>
  );
}

function SoftButton({ children }) {
  return (
    <Button size="compact-xs" variant="light" radius="md" fw={600}>
      {children}
    </Button>
  );
}

function MiniBars({ values }) {
  return (
    <Group gap={4} align="flex-end" h={40} wrap="nowrap">
      {values.map((v, i) => (
        <Box
          key={i}
          w={10}
          h={`${Math.max(v, 4)}%`}
          bg={i === 0 || v === 100 ? 'primary.4' : 'slate.2'}
          style={{ borderRadius: 2 }}
        />
      ))}
    </Group>
  );
}

function KpiCard({ kpi }) {
  return (
    <Card withBorder radius="lg" p="lg" bg="white">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Text fz="xs" c="slate.7" fw={500}>
          {kpi.label}
        </Text>
        <ArrowUpRight size={14} color="var(--mantine-color-slate-5)" />
      </Group>
      <Group justify="space-between" align="flex-end" mt="sm" wrap="nowrap">
        <Box>
          <Title order={3} fz={22} c="slate.9" style={{ whiteSpace: 'nowrap' }}>
            {kpi.value}
          </Title>
          <Text fz="xs" c="slate.6" mt={4}>
            {kpi.sub}
          </Text>
        </Box>
        <Stack gap={2} align="center">
          {kpi.kind === 'bars' && <MiniBars values={kpi.bars} />}
          {kpi.kind === 'ring' && (
            <RingProgress
              size={56}
              thickness={5}
              roundCaps
              sections={[{ value: kpi.ring, color: 'primary.9' }]}
              label={
                <Text ta="center" fz={10} fw={700} c="slate.8">
                  {kpi.ring}%
                </Text>
              }
            />
          )}
          {kpi.kind === 'meter' && (
            <Box w={76}>
              <Text ta="right" fz="lg" fw={700} c="orange.8" lh={1.2}>
                {kpi.meter}%
              </Text>
              <Progress value={kpi.meter} color="orange.6" size={5} radius="xl" />
            </Box>
          )}
          <Text fz={11} c="slate.6">
            {kpi.caption}
          </Text>
        </Stack>
      </Group>
    </Card>
  );
}

function BillingChart({ billing }) {
  const { months, max, ticks } = billing;
  const h = 150;
  return (
    <Group align="stretch" gap="sm" wrap="nowrap" mt="sm">
      <Stack justify="space-between" h={h} gap={0} style={{ flexShrink: 0 }}>
        {ticks.map((t) => (
          <Text key={t} fz={11} c="slate.6" ta="right" lh={1}>
            {t}
          </Text>
        ))}
      </Stack>
      <Box flex={1}>
        <Box
          h={h}
          pos="relative"
          style={{ borderBottom: '1px solid var(--mantine-color-slate-2)' }}
        >
          {ticks.map((_, i) => (
            <Box
              key={i}
              pos="absolute"
              left={0}
              right={0}
              top={`${(i / (ticks.length - 1)) * 100}%`}
              style={{ borderTop: '1px solid var(--mantine-color-slate-1)' }}
            />
          ))}
          <Group h="100%" gap={0} wrap="nowrap" align="flex-end" pos="relative">
            {months.map((d) => (
              <Group
                key={d.m}
                flex={1}
                h="100%"
                justify="center"
                align="flex-end"
                gap={4}
                wrap="nowrap"
              >
                <Box
                  w={28}
                  h={`${(d.billed / max) * 100}%`}
                  bg="primary.9"
                  style={{ borderRadius: '4px 4px 0 0' }}
                />
                <Box
                  w={20}
                  h={`${(d.paid / max) * 100}%`}
                  bg="slate.3"
                  style={{ borderRadius: '4px 4px 0 0' }}
                />
              </Group>
            ))}
          </Group>
        </Box>
        <Group gap={0} wrap="nowrap" mt={8}>
          {months.map((d) => (
            <Text key={d.m} flex={1} ta="center" fz={11} c="slate.6">
              {d.m}
            </Text>
          ))}
        </Group>
      </Box>
    </Group>
  );
}

function BillingCard({ billing }) {
  return (
    <SectionCard
      title="Tagihan & penerimaan"
      description="Enam bulan berdasarkan bulan terbit faktur: nilai tagihan dan pembayaran yang telah diterima."
      action={
        <Badge variant="light" radius="md" size="md" style={{ flexShrink: 0 }}>
          Koleksi {billing.koleksi}%
        </Badge>
      }
    >
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        {billing.totals.map((t) => (
          <Box key={t.label}>
            <Text fz="xs" c="slate.7">
              {t.label}
            </Text>
            <Title order={3} fz={22} c="slate.9">
              {t.value}
            </Title>
          </Box>
        ))}
      </SimpleGrid>
      <Group gap="lg" mt="md">
        <Group gap={6}>
          <Box w={10} h={10} bg="primary.9" style={{ borderRadius: 3 }} />
          <Text fz="xs" c="slate.7">
            Ditagihkan (Faktur)
          </Text>
        </Group>
        <Group gap={6}>
          <Box w={10} h={10} bg="slate.3" style={{ borderRadius: 3 }} />
          <Text fz="xs" c="slate.7">
            Terbayar (Kas Masuk)
          </Text>
        </Group>
      </Group>
      <BillingChart billing={billing} />
    </SectionCard>
  );
}

function WorkTodayCard({ workToday }) {
  return (
    <Card radius="lg" p="lg" bg="primary.9" c="white" h="100%">
      <Title order={4} c="white" fz="lg">
        Pekerjaan hari ini
      </Title>
      <Text fz="xs" c="primary.1" mb="md">
        Tinjau persetujuan dan lanjutkan draf transaksi.
      </Text>

      <Stack gap="xs">
        {workToday.map((w) => {
          const Icon = workIcons[w.icon];
          return (
            <Paper key={w.label} px="md" py="sm" radius="md" bg="rgba(255,255,255,0.08)" c="white">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                  <Icon size={18} />
                  <Text fz="xs" fw={600} c="white">
                    {w.label}
                  </Text>
                </Group>
                <Badge size="sm" radius="sm" color="white" c="primary.9" variant="filled">
                  {w.count}
                </Badge>
              </Group>
            </Paper>
          );
        })}
      </Stack>

      <Text fz="xs" c="primary.1" mt="lg" mb="xs">
        Aksi Transaksi Instan
      </Text>
      <SimpleGrid cols={2} spacing="xs">
        {quickActions.map((a) => {
          const Icon = actionIcons[a.icon];
          return (
            <UnstyledButton
              key={a.label}
              px="sm"
              py={8}
              bg="rgba(255,255,255,0.08)"
              style={{ borderRadius: 'var(--mantine-radius-md)' }}
            >
              <Group gap="xs" wrap="nowrap">
                <Icon size={16} color="white" />
                <Text fz="xs" fw={500} c="white">
                  {a.label}
                </Text>
              </Group>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>
    </Card>
  );
}

function InvoiceRow({ row }) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon variant="light" color="slate" size={36} radius="md">
          <Bank size={18} />
        </ThemeIcon>
        <Box>
          <Text fz="sm" fw={600} c="slate.9" lh={1.3}>
            {row.name}
          </Text>
          <Group gap={6}>
            <Badge size="xs" variant="light" color="slate" radius="sm">
              {row.countLabel ?? `${row.count} faktur`}
            </Badge>
            <Text fz="xs" c="slate.6">
              Jatuh tempo: {row.due}
            </Text>
          </Group>
        </Box>
      </Group>
      <Stack gap={2} align="flex-end">
        <Text fz="sm" fw={700} c="slate.9">
          {rupiah(row.amount)}
        </Text>
        {row.late && (
          <Badge size="xs" variant="light" color="orange" radius="sm">
            Tertunggak
          </Badge>
        )}
      </Stack>
    </Group>
  );
}

function CollectionCard({ priority, recentInvoices }) {
  const [tab, setTab] = useState('priority');
  const rows = tab === 'priority' ? priority : recentInvoices;
  return (
    <Card withBorder radius="lg" p="lg" bg="white" h="100%">
      <Group justify="space-between" mb="md">
        <SegmentedControl
          size="xs"
          radius="md"
          value={tab}
          onChange={setTab}
          data={[
            { value: 'priority', label: 'Prioritas Penagihan' },
            { value: 'recent', label: 'Faktur Terbaru' },
          ]}
        />
        <Button variant="subtle" size="compact-xs" fw={600}>
          Lihat Penjualan
        </Button>
      </Group>
      <Stack gap="md">
        {rows.length === 0 ? (
          <Text fz="xs" c="slate.6">
            Belum ada faktur yang perlu ditagih.
          </Text>
        ) : (
          rows.map((r) => <InvoiceRow key={r.key} row={r} />)
        )}
      </Stack>
    </Card>
  );
}

function AgingCard({ aging }) {
  return (
    <SectionCard
      title="Umur piutang"
      description="Klasifikasi sisa tagihan berdasarkan tingkat keterlambatan"
      h="100%"
    >
      <Group justify="space-between" align="baseline" mb="md">
        <Title order={3} fz={22} c="slate.9">
          {aging.total}
        </Title>
        <Text fz="xs" c="slate.6">
          {aging.invoices} faktur
        </Text>
      </Group>
      <Stack gap="md">
        {aging.rows.map((r) => (
          <Box key={r.label}>
            <Group justify="space-between">
              <Text fz="xs" c="slate.7">
                {r.label}
              </Text>
              <Text fz="xs" c="slate.6">
                {r.invoices} faktur
              </Text>
            </Group>
            <Group justify="space-between">
              <Text fz="sm" fw={700} c="slate.9">
                {rupiah(r.amount)}
              </Text>
              <Text fz="xs" c="slate.6">
                {r.pct}%
              </Text>
            </Group>
            <Progress value={r.pct} color={r.color} size={6} radius="xl" mt={4} />
          </Box>
        ))}
      </Stack>
    </SectionCard>
  );
}

function CashDistributionCard({ cashAccounts }) {
  return (
    <SectionCard
      title="Distribusi kas & bank"
      description="Posisi saldo riil pada masing-masing akun kas dan bank operasional"
      action={<SoftButton>Kelola Kas & Bank</SoftButton>}
      h="100%"
    >
      <ScrollArea h={290} type="always" offsetScrollbars>
        <Stack gap="md">
          {cashAccounts.map((a) => (
            <Box key={a.code}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon variant="light" color="primary" size={28} radius="md">
                    <Bank size={16} />
                  </ThemeIcon>
                  <Box>
                    <Text fz="xs" fw={600} c="slate.9" lh={1.3}>
                      {a.name}
                    </Text>
                    <Text fz={11} c="slate.6">
                      {a.code}
                    </Text>
                  </Box>
                </Group>
                <Box ta="right">
                  <Text fz="xs" fw={700} c={a.amount < 0 ? 'red.7' : 'slate.9'} lh={1.3}>
                    {rupiah(a.amount)}
                  </Text>
                  <Text fz={11} c="slate.6">
                    {a.pct}% dari saldo positif
                  </Text>
                </Box>
              </Group>
              <Progress value={a.pct} color="primary.5" size={6} radius="xl" mt={6} />
            </Box>
          ))}
        </Stack>
      </ScrollArea>
    </SectionCard>
  );
}

function FinancialPositionCard() {
  const p = financialPosition;
  const parts = [
    { label: 'Total Aset', value: p.assets, op: null },
    { label: 'Kewajiban', value: p.liabilities, op: '=' },
    { label: 'Ekuitas', value: p.equity, op: '+' },
  ];
  return (
    <SectionCard
      title="Posisi keuangan"
      description={`Posisi keseimbangan neraca per ${p.asOf}`}
      action={<SoftButton>Buka Neraca</SoftButton>}
      h="100%"
    >
      <Group justify="space-between" mb="md">
        <Text fz="sm" fw={600} c="slate.9">
          Ringkasan Posisi Keuangan
        </Text>
        <Badge size="xs" variant="light" color="slate" radius="xl">
          Neraca seimbang
        </Badge>
      </Group>

      <SimpleGrid cols={3} mb="lg">
        {parts.map((x) => (
          <Box key={x.label}>
            <Text fz="xs" c="slate.7">
              {x.label}
            </Text>
            <Group gap={4} wrap="nowrap" align="baseline">
              {x.op && (
                <Text fz="xs" c="slate.6">
                  {x.op}
                </Text>
              )}
              <Text fz="md" fw={700} c="slate.9">
                {x.value}
              </Text>
            </Group>
          </Box>
        ))}
      </SimpleGrid>

      <Text fz="xs" c="slate.7" mb={6}>
        Sumber pendanaan aset
      </Text>
      <Progress.Root size={10} radius="xl">
        <Progress.Section value={p.liabilitiesPct} color="slate.3" />
        <Progress.Section value={p.equityPct} color="primary.9" />
      </Progress.Root>
      <Group justify="space-between" mt={6}>
        <Text fz="xs" c="slate.7">
          Kewajiban {p.liabilitiesPct}%
        </Text>
        <Text fz="xs" c="slate.7">
          Ekuitas {p.equityPct}%
        </Text>
      </Group>

      <Group
        justify="space-between"
        mt="lg"
        pt="md"
        style={{ borderTop: '1px solid var(--mantine-color-slate-2)' }}
      >
        <Box>
          <Text fz="sm" fw={600} c="slate.9">
            Modal Kerja Bersih
          </Text>
          <Text fz="xs" c="slate.6">
            Aset lancar dikurangi kewajiban lancar
          </Text>
        </Box>
        <Text fz="md" fw={700} c="primary.9">
          {p.workingCapital}
        </Text>
      </Group>
    </SectionCard>
  );
}

function AuditTrailCard() {
  return (
    <SectionCard
      title="Jejak Audit Buku Besar"
      description="Riwayat aktivitas pencatatan dan perubahan jurnal terbaru"
    >
      <ScrollArea h={290} type="always" offsetScrollbars>
        <Stack gap={0}>
          {auditTrail.map((e, i) => (
            <Group key={e.no} gap="sm" align="flex-start" wrap="nowrap" pb="md" pos="relative">
              <Stack gap={0} align="center" style={{ alignSelf: 'stretch' }}>
                <ThemeIcon variant="light" color="green" size={28} radius="xl">
                  <FileText size={14} />
                </ThemeIcon>
                {i < auditTrail.length - 1 && <Box flex={1} w={1} bg="slate.2" mt={2} />}
              </Stack>
              <Box>
                <Text fz="xs" c="slate.9">
                  <Text span fw={e.who === '—' ? 400 : 700} inherit>
                    {e.who}
                  </Text>{' '}
                  membuat jurnal{' '}
                  <Text span fw={700} c="primary.9" ff="monospace" inherit>
                    {e.no}
                  </Text>
                </Text>
                <Text fz={11} c="slate.6">
                  {e.at}
                </Text>
              </Box>
            </Group>
          ))}
        </Stack>
      </ScrollArea>
    </SectionCard>
  );
}

export default function Ringkasan() {
  // B4: satu sumber angka untuk seluruh halaman, dihitung dari faktur di store —
  // sama persis dengan yang dibaca halaman Faktur Penjualan.
  const s = useSummary();
  return (
    <Stack gap="lg" p="lg">
      <Group justify="space-between">
        <Title order={2} fz={24} c="slate.9">
          Selamat siang, Finance
        </Title>
        <Group gap="xs">
          <ActionIcon variant="default" size="lg" radius="md" aria-label="Muat ulang">
            <ArrowsClockwise size={18} />
          </ActionIcon>
          <Button radius="md" leftSection={<Notebook size={18} />}>
            Buat Jurnal
          </Button>
        </Group>
      </Group>

      <Box>
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          {s.kpis.map((k) => (
            <KpiCard key={k.key} kpi={k} />
          ))}
        </SimpleGrid>
        <Text fz="xs" c="slate.6" mt="xs">
          Angka penjualan dan piutang dihitung dari seluruh faktur penjualan yang tercatat,
          sumber yang sama dengan halaman Faktur Penjualan.
        </Text>
      </Box>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <BillingCard billing={s.billing} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <WorkTodayCard workToday={s.workToday} />
        </Grid.Col>
      </Grid>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <CollectionCard priority={s.priority} recentInvoices={s.recentInvoices} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <AgingCard aging={s.aging} />
        </Grid.Col>
      </Grid>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <CashDistributionCard cashAccounts={s.cashAccounts} />
        <FinancialPositionCard />
      </SimpleGrid>

      <AuditTrailCard />
    </Stack>
  );
}
