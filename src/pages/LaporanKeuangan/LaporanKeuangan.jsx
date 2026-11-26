import {
  Box,
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
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowsLeftRight,
  Book,
  Books,
  ChartBar,
  ChartPieSlice,
  ClipboardText,
  CurrencyCircleDollar,
  FileText,
  MagnifyingGlass,
  Money,
  Notebook,
  Scales,
  SquaresFour,
  Table,
  TrendUp,
} from '@/components/Icon.jsx';
import { TabBar } from '@/pages/Pembelian/components.jsx';
import { categories, reports } from './data.js';
import ArusKas from './ArusKas.jsx';
import BukuBesar from './BukuBesar.jsx';
import JurnalUmum from './JurnalUmum.jsx';
import LabaRugi from './LabaRugi.jsx';
import Neraca from './Neraca.jsx';
import NeracaSaldo from './NeracaSaldo.jsx';

// Laporan yang sudah punya halaman: dibuka lewat #laporan/<key>.
const READY = {
  'arus-kas': ArusKas,
  'buku-besar': BukuBesar,
  'jurnal-umum': JurnalUmum,
  neraca: Neraca,
  'laba-rugi': LabaRugi,
  'neraca-saldo': NeracaSaldo,
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

function ReportCard({ report, onOpen }) {
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
        <UnstyledButton w="100%" px="lg" py="sm" onClick={onOpen}>
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
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const Report = READY[hash.replace(/^#laporan\/?/, '').split(/[/?]/)[0]];
  const openReport = (key) => {
    if (!READY[key]) return;
    window.location.hash = `laporan/${key}`;
    window.scrollTo({ top: 0 });
  };
  return Report ? (
    <Report
      onBack={() => {
        window.location.hash = 'laporan';
      }}
    />
  ) : (
    <ReportHub onOpen={openReport} />
  );
}

function ReportHub({ onOpen }) {
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

      <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
        <TabBar
          tabs={categories.map((c) => ({
            value: c.value,
            icon: tabIcons[c.icon],
            label: `${c.label} (${counts[c.value]})`,
          }))}
          value={category}
          onChange={setCategory}
        />
        <Group
          gap="md"
          px="lg"
          py="sm"
          bg="slate.0"
          style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
        >
          <TextInput
            placeholder="Cari laporan keuangan..."
            size="sm"
            radius="md"
            w={320}
            maw="100%"
            leftSection={<MagnifyingGlass size={14} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </Group>

        <Box p="lg">
          {visible.length ? (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {visible.map((r) => (
                <ReportCard key={r.key} report={r} onOpen={() => onOpen(r.key)} />
              ))}
            </SimpleGrid>
          ) : (
            <Text ta="center" c="slate.6" fz="sm" py="xl">
              Tidak ada laporan yang cocok dengan pencarian Anda.
            </Text>
          )}
        </Box>
      </Card>
    </Stack>
  );
}
