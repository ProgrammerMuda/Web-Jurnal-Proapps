// Master data Gudang: lokasi penyimpanan barang.
// Gudang TIDAK menyimpan angka stok. Saldo dan riwayat stok dibaca dari stock.js
// (sumber yang sama dengan menu Mutasi Stok), supaya tidak ada sumber angka kedua.
import { personLabel, roles, TODAY } from '@/pages/Pembelian/data.js';

export { TODAY, personLabel };

export const WAREHOUSE_PREFIX = 'GDG';

// Penanggung jawab dipilih dari pengguna yang ada di prototipe (lihat roles).
// label = nama saja; jabatannya dibawa terpisah supaya bisa ditampilkan sebagai
// baris kedua yang redup, bukan disambung tanda titik.
export const picOptions = roles
  .filter((r) => r.value !== 'superadmin')
  .map((r) => ({ value: r.value, label: r.person.name, title: r.person.title }));

export const picName = (value) => roles.find((r) => r.value === value)?.person?.name ?? null;
export const picTitle = (value) => roles.find((r) => r.value === value)?.person?.title ?? null;
/** "Nama · Jabatan" — untuk kalimat mengalir, mis. baris riwayat perubahan. */
export const picLabel = (value) => {
  const r = roles.find((x) => x.value === value)?.person;
  return r ? `${r.name} · ${r.title}` : null;
};

const SEED_AT = '2026-11-01T08:00:00.000Z';

export const warehousesSeed = [
  {
    id: 'wh-1',
    code: 'GDG-001',
    name: 'Gudang Utama',
    address: 'Jl. Jenderal Sudirman Kav. 52-53, Lantai Basement 1',
    city: 'Jakarta',
    postalCode: '12190',
    picUserId: 'gudang',
    phone: '021-5150123',
    notes: 'Gudang induk untuk ATK, material teknik, dan perlengkapan kebersihan.',
    isDefault: true,
    status: 'active',
    createdBy: 'Admin Sistem',
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  },
  {
    id: 'wh-2',
    code: 'GDG-002',
    name: 'Gudang Lt. 2',
    address: 'Jl. Jenderal Sudirman Kav. 52-53, Lantai 2 Ruang Service',
    city: 'Jakarta',
    postalCode: '12190',
    picUserId: 'bm',
    phone: '021-5150124',
    notes: 'Gudang penyangga untuk kebutuhan harian lantai 1-5.',
    isDefault: false,
    status: 'active',
    createdBy: 'Admin Sistem',
    createdAt: SEED_AT,
    updatedAt: SEED_AT,
  },
  {
    id: 'wh-3',
    code: 'GDG-003',
    name: 'Gudang Lt. 3',
    address: 'Jl. Jenderal Sudirman Kav. 52-53, Lantai 3 Ruang Service',
    city: 'Jakarta',
    postalCode: '12190',
    picUserId: null,
    phone: '',
    notes: 'Baru disiapkan, belum dipakai di transaksi mana pun.',
    isDefault: false,
    status: 'active',
    createdBy: 'Admin Sistem',
    createdAt: '2026-11-03T08:00:00.000Z',
    updatedAt: '2026-11-03T08:00:00.000Z',
  },
  {
    id: 'wh-4',
    code: 'GDG-004',
    name: 'Gudang Lama',
    address: 'Jl. Raya Narogong No. 18',
    city: 'Bekasi',
    postalCode: '17116',
    picUserId: 'gudang',
    phone: '',
    notes: 'Sudah tidak dipakai sejak pindah ke gudang basement.',
    isDefault: false,
    status: 'inactive',
    createdBy: 'Admin Sistem',
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-10-20T08:00:00.000Z',
  },
];

// R8: setiap perubahan data gudang dicatat (siapa, kapan, field, sebelum → sesudah).
export const warehouseLogsSeed = [
  {
    id: 'wlog-1',
    warehouseId: 'wh-4',
    userName: 'Admin Sistem',
    at: '2026-10-20T09:15:00.000Z',
    changes: [{ field: 'status', from: 'active', to: 'inactive' }],
  },
  {
    id: 'wlog-2',
    warehouseId: 'wh-1',
    userName: 'Rudi Hermawan',
    at: '2026-10-02T04:30:00.000Z',
    changes: [
      { field: 'phone', from: '', to: '021-5150123' },
      { field: 'picUserId', from: null, to: 'gudang' },
    ],
  },
];

// Label field untuk tab Riwayat perubahan.
export const FIELD_LABEL = {
  code: 'Kode',
  name: 'Nama gudang',
  address: 'Alamat',
  city: 'Kota',
  postalCode: 'Kode pos',
  picUserId: 'Penanggung jawab',
  phone: 'Telepon',
  notes: 'Catatan',
  isDefault: 'Gudang utama',
  status: 'Status',
  minQty: 'Stok minimum',
};

export const STATUS_PILL = {
  active: { label: 'Aktif', color: 'green' },
  inactive: { label: 'Nonaktif', color: 'slate' },
};

export const emptyWarehouse = () => ({
  id: '',
  code: '',
  name: '',
  address: '',
  city: '',
  postalCode: '',
  picUserId: null,
  phone: '',
  notes: '',
  isDefault: false,
  status: 'active',
});

// Kode berikutnya: GDG-005 bila GDG-001..004 sudah ada.
export function nextWarehouseCode(list) {
  const nums = list
    .map((w) => Number(/^GDG-(\d+)$/.exec(w.code)?.[1]))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${WAREHOUSE_PREFIX}-${String(next).padStart(3, '0')}`;
}

const CODE_RE = /^[A-Za-z0-9-]+$/;
const PHONE_RE = /^[0-9+\-\s]+$/;

/** Validasi form gudang. Mengembalikan { field: pesan } — kosong berarti valid. */
export function validateWarehouse(form, list) {
  const code = form.code.trim();
  const name = form.name.trim();
  const phone = (form.phone ?? '').trim();
  const bentrok = list.find((w) => w.id !== form.id && w.code.toLowerCase() === code.toLowerCase());
  return {
    code:
      (!code && 'Kode wajib diisi') ||
      (code.length > 20 && 'Kode maksimal 20 karakter') ||
      (!CODE_RE.test(code) && 'Kode hanya boleh huruf, angka, dan tanda hubung') ||
      (bentrok && `Kode ${code} sudah dipakai`) ||
      undefined,
    name:
      (!name && 'Nama gudang wajib diisi') ||
      (name.length > 100 && 'Nama gudang maksimal 100 karakter') ||
      undefined,
    phone: (phone && !PHONE_RE.test(phone) && 'Format nomor telepon tidak valid') || undefined,
  };
}

/** Daftar perubahan antara dua versi gudang, untuk audit log. */
export function diffWarehouse(before, after) {
  return Object.keys(FIELD_LABEL)
    .filter((f) => f in after && (before?.[f] ?? null) !== (after[f] ?? null))
    .map((field) => ({ field, from: before?.[field] ?? null, to: after[field] }));
}

// ---------------------------------------------------------------------------
// Dropdown & pencarian gudang (dipakai Pembelian, Penjualan, dan laporan)
// ---------------------------------------------------------------------------

const optionLabel = (w) =>
  `${w.code} · ${w.name}${w.isDefault ? ' — Utama' : ''}${w.status === 'inactive' ? ' (nonaktif)' : ''}`;

/**
 * Pilihan gudang untuk dokumen BARU: hanya gudang aktif (R10).
 * `current` menjaga gudang yang sudah tersimpan di dokumen lama tetap terlihat,
 * walaupun kini sudah nonaktif.
 */
export function warehouseOptions(warehouses, current = null) {
  const aktif = warehouses.filter((w) => w.status === 'active');
  const dipakai = warehouses.find((w) => w.id === current && w.status !== 'active');
  return [...aktif, ...(dipakai ? [dipakai] : [])].map((w) => ({
    value: w.id,
    label: optionLabel(w),
  }));
}

/** Pilihan untuk filter laporan: gudang nonaktif ikut tampil, diberi label (nonaktif). */
export const warehouseFilterOptions = (warehouses) =>
  warehouses.map((w) => ({ value: w.id, label: optionLabel(w) }));

export const defaultWarehouseId = (warehouses) =>
  warehouses.find((w) => w.isDefault && w.status === 'active')?.id ??
  warehouses.find((w) => w.status === 'active')?.id ??
  null;

export const warehouseById = (warehouses, id) => warehouses.find((w) => w.id === id) ?? null;

/** Teks gudang pada dokumen; menandai gudang yang sudah nonaktif. */
export function warehouseText(warehouses, id, fallback = 'Belum ditentukan') {
  const w = warehouseById(warehouses, id);
  if (!w) return fallback;
  return `${w.name}${w.status === 'inactive' ? ' (nonaktif)' : ''}`;
}
