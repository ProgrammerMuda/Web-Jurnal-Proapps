import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowsLeftRight,
  Book,
  Books,
  ChartBar,
  ChartPieSlice,
  CheckCircle,
  ClipboardText,
  CurrencyCircleDollar,
  Database,
  DownloadSimple,
  FileText,
  MagnifyingGlass,
  Money,
  Notebook,
  Scales,
  SquaresFour,
  Table,
  TrendUp,
} from '@/components/Icon.jsx';
import { categories, heroStats, reports } from './data.js';

const statIcons = {
  file: FileText,
  database: Database,
  download: DownloadSimple,
  check: CheckCircle,
};
const tabIcons = {
  all: SquaresFour,
  keuangan: ClipboardText,
  buku: Notebook,
  anggaran: FileText,
};
const reportIcons = {
  book: Book,
  scales: Scales,
  chart: ChartBar,
  table: Table,
  money: Money,
  trend: TrendUp,
  transfer: ArrowsLeftRight,
  pie: ChartPieSlice,
  budget: CurrencyCircleDollar,
};

function PageIntro() {
  return (
    <Card withBorder radius="lg" p="lg" bg="white">
      <Group gap="md" wrap="nowrap" align="flex-start">
        <ThemeIcon size={40} radius="md" color="primary.9">
          <Books size={22} />
        </ThemeIcon>
        <Box>
          <Title order={3} fz="lg" c="slate.9">
            Pusat Laporan Keuangan
          </Title>
          <Text fz="xs" c="slate.6" maw={520}>
            Akses seluruh ringkasan kinerja keuangan, pergerakan kas, buku besar, dan jurnal
            transaksi bisnis secara transparan dan terintegrasi.
          </Text>
        </Box>
      </Group>
    </Card>
  );
}

function Hero() {
  return (
    <Card
      withBorder
      radius="lg"
      p="lg"
      style={{
        background:
          'linear-gradient(135deg, var(--mantine-color-primary-0) 0%, var(--mantine-color-secondary-0) 55%, white 100%)',
      }}
    >
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Stack gap="sm" align="flex-start" justify="center">
          <Badge
            size="sm"
            radius="sm"
            color="primary.9"
            leftSection={<CheckCircle size={12} />}
            style={{ letterSpacing: 0.5 }}
          >
            Sistem laporan keuangan terpadu
          </Badge>
          <Title order={1} fz={{ base: 26, md: 34 }} lh={1.2} c="slate.9">
            Laporan Akurat & Real-Time untuk Keputusan Bisnis Cepat
          </Title>
          <Text fz="xs" c="slate.7" maw={620}>
            Dirancang mengikuti Standar Akuntansi Keuangan (SAK) Indonesia. Dapatkan visibilitas
            penuh atas neraca, arus kas, laba rugi, serta jejak audit mutasi debit-kredit di Buku
            Besar.
          </Text>
          <Group gap="sm" mt="xs">
            <Button size="sm" radius="md" leftSection={<Notebook size={16} />}>
              Buka Buku Besar
            </Button>
            <Button size="sm" radius="md" variant="default" bg="white">
              Lihat Laporan Finansial
            </Button>
          </Group>
        </Stack>

        <SimpleGrid cols={2} spacing="sm" verticalSpacing="sm">
          {heroStats.map((s) => {
            const Icon = statIcons[s.icon];
            return (
              <Card key={s.label} withBorder radius="md" p="md" bg="white">
                <ThemeIcon
                  variant="light"
                  bg="secondary.0"
                  c="secondary.7"
                  size={32}
                  radius="md"
                  mb="sm"
                >
                  <Icon size={18} />
                </ThemeIcon>
                <Text fz={11} c="slate.6">
                  {s.label}
                </Text>
                <Text fw={700} fz="lg" c={s.highlight ? 'green.7' : 'slate.9'}>
                  {s.value}
                </Text>
              </Card>
            );
          })}
        </SimpleGrid>
      </SimpleGrid>
    </Card>
  );
}

function CategoryTab({ item, active, count, onClick }) {
  const Icon = tabIcons[item.icon];
  return (
    <Button
      size="sm"
      radius="md"
      variant={active ? 'filled' : 'subtle'}
      color={active ? 'primary.9' : 'slate.7'}
      leftSection={<Icon size={16} />}
      rightSection={
        <Badge
          size="xs"
          circle
          variant={active ? 'white' : 'light'}
          color={active ? 'primary.9' : 'slate'}
        >
          {count}
        </Badge>
      }
      onClick={onClick}
      fw={active ? 700 : 500}
      fz="xs"
    >
      {item.label}
    </Button>
  );
}

function ReportCard({ report }) {
  const Icon = reportIcons[report.icon];
  return (
    <Card withBorder radius="lg" padding="lg" bg="white" h="100%">
      <ThemeIcon variant="light" bg="secondary.0" c="secondary.7" size={40} radius="md" mb="md">
        <Icon size={22} />
      </ThemeIcon>

      <Text fw={700} fz="sm" c="slate.9">
        {report.title}
      </Text>
      <Text fz={11} c="slate.6" mb="xs">
        {report.subtitle}
      </Text>
      <Text fz="xs" c="slate.7" lh={1.6} mb="lg" style={{ flex: 1 }}>
        {report.description}
      </Text>

      {/* Footer kartu: menempel ke tepi bawah dengan garis pemisah di atasnya */}
      <Card.Section withBorder>
        <UnstyledButton w="100%" px="lg" py="sm">
          <Group justify="space-between" wrap="nowrap">
            <Text fz="xs" fw={700} c="primary.9">
              Buka Laporan
            </Text>
            <ArrowRight size={18} color="var(--mantine-color-primary-9)" />
          </Group>
        </UnstyledButton>
      </Card.Section>
    </Card>
  );
}

export default function LaporanKeuangan() {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(
    () =>
      Object.fromEntries(
        categories.map((c) => [
          c.value,
          c.value === 'all' ? reports.length : reports.filter((r) => r.category === c.value).length,
        ]),
      ),
    [],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter(
      (r) =>
        (category === 'all' || r.category === category) &&
        (!q || `${r.title} ${r.subtitle} ${r.description}`.toLowerCase().includes(q)),
    );
  }, [category, query]);

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro />
      <Hero />

      <Card withBorder radius="lg" p="lg" bg="white">
        <Group justify="space-between" mb="md" gap="sm">
          <Group gap={4}>
            {categories.map((c) => (
              <CategoryTab
                key={c.value}
                item={c}
                count={counts[c.value]}
                active={category === c.value}
                onClick={() => setCategory(c.value)}
              />
            ))}
          </Group>
          <TextInput
            placeholder="Cari laporan keuangan..."
            size="xs"
            radius="md"
            w={260}
            leftSection={<MagnifyingGlass size={14} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </Group>

        {visible.length ? (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {visible.map((r) => (
              <ReportCard key={r.key} report={r} />
            ))}
          </SimpleGrid>
        ) : (
          <Text ta="center" c="slate.6" fz="sm" py="xl">
            Tidak ada laporan yang cocok dengan pencarian Anda.
          </Text>
        )}
      </Card>
    </Stack>
  );
}
