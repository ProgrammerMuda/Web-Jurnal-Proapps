// Form bidding: satu lembar perbandingan semua penawaran untuk satu permintaan.
// Header otomatis, tabel per item x vendor (harga awal / final), syarat final, penilaian opsional, hasil, lalu approval.
import { useState } from 'react';
import { Anchor, Badge, Box, Button, Grid, Group, Select, Stack, Table, Text, Textarea, ThemeIcon, Tooltip } from '@mantine/core';
import { Check, Info, Scales, Storefront } from '@/components/Icon.jsx';
import AttachmentList from './Attachments.jsx';
import { Callout, Section } from './components.jsx';
import { canCreate } from './permissions.js';
import { TODAY } from './data.js';
import { DropField } from './Dialogs.jsx';
import { ApprovalBar, frame, th } from './procurement.jsx';
import {
  approverFor,
  biddingNote,
  biddingWinner,
  CRITERIA,
  formatDate,
  procurementValue,
  needsBiddingNote,
  notCheapest,
  offerPrice,
  PROC_STATUS,
  quoteLine,
  quoteDiscountLabel,
  proofFiles,
  quotesAllItems,
  rupiah,
  termText,
  SCORE_SCALE,
  vendorScore,
  vendorTotals,
} from './utils.js';

// Judul langkah di dalam form bidding: nilai dulu (1), baru pilih pemenang (2).
function StepLabel({ n, title, hint }) {
  return (
    <Group gap="xs" wrap="nowrap" align="center">
      <ThemeIcon size={20} radius="xl" variant="light" color="primary">
        <Text fz={11} fw={700}>{n}</Text>
      </ThemeIcon>
      <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }}>{title}</Text>
      {hint && <Text fz={11} c="slate.6" tt="none" fw={400}>· {hint}</Text>}
    </Group>
  );
}

// Form bidding = satu tabel: item x vendor (harga, pilih pemenang), lalu total dan syarat final per vendor.
export default function BiddingForm({ f, role, patchProc, onSubmit, onApprove, onReject, ready, vendor }) {
  const proc = f.procurement ?? {};
  const st = proc.status;
  const locked = st === 'diajukan' || st === 'disetujui';
  const ro = locked || !canCreate(role, 'procurement');
  const q = f.quotes;
  const total = procurementValue(f);
  const kinds = [...new Set(f.items.map((i) => (i.kind === 'jasa' ? 'Jasa' : 'Barang')))].join(' & ');
  const needNote = needsBiddingNote(f);
  const needReason = notCheapest(f);
  const note = biddingNote(f);
  const proofs = proofFiles(proc);
  const lowestFinal = (itemId) => Math.min(...q.map((x) => offerPrice(f, x.vendorId, itemId) ?? Infinity));
  const totals = Object.fromEntries(q.map((x) => [x.vendorId, vendorTotals(f, x.vendorId)]));
  // Pembanding "termurah" hanya dari vendor yang menawar semua item; vendor dengan penawaran sebagian tidak sebanding.
  const full = q.filter((x) => quotesAllItems(f, x.vendorId));
  const minTotal = full.length ? Math.min(...full.map((x) => totals[x.vendorId].total)) : Infinity;
  // Satu pemenang untuk seluruh permintaan: semua item diisi vendor yang sama.
  const winner = biddingWinner(f);
  const pickWinner = (vendorId) => patchProc({ winners: Object.fromEntries(f.items.map((it) => [it.id, vendorId])) });
  const setScore = (vendorId, key, value) =>
    patchProc({ scores: { ...proc.scores, [vendorId]: { ...proc.scores?.[vendorId], [key]: Number(value) } } });
  const scores = q.map((x) => vendorScore(f, x.vendorId)).filter((s) => s != null);
  const bestScore = scores.length ? Math.max(...scores) : null;
  // Selama masih draf semua vendor tetap dirinci karena pemenangnya masih bisa diganti;
  // setelah diajukan pilihannya sudah final, jadi vendor lain cukup diringkas satu baris.
  const [compare, setCompare] = useState(false);
  const collapsed = locked && !!winner && !compare;
  const losers = q.filter((x) => x.vendorId !== winner);

  return (
    <Section
      divided
      icon={Scales}
      title="Form bidding"
      description="Harga dari penawaran vendor. Pilih satu vendor pemenang untuk seluruh permintaan, lalu ajukan."
      right={st ? <Badge radius="sm" variant="light" color={PROC_STATUS[st].color} tt="none">{PROC_STATUS[st].label}</Badge> : null}
    >
      <Stack gap="md">
        {/* Kepala lembar bidding: identitas dokumen + item yang dilelang di kiri, keterangan ringkas di kolom kanan. */}
        <Grid gutter={0} style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }}>
          <Grid.Col span={{ base: 12, sm: 8 }} p="md">
            <Text fz={10} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.6 }}>No. bidding</Text>
            <Text fz={20} fw={700} c="slate.9" lh={1.3}>{f.number.replace(/^FPPBJ/, 'BID')}</Text>
            <Group gap={6} wrap="wrap" mt="sm">
              {f.items.map((it) => (
                <Group key={it.id} gap={6} wrap="nowrap" pl="sm" pr={6} py={3} bg="slate.0" style={{ borderRadius: 999, maxWidth: '100%' }}>
                  <Text fz="xs" fw={600} c="slate.9" truncate>{it.desc}</Text>
                  <Text fz={11} fw={600} c="slate.7" px={6} py={1} bg="white" style={{ borderRadius: 999, whiteSpace: 'nowrap' }}>
                    {it.qty} {it.unit}
                  </Text>
                </Group>
              ))}
            </Group>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }} bg="slate.0" style={{ borderLeft: '1px solid var(--mantine-color-gray-2)' }}>
            {[['Tanggal', formatDate(TODAY)], ['Jenis', kinds], ['Approver', approverFor(total)]].map(([k, v], i) => (
              <Group key={k} justify="space-between" wrap="nowrap" px="md" py={10} style={{ borderTop: i ? '1px solid var(--mantine-color-gray-2)' : undefined }}>
                <Text fz="xs" c="slate.6">{k}</Text>
                <Text fz="sm" fw={700} c="slate.9" truncate>{v}</Text>
              </Group>
            ))}
          </Grid.Col>
        </Grid>

        <Stack gap="xs">
          <StepLabel n={1} title="Penilaian vendor (1–5)" hint="Nilai tiap vendor dulu, supaya pemilihan pemenang punya dasar." />
          <Callout title="Arti nilai 1–5">
            {SCORE_SCALE.map((s) => `${s.value} ${s.label} — ${s.text.toLowerCase()}`).join(' · ')}. Skor akhir = rata-rata
            tertimbang semua kriteria, jadi nilainya tetap 1–5. Skor ikut tampil di tabel pemenang sebagai bahan pertimbangan.
          </Callout>
          {/* Vendor jadi baris, kriteria jadi kolom: jumlah kriteria tetap, jadi lebarnya tidak ikut bertambah walau vendornya banyak. */}
          <Box style={frame}>
            <Table verticalSpacing="xs" horizontalSpacing="xs" miw={150 + CRITERIA.length * 140 + 88} styles={th}>
              <Table.Thead bg="slate.0">
                <Table.Tr>
                  <Table.Th w={150}>Vendor</Table.Th>
                  {CRITERIA.map((c) => (
                    <Table.Th key={c.key} w={140}>
                      <Group gap={4} wrap="nowrap">
                        <Text fz="xs" fw={600} c="slate.7">{c.label}</Text>
                        <Tooltip label={c.guide} withArrow multiline w={240} fz="xs">
                          <span style={{ display: 'flex', color: 'var(--mantine-color-slate-5)' }}><Info size={13} /></span>
                        </Tooltip>
                      </Group>
                      <Text fz={10} fw={400} c="slate.6">bobot {c.weight}%</Text>
                    </Table.Th>
                  ))}
                  <Table.Th w={88} ta="right">Skor</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {q.map((x) => {
                  const score = vendorScore(f, x.vendorId);
                  const best = score != null && score === bestScore;
                  return (
                    <Table.Tr key={x.id}>
                      <Table.Td>
                        <Text fz="sm" fw={600} c="slate.9">{vendor(x.vendorId)}</Text>
                        <Text fz={11} c="slate.6">{rupiah(totals[x.vendorId].total)}</Text>
                      </Table.Td>
                      {CRITERIA.map((c) => {
                        const v = proc.scores?.[x.vendorId]?.[c.key];
                        return (
                          <Table.Td key={c.key}>
                            {ro ? (
                              <Text fz="sm" fw={600}>{v ? `${v} · ${SCORE_SCALE.find((s) => s.value === v).label}` : '—'}</Text>
                            ) : (
                              <Select
                                size="xs"
                                radius="md"
                                placeholder="Nilai"
                                aria-label={`${c.label} ${vendor(x.vendorId)}`}
                                data={SCORE_SCALE.map((s) => ({ value: String(s.value), label: `${s.value} · ${s.label}` }))}
                                value={v ? String(v) : null}
                                onChange={(val) => setScore(x.vendorId, c.key, val)}
                              />
                            )}
                          </Table.Td>
                        );
                      })}
                      <Table.Td ta="right">
                        <Text fz="sm" fw={700} c={best ? 'green.8' : 'slate.9'}>
                          {score != null ? score.toFixed(2).replace('.', ',') : <Text span c="slate.5" fw={400}>—</Text>}
                        </Text>
                        {best && <Text fz={10} fw={700} c="green.8">TERTINGGI</Text>}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Box>
        </Stack>

        <Stack gap="xs">
          <Group justify="space-between" wrap="nowrap" align="center">
            <StepLabel
              n={2}
              title={locked && winner ? 'Vendor terpilih' : 'Pilih pemenang'}
              hint={locked && winner ? `${vendor(winner)} dipilih untuk seluruh permintaan.` : 'Satu vendor untuk seluruh permintaan.'}
            />
            {locked && winner && losers.length > 0 && (
              <Anchor component="button" type="button" fz="xs" fw={600} onClick={() => setCompare((v) => !v)}>
                {compare ? 'Sembunyikan vendor lain' : `Lihat ${losers.length} vendor lain`}
              </Anchor>
            )}
          </Group>

          {/* Satu kartu per vendor: identitas + total di kepala, item sebagai baris tabel (kolomnya tetap berapa pun itemnya), aksi di kaki. */}
          {q.filter((x) => !collapsed || x.vendorId === winner).map((x) => {
            const t = totals[x.vendorId];
            const covers = quotesAllItems(f, x.vendorId);
            const low = covers && full.length > 1 && t.total === minTotal;
            const win = winner === x.vendorId;
            const score = vendorScore(f, x.vendorId);
            const best = score != null && score === bestScore;
            const line = `var(--mantine-color-${win ? 'primary-2' : 'gray-2'})`;
            const termLabel = termText(x.term);
            return (
              <Box
                key={x.id}
                bg="white"
                style={{
                  border: `1px solid var(--mantine-color-${win ? 'primary-4' : 'gray-3'})`,
                  borderRadius: 'var(--mantine-radius-md)',
                  overflow: 'hidden',
                }}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap" px="md" py="sm" gap="md" bg={win ? 'primary.0' : undefined}>
                  <Group gap="sm" wrap="nowrap" align="flex-start" style={{ minWidth: 0 }}>
                    <ThemeIcon variant="light" color={win ? 'primary' : 'slate'} size={40} radius="md" style={{ flexShrink: 0 }}>
                      <Storefront size={20} />
                    </ThemeIcon>
                    <Box style={{ minWidth: 0 }}>
                      <Group gap={6} wrap="wrap">
                        <Text fz="sm" fw={700} c="slate.9">{vendor(x.vendorId)}</Text>
                        {low && <Badge size="xs" radius="sm" variant="light" color="green" fw={700} tt="none">Termurah</Badge>}
                        {!covers && <Badge size="xs" radius="sm" variant="light" color="orange" fw={700} tt="none">Tidak lengkap</Badge>}
                      </Group>
                      <Text fz={11} c="slate.6">
                        {x.no} · berlaku s.d. {formatDate(x.validUntil)} · {termLabel} · {x.lead} hari
                      </Text>
                    </Box>
                  </Group>
                  <Box ta="right" style={{ flexShrink: 0 }}>
                    <Text fz={11} c="slate.6">Total penawaran</Text>
                    <Text fz={20} fw={700} lh={1.3} c={low ? 'green.8' : 'slate.9'} style={{ whiteSpace: 'nowrap' }}>{rupiah(t.total)}</Text>
                  </Box>
                </Group>

                <Table verticalSpacing="xs" horizontalSpacing="md" styles={th} style={{ borderTop: `1px solid ${line}` }}>
                  <Table.Thead bg="slate.0">
                    <Table.Tr>
                      <Table.Th>Barang atau jasa</Table.Th>
                      <Table.Th ta="right" w={90}>Jumlah</Table.Th>
                      <Table.Th ta="right" w={150}>Harga satuan</Table.Th>
                      <Table.Th ta="right" w={150}>Jumlah harga</Table.Th>
                      <Table.Th ta="right" w={150}>Selisih dari termurah</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {f.items.map((it) => {
                      const l = quoteLine(x, it.id);
                      const fin = l ? offerPrice(f, x.vendorId, it.id) : null;
                      const cheapest = l && q.length > 1 && fin === lowestFinal(it.id);
                      return (
                        <Table.Tr key={it.id}>
                          <Table.Td>
                            <Text fz="sm" fw={600} c="slate.9">{it.desc}</Text>
                            {l?.spec && <Text fz={11} c="slate.6">{l.spec}</Text>}
                          </Table.Td>
                          <Table.Td ta="right" fz="sm" style={{ whiteSpace: 'nowrap' }}>{it.qty} {it.unit}</Table.Td>
                          <Table.Td ta="right" fz="sm" fw={600} c="slate.9">
                            {l ? rupiah(fin) : <Badge size="sm" radius="sm" variant="light" color="gray" fw={700} tt="none">Tidak ditawar</Badge>}
                          </Table.Td>
                          <Table.Td ta="right" fz="sm" fw={700}>{l ? rupiah(fin * it.qty) : '—'}</Table.Td>
                          <Table.Td ta="right" fz={11} fw={600} c={!l || cheapest ? 'slate.5' : 'red.7'}>
                            {!l ? '—' : cheapest ? rupiah(0) : `+${rupiah((fin - lowestFinal(it.id)) * it.qty)}`}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                    <Table.Tr bg="slate.0">
                      <Table.Td colSpan={3} fz="sm" fw={700} c="slate.9">Total penawaran</Table.Td>
                      <Table.Td ta="right" fz="sm" fw={700} c={low ? 'green.8' : 'slate.9'}>
                        {rupiah(t.total)}
                        <Text fz={10} c="slate.6" fw={400} style={{ whiteSpace: 'nowrap' }}>
                          {[
                            `DPP ${rupiah(t.dpp)}`,
                            `PPN ${rupiah(t.ppn)}`,
                            t.disc > 0 && `diskon ${quoteDiscountLabel(x)} (-${rupiah(t.disc)})`,
                            t.ship > 0 && `ongkir ${rupiah(t.ship)}`,
                          ].filter(Boolean).join(' · ')}
                        </Text>
                      </Table.Td>
                      <Table.Td />
                      <Table.Td ta="right" fz={11} fw={700} c={!covers || low ? 'slate.5' : 'red.7'}>
                        {!covers ? 'Tidak dibandingkan' : low ? rupiah(0) : `+${rupiah(t.total - minTotal)}`}
                      </Table.Td>
                    </Table.Tr>
                  </Table.Tbody>
                </Table>

                <Group justify="space-between" wrap="nowrap" px="md" py="sm" bg="white" style={{ borderTop: `1px solid ${line}` }}>
                  <Text fz={11} c={best ? 'green.8' : 'slate.6'} fw={best ? 700 : 400}>
                    Skor penilaian {score != null ? score.toFixed(2).replace('.', ',') : '— belum dinilai'}
                  </Text>
                  {ro ? (
                    win && <Badge size="sm" radius="sm" variant="filled" color="primary.9" fw={700} tt="none" leftSection={<Check size={12} />}>Vendor terpilih</Badge>
                  ) : covers ? (
                    <Button size="compact-sm" radius="md" variant={win ? 'filled' : 'light'} leftSection={<Check size={14} />} onClick={() => pickWinner(x.vendorId)}>
                      {win ? 'Vendor terpilih' : 'Pilih vendor ini'}
                    </Button>
                  ) : (
                    <Tooltip label="Vendor ini tidak menawar semua item, jadi tidak bisa dipilih." withArrow multiline w={220} fz="xs">
                      <span><Button size="compact-sm" radius="md" variant="light" leftSection={<Check size={14} />} disabled>Pilih vendor ini</Button></span>
                    </Tooltip>
                  )}
                </Group>
              </Box>
            );
          })}

        </Stack>

        {ro ? (
          <Stack gap="sm">
            {note.trim() && (
              <Box>
                <Text fz={11} fw={600} c="slate.6">Alasan pemilihan &amp; catatan negosiasi</Text>
                <Text fz="sm" style={{ whiteSpace: 'pre-wrap' }}>{note}</Text>
              </Box>
            )}
            {proofs.length > 0 && (
              <Box>
                <Text fz={11} fw={600} c="slate.6" mb={4}>Bukti negosiasi</Text>
                <AttachmentList names={proofs} label="Bukti negosiasi" />
              </Box>
            )}
          </Stack>
        ) : (
          <Stack gap="sm">
            <Textarea
              label="Alasan pemilihan & catatan negosiasi"
              description={
                needReason && needNote
                  ? 'Wajib: pemenang bukan penawaran terendah, dan harga final naik / syarat berubah / ada item tidak sesuai.'
                  : needReason
                  ? 'Wajib: pemenang bukan vendor dengan total penawaran terendah.'
                  : needNote
                  ? 'Wajib: harga final naik, syarat berubah, atau pemenang punya item Tidak sesuai.'
                  : 'Opsional. Jelaskan dasar pemilihan vendor dan hasil negosiasinya.'
              }
              withAsterisk={needReason || needNote}
              placeholder="Contoh: Spesifikasi sesuai dan garansi lebih lama. Vendor menyetujui diskon 5% untuk pembelian 10 unit."
              size="sm"
              radius="md"
              autosize
              minRows={3}
              value={note}
              onChange={(e) => patchProc({ reason: e.currentTarget.value, negotiation: '' })}
            />
            <DropField label="Bukti negosiasi" multiple value={proofs} onChange={(names) => patchProc({ proofs: names, proof: '' })} />
          </Stack>
        )}

        {st === 'ditolak' && <Callout tone="stop" title="Ditolak approver">{proc.note}</Callout>}
        <ApprovalBar st={st} role={role} ready={ready} onSubmit={onSubmit} onApprove={onApprove} onReject={onReject} label="bidding" fppbj={f} />
      </Stack>
    </Section>
  );
}
