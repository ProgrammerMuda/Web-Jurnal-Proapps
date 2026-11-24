// Rincian termin bayar per tahap: berapa yang dibayar di tiap tahap dan kapan jatuh temponya.
// Dulu satu kalimat panjang ("DP + pelunasan 30% · jatuh tempo saat penerimaan") yang menumpuk
// nama, persentase, dan tempo jadi satu, padahal pembaca perlu tahu dua hal terpisah: uang
// mukanya berapa dan kapan, pelunasannya berapa dan kapan.
import { Box, Group, Stack, Text } from '@mantine/core';
import { termMechanics } from './paymentTerms.js';
import { periodOptions } from './data.js';
import { advancePct, dueDaysOf, poAllJasa, poTotal, rupiah, scheduleCount, termPcts } from './utils.js';

// Batas termin yang dirinci satu per satu; lebih dari ini diringkas jadi satu baris.
const MAX_ROWS = 4;

function dueText(t, mech, jasa) {
  const days = dueDaysOf(t);
  if (mech.dueFrom === 'invoice') return days > 0 ? `${days} hari sejak faktur` : 'saat faktur terbit';
  const titik = jasa ? 'BAPP' : 'barang diterima';
  return days > 0 ? `${days} hari sejak ${titik}` : `saat ${titik}`;
}

// Dipakai untuk PO/SPK maupun penawaran vendor: cukup termin, nilai total, dan apakah
// isinya jasa semua (menentukan sebutan "BAPP" vs "barang diterima").
export function termStages({ term: t, total = 0, jasa = false }) {
  if (!t) return [];
  const mech = termMechanics(t);
  const pct = advancePct(t);
  const stages = [];

  if (mech.advance === 'full') {
    return [{ key: 'full', label: 'Bayar penuh di muka', pct: 100, amount: total, due: jasa ? 'sebelum pekerjaan dimulai' : 'sebelum barang dikirim' }];
  }

  // Sama dengan poDpAmount: pada termin yang jadwalnya sudah mengeluarkan DP, total yang
  // tercatat hanya sisa setelah DP, jadi nilai kontrak penuhnya dipulihkan dulu.
  const dp = mech.advance !== 'partial' || pct <= 0 ? 0
    : mech.dpOutOfSchedule && pct < 100 ? Math.round((total * pct) / (100 - pct))
      : Math.round((total * pct) / 100);
  if (dp > 0) stages.push({ key: 'dp', label: 'Uang muka', pct, amount: dp, due: 'saat faktur DP terbit', tone: 'dp' });

  // Termin yang jadwalnya sudah mengeluarkan DP: total PO = sisa setelah DP. Selain itu sisa
  // = total dikurangi DP.
  const rest = mech.dpOutOfSchedule ? total : total - dp;
  const ret = mech.retention ? Math.round((rest * (t.retentionPct ?? 0)) / 100) : 0;
  const paid = rest - ret;
  const due = dueText(t, mech, jasa);

  if (mech.split === 'terms') {
    const n = scheduleCount(t);
    const pcts = termPcts(t);
    if (n <= MAX_ROWS) {
      pcts.forEach((p, i) => stages.push({ key: `t${i}`, label: `Termin ${i + 1}`, pct: p, sub: dp > 0 ? 'dari sisa setelah DP' : null, amount: Math.round((paid * p) / 100), due }));
    } else {
      stages.push({ key: 'terms', label: `${n} termin progres`, sub: 'sesuai progres pekerjaan', amount: paid, due });
    }
  } else if (mech.split === 'periods') {
    const n = scheduleCount(t);
    const unit = periodOptions.find((o) => o.value === t.period)?.label ?? t.period ?? 'periode';
    stages.push({ key: 'per', label: `Tagihan ${unit.toLowerCase()}`, sub: `${n} kali`, amount: Math.round(paid / n), amountSuffix: ` / ${t.period ?? 'periode'}`, due });
  } else {
    stages.push({ key: 'rest', label: dp > 0 ? 'Pelunasan' : 'Pembayaran penuh', pct: dp > 0 && !mech.dpOutOfSchedule ? 100 - pct : dp > 0 ? null : 100, amount: paid, due });
  }

  if (ret > 0) {
    stages.push({ key: 'ret', label: 'Retensi', pct: t.retentionPct, amount: ret, due: `setelah masa pemeliharaan ${t.retentionMonths ?? 0} bulan` });
  }
  return stages;
}

// Pakai `po` untuk pesanan, atau `term` + `total` (+ `jasa`) untuk penawaran.
export default function TermBreakdown({ po, term, total, jasa, noPrice = false }) {
  const t = po ? po.term : term;
  const mech = termMechanics(t);
  const name = (mech.label ?? t?.type ?? '—').split(' (')[0];
  const stages = termStages(po ? { term: t, total: poTotal(po), jasa: poAllJasa(po) } : { term: t, total, jasa });
  return (
    <Stack gap={8}>
      <Text fz="sm" fw={700} c="slate.9">{name}</Text>
      {stages.length > 0 && (
        <Box style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }}>
          {stages.map((s, i) => (
            <Group
              key={s.key}
              justify="space-between"
              align="flex-start"
              wrap="nowrap"
              gap="md"
              px="sm"
              py={8}
              bg={s.tone === 'dp' ? 'orange.0' : undefined}
              style={{ borderTop: i ? '1px solid var(--mantine-color-gray-2)' : undefined }}
            >
              <Box style={{ minWidth: 0 }}>
                <Text fz="xs" fw={700} c="slate.9">
                  {s.label}
                  {s.pct != null && <Text span fz="xs" fw={700} c={s.tone === 'dp' ? 'orange.8' : 'primary.7'}> {s.pct}%</Text>}
                  {s.sub && <Text span fz={11} fw={400} c="slate.6"> · {s.sub}</Text>}
                </Text>
                <Text fz={11} fw={400} c="slate.6">Jatuh tempo: {s.due}</Text>
              </Box>
              {!noPrice && (
                <Text fz="xs" fw={700} c="slate.9" style={{ whiteSpace: 'nowrap' }}>
                  {rupiah(s.amount)}
                  {s.amountSuffix && <Text span fz={11} fw={400} c="slate.6">{s.amountSuffix}</Text>}
                </Text>
              )}
            </Group>
          ))}
        </Box>
      )}
    </Stack>
  );
}
