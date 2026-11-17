// Komponen kecil yang dipakai lintas halaman.
import {
  ActionIcon,
  Box,
  Card,
  CopyButton,
  Group,
  Modal,
  Stack,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { ArrowLeft, Check, Copy, Invoice } from '@/components/Icon.jsx';

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

// Tautan kembali kecil di atas judul halaman penuh (bukan tombol aksi di header).
export function BackLink({ label, onClick }) {
  return (
    <UnstyledButton
      onClick={onClick}
      style={{ alignSelf: 'flex-start' }}
      c="slate.7"
      aria-label={label}
    >
      <Group gap={6} wrap="nowrap">
        <ArrowLeft size={14} />
        <Text fz="sm" fw={600}>
          {label}
        </Text>
      </Group>
    </UnstyledButton>
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

// Modal form standar: header dan footer membeku, hanya badan yang menggulir.
// Dipakai modul Pembelian dan Penjualan agar semua form berperilaku sama.
export function FormModal({ opened, onClose, title, subtitle, icon: Icon, size = 720, footer, children }) {
  return (
    <Modal
      className="pb-form"
      opened={opened}
      onClose={onClose}
      centered
      size={size}
      radius="lg"
      padding={0}
      styles={{
        content: { display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        header: {
          flexShrink: 0,
          padding: 'var(--mantine-spacing-lg)',
          borderBottom: '1px solid var(--mantine-color-gray-3)',
        },
        title: { flex: 1 },
        body: { padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
      }}
      title={
        <Group gap="sm" wrap="nowrap">
          {Icon && (
            <ThemeIcon variant="light" bg="primary.0" c="primary.9" size={32} radius="md">
              <Icon size={18} />
            </ThemeIcon>
          )}
          <div>
            <Text fw={700} fz="sm" c="slate.9">
              {title}
            </Text>
            {subtitle && (
              <Text fz={11} c="slate.6">
                {subtitle}
              </Text>
            )}
          </div>
        </Group>
      }
    >
      <Box style={{ flex: 1, minHeight: 0, overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }} p="lg">
        <Stack gap="md">{children}</Stack>
      </Box>
      {footer && (
        <Group
          justify="flex-end"
          gap="sm"
          p="md"
          px="lg"
          bg="white"
          style={{ flexShrink: 0, borderTop: '1px solid var(--mantine-color-gray-3)' }}
        >
          {footer}
        </Group>
      )}
    </Modal>
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

// Tombol yang diblokir validasi: tetap bisa diklik supaya pesan errornya muncul,
// tetapi tampil dan terbaca sebagai nonaktif. Tombol yang benar-benar `disabled`
// tidak bisa menampilkan tooltip alasannya, jadi polanya memakai data-disabled.
export const blockedProps = (message, onBlocked) =>
  message
    ? {
        'data-disabled': true,
        'aria-disabled': true,
        // Gaya nonaktifnya diatur .btn-blocked di index.css, bukan gaya bawaan Mantine.
        className: 'btn-blocked',
        onClick: (e) => {
          e.preventDefault();
          onBlocked?.();
        },
      }
    : null;
