// Modul Pembelian: permintaan → verifikasi → pengadaan (bidding / vendor tunggal) → PO → penerimaan → faktur → pembayaran.
import { ActionIcon, Badge, Button, Card, Group, Menu, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import {
  ArrowCounterClockwise,
  ArrowsClockwise,
  CaretDown,
  FileText,
  Invoice,
  Plus,
  ShoppingCart,
  Truck,
  Wallet,
  Package,
} from '@/components/Icon.jsx';
import { PageIntro, ReferencePicker } from './components.jsx';
import { CreditModal, DetailModal, DpInvoiceModal, PayModal, ReasonModal, ReturnModal, ReceiptModal, VoucherModal } from './Dialogs.jsx';
import FppbjDetail from './FppbjDetail.jsx';
import FppbjForm from './FppbjForm.jsx';
import LaporanHutang from './LaporanHutang.jsx';
import ListTab from './Lists.jsx';
import Overview from './Overview.jsx';
import PoDetail from './PoDetail.jsx';
import ReceiptDetail from './ReceiptDetail.jsx';
import InvoiceDetail from './InvoiceDetail.jsx';
import InvoiceForm from './InvoiceForm.jsx';
import JournalDetail from './JournalDetail.jsx';
import PrForm from './PrForm.jsx';
import PrDetail from './PrDetail.jsx';
import VoucherDetail from './VoucherDetail.jsx';
import { formatHash, parseHash } from './routes.js';
import { readiness } from './selectors.js';
import { canCreate } from './permissions.js';
import { invTotals, poTotal, routeLabel, rupiah, sum, remainingQty } from './utils.js';
import { usePb } from './usePb.js';

// Definisi menu "Buat baru": peran yang boleh membuat + sumber referensi.
// Dokumen yang bisa dibuat: peran yang boleh membuat + label tombol.
const actions = {
  // Dokumen apa saja yang boleh dibuat tiap peran: lihat permissions.js (spesifikasi 2.2).
  fppbj: { label: 'Buat Permintaan', doc: 'fppbj' },
  po: { label: 'Buat Pesanan', doc: 'po', count: 'po' },
  receipt: { label: 'Buat Penerimaan', doc: 'receipt', count: 'receipt' },
  invoice: { label: 'Buat Tagihan Vendor', doc: 'invoice', count: 'invoice' },
  pr: { label: 'Buat Pembayaran', doc: 'pr', count: 'pr' },
  return: { label: 'Buat Retur Pembelian', doc: 'return', count: 'returns' },
};
// Satu tombol per tab: dokumen yang dibuat di tab itu. Ringkasan memakai dropdown "Buat baru".
const tabAction = { fppbj: 'fppbj', orders: 'po', receipts: 'receipt', bills: 'invoice', payments: 'pr', returns: 'return' };
const buatBaruOrder = ['fppbj', 'po', 'receipt', 'invoice', 'pr', 'return'];

// Judul & deskripsi halaman per menu sidebar.
const pageIntros = {
  overview: { icon: ShoppingCart, title: 'Pembelian', description: 'Kelola pembelian dari permintaan, pengadaan, PO, penerimaan barang/jasa, tagihan vendor hingga pembayaran.' },
  fppbj: { icon: FileText, title: 'Permintaan Pembelian', description: 'Ajukan kebutuhan barang atau jasa; IOM opsional. Setelah diverifikasi, jalur bidding atau vendor tunggal dipilih di tahap pengadaan.' },
  orders: { icon: Package, title: 'Pesanan Pembelian', description: 'Pesanan ke vendor yang dibuat dari pengadaan yang sudah disetujui.' },
  receipts: { icon: Truck, title: 'Penerimaan Barang/Jasa', description: 'Catat barang (FPB) atau jasa (BAPP) dari vendor yang sudah sampai. Penerimaan bisa sebagian.' },
  bills: { icon: Invoice, title: 'Tagihan Vendor', description: 'Faktur dari vendor, dibuat dari penerimaan dan dicocokkan 3 arah dengan PO sebelum dibayar.' },
  payments: { icon: Wallet, title: 'Pembayaran Pembelian', description: 'Payment Request DP dan pelunasan ke vendor. Approver menyetujui, Finance membayar.' },
  returns: { icon: ArrowCounterClockwise, title: 'Retur Pembelian', description: 'Pengembalian barang ke vendor atas faktur yang sudah dibuat.' },
};

export default function Pembelian() {
  const pb = usePb();
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const { view, tab } = parseHash(hash);
  const [dialog, setDialog] = useState(null);
  const close = () => setDialog(null);

  const go = (v) => {
    window.location.assign(formatHash(v));
    window.scrollTo({ top: 0 });
  };
  const home = () => go({ name: 'tab', tab });

  // Dipakai kaki halaman, yang muncul di semua tampilan modul ini.
  const debt = sum(pb.invoices, (i) => invTotals(i, pb.calc).balance);

  const rd = readiness(pb);

  // Konfigurasi dialog "Pilih referensi" per jenis dokumen.
  const vendorName = (id) => pb.vendorsById[id]?.name ?? '—';
  const refs = {
    quotes: {
      title: 'Penawaran vendor · pilih permintaan',
      icon: FileText,
      rows: rd.quotes.map((f) => ({ id: f.id, number: f.number, vendor: f.purpose, value: `${f.quotes.length} penawaran`, hint: f.status === 'diverifikasi' ? 'Diverifikasi · pilih jalur dulu' : 'Dalam pengadaan' })),
      emptyTitle: 'Belum ada permintaan yang siap menerima penawaran',
      emptyText: 'Penawaran dicatat dari permintaan yang sudah diverifikasi atau sedang dalam pengadaan.',
      emptyActions: [<Button key="b" size="xs" radius="md" onClick={() => { close(); go({ name: 'fppbj-new' }); }}>Buat permintaan</Button>],
      pick: ([id]) => { close(); go({ name: 'fppbj', id }); },
    },
    po: {
      title: 'PO · pilih pengadaan yang disetujui',
      icon: ShoppingCart,
      rows: rd.po.map((f) => ({ id: f.id, number: f.number, vendor: f.purpose, value: routeLabel(f), hint: 'Disetujui · belum dibuat PO' })),
      emptyTitle: 'Belum ada pengadaan yang disetujui',
      emptyText: 'PO dibuat dari pengadaan yang sudah disetujui approver.',
      pick: ([id]) => { close(); go({ name: 'fppbj', id }); },
    },
    receipt: {
      title: 'Penerimaan · pilih PO',
      icon: Truck,
      // Pesanan yang belum dikirim ikut ditawarkan — penerimaan tidak menunggu dokumennya
      // lepas ke vendor — tapi keadaan itu disebut, supaya pilihannya diambil sadar.
      rows: rd.receipt.map((p) => ({ id: p.id, number: p.number, vendor: vendorName(p.vendorId), value: rupiah(poTotal(p)), hint: p.sent ? undefined : 'Belum dikirim ke vendor', remain: `Sisa ${p.items.reduce((n, i) => n + remainingQty(p, i.id, pb.receipts), 0)} belum diterima` })),
      emptyTitle: 'Belum ada PO yang bisa diterima',
      emptyText: 'Penerimaan dicatat dari pesanan yang belum diterima penuh.',
      emptyActions: [<Button key="b" size="xs" radius="md" variant="default" onClick={() => { close(); go({ name: 'tab', tab: 'orders' }); }}>Lihat PO</Button>, <Button key="c" size="xs" radius="md" onClick={() => { close(); go({ name: 'fppbj-new' }); }}>Buat permintaan</Button>],
      pick: ([id]) => setDialog({ type: 'receipt', poId: id }),
    },
    return: {
      title: 'Retur pembelian · pilih faktur',
      icon: ArrowCounterClockwise,
      rows: rd.returns.map((i) => ({ id: i.id, number: i.number, vendor: vendorName(i.vendorId), value: rupiah(invTotals(i, pb.calc).total), hint: pb.posById[i.poId]?.number })),
      emptyTitle: 'Belum ada faktur barang yang bisa diretur',
      emptyText: 'Retur dibuat dari faktur barang. Barang ditolak sebelum difaktur cukup dicatat di FPB.',
      pick: ([id]) => setDialog({ type: 'return', invoiceId: id }),
    },
  };

  const onBuat = (key) => {
    // Permintaan dan faktur punya halaman formnya sendiri. Khusus faktur, langkah 1 form itu
    // sudah memuat pemilihan vendor dan penerimaan, jadi modal pemilih di depannya cuma
    // menambah satu klik untuk pekerjaan yang sama.
    if (key === 'fppbj') return go({ name: 'fppbj-new' });
    if (key === 'invoice') return go({ name: 'invoice-new' });
    if (key === 'pr') return go({ name: 'pr-new' });
    setDialog({ type: 'ref', kind: key });
  };

  // Dokumen di luar peran aktif: tombol/menu-nya tidak ditampilkan sama sekali.
  // Penerimaan dibuat Gudang (FPB) atau PIC jasa (BAPP), tergantung isi pesanannya.
  const allowed = (key) =>
    actions[key].doc === 'receipt'
      ? canCreate(pb.role, 'fpb') || canCreate(pb.role, 'bapp')
      : canCreate(pb.role, actions[key].doc);

  // Tombol tunggal untuk tab dokumen.
  const createButton = (key) =>
    allowed(key) ? (
      <Button radius="md" leftSection={<Plus size={16} />} onClick={() => onBuat(key)}>
        {actions[key].label}
      </Button>
    ) : null;

  // Dropdown "Buat baru" untuk Ringkasan Pembelian.
  const keys = buatBaruOrder.filter(allowed);
  const buatBaru = !keys.length ? null : (
    <Menu position="bottom-end" width={260} shadow="md" withinPortal>
      <Menu.Target>
        <Button radius="md" leftSection={<Plus size={16} />} rightSection={<CaretDown size={14} />}>
          Buat baru
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        {keys.map((key) => {
          const n = actions[key].count ? rd[actions[key].count].length : null;
          return (
            <Menu.Item key={key} fz="xs" onClick={() => onBuat(key)} rightSection={n ? <Badge size="sm" circle variant="light" color="primary" tt="none">{n}</Badge> : null}>
              {actions[key].label}
            </Menu.Item>
          );
        })}
        <Menu.Divider />
        <Text fz={10} c="slate.6" px="sm" py={4}>Angka = dokumen yang siap dilanjutkan</Text>
      </Menu.Dropdown>
    </Menu>
  );

  // --- dialog hub ---
  const d = dialog;
  const prDoc = d?.prId ? pb.prs.find((p) => p.id === d.prId) : null;
  const dialogs = (
    <>
      {d?.type === 'ref' && (
        <ReferencePicker
          opened
          onClose={close}
          title={refs[d.kind].title}
          icon={refs[d.kind].icon}
          rows={refs[d.kind].rows}
          multi={refs[d.kind].multi}
          emptyTitle={refs[d.kind].emptyTitle}
          emptyText={refs[d.kind].emptyText}
          emptyActions={refs[d.kind].emptyActions}
          onPick={refs[d.kind].pick}
        />
      )}
      {d?.type === 'receipt' && <ReceiptModal opened onClose={close} po={pb.posById[d.poId]} pb={pb} />}
      {d?.type === 'dp-invoice' && <DpInvoiceModal opened onClose={close} po={pb.posById[d.poId]} pb={pb} onSaved={(id) => go({ name: 'invoice', id })} />}
      {d?.type === 'pv' && prDoc && <VoucherModal opened onClose={close} pr={prDoc} pb={pb} />}
      {d?.type === 'pay' && pb.vouchersById[d.voucherId] && <PayModal opened onClose={close} voucher={pb.vouchersById[d.voucherId]} pb={pb} />}
      {d?.type === 'pr-reject' && prDoc && (
        <ReasonModal
          opened
          onClose={close}
          title="Tolak Payment Request"
          label="Alasan penolakan"
          confirmLabel="Tolak"
          onConfirm={(note) => { pb.update('prs', prDoc.id, (x) => ({ ...x, status: 'ditolak', note })); close(); }}
        />
      )}
      {d?.type === 'return' && <ReturnModal opened onClose={close} invoice={pb.invoicesById[d.invoiceId]} pb={pb} />}
      {d?.type === 'credit' && <CreditModal opened onClose={close} invoice={pb.invoicesById[d.invoiceId]} pb={pb} />}
      {d?.type === 'detail' && <DetailModal opened onClose={close} kind={d.kind} doc={pb[d.kind].find((x) => x.id === d.id)} pb={pb} />}
    </>
  );

  // --- tampilan ---
  if (view.name === 'fppbj-new') {
    return <FppbjForm pb={pb} onBack={home} onSaved={(id) => go({ name: 'fppbj', id })} />;
  }
  if (view.name === 'fppbj-edit' && pb.fppbjById[view.id]) {
    return <FppbjForm key={view.id} pb={pb} editing={pb.fppbjById[view.id]} onBack={() => go({ name: 'fppbj', id: view.id })} onSaved={(id) => go({ name: 'fppbj', id })} />;
  }
  if (view.name === 'fppbj' && pb.fppbjById[view.id]) {
    return (
      <>
        <FppbjDetail fppbj={pb.fppbjById[view.id]} pb={pb} onBack={() => go({ name: 'tab', tab: 'fppbj' })} go={go} />
        {dialogs}
      </>
    );
  }
  if (view.name === 'po' && pb.posById[view.id]) {
    return (
      <>
        <PoDetail po={pb.posById[view.id]} pb={pb} onBack={() => go({ name: 'tab', tab: 'orders' })} go={go} openDialog={setDialog} />
        {dialogs}
      </>
    );
  }

  if (view.name === 'receipt' && pb.receiptsById[view.id]) {
    return (
      <>
        <ReceiptDetail receipt={pb.receiptsById[view.id]} pb={pb} onBack={() => go({ name: 'tab', tab: 'receipts' })} go={go} openDialog={setDialog} />
        {dialogs}
      </>
    );
  }

  if (view.name === 'pr-new') {
    return (
      <>
        <PrForm
          pb={pb}
          initialInvoiceIds={view.invoiceIds}
          initialPoId={view.poId}
          onBack={() => go({ name: 'tab', tab: 'payments' })}
          onSaved={(id) => go({ name: 'pr', id })}
        />
      </>
    );
  }
  if (view.name === 'invoice-new') {
    return (
      <>
        <InvoiceForm
          pb={pb}
          initialReceiptIds={view.receiptIds}
          initialPoId={view.poId}
          initialDpPoId={view.dpPoId}
          onBack={() => go({ name: 'tab', tab: 'bills' })}
          onSaved={(id) => go({ name: 'invoice', id })}
        />
      </>
    );
  }
  if (view.name === 'invoice' && pb.invoicesById[view.id]) {
    return (
      <>
        <InvoiceDetail invoice={pb.invoicesById[view.id]} pb={pb} onBack={() => go({ name: 'tab', tab: 'bills' })} go={go} openDialog={setDialog} />
        {dialogs}
      </>
    );
  }

  const journalDoc = view.name === 'journal'
    ? ({ pv: pb.vouchersById, invoice: pb.invoicesById, receipt: pb.receiptsById }[view.kind ?? 'pv'] ?? {})[view.id]
    : null;
  if (view.name === 'journal' && journalDoc) {
    const kembali = { pv: 'voucher', invoice: 'invoice', receipt: 'receipt' }[view.kind ?? 'pv'];
    return (
      <>
        <JournalDetail kind={view.kind ?? 'pv'} doc={journalDoc} pb={pb} onBack={() => go({ name: kembali, id: view.id })} go={go} />
        {dialogs}
      </>
    );
  }
  if (view.name === 'voucher' && pb.vouchersById[view.id]) {
    return (
      <>
        <VoucherDetail voucher={pb.vouchersById[view.id]} pb={pb} onBack={() => go({ name: 'tab', tab: 'payments' })} go={go} openDialog={setDialog} />
        {dialogs}
      </>
    );
  }

  if (view.name === 'pr' && pb.prs.some((p) => p.id === view.id)) {
    return (
      <>
        <PrDetail pr={pb.prs.find((p) => p.id === view.id)} pb={pb} onBack={() => go({ name: 'tab', tab: 'payments' })} go={go} openDialog={setDialog} />
        {dialogs}
      </>
    );
  }

  const refresh = (
    <ActionIcon variant="default" size="lg" radius="md" aria-label="Segarkan data pembelian">
      <ArrowsClockwise size={16} />
    </ActionIcon>
  );
  const intro = pageIntros[tab];
  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      {tab === 'payables' ? (
        <LaporanHutang pb={pb} go={go} onBack={() => go({ name: 'tab', tab: 'overview' })} />
      ) : (
        <>
          <PageIntro
            icon={intro.icon}
            title={intro.title}
            description={intro.description}
            actions={
              <>
                {refresh}
                {tab === 'overview' ? buatBaru : tabAction[tab] ? createButton(tabAction[tab]) : null}
              </>
            }
          />
          {tab === 'overview' ? (
            <Overview pb={pb} go={go} />
          ) : (
            <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
              <ListTab key={tab} tab={tab} pb={pb} go={go} openDialog={setDialog} />
            </Card>
          )}
        </>
      )}
      <Group justify="center" gap="xs">
        <Text fz={11} c="slate.5">
          Prototype: gunakan &quot;Lihat sebagai&quot; di kaki halaman untuk berpindah peran. Total hutang berjalan {rupiah(debt)}. Data tersimpan di browser.
        </Text>
        <Button size="compact-xs" variant="subtle" color="slate" onClick={() => { pb.reset(); go({ name: 'tab', tab: 'overview' }); }}>Reset data contoh</Button>
      </Group>
      {dialogs}
    </Stack>
  );
}

