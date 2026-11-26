// Potongan kartu halaman Ringkasan (Pembelian dan Penjualan), supaya kedua modul terbaca dan
// terasa sama. Angka diberikan sudah berformat oleh pemanggil; komponen ini hanya menata.
import { Box, Button, Card, Group, Progress, SimpleGrid, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import { ArrowRight, CaretRight, User } from '@/components/Icon.jsx';
import classes from './overview.module.css';

const tabular = { fontVariantNumeric: 'tabular-nums' };
const dotColor = (c) => `var(--mantine-color-${c.replace('.', '-')})`;

export const initials = (name = '') =>
  name
    .replace(/^(PT|CV|UD|Toko)\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();

// Judul kartu: judul + keterangan, dengan info ringkas atau aksi di kanan.
export function CardTitle({ title, text, right }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
      <Box style={{ minWidth: 0 }}>
        <Text fw={700} fz="sm" c="slate.9">{title}</Text>
        {text && <Text fz="xs" c="slate.6">{text}</Text>}
      </Box>
      {right && (typeof right === 'string' ? <Text fz={11} c="slate.6" style={{ whiteSpace: 'nowrap' }}>{right}</Text> : right)}
    </Group>
  );
}

// Keadaan kosong yang tenang: ikon kecil + dua baris.
export function Quiet({ icon: Icon, title, text }) {
  return (
    <Group gap="sm" wrap="nowrap" mt="sm" p="sm" style={{ background: 'var(--mantine-color-gray-0)', borderRadius: 'var(--mantine-radius-md)' }}>
      <ThemeIcon variant="white" color="gray" size={30} radius="md" style={{ boxShadow: '0 0 0 1px rgb(0 0 0 / .06), 0 1px 2px rgb(0 0 0 / .08)' }}>
        <Icon size={16} />
      </ThemeIcon>
      <Box style={{ minWidth: 0 }}>
        <Text fz="xs" fw={600} c="slate.8">{title}</Text>
        <Text fz={11} c="slate.6">{text}</Text>
      </Box>
    </Group>
  );
}

// Legenda bertitik: satu baris per bagian.
export function Legend({ items }) {
  return (
    <Stack gap={6}>
      {items.map((j) => (
        <Group key={j.key} justify="space-between" wrap="nowrap">
          <Group gap={8} wrap="nowrap">
            <Box w={8} h={8} style={{ borderRadius: 4, flexShrink: 0, background: dotColor(j.color) }} />
            <Text fz="xs" c="slate.7">{j.label}</Text>
          </Group>
          <Text fz="xs" fw={600} c={j.muted ? 'slate.4' : 'slate.9'} style={tabular}>{j.value}</Text>
        </Group>
      ))}
    </Stack>
  );
}

// Satu angka utama + bar komposisinya. parts: [{ key, label, value, display, color, hint }].
export function CompositionCard({ title, text, action, figure, parts }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <Card withBorder radius="lg" padding="lg" bg="white" h="100%">
      <CardTitle
        title={title}
        text={text}
        right={action && (
          <Button variant="default" size="compact-sm" radius="xl" rightSection={<CaretRight size={12} />} onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      />
      <Text fz={32} fw={700} c="slate.9" lh="40px" mt="md" style={{ letterSpacing: '-0.02em', ...tabular }}>{figure}</Text>
      <Progress.Root size={8} radius="xl" mt="md" bg="gray.1">
        {parts.map((k) => k.value > 0 && <Progress.Section key={k.key} value={(k.value / total) * 100} color={k.color} />)}
      </Progress.Root>
      <SimpleGrid cols={{ base: 1, sm: parts.length }} spacing="md" mt="md">
        {parts.map((k) => (
          <Box key={k.key}>
            <Group gap={6} wrap="nowrap">
              <Box w={8} h={8} style={{ borderRadius: 4, flexShrink: 0, background: dotColor(k.color) }} />
              <Text fz={11} c="slate.6" truncate>{k.label}</Text>
            </Group>
            <Text fz="md" fw={700} c={k.value ? 'slate.9' : 'slate.4'} lh={1.5} style={tabular}>{k.value ? k.display : '–'}</Text>
            <Text fz={11} c="slate.6">{k.hint}</Text>
          </Box>
        ))}
      </SimpleGrid>
    </Card>
  );
}

// Daftar antrean: baris yang bisa diklik ke daftarnya. items: [{ key, label, hint, value, icon, tone, alert, onClick }].
export function QueueCard({ items, secondaryIcons = false }) {
  return (
    <Card withBorder radius="lg" padding={6} bg="white" h="100%">
      <Stack gap={0} h="100%">
        {items.map((a, i) => (
          <UnstyledButton
            key={a.key}
            onClick={a.onClick}
            className={classes.row}
            px="md"
            py={12}
            style={{ flex: 1, display: 'flex', alignItems: 'center', borderTop: i ? '1px solid var(--mantine-color-gray-1)' : undefined, borderRadius: i ? 0 : undefined }}
          >
            <Group wrap="nowrap" gap="md" w="100%">
              <ThemeIcon variant="light" color={a.tone ?? 'gray'} bg={secondaryIcons ? 'secondary.0' : undefined} c={secondaryIcons ? 'secondary.7' : undefined} size={36} radius="md">
                <a.icon size={18} />
              </ThemeIcon>
              <Box style={{ minWidth: 0, flex: 1 }}>
                <Text fz="xs" c="slate.6">{a.label}</Text>
                <Text fz={11} c={a.alert ? 'red.7' : 'slate.5'} truncate>{a.hint}</Text>
              </Box>
              <Text fz={20} fw={700} c="slate.9" style={{ whiteSpace: 'nowrap', ...tabular }}>{a.value}</Text>
              <CaretRight size={14} color="var(--mantine-color-slate-4)" />
            </Group>
          </UnstyledButton>
        ))}
      </Stack>
    </Card>
  );
}

// Alur dokumen: tahap berurutan, tiap tahap bisa diklik. steps: [{ key, label, hint, count, onClick }].
export function FlowCard({ title, text, steps }) {
  return (
    <Card withBorder radius="lg" padding="lg" bg="white">
      <Text fw={700} fz="sm" c="slate.9">{title}</Text>
      <Text fz="xs" c="slate.6" mb="md">{text}</Text>
      <SimpleGrid cols={{ base: 2, sm: steps.length }} spacing="sm">
        {steps.map((s, i) => (
          <UnstyledButton key={s.key} onClick={s.onClick} p="sm" className={classes.step}>
            <Group gap={6} wrap="nowrap" justify="space-between">
              <Text fz="xs" fw={600} c="slate.7">{s.label}</Text>
              {i < steps.length - 1 && <ArrowRight size={12} color="var(--mantine-color-slate-4)" />}
            </Group>
            <Text fz={26} fw={700} c={s.count ? 'primary.9' : 'slate.4'} lh={1.2} style={tabular}>{s.count}</Text>
            <Text fz={11} c="slate.6">{s.hint}</Text>
          </UnstyledButton>
        ))}
      </SimpleGrid>
    </Card>
  );
}

// Porsi per pihak (vendor / pelanggan) dengan bar. rows: [{ id, name, value, display, sub }].
// icon: ikon pihak (default orang/pelanggan).
export function ShareList({ rows, total, onClick, limit = 5, icon: Icon = User }) {
  return (
    <Stack gap={4} mt="sm">
      {rows.slice(0, limit).map((v) => {
        const pct = total ? Math.round((v.value / total) * 100) : 0;
        return (
          <UnstyledButton key={v.id} onClick={() => onClick?.(v)} className={classes.row} px={8} py={8} mx={-8}>
            <Group wrap="nowrap" gap="sm" align="center">
              <ThemeIcon size={30} radius="md" color="gray" variant="light">
                <Icon size={16} />
              </ThemeIcon>
              <Box style={{ minWidth: 0, flex: 1 }}>
                <Group justify="space-between" wrap="nowrap" gap="xs">
                  <Text fz="xs" fw={600} c="slate.9" truncate>{v.name}</Text>
                  <Text fz="xs" fw={600} c="slate.9" style={{ whiteSpace: 'nowrap', ...tabular }}>{v.display}</Text>
                </Group>
                <Group justify="space-between" wrap="nowrap" gap="xs" mt={2}>
                  <Text fz={11} c={v.alert ? 'red.7' : 'slate.6'} truncate>{v.sub}</Text>
                  <Text fz={11} c="slate.6">{pct}%</Text>
                </Group>
                <Progress value={pct} size={4} radius="xl" color="primary.9" mt={6} bg="gray.1" />
              </Box>
            </Group>
          </UnstyledButton>
        );
      })}
    </Stack>
  );
}

// Perbandingan dua periode dengan bar. bars: [{ label, value, display, color }].
export function CompareBars({ bars }) {
  const max = Math.max(...bars.map((b) => b.value), 0);
  return (
    <Stack gap={8} mt="sm">
      {bars.map((b) => (
        <Box key={b.label}>
          <Group justify="space-between" mb={4}>
            <Text fz={11} c="slate.6">{b.label}</Text>
            <Text fz={11} c="slate.7" style={tabular}>{b.display}</Text>
          </Group>
          <Progress value={max ? (b.value / max) * 100 : 0} size={6} radius="xl" color={b.color} bg="gray.1" />
        </Box>
      ))}
    </Stack>
  );
}
