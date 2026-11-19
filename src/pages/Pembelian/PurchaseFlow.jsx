// Panel "Alur pembelian": rantai dokumen dari permintaan sampai Payment Voucher.
// Dipakai di semua halaman detail; dokumen yang sedang dibuka ditandai "Dokumen ini".
import { Badge, Box, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { Check, TreeStructure } from '@/components/Icon.jsx';
import { DocNumber, Section, StatusPill } from './components.jsx';
import { advancePct, PR_STATUS, PROC_STATUS, routeLabel } from './utils.js';

// Satu langkah: titik status + judul + dokumen terkait.
export function FlowStep({ index, current, last, title, children, mark, state }) {
  const done = state ? state === 'done' : index < current;
  const active = state ? state === 'active' : index === current;
  return (
    <Group gap="sm" align="flex-start" wrap="nowrap">
      <Stack align="center" gap={0} style={{ alignSelf: 'stretch', flexShrink: 0 }}>
        <ThemeIcon
          size={26}
          radius="xl"
          variant={done ? 'filled' : 'default'}
          color={done ? 'secondary.7' : 'slate'}
          style={active ? { background: 'var(--mantine-color-secondary-1)', borderColor: 'var(--mantine-color-secondary-3)' } : undefined}
        >
          {done ? <Check size={14} /> : <Text fz={mark ? 9 : 11} fw={700} c={active ? 'secondary.9' : 'slate.5'}>{mark ?? index + 1}</Text>}
        </ThemeIcon>
        {!last && <Box w={2} mt={4} style={{ flex: 1, minHeight: 16, background: done ? 'var(--mantine-color-secondary-7)' : 'var(--mantine-color-gray-3)' }} />}
      </Stack>
      <Box pb={last ? 0 : 'md'} style={{ minWidth: 0, flex: 1 }}>
        <Text fz="sm" fw={active ? 700 : 600} c={done || active ? 'slate.9' : 'slate.6'}>{title}</Text>
        <Box mt={2}>{children}</Box>
      </Box>
    </Group>
  );
}

const Empty = ({ children }) => <Text fz="xs" c="slate.6">{children}</Text>;

// Telusuri rantai dokumen mulai dari dokumen yang sedang dibuka.
// current = { kind: 'fppbj' | 'po' | 'receipt' | 'invoice' | 'pr' | 'voucher', id }
export function resolveChain(current, pb) {
  const { kind, id } = current;
  let fppbj = null;
  let pos = [];

  if (kind === 'fppbj') {
    fppbj = pb.fppbjById[id];
    pos = pb.pos.filter((p) => p.fppbjId === id);
  } else {
    // Dokumen hilir selalu bisa ditarik balik ke satu PO.
    let poId = null;
    if (kind === 'po') poId = id;
    if (kind === 'receipt') poId = pb.receiptsById[id]?.poId;
    if (kind === 'invoice') poId = pb.invoicesById[id]?.poId;
    if (kind === 'pr' || kind === 'voucher') {
      const pr = kind === 'pr' ? pb.prsById[id] : pb.prsById[(pb.vouchersById[id]?.prIds ?? [])[0]];
      poId = pr?.poId ?? pb.invoicesById[(pr?.invoiceIds ?? [])[0]]?.poId;
    }
    const po = poId ? pb.posById[poId] : null;
    pos = po ? [po] : [];
    fppbj = po?.fppbjId ? pb.fppbjById[po.fppbjId] : null;
  }

  const poIds = pos.map((p) => p.id);
  const receipts = pb.receipts.filter((r) => poIds.includes(r.poId));
  const invoices = pb.invoices.filter((i) => poIds.includes(i.poId));
  const prs = pb.prs.filter(
    (p) => p.status !== 'ditolak' && (poIds.includes(p.poId) || invoices.some((i) => p.invoiceIds?.includes(i.id))),
  );
  const dps = prs.filter((p) => p.kind === 'dp');
  const pays = prs.filter((p) => p.kind !== 'dp');
  const vouchers = pb.vouchers.filter((v) => (v.prIds ?? []).some((x) => prs.some((p) => p.id === x)));
  return { fppbj, pos, receipts, invoices, dps, pays, vouchers };
}

export default function PurchaseFlow({ pb, go, current, description = 'Dokumen yang saling terkait' }) {
  const { fppbj, pos, receipts, invoices, dps, pays, vouchers } = resolveChain(current, pb);
  const proc = fppbj?.procurement;

  const here = (kind, id) => current.kind === kind && current.id === id;
  const mine = (kind, id) =>
    here(kind, id) ? <Badge size="xs" radius="sm" variant="light" color="primary" tt="none">Dokumen ini</Badge> : null;

  // Satu baris dokumen: nomor (klik = pindah halaman) + badge opsional.
  const docRow = (key, route, id, number, extra) => (
    <Group key={key} gap={6}>
      {here(route, id) ? (
        <Text fz="xs" fw={700} c="primary.9">{number}</Text>
      ) : (
        <DocNumber onClick={() => go({ name: route === 'voucher' ? 'voucher' : route, id })}>{number}</DocNumber>
      )}
      {mine(route, id)}
      {extra}
    </Group>
  );

  // Langkah "Bayar di muka" hanya ditampilkan kalau terminnya memang memuat pembayaran di
  // muka. Pada CAD atau bayar penuh di akhir, langkah itu tidak akan pernah terjadi —
  // menampilkannya sebagai "Tidak ada" hanya memanjangkan alur dan mengaburkan langkah yang
  // benar-benar perlu dikerjakan.
  //
  // Terminnya dibaca dari pesanan. Selama pesanan belum terbit terminnya belum pasti, jadi
  // langkahnya tetap ditampilkan; begitu PR uang muka sudah ada, ia selalu ditampilkan apa pun
  // terminnya (dokumennya nyata, tidak boleh disembunyikan).
  const showDp = dps.length > 0 || !pos.length || pos.some((p) => advancePct(p.term) > 0);

  const state = {
    fppbj: !fppbj ? 'pending' : pos.length || fppbj.status === 'selesai' ? 'done' : 'active',
    // PO langsung tidak lewat permintaan/pengadaan: dua langkah pertama dibiarkan abu.
    proc: !fppbj ? 'pending' : proc?.status === 'disetujui' || pos.length ? 'done' : fppbj.route ? 'active' : 'pending',
    po: !pos.length ? 'pending' : pos.every((p) => p.sent) ? 'done' : 'active',
    dp: dps.some((p) => p.status === 'dibayar') ? 'done' : dps.length ? 'active' : 'pending',
    receipt: receipts.length ? 'done' : pos.some((p) => p.sent) ? 'active' : 'pending',
    invoice: invoices.length ? 'done' : receipts.length ? 'active' : 'pending',
    pay: pays.length && pays.every((p) => p.status === 'dibayar') ? 'done' : pays.length ? 'active' : 'pending',
    pv: vouchers.length ? 'done' : 'pending',
  };

  return (
    <Section divided icon={TreeStructure} title="Alur pembelian" description={description}>
      <Stack gap={0}>
        <FlowStep index={0} mark={fppbj ? undefined : '—'} state={state.fppbj} title="Permintaan Pembelian">
          {fppbj
            ? docRow(fppbj.id, 'fppbj', fppbj.id, fppbj.number)
            : <Empty>Tanpa permintaan (PO langsung)</Empty>}
        </FlowStep>

        <FlowStep index={1} mark={fppbj ? undefined : '—'} state={state.proc} title="Pengadaan">
          {fppbj?.route ? (
            <Text fz="xs" c="slate.6">
              {routeLabel(fppbj)}{proc?.status ? ` · ${PROC_STATUS[proc.status]?.label ?? proc.status}` : ''}
            </Text>
          ) : <Empty>{fppbj ? 'Belum dimulai' : 'Dilewati'}</Empty>}
        </FlowStep>

        <FlowStep index={2} state={state.po} title="Pesanan (PO / SPK)">
          {pos.length
            ? pos.map((p) => <Box key={p.id}>{docRow(p.id, 'po', p.id, p.number)}</Box>)
            : <Empty>Belum dibuat</Empty>}
        </FlowStep>

        {showDp && (
          <FlowStep index={3} mark="DP" state={state.dp} title="Bayar di muka">
            {dps.length
              ? dps.map((p) => <Box key={p.id}>{docRow(p.id, 'pr', p.id, p.number, <StatusPill map={PR_STATUS} status={p.status} size="xs" />)}</Box>)
              : <Empty>Belum diajukan</Empty>}
          </FlowStep>
        )}

        <FlowStep index={3} state={state.receipt} title="Penerimaan">
          {receipts.length
            ? receipts.map((r) => <Box key={r.id}>{docRow(r.id, 'receipt', r.id, r.number)}</Box>)
            : <Empty>Belum ada</Empty>}
        </FlowStep>

        <FlowStep index={4} state={state.invoice} title="Faktur">
          {invoices.length
            ? invoices.map((i) => <Box key={i.id}>{docRow(i.id, 'invoice', i.id, i.number)}</Box>)
            : <Empty>Belum dibuat</Empty>}
        </FlowStep>

        <FlowStep index={5} state={state.pay} title="Pelunasan">
          {pays.length
            ? pays.map((p) => <Box key={p.id}>{docRow(p.id, 'pr', p.id, p.number, <StatusPill map={PR_STATUS} status={p.status} size="xs" />)}</Box>)
            : <Empty>Belum ada</Empty>}
        </FlowStep>

        <FlowStep index={6} mark="PV" state={state.pv} last title="Payment Voucher">
          {vouchers.length
            ? vouchers.map((v) => <Box key={v.id}>{docRow(v.id, 'voucher', v.id, v.number)}</Box>)
            : <Empty>Belum terbit</Empty>}
        </FlowStep>
      </Stack>
    </Section>
  );
}
