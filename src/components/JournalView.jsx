// Tampilan halaman "Jurnal Transaksi #nomor", dipakai bersama oleh semua tempat yang membuka
// detail jurnal: Pembelian (FPB/BAPP, faktur, PV), Gudang (mutasi stok), dan daftar jurnal di
// detail akun. Satu komponen supaya bentuknya tidak pernah berbeda antarmodul.
//
// Halaman pemanggil hanya menyiapkan isinya (baris jurnal, informasi & audit, catatan, berkas);
// nomor jurnal diambil dari buku besar (LaporanKeuangan/ledger.js) lewat `entryIds`.
import { Badge, Box, Card, Grid, Group, SimpleGrid, Stack, Table, Text, ThemeIcon, Title } from '@mantine/core';
import { useMemo } from 'react';
import { Calculator, ClipboardText, FileText, Info, Paperclip } from '@/components/Icon.jsx';
import { useData } from '@/lib/store.jsx';
import { accountsByCode, buildLedger } from '@/pages/LaporanKeuangan/ledger.js';
import { AccountLink } from '@/pages/LaporanKeuangan/StatementParts.jsx';
import AttachmentList from '@/pages/Pembelian/Attachments.jsx';
import { BackLink, CardHead, DataTable, Section } from '@/pages/Pembelian/components.jsx';
import { formatDate, rupiah } from '@/pages/Penjualan/utils.js';

// Nomor jurnal dari buku besar. `ids` berurutan menurut prioritas: id pertama yang ada di buku
// besar yang dipakai (mis. penerimaan barang dijurnal lewat FPB-nya, bukan lewat mutasi stok).
export function useJournalNo(ids) {
  const data = useData();
  const ledger = useMemo(
    () => buildLedger(data),
    [data.sales, data.salesReturns, data.pb, data.stockMoves, data.products], // eslint-disable-line react-hooks/exhaustive-deps
  );
  for (const id of ids) {
    const e = id && ledger.find((x) => x.id === id);
    if (e) return e.no;
  }
  return null;
}

export const journalTitle = (no) => (no ? `Jurnal Transaksi #${no}` : 'Jurnal Transaksi');

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

/**
 * @param entryIds   id jurnal di buku besar, untuk nomornya
 * @param backLabel  teks tautan kembali; onBack aksinya
 * @param typeLabel  jenis transaksi (badge di samping judul); badges: badge tambahan [{label,color}]
 * @param date       tanggal jurnal; subtitle: teks tambahan di bawah judul (mis. no. dokumen)
 * @param lines      baris jurnal { code|account, name?, debit, credit, memo? }
 * @param note       keterangan bawaan untuk baris tanpa memo
 * @param audit      isi kartu "Informasi & audit": [[label, nilai]]
 * @param notes      isi kartu "Catatan transaksi" (teks), kosong = kartu tidak tampil
 * @param files      berkas bukti; undefined = kartu "Dokumen bukti" tidak tampil
 */
export default function JournalView({
  entryIds = [],
  backLabel,
  onBack,
  typeLabel,
  badges = [],
  date,
  subtitle,
  lines,
  note,
  audit,
  notes = [],
  files,
  filesLabel,
}) {
  const no = useJournalNo(entryIds);
  const rows = lines.map((l) => {
    const code = l.code ?? l.account ?? null;
    return { ...l, code, name: accountsByCode[code]?.name ?? l.name ?? code ?? '—' };
  });
  const debit = rows.reduce((n, l) => n + (l.debit || 0), 0);
  const credit = rows.reduce((n, l) => n + (l.credit || 0), 0);
  const selisih = Math.round(debit - credit);
  // Tautan akun membuka detail akun pada bulan jurnal ini, sampai tanggal jurnalnya.
  const day = (date ?? '').slice(0, 10);
  const range = day ? [`${day.slice(0, 7)}-01`, day] : null;
  const shownNotes = notes.filter(Boolean);

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" w="100%" className="pb-form">
      <BackLink label={backLabel} onClick={onBack} />

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon size={52} radius="md" color="primary.9"><Calculator size={26} /></ThemeIcon>
          <Box style={{ minWidth: 0 }}>
            <Group gap="xs" wrap="wrap">
              <Title order={2} fz={{ base: 20, md: 24 }} c="slate.9">{journalTitle(no)}</Title>
              {typeLabel && <Badge size="sm" radius="sm" variant="light" color="primary" fw={700} tt="none">{typeLabel}</Badge>}
              {badges.map((b) => <Badge key={b.label} size="sm" radius="sm" variant="light" color={b.color ?? 'slate'} fw={700} tt="none">{b.label}</Badge>)}
            </Group>
            <Text fz="sm" c="slate.6">{[day && formatDate(day), subtitle].filter(Boolean).join(' · ')}</Text>
          </Box>
        </Group>
      </Card>

      {/* Pita ringkasan: dua total, keadaan keseimbangannya, dan berapa pos akun yang terlibat. */}
      <Card withBorder radius="lg" padding={0} bg="white">
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing={0}>
          {[
            <StatBox key="d" label="Total debit" value={rupiah(debit)} hint="Jumlah seluruh sisi debit" />,
            <StatBox key="k" label="Total kredit" value={rupiah(credit)} hint="Jumlah seluruh sisi kredit" />,
            <StatBox
              key="s"
              label="Selisih keseimbangan"
              value={selisih === 0 ? 'Seimbang' : rupiah(Math.abs(selisih))}
              hint={selisih === 0 ? 'Debit dan kredit sama' : 'Debit dan kredit belum sama'}
              color={selisih === 0 ? 'slate.9' : 'red.7'}
              dot={selisih === 0 ? 'green-6' : 'red-6'}
            />,
            <StatBox key="p" label="Rincian pos jurnal" value={`${rows.length} pos akun`} hint="Debit dan kredit per akun" />,
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
                {rows.map((l, i) => (
                  <Table.Tr key={`${l.code}-${i}`}>
                    <Table.Td>
                      {accountsByCode[l.code]
                        ? <AccountLink code={l.code} range={range} fw={600}>{l.code} · {l.name}</AccountLink>
                        : <Text fz="sm" fw={600} c="primary.9">{l.code ? `${l.code} · ${l.name}` : l.name}</Text>}
                      <Text fz={11} c="slate.6">{l.debit ? 'Sisi debit' : 'Sisi kredit'}</Text>
                    </Table.Td>
                    <Table.Td fz="xs" c="slate.7">{l.memo || note || '—'}</Table.Td>
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
                  <Table.Td ta="right" fz="sm" fw={700} c="slate.9">{rupiah(debit)}</Table.Td>
                  <Table.Td ta="right" fz="sm" fw={700} c="slate.9">{rupiah(credit)}</Table.Td>
                </Table.Tr>
              </DataTable>
            </Section>

            {shownNotes.length > 0 && (
              <Section divided flush icon={FileText} title="Catatan transaksi" description="Keterangan yang menyertai jurnal ini">
                <Box p="lg">
                  {shownNotes.map((t, i) => (
                    <Text key={i} fz="sm" c="slate.8" mt={i ? 6 : 0} style={{ whiteSpace: 'pre-wrap' }}>{t}</Text>
                  ))}
                </Box>
              </Section>
            )}
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

            {files !== undefined && (
              <Section
                divided
                flush
                icon={Paperclip}
                title="Dokumen bukti"
                description="Berkas pendukung transaksi"
                right={<Badge size="sm" radius="sm" variant="light" color="slate" tt="none">{files.length} berkas</Badge>}
              >
                <Box p="lg">
                  {files.length === 0
                    ? <Text fz="xs" c="slate.6">Tidak ada berkas bukti yang dilampirkan.</Text>
                    : <AttachmentList names={files} label={filesLabel} />}
                </Box>
              </Section>
            )}
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
