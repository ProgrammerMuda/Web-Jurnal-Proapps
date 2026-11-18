// Data & aturan modul Pembelian — mengikuti artifact "Skenario Pembelian Proapps" (flow baru).
// Alur: permintaan → verifikasi → pengadaan (bidding | vendor tunggal) → approval → PO → DP → penerimaan (FPB/BAST) → faktur → pelunasan.
import { TODAY } from '@/pages/Penjualan/data.js';

export { TODAY };

// Ambang aturan. Usulan awal; di produksi sebaiknya bisa diatur di menu Pengaturan.
export const RULES = {
  minQuotes: 3,
  priceWarnPct: 5, // naik > 5%  → wajib alasan
  priceBiddingPct: 15, // naik > 15% → wajib bidding
  staleMonths: 12, // pembelian terakhir > 12 bulan → wajib alasan
  newItemLimit: 10_000_000, // item baru ≤ ini → 1 pembanding; di atasnya → bidding
  ppn: 0.11,
};

// Peran mengikuti spesifikasi modul Pembelian bagian 2.
// KEPALA_GUDANG (approval FPB nilai besar) dan ADMIN (Pengaturan) belum dipakai di prototype ini.
export const roles = [
  { value: 'peminta', label: 'Peminta', color: 'teal', person: { name: 'Andi Wijaya', title: 'Staff Housekeeping' } },
  { value: 'accounting', label: 'Accounting', color: 'primary', person: { name: 'Maya Sari', title: 'Staff Accounting' } },
  { value: 'bm', label: 'Building Manager', color: 'orange', person: { name: 'Budi Hartono', title: 'Building Manager' } },
  { value: 'gudang', label: 'Gudang / PIC Jasa', color: 'green', person: { name: 'Rudi Hermawan', title: 'Kepala Gudang' } },
  { value: 'finance', label: 'Finance', color: 'grape', person: { name: 'Dewi Lestari', title: 'Staff Finance' } },
  // Superadmin memegang semua hak sekaligus, termasuk melewati pemisahan tugas.
  { value: 'superadmin', label: 'Superadmin', color: 'dark', person: { name: 'Admin Sistem', title: 'Superadmin' } },
];
// Peran lama dipetakan ke peran baru supaya data dan state tersimpan tetap terbaca.
const legacyRole = {
  atasan: 'bm', chief_seksi: 'bm', chief_engineering: 'bm',
  approver: 'bm', approver_pengadaan: 'bm', building_manager: 'bm',
  finance_manager: 'bm', kasir: 'finance', pic_jasa: 'gudang',
};
export const normalizeRole = (v) => (roles.some((r) => r.value === v) ? v : legacyRole[v] ?? 'accounting');
export const roleOf = (v) => roles.find((r) => r.value === normalizeRole(v));
// "Nama · Jabatan" untuk pengguna pada peran tertentu.
export const personLabel = (role) => {
  const p = roleOf(role)?.person;
  return p ? `${p.name} · ${p.title}` : '';
};
// Jabatan saja, mis. "Manager Keuangan".
export const personTitle = (role) => roleOf(role)?.person?.title ?? '';

// Katalog produk contoh untuk memilih barang atau jasa di form permintaan (nantinya diambil dari modul Produk).
export const productCatalog = [
  { id: 'kertas-a4', name: 'Kertas A4 80 gsm', kind: 'barang', unit: 'rim', price: 56000 },
  { id: 'map-plastik', name: 'Map plastik', kind: 'barang', unit: 'pcs', price: 3500 },
  { id: 'tinta-printer', name: 'Tinta printer', kind: 'barang', unit: 'box', price: 185000 },
  { id: 'printer-laser', name: 'Printer laser A4', kind: 'barang', unit: 'unit', price: 4200000 },
  { id: 'meja-lipat', name: 'Meja lipat 120x60', kind: 'barang', unit: 'pcs', price: 650000 },
  { id: 'kursi-kantor', name: 'Kursi kantor ergonomis', kind: 'barang', unit: 'unit', price: 1450000 },
  { id: 'lemari-arsip', name: 'Lemari arsip besi 4 laci', kind: 'barang', unit: 'unit', price: 2500000 },
  { id: 'pipa-pvc', name: 'Pipa PVC', kind: 'barang', unit: 'pcs', price: 65000 },
  { id: 'elbow-pvc', name: 'Elbow PVC', kind: 'barang', unit: 'pcs', price: 6500 },
  { id: 'pompa-air', name: 'Pompa air', kind: 'barang', unit: 'unit', price: 2500000 },
  { id: 'cairan-lantai', name: 'Cairan pembersih lantai', kind: 'barang', unit: 'box', price: 85000 },
  { id: 'kain-pel', name: 'Kain pel microfiber', kind: 'barang', unit: 'pcs', price: 22500 },
  { id: 'radio-ht', name: 'Radio HT', kind: 'barang', unit: 'unit', price: 1250000 },
  { id: 'seragam-satpam', name: 'Seragam satpam', kind: 'barang', unit: 'set', price: 450000 },
  { id: 'jasa-servis-lift', name: 'Jasa servis berkala lift', kind: 'jasa', unit: 'paket', price: 8500000 },
  { id: 'jasa-cctv', name: 'Jasa instalasi CCTV', kind: 'jasa', unit: 'paket', price: 3500000 },
  { id: 'jasa-ac', name: 'Jasa servis AC', kind: 'jasa', unit: 'unit', price: 350000 },
  { id: 'jasa-pest', name: 'Jasa pest control', kind: 'jasa', unit: 'bulan', price: 1800000 },
];

export const units = ['pcs', 'unit', 'rim', 'box', 'set', 'paket', 'bulan', 'lot'];
export const departments = ['Engineering', 'Housekeeping', 'Security', 'Management', 'Keuangan'];
// Termin bayar barang (PO): patokannya pengiriman.
// Katalog syarat pembayaran sudah pindah ke paymentTerms.js dan kini tersimpan di store,
// supaya bisa diubah lewat Pengaturan → Syarat Pembayaran.


export const periodOptions = [
  { value: 'bulan', label: 'Bulanan' },
  { value: 'triwulan', label: 'Triwulan' },
  { value: 'semester', label: 'Semesteran' },
  { value: 'tahun', label: 'Tahunan' },
];

export const vendorsSeed = [
  {
    id: 'v-alfa',
    name: 'PT Alfa Sejahtera',
    npwp: '01.111.222.3-012.000',
    pic: 'Rina Kusuma',
    email: 'purchasing@alfasejahtera.co.id',
    phone: '021-5550111',
    bank: { bank: 'BCA', branch: 'KCP Sudirman', number: '123-456-7890', holder: 'PT Alfa Sejahtera' },
    stats: { po: 14, onTime: 93 },
  },
  {
    id: 'v-bintang',
    name: 'PT Bintang Furnitur',
    npwp: '02.222.333.4-022.000',
    pic: 'Dodi Pranata',
    email: 'sales@bintangfurnitur.co.id',
    phone: '021-5550222',
    bank: { bank: 'Mandiri', branch: 'KCP Tebet', number: '130-00-1234567', holder: 'PT Bintang Furnitur' },
    stats: { po: 6, onTime: 83 },
  },
  {
    id: 'v-mitra',
    name: 'CV Mitra Teknik Lift',
    npwp: '01.234.567.8-012.000',
    pic: 'Hendra Wijaya',
    email: 'order@mitratekniklift.co.id',
    phone: '021-5550192',
    bank: { bank: 'BNI', branch: 'KCU Kebayoran', number: '0456-7890-12', holder: 'CV Mitra Teknik Lift' },
    stats: { po: 9, onTime: 100 },
  },
  {
    id: 'v-delta',
    name: 'CV Delta Elektronik',
    npwp: '03.333.444.5-032.000',
    pic: 'Sari Dewi',
    email: 'sari@deltaelektronik.co.id',
    phone: '021-5550333',
    bank: { bank: 'BCA', branch: 'KCP Pluit', number: '888-123-4455', holder: 'CV Delta Elektronik' },
    stats: { po: 0, onTime: 0 },
  },
  {
    id: 'v-karya',
    name: 'Toko Karya Office',
    npwp: '',
    pic: 'Budi',
    email: 'tokokaryaoffice@gmail.com',
    phone: '0812-5550444',
    bank: { bank: 'BRI', branch: 'Unit Cilandak', number: '0123-01-045678-50-1', holder: 'Budi Santoso' },
    stats: { po: 0, onTime: 0 },
  },
  {
    id: 'v-prima',
    name: 'PT Prima Furnindo',
    npwp: '04.444.555.6-042.000',
    pic: 'Lina',
    email: 'lina@primafurnindo.co.id',
    phone: '021-5550555',
    bank: { bank: 'BCA', branch: 'KCP Gading', number: '777-000-1212', holder: 'PT Prima Furnindo' },
    stats: { po: 0, onTime: 0 },
  },
];

// Item permintaan: tanpa harga. Harga baru muncul di penawaran vendor.
const item = (id, desc, qty, unit, extra = {}) => ({
  id,
  desc,
  spec: '',
  qty,
  unit,
  kind: 'barang',
  ...extra,
});
// Item PO / SPK: item permintaan ditambah harga yang disepakati.
const poItem = (id, desc, qty, unit, price, extra = {}) => ({ ...item(id, desc, qty, unit, extra), price });

// Termin pada dokumen membawa salinan mekanismenya sendiri (lihat snapshotTerm di
// paymentTerms.js), supaya artinya tidak bergantung pada katalog yang bisa berubah.
// Dokumen contoh di bawah memakai pembantu ini agar bentuknya sama dengan dokumen asli.
const term = (label, mech, params = {}) => ({ type: label.toLowerCase().replace(/[^a-z]+/g, '-'), label, mech: { ...mech, label }, ...params });
const TERM = {
  cad: () => term('CAD (bayar setelah diterima)', { advance: 'none', split: 'none', due: false, dueFrom: 'receipt' }, { dpPct: 0 }),
  dp: (pct) => term('DP (uang muka %)', { advance: 'partial', split: 'none', due: false, dueFrom: 'receipt' }, { dpPct: pct }),
  cbd: () => term('CBD (bayar sebelum kirim)', { advance: 'full', split: 'none', due: false, dueFrom: 'receipt' }, { dpPct: 100 }),
  postpaid: (days) => term('Bayar penuh di akhir', { advance: 'none', split: 'none', due: true, dueFrom: 'receipt' }, { dueDays: days }),
};

// --- Dokumen contoh -------------------------------------------------------------------------

// PO lama (Selesai) sebagai riwayat pembelian.
const poOld = {
  id: 'po-0031',
  number: 'PO/2026/09/0031',
  date: '2026-09-14',
  fppbjId: null,
  vendorId: 'v-alfa',
  kind: 'barang',
  sent: true,
  term: TERM.cad(),
  expectedAt: '2026-09-21',
  warehouse: 'Gudang Utama',
  items: [
    poItem('i1', 'Kertas A4 80 gsm', 50, 'rim', 52000),
    poItem('i2', 'Map plastik', 200, 'pcs', 3500),
  ],
  note: '',
};

const poChair = {
  id: 'po-0040',
  number: 'PO/2026/10/0040',
  date: '2026-10-28',
  fppbjId: 'fppbj-0005',
  vendorId: 'v-bintang',
  kind: 'barang',
  sent: true,
  term: TERM.dp(30),
  expectedAt: '2026-11-12',
  warehouse: 'Gudang Utama',
  items: [
    poItem('c1', 'Kursi ergonomis meeting', 10, 'pcs', 1250000, {
      spec: 'Sandaran jaring, roda, adjustable',
    }),
  ],
  note: '',
};

export const fppbjSeed = [
  {
    id: 'fppbj-0001',
    number: 'FPPBJ/2026/11/0001',
    date: '2026-11-03',
    neededBy: '2026-11-20',
    dept: 'Housekeeping',
    purpose: 'Meja lipat untuk ruang pameran',
    iom: { no: 'IOM/OPS/11/021', date: '2026-11-02', file: 'iom-meja-lipat.pdf' },
    items: [item('a1', 'Meja lipat 120x60', 8, 'pcs')],
    status: 'diajukan',
    note: '',
    returnNote: '',
    route: null,
    quotes: [],
    single: { on: false, reason: '' },
    procurement: null,
    requester: 'Andi Wijaya · Staff Housekeeping',
  },
  {
    id: 'fppbj-0002',
    number: 'FPPBJ/2026/11/0002',
    date: '2026-11-02',
    neededBy: '2026-11-18',
    dept: 'Keuangan',
    purpose: 'Kertas A4 dan printer laser untuk lantai 3',
    iom: { no: 'IOM/KEU/11/008', date: '2026-11-01', file: 'iom-atk-lt3.pdf' },
    items: [
      item('b1', 'Kertas A4 80 gsm', 50, 'rim'),
      item('b2', 'Printer laser A4', 2, 'unit'),
    ],
    status: 'diverifikasi',
    note: '',
    returnNote: '',
    route: null,
    quotes: [],
    single: { on: false, reason: '' },
    procurement: null,
    requester: 'Maya Sari · Staff Keuangan',
  },
  {
    id: 'fppbj-0003',
    number: 'FPPBJ/2026/10/0006',
    date: '2026-10-26',
    neededBy: '2026-11-15',
    dept: 'Engineering',
    purpose: 'Lemari arsip besi untuk ruang dokumen',
    iom: { no: 'IOM/PRP/10/044', date: '2026-10-25', file: 'iom-lemari.pdf' },
    items: [item('d1', 'Lemari arsip besi 4 laci', 6, 'unit')],
    status: 'dalam_pengadaan',
    note: '',
    returnNote: '',
    route: 'bidding',
    quotes: [
      {
        id: 'q1',
        vendorId: 'v-bintang',
        no: 'QT-BF-1102',
        validUntil: '2026-11-30',
        desc: 'Lemari arsip besi 4 laci, cat powder coating, kunci terpusat.',
        file: 'qt-bintang.pdf',
        term: TERM.dp(30),
        lead: 14,
        warranty: '12 bulan',
        lines: [{ itemId: 'd1', price: 2450000, spec: 'Besi 0,7 mm, 4 laci' }],
      },
      {
        id: 'q2',
        vendorId: 'v-prima',
        no: 'PF/221/X',
        validUntil: '2026-11-25',
        desc: 'Lemari arsip besi 4 laci, finishing cat oven.',
        file: 'qt-prima.pdf',
        term: TERM.cad(),
        lead: 10,
        warranty: '6 bulan',
        lines: [{ itemId: 'd1', price: 2380000, spec: 'Besi 0,6 mm, 4 laci' }],
      },
      {
        id: 'q3',
        vendorId: 'v-karya',
        no: 'TK-0987',
        validUntil: '2026-11-20',
        desc: 'Lemari arsip 4 laci stok toko.',
        file: 'qt-karya.pdf',
        term: TERM.cbd(),
        lead: 3,
        warranty: '3 bulan',
        lines: [{ itemId: 'd1', price: 2600000, spec: 'Besi 0,5 mm, 4 laci' }],
      },
    ],
    single: { on: false, reason: '' },
    procurement: {
      kind: 'bidding',
      status: 'diajukan',
      note: '',
      reason: 'Harga terbaik dengan spesifikasi sesuai dan garansi 12 bulan.',
      winners: { d1: 'v-bintang' },
      finals: { d1: 2420000 },
      termNote: '',
      negotiation: 'Nego via chat: turun Rp30.000/unit dengan syarat DP 30%.',
      scores: {},
    },
    requester: 'Tiara Putri · Staff Engineering',
  },
  {
    id: 'fppbj-0004',
    number: 'FPPBJ/2026/11/0003',
    date: '2026-11-01',
    neededBy: '2026-11-14',
    dept: 'Keuangan',
    purpose: 'Kertas A4 dan map plastik untuk lantai 2',
    iom: { no: 'IOM/KEU/11/006', date: '2026-10-31', file: 'iom-atk.pdf' },
    items: [
      item('e1', 'Kertas A4 80 gsm', 40, 'rim'),
      item('e2', 'Map plastik', 100, 'pcs'),
    ],
    status: 'dalam_pengadaan',
    note: '',
    returnNote: '',
    route: 'bidding',
    quotes: [
      {
        id: 'q4',
        vendorId: 'v-alfa',
        no: 'QT-ALF-2210',
        validUntil: '2026-11-30',
        desc: 'Penawaran ATK dari vendor langganan.',
        file: 'qt-alfa-nov.pdf',
        term: TERM.cad(),
        lead: 5,
        warranty: '-',
        lines: [
          { itemId: 'e1', price: 54000, spec: '' },
          { itemId: 'e2', price: 3500, spec: '' },
        ],
      },
    ],
    single: { on: true, reason: 'Hanya PT Alfa Sejahtera yang menyuplai map plastik ukuran ini di wilayah kami.' },
    procurement: {
      kind: 'bidding',
      status: 'disetujui',
      note: '',
      reason: '',
      negotiation: '',
      winners: {},
      finals: { e1: 54000, e2: 3500 },
    },
    requester: 'Maya Sari · Staff Keuangan',
  },
  {
    id: 'fppbj-0005',
    number: 'FPPBJ/2026/10/0005',
    date: '2026-10-20',
    neededBy: '2026-11-12',
    dept: 'Housekeeping',
    purpose: '10 kursi ergonomis untuk ruang meeting baru',
    iom: { no: 'IOM/OPS/10/038', date: '2026-10-19', file: 'iom-kursi.pdf' },
    items: [
      item('c1', 'Kursi ergonomis meeting', 10, 'pcs', {
        spec: 'Sandaran jaring, roda, adjustable',
      }),
    ],
    status: 'dalam_pengadaan',
    note: '',
    returnNote: '',
    route: 'bidding',
    quotes: [
      {
        id: 'q5',
        vendorId: 'v-bintang',
        no: 'QT-BF-1088',
        validUntil: '2026-11-15',
        desc: 'Kursi ergonomis sandaran jaring.',
        file: 'qt-bf-kursi.pdf',
        term: TERM.dp(30),
        lead: 14,
        warranty: '12 bulan',
        lines: [{ itemId: 'c1', price: 1300000, spec: '' }],
      },
      {
        id: 'q6',
        vendorId: 'v-prima',
        no: 'PF/198/X',
        validUntil: '2026-11-15',
        desc: 'Kursi ergonomis.',
        file: 'qt-prima-kursi.pdf',
        term: TERM.cad(),
        lead: 12,
        warranty: '6 bulan',
        lines: [{ itemId: 'c1', price: 1350000, spec: '' }],
      },
      {
        id: 'q7',
        vendorId: 'v-karya',
        no: 'TK-0912',
        validUntil: '2026-11-10',
        desc: 'Kursi kantor.',
        file: 'qt-karya-kursi.pdf',
        term: TERM.cbd(),
        lead: 5,
        warranty: '3 bulan',
        lines: [{ itemId: 'c1', price: 1180000, spec: '' }],
      },
    ],
    single: { on: false, reason: '' },
    procurement: {
      kind: 'bidding',
      status: 'disetujui',
      note: '',
      reason: 'Kualitas dan garansi terbaik, harga final turun lewat negosiasi.',
      winners: { c1: 'v-bintang' },
      finals: { c1: 1250000 },
      termNote: '',
      negotiation: 'Harga final Rp1.250.000 dengan DP 30%.',
      scores: {},
    },
    poId: 'po-0040',
    requester: 'Andi Wijaya · Staff Housekeeping',
  },
];

// PO jasa yang sudah diterima dan difaktur tapi belum dibayar (lewat jatuh tempo) → contoh umur hutang.
const spkLift = {
  id: 'po-0036',
  number: 'SPK/2026/10/0036',
  date: '2026-10-01',
  fppbjId: null,
  vendorId: 'v-mitra',
  sent: true,
  term: TERM.postpaid(30),
  expectedAt: '2026-10-15',
  warehouse: '-',
  items: [poItem('s1', 'Servis berkala lift gedung A', 1, 'paket', 8500000, { kind: 'jasa' })],
  note: '',
};


// Riwayat PO selesai lainnya (diterima penuh, difaktur, lunas).
const histPo = (id, number, date, vendorId, items, term = TERM.cad()) => ({
  id,
  number,
  date,
  fppbjId: null,
  vendorId,
  sent: true,
  term,
  expectedAt: date,
  warehouse: 'Gudang Utama',
  items,
  note: '',
});
const poAlfa1 = histPo('po-0022', 'PO/2026/07/0022', '2026-07-08', 'v-alfa', [
  poItem('a1', 'Kertas A4 80 gsm', 40, 'rim', 50000),
  poItem('a2', 'Tinta printer', 12, 'box', 175000),
]);
const poAlfa2 = histPo('po-0027', 'PO/2026/08/0027', '2026-08-05', 'v-alfa', [
  poItem('b1', 'Map plastik', 300, 'pcs', 3300),
  poItem('b2', 'Kertas A4 80 gsm', 30, 'rim', 51000),
]);
const poBintang1 = histPo('po-0018', 'PO/2026/06/0018', '2026-06-12', 'v-bintang', [
  poItem('d1', 'Meja lipat 120x60', 6, 'pcs', 620000),
  poItem('d2', 'Lemari arsip besi 4 laci', 2, 'unit', 2400000),
]);
// Jasa semua → SPK, dengan termin jasa "bayar penuh di akhir".
const poMitra1 = histPo('po-0025', 'SPK/2026/08/0025', '2026-08-18', 'v-mitra', [
  poItem('m1', 'Jasa servis AC', 20, 'unit', 330000, { kind: 'jasa' }),
], TERM.postpaid(30));
const histDocs = [
  { po: poAlfa1, rc: ['fpb-0005', 'FPB/2026/07/0005', '2026-07-12', 'SJ-ALF-6120'], inv: ['fkt-0014', 'FKT/2026/07/0014', 'INV-ALF-70231', '2026-07-14', '2026-08-13'], pr: ['pr-0010', 'PR/2026/08/0010', '2026-08-10'] },
  { po: poAlfa2, rc: ['fpb-0006', 'FPB/2026/08/0006', '2026-08-09', 'SJ-ALF-6544'], inv: ['fkt-0017', 'FKT/2026/08/0017', 'INV-ALF-80377', '2026-08-11', '2026-09-10'], pr: ['pr-0013', 'PR/2026/09/0013', '2026-09-08'] },
  { po: poBintang1, rc: ['fpb-0004', 'FPB/2026/06/0004', '2026-06-20', 'SJ-BF-2210'], inv: ['fkt-0011', 'FKT/2026/06/0011', 'INV-BF-60418', '2026-06-22', '2026-07-22'], pr: ['pr-0008', 'PR/2026/07/0008', '2026-07-20'] },
  { po: poMitra1, rc: ['bast-0002', 'BAST/2026/08/0002', '2026-08-28', 'BAST-MTL-0828'], inv: ['fkt-0019', 'FKT/2026/08/0019', 'INV-MTL-2208', '2026-08-29', '2026-09-28'], pr: ['pr-0014', 'PR/2026/09/0014', '2026-09-25'] },
];
const histReceipts = histDocs.map(({ po, rc }) => ({
  id: rc[0],
  number: rc[1],
  poId: po.id,
  vendorId: po.vendorId,
  date: rc[2],
  doNumber: rc[3],
  kind: po.items.every((i) => i.kind === 'jasa') ? 'jasa' : 'barang',
  lines: po.items.map((i) => ({ itemId: i.id, qty: i.qty, rejected: 0 })),
  note: '',
}));
const histInvoices = histDocs.map(({ po, rc, inv }) => ({
  id: inv[0],
  number: inv[1],
  vendorNo: inv[2],
  poId: po.id,
  vendorId: po.vendorId,
  date: inv[3],
  dueDate: inv[4],
  lines: po.items.map((i) => ({ receiptId: rc[0], itemId: i.id, qty: i.qty, price: i.price })),
  pphPct: 0,
  files: [`invoice-${inv[0]}.pdf`],
}));
const histPrs = histDocs.map(({ po, inv, pr }) => {
  const dpp = po.items.reduce((n, i) => n + i.qty * i.price, 0);
  return {
    id: pr[0],
    number: pr[1],
    kind: 'pelunasan',
    vendorId: po.vendorId,
    poId: po.id,
    invoiceIds: [inv[0]],
    amount: Math.round(dpp * (1 + RULES.ppn)),
    date: pr[2],
    status: 'dibayar',
    note: '',
    paidAt: pr[2],
  };
});

export const posSeed = [poOld, poChair, spkLift, poAlfa2, poAlfa1, poBintang1, poMitra1];

// poOld: selesai (diterima penuh, difaktur, lunas). poChair: diterima sebagian, DP disetujui.
export const receiptsSeed = [
  ...histReceipts,
  {
    id: 'bast-0003',
    number: 'BAST/2026/10/0003',
    poId: 'po-0036',
    vendorId: 'v-mitra',
    date: '2026-10-15',
    kind: 'jasa',
    doNumber: 'BAST-MTL-1015',
    lines: [{ itemId: 's1', qty: 1, rejected: 0 }],
    note: 'Servis selesai',
  },
  {
    id: 'fpb-0008',
    number: 'FPB/2026/09/0008',
    poId: 'po-0031',
    vendorId: 'v-alfa',
    date: '2026-09-20',
    doNumber: 'SJ-ALF-7781',
    kind: 'barang',
    lines: [
      { itemId: 'i1', qty: 50, rejected: 0 },
      { itemId: 'i2', qty: 200, rejected: 0 },
    ],
    note: '',
  },
  {
    id: 'fpb-0012',
    number: 'FPB/2026/11/0012',
    poId: 'po-0040',
    vendorId: 'v-bintang',
    date: '2026-11-03',
    doNumber: 'SJ-BF-3301',
    kind: 'barang',
    lines: [{ itemId: 'c1', qty: 6, rejected: 0 }],
    note: 'Pengiriman tahap 1',
  },
];

export const invoicesSeed = [
  ...histInvoices,
  {
    id: 'fkt-0024',
    number: 'FKT/2026/10/0024',
    vendorNo: 'INV-MTL-2210',
    poId: 'po-0036',
    vendorId: 'v-mitra',
    date: '2026-10-16',
    dueDate: '2026-10-25',
    lines: [{ receiptId: 'bast-0003', itemId: 's1', qty: 1, price: 8500000 }],
    pphPct: 2,
    files: ['invoice-mitra.pdf', 'faktur-pajak-mitra.pdf'],
  },
  {
    id: 'fkt-0021',
    number: 'FKT/2026/09/0021',
    vendorNo: 'INV-ALF-90112',
    poId: 'po-0031',
    vendorId: 'v-alfa',
    date: '2026-09-22',
    dueDate: '2026-10-22',
    lines: [
      { receiptId: 'fpb-0008', itemId: 'i1', qty: 50, price: 52000 },
      { receiptId: 'fpb-0008', itemId: 'i2', qty: 200, price: 3500 },
    ],
    pphPct: 0,
    files: ['invoice-alf.pdf', 'faktur-pajak.pdf'],
  },
];

export const prsSeed = [
  ...histPrs,
  {
    id: 'pr-0017',
    number: 'PR/2026/10/0017',
    kind: 'pelunasan',
    vendorId: 'v-alfa',
    poId: 'po-0031',
    invoiceIds: ['fkt-0021'],
    amount: 3_663_000,
    date: '2026-10-20',
    status: 'dibayar',
    note: '',
    paidAt: '2026-10-21',
  },
  {
    id: 'pr-0019',
    number: 'PR/2026/10/0019',
    kind: 'dp',
    vendorId: 'v-bintang',
    poId: 'po-0040',
    invoiceIds: [],
    amount: 3_750_000,
    date: '2026-10-29',
    status: 'disetujui',
    note: 'DP 30% PO/2026/10/0040',
  },
];

export const returnsSeed = [];

// Payment Voucher (PV): terbit saat kas benar-benar keluar, satu per pembayaran.
// Nomornya dipakai jurnal kas keluar; Payment Request tetap jadi dokumen permintaannya.
export const vouchersSeed = prsSeed
  .filter((p) => p.status === 'dibayar')
  .map((p, i) => ({
    id: `pv-${String(i + 1).padStart(4, '0')}`,
    number: `PV/${p.paidAt.slice(0, 4)}/${p.paidAt.slice(5, 7)}/${String(i + 1).padStart(4, '0')}`,
    prIds: [p.id],
    vendorId: p.vendorId,
    date: p.paidAt,
    amount: p.amount,
    source: 'BCA 288-123-9001 · Kas Operasional',
    payRef: `TRF-${p.paidAt.replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`,
    proofs: [`bukti-transfer-${p.number.split('/').pop()}.pdf`],
    note: '',
    paidBy: 'Dewi Lestari · Staff Finance',
  }));
