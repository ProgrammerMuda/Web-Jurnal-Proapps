// Komponen kecil yang dipakai lintas halaman.
import {
  ActionIcon,
  Box,
  Card,
  CopyButton,
  Group,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { Check, Copy, Invoice } from '@/components/Icon.jsx';

// Kartu judul halaman: ikon, judul, deskripsi, dan tombol aksi di kanan.
export function PageIntro({ icon: Icon = Invoice, title, description, actions }) {
  return (
    <Card withBorder radius="lg" padding="lg" bg="white">
      <Group justify="space-between" align="flex-start" gap="md">
        <Group gap="md" wrap="nowrap" align="flex-start">
          <ThemeIcon size={40} radius="md" color="primary.9">
            <Icon size={22} />
          </ThemeIcon>
          <Box>
            <Title order={3} fz="lg" c="slate.9">
              {title}
            </Title>
            <Text fz="xs" c="slate.6" maw={560}>
              {description}
            </Text>
          </Box>
        </Group>
        {actions && <Group gap="xs">{actions}</Group>}
      </Group>
    </Card>
  );
}

export function CopyIcon({ value, size = 14 }) {
  return (
    <CopyButton value={value} timeout={1500}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? 'Tersalin' : 'Salin'} withArrow fz="xs">
          <ActionIcon
            variant="subtle"
            color={copied ? 'green' : 'slate'}
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              copy();
            }}
            aria-label={`Salin ${value}`}
          >
            {copied ? <Check size={size} /> : <Copy size={size} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );
}

// Pasangan label kecil + nilai (dipakai di rincian & ringkasan modal).
export function Field({ label, children, valueProps }) {
  return (
    <Box>
      <Text fz={11} c="slate.6">
        {label}
      </Text>
      <Text fz="sm" fw={600} c="slate.9" {...valueProps}>
        {children}
      </Text>
    </Box>
  );
}
