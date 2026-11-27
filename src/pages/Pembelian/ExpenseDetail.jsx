// Detail Biaya: rincian, keputusan (verifikasi, persetujuan), pembayaran, dan jurnalnya.
// Aksi di kepala halaman mengikuti tahap dokumen dan peran yang sedang dipakai, jadi setiap
// orang hanya melihat satu langkah yang memang gilirannya.
import { useState } from 'react';
import { ActionIcon, Badge, Box, Button, Card, Grid, Group, Menu, Select, SimpleGrid, Stack, Switch, Table, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { ArrowCounterClockwise, Calculator, Check, DotsThreeVertical, Info, Money, PencilSimple, Receipt, ShieldCheck, X } from '@/components/Icon.jsx';
import { useData } from '@/lib/store.jsx';
import AttachmentList from './Attachments.jsx';
import ApprovalLog, { chainSteps } from './ApprovalLog.jsx';
import { BackLink, Callout, CardHead, CopyIcon, DataTable, DocNumber, FormModal, RoleChip, Section, StatusPill } from './components.jsx';
import { personLabel, TODAY } from './data.js';
import { ReasonModal } from './Dialogs.jsx';
import {
  categoryOf,
  EXPENSE_ACCOUNTS,
  EXPENSE_LIMIT,
  EXPENSE_STATUS,
  expenseApproval,
  expenseApprovalKind,
  expenseGross,
  expenseStatus,
  lineGross,
  PPH_OPTIONS,
  pphOf,
  splitPpn,
} from './expenses.js';
import JournalCard from './JournalCard.jsx';
import { invoiceJournal } from './journal.js';
import { PrActions } from './PoDetail.jsx';
import { canCreate, canVerify, isApproverTurn, isSuperadmin, logEntry, roleLabel, samePerson, signApproval, withLog } from './permissions.js';
import { toast } from './usePb.js';
import { formatDate, invOverdue, invTotals, PR_STATUS, rupiah } from './utils.js';

const th = { th: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600, color: 'var(--mantine-color-slate-7)', whiteSpace: 'nowrap' } };
const num = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

const row = (label, value, extra) => (
  <Group justify="space-between" wrap="nowrap" align="flex-start" gap="md">
    <Text fz="xs" c="slate.7">{label}</Text>
    <Text fz="xs" fw={600} ta="right" style={num} {...extra}>{value}</Text>
  </Group>
);

// Hitung pratinjau dari baris hasil verifikasi: DPP, PPN, PPh, dan yang dibayar ke penerima.
function preview(lines, pphPct) {
  const dpp = lines.reduce((n, l) => n + l.price, 0);
  const ppn = lines.reduce((n, l) => n + Math.round(l.price * l.ppnRate), 0);
  const pph = Math.round((dpp * pphPct) / 100);
  return { dpp, ppn, pph, net: dpp + ppn - pph };
}

// --- Verifikasi Accounting -----------------------------------------------------------------------
function VerifyModal({ opened, onClose, exp, onConfirm }) {
  const [lines, setLines] = useState(() => exp.lines.map((l) => ({ ...l, gross: lineGross(l), withPpn: (l.ppnRate ?? 0) > 0 })));
  const [pph, setPph] = useState(exp.pphType ?? 'none');
  const [taxNo, setTaxNo] = useState(exp.taxNo ?? '');
  const setLine = (id, patch) => setLines((s) => s.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const final = lines.map((l) => ({ ...l, ...splitPpn(l.gross, l.withPpn) }));
  const p = pphOf(pph);
  const t = preview(final, p.pct);
  const anyPpn = lines.some((l) => l.withPpn);
  const kind = expenseGross(exp) > EXPENSE_LIMIT ? 'Chief Finance lalu Building Manager' : 'Building Manager';
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={760}
      icon={ShieldCheck}
      title={`Verifikasi ${exp.number}`}
      subtitle="Tetapkan akun beban dan pajaknya. Setelah ini biaya diajukan ke approver."
      footer={
        <>
          <Button variant="default" radius="md" onClick={onClose}>Batal</Button>
          <Button
            radius="md"
            leftSection={<Check size={16} />}
            onClick={() => onConfirm({
              lines: final.map((l) => {
                const { withPpn, ...rest } = l;
                void withPpn;
                return rest;
              }),
              pphType: p.value,
              pphPct: p.pct,
              pphAccount: p.account,
              taxNo: taxNo.trim(),
            })}
          >
            Verifikasi & ajukan ke approver
          </Button>
        </>
      }
    >
      <Stack gap="md">
        <Box style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)', overflow: 'auto' }}>
          <Table verticalSpacing="xs" horizontalSpacing="sm" miw={640} styles={th}>
            <Table.Thead bg="slate.0">
              <Table.Tr>
                <Table.Th>Baris tagihan</Table.Th>
                <Table.Th w={260}>Akun beban</Table.Th>
                <Table.Th w={110}>PPN 11%</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lines.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>
                    <Text fz="sm" fw={600} c="slate.9">{l.desc}</Text>
                    <Text fz={11} c="slate.6">{categoryOf(l.category)?.label ?? 'Lainnya'} · {rupiah(l.gross)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Select size="xs" radius="md" searchable allowDeselect={false} data={EXPENSE_ACCOUNTS} value={l.account} onChange={(v) => setLine(l.id, { account: v })} aria-label="Akun beban" comboboxProps={{ withinPortal: true }} />
                  </Table.Td>
                  <Table.Td>
                    <Switch size="sm" checked={l.withPpn} onChange={(e) => setLine(l.id, { withPpn: e.currentTarget.checked })} label={l.withPpn ? 'Termasuk' : 'Tidak'} aria-label="Termasuk PPN" />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Box>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Select size="sm" radius="md" label="PPh dipotong" allowDeselect={false} data={PPH_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} value={pph} onChange={setPph} comboboxProps={{ withinPortal: true }} />
          <TextInput size="sm" radius="md" label="No. faktur pajak" placeholder={anyPpn ? '010.000-26.00000000' : 'Tidak ada PPN'} disabled={!anyPpn} value={anyPpn ? taxNo : ''} onChange={(e) => setTaxNo(e.currentTarget.value)} />
        </SimpleGrid>
        <Card withBorder radius="md" padding="md" bg="slate.0">
          <Stack gap={6}>
            {row('DPP (masuk beban)', rupiah(t.dpp))}
            {row('PPN masukan', rupiah(t.ppn))}
            {p.pct > 0 && row(`${p.label.split(' · ')[0]} dipotong`, `-${rupiah(t.pph)}`, { c: 'red.7' })}
            {row('Dibayar ke penerima', rupiah(t.net), { fw: 700, c: 'slate.9' })}
          </Stack>
        </Card>
        <Text fz="xs" c="slate.6">Approver: {kind}{expenseGross(exp) > EXPENSE_LIMIT ? ` (di atas ${rupiah(EXPENSE_LIMIT)})` : ''}.</Text>
      </Stack>
    </FormModal>
  );
}

export default function ExpenseDetail({ expense: exp, pb, onBack, go, openDialog }) {
  const role = pb.role;
  const { stockMoves, products } = useData();
  const vendor = pb.vendorsById[exp.vendorId];
  const t = invTotals(exp, pb.calc);
  const status = expenseStatus(exp, t);
  const booked = exp.stage === 'dibukukan' && !exp.cancelled;
  const kind = expenseApprovalKind(exp);
  const ap = expenseApproval(exp);
  const gross = expenseGross(exp);
  const prs = pb.prs.filter((p) => p.invoiceIds?.includes(exp.id));
  const [modal, setModal] = useState(null);

  const mine = isSuperadmin(role) || samePerson(role, exp.createdBy) || exp.createdBy === personLabel(role);
  const canVerifyNow = !exp.cancelled && exp.stage === 'verifikasi' && canVerify(role, 'expense');
  const ownDoc = !isSuperadmin(role) && exp.createdBy === personLabel(role);
  const canApproveNow = !exp.cancelled && exp.stage === 'persetujuan' && isApproverTurn(role, exp, kind) && !ownDoc;
  const canResubmit = !exp.cancelled && exp.stage === 'dikembalikan' && canCreate(role, 'expense') && mine;
  const canPay = booked && t.free > 0 && canCreate(role, 'pr');
  const activePr = prs.some((p) => p.status !== 'ditolak');
  const canCancel = !exp.cancelled && exp.stage !== 'ditolak' && !activePr && !exp.paidDirect
    && (exp.stage === 'dibukukan' ? canCreate(role, 'invoice') : mine || canVerify(role, 'expense'));

  const update = (fn) => pb.update('invoices', exp.id, fn);
  const verify = (patch) => {
    update((d) => withLog({ ...d, ...patch, stage: 'persetujuan', approvals: undefined }, logEntry(role, 'verifikasi')));
    setModal(null);
    toast(`${exp.number} diverifikasi dan diajukan ke ${roleLabel(expenseApprovalKind({ ...exp, ...patch }) === 'expenseBig' ? 'cfo' : 'bm')}.`);
  };
  const approve = () => {
    const { doc, complete } = signApproval(exp, kind, role);
    update(() => (complete ? { ...doc, stage: 'dibukukan', bookedAt: TODAY, bookedBy: personLabel(role) } : doc));
    toast(complete
      ? exp.paidDirect ? `${exp.number} disetujui dan dibukukan sebagai lunas.` : `${exp.number} disetujui dan dibukukan. Sekarang masuk Hutang Usaha.`
      : `${exp.number} disetujui. Menunggu ${roleLabel(expenseApproval(doc).next)}.`);
  };
  const sendBack = (note) => {
    update((d) => withLog({ ...d, stage: 'dikembalikan', returnNote: note }, logEntry(role, 'kembalikan', { note, step: 'accounting' })));
    setModal(null);
    toast(`${exp.number} dikembalikan ke pengaju.`);
  };
  const reject = (note) => {
    update((d) => withLog({ ...d, stage: 'ditolak', rejectNote: note }, logEntry(role, 'tolak', { note, step: ap.next })));
    setModal(null);
    toast(`${exp.number} ditolak.`);
  };
  const cancel = (note) => {
    update((d) => withLog({ ...d, cancelled: true, cancelledAt: TODAY, cancelNote: note, cancelledBy: personLabel(role) }, logEntry(role, 'batal', { note })));
    setModal(null);
    toast(booked ? `${exp.number} dibatalkan. Jurnalnya dibalik hari ini.` : `${exp.number} dibatalkan.`);
  };

  // Langkah keputusan: verifikasi Accounting, lalu rantai persetujuan sesuai nilai.
  const verified = exp.log?.some((e) => e.action === 'verifikasi') && !['verifikasi', 'dikembalikan'].includes(exp.stage);
  const steps = [
    {
      key: 'verify',
      verb: 'Verifikasi',
      role: 'accounting',
      done: verified ? {} : null,
      state: verified ? 'done' : exp.cancelled ? 'idle' : exp.stage === 'dikembalikan' ? 'rejected' : 'current',
      rejectedLabel: 'Dikembalikan',
    },
    ...chainSteps(exp, kind, { rejected: exp.stage === 'ditolak', active: !exp.cancelled && ['persetujuan', 'ditolak'].includes(exp.stage) }),
  ];

  const overdue = booked && invOverdue(exp, t);
  const cells = [
    ['Penerima', vendor?.name ?? '—'],
    ['No. tagihan', exp.vendorNo || '—'],
    ['Tanggal tagihan', formatDate(exp.date)],
    exp.paidDirect
      ? ['Dibayar', `${formatDate(exp.paidDirect.date)} · ${exp.paidDirect.source}`]
      : ['Jatuh tempo', <Text key="d" span fz="sm" fw={700} c={overdue ? 'red.7' : 'slate.9'}>{formatDate(exp.dueDate)}{overdue && ' · lewat jatuh tempo'}</Text>],
    ['Departemen', exp.dept || '—'],
    ['Diajukan oleh', exp.createdBy || '—'],
    ['No. faktur pajak', exp.taxNo || '—'],
    ['Catatan', exp.note || '—'],
  ];

  const primary = canVerifyNow ? (
    <Button radius="md" leftSection={<ShieldCheck size={16} />} onClick={() => setModal('verify')}>Verifikasi</Button>
  ) : canApproveNow ? (
    <Button radius="md" leftSection={<Check size={16} />} onClick={approve}>Setujui{ap.total > 1 ? ` (${ap.done.length + 1}/${ap.total})` : ''}</Button>
  ) : canResubmit ? (
    <Button radius="md" leftSection={<PencilSimple size={16} />} onClick={() => go({ name: 'expense-edit', id: exp.id })}>Ubah & ajukan ulang</Button>
  ) : canPay ? (
    <Button radius="md" leftSection={<Money size={16} />} onClick={() => go({ name: 'pr-new', invoiceIds: [exp.id] })}>Ajukan Pembayaran</Button>
  ) : null;
  const waiting = !primary && !exp.cancelled && (
    exp.stage === 'verifikasi' ? 'accounting'
      : exp.stage === 'persetujuan' ? ap.next
        : exp.stage === 'dikembalikan' ? null
          : booked && t.free > 0 ? 'accounting' : null
  );
  const menu = [
    canVerifyNow && { label: 'Kembalikan ke pengaju', icon: ArrowCounterClockwise, onClick: () => setModal('back') },
    canApproveNow && { label: 'Tolak', icon: X, color: 'red', onClick: () => setModal('reject') },
    canCancel && { label: 'Batalkan biaya', icon: X, color: 'red', onClick: () => setModal('cancel') },
  ].filter(Boolean);

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" className="pb-form">
      <BackLink label="Kembali ke daftar biaya" onClick={onBack} />

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" align="center" gap="md">
          <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
            <ThemeIcon size={52} radius="md" color="primary.9"><Receipt size={26} /></ThemeIcon>
            <Box style={{ minWidth: 0 }}>
              <Group gap="xs" wrap="wrap">
                <Title order={2} fz={{ base: 20, md: 24 }} c="slate.9">{exp.number}</Title>
                <CopyIcon value={exp.number} size={16} />
                <StatusPill map={EXPENSE_STATUS} status={status} />
                {exp.paidDirect && <Badge size="sm" radius="sm" variant="light" color="slate" tt="none">Sudah dibayar perusahaan</Badge>}
              </Group>
              <Text fz="sm" c="slate.6">{vendor?.name} · {rupiah(gross)}</Text>
            </Box>
          </Group>
          <Group gap="xs">
            {waiting && <Group gap={6}><Text fz="xs" c="slate.7">Menunggu</Text><RoleChip role={waiting} /></Group>}
            {primary}
            {menu.length > 0 && (
              <Menu position="bottom-end" width={220} shadow="md" withinPortal>
                <Menu.Target>
                  <ActionIcon variant="default" size={36} radius="md" aria-label="Aksi lainnya"><DotsThreeVertical size={18} /></ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                  {menu.map((m) => (
                    <Menu.Item key={m.label} color={m.color} leftSection={<m.icon size={16} />} onClick={m.onClick}>{m.label}</Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>
        </Group>
      </Card>

      {exp.cancelled && (
        <Callout tone="stop" title="Biaya dibatalkan">
          {exp.cancelNote}{exp.cancelledBy && <> — {exp.cancelledBy}</>}{exp.cancelledAt && <>, {formatDate(exp.cancelledAt)}</>}
        </Callout>
      )}
      {!exp.cancelled && exp.stage === 'dikembalikan' && (
        <Callout tone="warn" title="Dikembalikan oleh Accounting">
          {exp.returnNote} Perbaiki lalu ajukan ulang.
        </Callout>
      )}
      {!exp.cancelled && exp.stage === 'ditolak' && (
        <Callout tone="stop" title="Biaya ditolak">{exp.rejectNote} Biaya ini tidak dibukukan dan tidak dibayar.</Callout>
      )}
      {canApproveNow && (
        <Callout tone="info" title={`Persetujuan ${ap.done.length + 1} dari ${ap.total}`}>
          {gross > EXPENSE_LIMIT
            ? `Nilainya di atas ${rupiah(EXPENSE_LIMIT)}, jadi butuh Chief Finance lalu Building Manager.`
            : `Nilainya sampai ${rupiah(EXPENSE_LIMIT)}, cukup Building Manager.`}
          {' '}Setelah genap, biaya dibukukan ke {exp.paidDirect ? exp.paidDirect.source : 'Hutang Usaha'}.
        </Callout>
      )}

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8.5 }}>
          <Stack gap="lg">
            <Card withBorder radius="lg" padding={0} bg="white">
              <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                <CardHead icon={Info} desc="Penerima, tanggal, dan pengajunya">Informasi biaya</CardHead>
              </Box>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={1} verticalSpacing={1} bg="gray.2">
                {cells.map(([k, v]) => (
                  <Box key={k} px="lg" py="md" bg="white" style={{ minWidth: 0 }}>
                    <Text fz={11} fw={600} c="slate.6">{k}</Text>
                    <Text fz="sm" fw={700} c="slate.9" lh={1.35} component="div" style={{ overflowWrap: 'anywhere' }}>{v}</Text>
                  </Box>
                ))}
              </SimpleGrid>
            </Card>

            <Section divided flush icon={Receipt} title="Rincian biaya" description={exp.stage === 'verifikasi' || exp.stage === 'dikembalikan' ? 'Akun bawaan dari kategori; Accounting menetapkan akun dan pajaknya saat verifikasi' : 'Akun beban dan pajak hasil verifikasi Accounting'}>
              <Box style={{ overflow: 'auto' }}>
                <Table verticalSpacing="xs" horizontalSpacing="sm" miw={620} styles={th}>
                  <Table.Thead bg="slate.0">
                    <Table.Tr>
                      <Table.Th>Keterangan</Table.Th>
                      <Table.Th>Akun beban</Table.Th>
                      <Table.Th ta="right">DPP</Table.Th>
                      <Table.Th ta="right">PPN</Table.Th>
                      <Table.Th ta="right">Jumlah</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {exp.lines.map((l) => (
                      <Table.Tr key={l.id}>
                        <Table.Td>
                          <Text fz="sm" fw={600} c="slate.9">{l.desc}</Text>
                          <Text fz={11} c="slate.6">{categoryOf(l.category)?.label ?? 'Lainnya'}</Text>
                        </Table.Td>
                        <Table.Td fz="xs" c="slate.8">{EXPENSE_ACCOUNTS.find((a) => a.value === l.account)?.label ?? l.account}</Table.Td>
                        <Table.Td ta="right" fz="sm" style={num}>{rupiah(l.price)}</Table.Td>
                        <Table.Td ta="right" fz="sm" style={num} c={l.ppnRate ? 'slate.9' : 'slate.5'}>{l.ppnRate ? rupiah(Math.round(l.price * l.ppnRate)) : '–'}</Table.Td>
                        <Table.Td ta="right" fz="sm" fw={700} style={num}>{rupiah(lineGross(l))}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Box>
            </Section>

            {booked && !exp.paidDirect && (
              <Section divided flush icon={Money} title="Pembayaran" description="Payment Request yang melunasi biaya ini">
                {prs.length === 0 ? (
                  <Text fz="xs" c="slate.6" p="lg">Belum ada Payment Request. {canPay ? 'Ajukan dari tombol di atas.' : 'Accounting yang mengajukannya.'}</Text>
                ) : (
                  <DataTable bare head={[{ label: 'Nomor' }, { label: 'Status' }, { label: 'Nominal', align: 'right' }, { label: '', w: 160 }]} minWidth={520}>
                    {prs.map((p) => (
                      <Table.Tr key={p.id}>
                        <Table.Td><DocNumber onClick={() => go({ name: 'pr', id: p.id })}>{p.number}</DocNumber></Table.Td>
                        <Table.Td><StatusPill map={PR_STATUS} status={p.status} size="xs" approval={{ doc: p, kind: 'pr' }} /></Table.Td>
                        <Table.Td ta="right" fz="sm" fw={700}>{rupiah(p.alloc?.[exp.id] ?? p.amount)}</Table.Td>
                        <Table.Td ta="right"><PrActions pr={p} pb={pb} openDialog={openDialog} /></Table.Td>
                      </Table.Tr>
                    ))}
                  </DataTable>
                )}
              </Section>
            )}

            <Section divided flush icon={Receipt} title="Bukti" description="Tagihan, faktur pajak, atau bukti bayar">
              <Box p="lg">
                {exp.files?.length ? <AttachmentList names={exp.files} label="Bukti biaya" /> : <Text fz="xs" c="slate.6">Tidak ada lampiran.</Text>}
              </Box>
            </Section>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 3.5 }}>
          <Stack gap="lg">
            <Card withBorder radius="lg" padding={0} bg="white">
              <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                <CardHead icon={Calculator} desc="Nilai tagihan dan sisa yang harus dibayar">Ringkasan</CardHead>
              </Box>
              <Stack gap={6} p="lg">
                {row('Nilai tagihan', rupiah(gross))}
                {booked ? (
                  <>
                    {row('DPP (beban)', rupiah(t.dpp))}
                    {t.ppn > 0 && row('PPN masukan', rupiah(t.ppn))}
                    {t.pph > 0 && row(`PPh ${exp.pphPct}% dipotong`, `-${rupiah(t.pph)}`, { c: 'red.7' })}
                    {row('Dibayar ke penerima', rupiah(t.total), { fw: 700 })}
                    {row('Sudah dibayar', rupiah(t.paid), { c: 'green.8' })}
                  </>
                ) : (
                  <Text fz="xs" c="slate.6">Pajak dan sisa hutang dihitung setelah diverifikasi dan disetujui.</Text>
                )}
              </Stack>
              {booked && (
                <Group justify="space-between" px="lg" py="md" bg={t.balance ? 'primary.0' : 'green.0'} style={{ borderTop: '1px solid var(--mantine-color-gray-2)', borderRadius: '0 0 var(--mantine-radius-lg) var(--mantine-radius-lg)' }}>
                  <Text fz="sm" fw={600} c={t.balance ? 'primary.9' : 'green.9'}>Sisa dibayar</Text>
                  <Text fz="lg" fw={700} c={t.balance ? 'primary.9' : 'green.9'} style={num}>{t.balance ? rupiah(t.balance) : 'Lunas'}</Text>
                </Group>
              )}
            </Card>
            <ApprovalLog steps={steps} log={exp.log ?? []} title="Log keputusan" />
            <JournalCard
              lines={booked ? invoiceJournal(exp, pb, { stockMoves, products }) : []}
              description={`Atas ${exp.number}`}
              onDetail={booked ? () => go({ name: 'journal', kind: 'invoice', id: exp.id }) : undefined}
              empty={exp.stage !== 'dibukukan' ? 'Jurnal dibuat saat biaya disetujui penuh.' : `Biaya dibatalkan — jurnalnya dibalik pada ${formatDate(exp.cancelledAt)}.`}
            />
          </Stack>
        </Grid.Col>
      </Grid>

      {modal === 'verify' && <VerifyModal opened onClose={() => setModal(null)} exp={exp} onConfirm={verify} />}
      <ReasonModal opened={modal === 'back'} onClose={() => setModal(null)} title={`Kembalikan ${exp.number}`} label="Apa yang perlu diperbaiki pengaju?" confirmLabel="Kembalikan" onConfirm={sendBack} />
      <ReasonModal opened={modal === 'reject'} onClose={() => setModal(null)} title={`Tolak ${exp.number}`} label="Alasan penolakan" confirmLabel="Tolak biaya" onConfirm={reject} />
      <ReasonModal opened={modal === 'cancel'} onClose={() => setModal(null)} title={`Batalkan ${exp.number}`} label={booked ? 'Alasan pembatalan. Jurnalnya dibalik hari ini dan hutangnya hilang.' : 'Alasan pembatalan'} confirmLabel="Batalkan biaya" onConfirm={cancel} />
    </Stack>
  );
}
