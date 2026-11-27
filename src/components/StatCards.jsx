import { Box, Card, Group, SimpleGrid, Text, ThemeIcon } from '@mantine/core';
import styles from './StatCards.module.css';

// onClick (opsional): kartu jadi tombol, mis. untuk menyaring tabel di bawahnya.
// active menandai saringan yang sedang dipakai.
export function StatCard({ label, value, hint, icon: Icon, onClick, active = false }) {
  return (
    <Card
      withBorder
      radius="md"
      padding="md"
      bg={onClick ? undefined : 'white'}
      className={onClick ? styles.card : undefined}
      component={onClick ? 'button' : 'div'}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      ta="left"
      w="100%"
      style={{
        cursor: onClick ? 'pointer' : undefined,
        font: 'inherit',
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text fz={11} fw={600} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }}>
            {label}
          </Text>
          <Text fz={22} fw={700} c="slate.9" lh={1.3}>
            {value}
          </Text>
          <Text fz={11} c="slate.6">
            {hint}
          </Text>
        </Box>
        <ThemeIcon variant="light" bg="secondary.0" c="secondary.7" size={36} radius="md">
          <Icon size={18} />
        </ThemeIcon>
      </Group>
    </Card>
  );
}


export default function StatCards({ items }) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: items.length }} spacing="md">
      {items.map((item) => <StatCard key={item.label} {...item} />)}
    </SimpleGrid>
  );
}
