// Daftar Retur Penjualan. Alurnya: draf → terbit → (kredit terpakai) selesai.
// Retur selalu lahir dari faktur, jadi tombol "Buat Retur" memilih fakturnya dulu.
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Center,
  Group,
  Menu,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMemo, useState } from 'react';
import {
  ArrowCounterClockwise,
  ArrowsClockwise,
  Check,
  CheckCircle,
  Coins,
  DotsThreeVertical,
  Eye,
  Invoice as InvoiceIcon,
  MagnifyingGlass,
  Notebook,
  PencilSimple,
  Plus,
  Prohibit,
  Receipt,
  Trash,
} from '@/components/Icon.jsx';
import { useData } from '@/lib/store.jsx';
import { ListShell, TabBar } from '@/pages/Pembelian/components.jsx';
import { toCustomer } from '@/pages/Kontak/utils.js';
import { CopyIcon, PageIntro, StatusBadge } from './components.jsx';
import { TODAY } from './data.js';
import { JournalModal, ReasonModal } from './Dialogs.jsx';
import { FormModal } from '@/components/common.jsx';
import { returnJournals } from './journal.js';
import ReturnDetail from './ReturnDetail.jsx';
import { formatHash } from './routes.js';
import {
  applyReturnToSale,
  canDeleteReturn,
  creditPart,
  deductPart,
  canEditReturn,
  canIssueReturn,
  canReturnInvoice,
  canVoidReturn,
  customerCredit,
  reasonLabel,
  RETURN_STATUS,
  returnStatus,
  revertReturnFromSale,
  settlementLabel,
  splitSettlement,
} from './returns.js';
import {
  computeTotals,
  formatDate,
  logActivity,
  nowIso,
  rupiah,
  rupiahShort,
  useCustomer,
} from './utils.js';

// B12: nama tab mengikuti status returnya, supaya retur berstatus SELESAI tidak
// tersembunyi di tab yang menamai dirinya lain.
const tabs = [
  { value: 'draft', label: 'Draf', match: (r) => returnStatus(r) === 'draft' },
  { value: 'issued', label: 'Terbit', match: (r) => returnStatus(r) === 'issued' },
  { value: 'completed', label: 'Selesai', match: (r) => returnStatus(r) === 'completed' },
  { value: 'void', label: 'Dibatalkan', match: (r) => returnStatus(r) === 'void' },
];
// Tab pembuka: yang pertama ada isinya, supaya daftar tidak terbuka dalam keadaan kosong.
const firstFilledTab = (list) =>
  ['issued', 'completed', 'draft', 'void'].find((v) =>
    list.some(tabs.find((t) => t.value === v).match),
  ) ?? 'issued';

const VOID_REASONS = [
  'Salah input retur',
  'Retur dibatalkan pelanggan',
  'Nilai retur keliru',
  'Lainnya',
];

const goForm = (v) => {
  window.location.hash = formatHash(v);
  window.scrollTo({ top: 0 });
};

// Kalimat penyelesaian satu retur, dipakai di notifikasi penerbitan.
const settlementSummary = (ret, invoiceNumber) => {
  const dipotong = deductPart(ret);
  const kredit = creditPart(ret);
  if (dipotong > 0 && kredit > 0)
    return `${ret.number}: ${rupiah(dipotong)} memotong ${invoiceNumber}, ${rupiah(kredit)} jadi kredit pelanggan.`;
  if (dipotong > 0)
    return `${ret.number} memotong tagihan ${invoiceNumber} sebesar ${rupiah(dipotong)}.`;
  return `${ret.number} menjadi kredit pelanggan sebesar ${rupiah(kredit)}.`;
};

const toast = (title, message, color = 'green') =>
  notifications.show({
    color,
    icon: color === 'red' ? <Prohibit size={18} /> : <CheckCircle size={18} />,
    title,
    message,
    autoClose: 5000,
    withBorder: true,
    radius: 'md',
  });

function StatCard({ label, value, hint, icon: Icon, color }) {
  return (
    <Card withBorder radius="md" padding="md" bg="white">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Box>
          <Text fz={11} fw={600} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }}>
            {label}
          </Text>
          <Text fz={22} fw={700} c="slate.9" lh={1.3}>
            {value}
          </Text>
          <Text fz={11} c="slate.6">
            {hint}
          </Text>
        </Box>
        <ThemeIcon variant="light" color={color} size={36} radius="md">
          <Icon size={18} />
        </ThemeIcon>
      </Group>
    </Card>
  );
}

// Memilih faktur yang akan diretur: hanya faktur terbit yang masih punya baris tersisa.
function PickInvoiceModal({ sales, contactsById, onClose, onPick }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = sales
    .filter(canReturnInvoice)
    .filter((s) => {
      if (!q) return true;
      const c = toCustomer(contactsById[s.customerId]);
      return [s.number, c?.name].some((v) => v?.toLowerCase().includes(q));
    })
    .slice(0, 50);

  return (
    <FormModal
      opened
      onClose={onClose}
      size={640}
      icon={InvoiceIcon}
      title="Pilih Faktur yang Diretur"
      subtitle="Retur selalu mengoreksi satu faktur yang sudah terbit — harga dan pajaknya ikut faktur itu."
      footer={
        <Button variant="default" radius="md" onClick={onClose}>
          Batal
        </Button>
      }
    >
      <Stack gap="sm">
        <TextInput
          placeholder="Cari nomor faktur atau pelanggan..."
          size="sm"
          radius="md"
          leftSection={<MagnifyingGlass size={14} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        <Box
          style={{
            border: '1px solid var(--mantine-color-gray-3)',
            borderRadius: 'var(--mantine-radius-md)',
            overflow: 'hidden',
          }}
        >
          <ScrollArea.Autosize mah={320} type="auto">
            <Table verticalSpacing="xs" horizontalSpacing="md" highlightOnHover fz="xs">
              <Table.Tbody>
                {list.map((s) => {
                  const t = computeTotals(s);
                  const c = toCustomer(contactsById[s.customerId]);
                  return (
                    <Table.Tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => onPick(s)}>
                      <Table.Td>
                        <Text fz="sm" fw={700} c="primary.9">
                          {s.number}
                        </Text>
                        <Text fz={11} c="slate.6">
                          {c?.name} · {formatDate(s.date)}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                        <Text fz="sm" fw={700} c="slate.9">
                          {rupiah(t.total)}
                        </Text>
                        <Text fz={11} c="slate.6">
                          sisa {rupiah(t.balance)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
          {list.length === 0 && (
            <Center py="lg">
              <Text fz="xs" c="slate.6">
                Belum ada faktur terbit yang bisa diretur.
              </Text>
            </Center>
          )}
        </Box>
      </Stack>
    </FormModal>
  );
}

function ReturnRow({ ret, onOpen, onOpenInvoice, actions }) {
  const customer = useCustomer(ret.customerId);

  return (
    <Table.Tr>
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <UnstyledButton onClick={onOpen}>
            <Text fz="sm" fw={700} c="primary.9" style={{ whiteSpace: 'nowrap' }}>
              {ret.number}
            </Text>
          </UnstyledButton>
          <CopyIcon value={ret.number} />
        </Group>
        <Text fz={11} c="slate.6">
          {reasonLabel(ret.reason)}
        </Text>
      </Table.Td>
      <Table.Td>
        <UnstyledButton onClick={onOpenInvoice}>
          <Text fz="sm" fw={600} c="slate.9" style={{ whiteSpace: 'nowrap' }}>
            {ret.invoiceNumber}
          </Text>
        </UnstyledButton>
      </Table.Td>
      <Table.Td>
        <Text fz="sm" fw={600} c="slate.9">
          {customer?.name}
        </Text>
      </Table.Td>
      <Table.Td fz="sm" c="slate.8" style={{ whiteSpace: 'nowrap' }}>
        {formatDate(ret.date)}
      </Table.Td>
      <Table.Td fz="xs" c="slate.7" style={{ whiteSpace: 'nowrap' }}>
        {settlementLabel(ret.settlement)}
        {deductPart(ret) > 0 && creditPart(ret) > 0 && (
          <Text fz={11} c="slate.6">
            {rupiah(deductPart(ret))} + kredit {rupiah(creditPart(ret))}
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="right">
        <Text fz="sm" fw={700} c="slate.9" style={{ whiteSpace: 'nowrap' }}>
          {rupiah(ret.total)}
        </Text>
      </Table.Td>
      <Table.Td ta="center">
        <StatusBadge status={returnStatus(ret)} map={RETURN_STATUS} size="xs" />
      </Table.Td>
      <Table.Td ta="center">
        <Menu position="bottom-end" withinPortal shadow="md" width={220}>
          <Menu.Target>
            <ActionIcon variant="subtle" color="slate" aria-label={`Aksi ${ret.number}`}>
              <DotsThreeVertical size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item fz="xs" leftSection={<Eye size={14} />} onClick={onOpen}>
              Lihat Rincian
            </Menu.Item>
            <Menu.Item fz="xs" leftSection={<InvoiceIcon size={14} />} onClick={onOpenInvoice}>
              Buka Faktur Sumber
            </Menu.Item>
            <Menu.Item
              fz="xs"
              leftSection={<Notebook size={14} />}
              onClick={() => actions.journal(ret)}
            >
              Lihat Jurnal
            </Menu.Item>
            {canEditReturn(ret) && (
              <Menu.Item
                fz="xs"
                leftSection={<PencilSimple size={14} />}
                onClick={() => actions.edit(ret)}
              >
                Ubah Retur
              </Menu.Item>
            )}
            {canIssueReturn(ret) && (
              <Menu.Item
                fz="xs"
                leftSection={<Check size={14} />}
                onClick={() => actions.issue(ret)}
              >
                Terbitkan Retur
              </Menu.Item>
            )}
            {(canVoidReturn(ret) || canDeleteReturn(ret)) && <Menu.Divider />}
            {canVoidReturn(ret) && (
              <Menu.Item
                fz="xs"
                color="red"
                leftSection={<Prohibit size={14} />}
                onClick={() => actions.void(ret)}
              >
                Batalkan Retur
              </Menu.Item>
            )}
            {canDeleteReturn(ret) && (
              <Menu.Item
                fz="xs"
                color="red"
                leftSection={<Trash size={14} />}
                onClick={() => actions.remove(ret)}
              >
                Hapus Retur
              </Menu.Item>
            )}
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  );
}

export default function Returns({ params }) {
  const { salesReturns, setSalesReturns, sales, setSales, contactsById } = useData();
  const detailId = params?.returnId ?? null;
  const [dialog, setDialog] = useState(null);
  const [tab, setTab] = useState(() => firstFilledTab(salesReturns));
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  const closeDialog = () => setDialog(null);
  const openDetail = (id) => goForm({ name: 'return', id });
  const closeDetail = () => goForm({ name: 'tab', tab: 'returns' });
  const openInvoice = (id) => goForm({ name: 'invoice', id });

  // Penerbitan retur: nilainya baru menempel ke faktur di sini, bukan saat draf disimpan.
  const issue = (ret) => {
    // Sisa tagihan bisa berubah sejak drafnya disimpan, jadi pembagian nilainya
    // dihitung ulang terhadap keadaan faktur saat retur benar-benar terbit.
    const sale = sales.find((s) => s.id === ret.invoiceId);
    const bagi = splitSettlement(ret.total, ret.settlement, sale ? computeTotals(sale).balance : 0);
    const terbit = { ...ret, ...bagi, draft: false, updatedAt: nowIso() };
    setSalesReturns((list) =>
      list.map((r) => (r.id === ret.id ? logActivity(terbit, 'issued') : r)),
    );
    setSales((list) =>
      list.map((s) =>
        s.id !== ret.invoiceId ? s : { ...applyReturnToSale(s, terbit), updatedAt: nowIso() },
      ),
    );
    toast('Retur diterbitkan', settlementSummary(terbit, ret.invoiceNumber));
  };

  // Pembatalan mengembalikan qty dan nilai retur ke fakturnya, lalu membentuk jurnal balik.
  const voidReturn = (ret, reason) => {
    setSalesReturns((list) =>
      list.map((r) =>
        r.id === ret.id
          ? logActivity(
              { ...r, cancelledAt: nowIso(), cancelReason: reason, updatedAt: nowIso() },
              'cancelled',
              reason,
            )
          : r,
      ),
    );
    setSales((list) =>
      list.map((s) =>
        s.id !== ret.invoiceId ? s : { ...revertReturnFromSale(s, ret), updatedAt: nowIso() },
      ),
    );
    closeDialog();
    toast('Retur dibatalkan', `${ret.number} — ${reason}.`, 'red');
  };

  const remove = (ret) => {
    setSalesReturns((list) => list.filter((r) => r.id !== ret.id));
    closeDialog();
    if (detailId === ret.id) closeDetail();
    toast('Retur dihapus', `Draf ${ret.number} dihapus permanen.`, 'red');
  };

  const actions = {
    edit: (ret) => goForm({ name: 'return-edit', id: ret.id }),
    issue,
    journal: (ret) => setDialog({ type: 'journal', id: ret.id }),
    void: (ret) => setDialog({ type: 'void', id: ret.id }),
    remove: (ret) => setDialog({ type: 'delete', id: ret.id }),
  };

  const stats = useMemo(() => {
    const aktif = salesReturns.filter((r) => ['issued', 'completed'].includes(returnStatus(r)));
    // Bulan berjalan menurut tanggal aplikasi, sama seperti halaman lain.
    const bulan = TODAY.slice(0, 7);
    const bulanIni = aktif.filter((r) => r.date.startsWith(bulan));
    const kredit = [...new Set(salesReturns.map((r) => r.customerId))].reduce(
      (n, id) => n + customerCredit(salesReturns, id),
      0,
    );
    const draf = salesReturns.filter((r) => returnStatus(r) === 'draft');
    return [
      {
        label: 'Retur bulan ini',
        value: rupiahShort(bulanIni.reduce((n, r) => n + r.total, 0)),
        hint: `${bulanIni.length} retur diterbitkan bulan ini`,
        icon: ArrowCounterClockwise,
        color: 'orange',
      },
      {
        label: 'Kredit pelanggan',
        value: rupiahShort(kredit),
        hint: 'Saldo kredit yang belum terpakai',
        icon: Coins,
        color: 'blue',
      },
      {
        label: 'Menunggu diterbitkan',
        value: String(draf.length),
        hint: `${rupiahShort(draf.reduce((n, r) => n + r.total, 0))} masih berupa draf`,
        icon: Receipt,
        color: 'slate',
      },
    ];
  }, [salesReturns]);

  const tabCounts = useMemo(
    () => Object.fromEntries(tabs.map((t) => [t.value, salesReturns.filter(t.match).length])),
    [salesReturns],
  );

  const filtered = useMemo(() => {
    const match = tabs.find((t) => t.value === tab).match;
    const q = query.trim().toLowerCase();
    return salesReturns.filter((ret) => {
      if (!match(ret)) return false;
      if (!q) return true;
      const c = toCustomer(contactsById[ret.customerId]);
      return [ret.number, ret.invoiceNumber, c?.name].some((v) => v?.toLowerCase().includes(q));
    });
  }, [salesReturns, contactsById, tab, query]);

  const detail = salesReturns.find((r) => r.id === detailId);
  const dialogReturn = dialog && salesReturns.find((r) => r.id === dialog.id);
  const saleOf = (ret) => sales.find((s) => s.id === ret.invoiceId);

  const modals = (
    <>
      {dialog?.type === 'pick' && (
        <PickInvoiceModal
          sales={sales}
          contactsById={contactsById}
          onClose={closeDialog}
          onPick={(s) => {
            closeDialog();
            goForm({ name: 'return-new', from: `invoice:${s.id}` });
          }}
        />
      )}
      {dialogReturn && dialog.type === 'journal' && (
        <JournalModal
          sale={dialogReturn}
          word="Retur"
          journals={returnJournals(dialogReturn, saleOf(dialogReturn), salesReturns)}
          onClose={closeDialog}
        />
      )}
      {dialogReturn && dialog.type === 'void' && (
        <ReasonModal
          title="Batalkan Retur"
          subtitle={`${dialogReturn.number} ditarik kembali dan jurnal pembaliknya dibentuk.`}
          label="Alasan pembatalan"
          options={VOID_REASONS}
          confirmLabel="Batalkan retur"
          onClose={closeDialog}
          onConfirm={(reason) => voidReturn(dialogReturn, reason)}
        />
      )}
      {dialogReturn && dialog.type === 'delete' && (
        <FormModal
          opened
          onClose={closeDialog}
          size={460}
          icon={Trash}
          title="Hapus Retur Draf"
          subtitle={`${dialogReturn.number} dihapus permanen dan tidak bisa dikembalikan.`}
          footer={
            <>
              <Button variant="default" radius="md" onClick={closeDialog}>
                Batal
              </Button>
              <Button
                color="red"
                radius="md"
                leftSection={<Trash size={16} />}
                onClick={() => remove(dialogReturn)}
              >
                Hapus retur
              </Button>
            </>
          }
        >
          <Text fz="xs" c="slate.6">
            Draf ini belum pernah diterbitkan, jadi penghapusannya tidak memengaruhi tagihan faktur{' '}
            {dialogReturn.invoiceNumber} maupun jurnal.
          </Text>
        </FormModal>
      )}
    </>
  );

  if (detail) {
    return (
      <>
        <ReturnDetail
          ret={detail}
          sale={saleOf(detail)}
          onBack={closeDetail}
          onOpenInvoice={() => openInvoice(detail.invoiceId)}
          actions={actions}
        />
        {modals}
      </>
    );
  }

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro
        icon={ArrowCounterClockwise}
        title="Retur Penjualan"
        description="Koreksi tagihan atas faktur yang sudah terbit. Penyelesaiannya memotong tagihan faktur itu, atau menjadi saldo kredit pelanggan."
        actions={
          <>
            <ActionIcon variant="default" size="lg" radius="md" aria-label="Segarkan data retur">
              <ArrowsClockwise size={16} />
            </ActionIcon>
            <Button
              radius="md"
              leftSection={<Plus size={16} />}
              onClick={() => setDialog({ type: 'pick' })}
            >
              Buat Retur
            </Button>
          </>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </SimpleGrid>

      <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
        <TabBar
          tabs={tabs.map((t) => ({ ...t, label: `${t.label} (${tabCounts[t.value]})` }))}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
          }}
        />
        <ListShell
          query={query}
          onQuery={(v) => {
            setQuery(v);
            setPage(1);
          }}
          placeholder="Cari nomor retur, faktur, atau pelanggan..."
          head={[
            { label: 'No. Retur' },
            { label: 'Faktur Sumber' },
            { label: 'Pelanggan' },
            { label: 'Tanggal' },
            { label: 'Penyelesaian' },
            { label: 'Nilai Retur', align: 'right' },
            { label: 'Status', align: 'center' },
            { label: 'Aksi', align: 'center', w: 60 },
          ]}
          rows={filtered.map((r) => (
            <ReturnRow
              key={r.id}
              ret={r}
              onOpen={() => openDetail(r.id)}
              onOpenInvoice={() => openInvoice(r.invoiceId)}
              actions={actions}
            />
          ))}
          noun="retur"
          minWidth={1040}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
        />
      </Card>

      {modals}
    </Stack>
  );
}
