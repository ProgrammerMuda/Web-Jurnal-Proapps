// Menu Biaya: daftar pengeluaran operasional tanpa PO. Susunannya sama dengan Hutang Usaha dan
// Piutang Usaha: kartu ringkas yang bisa diklik untuk menyaring, lalu satu tabel kerja.
import { useState } from 'react';
import { Button, Card, Select, Table, Text } from '@mantine/core';
import { CheckCircle, Clock, Eye, Money, Plus, Receipt, Wallet } from '@/components/Icon.jsx';
import StatCards from '@/components/StatCards.jsx';
import { DocNumber, EmptyState, ListShell, PageIntro, RowMenu, StatusPill } from './components.jsx';
import { TODAY } from './data.js';
import { categoryOf, CATEGORIES, EXPENSE_STATUS, expenseApproval, expenseGross, expensesOf, expenseStatus } from './expenses.js';
import { canCreate, roleLabel } from './permissions.js';
import { formatDate, invTotals, rupiah, rupiahShort, sum } from './utils.js';

const tabular = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

// Saringan dari kartu: status tertentu, atau kelompok status.
const FILTERS = {
  all: { label: 'Semua status', match: () => true },
  verifikasi: { label: 'Menunggu verifikasi', match: (s) => s === 'verifikasi' },
  persetujuan: { label: 'Menunggu persetujuan', match: (s) => s === 'persetujuan' },
  unpaid: { label: 'Belum lunas', match: (s) => ['belum', 'sebagian', 'tempo'].includes(s) },
  tempo: { label: 'Jatuh tempo', match: (s) => s === 'tempo' },
  lunas: { label: 'Lunas', match: (s) => s === 'lunas' },
  dikembalikan: { label: 'Dikembalikan', match: (s) => s === 'dikembalikan' },
  ditolak: { label: 'Ditolak', match: (s) => s === 'ditolak' },
  dibatalkan: { label: 'Dibatalkan', match: (s) => s === 'dibatalkan' },
};

export default function ExpenseList({ pb, go }) {
  const role = pb.role;
  const vname = (id) => pb.vendorsById[id]?.name ?? '—';
  const rows = expensesOf(pb.invoices).map((exp) => {
    const t = invTotals(exp, pb.calc);
    return { exp, t, status: expenseStatus(exp, t), gross: expenseGross(exp) };
  });

  const [filter, setFilter] = useState('all');
  const [category, setCategory] = useState(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  const month = TODAY.slice(0, 7);
  const by = (key) => rows.filter((r) => FILTERS[key].match(r.status));
  const verif = by('verifikasi');
  const approval = by('persetujuan');
  const unpaid = by('unpaid');
  const thisMonth = rows.filter((r) => r.exp.stage === 'dibukukan' && !r.exp.cancelled && r.exp.date.startsWith(month));

  const pick = (key) => {
    setFilter(filter === key ? 'all' : key);
    setPage(1);
  };
  const stats = [
    {
      label: 'Menunggu Verifikasi',
      value: String(verif.length),
      hint: verif.length ? `${rupiahShort(sum(verif, (r) => r.gross))} · Accounting` : 'Tidak ada antrean',
      icon: Clock,
      onClick: () => pick('verifikasi'),
      active: filter === 'verifikasi',
    },
    {
      label: 'Menunggu Persetujuan',
      value: String(approval.length),
      hint: approval.length ? `${rupiahShort(sum(approval, (r) => r.gross))} · BM / Chief Finance` : 'Tidak ada antrean',
      icon: CheckCircle,
      onClick: () => pick('persetujuan'),
      active: filter === 'persetujuan',
    },
    {
      label: 'Belum Dibayar',
      value: rupiahShort(sum(unpaid, (r) => r.t.balance)),
      hint: unpaid.length ? `${unpaid.length} biaya · masuk Hutang Usaha` : 'Semua sudah lunas',
      icon: Wallet,
      onClick: () => pick('unpaid'),
      active: filter === 'unpaid',
    },
    {
      label: 'Biaya Bulan Ini',
      value: rupiahShort(sum(thisMonth, (r) => r.t.dpp)),
      hint: `${thisMonth.length} biaya dibukukan · sebelum pajak`,
      icon: Receipt,
    },
  ];

  const q = query.trim().toLowerCase();
  const shown = rows
    .filter((r) => FILTERS[filter].match(r.status))
    .filter((r) => !category || r.exp.lines.some((l) => l.category === category))
    .filter((r) => !q || [r.exp.number, r.exp.vendorNo, vname(r.exp.vendorId), ...r.exp.lines.map((l) => l.desc)].some((v) => v?.toLowerCase().includes(q)));

  const head = [
    { label: 'Biaya & tanggal' },
    { label: 'Penerima' },
    { label: 'Kategori' },
    { label: 'Nilai tagihan', align: 'right' },
    { label: 'Sisa dibayar', align: 'right' },
    { label: 'Jatuh tempo' },
    { label: 'Status' },
    { label: '', w: 50 },
  ];
  const body = shown.map(({ exp, t, status, gross }) => {
    const cats = [...new Set(exp.lines.map((l) => categoryOf(l.category)?.label ?? 'Lainnya'))];
    const ap = exp.stage === 'persetujuan' ? expenseApproval(exp) : null;
    return (
      <Table.Tr key={exp.id}>
        <Table.Td>
          <DocNumber onClick={() => go({ name: 'expense', id: exp.id })}>{exp.number}</DocNumber>
          <Text fz={11} c="slate.6">{formatDate(exp.date)}</Text>
        </Table.Td>
        <Table.Td>
          <Text fz="sm" fw={600} c="slate.9">{vname(exp.vendorId)}</Text>
          <Text fz={11} c="slate.6">{exp.paidDirect ? 'Sudah dibayar' : 'Ditagih, dibayar nanti'}</Text>
        </Table.Td>
        <Table.Td>
          <Text fz="sm" c="slate.8">{cats[0]}{cats.length > 1 ? ` +${cats.length - 1}` : ''}</Text>
        </Table.Td>
        <Table.Td ta="right"><Text fz="sm" fw={500} c="slate.9" style={tabular}>{rupiah(gross)}</Text></Table.Td>
        <Table.Td ta="right">
          <Text fz="sm" fw={600} c={status === 'tempo' ? 'red.8' : t.balance ? 'slate.9' : 'slate.4'} style={tabular}>{t.balance ? rupiah(t.balance) : '–'}</Text>
        </Table.Td>
        <Table.Td fz="sm" c="slate.8" style={{ whiteSpace: 'nowrap' }}>{exp.paidDirect ? '–' : formatDate(exp.dueDate)}</Table.Td>
        <Table.Td>
          <StatusPill map={EXPENSE_STATUS} status={status} size="xs" />
          {ap?.next && <Text fz={11} c="slate.6" mt={2}>Menunggu {roleLabel(ap.next)} ({ap.done.length + 1}/{ap.total})</Text>}
        </Table.Td>
        <Table.Td ta="center">
          <RowMenu
            label={exp.number}
            items={[
              { label: 'Lihat biaya', icon: Eye, onClick: () => go({ name: 'expense', id: exp.id }) },
              canCreate(role, 'pr') && t.free > 0 && { label: 'Ajukan pembayaran', icon: Money, onClick: () => go({ name: 'pr-new', invoiceIds: [exp.id] }) },
            ]}
          />
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <>
      <PageIntro
        icon={Receipt}
        title="Biaya"
        description="Pengeluaran operasional tanpa PO: listrik, air, internet, jasa rutin, sewa, langganan. Diverifikasi Accounting, disetujui sesuai nilainya, lalu dibayar lewat Payment Request yang sama dengan tagihan vendor."
        actions={canCreate(role, 'expense') && (
          <Button radius="md" leftSection={<Plus size={16} />} onClick={() => go({ name: 'expense-new' })}>Ajukan biaya</Button>
        )}
      />
      <StatCards items={stats} />
      <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
        <ListShell
          query={query}
          onQuery={(v) => { setQuery(v); setPage(1); }}
          placeholder="Cari nomor biaya, no. tagihan, penerima, atau keterangan..."
          filters={
            <>
              <Select
                size="sm"
                radius="md"
                w={210}
                allowDeselect={false}
                aria-label="Saring status"
                data={Object.entries(FILTERS).map(([value, f]) => ({ value, label: f.label }))}
                value={filter}
                onChange={(v) => { setFilter(v); setPage(1); }}
              />
              <Select
                size="sm"
                radius="md"
                w={220}
                clearable
                searchable
                placeholder="Semua kategori"
                aria-label="Saring kategori"
                data={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                value={category}
                onChange={(v) => { setCategory(v); setPage(1); }}
              />
            </>
          }
          head={head}
          rows={body}
          noun="biaya"
          minWidth={1120}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          empty={rows.length === 0 ? (
            <EmptyState icon={Receipt} title="Belum ada biaya" text="Ajukan tagihan operasional seperti listrik, air, atau internet. Lampirkan tagihannya; Accounting yang menentukan akun dan pajaknya." />
          ) : undefined}
        />
      </Card>
    </>
  );
}
