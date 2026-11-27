// Kartu pengajuan yang menunggu keputusan approver (ubah harga PO, pembatalan uang muka).
// Urutannya mengikuti pertanyaan approver: apa yang diajukan, oleh siapa dan kapan, kenapa,
// lalu angka sebelum/sesudah. Tombol putusan tetap di kepala halaman, sejajar approval lain.
import { Badge, Box, Card, Group, Stack, Table, Text, ThemeIcon } from '@mantine/core';
import { ClockCountdown } from '@/components/Icon.jsx';
import { stampLabel } from './ApprovalLog.jsx';
import { roleLabel } from './permissions.js';

export default function RequestCard({ title, waitingFor, by, at, source, reason, children, note }) {
  return (
    <Card withBorder radius="lg" padding={0} bg="white">
      {/* Kepala sama dengan kartu Informasi PO di bawahnya: ikon, label kecil, keterangan. */}
      <Group justify="space-between" align="center" wrap="nowrap" gap="md" px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon variant="light" color="orange" size={32} radius="md" style={{ flexShrink: 0 }}>
            <ClockCountdown size={18} />
          </ThemeIcon>
          <Box style={{ minWidth: 0 }}>
            <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }}>{title}</Text>
            <Text fz="xs" c="slate.6">
              Diajukan {by || '–'}{at ? ` · ${stampLabel(at)}` : ''}{source ? ` · ${source}` : ''}
            </Text>
          </Box>
        </Group>
        <Badge size="sm" radius="sm" variant="light" color="orange" fw={700} tt="none" style={{ flexShrink: 0 }}>
          Menunggu {roleLabel(waitingFor)}
        </Badge>
      </Group>

      <Stack gap="sm" p="lg">
        <Box bg="slate.0" px="sm" py={8} style={{ borderRadius: 'var(--mantine-radius-md)' }}>
          <Text fz={11} c="slate.6">Alasan</Text>
          <Text fz="sm" c="slate.9">{reason || '–'}</Text>
        </Box>
        {children}
        {note && <Text fz="xs" c="slate.6">{note}</Text>}
      </Stack>
    </Card>
  );
}

// Tabel perbandingan di dalam kartu: kepala kecil, angka rata kanan, baris total opsional.
export function CompareTable({ head, minWidth = 460, children }) {
  return (
    <Box className="table-frame" style={{ overflowX: 'auto', border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
      <Table
        verticalSpacing={8}
        horizontalSpacing="md"
        miw={minWidth}
        fz="sm"
        styles={{
          th: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600, color: 'var(--mantine-color-slate-7)', whiteSpace: 'nowrap' },
          td: { whiteSpace: 'nowrap', verticalAlign: 'top' },
        }}
      >
        <Table.Thead bg="slate.0">
          <Table.Tr>
            {head.map((h, i) => (
              <Table.Th key={h} ta={i ? 'right' : undefined}>{h}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{children}</Table.Tbody>
      </Table>
    </Box>
  );
}
