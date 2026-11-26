// Kartu ringkas "Jurnal Transaksi" di kolom kanan halaman detail dokumen (FPB/BAPP, faktur, PV).
// "Debit" dan "Kredit" ditulis utuh: singkatan Dr/Cr hanya terbaca oleh yang sudah terbiasa jurnal.
import { Box, Button, Group, Text } from '@mantine/core';
import { Calculator } from '@/components/Icon.jsx';
import { Section } from './components.jsx';
import { journalTotals } from './journal.js';
import { rupiah } from './utils.js';

export default function JournalCard({ lines, description, onDetail, empty, title = 'Jurnal Transaksi' }) {
  return (
    <Section
      divided
      flush
      icon={Calculator}
      title={title}
      description={description}
      right={lines?.length > 0 && onDetail ? (
        <Button size="compact-xs" radius="md" variant="light" onClick={onDetail}>Lihat detail</Button>
      ) : null}
    >
      {!lines?.length ? (
        <Text fz="xs" c="slate.6" p="lg">{empty ?? 'Belum ada jurnal untuk dokumen ini.'}</Text>
      ) : (
        <>
          {lines.map((l, i) => {
            const isDr = l.debit > 0;
            return (
              <Group
                key={`${l.code}-${i}`}
                gap="md"
                wrap="nowrap"
                align="flex-start"
                px="lg"
                py="sm"
                style={{
                  borderTop: i ? '1px solid var(--mantine-color-gray-2)' : undefined,
                  borderLeft: `3px solid var(--mantine-color-${isDr ? 'primary-6' : 'orange-5'})`,
                }}
              >
                <Box style={{ minWidth: 0, flex: 1 }}>
                  <Text fz={10} fw={700} c={isDr ? 'primary.7' : 'orange.8'} tt="uppercase" style={{ letterSpacing: 0.6 }}>
                    {isDr ? 'Debit' : 'Kredit'}
                  </Text>
                  <Group gap={6} wrap="nowrap" mt={2}>
                    <Text fz={11} c="slate.5" ff="monospace" style={{ flexShrink: 0, letterSpacing: 0.3 }}>{l.code ?? '—'}</Text>
                    <Text fz="xs" fw={600} c="slate.9" lh={1.3} truncate>{l.name}</Text>
                  </Group>
                  <Text fz="sm" fw={700} c={isDr ? 'slate.9' : 'orange.8'} mt={4}>
                    {rupiah(l.debit || l.credit)}
                  </Text>
                </Box>
              </Group>
            );
          })}
          <Group justify="space-between" px="lg" py="sm" bg="slate.0" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
            <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.4 }}>Nilai jurnal</Text>
            <Text fz="sm" fw={700} c="slate.9">{rupiah(journalTotals(lines).debit)}</Text>
          </Group>
        </>
      )}
    </Section>
  );
}
