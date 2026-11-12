// Modul Pembelian sesuai flow baru: permintaan → bidding / pesan ulang → PO → penerimaan → faktur → pembayaran.
import { ActionIcon, Badge, Button, Card, Group, Menu, Select, Stack, Text } from '@mantine/core';
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
  Scales,
} from '@/components/Icon.jsx';
import { PageIntro, ReferencePicker } from './components.jsx';
import { CreditModal, DetailModal, InvoiceModal, PayModal, PrModal, ReasonModal, ReturnModal, ReceiptModal } from './Dialogs.jsx';
import FpbjDetail from './FpbjDetail.jsx';
import FpbjForm from './FpbjForm.jsx';
import LaporanHutang from './LaporanHutang.jsx';
import ListTab from './Lists.jsx';
import Overview from './Overview.jsx';
import PoDetail from './PoDetail.jsx';
import ReceiptDetail from './ReceiptDetail.jsx';
import InvoiceDetail from './InvoiceDetail.jsx';
import PrDetail from './PrDetail.jsx';
import VoucherDetail from './VoucherDetail.jsx';
import { roles } from './data.js';
import { formatHash, parseHash } from './routes.js';
import { readiness } from './selectors.js';
import { canCreate } from './permissions.js';
import { invTotals, poDpAmount, poTotal, routeLabel, rupiah, sum, termText, uninvoicedLines, remainingQty } from './utils.js';
import { usePb } from './usePb.js';

// Definisi menu "Buat baru": peran yang boleh membuat + sumber referensi.
// Dokumen yang bisa dibuat: peran yang boleh membuat + label tombol.
const actions = {
  // Dokumen apa saja yang boleh dibuat tiap peran: lihat permissions.js (spesifikasi 2.2).
  fpbj: { label: 'Buat Permintaan', doc: 'fpbj' },
  po: { label: 'Buat Pesanan', doc: 'po', count: 'po' },
  receipt: { label: 'Buat Penerimaan', doc: 'receipt', count: 'receipt' },
  invoice: { label: 'Buat Tagihan Vendor', doc: 'invoice', count: 'invoice' },
  pr: { label: 'Buat Pembayaran', doc: 'pr', count: 'pr' },
  return: { label: 'Buat Retur Pembelian', doc: 'return', count: 'returns' },
};
// Satu tombol per tab: dokumen yang dibuat di tab itu. Ringkasan memakai dropdown "Buat baru".
const tabAction = { fpbj: 'fpbj', orders: 'po', receipts: 'receipt', bills: 'invoice', payments: 'pr', returns: 'return' };
const buatBaruOrder = ['fpbj', 'po', 'receipt', 'invoice', 'pr', 'return'];

// Judul & deskripsi halaman per menu sidebar.
const pageIntros = {
  overview: { icon: ShoppingCart, title: 'Pembelian', description: 'Kelola pembelian dari permintaan, pengadaan, PO, penerimaan barang, tagihan vendor hingga pembayaran.' },
  fpbj: { icon: FileText, title: 'Permintaan Pembelian', description: 'Ajukan kebutuhan barang atau jasa dengan IOM. Setelah diverifikasi Accounting, pilih jalur bidding atau pesan ulang.' },
  orders: { icon: Package, title: 'Pesanan Pembelian', description: 'Pesanan ke vendor yang dibuat dari pengadaan yang sudah disetujui.' },
  receipts: { icon: Truck, title: 'Penerimaan Barang', description: 'Catat barang (FPB) atau jasa (BAST) dari vendor yang sudah sampai. Penerimaan bisa sebagian.' },
  bills: { icon: Invoice, title: 'Tagihan Vendor', description: 'Faktur dari vendor, dibuat dari penerimaan dan dicocokkan 3 arah dengan PO sebelum dibayar.' },
  payments: { icon: Wallet, title: 'Pembayaran Pembelian', description: 'Payment Request DP dan pelunasan ke vendor. Approver menyetujui, Finance membayar.' },
  returns: { icon: ArrowCounterClockwise, title: 'Retur Pembelian', description: 'Pengembalian barang ke vendor atas faktur yang sudah dibuat.' },
};

// Pengalih peran (prototype): melayang di semua tampilan agar alur bisa diuji dari tiap peran.
function RoleBar({ role, setRole }) {
  return (
    <Group
      gap="xs"
      wrap="nowrap"
      p="xs"
      bg="white"
      style={{
        position: 'fixed',
        right: 24,
        bottom: 76,
        zIndex: 150,
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 'var(--mantine-radius-md)',
        boxShadow: 'var(--mantine-shadow-md)',
      }}
    >
      <Text fz={11} fw={600} c="slate.6">Lihat sebagai</Text>
      <Select size="xs" radius="md" w={170} allowDeselect={false} aria-label="Lihat sebagai" leftSection={<Scales size={14} />} data={roles.map((r) => ({ value: r.value, label: r.label }))} value={role} onChange={setRole} comboboxProps={{ position: 'top' }} />
    </Group>
  );
}

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

  const rd = readiness(pb);

  // Konfigurasi dialog "Pilih referensi" per jenis dokumen.
  const vendorName = (id) => pb.vendorsById[id]?.name ?? '—';
  const refs = {
    repeat: {
      title: 'Pesan ulang · pilih PO lama',
      icon: Package,
      rows: rd.repeat.map((p) => ({ id: p.id, number: p.number, vendor: vendorName(p.vendorId), value: rupiah(poTotal(p)), hint: p.items.map((i) => i.desc).join(', ') })),
      emptyTitle: 'Belum ada PO yang selesai',
      emptyText: 'Pesan ulang memakai PO berstatus Selesai sebagai acuan harga. Untuk barang atau vendor baru, mulai dari permintaan.',
      emptyActions: [<Button key="b" size="xs" radius="md" onClick={() => { close(); go({ name: 'fpbj-new' }); }}>Buat permintaan</Button>],
      pick: ([id]) => { close(); go({ name: 'fpbj-new', prefill: { poId: id } }); },
    },
    quotes: {
      title: 'Penawaran vendor · pilih permintaan',
      icon: FileText,
      rows: rd.quotes.map((f) => ({ id: f.id, number: f.number, vendor: f.purpose, value: `${f.quotes.length} penawaran`, hint: f.status === 'diverifikasi' ? 'Diverifikasi · pilih jalur dulu' : 'Dalam pengadaan' })),
      emptyTitle: 'Belum ada permintaan yang siap menerima penawaran',
      emptyText: 'Penawaran dicatat dari permintaan yang sudah diverifikasi atau sedang dalam pengadaan.',
      emptyActions: [<Button key="b" size="xs" radius="md" onClick={() => { close(); go({ name: 'fpbj-new' }); }}>Buat permintaan</Button>],
      pick: ([id]) => { close(); go({ name: 'fpbj', id }); },
    },
    po: {
      title: 'PO · pilih pengadaan yang disetujui',
      icon: ShoppingCart,
      rows: rd.po.map((f) => ({ id: f.id, number: f.number, vendor: f.purpose, value: routeLabel(f), hint: 'Disetujui · belum dibuat PO' })),
      emptyTitle: 'Belum ada pengadaan yang disetujui',
      emptyText: 'PO dibuat dari bidding atau pesan ulang yang sudah disetujui approver.',
      pick: ([id]) => { close(); go({ name: 'fpbj', id }); },
    },
    receipt: {
      title: 'Penerimaan · pilih PO',
      icon: Truck,
      rows: rd.receipt.map((p) => ({ id: p.id, number: p.number, vendor: vendorName(p.vendorId), value: rupiah(poTotal(p)), remain: `Sisa ${p.items.reduce((n, i) => n + remainingQty(p, i.id, pb.receipts), 0)} belum diterima` })),
      emptyTitle: 'Belum ada PO yang bisa diterima',
      emptyText: 'Penerimaan dicatat dari PO yang sudah dikirim ke vendor dan belum diterima penuh.',
      emptyActions: [<Button key="b" size="xs" radius="md" variant="default" onClick={() => { close(); go({ name: 'tab', tab: 'orders' }); }}>Lihat PO</Button>, <Button key="c" size="xs" radius="md" onClick={() => { close(); go({ name: 'fpbj-new' }); }}>Buat permintaan</Button>],
      pick: ([id]) => setDialog({ type: 'receipt', poId: id }),
    },
    invoice: {
      multi: true,
      title: 'Faktur · pilih penerimaan (FPB/BAST)',
      icon: Invoice,
      rows: rd.invoice.map((r) => ({ id: r.id, number: r.number, vendorId: r.vendorId, vendor: vendorName(r.vendorId), value: `${r.lines.reduce((n, l) => n + l.qty, 0)} diterima`, remain: `${uninvoicedLines(r, pb.invoices).length} baris belum difaktur`, hint: pb.posById[r.poId]?.number })),
      emptyTitle: 'Belum ada penerimaan yang siap difaktur',
      emptyText: 'Faktur dibuat dari FPB/BAST yang sudah dikonfirmasi dan belum difaktur penuh.',
      emptyActions: [<Button key="b" size="xs" radius="md" variant="default" onClick={() => { close(); go({ name: 'tab', tab: 'orders' }); }}>Lihat PO</Button>],
      pick: (ids) => setDialog({ type: 'invoice', receiptIds: ids }),
    },
    pr: {
      multi: true,
      title: 'Payment Request · pilih dasar pembayaran',
      icon: Wallet,
      rows: [
        ...rd.prDp.map((p) => ({ id: `dp:${p.id}`, solo: true, group: 'DP / CBD · dari PO', number: p.number, vendor: vendorName(p.vendorId), value: rupiah(poDpAmount(p)), hint: `Termin ${termText(p.term)}` })),
        ...rd.prPay.map((i) => ({ id: i.id, group: 'Pelunasan · dari faktur', number: i.number, vendorId: i.vendorId, vendor: vendorName(i.vendorId), value: rupiah(invTotals(i, pb.calc).free), hint: `Jatuh tempo ${i.dueDate}` })),
      ],
      emptyTitle: 'Belum ada yang perlu dibayar',
      emptyText: 'Payment Request dibuat dari PO bertermin DP/CBD yang belum diajukan, atau dari faktur yang belum dibayar.',
      emptyActions: [<Button key="b" size="xs" radius="md" variant="default" onClick={() => { close(); go({ name: 'tab', tab: 'receipts' }); }}>Lihat penerimaan</Button>],
      pick: (ids) => (ids[0].startsWith('dp:')
        ? setDialog({ type: 'pr', kind: 'dp', poId: ids[0].slice(3) })
        : setDialog({ type: 'pr', kind: 'pelunasan', invoiceIds: ids })),
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
    if (key === 'fpbj') return go({ name: 'fpbj-new' });
    setDialog({ type: 'ref', kind: key });
  };

  // Dokumen di luar peran aktif: tombol/menu-nya tidak ditampilkan sama sekali.
  // Penerimaan dibuat Gudang (FPB) atau PIC jasa (BAST), tergantung isi pesanannya.
  const allowed = (key) =>
    actions[key].doc === 'receipt'
      ? canCreate(pb.role, 'fpb') || canCreate(pb.role, 'bast')
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
      {d?.type === 'invoice' && <InvoiceModal opened onClose={close} receiptIds={d.receiptIds} pb={pb} />}
      {d?.type === 'pr' && <PrModal opened onClose={close} kind={d.kind} po={d.poId ? pb.posById[d.poId] : null} invoiceIds={d.invoiceIds} pb={pb} />}
      {d?.type === 'pay' && prDoc && <PayModal opened onClose={close} pr={prDoc} pb={pb} />}
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
  const roleBar = <RoleBar role={pb.role} setRole={pb.setRole} />;
  if (view.name === 'fpbj-new') {
    return <><FpbjForm key={view.prefill?.poId ?? 'new'} pb={pb} prefill={view.prefill} onBack={home} onSaved={(id) => go({ name: 'fpbj', id })} />{roleBar}</>;
  }
  if (view.name === 'fpbj-edit' && pb.fpbjById[view.id]) {
    return <><FpbjForm key={view.id} pb={pb} editing={pb.fpbjById[view.id]} onBack={() => go({ name: 'fpbj', id: view.id })} onSaved={(id) => go({ name: 'fpbj', id })} />{roleBar}</>;
  }
  if (view.name === 'fpbj' && pb.fpbjById[view.id]) {
    return (
      <>
        <FpbjDetail fpbj={pb.fpbjById[view.id]} pb={pb} onBack={() => go({ name: 'tab', tab: 'fpbj' })} go={go} />
        {dialogs}
        {roleBar}
      </>
    );
  }
  if (view.name === 'po' && pb.posById[view.id]) {
    return (
      <>
        <PoDetail po={pb.posById[view.id]} pb={pb} onBack={() => go({ name: 'tab', tab: 'orders' })} go={go} openDialog={setDialog} />
        {dialogs}
        {roleBar}
      </>
    );
  }

  if (view.name === 'receipt' && pb.receiptsById[view.id]) {
    return (
      <>
        <ReceiptDetail receipt={pb.receiptsById[view.id]} pb={pb} onBack={() => go({ name: 'tab', tab: 'receipts' })} go={go} openDialog={setDialog} />
        {dialogs}
        {roleBar}
      </>
    );
  }

  if (view.name === 'invoice' && pb.invoicesById[view.id]) {
    return (
      <>
        <InvoiceDetail invoice={pb.invoicesById[view.id]} pb={pb} onBack={() => go({ name: 'tab', tab: 'bills' })} go={go} openDialog={setDialog} />
        {dialogs}
        {roleBar}
      </>
    );
  }

  if (view.name === 'voucher' && pb.vouchersById[view.id]) {
    return (
      <>
        <VoucherDetail voucher={pb.vouchersById[view.id]} pb={pb} onBack={() => go({ name: 'tab', tab: 'payments' })} go={go} />
        {dialogs}
        {roleBar}
      </>
    );
  }

  if (view.name === 'pr' && pb.prs.some((p) => p.id === view.id)) {
    return (
      <>
        <PrDetail pr={pb.prs.find((p) => p.id === view.id)} pb={pb} onBack={() => go({ name: 'tab', tab: 'payments' })} go={go} openDialog={setDialog} />
        {dialogs}
        {roleBar}
      </>
    );
  }

  const debt = sum(pb.invoices, (i) => invTotals(i, pb.calc).balance);
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
          Prototype: gunakan &quot;Lihat sebagai&quot; (kanan bawah) untuk berpindah peran. Total hutang berjalan {rupiah(debt)}. Data tersimpan di browser.
        </Text>
        <Button size="compact-xs" variant="subtle" color="slate" onClick={() => { pb.reset(); go({ name: 'tab', tab: 'overview' }); }}>Reset data contoh</Button>
      </Group>
      {dialogs}
      {roleBar}
    </Stack>
  );
}

