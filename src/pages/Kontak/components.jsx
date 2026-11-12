import { Avatar, Badge, Box, Card, Group, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { typeOf } from './data.js';
import { initials } from './utils.js';

export function ContactAvatar({ name, size = 36 }) {
  return (
    <Avatar size={size} radius="md" color="slate" variant="light" fw={700}>
      <Text fz={size > 50 ? 'xl' : 'xs'} fw={700} c="slate.7">
        {initials(name)}
      </Text>
    </Avatar>
  );
}

function TypeBadge({ value, detail, filled }) {
  const t = typeOf(value);
  return (
    <Badge
      size="xs"
      radius="sm"
      variant={filled ? 'filled' : 'light'}
      color={t.badgeColor}
      fw={700}
    >
      {detail ? (t.detailBadge ?? t.badge) : t.badge}
    </Badge>
  );
}

// Daftar: maksimal 2 tipe, sisanya diringkas "(n) TIPE LAINNYA" (tooltip berisi sisanya).
export function TypeBadges({ types, max = Infinity, detail, filled }) {
  const shown = types.slice(0, max);
  const rest = types.slice(max);
  return (
    <Group gap={4}>
      {shown.map((t) => (
        <TypeBadge key={t} value={t} detail={detail} filled={filled} />
      ))}
      {rest.length > 0 && (
        <Tooltip withArrow fz="xs" label={rest.map((t) => typeOf(t).label).join(', ')}>
          <Badge size="xs" radius="sm" variant="light" color="gray" fw={700}>
            ({rest.length}) Tipe lainnya
          </Badge>
        </Tooltip>
      )}
    </Group>
  );
}

export function GroupBadge({ name }) {
  return (
    <Badge size="xs" radius="sm" variant="outline" color="slate" fw={700}>
      {name}
    </Badge>
  );
}

// Kartu bagian di halaman rincian: ikon + judul + subjudul.
export function SectionCard({ icon: Icon, title, description, accent, children, right }) {
  return (
    <Card
      withBorder
      radius="lg"
      padding="md"
      bg="white"
      style={accent ? { borderTop: '2px solid var(--mantine-color-primary-9)' } : undefined}
    >
      <Group justify="space-between" align="flex-start" mb="md" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" align="flex-start">
          {Icon && (
            <ThemeIcon variant="light" bg="slate.0" c="slate.7" size={32} radius="md">
              <Icon size={16} />
            </ThemeIcon>
          )}
          <Box>
            <Text fw={700} fz="sm" c="slate.9">
              {title}
            </Text>
            {description && (
              <Text fz={11} c="slate.6">
                {description}
              </Text>
            )}
          </Box>
        </Group>
        {right}
      </Group>
      {children}
    </Card>
  );
}

// Label + nilai; nilai kosong ditampilkan "Belum diisi" dengan warna redup.
export function InfoItem({ label, value, empty = 'Belum diisi', after }) {
  return (
    <Box>
      <Text fz={11} c="slate.6">
        {label}
      </Text>
      <Group gap={4} wrap="nowrap">
        <Text fz="sm" fw={value ? 600 : 400} c={value ? 'slate.9' : 'slate.6'}>
          {value || empty}
        </Text>
        {value && after}
      </Group>
    </Box>
  );
}
