// Halaman detail Jurnal Transaksi satu dokumen pembelian: FPB/BAPP, faktur, atau Payment Voucher.
//
// Jurnalnya tidak disimpan — dibentuk ulang dari dokumennya setiap kali dibaca (lihat
// journal.js). Jadi halaman ini selalu memperlihatkan keadaan terbaru dokumen sumbernya,
// bukan salinan yang bisa basi.
import { Badge, Box, Card, Grid, Group, SimpleGrid, Stack, Table, Text, ThemeIcon, Title } from '@mantine/core';
import { Calculator, ClipboardText, FileText, Info, Paperclip } from '@/components/Icon.jsx';
import AttachmentList from './Attachments.jsx';
import { BackLink, CardHead, CopyIcon, DataTable, DocNumber, Section } from './components.jsx';
import { useData } from '@/lib/store.jsx';
import { journalEntry, journalTotals } from './journal.js';
import { formatDate, rupiah } from './utils.js';

// Satu angka ringkasan di pita atas: label kecil, angkanya besar, keterangannya di bawah.
function StatBox({ label, value, hint, color = 'slate.9', dot }) {
  return (
    <Box px="lg" py="md" style={{ minWidth: 0 }}>
      <Text fz={11} fw={600} c="slate.6">{label}</Text>
      <Group gap={6} wrap="nowrap" align="center" mt={2}>
        {dot && <Box w={7} h={7} style={{ borderRadius: '50%', background: `var(--mantine-color-${dot})`, flexShrink: 0 }} />}
        <Text fz={20} fw={700} c={color} lh={1.2} style={{ whiteSpace: 'nowrap' }}>{value}</Text>
      </Group>
      <Text fz={11} c="slate.6" mt={2}>{hint}</Text>
    </Box>
  );
}

export default function JournalDetail({ kind = 'pv', doc: v, pb, onBack, go }) {
  const { stockMoves, products } = useData();
  const e = journalEntry(kind, v, pb, { stockMoves, products });
  const jurnal = e.lines;
  const total = journalTotals(jurnal);
  const tanggal = e.date;
  const selisih = total.debit - total.credit;
  const berkas = e.files;
  const keterangan = e.note;

  const audit = [
    ['Tanggal transaksi', formatDate(tanggal)],
    ['Dokumen sumber', <DocNumber key="src" onClick={() => go(e.source.view)}>{e.source.label}</DocNumber>],
    ['Jenis transaksi', e.typeLabel],
    ['Pihak terkait', e.party],
    [e.basisLabel, e.basis.length
      ? <Group key="basis" gap={6} wrap="wrap">{e.basis.map((b) => <DocNumber key={b.label} onClick={() => go(b.view)}>{b.label}</DocNumber>)}</Group>
      : '—'],
    ...e.extra,
    ['Dibukukan oleh', e.by],
    ['ID sistem', <Group key="id" gap={6} wrap="nowrap"><Text fz="sm" fw={700} c="slate.9" ff="monospace">{v.id}</Text><CopyIcon value={v.id} size={14} /></Group>],
  ];

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" className="pb-form">
      {/* Tautan kembali di atas kartu, sama dengan semua halaman detail lain di modul ini —
          bukan tombol di dalam kepala kartu. */}
      <BackLink label={`Kembali ke ${v.number}`} onClick={onBack} />

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon size={52} radius="md" color="primary.9"><Calculator size={26} /></ThemeIcon>
          <Box style={{ minWidth: 0 }}>
            <Group gap="xs" wrap="wrap">
              <Title order={2} fz={{ base: 20, md: 24 }} c="slate.9">Jurnal Transaksi</Title>
              <Badge size="sm" radius="sm" variant="light" color="primary" fw={700} tt="none">{e.typeLabel}</Badge>
            </Group>
            <Text fz="sm" c="slate.6">{formatDate(tanggal)}</Text>
          </Box>
        </Group>
      </Card>

      {/* Pita ringkasan: dua total, keadaan keseimbangannya, dan berapa pos akun yang terlibat. */}
      <Card withBorder radius="lg" padding={0} bg="white">
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing={0}>
          {[
            <StatBox key="d" label="Total debit" value={rupiah(total.debit)} hint="Jumlah seluruh sisi debit" />,
            <StatBox key="k" label="Total kredit" value={rupiah(total.credit)} hint="Jumlah seluruh sisi kredit" />,
            <StatBox
              key="s"
              label="Selisih keseimbangan"
              value={selisih === 0 ? 'Seimbang' : rupiah(Math.abs(selisih))}
              hint={selisih === 0 ? 'Debit dan kredit sama' : 'Debit dan kredit belum sama'}
              color={selisih === 0 ? 'slate.9' : 'red.7'}
              dot={selisih === 0 ? 'green-6' : 'red-6'}
            />,
            <StatBox key="p" label="Rincian pos jurnal" value={`${jurnal.length} pos akun`} hint="Debit dan kredit per akun" />,
          ].map((el, i) => (
            <Box key={el.key} style={{ borderLeft: i ? '1px solid var(--mantine-color-gray-2)' : undefined }}>{el}</Box>
          ))}
        </SimpleGrid>
      </Card>

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Stack gap="lg">
            <Section divided flush icon={ClipboardText} title="Rincian pos jurnal" description="Akun yang terlibat, keterangan, dan nominal tiap sisi">
              {/* Nilai yang tidak ada di satu lajur dibiarkan "—", bukan Rp 0 — nol itu angka,
                  dan di jurnal nol berarti sesuatu yang lain. */}
              <DataTable
                bare
                head={[
                  { label: 'Akun perkiraan (COA)' },
                  { label: 'Keterangan' },
                  { label: 'Debit', align: 'right' },
                  { label: 'Kredit', align: 'right' },
                ]}
                minWidth={720}
              >
                {jurnal.map((l, i) => (
                  <Table.Tr key={`${l.code}-${i}`}>
                    <Table.Td>
                      <Text fz="sm" fw={600} c="primary.9">{l.code} · {l.name}</Text>
                      <Text fz={11} c="slate.6">{l.debit ? 'Sisi debit' : 'Sisi kredit'}</Text>
                    </Table.Td>
                    <Table.Td fz="xs" c="slate.7">{l.memo || keterangan}</Table.Td>
                    <Table.Td ta="right" fz="sm" fw={l.debit ? 700 : 400} c={l.debit ? 'slate.9' : 'slate.4'}>
                      {l.debit ? rupiah(l.debit) : '—'}
                    </Table.Td>
                    <Table.Td ta="right" fz="sm" fw={l.credit ? 700 : 400} c={l.credit ? 'slate.9' : 'slate.4'}>
                      {l.credit ? rupiah(l.credit) : '—'}
                    </Table.Td>
                  </Table.Tr>
                ))}
                <Table.Tr bg="slate.0">
                  <Table.Td colSpan={2} fz="sm" fw={700} c="slate.9">Total</Table.Td>
                  <Table.Td ta="right" fz="sm" fw={700} c="slate.9">{rupiah(total.debit)}</Table.Td>
                  <Table.Td ta="right" fz="sm" fw={700} c="slate.9">{rupiah(total.credit)}</Table.Td>
                </Table.Tr>
              </DataTable>
            </Section>

            <Section divided flush icon={FileText} title="Catatan transaksi" description="Keterangan yang menyertai jurnal ini">
              <Box p="lg">
                <Text fz="sm" c="slate.8">{keterangan}</Text>
                {v.note && <Text fz="sm" c="slate.8" mt={6} style={{ whiteSpace: 'pre-wrap' }}>{v.note}</Text>}
              </Box>
            </Section>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="lg">
            <Card withBorder radius="lg" padding={0} bg="white">
              <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                <CardHead icon={Info} desc="Tanggal, dokumen, dan jejak pencatatannya">Informasi &amp; audit</CardHead>
              </Box>
              <Stack gap={0}>
                {audit.map(([k, val], i) => (
                  <Group
                    key={k}
                    justify="space-between"
                    align="flex-start"
                    wrap="nowrap"
                    gap="md"
                    px="lg"
                    py={9}
                    style={{ borderTop: i ? '1px solid var(--mantine-color-gray-2)' : undefined }}
                  >
                    <Text fz="xs" c="slate.6" style={{ flexShrink: 0 }}>{k}</Text>
                    <Text fz="sm" fw={700} c="slate.9" ta="right" component="div" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{val}</Text>
                  </Group>
                ))}
              </Stack>
            </Card>

            <Section
              divided
              flush
              icon={Paperclip}
              title="Dokumen bukti"
              description="Berkas pendukung transaksi"
              right={<Badge size="sm" radius="sm" variant="light" color="slate" tt="none">{berkas.length} berkas</Badge>}
            >
              <Box p="lg">
                {berkas.length === 0 ? (
                  <Text fz="xs" c="slate.6">Tidak ada berkas bukti yang dilampirkan.</Text>
                ) : (
                  <AttachmentList names={berkas} label={e.filesLabel} />
                )}
              </Box>
            </Section>
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
