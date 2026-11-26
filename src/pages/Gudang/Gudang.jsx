// Menu Gudang: master lokasi penyimpanan.
//
// Gudang bukan tempat transaksi. Saldo dan riwayat stok datang dari stock.js (sumber
// yang sama dengan Mutasi Stok) dan hanya ditampilkan dengan filter gudangnya.
// Tidak ada tombol yang mengubah stok langsung dari sini.
import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { PageIntro } from '@/components/common.jsx';
import StatCards from '@/components/StatCards.jsx';
import {
  ArrowsClockwise,
  CheckCircle,
  ListChecks,
  Package,
  PencilSimple,
  Plus,
  Prohibit,
  Trash,
  Warehouse,
  Warning,
} from '@/components/Icon.jsx';
import {
  BackLink,
  EmptyState,
  ListShell,
  RowMenu,
  StatusPill,
} from '@/pages/Pembelian/components.jsx';
import { rupiah } from '@/pages/Penjualan/utils.js';
import { periodLocked } from '@/pages/Penjualan/data.js';
import { formatDate } from '@/pages/Pembelian/utils.js';
import { useData } from '@/lib/store.jsx';
import { unitName } from '@/pages/Produk/catalog.js';
import { STATUS_PILL, TODAY, diffWarehouse, personLabel, picName } from './data.js';
import {
  TRANSFER_APPROVER,
  balanceRows,
  belowMinimumCount,
  buildMove,
  canApproveTransfer,
  canIssue,
  distinctItemCount,
  effectiveCosts,
  getAverageCost,
  listMoves,
  reverseMove,
  sumValue,
} from './stock.js';
import {
  canViewInventoryValue,
  deactivateBlockers,
  hasTransactions,
} from './selectors.js';
import WarehouseForm from './WarehouseForm.jsx';
import WarehouseDetail from './WarehouseDetail.jsx';
import MutasiStok from './MutasiStok.jsx';
import StockCard from './StockCard.jsx';
import TransferForm from './TransferForm.jsx';
import TransferDetail from './TransferDetail.jsx';
import MoveJournal from './MoveJournal.jsx';
import OpnameList from './OpnameList.jsx';
import OpnameForm from './OpnameForm.jsx';
import OpnameDetail from './OpnameDetail.jsx';
import { ReasonModal } from '@/pages/Pembelian/Dialogs.jsx';
import {
  ApproveOpnameDialog,
  CancelOpnameDialog,
  CancelTransferDialog,
  DeactivateDialog,
  DeleteDialog,
  MakeDefaultDialog,
  MinStockDialog,
  StartOpnameDialog,
  SubmitOpnameDialog,
} from './Dialogs.jsx';
import {
  buildOpnameLines,
  defaultOpnameAccounts,
  foundLine,
  nextOpnameNumber,
  opnameEvent,
  opnameSummary,
  postBlockers,
  postOpname,
  reverseBlockers,
  frozenMessage,
  reasonFitsDiff,
  reverseOpname,
} from './opname.js';
import { formatHash, parseHash } from './routes.js';

const number = new Intl.NumberFormat('id-ID');
// Prototype memakai tanggal aplikasi (TODAY), bukan tanggal komputer, supaya
// riwayat perubahan tidak melompat ke tanggal lain daripada dokumen di sekitarnya.
const nowIso = () => `${TODAY}T${new Date().toISOString().slice(11)}`;
const uid = (p) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
// "2026-11-20" → "Nov 2026", untuk pesan periode terkunci.
const monthLabel = (iso) => formatDate(`${iso.slice(0, 7)}-01`).replace(/^\d+ /, '');

const statusFilters = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
  { value: 'all', label: 'Semua' },
];

// Pesannya sudah satu kalimat utuh, jadi dipakai sebagai judul — tanpa baris
// "Berhasil" yang tidak menambah keterangan apa pun.
const toast = (message, { color = 'green', body, action } = {}) => {
  const id = `gudang-${Date.now()}`;
  notifications.show({
    id,
    color,
    icon: color === 'green' ? <CheckCircle size={18} /> : <Warning size={18} />,
    title: message,
    radius: 'md',
    withBorder: true,
    autoClose: action ? 8000 : 5000,
    message: action ? (
      <Group gap="sm" justify="space-between" wrap="nowrap" mt={4}>
        <Text fz="xs" c="slate.6">
          {body}
        </Text>
        <Button
          size="compact-xs"
          variant="light"
          radius="md"
          onClick={() => {
            // Toast ikut ditutup, supaya tidak menawarkan pembatalan yang sudah dilakukan.
            notifications.hide(id);
            action.onClick();
          }}
        >
          {action.label}
        </Button>
      </Group>
    ) : (
      body
    ),
  });
};

// --- Daftar gudang ----------------------------------------------------------

function WarehouseList({
  warehouses,
  summary,
  totalItems,
  showValue,
  onOpen,
  onAdd,
  onEdit,
  onMakeDefault,
  onDeactivate,
  onActivate,
  onDelete,
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return warehouses.filter(
      (w) =>
        (status === 'all' || w.status === status) &&
        (!q || [w.code, w.name, w.city].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [warehouses, query, status]);

  const head = [
    { label: 'Kode', w: 110 },
    { label: 'Nama gudang' },
    { label: 'Kota' },
    { label: 'Penanggung jawab' },
    { label: 'Jumlah item', align: 'right' },
    ...(showValue ? [{ label: 'Nilai persediaan', align: 'right' }] : []),
    { label: 'Status' },
    { label: '', align: 'right', w: 60 },
  ];

  const rows = filtered.map((w) => {
    const s = summary(w);
    return (
      <Table.Tr key={w.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(w)}>
        <Table.Td>
          <Text fz="sm" fw={700} c="primary.9">
            {w.code}
          </Text>
        </Table.Td>
        <Table.Td>
          <Group gap={6} wrap="nowrap">
            <Text fz="sm" fw={600} c="slate.9">
              {w.name}
            </Text>
            {w.isDefault && (
              <Badge size="xs" radius="sm" variant="light" color="primary" tt="none">
                Utama
              </Badge>
            )}
          </Group>
        </Table.Td>
        <Table.Td>
          <Text fz="sm" c={w.city ? 'slate.7' : 'slate.5'}>
            {w.city || '—'}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text fz="sm" c={w.picUserId ? 'slate.7' : 'slate.5'}>
            {picName(w.picUserId) ?? 'Belum ditunjuk'}
          </Text>
        </Table.Td>
        <Table.Td ta="right">
          <Text fz="sm" fw={600} c="slate.9">
            {number.format(s.items)}
          </Text>
        </Table.Td>
        {showValue && (
          <Table.Td ta="right">
            <Text fz="sm" fw={600} c="slate.9">
              {rupiah(s.value)}
            </Text>
          </Table.Td>
        )}
        <Table.Td>
          <StatusPill map={STATUS_PILL} status={w.status} />
        </Table.Td>
        <Table.Td onClick={(e) => e.stopPropagation()}>
          <Group justify="flex-end">
            <RowMenu
              label={w.name}
              items={[
                { label: 'Ubah', icon: PencilSimple, onClick: () => onEdit(w) },
                !w.isDefault &&
                  w.status === 'active' && {
                    label: 'Jadikan utama',
                    icon: Warehouse,
                    onClick: () => onMakeDefault(w),
                  },
                w.status === 'active'
                  ? { label: 'Nonaktifkan', icon: Prohibit, onClick: () => onDeactivate(w) }
                  : { label: 'Aktifkan', icon: CheckCircle, onClick: () => onActivate(w) },
                s.deletable && { divider: true, key: `d-${w.id}` },
                s.deletable && {
                  label: 'Hapus',
                  icon: Trash,
                  color: 'red',
                  onClick: () => onDelete(w),
                },
              ]}
            />
          </Group>
        </Table.Td>
      </Table.Tr>
    );
  });

  const aktif = warehouses.filter((w) => w.status === 'active');
  const totalValue = aktif.reduce((n, w) => n + summary(w).value, 0);

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro
        icon={Warehouse}
        title="Gudang"
        description="Kelola lokasi penyimpanan barang dan stok di tiap lokasi. Saldo stok dibaca dari Mutasi Stok — gudang hanya menampilkannya per lokasi."
        actions={
          <>
            <Button variant="default" size="sm" radius="md" leftSection={<ArrowsClockwise size={16} />}>
              Segarkan
            </Button>
            <Button radius="md" leftSection={<Plus size={16} />} onClick={onAdd}>
              Tambah gudang
            </Button>
          </>
        }
      />

      <StatCards items={[
        { label: 'Gudang aktif', value: number.format(aktif.length), hint: `Dari ${number.format(warehouses.length)} gudang terdaftar`, icon: Warehouse, color: 'blue' },
        { label: 'Total item', value: number.format(totalItems), hint: 'Produk berbeda dalam saldo stok', icon: Package, color: 'teal' },
        showValue && { label: 'Nilai persediaan', value: rupiah(totalValue), hint: 'Total di gudang aktif', icon: ListChecks, color: 'indigo' },
      ].filter(Boolean)} />

      <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
        <ListShell
          query={query}
          onQuery={(v) => {
            setQuery(v);
            setPage(1);
          }}
          placeholder="Cari kode atau nama gudang..."
          filters={
            <Select
              size="sm"
              radius="md"
              w={160}
              allowDeselect={false}
              data={statusFilters}
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            />
          }
          head={head}
          rows={rows}
          noun="gudang"
          minWidth={showValue ? 940 : 800}
          empty={
            <EmptyState
              icon={Warehouse}
              title="Tidak ada gudang yang cocok"
              text="Ubah kata pencarian atau filter statusnya."
            />
          }
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
        />
      </Card>
    </Stack>
  );
}

// --- Modul ------------------------------------------------------------------

export default function Gudang() {
  const {
    warehouses,
    setWarehouses,
    warehouseLogs,
    setWarehouseLogs,
    stockMinimums,
    setStockMinimums,
    stockMoves,
    stockOpnames,
    stockTransfers,
    postStock,
    companySettings,
    products,
    productCategories,
    productUnits,
    orders,
    pb,
    pbRole,
  } = useData();

  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (v) => {
    window.location.hash = formatHash(v);
    window.scrollTo({ top: 0 });
  };

  const [drawer, setDrawer] = useState(null); // { warehouse: null | gudang }
  const [makeDefault, setMakeDefault] = useState(null);
  const [deactivate, setDeactivate] = useState(null); // { warehouse, blockers }
  const [remove, setRemove] = useState(null);
  const [minStock, setMinStock] = useState(null); // { row, warehouse }
  const [cancelFor, setCancelFor] = useState(null); // dokumen pindah yang akan dibatalkan
  const [rejectFor, setRejectFor] = useState(null); // dokumen pindah yang akan ditolak
  const [startFor, setStartFor] = useState(null); // opname yang akan dimulai
  const [submitFor, setSubmitFor] = useState(null);
  const [approveFor, setApproveFor] = useState(null);
  const [rejectOpnameFor, setRejectOpnameFor] = useState(null);
  const [cancelOpnameFor, setCancelOpnameFor] = useState(null);

  const showValue = canViewInventoryValue(pbRole);
  const ctx = { moves: stockMoves, opnames: stockOpnames, pb, orders };
  // Satu bundel data untuk semua komponen persediaan, supaya tidak ada yang
  // menghitung stok dari sumber lain.
  const data = useMemo(
    () => ({
      moves: stockMoves,
      minimums: stockMinimums,
      transfers: stockTransfers,
      opnames: stockOpnames,
      products,
      categories: productCategories,
      units: productUnits,
      warehouses,
      today: TODAY,
    }),
    [
      stockMoves,
      stockMinimums,
      stockTransfers,
      stockOpnames,
      products,
      productCategories,
      productUnits,
      warehouses,
    ],
  );

  // Filter tab Mutasi Stok & kartu stok, disetel lewat hash dan toolbar.
  const [scope, setScope] = useState(() => ({
    warehouseId: route.filter?.warehouseId ?? 'all',
    productId: route.filter?.productId ?? null,
    view: route.filter?.view ?? null,
    asOf: TODAY,
    from: `${TODAY.slice(0, 7)}-01`,
    to: TODAY,
  }));
  const patchScope = (patch) => setScope((s2) => ({ ...s2, ...patch }));

  const summary = (w) => {
    const rows = balanceRows(data, { warehouseId: w.id, asOf: TODAY });
    return {
      items: distinctItemCount(rows),
      value: sumValue(rows),
      below: belowMinimumCount(rows),
      used: hasTransactions(w.id, ctx),
      deletable: !hasTransactions(w.id, ctx),
    };
  };

  const log = (warehouseId, changes) => {
    if (!changes.length) return;
    setWarehouseLogs((list) => [
      { id: uid('wlog'), warehouseId, userName: picName(pbRole) ?? 'Pengguna', at: nowIso(), changes },
      ...list,
    ]);
  };

  // --- aksi -----------------------------------------------------------------

  const save = (form) => {
    const editing = !!drawer.warehouse;
    if (editing) {
      const before = drawer.warehouse;
      const changes = diffWarehouse(before, form);
      setWarehouses((list) =>
        list.map((w) => {
          if (w.id === form.id) return { ...w, ...form, updatedAt: nowIso() };
          // R2: selalu tepat satu gudang utama.
          return form.isDefault ? { ...w, isDefault: false } : w;
        }),
      );
      log(form.id, changes);
      toast('Perubahan disimpan');
    } else {
      const id = uid('wh');
      const doc = {
        ...form,
        id,
        createdBy: picName(pbRole) ?? 'Pengguna',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      setWarehouses((list) => [
        ...(form.isDefault ? list.map((w) => ({ ...w, isDefault: false })) : list),
        doc,
      ]);
      log(id, [
        { field: 'name', from: null, to: doc.name },
        { field: 'code', from: null, to: doc.code },
      ]);
      toast(`${doc.name} ditambahkan`);
    }
    setDrawer(null);
  };

  const applyDefault = () => {
    const target = makeDefault;
    setWarehouses((list) => list.map((w) => ({ ...w, isDefault: w.id === target.id })));
    const before = warehouses.find((w) => w.isDefault);
    if (before) log(before.id, [{ field: 'isDefault', from: true, to: false }]);
    log(target.id, [{ field: 'isDefault', from: false, to: true }]);
    toast(`${target.name} sekarang gudang utama`);
    setMakeDefault(null);
  };

  const setStatus = (w, status) => {
    setWarehouses((list) =>
      list.map((x) => (x.id === w.id ? { ...x, status, updatedAt: nowIso() } : x)),
    );
    log(w.id, [{ field: 'status', from: w.status, to: status }]);
  };

  const askDeactivate = (w) =>
    setDeactivate({
      warehouse: w,
      blockers: deactivateBlockers(w, {
        moves: stockMoves,
        minimums: stockMinimums,
        products,
        warehouses,
        pb,
        opnames: stockOpnames,
        today: TODAY,
      }),
    });

  const applyDeactivate = () => {
    const w = deactivate.warehouse;
    setStatus(w, 'inactive');
    setDeactivate(null);
    toast(`${w.name} dinonaktifkan`, {
      body: 'Tidak muncul lagi di transaksi baru.',
      action: {
        label: 'Batalkan',
        onClick: () => setStatus({ ...w, status: 'inactive' }, 'active'),
      },
    });
  };

  const activate = (w) => {
    setStatus(w, 'active');
    toast(`${w.name} diaktifkan`);
  };

  const applyDelete = () => {
    const w = remove;
    setWarehouses((list) => list.filter((x) => x.id !== w.id));
    setWarehouseLogs((list) => list.filter((l) => l.warehouseId !== w.id));
    setRemove(null);
    if (route.view.name === 'detail') go({ name: 'tab', tab: 'warehouses' });
    toast(`${w.name} dihapus`);
  };

  const saveMinStock = (value) => {
    const { row, warehouse } = minStock;
    setStockMinimums((list) => {
      const ada = list.some(
        (b) => b.productId === row.productId && b.warehouseId === warehouse.id,
      );
      return ada
        ? list.map((b) =>
            b.productId === row.productId && b.warehouseId === warehouse.id
              ? { ...b, minQty: value }
              : b,
          )
        : [...list, { productId: row.productId, warehouseId: warehouse.id, minQty: value }];
    });
    log(warehouse.id, [
      {
        field: 'minQty',
        from: row.minQty ?? 0,
        to: value,
        productId: row.productId,
        unitId: row.product.baseUnitId ?? row.product.buyUnitId,
      },
    ]);
    setMinStock(null);
    toast('Stok minimum diperbarui');
  };

  // --- pindah barang -------------------------------------------------------

  // Nomor mengikuti bulan DOKUMEN, bukan bulan berjalan — dokumen bertanggal
  // 14 Okt tidak boleh bernomor .../11/...
  const nextTransferNo = (date) => {
    const [y, m] = (date ?? TODAY).split('-');
    const seq = stockTransfers.filter((t) => t.no.startsWith(`PDH/${y}/${m}`)).length + 1;
    return `PDH/${y}/${m}/${String(seq).padStart(4, '0')}`;
  };

  const saveTransfer = (form) => {
    const id = uid('tr');
    const no = nextTransferNo(form.date);
    const by = picName(pbRole) ?? 'Pengguna';
    // Stok belum bergerak di sini. Dokumen menunggu persetujuan Building Manager
    // dulu; mutasinya dibuat saat disetujui.
    const transfer = {
      id,
      no,
      ...form,
      status: 'menunggu',
      createdBy: by,
      createdAt: nowIso(),
    };
    postStock({ transfer });
    toast(`${no} diajukan`, {
      body: `Menunggu persetujuan ${personLabel(TRANSFER_APPROVER)}. Stok belum berpindah.`,
    });
    go({ name: 'transfer', id });
  };

  /** Mutasi dua baris per item: keluar dari asal, masuk ke tujuan (M6). */
  const transferMoves = (transfer, by) =>
    transfer.lines.flatMap((l) => {
      const avg = getAverageCost(stockMoves, l.productId, transfer.date);
      const base = {
        date: transfer.date,
        productId: l.productId,
        qty: l.qty,
        sourceType: 'stock_transfer',
        sourceId: transfer.id,
        sourceNo: transfer.no,
        createdBy: by,
      };
      return [
        buildMove({ ...base, type: 'transfer_out', warehouseId: transfer.fromWarehouseId }),
        buildMove({ ...base, type: 'transfer_in', warehouseId: transfer.toWarehouseId, unitCost: avg }),
      ];
    });

  /**
   * Stok bisa saja sudah terpakai dokumen lain selama dokumen ini menunggu, jadi
   * ketersediaannya diperiksa ulang saat disetujui — bukan hanya saat diajukan.
   */
  const transferShortage = (transfer) =>
    transfer.lines
      .map((l) => {
        const cek = canIssue(stockMoves, l.productId, transfer.fromWarehouseId, transfer.date, l.qty);
        if (cek.ok) return null;
        const p = products.find((x) => x.id === l.productId);
        return `${p?.name ?? l.productId} (tersedia ${cek.available})`;
      })
      .filter(Boolean);

  /**
   * O4: gudang yang sedang diopname tidak boleh menerima atau mengeluarkan
   * barang. Dokumen yang diajukan SEBELUM opname dimulai tetap harus tertahan
   * di sini — kalau lolos, saldo buku yang sudah dibekukan jadi tidak cocok
   * dengan isi rak, dan selisihnya nanti salah dijurnal sebagai opname.
   */
  const transferFrozen = (transfer) =>
    [transfer.fromWarehouseId, transfer.toWarehouseId]
      .map((id) =>
        frozenMessage(stockOpnames, id, warehouses.find((w) => w.id === id)?.name ?? 'Gudang'),
      )
      .filter(Boolean);

  const approveTransfer = (transfer) => {
    const beku = transferFrozen(transfer);
    if (beku.length) {
      toast('Gudang sedang diopname', { color: 'red', body: `${beku[0]}.` });
      return;
    }
    const kurang = transferShortage(transfer);
    if (kurang.length) {
      toast('Stok tidak mencukupi lagi', {
        color: 'red',
        body: `Sejak diajukan, stok ${kurang.join(', ')} sudah terpakai dokumen lain.`,
      });
      return;
    }
    const by = picName(pbRole) ?? 'Pengguna';
    postStock({
      moves: transferMoves(transfer, by),
      updateTransfer: {
        id: transfer.id,
        status: 'disetujui',
        approvedBy: by,
        approvedAt: nowIso(),
      },
    });
    const tujuan = warehouses.find((w) => w.id === transfer.toWarehouseId)?.name ?? 'gudang tujuan';
    toast(`${transfer.no} disetujui`, {
      body: `${transfer.lines.length} produk dipindah ke ${tujuan}.`,
    });
  };

  const rejectTransfer = (transfer, reason) => {
    postStock({
      updateTransfer: {
        id: transfer.id,
        status: 'ditolak',
        rejectedBy: picName(pbRole) ?? 'Pengguna',
        rejectedAt: nowIso(),
        rejectReason: reason,
      },
    });
    setRejectFor(null);
    toast(`${transfer.no} ditolak`, { body: 'Stok tidak berpindah.' });
  };

  const cancelTransfer = (transfer) => {
    // Pembatalan dokumen yang sudah disetujui memindahkan barang kembali, jadi
    // ia ikut ditahan. Menarik pengajuan yang belum disetujui tidak menyentuh
    // stok, jadi itu tetap boleh.
    const beku = transfer.status === 'disetujui' ? transferFrozen(transfer) : [];
    if (beku.length) {
      setCancelFor(null);
      toast('Gudang sedang diopname', { color: 'red', body: `${beku[0]}.` });
      return;
    }
    const by = picName(pbRole) ?? 'Pengguna';
    // Dokumen yang belum disetujui belum punya mutasi, jadi tidak ada yang dibalik.
    if (transfer.status === 'menunggu') {
      postStock({ updateTransfer: { id: transfer.id, status: 'cancelled' } });
      setCancelFor(null);
      toast(`${transfer.no} dibatalkan`, { body: 'Pengajuan ditarik sebelum disetujui.' });
      return;
    }
    const asli = stockMoves.filter((m) => m.sourceId === transfer.id && !m.reversalOfId);
    // Harga satuan efektif, supaya stok yang kembali tidak masuk dengan harga nol.
    const costs = effectiveCosts(stockMoves);
    // M2: pembalik bertanggal sama bila periodenya masih terbuka.
    const tanggal = periodLocked(transfer.date) ? TODAY : transfer.date;
    postStock({
      moves: asli.map((m) => reverseMove(m, tanggal, by, costs.get(m.id))),
      updateTransfer: { id: transfer.id, status: 'cancelled' },
    });
    setCancelFor(null);
    toast(`${transfer.no} dibatalkan`, { body: 'Stok kembali ke gudang asal.' });
  };

  // --- Stok Opname ----------------------------------------------------------

  // Pemetaan akun yang berlaku sekarang. Dokumen yang sudah diposting memakai
  // salinannya sendiri, jadi perubahan di Pengaturan tidak menyentuh jurnal lama.
  const opnameAccounts = useMemo(
    () => ({ ...defaultOpnameAccounts, ...(companySettings.opnameAccounts ?? {}) }),
    [companySettings.opnameAccounts],
  );

  const patchOpname = (opname, patch, event) =>
    postStock({
      updateOpname: {
        id: opname.id,
        ...patch,
        ...(event ? { history: [...(opname.history ?? []), event] } : null),
      },
    });

  const saveOpname = (form, start) => {
    const id = uid('so');
    const by = picName(pbRole) ?? 'Pengguna';
    const number = nextOpnameNumber(stockOpnames);
    // Draf belum membekukan apa pun; barisnya baru dibentuk saat Mulai hitung (O3).
    const lines = start
      ? buildOpnameLines({
          products,
          moves: stockMoves,
          warehouseId: form.warehouseId,
          date: form.date,
          scope: form.scope,
        })
      : [];
    const now = nowIso();
    const doc = {
      id,
      number,
      ...form,
      status: start ? 'counting' : 'draft',
      accountMap: null,
      lines,
      history: [
        { at: now, by, action: 'created' },
        ...(start ? [{ at: now, by, action: 'started' }] : []),
      ],
      ...(start ? { startedAt: now } : null),
      createdBy: by,
      createdAt: now,
    };
    postStock({ opname: doc });
    const gudang = warehouses.find((w) => w.id === form.warehouseId)?.name ?? 'gudang';
    toast(start ? `Opname ${number} dimulai` : `Draf ${number} disimpan`, {
      body: start ? `${gudang} dibekukan sampai opname selesai.` : 'Saldo buku belum dibekukan.',
    });
    go({ name: 'opname', id });
  };

  const startOpname = (opname) => {
    const lines = buildOpnameLines({
      products,
      moves: stockMoves,
      warehouseId: opname.warehouseId,
      date: opname.date,
      scope: opname.scope,
    });
    const by = picName(pbRole) ?? 'Pengguna';
    patchOpname(
      opname,
      { status: 'counting', lines, startedAt: nowIso() },
      opnameEvent('started', by, null, nowIso()),
    );
    setStartFor(null);
    const gudang = warehouses.find((w) => w.id === opname.warehouseId)?.name ?? 'gudang';
    toast(`Opname ${opname.number} dimulai`, { body: `${gudang} dibekukan.` });
  };

  const patchOpnameLine = (opname, idx, patch) => {
    const lines = (opname.lines ?? []).map((l, i) => {
      if (i !== idx) return l;
      const next = { ...l, ...patch };
      // Arah selisih bisa berbalik saat qty diubah; alasan yang tidak lagi masuk
      // akal dikosongkan daripada ikut terbawa diam-diam.
      const d = next.countedQty == null ? 0 : next.countedQty - next.bookQty;
      if (next.reason && !reasonFitsDiff(next.reason, d)) next.reason = null;
      return next;
    });
    postStock({ updateOpname: { id: opname.id, lines } });
  };

  const addFoundProduct = (opname, productId) => {
    const harga = getAverageCost(stockMoves, productId, opname.date);
    postStock({
      updateOpname: {
        id: opname.id,
        lines: [...(opname.lines ?? []), foundLine(productId, harga)],
      },
    });
  };

  const submitOpname = (opname) => {
    patchOpname(
      opname,
      { status: 'pending_approval' },
      opnameEvent('submitted', picName(pbRole) ?? 'Pengguna', null, nowIso()),
    );
    setSubmitFor(null);
    toast('Opname dikirim ke Building Manager', {
      body: `${opname.number} menunggu persetujuan ${personLabel(TRANSFER_APPROVER)}.`,
    });
  };

  const approveOpname = (opname) => {
    const by = picName(pbRole) ?? 'Pengguna';
    const moves = postOpname(opname, { accountMap: opnameAccounts, by });
    postStock({
      moves,
      updateOpname: {
        id: opname.id,
        status: 'posted',
        // Akun dikunci di dokumen DAN di mutasinya, supaya keduanya tetap cocok
        // walau pemetaannya diubah nanti.
        accountMap: opnameAccounts,
        postedAt: nowIso(),
        history: [...(opname.history ?? []), opnameEvent('approved', by, null, nowIso())],
      },
    });
    setApproveFor(null);
    toast(`Opname ${opname.number} diposting`, {
      body: `${moves.length} mutasi penyesuaian dibuat.`,
    });
  };

  const rejectOpname = (opname, reason) => {
    const by = picName(pbRole) ?? 'Pengguna';
    patchOpname(opname, { status: 'counting' }, opnameEvent('rejected', by, reason, nowIso()));
    setRejectOpnameFor(null);
    toast(`Opname ${opname.number} ditolak`, { body: 'Dokumen dikembalikan ke petugas.' });
  };

  const cancelOpname = (opname, reason) => {
    const by = picName(pbRole) ?? 'Pengguna';
    if (opname.status !== 'posted') {
      patchOpname(
        opname,
        { status: 'cancelled', cancelledAt: nowIso() },
        opnameEvent('cancelled', by, reason, nowIso()),
      );
      setCancelOpnameFor(null);
      toast(`Opname ${opname.number} dibatalkan`, { body: 'Belum ada mutasi yang perlu dibalik.' });
      return;
    }
    const costs = effectiveCosts(stockMoves);
    const tanggal = periodLocked(opname.date) ? TODAY : opname.date;
    const moves = reverseOpname(opname, stockMoves, { date: tanggal, by, costs });
    postStock({
      moves,
      updateOpname: {
        id: opname.id,
        status: 'cancelled',
        cancelledAt: nowIso(),
        cancelReason: reason || null,
        // Alasannya ikut ke Riwayat, bukan hanya ke toast yang langsung hilang.
        history: [...(opname.history ?? []), opnameEvent('cancelled', by, reason, nowIso())],
      },
    });
    setCancelOpnameFor(null);
    toast(`Opname ${opname.number} dibatalkan`, {
      body: `${moves.length} mutasi pembalik dicatat.`,
    });
  };

  // Tautan solusi pada dialog blokir nonaktif.
  const solve = (b) => {
    const w = deactivate?.warehouse;
    setDeactivate(null);
    if (b.action === 'pindah') {
      // Semua produk yang masih bersisa ikut terisi dengan qty penuh.
      go({ name: 'transfer-new', warehouseId: w?.id, fill: 'all' });
      return;
    }
    if (b.action === 'opname') {
      go({ name: 'tab', tab: 'opname' });
      return;
    }
    if (b.action === 'po') {
      window.location.hash = '#pembelian/tab/orders';
      return;
    }
    go({ name: 'tab', tab: 'warehouses' });
  };

  const dialogs = (
    <>
      <WarehouseForm
        opened={!!drawer}
        warehouse={drawer?.warehouse ?? null}
        warehouses={warehouses}
        locked={!!drawer?.warehouse && hasTransactions(drawer.warehouse.id, ctx)}
        onClose={() => setDrawer(null)}
        onSave={save}
      />
      <MakeDefaultDialog
        warehouse={makeDefault}
        current={warehouses.find((w) => w.isDefault)}
        onClose={() => setMakeDefault(null)}
        onConfirm={applyDefault}
      />
      <DeactivateDialog
        warehouse={deactivate?.warehouse}
        blockers={deactivate?.blockers ?? []}
        showValue={showValue}
        onClose={() => setDeactivate(null)}
        onConfirm={applyDeactivate}
        onSolve={solve}
      />
      <DeleteDialog warehouse={remove} onClose={() => setRemove(null)} onConfirm={applyDelete} />
      <ReasonModal
        opened={!!rejectFor}
        onClose={() => setRejectFor(null)}
        title={`Tolak ${rejectFor?.no ?? ''}?`}
        label="Alasan penolakan"
        confirmLabel="Tolak pindah barang"
        onConfirm={(reason) => rejectTransfer(rejectFor, reason)}
      />
      <CancelTransferDialog
        transfer={cancelFor}
        warehouseName={
          warehouses.find((w) => w.id === cancelFor?.fromWarehouseId)?.name ?? 'gudang asal'
        }
        posted={!!cancelFor && cancelFor.status === 'disetujui'}
        onClose={() => setCancelFor(null)}
        onConfirm={() => cancelTransfer(cancelFor)}
      />
      <StartOpnameDialog
        opname={startFor}
        warehouseName={warehouses.find((w) => w.id === startFor?.warehouseId)?.name ?? 'gudang ini'}
        count={
          startFor
            ? buildOpnameLines({
                products,
                moves: stockMoves,
                warehouseId: startFor.warehouseId,
                date: startFor.date,
                scope: startFor.scope,
              }).length
            : 0
        }
        onClose={() => setStartFor(null)}
        onConfirm={() => startOpname(startFor)}
      />
      <SubmitOpnameDialog
        opname={submitFor}
        summary={submitFor ? opnameSummary(submitFor) : null}
        showValue={showValue}
        onClose={() => setSubmitFor(null)}
        onConfirm={() => submitOpname(submitFor)}
      />
      <ApproveOpnameDialog
        opname={approveFor}
        summary={approveFor ? opnameSummary(approveFor) : null}
        showValue={showValue || canApproveTransfer(pbRole)}
        moveCount={approveFor ? opnameSummary(approveFor).diffCount : 0}
        blockers={
          approveFor
            ? postBlockers(approveFor, {
                products,
                accountMap: opnameAccounts,
                periodLocked,
                monthLabel,
              })
            : []
        }
        onClose={() => setApproveFor(null)}
        onConfirm={() => approveOpname(approveFor)}
      />
      <ReasonModal
        opened={!!rejectOpnameFor}
        onClose={() => setRejectOpnameFor(null)}
        title={`Tolak ${rejectOpnameFor?.number ?? ''}?`}
        label="Alasan penolakan"
        confirmLabel="Tolak opname"
        onConfirm={(reason) => rejectOpname(rejectOpnameFor, reason)}
      />
      <CancelOpnameDialog
        opname={cancelOpnameFor}
        warehouseName={
          warehouses.find((w) => w.id === cancelOpnameFor?.warehouseId)?.name ?? 'gudang ini'
        }
        moveCount={
          cancelOpnameFor
            ? stockMoves.filter(
                (m) => m.sourceType === 'stock_opname' && m.sourceId === cancelOpnameFor.id && !m.reversalOfId,
              ).length
            : 0
        }
        blockers={
          cancelOpnameFor && cancelOpnameFor.status === 'posted'
            ? reverseBlockers(
                cancelOpnameFor,
                stockMoves,
                products,
                periodLocked(cancelOpnameFor.date) ? TODAY : cancelOpnameFor.date,
              )
            : []
        }
        onClose={() => setCancelOpnameFor(null)}
        onConfirm={(reason) => cancelOpname(cancelOpnameFor, reason)}
      />
      <MinStockDialog
        row={minStock?.row}
        warehouse={minStock?.warehouse}
        unit={
          minStock
            ? unitName(
                productUnits,
                minStock.row.product.baseUnitId ?? minStock.row.product.buyUnitId,
              )
            : ''
        }
        onClose={() => setMinStock(null)}
        onSave={saveMinStock}
      />
    </>
  );

  const openCard = (productId, warehouseId) =>
    go({ name: 'card', productId, warehouseId: warehouseId ?? scope.warehouseId ?? 'all' });

  // No. dokumen membuka dokumen asalnya. Mutasi data contoh yang dokumennya memang
  // tidak ada (mis. saldo awal) diarahkan ke kartu stok produknya.
  const openSource = (m) => {
    if (m.sourceType === 'stock_transfer' && stockTransfers.some((t) => t.id === m.sourceId))
      return go({ name: 'transfer', id: m.sourceId });
    if (m.sourceType === 'stock_opname' && stockOpnames.some((o) => o.id === m.sourceId))
      return go({ name: 'opname', id: m.sourceId });
    if (m.sourceType === 'goods_receipt' && pb.receipts.some((r) => r.id === m.sourceId)) {
      window.location.hash = `#pembelian/receipt/${m.sourceId}`;
      return undefined;
    }
    return openCard(m.productId, m.warehouseId);
  };

  if (route.view.name === 'journal') {
    // Mutasi diambil lewat listMoves supaya harga & nilainya sudah terhitung.
    const move = listMoves(stockMoves).find((m) => m.id === route.filter.moveId);
    const kembali = () => {
      patchScope({ view: 'riwayat' });
      go({ name: 'tab', tab: 'moves' });
    };
    return (
      <>
        {move ? (
          <MoveJournal
            move={move}
            data={data}
            onBack={kembali}
            onOpenSource={openSource}
            onOpenCard={openCard}
          />
        ) : (
          // Tanpa ini, mutasi yang tidak ditemukan membuat halaman diam-diam kembali
          // ke daftar — terbaca seolah tombolnya tidak berfungsi.
          <Stack gap="lg" p="lg" maw={1440} mx="auto">
            <BackLink label="Kembali ke riwayat mutasi" onClick={kembali} />
            <Card withBorder radius="lg" padding={0} bg="white">
              <EmptyState
                icon={Warning}
                title="Mutasi tidak ditemukan"
                text="Mutasi ini mungkin sudah tidak ada setelah data persediaan dimuat ulang."
                actions={
                  <Button variant="default" radius="md" onClick={kembali}>
                    Kembali ke riwayat mutasi
                  </Button>
                }
              />
            </Card>
          </Stack>
        )}
        {dialogs}
      </>
    );
  }

  if (route.view.name === 'card') {
    const productId = route.filter.productId ?? data.products.find((p) => p.tracked)?.id;
    return (
      <>
        <StockCard
          data={data}
          productId={productId}
          warehouseId={route.filter.warehouseId ?? 'all'}
          showValue={showValue}
          backLabel="Kembali ke mutasi stok"
          onBack={() => go({ name: 'tab', tab: 'moves' })}
          onScope={(patch) => go({ name: 'card', productId, warehouseId: patch.warehouseId })}
          onOpenSource={openSource}
        />
        {dialogs}
      </>
    );
  }

  if (route.view.name === 'transfer-new') {
    const asal = route.filter.warehouseId ?? null;
    // Dipanggil dari dialog blokir nonaktif: semua sisa stok langsung dimasukkan.
    const preset =
      route.filter.fill === 'all' && asal
        ? {
            fromWarehouseId: asal,
            lines: balanceRows(data, { warehouseId: asal, asOf: TODAY })
              .filter((r) => r.qty > 0)
              .map((r) => ({ key: r.productId, productId: r.productId, qty: r.qty })),
            notes: 'Pengosongan gudang sebelum dinonaktifkan.',
          }
        : { fromWarehouseId: asal };
    return (
      <>
        <TransferForm
          data={data}
          preset={preset}
          onCancel={() => go({ name: 'tab', tab: 'moves' })}
          onSave={saveTransfer}
        />
        {dialogs}
      </>
    );
  }

  if (route.view.name === 'transfer') {
    const transfer = stockTransfers.find((t) => t.id === route.view.id);
    if (transfer)
      return (
        <>
          <TransferDetail
            transfer={transfer}
            data={data}
            showValue={showValue}
            canApprove={canApproveTransfer(pbRole)}
            approverLabel={personLabel(TRANSFER_APPROVER)}
            onBack={() => go({ name: 'tab', tab: 'moves' })}
            onApprove={() => approveTransfer(transfer)}
            onReject={() => setRejectFor(transfer)}
            onCancelTransfer={() => setCancelFor(transfer)}
            onOpenCard={(productId) => openCard(productId, 'all')}
          />
          {dialogs}
        </>
      );
  }

  if (route.tab === 'moves')
    return (
      <>
        <MutasiStok
          data={data}
          showValue={showValue}
          scope={scope}
          onScope={patchScope}
          onOpenCard={openCard}
          onNewTransfer={() => go({ name: 'transfer-new' })}
          onOpenSource={openSource}
          onOpenJournal={(m) => go({ name: 'journal', moveId: m.id })}
          onOpenTransfer={(t) => go({ name: 'transfer', id: t.id })}
          pendingCount={stockTransfers.filter((t) => t.status === 'menunggu').length}
        />
        {dialogs}
      </>
    );

  if (route.tab === 'opname') {
    if (route.view.name === 'opname-new')
      return (
        <>
          <OpnameForm
            data={data}
            opnames={stockOpnames}
            preset={{ warehouseId: route.filter?.warehouseId ?? null }}
            onCancel={() => go({ name: 'tab', tab: 'opname' })}
            onSave={saveOpname}
          />
          {dialogs}
        </>
      );

    const opname = stockOpnames.find((o) => o.id === route.view.id);
    if (route.view.name === 'opname' && opname)
      return (
        <>
          <OpnameDetail
            opname={opname}
            data={data}
            moves={listMoves(stockMoves)}
            accountMap={opnameAccounts}
            // O13: harga & nilai mengikuti hak lihat nilai, tetapi approver
            // tetap perlu melihatnya — ia tidak bisa menyetujui angka yang
            // tidak ia lihat.
            showValue={showValue || canApproveTransfer(pbRole)}
            // Blind count hanya berlaku untuk yang menghitung (prinsip 1),
            // bukan untuk semua peran yang tidak boleh melihat nilai.
            blind={pbRole === 'gudang'}
            canCount={['gudang', 'accounting', 'superadmin'].includes(pbRole)}
            canReview={['accounting', 'superadmin'].includes(pbRole)}
            canApprove={canApproveTransfer(pbRole)}
            approverLabel={personLabel(TRANSFER_APPROVER)}
            onBack={() => go({ name: 'tab', tab: 'opname' })}
            onStart={() => setStartFor(opname)}
            onPatchLine={(idx, patch) => patchOpnameLine(opname, idx, patch)}
            onAddFound={(productId) => addFoundProduct(opname, productId)}
            onSubmit={() => setSubmitFor(opname)}
            onApprove={() => setApproveFor(opname)}
            onReject={() => setRejectOpnameFor(opname)}
            onCancel={() => setCancelOpnameFor(opname)}
            onOpenJournal={(m) => go({ name: 'journal', moveId: m.id })}
            onOpenCard={(productId) => openCard(productId, opname.warehouseId)}
          />
          {dialogs}
        </>
      );

    return (
      <>
        <OpnameList
          data={data}
          opnames={stockOpnames}
          showValue={showValue}
          onOpen={(o) => go({ name: 'opname', id: o.id })}
          onNew={() => go({ name: 'opname-new' })}
        />
        {dialogs}
      </>
    );
  }

  const selected = warehouses.find((w) => w.id === route.view.id);
  if (route.view.name === 'detail' && selected) {
    const s = summary(selected);
    return (
      <>
        <WarehouseDetail
          warehouse={selected}
          data={data}
          logs={warehouseLogs}
          showValue={showValue}
          canDelete={s.deletable}
          onBack={() => go({ name: 'tab', tab: 'warehouses' })}
          onEdit={() => setDrawer({ warehouse: selected })}
          onMakeDefault={() => setMakeDefault(selected)}
          onDeactivate={() => askDeactivate(selected)}
          onActivate={() => activate(selected)}
          onDelete={() => setRemove(selected)}
          // Pindah barang dari detail gudang: gudang asalnya sudah terisi.
          onTransfer={() => go({ name: 'transfer-new', warehouseId: selected.id })}
          onNewOpname={() => go({ name: 'opname-new', warehouseId: selected.id })}
          onOpenOpname={(o) => go({ name: 'opname', id: o.id })}
          onOpenCard={(productId) => openCard(productId, selected.id)}
          onSetMin={(row) => setMinStock({ row, warehouse: selected })}
          onOpenMoves={() => {
            patchScope({ warehouseId: selected.id, view: 'riwayat' });
            go({ name: 'tab', tab: 'moves', warehouseId: selected.id });
          }}
        />
        {dialogs}
      </>
    );
  }

  return (
    <>
      <WarehouseList
        warehouses={warehouses}
        summary={summary}
        totalItems={distinctItemCount(
          balanceRows(
            { ...data, warehouses: warehouses.filter((w) => w.status === 'active') },
            { warehouseId: 'all', asOf: TODAY },
          ),
        )}
        showValue={showValue}
        onOpen={(w) => go({ name: 'detail', id: w.id })}
        onAdd={() => setDrawer({ warehouse: null })}
        onEdit={(w) => setDrawer({ warehouse: w })}
        onMakeDefault={setMakeDefault}
        onDeactivate={askDeactivate}
        onActivate={activate}
        onDelete={setRemove}
      />
      {dialogs}
    </>
  );
}
