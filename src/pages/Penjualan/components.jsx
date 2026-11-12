import { Badge, Box, Group, Text } from '@mantine/core';
import { Field } from '@/components/common.jsx';
import { rupiah, STATUS } from './utils.js';

// Komponen umum dipakai ulang dari src/components/common.jsx.
export { CopyIcon, Field, PageIntro } from '@/components/common.jsx';

export function StatusBadge({ status, size = 'sm' }) {
  const s = STATUS[status];
  return (
    <Badge size={size} radius="sm" variant="light" color={s.color} fw={700}>
      {s.label}
    </Badge>
  );
}

// Kotak ringkasan Subtotal / Pajak / Total (dipakai di modal faktur).
export function TotalsBox({ totals }) {
  return (
    <Box
      p="sm"
      bg="slate.0"
      style={{
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 'var(--mantine-radius-md)',
      }}
    >
      <Group justify="space-between" align="flex-start">
        <Field label="Subtotal">{rupiah(totals.subtotal)}</Field>
        <Box ta="right">
          <Field label="Pajak (PPN)">+{rupiah(totals.tax)}</Field>
        </Box>
      </Group>
      {(totals.discount > 0 || totals.withholding > 0) && (
        <Group justify="space-between" mt={6}>
          {totals.discount > 0 ? (
            <Field label="Diskon" valueProps={{ c: 'red.7' }}>
              -{rupiah(totals.discount)}
            </Field>
          ) : (
            <span />
          )}
          {totals.withholding > 0 && (
            <Box ta="right">
              <Field label="Potongan" valueProps={{ c: 'red.7' }}>
                -{rupiah(totals.withholding)}
              </Field>
            </Box>
          )}
        </Group>
      )}
      <Group
        justify="space-between"
        mt="sm"
        pt="sm"
        style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
      >
        <Text fz="sm" fw={700} c="slate.9">
          Total Tagihan Akhir
        </Text>
        <Text fz="md" fw={700} c="slate.9">
          {rupiah(totals.total)}
        </Text>
      </Group>
    </Box>
  );
}
