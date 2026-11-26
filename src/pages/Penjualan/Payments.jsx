// Daftar Pembayaran Masuk: semua penerimaan dari seluruh faktur dalam satu tempat.
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Menu,
  Pagination,
  ScrollArea,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { StatCard } from '@/components/StatCards.jsx';
import { useMemo, useState } from 'react';
import {
  ArrowsClockwise,
  Check,
  DotsThreeVertical,
  Eye,
  HandCoins,
  Invoice,
  MagnifyingGlass,
  Notebook,
  Paperclip,
  Percent,
  Prohibit,
} from '@/components/Icon.jsx';
import { useData } from '@/lib/store.jsx';
import { downloadFile } from '@/lib/fileStore.js';
import { toCustomer } from '@/pages/Kontak/utils.js';
import { PageIntro } from './components.jsx';
import { JournalModal, ReasonModal } from './Dialogs.jsx';
import { notifications } from '@mantine/notifications';
import { TODAY } from './data.js';
import { withholdingType } from './journal.js';
import {
  accountLabelOf,
  accountOptions,
  allPayments,
  cashReceived,
  methodOptions,
  monthOf,
  PAYMENT_VOID_REASONS,
  releaseCredit,
  voidPayment,
  withheld,
} from './payments.js';
import { formatHash } from './routes.js';
import { formatDate, logActivity, nowIso, rupiah, rupiahShort, useCustomer } from './utils.js';

const pageSizes = ['10', '20', '50'].map((v) => ({ value: v, label: `${v} / hal` }));

const goTo = (v) => {
  window.location.hash = formatHash(v);
  window.scrollTo({ top: 0 });
};


function PaymentRow({ payment, onJournal, onVoid }) {
  const customer = useCustomer(payment.customerId);
  const pph = withholdingType(payment.withholdingType);
  const potongan = withheld(payment);
  const batal = !!payment.cancelledAt;

  return (
    <Table.Tr style={batal ? { background: 'var(--mantine-color-slate-0)' } : undefined}>
      <Table.Td fz="sm" c="slate.8" style={{ whiteSpace: 'nowrap' }}>
        {formatDate(payment.date)}
        {batal && (
          <Badge size="xs" radius="sm" variant="light" color="red" mt={2} display="block" w="fit-content">
            DIBATALKAN
          </Badge>
        )}
      </Table.Td>
      <Table.Td>
        <UnstyledButton onClick={() => goTo({ name: 'invoice', id: payment.saleId })}>
          <Text fz="sm" fw={700} c="primary.9" style={{ whiteSpace: 'nowrap' }}>
            {payment.saleNumber}
          </Text>
        </UnstyledButton>
        <Text fz={11} c="slate.6">
          {customer?.name}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text fz="sm" c="slate.8">
          {payment.method}
        </Text>
        <Text fz={11} c="slate.6">
          {payment.fromCredit ? 'Saldo kredit pelanggan · tanpa uang masuk' : accountLabelOf(payment.account)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Group gap={4}>
          {(payment.tags ?? []).map((t) => (
            <Badge key={t} size="xs" radius="sm" variant="light" color="slate" tt="none">
              {t}
            </Badge>
          ))}
          {(payment.proofs ?? []).length > 0 && (
            <Tooltip withArrow fz="xs" label={payment.proofs.join(', ')}>
              <Badge
                size="xs"
                radius="sm"
                variant="light"
                color="primary"
                tt="none"
                leftSection={<Paperclip size={11} />}
              >
                {payment.proofs.length}
              </Badge>
            </Tooltip>
          )}
        </Group>
      </Table.Td>
      <Table.Td ta="right">
        <Text
          fz="sm"
          fw={700}
          c={batal ? 'slate.5' : 'slate.9'}
          style={{ whiteSpace: 'nowrap', textDecoration: batal ? 'line-through' : 'none' }}
        >
          {rupiah(payment.amount)}
        </Text>
        {potongan > 0 && (
          <Text fz={11} c="slate.6" style={{ whiteSpace: 'nowrap' }}>
            {pph?.label?.split(' (')[0]} -{rupiah(potongan)}
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="right">
        <Text
          fz="sm"
          fw={700}
          c={payment.fromCredit ? 'slate.5' : 'green.8'}
          style={{ whiteSpace: 'nowrap' }}
        >
          {rupiah(cashReceived(payment))}
        </Text>
        {payment.fromCredit && (
          <Text fz={11} c="slate.6" style={{ whiteSpace: 'nowrap' }}>
            dari kredit retur
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="center">
        <Menu position="bottom-end" withinPortal shadow="md" width={200}>
          <Menu.Target>
            <ActionIcon variant="subtle" color="slate" aria-label={`Aksi ${payment.saleNumber}`}>
              <DotsThreeVertical size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              fz="xs"
              leftSection={<Eye size={14} />}
              onClick={() => goTo({ name: 'invoice', id: payment.saleId })}
            >
              Lihat Faktur
            </Menu.Item>
            <Menu.Item fz="xs" leftSection={<Notebook size={14} />} onClick={onJournal}>
              Lihat Jurnal
            </Menu.Item>
            {!batal && (
              <>
                <Menu.Divider />
                <Menu.Item
                  fz="xs"
                  color="red"
                  leftSection={<Prohibit size={14} />}
                  onClick={onVoid}
                >
                  Batalkan Pembayaran
                </Menu.Item>
              </>
            )}
            {(payment.proofs ?? []).map((name) => (
              <Menu.Item
                key={name}
                fz="xs"
                leftSection={<Paperclip size={14} />}
                onClick={() => downloadFile(name)}
              >
                {name}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  );
}

export default function Payments() {
  const { sales, setSales, setSalesReturns, contactsById } = useData();
  const [query, setQuery] = useState('');
  const [account, setAccount] = useState('all');
  const [method, setMethod] = useState('all');
  const [month, setMonth] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');
  const [journalId, setJournalId] = useState(null);
  // B3: pembayaran yang sedang dikonfirmasi pembatalannya — { saleId, index }.
  const [voiding, setVoiding] = useState(null);

  const payments = useMemo(() => allPayments(sales), [sales]);

  const stats = useMemo(() => {
    // B3: pembayaran yang dibatalkan tetap tampil di daftar, tapi tidak ikut dihitung —
    // termasuk jumlah barisnya, bukan hanya nilainya.
    const berlaku = payments.filter((p) => !p.cancelledAt);
    const bulanIni = berlaku.filter((p) => monthOf(p.date) === monthOf(TODAY));
    const sum = (list, f) => list.reduce((n, p) => n + f(p), 0);
    return [
      {
        label: 'Diterima bulan ini',
        value: rupiahShort(sum(bulanIni, cashReceived)),
        hint: `${bulanIni.length} penerimaan di ${formatDate(TODAY).slice(-8)}`,
        icon: HandCoins,
        color: 'green',
      },
      {
        label: 'Total penerimaan',
        value: rupiahShort(sum(berlaku, cashReceived)),
        hint: `${berlaku.length} pembayaran tercatat${
          payments.length > berlaku.length ? ` · ${payments.length - berlaku.length} dibatalkan` : ''
        }`,
        icon: Check,
        color: 'primary',
      },
      {
        // Berguna saat merekap bukti potong dari pelanggan.
        label: 'Pajak dipotong pelanggan',
        value: rupiahShort(sum(berlaku, withheld)),
        hint: 'PPh yang perlu bukti potong',
        icon: Percent,
        color: 'orange',
      },
    ];
  }, [payments]);

  const months = useMemo(() => {
    const unik = [...new Set(payments.map((p) => monthOf(p.date)))].sort().reverse();
    return [
      { value: 'all', label: 'Semua bulan' },
      ...unik.map((m) => ({
        value: m,
        label: formatDate(`${m}-01`).replace(/^\d+ /, ''),
      })),
    ];
  }, [payments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments.filter((p) => {
      if (account !== 'all' && p.account !== account) return false;
      if (method !== 'all' && p.method !== method) return false;
      if (month !== 'all' && monthOf(p.date) !== month) return false;
      if (!q) return true;
      const c = toCustomer(contactsById[p.customerId]);
      return [p.saleNumber, p.memo, c?.name, c?.email, ...(p.tags ?? [])].some((v) =>
        v?.toLowerCase().includes(q),
      );
    });
  }, [payments, contactsById, query, account, method, month]);

  const size = Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * size, current * size);
  const totalTampil = filtered.reduce((n, p) => n + cashReceived(p), 0);
  const jurnalSale = journalId && sales.find((s) => s.id === journalId);
  const voidSale = voiding && sales.find((s) => s.id === voiding.saleId);
  const voidTarget = voidSale?.payments?.[voiding.index] ?? null;

  // B3: pembatalan tidak menghapus pembayaran — jurnalnya dibalik, sisa tagihan kembali,
  // dan kredit pelanggan yang sempat terpakai dikembalikan ke returnya.
  const confirmVoid = (reason) => {
    const at = nowIso();
    setSales((list) =>
      list.map((s) =>
        s.id !== voiding.saleId
          ? s
          : logActivity(
              {
                ...s,
                payments: s.payments.map((p, i) =>
                  i === voiding.index ? voidPayment(p, reason, at) : p,
                ),
                updatedAt: at,
              },
              'paymentVoided',
              `${rupiah(voidTarget.amount)} · ${reason}`,
            ),
      ),
    );
    if (voidTarget.fromCredit) {
      setSalesReturns((list) => releaseCredit(list, voidSale.customerId, voidTarget.amount, at));
    }
    setVoiding(null);
    notifications.show({
      color: 'red',
      icon: <Prohibit size={18} />,
      title: 'Pembayaran dibatalkan',
      message: `${rupiah(voidTarget.amount)} pada ${voidSale.number} tidak lagi menutup tagihan.`,
      autoClose: 5000,
      withBorder: true,
      radius: 'md',
    });
  };

  const reset = (fn) => (v) => {
    fn(v);
    setPage(1);
  };

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro
        icon={HandCoins}
        title="Pembayaran Masuk"
        description="Semua penerimaan pembayaran dari pelanggan, lintas faktur, beserta akun setor dan bukti transfernya."
        actions={
          <ActionIcon variant="default" size="lg" radius="md" aria-label="Segarkan data">
            <ArrowsClockwise size={16} />
          </ActionIcon>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </SimpleGrid>

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group gap="sm" mb="md">
          <TextInput
            placeholder="Cari nomor faktur, pelanggan, memo, atau tag..."
            size="sm"
            radius="md"
            w={300}
            maw="100%"
            leftSection={<MagnifyingGlass size={14} />}
            value={query}
            onChange={(e) => reset(setQuery)(e.currentTarget.value)}
          />
          <Select
            size="sm"
            radius="md"
            w={220}
            allowDeselect={false}
            aria-label="Saring akun setor"
            data={[{ value: 'all', label: 'Semua akun setor' }, ...accountOptions]}
            value={account}
            onChange={reset(setAccount)}
          />
          <Select
            size="sm"
            radius="md"
            w={200}
            allowDeselect={false}
            aria-label="Saring cara pembayaran"
            data={[{ value: 'all', label: 'Semua cara bayar' }, ...methodOptions]}
            value={method}
            onChange={reset(setMethod)}
          />
          <Select
            size="sm"
            radius="md"
            w={150}
            allowDeselect={false}
            aria-label="Saring bulan"
            data={months}
            value={month}
            onChange={reset(setMonth)}
          />
        </Group>

        <Box
          className="table-frame"
          style={{
            border: '1px solid var(--mantine-color-gray-3)',
            borderRadius: 'var(--mantine-radius-md)',
            overflow: 'hidden',
          }}
        >
          <ScrollArea type="auto">
            <Table
              verticalSpacing="sm"
              horizontalSpacing="md"
              miw={1020}
              highlightOnHover
              styles={{
                th: {
                  fontSize: 'var(--mantine-font-size-xs)',
                  color: 'var(--mantine-color-slate-7)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                },
              }}
            >
              <Table.Thead bg="slate.0">
                <Table.Tr>
                  <Table.Th w={120}>Tanggal</Table.Th>
                  <Table.Th>Faktur</Table.Th>
                  <Table.Th>Cara bayar</Table.Th>
                  <Table.Th w={160}>Tag & bukti</Table.Th>
                  <Table.Th w={170} ta="right">
                    Dibayar
                  </Table.Th>
                  <Table.Th w={160} ta="right">
                    Masuk kas
                  </Table.Th>
                  <Table.Th w={60} ta="center">
                    Aksi
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((p) => (
                  <PaymentRow
                    key={p.key}
                    payment={p}
                    onJournal={() => setJournalId(p.saleId)}
                    onVoid={() => setVoiding({ saleId: p.saleId, index: p.index })}
                  />
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Box>

        {filtered.length === 0 && (
          <Center py="xl">
            <Text fz="sm" c="slate.6">
              Belum ada pembayaran yang cocok. Penerimaan dicatat lewat tombol{' '}
              <b>Catat pembayaran</b> di faktur.
            </Text>
          </Center>
        )}

        <Group justify="space-between" mt="md" gap="sm">
          <Text fz="xs" c="slate.7">
            Menampilkan {rows.length} dari {filtered.length} penerimaan ·{' '}
            <b>{rupiah(totalTampil)}</b> masuk kas
          </Text>
          <Group gap="sm">
            <Select
              size="xs"
              radius="md"
              w={96}
              allowDeselect={false}
              data={pageSizes}
              value={pageSize}
              onChange={(v) => {
                setPageSize(v);
                setPage(1);
              }}
            />
            <Pagination size="sm" radius="md" total={totalPages} value={current} onChange={setPage} />
          </Group>
        </Group>
      </Card>

      {jurnalSale && <JournalModal sale={jurnalSale} onClose={() => setJournalId(null)} />}
      {voidTarget && (
        <ReasonModal
          title="Batalkan Pembayaran"
          subtitle={`${rupiah(voidTarget.amount)} pada ${voidSale.number} dibalik jurnalnya. Catatannya tetap tersimpan sebagai jejak.`}
          label="Alasan pembatalan"
          options={PAYMENT_VOID_REASONS}
          confirmLabel="Batalkan pembayaran"
          onClose={() => setVoiding(null)}
          onConfirm={confirmVoid}
        />
      )}

      <Group justify="center">
        <Button
          size="compact-xs"
          variant="subtle"
          color="slate"
          leftSection={<Invoice size={14} />}
          onClick={() => goTo({ name: 'tab', tab: 'invoices' })}
        >
          Catat pembayaran baru lewat Faktur Penjualan
        </Button>
      </Group>
    </Stack>
  );
}
