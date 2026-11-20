// Buku besar persediaan — SATU-SATUNYA sumber angka stok di aplikasi.
//
// Tidak ada saldo yang disimpan sebagai angka lepas: qty, nilai, dan harga rata-rata
// selalu dihitung ulang dari kumpulan mutasi di sini. Menu Gudang, Mutasi Stok,
// Produk, dan (nanti) Stok Opname semuanya memanggil fungsi di berkas ini, supaya
// tidak mungkin ada dua angka yang berbeda untuk hal yang sama.
//
// Mutasi tidak pernah diinput manual: tiap baris lahir dari dokumen (saldo awal,
// penerimaan, pengeluaran, pindah barang, faktur/retur, opname). Mutasi juga tidak
// bisa diubah atau dihapus — pembatalan dokumen menghasilkan mutasi pembalik.

export const MOVE_TYPE = {
  opening: { label: 'Saldo awal', color: 'slate', dir: 'in', doc: 'SA' },
  receipt: { label: 'Penerimaan barang', color: 'green', dir: 'in', doc: 'FPB' },
  purchase_return: { label: 'Retur pembelian', color: 'red', dir: 'out', doc: 'RB' },
  issue: { label: 'Pengeluaran', color: 'orange', dir: 'out', doc: 'PB' },
  sale: { label: 'Penjualan', color: 'orange', dir: 'out', doc: 'FJ' },
  sale_return: { label: 'Retur penjualan', color: 'green', dir: 'in', doc: 'RJ' },
  transfer_out: { label: 'Pindah keluar', color: 'primary', dir: 'out', doc: 'PDH' },
  transfer_in: { label: 'Pindah masuk', color: 'primary', dir: 'in', doc: 'PDH' },
  opname_gain: { label: 'Opname lebih', color: 'yellow', dir: 'in', doc: 'SO' },
  opname_loss: { label: 'Opname kurang', color: 'yellow', dir: 'out', doc: 'SO' },
};

export const moveTypeOptions = Object.entries(MOVE_TYPE).map(([value, t]) => ({
  value,
  label: t.label,
}));

// ---------------------------------------------------------------------------
// Data awal
// ---------------------------------------------------------------------------

const mv = (id, date, sourceNo, type, productId, warehouseId, qty, unitCost, extra = {}) => {
  const masuk = MOVE_TYPE[type].dir === 'in';
  return {
    id,
    date,
    // Urutan dalam tanggal yang sama (M7). Dibuat berurutan mengikuti id seed.
    postedAt: `${date}T${String(8 + (Number(id.replace(/\D/g, '')) % 8)).padStart(2, '0')}:00:00.000Z`,
    type,
    productId,
    warehouseId,
    qtyIn: masuk ? qty : 0,
    qtyOut: masuk ? 0 : qty,
    unitCost,
    sourceNo,
    createdBy: 'Admin Sistem',
    ...extra,
  };
};

// Saldo berjalan tiap produk sengaja dibuat nyambung; lihat tabel di spesifikasi.
export const stockMovesSeed = [
  mv('mv-01', '2026-01-05', 'SA/2026/01/0001', 'opening', 'kertas-a4', 'wh-1', 40, 56000, { sourceType: 'stock_opening', sourceId: 'sa-1' }),
  mv('mv-02', '2026-01-05', 'SA/2026/01/0001', 'opening', 'map-plastik', 'wh-1', 150, 3500, { sourceType: 'stock_opening', sourceId: 'sa-1' }),
  mv('mv-03', '2026-01-05', 'SA/2026/01/0001', 'opening', 'kain-pel', 'wh-4', 20, 22500, { sourceType: 'stock_opening', sourceId: 'sa-1' }),
  mv('mv-04', '2026-07-08', 'FPB/2026/07/0019', 'receipt', 'kertas-a4', 'wh-1', 40, 56000, { sourceType: 'goods_receipt', sourceId: 'gr-19' }),
  mv('mv-05', '2026-08-05', 'FPB/2026/08/0024', 'receipt', 'map-plastik', 'wh-1', 100, 3500, { sourceType: 'goods_receipt', sourceId: 'gr-24' }),
  mv('mv-06', '2026-09-14', 'FPB/2026/09/0028', 'receipt', 'kertas-a4', 'wh-1', 50, 56000, { sourceType: 'goods_receipt', sourceId: 'gr-28' }),
  mv('mv-07', '2026-09-30', 'PB/2026/09/0004', 'issue', 'kertas-a4', 'wh-1', 45, 0, { sourceType: 'stock_issue', sourceId: 'iss-4' }),
  mv('mv-08', '2026-10-02', 'PDH/2026/10/0003', 'transfer_out', 'kain-pel', 'wh-4', 20, 0, { sourceType: 'stock_transfer', sourceId: 'tr-0003' }),
  mv('mv-09', '2026-10-02', 'PDH/2026/10/0003', 'transfer_in', 'kain-pel', 'wh-1', 20, 22500, { sourceType: 'stock_transfer', sourceId: 'tr-0003' }),
  mv('mv-10', '2026-10-15', 'PB/2026/10/0006', 'issue', 'map-plastik', 'wh-1', 50, 0, { sourceType: 'stock_issue', sourceId: 'iss-6' }),
  mv('mv-11', '2026-10-16', 'PB/2026/10/0007', 'issue', 'kertas-a4', 'wh-1', 25, 0, { sourceType: 'stock_issue', sourceId: 'iss-7' }),
  mv('mv-12', '2026-10-20', 'FPB/2026/10/0037', 'receipt', 'pipa-pvc', 'wh-1', 64, 65000, { sourceType: 'goods_receipt', sourceId: 'gr-37' }),
  mv('mv-13', '2026-10-22', 'FPB/2026/10/0038', 'receipt', 'elbow-pvc', 'wh-1', 60, 6500, { sourceType: 'goods_receipt', sourceId: 'gr-38' }),
  mv('mv-14', '2026-10-28', 'PB/2026/10/0009', 'issue', 'elbow-pvc', 'wh-1', 35, 0, { sourceType: 'stock_issue', sourceId: 'iss-9' }),
  mv('mv-15', '2026-10-30', 'FPB/2026/10/0041', 'receipt', 'cairan-lantai', 'wh-1', 14, 85000, { sourceType: 'goods_receipt', sourceId: 'gr-41' }),
  mv('mv-16', '2026-10-31', 'FPB/2026/10/0042', 'receipt', 'kain-pel', 'wh-1', 11, 22500, { sourceType: 'goods_receipt', sourceId: 'gr-42' }),
  mv('mv-17', '2026-11-02', 'PDH/2026/11/0001', 'transfer_out', 'kertas-a4', 'wh-1', 10, 0, { sourceType: 'stock_transfer', sourceId: 'tr-0001' }),
  mv('mv-18', '2026-11-02', 'PDH/2026/11/0001', 'transfer_in', 'kertas-a4', 'wh-2', 10, 56000, { sourceType: 'stock_transfer', sourceId: 'tr-0001' }),
  mv('mv-19', '2026-11-03', 'FPB/2026/11/0002', 'receipt', 'tinta-printer', 'wh-1', 9, 185000, { sourceType: 'goods_receipt', sourceId: 'gr-2' }),
];

/**
 * Status dokumen Pindah Barang. Stok TIDAK langsung berpindah saat dokumen
 * disimpan: ia menunggu persetujuan Building Manager dulu. Mutasi baru dibuat
 * pada saat disetujui, jadi dokumen yang menunggu atau ditolak tidak pernah
 * menyentuh saldo.
 */
export const TRANSFER_STATUS = {
  menunggu: { label: 'Menunggu approval', color: 'orange' },
  disetujui: { label: 'Selesai', color: 'green' },
  ditolak: { label: 'Ditolak', color: 'red' },
  cancelled: { label: 'Dibatalkan', color: 'slate' },
};

/** Peran yang berhak menyetujui pindah barang. */
export const TRANSFER_APPROVER = 'bm';
export const canApproveTransfer = (role) => role === TRANSFER_APPROVER || role === 'superadmin';

export const stockTransfersSeed = [
  {
    id: 'tr-0003',
    no: 'PDH/2026/10/0003',
    date: '2026-10-02',
    fromWarehouseId: 'wh-4',
    toWarehouseId: 'wh-1',
    lines: [{ productId: 'kain-pel', qty: 20 }],
    notes: 'Pengosongan gudang Bekasi.',
    status: 'disetujui',
    createdBy: 'Rudi Hermawan',
    createdAt: '2026-10-02T04:00:00.000Z',
    approvedBy: 'Budi Hartono',
    approvedAt: '2026-10-02T06:00:00.000Z',
  },
  {
    id: 'tr-0001',
    no: 'PDH/2026/11/0001',
    date: '2026-11-02',
    fromWarehouseId: 'wh-1',
    toWarehouseId: 'wh-2',
    lines: [{ productId: 'kertas-a4', qty: 10 }],
    notes: 'Stok penyangga lantai 2.',
    status: 'disetujui',
    createdBy: 'Rudi Hermawan',
    createdAt: '2026-11-02T04:00:00.000Z',
    approvedBy: 'Budi Hartono',
    approvedAt: '2026-11-02T06:00:00.000Z',
  },
];

// Stok minimum per produk per gudang. Ini SATU-SATUNYA angka stok yang disimpan,
// karena ia pengaturan, bukan hasil transaksi.
export const stockMinimumsSeed = [
  { productId: 'kertas-a4', warehouseId: 'wh-1', minQty: 20 },
  { productId: 'map-plastik', warehouseId: 'wh-1', minQty: 250 },
  { productId: 'tinta-printer', warehouseId: 'wh-1', minQty: 4 },
  { productId: 'pipa-pvc', warehouseId: 'wh-1', minQty: 20 },
  { productId: 'elbow-pvc', warehouseId: 'wh-1', minQty: 40 },
  { productId: 'cairan-lantai', warehouseId: 'wh-1', minQty: 6 },
  { productId: 'kain-pel', warehouseId: 'wh-1', minQty: 20 },
  { productId: 'kertas-a4', warehouseId: 'wh-2', minQty: 0 },
  { productId: 'kain-pel', warehouseId: 'wh-4', minQty: 0 },
];

export const stockOpnamesSeed = [
  { id: 'so-1', number: 'SO/2026/11/003', warehouseId: 'wh-1', date: '2026-11-03', status: 'berjalan' },
];

// ---------------------------------------------------------------------------
// Urutan (M7): tanggal dokumen, lalu waktu posting
// ---------------------------------------------------------------------------

const cmp = (a, b) =>
  a.date !== b.date
    ? a.date < b.date
      ? -1
      : 1
    : a.postedAt !== b.postedAt
      ? a.postedAt < b.postedAt
        ? -1
        : 1
      : String(a.id).localeCompare(String(b.id));

export const sortMoves = (moves) => [...moves].sort(cmp);
export const sortMovesDesc = (moves) => [...moves].sort((a, b) => -cmp(a, b));

const inScope = (m, warehouseId) => warehouseId === 'all' || m.warehouseId === warehouseId;
const upTo = (m, asOf) => !asOf || m.date <= asOf;

// ---------------------------------------------------------------------------
// Buku besar per produk — dasar semua perhitungan nilai
// ---------------------------------------------------------------------------

/**
 * Jalankan seluruh mutasi satu produk secara berurutan dan hitung rata-rata
 * tertimbang bergerak (M4). Rata-rata digabung lintas gudang, sehingga pindah
 * barang tidak mengubah nilai persediaan (M6).
 *
 * @returns baris { move, unitCost, avg, qtyAll, valueAll } urut lama → baru
 */
export function productLedger(moves, productId) {
  let qty = 0;
  let value = 0;
  return sortMoves(moves.filter((m) => m.productId === productId)).map((move) => {
    let unitCost = Number(move.unitCost) || 0;
    if (move.qtyOut > 0) {
      // Harga keluar = rata-rata saat mutasi itu terjadi (M6).
      unitCost = qty > 0 ? value / qty : unitCost;
      qty -= move.qtyOut;
      value -= move.qtyOut * unitCost;
    } else {
      qty += move.qtyIn;
      value += move.qtyIn * unitCost;
    }
    // Jaga-jaga pembulatan: saldo nol berarti nilainya nol.
    if (qty <= 0) {
      qty = Math.max(0, qty);
      value = qty === 0 ? 0 : value;
    }
    return { move, unitCost, avg: qty > 0 ? value / qty : unitCost, qtyAll: qty, valueAll: value };
  });
}

/** Harga rata-rata satu produk pada tanggal tertentu (gabungan semua gudang). */
export function getAverageCost(moves, productId, asOf) {
  const rows = productLedger(moves, productId).filter((r) => upTo(r.move, asOf));
  const last = rows[rows.length - 1];
  return last ? last.avg : 0;
}

/** Qty satu produk pada satu gudang (atau 'all') sampai tanggal tertentu. */
export function getBalance(moves, productId, warehouseId = 'all', asOf) {
  return moves.reduce(
    (n, m) =>
      m.productId === productId && inScope(m, warehouseId) && upTo(m, asOf)
        ? n + m.qtyIn - m.qtyOut
        : n,
    0,
  );
}

/**
 * M3: boleh mengeluarkan qty ini? Saldo pada tanggal itu DAN semua saldo
 * sesudahnya tidak boleh jadi negatif — jadi dokumen bertanggal mundur ikut dicek.
 */
export function canIssue(moves, productId, warehouseId, date, qty) {
  const scoped = sortMoves(
    moves.filter((m) => m.productId === productId && m.warehouseId === warehouseId),
  );
  const available = getBalance(moves, productId, warehouseId, date);
  if (qty > available) return { ok: false, available };
  // Telusuri saldo sesudah tanggal itu; pengurangan hari ini menggeser semuanya.
  let running = available - qty;
  let min = running;
  scoped
    .filter((m) => m.date > date)
    .forEach((m) => {
      running += m.qtyIn - m.qtyOut;
      min = Math.min(min, running);
    });
  if (min < 0) return { ok: false, available: available + min, afterwards: true };
  return { ok: true, available };
}

/** Nilai persediaan satu gudang (atau 'all') pada tanggal tertentu. */
export function getInventoryValue(moves, products, warehouseId = 'all', asOf) {
  const tracked = products.filter((p) => p.tracked);
  return tracked.reduce((total, p) => {
    const qty = getBalance(moves, p.id, warehouseId, asOf);
    return qty > 0 ? total + qty * getAverageCost(moves, p.id, asOf) : total;
  }, 0);
}

// ---------------------------------------------------------------------------
// Saldo stok (dipakai tab Saldo stok, tab Stok di Gudang, dan detail produk)
// ---------------------------------------------------------------------------

export const STOCK_STATUS = {
  habis: { label: 'Habis', color: 'red' },
  minimum: { label: 'Di bawah minimum', color: 'orange' },
  aman: { label: 'Aman', color: 'green' },
};

export function stockStatusOf(row) {
  if (!row.qty) return 'habis';
  if (row.minQty > 0 && row.qty < row.minQty) return 'minimum';
  return 'aman';
}

export const minQtyOf = (minimums, productId, warehouseId) =>
  minimums.find((b) => b.productId === productId && b.warehouseId === warehouseId)?.minQty ?? 0;

/**
 * Baris saldo stok. `warehouseId` boleh id gudang atau 'all'.
 * Hanya produk dengan Lacak stok = ya yang muncul (M12).
 */
export function balanceRows(
  { moves, minimums = [], products, warehouses = [] },
  { warehouseId = 'all', asOf, productId = null } = {},
) {
  const tracked = products.filter((p) => p.tracked && (!productId || p.id === productId));
  const scopes = warehouseId === 'all' ? warehouses.map((w) => w.id) : [warehouseId];
  return tracked
    .map((product) => {
      const perWarehouse = Object.fromEntries(
        scopes.map((id) => [id, getBalance(moves, product.id, id, asOf)]),
      );
      const qty = warehouseId === 'all'
        ? Object.values(perWarehouse).reduce((n, v) => n + v, 0)
        : perWarehouse[warehouseId] ?? 0;
      const avg = getAverageCost(moves, product.id, asOf);
      return {
        product,
        productId: product.id,
        warehouseId,
        perWarehouse,
        qty,
        minQty: warehouseId === 'all' ? 0 : minQtyOf(minimums, product.id, warehouseId),
        avg,
        value: qty * avg,
      };
    })
    // Produk yang belum pernah punya mutasi di lingkup ini tidak perlu ditampilkan,
    // kecuali stok minimumnya memang diatur di gudang itu.
    .filter((r) => r.qty !== 0 || r.minQty > 0);
}

/**
 * Kolom gudang untuk tampilan matriks: gudang aktif, DITAMBAH gudang nonaktif yang
 * pada tanggal itu masih menyimpan stok. Tanpa ini, stok di gudang yang sudah
 * dinonaktifkan hilang dari tabel padahal tetap dihitung di nilai persediaan.
 */
export function warehouseColumns({ moves, products, warehouses }, asOf) {
  const tracked = products.filter((p) => p.tracked);
  return warehouses.filter(
    (w) =>
      w.status === 'active' ||
      tracked.some((p) => getBalance(moves, p.id, w.id, asOf) > 0),
  );
}

/**
 * Saldo satu produk dipecah per gudang — dipakai bagian "Stok per gudang" di
 * detail produk, lengkap dengan stok minimum dan statusnya.
 */
export function productWarehouseRows({ moves, minimums = [], warehouses }, product, asOf) {
  return warehouses
    .map((w) => {
      const qty = getBalance(moves, product.id, w.id, asOf);
      const minQty = minQtyOf(minimums, product.id, w.id);
      return { warehouse: w, qty, minQty, avg: getAverageCost(moves, product.id, asOf) };
    })
    .filter((r) => r.qty !== 0 || r.minQty > 0)
    .map((r) => ({ ...r, value: r.qty * r.avg }));
}

/** Jumlah produk BERBEDA yang punya stok — bukan penjumlahan per gudang. */
export const distinctItemCount = (rows) => rows.filter((r) => r.qty > 0).length;
export const belowMinimumCount = (rows) => rows.filter((r) => stockStatusOf(r) !== 'aman').length;
export const sumValue = (rows) => rows.reduce((n, r) => n + r.value, 0);

// ---------------------------------------------------------------------------
// Riwayat mutasi & kartu stok
// ---------------------------------------------------------------------------

/** Riwayat mutasi terurut terbaru dulu, dengan harga & nilai per baris. */
export function listMoves(moves, filter = {}) {
  const { warehouseId = 'all', productId = null, types = [], from, to, query = '' } = filter;
  const q = query.trim().toLowerCase();
  // Harga tiap baris diambil dari buku besar produknya supaya harga keluar benar.
  const priced = new Map();
  [...new Set(moves.map((m) => m.productId))].forEach((id) => {
    productLedger(moves, id).forEach((r) => priced.set(r.move.id, r));
  });
  return sortMovesDesc(
    moves.filter(
      (m) =>
        inScope(m, warehouseId) &&
        (!productId || m.productId === productId) &&
        (!types.length || types.includes(m.type)) &&
        (!from || m.date >= from) &&
        (!to || m.date <= to) &&
        (!q || m.sourceNo.toLowerCase().includes(q)),
    ),
  ).map((m) => ({
    ...m,
    unit: priced.get(m.id)?.unitCost ?? m.unitCost ?? 0,
    amount: (m.qtyIn + m.qtyOut) * (priced.get(m.id)?.unitCost ?? m.unitCost ?? 0),
  }));
}

/**
 * Kartu stok: saldo awal periode, baris berjalan, dan saldo akhir.
 * Saldo qty mengikuti lingkup gudang; nilai memakai harga rata-rata gabungan (M4).
 */
export function getStockCard(moves, productId, warehouseId = 'all', from, to) {
  const ledger = productLedger(moves, productId);
  let qty = 0;
  let value = 0;
  const rows = [];
  let opening = { qty: 0, value: 0 };

  ledger.forEach((r) => {
    const m = r.move;
    if (!inScope(m, warehouseId)) return;
    if (to && m.date > to) return;
    const masuk = m.qtyIn > 0;
    qty += m.qtyIn - m.qtyOut;
    value += (masuk ? m.qtyIn : -m.qtyOut) * r.unitCost;
    if (qty <= 0) value = qty === 0 ? 0 : value;
    if (from && m.date < from) {
      opening = { qty, value };
      return;
    }
    rows.push({ ...m, unitCost: r.unitCost, avg: r.avg, saldoQty: qty, saldoValue: value });
  });

  // Pada lingkup "semua gudang", pindah antar gudang hanya memutar barang yang sama
  // — tidak menambah atau mengurangi persediaan — jadi tidak ikut dijumlah.
  const internal = (r) => warehouseId === 'all' && INTERNAL_TYPES.includes(r.type);
  return {
    opening,
    rows,
    closing: { qty, value },
    masuk: rows.reduce((n, r) => (internal(r) ? n : n + r.qtyIn), 0),
    keluar: rows.reduce((n, r) => (internal(r) ? n : n + r.qtyOut), 0),
  };
}

/** Jenis mutasi yang hanya memindahkan barang di dalam perusahaan. */
export const INTERNAL_TYPES = ['transfer_in', 'transfer_out'];

// ---------------------------------------------------------------------------
// Membuat mutasi dari dokumen
// ---------------------------------------------------------------------------

export const moveId = () => `mv-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Bentuk satu baris mutasi. Dipakai dokumen mana pun yang menggerakkan stok —
 * tidak ada jalan lain untuk menambah stok selain lewat sini.
 */
export const buildMove = ({
  date,
  type,
  productId,
  warehouseId,
  qty,
  unitCost = 0,
  sourceType,
  sourceId,
  sourceNo,
  createdBy = 'Pengguna',
  reversalOfId = null,
}) => {
  const masuk = MOVE_TYPE[type].dir === 'in';
  return {
    id: moveId(),
    date,
    postedAt: new Date().toISOString(),
    type,
    productId,
    warehouseId,
    qtyIn: masuk ? qty : 0,
    qtyOut: masuk ? 0 : qty,
    unitCost,
    sourceType,
    sourceId,
    sourceNo,
    createdBy,
    ...(reversalOfId ? { reversalOfId } : null),
  };
};

/**
 * Harga satuan efektif tiap mutasi: untuk mutasi keluar ini adalah rata-rata saat
 * itu, bukan angka yang tersimpan (yang memang 0). Dipakai saat membalik mutasi,
 * supaya stok yang dikembalikan tidak masuk dengan harga nol dan menyeret
 * rata-ratanya turun.
 */
export function effectiveCosts(moves) {
  const map = new Map();
  [...new Set(moves.map((m) => m.productId))].forEach((id) => {
    productLedger(moves, id).forEach((r) => map.set(r.move.id, r.unitCost));
  });
  return map;
}

/** Mutasi pembalik satu mutasi (M2). Tanggalnya ditentukan pemanggil. */
export const reverseMove = (move, date, createdBy, unitCost) =>
  buildMove({
    date,
    type: flip(move.type),
    productId: move.productId,
    warehouseId: move.warehouseId,
    qty: move.qtyIn > 0 ? move.qtyIn : move.qtyOut,
    unitCost: unitCost ?? move.unitCost,
    sourceType: move.sourceType,
    sourceId: move.sourceId,
    sourceNo: move.sourceNo,
    createdBy,
    reversalOfId: move.id,
  });

// Jenis kebalikan untuk mutasi pembalik.
const FLIP = {
  transfer_in: 'transfer_out',
  transfer_out: 'transfer_in',
  receipt: 'purchase_return',
  purchase_return: 'receipt',
  issue: 'opname_gain',
  opening: 'opname_loss',
  sale: 'sale_return',
  sale_return: 'sale',
  opname_gain: 'opname_loss',
  opname_loss: 'opname_gain',
};
function flip(type) {
  return FLIP[type] ?? type;
}

export const runningOpnameOf = (opnames, warehouseId) =>
  opnames.find((o) => o.warehouseId === warehouseId && o.status === 'berjalan') ?? null;
