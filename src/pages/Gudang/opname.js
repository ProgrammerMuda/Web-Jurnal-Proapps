// Stok Opname: menghitung fisik barang di satu gudang, membandingkannya dengan
// saldo buku, lalu memposting selisihnya sebagai mutasi SO beserta jurnalnya.
//
// Modul ini sengaja murni (tanpa React) supaya aturan hitungnya bisa diuji
// terpisah. Dokumen opname TIDAK menyimpan angka stok sendiri: saldo buku dan
// harga dibekukan sekali saat hitungan dimulai (O3), dan setelah itu semua
// perubahan stok tetap lahir dari mutasi — sama seperti dokumen persediaan lain.
import { buildMove, canIssue, getAverageCost, getBalance, listMoves, reverseMove } from './stock.js';

// ---------------------------------------------------------------------------
// Status & alasan
// ---------------------------------------------------------------------------

export const OPNAME_STATUS = {
  draft: { label: 'Draf', color: 'slate' },
  counting: { label: 'Menghitung', color: 'primary' },
  pending_approval: { label: 'Menunggu persetujuan', color: 'orange' },
  posted: { label: 'Diposting', color: 'green' },
  cancelled: { label: 'Dibatalkan', color: 'red' },
};

export const opnameStatusOptions = Object.entries(OPNAME_STATUS).map(([value, s]) => ({
  value,
  label: s.label,
}));

/** Urutan stepper di detail. Dibatalkan tidak masuk: ia memutus alur, bukan tahap. */
export const OPNAME_STEPS = ['draft', 'counting', 'pending_approval', 'posted'];

/**
 * Alasan selisih. `dir` membatasi alasan mana yang masuk akal untuk arah selisih
 * tertentu (O8): barang hilang tidak mungkin membuat stok bertambah.
 */
export const OPNAME_REASON = {
  rusak: { label: 'Rusak', dir: 'loss' },
  kedaluwarsa: { label: 'Kedaluwarsa', dir: 'loss' },
  hilang: { label: 'Hilang', dir: 'loss' },
  ditemukan: { label: 'Ditemukan', dir: 'gain' },
  salah_catat: { label: 'Salah catat', dir: 'both' },
  lainnya: { label: 'Lainnya', dir: 'both' },
};

export const reasonLabel = (key) => OPNAME_REASON[key]?.label ?? key;

/** Pilihan alasan untuk satu arah selisih. `diff` positif = lebih, negatif = kurang. */
export function reasonOptions(diff) {
  const arah = diff > 0 ? 'gain' : 'loss';
  return Object.entries(OPNAME_REASON)
    .filter(([, r]) => r.dir === 'both' || r.dir === arah)
    .map(([value, r]) => ({ value, label: r.label }));
}

export const reasonFitsDiff = (reason, diff) => {
  const r = OPNAME_REASON[reason];
  if (!r || !diff) return !reason;
  return r.dir === 'both' || r.dir === (diff > 0 ? 'gain' : 'loss');
};

/**
 * Pemetaan alasan → akun selisih (O10). Rusak dan kedaluwarsa adalah susut wajar
 * dari kegiatan operasional; kehilangan harus terlihat terpisah supaya bisa
 * ditindaklanjuti; sisanya koreksi pencatatan.
 */
export const defaultOpnameAccounts = {
  rusak: '6-60006',
  kedaluwarsa: '6-60006',
  hilang: '8-10006',
  salah_catat: '8-10001',
  ditemukan: '8-10001',
  lainnya: '8-10001',
};

// ---------------------------------------------------------------------------
// Pembekuan gudang (O4)
// ---------------------------------------------------------------------------

const RUNNING = ['counting', 'pending_approval'];

/** Opname yang sedang berjalan di satu gudang, atau null. */
export const runningOpnameOf = (opnames, warehouseId) =>
  (opnames ?? []).find((o) => o.warehouseId === warehouseId && RUNNING.includes(o.status)) ?? null;

/**
 * Satu-satunya pintu pengecekan pembekuan. Semua dokumen yang membuat mutasi
 * memanggil ini, bukan menulis ulang aturannya sendiri.
 */
export const isWarehouseFrozen = (opnames, warehouseId) => !!runningOpnameOf(opnames, warehouseId);

/** Pesan baku O4, lengkap dengan nomor opname yang menahannya. */
export function frozenMessage(opnames, warehouseId, warehouseName) {
  const o = runningOpnameOf(opnames, warehouseId);
  if (!o) return null;
  return `${warehouseName} sedang diopname (${o.number}). Selesaikan atau batalkan opname dulu`;
}

/** Opname berjalan yang memuat produk tertentu — dipakai mengunci master produk. */
export const opnameHoldingProduct = (opnames, productId) =>
  (opnames ?? []).find(
    (o) => RUNNING.includes(o.status) && (o.lines ?? []).some((l) => l.productId === productId),
  ) ?? null;

/** Opname terakhir yang sudah diposting di satu gudang. */
export function lastPostedOpname(opnames, warehouseId) {
  return (
    (opnames ?? [])
      .filter((o) => o.status === 'posted' && (!warehouseId || o.warehouseId === warehouseId))
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0] ?? null
  );
}

// ---------------------------------------------------------------------------
// Membentuk baris hitung
// ---------------------------------------------------------------------------

/** Produk yang masuk cakupan, sebelum saldo bukunya dibaca. */
export function productsInScope({ products, moves, warehouseId, scope }) {
  const dilacak = (products ?? []).filter((p) => p.tracked);
  if (scope?.type === 'manual')
    return dilacak.filter((p) => (scope.productIds ?? []).includes(p.id));
  if (scope?.type === 'category')
    return dilacak.filter((p) => (scope.categoryIds ?? []).includes(p.categoryId));
  // "Semua produk di gudang ini" = yang pernah punya mutasi di gudang itu,
  // termasuk yang saldonya sekarang 0 — barang yang habis tetap perlu dibuktikan.
  const pernah = new Set((moves ?? []).filter((m) => m.warehouseId === warehouseId).map((m) => m.productId));
  return dilacak.filter((p) => pernah.has(p.id));
}

/**
 * Baris opname lengkap dengan saldo buku dan harga yang dibekukan (O3/O6).
 * Dipanggil sekali saat Mulai hitung; sesudah itu angkanya tidak dibaca ulang.
 */
export function buildOpnameLines({ products, moves, warehouseId, date, scope }) {
  return productsInScope({ products, moves, warehouseId, scope })
    .map((p) => ({
      productId: p.id,
      bookQty: getBalance(moves, p.id, warehouseId, date),
      countedQty: null,
      unitCost: getAverageCost(moves, p.id, date),
      reason: null,
      note: '',
    }))
    .sort((a, b) => {
      const na = products.find((p) => p.id === a.productId)?.name ?? '';
      const nb = products.find((p) => p.id === b.productId)?.name ?? '';
      return na.localeCompare(nb, 'id');
    });
}

/** Baris untuk barang yang ada di rak tapi tidak masuk daftar: saldo buku 0. */
export const foundLine = (productId, unitCost = 0) => ({
  productId,
  bookQty: 0,
  countedQty: null,
  unitCost,
  reason: 'ditemukan',
  note: '',
  isFound: true,
});

export const diffQty = (line) => (line.countedQty == null ? 0 : line.countedQty - line.bookQty);
export const diffValue = (line) => diffQty(line) * (Number(line.unitCost) || 0);
export const isCounted = (line) => line.countedQty != null && !line.needsRecount;

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------

export function opnameSummary(opname) {
  const lines = opname?.lines ?? [];
  const counted = lines.filter(isCounted);
  const selisih = counted.filter((l) => diffQty(l) !== 0);
  const lebih = selisih.filter((l) => diffQty(l) > 0);
  const kurang = selisih.filter((l) => diffQty(l) < 0);
  const sum = (list, f) => list.reduce((n, l) => n + f(l), 0);
  return {
    total: lines.length,
    counted: counted.length,
    uncounted: lines.length - counted.length,
    diffCount: selisih.length,
    gainQty: sum(lebih, diffQty),
    // `|| 0` menormalkan -0, yang kalau tidak akan tercetak sebagai "-0 unit".
    lossQty: -sum(kurang, diffQty) || 0,
    gainValue: sum(lebih, diffValue),
    lossValue: -sum(kurang, diffValue) || 0,
    netValue: sum(selisih, diffValue),
  };
}

/**
 * Pratinjau jurnal per akun, dipakai sebelum posting maupun sesudahnya. Angkanya
 * harus sama dengan jurnal mutasi yang nanti dibuat — keduanya memakai
 * `accountOfLine` yang sama.
 */
export function journalPreview(opname, accountMap, products) {
  const persediaanOf = (id) =>
    products?.find((p) => p.id === id)?.inventoryAccount || '1-10300';
  const rows = new Map();
  (opname?.lines ?? [])
    .filter((l) => isCounted(l) && diffQty(l) !== 0)
    .forEach((l) => {
      const akun = accountOfLine(l, opname, accountMap);
      const nilai = Math.round(Math.abs(diffValue(l)));
      const lebih = diffQty(l) > 0;
      const key = `${akun}|${l.reason}`;
      const row = rows.get(key) ?? { account: akun, reason: l.reason, count: 0, debit: 0, credit: 0 };
      row.count += 1;
      // Lebih → Dr Persediaan / Cr akun alasan. Kurang → kebalikannya.
      if (lebih) row.credit += nilai;
      else row.debit += nilai;
      rows.set(key, row);

      const pk = `${persediaanOf(l.productId)}|persediaan`;
      const pr = rows.get(pk) ?? {
        account: persediaanOf(l.productId),
        reason: null,
        count: 0,
        debit: 0,
        credit: 0,
      };
      pr.count += 1;
      if (lebih) pr.debit += nilai;
      else pr.credit += nilai;
      rows.set(pk, pr);
    });
  return [...rows.values()].sort((a, b) => a.account.localeCompare(b.account));
}

/** Akun selisih satu baris: yang terkunci di dokumen, atau pemetaan yang berlaku. */
export const accountOfLine = (line, opname, accountMap) =>
  opname?.accountMap?.[line.reason] ?? accountMap?.[line.reason] ?? defaultOpnameAccounts[line.reason] ?? null;

// ---------------------------------------------------------------------------
// Validasi
// ---------------------------------------------------------------------------

/** Mutasi terakhir di satu gudang — pembatas bawah tanggal hitung (O2). */
export function lastMoveDate(moves, warehouseId) {
  return (
    (moves ?? [])
      .filter((m) => m.warehouseId === warehouseId)
      .reduce((max, m) => (m.date > max ? m.date : max), '') || null
  );
}

/**
 * Validasi form Buat opname. Mengembalikan { field: pesan }; kosong berarti valid.
 * `periodLocked` disuntikkan supaya modul ini tidak ikut menarik modul Penjualan.
 */
export function validateOpname(form, ctx) {
  const { opnames, warehouses, moves, products, today, periodLocked, monthLabel } = ctx;
  const gudang = warehouses.find((w) => w.id === form.warehouseId);
  const berjalan = form.warehouseId ? runningOpnameOf(opnames, form.warehouseId) : null;
  const terakhir = form.warehouseId ? lastMoveDate(moves, form.warehouseId) : null;
  const cakupan = form.warehouseId
    ? productsInScope({ products, moves, warehouseId: form.warehouseId, scope: form.scope })
    : [];

  return {
    warehouseId:
      (!form.warehouseId && 'Pilih gudang') ||
      (gudang?.status !== 'active' && 'Gudang ini sudah nonaktif') ||
      (berjalan && `Gudang ini sedang diopname (${berjalan.number})`) ||
      undefined,
    date:
      (!form.date && 'Tanggal hitung wajib diisi') ||
      (form.date > today && 'Tanggal tidak boleh di masa depan') ||
      (periodLocked?.(form.date) && `Periode ${monthLabel(form.date)} sudah dikunci`) ||
      (terakhir && form.date < terakhir
        ? `Ada mutasi di ${gudang?.name ?? 'gudang ini'} tanggal ${terakhir}. Pilih tanggal ${terakhir} atau sesudahnya`
        : undefined) ||
      undefined,
    scope:
      (form.scope.type === 'category' &&
        !(form.scope.categoryIds ?? []).length &&
        'Pilih minimal satu kategori') ||
      (form.scope.type === 'manual' &&
        !(form.scope.productIds ?? []).length &&
        'Pilih minimal satu produk') ||
      (form.warehouseId && !cakupan.length && 'Tidak ada produk yang bisa dihitung di cakupan ini') ||
      undefined,
  };
}

/** Apa yang menahan dokumen dikirim untuk persetujuan (O7/O8/O6). */
export function submitBlockers(opname, products) {
  const lines = opname?.lines ?? [];
  const belum = lines.filter((l) => !isCounted(l));
  const tanpaAlasan = lines.filter((l) => isCounted(l) && diffQty(l) !== 0 && !l.reason);
  const alasanSalah = lines.filter(
    (l) => isCounted(l) && diffQty(l) !== 0 && l.reason && !reasonFitsDiff(l.reason, diffQty(l)),
  );
  const tanpaCatatan = lines.filter(
    (l) => isCounted(l) && diffQty(l) !== 0 && l.reason === 'lainnya' && !String(l.note ?? '').trim(),
  );
  const tanpaHarga = lines.filter(
    (l) => isCounted(l) && diffQty(l) > 0 && !(Number(l.unitCost) > 0),
  );
  const list = [];
  if (belum.length) list.push(`${belum.length} produk belum dihitung`);
  if (tanpaAlasan.length) list.push(`${tanpaAlasan.length} baris selisih belum diberi alasan`);
  if (alasanSalah.length) list.push(`${alasanSalah.length} baris alasannya tidak sesuai arah selisih`);
  if (tanpaCatatan.length) list.push(`${tanpaCatatan.length} baris beralasan Lainnya belum diberi catatan`);
  if (tanpaHarga.length)
    list.push(
      `${tanpaHarga.length} produk belum punya harga satuan (${tanpaHarga
        .map((l) => products?.find((p) => p.id === l.productId)?.name ?? l.productId)
        .join(', ')})`,
    );
  return list;
}

/** Apa yang menahan posting — dicek ulang saat Building Manager menyetujui. */
export function postBlockers(opname, { products, accountMap, periodLocked, monthLabel }) {
  const list = submitBlockers(opname, products);
  if (periodLocked?.(opname.date)) list.push(`Periode ${monthLabel(opname.date)} sudah dikunci`);
  const perluAkun = [
    ...new Set(
      (opname.lines ?? [])
        .filter((l) => isCounted(l) && diffQty(l) !== 0)
        .map((l) => l.reason)
        .filter(Boolean),
    ),
  ];
  perluAkun
    .filter((r) => !(accountMap?.[r] ?? defaultOpnameAccounts[r]))
    .forEach((r) => list.push(`Akun untuk alasan ${reasonLabel(r)} belum diatur`));
  const tanpaPersediaan = (opname.lines ?? [])
    .filter((l) => isCounted(l) && diffQty(l) !== 0)
    .map((l) => products?.find((p) => p.id === l.productId))
    .filter((p) => p && !p.inventoryAccount);
  if (tanpaPersediaan.length)
    list.push(
      `Akun persediaan untuk ${tanpaPersediaan.map((p) => p.name).join(', ')} belum diatur`,
    );
  return list;
}

// ---------------------------------------------------------------------------
// Posting & pembatalan
// ---------------------------------------------------------------------------

/**
 * Mutasi hasil posting (O9): satu per baris yang selisihnya ≠ 0, bertanggal
 * tanggal hitung. Baris tanpa selisih tetap tersimpan di dokumen sebagai bukti
 * sudah dihitung, tetapi tidak menyentuh stok.
 *
 * Akun alasannya ikut ditulis ke mutasi dan dikunci di sana, jadi mengubah
 * pemetaan di Pengaturan tidak mengubah jurnal yang sudah terbit.
 */
export function postOpname(opname, { accountMap, by }) {
  return (opname.lines ?? [])
    .filter((l) => isCounted(l) && diffQty(l) !== 0)
    .map((l) => {
      const d = diffQty(l);
      return buildMove({
        date: opname.date,
        type: d > 0 ? 'opname_gain' : 'opname_loss',
        productId: l.productId,
        warehouseId: opname.warehouseId,
        qty: Math.abs(d),
        unitCost: Number(l.unitCost) || 0,
        sourceType: 'stock_opname',
        sourceId: opname.id,
        sourceNo: opname.number,
        createdBy: by,
        adjustmentReason: l.reason,
        adjustmentAccount: accountOfLine(l, opname, accountMap),
      });
    });
}

/** Mutasi pembalik seluruh mutasi opname (O11). */
export function reverseOpname(opname, moves, { date, by, costs }) {
  return (moves ?? [])
    .filter((m) => m.sourceType === 'stock_opname' && m.sourceId === opname.id && !m.reversalOfId)
    .filter((m) => !(moves ?? []).some((x) => x.reversalOfId === m.id))
    .map((m) => ({
      ...reverseMove(m, date, by, costs?.get(m.id)),
      adjustmentReason: m.adjustmentReason,
      adjustmentAccount: m.adjustmentAccount,
    }));
}

/**
 * M3 saat membatalkan: membalik opname lebih berarti mengeluarkan barang lagi.
 * Cukupnya stok diperiksa dengan canIssue, bukan saldo hari ini — barang yang
 * ada sekarang bisa saja sudah dipakai dokumen bertanggal sesudahnya, dan
 * pembaliknya akan membuat saldo minus di hari-hari itu.
 *
 * @param date tanggal mutasi pembalik akan dibukukan
 */
export function reverseBlockers(opname, moves, products, date) {
  const calon = (moves ?? []).filter(
    (m) => m.sourceType === 'stock_opname' && m.sourceId === opname.id && !m.reversalOfId,
  );
  return calon
    .filter((m) => m.qtyIn > 0)
    .map((m) => {
      const cek = canIssue(moves, m.productId, m.warehouseId, date ?? opname.date, m.qtyIn);
      if (cek.ok) return null;
      const nama = products?.find((p) => p.id === m.productId)?.name ?? m.productId;
      return cek.afterwards
        ? `${nama} — hanya ${Math.max(0, cek.available)} yang bisa dikeluarkan, sisanya sudah dipakai dokumen setelah tanggal ini`
        : `${nama} — tersedia ${Math.max(0, cek.available)} dari ${m.qtyIn}`;
    })
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Riwayat dokumen
// ---------------------------------------------------------------------------

/**
 * Satu baris Riwayat. `at` disuntikkan pemanggil supaya memakai tanggal
 * APLIKASI, bukan tanggal komputer — kalau tidak, riwayatnya melompat ke
 * tanggal lain daripada dokumen di sekitarnya.
 */
export const opnameEvent = (action, by, note, at) => ({
  at: at ?? new Date().toISOString(),
  by,
  action,
  ...(note ? { note } : null),
});

export const OPNAME_ACTION = {
  created: 'Dokumen dibuat',
  started: 'Hitungan dimulai',
  submitted: 'Dikirim untuk persetujuan',
  approved: 'Disetujui dan diposting',
  rejected: 'Ditolak, dikembalikan ke petugas',
  cancelled: 'Dibatalkan',
  recount: 'Diminta hitung ulang',
};

// ---------------------------------------------------------------------------
// Data contoh
// ---------------------------------------------------------------------------

const SEED_BY = 'Maya Sari';

export const stockOpnamesSeed = [
  // Opname rutin yang selisihnya nol: bukti bahwa dokumen yang diposting tidak
  // harus mengubah stok, sekaligus menjaga seed mutasi tetap utuh.
  {
    id: 'so-0001',
    number: 'SO/2026/06/0001',
    warehouseId: 'wh-1',
    date: '2026-06-30',
    scope: { type: 'manual', productIds: ['kertas-a4', 'map-plastik'] },
    counterUserId: 'gudang',
    notes: 'Opname rutin akhir semester.',
    status: 'posted',
    accountMap: { ...defaultOpnameAccounts },
    lines: [
      { productId: 'kertas-a4', bookQty: 40, countedQty: 40, unitCost: 56000, reason: null, note: '' },
      { productId: 'map-plastik', bookQty: 150, countedQty: 150, unitCost: 3500, reason: null, note: '' },
    ],
    history: [
      { at: '2026-06-30T01:00:00.000Z', by: SEED_BY, action: 'created' },
      { at: '2026-06-30T02:00:00.000Z', by: 'Rudi Hermawan', action: 'started' },
      { at: '2026-06-30T07:00:00.000Z', by: SEED_BY, action: 'submitted' },
      { at: '2026-06-30T09:00:00.000Z', by: 'Budi Hartono', action: 'approved' },
    ],
    startedAt: '2026-06-30T02:00:00.000Z',
    postedAt: '2026-06-30T09:00:00.000Z',
    createdBy: SEED_BY,
    createdAt: '2026-06-30T01:00:00.000Z',
  },
  // Opname yang sedang berjalan. Gudang Lt. 2, bukan Gudang Utama: Gudang Utama
  // masih punya mutasi tanggal 3-4 Nov, yang akan bertabrakan dengan O4.
  //
  // Tanggalnya hari ini (4 Nov), bukan 20 Nov seperti di spesifikasi: tanggal
  // hitung tidak boleh di masa depan (O2), dan tanggal aplikasi ini 4 Nov 2026.
  // Mutasi terakhir di Gudang Lt. 2 tanggal 2 Nov, jadi syarat bawahnya aman.
  {
    id: 'so-0003',
    number: 'SO/2026/11/0003',
    warehouseId: 'wh-2',
    date: '2026-11-04',
    scope: { type: 'all' },
    counterUserId: 'gudang',
    notes: 'Hitung berkala gudang penyangga.',
    status: 'counting',
    accountMap: null,
    lines: [
      { productId: 'kertas-a4', bookQty: 10, countedQty: null, unitCost: 56800, reason: null, note: '' },
    ],
    history: [
      { at: '2026-11-04T01:00:00.000Z', by: SEED_BY, action: 'created' },
      { at: '2026-11-04T02:00:00.000Z', by: 'Rudi Hermawan', action: 'started' },
    ],
    startedAt: '2026-11-04T02:00:00.000Z',
    createdBy: SEED_BY,
    createdAt: '2026-11-04T01:00:00.000Z',
  },
];

/** Nomor dokumen berikutnya, mengikuti pola Penomoran Dokumen modul lain. */
export function nextOpnameNumber(list) {
  const max = (list ?? []).reduce(
    (m, o) => Math.max(m, parseInt(String(o.number).split('/').pop(), 10) || 0),
    0,
  );
  return `SO/2026/11/${String(max + 1).padStart(4, '0')}`;
}

/** Mutasi yang lahir dari satu dokumen opname. */
export const movesOfOpname = (moves, opnameId) =>
  listMoves(moves ?? [], {}).filter((m) => m.sourceType === 'stock_opname' && m.sourceId === opnameId);
