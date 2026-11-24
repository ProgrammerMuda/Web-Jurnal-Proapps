// "Lingkup pekerjaan" di detail SPK. Jasa tidak dipesan per unit lalu diterima sebagian
// seperti barang: ia satu pekerjaan yang ditagih bertahap (termin, periode, retensi). Tabel
// item PO ("Dipesan 1 termin · Diterima 0 · Difaktur 0") membuat setiap tahap terbaca
// seperti barang terpisah, dan nama pekerjaannya terulang di tiap baris.
//
// Di sini pekerjaannya ditulis sekali sebagai kepala, lalu tahapnya jadi jadwal tagihan:
// tahap, porsi atau periode, nilai, dan status BAPP/faktur tiap tahap.
import { Badge, Box, Group, Table, Text } from '@mantine/core';
import { StatusPill } from './components.jsx';
import { termMechanics } from './paymentTerms.js';
import { advancePct, dpState, formatDate, invoicedQty, invoicedQtyOfPo, lineRate, poDpDpp, poPphPct, poPpnRate, poRetention, receiptConfirmed, receiptsOf, retentionPctOf, rupiah } from './utils.js';

// Label pendek untuk kolom status yang sempit.
const DP_SHORT = {
  belum_faktur: { label: 'Belum ditagih', color: 'orange' },
  belum_bayar: { label: 'Belum dibayar', color: 'orange' },
  lunas: { label: 'Lunas', color: 'green' },
  dibatalkan: { label: 'Dibatalkan', color: 'gray' },
};

const th = { th: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600, color: 'var(--mantine-color-slate-7)', whiteSpace: 'nowrap' } };

// "Renovasi pantry lantai 5 — Termin 1 dari 4 · 25%" -> { base, stage: "Termin 1" }
function parse(item) {
  const [base, rest] = item.desc.split(' — ');
  if (!rest) return { base, stage: null };
  if (item.unit === 'retensi') return { base, stage: 'Retensi', note: rest.replace(/^Retensi \d+(?:[.,]\d+)?%\s*/, '').replace(/^\(|\)$/g, '') };
  return { base, stage: rest.split(' · ')[0].replace(/ dari \d+$/, '') };
}

const shortRange = (from, to) => {
  if (!from) return '–';
  const f = formatDate(from);
  const t = formatDate(to);
  // "1 Des 2026 – 31 Des 2026" -> "1 – 31 Des 2026" bila bulan dan tahunnya sama.
  const [fd, ...fr] = f.split(' ');
  return fr.join(' ') === t.split(' ').slice(1).join(' ') ? `${fd} – ${t}` : `${f} – ${t}`;
};

export default function SpkScope({ po, pb, receipts, pakaiTerima, noPrice }) {
  // Kelompokkan baris jadwal per pekerjaan asalnya.
  const groups = [];
  for (const it of po.items) {
    const p = parse(it);
    let g = groups.find((x) => x.base === p.base);
    if (!g) groups.push((g = { base: p.base, spec: it.spec, rows: [] }));
    g.rows.push({ ...it, ...p });
  }
  const periodic = po.items.some((i) => i.periodFrom);
  // Pada jadwal lama DP + termin progres, uang muka di luar jadwal: angka di sini belum termasuk DP.
  const dpTerpisah = termMechanics(po.term).dpOutOfSchedule;
  // Kolom uang mengikuti terminnya: potongan DP hanya bila ada uang muka yang dipotong
  // proporsional, retensi hanya bila terminnya menahan retensi. "Dibayar" baru muncul kalau
  // ada potongan, supaya termin polos tidak berisi dua kolom dengan angka kembar.
  const dpPct = advancePct(po.term) > 0 && advancePct(po.term) < 100 && !dpTerpisah && po.dpWaiver?.status !== 'disetujui' ? advancePct(po.term) : 0;
  const retPct = retentionPctOf(po);
  const pphPct = poPphPct(po);
  const showPaid = !noPrice && (dpPct > 0 || retPct > 0 || pphPct > 0);
  const money = (nilai, it) => {
    const dp = Math.round((nilai * dpPct) / 100);
    const ret = Math.round((nilai * retPct) / 100);
    const ppn = Math.round((nilai - dp) * lineRate(it));
    const pph = Math.round(((nilai - dp - ret) * (it.pphRate ?? 0)));
    return { dp, ret, paid: nilai - dp + ppn - ret - pph };
  };
  const dpInfo = dpPct > 0 ? dpState(po, pb.calc) : null;
  const retInfo = retPct > 0 ? poRetention(po, pb.invoices) : null;

  const statusOf = (it) => {
    const billed = pakaiTerima
      ? receipts.reduce((n, r) => n + invoicedQty(r.id, it.id, pb.invoices), 0)
      : invoicedQtyOfPo(po.id, it.id, pb.invoices);
    if (billed >= it.qty) return { label: 'Difaktur', color: 'green' };
    if (!pakaiTerima) return { label: 'Belum difaktur', color: 'gray' };
    // BAPP yang masih draf belum sah sebagai serah terima: ia menunggu approval atasan.
    const qtyIn = (list) => list.reduce((n, r) => n + r.lines.filter((l) => l.itemId === it.id).reduce((m, l) => m + l.qty, 0), 0);
    const mine = receiptsOf(po, pb.receipts);
    if (qtyIn(mine.filter(receiptConfirmed)) >= it.qty) return { label: 'BAPP · belum difaktur', color: 'orange' };
    const draf = mine.find((r) => !receiptConfirmed(r) && r.status !== 'dibatalkan' && r.lines.some((l) => l.itemId === it.id));
    if (draf?.status === 'ditolak') return { label: 'BAPP ditolak', color: 'red' };
    if (draf) return { label: 'Menunggu approval', color: 'orange', pending: true, doc: draf };
    return { label: 'Belum BAPP', color: 'gray' };
  };

  return groups.map((g, gi) => {
    const nilai = g.rows.reduce((n, r) => n + r.qty * r.price, 0);
    const scheduled = g.rows.some((r) => r.stage) || dpPct > 0 || retPct > 0;
    const first = gi === 0;
    const last = gi === groups.length - 1;
    const dpDpp = poDpDpp(po);
    const dpPpn = Math.round(dpDpp * poPpnRate(po));
    const pill = (label, color) => <Badge size="sm" radius="xl" variant="light" color={color} tt="none" fw={600}>{label}</Badge>;
    return (
      <Box key={g.base} style={{ borderTop: gi ? '1px solid var(--mantine-color-gray-3)' : undefined }}>
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md" px="lg" py="md">
          <Box style={{ minWidth: 0 }}>
            <Text fz="sm" fw={700} c="slate.9">{g.base}</Text>
            {g.spec && <Text fz="xs" c="slate.6">{g.spec}</Text>}
          </Box>
          {!noPrice && (
            <Box ta="right" style={{ flexShrink: 0 }}>
              <Text fz={11} c="slate.6">{dpTerpisah ? 'Nilai tagihan, di luar uang muka' : 'Nilai tagihan'}</Text>
              <Text fz="sm" fw={700} c="slate.9" style={{ whiteSpace: 'nowrap' }}>{rupiah(nilai)}</Text>
            </Box>
          )}
        </Group>
        {scheduled && (
          <Box style={{ overflow: 'auto', borderTop: '1px solid var(--mantine-color-gray-2)' }}>
            <Table verticalSpacing="xs" horizontalSpacing="sm" miw={showPaid ? 760 : 520} styles={th}>
              <Table.Thead bg="slate.0">
                <Table.Tr>
                  <Table.Th pl="lg">Tahap</Table.Th>
                  <Table.Th>{periodic ? 'Periode' : 'Porsi'}</Table.Th>
                  {!noPrice && <Table.Th ta="right">Nilai</Table.Th>}
                  {!noPrice && dpPct > 0 && <Table.Th ta="right">Potong DP</Table.Th>}
                  {!noPrice && retPct > 0 && <Table.Th ta="right">Retensi</Table.Th>}
                  {showPaid && <Table.Th ta="right">Dibayar</Table.Th>}
                  <Table.Th pr="lg" ta="right">Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {first && dpPct > 0 && (
                  <Table.Tr bg="orange.0">
                    <Table.Td pl="lg" fz="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>Uang muka</Table.Td>
                    <Table.Td fz="sm" c="slate.7">{dpPct}%</Table.Td>
                    {!noPrice && <Table.Td ta="right" fz="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>{rupiah(dpDpp)}</Table.Td>}
                    {!noPrice && <Table.Td ta="right" fz="sm" c="slate.5">–</Table.Td>}
                    {!noPrice && retPct > 0 && <Table.Td ta="right" fz="sm" c="slate.5">–</Table.Td>}
                    {showPaid && <Table.Td ta="right" fz="sm" fw={700} style={{ whiteSpace: 'nowrap' }}>{rupiah(dpDpp + dpPpn - Math.round((dpDpp * pphPct) / 100))}</Table.Td>}
                    <Table.Td pr="lg" ta="right">{dpInfo ? pill(DP_SHORT[dpInfo.state].label, DP_SHORT[dpInfo.state].color) : null}</Table.Td>
                  </Table.Tr>
                )}
                {g.rows.map((r) => {
                  const s = statusOf(r);
                  const m = money(r.qty * r.price, r);
                  return (
                    <Table.Tr key={r.id}>
                      <Table.Td pl="lg" fz="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>{r.stage ?? 'Sekali tagih'}</Table.Td>
                      <Table.Td fz="sm" c="slate.7" style={{ whiteSpace: 'nowrap' }}>
                        {r.stage === 'Retensi' ? r.note : periodic ? shortRange(r.periodFrom, r.periodTo) : r.pct != null ? `${r.pct}%` : '–'}
                      </Table.Td>
                      {!noPrice && <Table.Td ta="right" fz="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>{rupiah(r.qty * r.price)}</Table.Td>}
                      {!noPrice && dpPct > 0 && <Table.Td ta="right" fz="sm" c="red.7" style={{ whiteSpace: 'nowrap' }}>−{rupiah(m.dp)}</Table.Td>}
                      {!noPrice && retPct > 0 && <Table.Td ta="right" fz="sm" c="red.7" style={{ whiteSpace: 'nowrap' }}>−{rupiah(m.ret)}</Table.Td>}
                      {showPaid && <Table.Td ta="right" fz="sm" fw={700} style={{ whiteSpace: 'nowrap' }}>{rupiah(m.paid)}</Table.Td>}
                      <Table.Td pr="lg" ta="right">
                        {s.pending
                          ? <StatusPill map={{ p: s }} status="p" approval={{ doc: s.doc, kind: 'bapp' }} />
                          : <Badge size="sm" radius="xl" variant="light" color={s.color} tt="none" fw={600}>{s.label}</Badge>}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
                {last && retInfo && (
                  <Table.Tr bg="violet.0">
                    <Table.Td pl="lg" fz="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>Pelepasan retensi</Table.Td>
                    <Table.Td fz="sm" c="slate.7" style={{ whiteSpace: 'nowrap' }}>setelah {retInfo.months} bln</Table.Td>
                    {!noPrice && <Table.Td ta="right" fz="sm" c="slate.5">–</Table.Td>}
                    {!noPrice && dpPct > 0 && <Table.Td ta="right" fz="sm" c="slate.5">–</Table.Td>}
                    {!noPrice && <Table.Td ta="right" fz="sm" c="green.8" style={{ whiteSpace: 'nowrap' }}>+{rupiah(retInfo.target)}</Table.Td>}
                    {showPaid && <Table.Td ta="right" fz="sm" fw={700} style={{ whiteSpace: 'nowrap' }}>{rupiah(retInfo.target - Math.round((retInfo.target * pphPct) / 100))}</Table.Td>}
                    <Table.Td pr="lg" ta="right">
                      {retInfo.balance <= 0 && retInfo.released > 0
                        ? pill('Dilepas', 'green')
                        : retInfo.maintenanceEnd
                          ? pill(`Tersedia ${formatDate(retInfo.maintenanceEnd)}`, 'violet')
                          : pill('Menunggu termin', 'gray')}
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Box>
        )}
      </Box>
    );
  });
}
