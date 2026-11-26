// Data & aturan modul Pembelian — mengikuti artifact "Skenario Pembelian Proapps" (flow baru).
// Alur: permintaan → verifikasi → pengadaan (bidding | vendor tunggal) → approval → PO → DP → penerimaan (FPB/BAPP) → faktur → pelunasan.
import { TODAY } from '@/pages/Penjualan/data.js';
import { paymentTermsSeed, snapshotTerm } from './paymentTerms.js';

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
  { value: 'cfo', label: 'Chief Finance', color: 'indigo', person: { name: 'Hendra Wijaya', title: 'Chief Finance' } },
  { value: 'finance', label: 'Finance', color: 'grape', person: { name: 'Dewi Lestari', title: 'Staff Finance' } },
  // Superadmin memegang semua hak sekaligus, termasuk melewati pemisahan tugas.
  { value: 'superadmin', label: 'Superadmin', color: 'dark', person: { name: 'Admin Sistem', title: 'Superadmin' } },
];
// Peran lama dipetakan ke peran baru supaya data dan state tersimpan tetap terbaca.
const legacyRole = {
  atasan: 'bm', chief_seksi: 'bm', chief_engineering: 'bm',
  approver: 'bm', approver_pengadaan: 'bm', building_manager: 'bm',
  // finance_manager dulu dipetakan ke Building Manager; sekarang ada perannya sendiri.
  finance_manager: 'cfo', chief_finance: 'cfo', kasir: 'finance', pic_jasa: 'gudang',
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
// Nama saja, mis. "Maya Sari". Dipakai blok tanda tangan di PDF.
export const personName = (role) => roleOf(role)?.person?.name ?? '';

// Katalog barang & jasa yang bisa dibeli. Ini "tampilan beli" dari master Produk & Jasa
// (src/pages/Produk/catalog.js): isinya ditulis ulang di tempat setiap katalog berubah,
// jadi produk baru yang ditandai "dibeli" langsung bisa dipilih di permintaan dan faktur.
// Bentuk tiap baris tetap { id, name, description, kind, unit, price }.
export { purchaseView as productCatalog } from '@/pages/Produk/catalog.js';

// Pilihan satuan pada baris dokumen — diambil dari master Satuan (Produk & Jasa).
export { unitNames as units } from '@/pages/Produk/catalog.js';
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
// Termin dokumen dirakit dari katalog syarat pembayaran, persis seperti yang dilakukan
// QuoteModal: id-nya ikut katalog (jadi hitungan "dipakai N dokumen" jalan) dan salinan
// mekanismenya ikut tersimpan (jadi artinya tidak berubah walau katalognya diubah).
const term = (id, params = {}) => {
  const def = paymentTermsSeed.find((t) => t.id === id);
  return { type: def.id, ...snapshotTerm(def), ...def.defaults, ...params };
};
// Baris jadwal pada SPK bertermin — bentuknya sama dengan keluaran expandSchedule().
const schedItem = (id, desc, slot, slotOf, price, extra = {}) => ({
  id, desc, spec: '', qty: 1, unit: 'termin', kind: 'jasa', slot, slotOf, price, ppnRate: RULES.ppn, ...extra,
});
const TERM = {
  cad: () => term('cad'),
  dp: (pct) => term('dp-30', { dpPct: pct }),
  cbd: () => term('cbd', { dpPct: 100 }),
  postpaid: (days) => term('net-30', { dueDays: days }),
};

// --- Dokumen contoh -------------------------------------------------------------------------

// PO lama (Selesai) sebagai riwayat pembelian.
const poOld = {
  id: 'po-0031',
  number: 'PO/2026/09/0031',
  date: '2026-09-14',
  fppbjId: 'fppbj-po-0031',
  vendorId: 'v-alfa',
  kind: 'barang',
  sent: true,
  term: TERM.cad(),
  expectedAt: '2026-09-21',
  warehouse: 'Gudang Utama',
  warehouseId: 'wh-1',
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
  warehouseId: 'wh-1',
  items: [
    poItem('c1', 'Kursi ergonomis meeting', 10, 'pcs', 1250000, {
      spec: 'Sandaran jaring, roda, adjustable',
    }),
  ],
  note: '',
};

// --- Tujuh kasus uji penerimaan -----------------------------------------------------------------
// Tiap kasus: permintaan jasa/barang yang pengadaannya sudah disetujui, lalu PO/SPK yang sudah
// dikirim ke vendor sehingga FPB / BAPP bisa langsung dicatat.
const kasus = ({ no, purpose, dept, vendorId, termId, items, poItems, quotePrice, quoteSpec, lead, isJasa, termParams = {}, withReceipt = true, seq = `01${no}` }) => {
  const id = `uji-${no}`;
  const t = term(termId, termParams);
  return {
    fppbj: {
      id: `fppbj-${id}`,
      number: `FPPBJ/2026/11/${seq}`,
      date: '2026-11-02',
      neededBy: '2026-12-20',
      dept,
      purpose,
      iom: { no: '', date: '', files: [] },
      // Lokasi kirim permintaan; diwarisi PO saat pengadaan disetujui.
      warehouseId: isJasa ? null : 'wh-1',
      items,
      status: 'dalam_pengadaan',
      note: '',
      returnNote: '',
      submittedAt: '2026-11-02',
      verifiedAt: '2026-11-03',
      routedAt: '2026-11-03',
      route: 'bidding',
      single: { on: true, reason: 'Vendor langganan gedung, hanya ini yang sanggup sesuai jadwal.' },
      quotes: [
        {
          id: `q-${id}`,
          vendorId,
          no: `QT-${no}-2026`,
          validUntil: '2026-12-31',
          desc: quoteSpec,
          file: `penawaran-${id}.pdf`,
          term: t,
          lead,
          warranty: isJasa ? '6 bulan' : '12 bulan',
          withReceipt,
          lines: items.map((it) => ({ itemId: it.id, price: quotePrice[it.id], spec: it.spec || '-', taxes: ['ppn'] })),
        },
      ],
      procurement: { kind: 'bidding', status: 'disetujui', note: '', reason: '', negotiation: '', winners: {}, finals: {} },
      requester: 'Andi Wijaya · Staff Housekeeping',
    },
    po: {
      id: `po-${id}`,
      withReceipt,
      number: `${isJasa ? 'SPK' : 'PO'}/2026/11/${seq}`,
      date: '2026-11-03',
      fppbjId: `fppbj-${id}`,
      vendorId,
      sent: true,
      sentAt: '2026-11-03',
      term: t,
      expectedAt: '2026-12-15',
      warehouse: isJasa ? '-' : 'Gudang Utama',
      warehouseId: isJasa ? null : 'wh-1',
      ppnIncluded: false,
      items: poItems,
      note: '',
    },
  };
};

const uji = [
  // 1. CAD — barang, bayar setelah diterima. Dua item dengan qty besar: FPB sebagian bisa diuji.
  kasus({
    no: '1', purpose: 'ATK bulanan lantai 1-3', dept: 'Umum', vendorId: 'v-alfa', termId: 'cad', lead: 7,
    items: [item('a1', 'Kertas A4 80 gsm', 50, 'rim'), item('a2', 'Map plastik', 200, 'pcs')],
    quotePrice: { a1: 56000, a2: 3500 },
    quoteSpec: 'Harga belum termasuk PPN, kirim ke gudang utama.',
    poItems: [poItem('a1', 'Kertas A4 80 gsm', 50, 'rim', 56000, { ppnRate: RULES.ppn }), poItem('a2', 'Map plastik', 200, 'pcs', 3500, { ppnRate: RULES.ppn })],
  }),
  // 2. DP + pelunasan — barang, ada uang muka 30% sebelum barang datang.
  kasus({
    no: '2', purpose: 'Kursi kantor ruang meeting baru', dept: 'Umum', vendorId: 'v-bintang', termId: 'dp-30', lead: 21,
    items: [item('b1', 'Kursi kantor ergonomis', 12, 'unit', { spec: 'Sandaran jaring, roda, adjustable' })],
    quotePrice: { b1: 1450000 },
    quoteSpec: 'Uang muka 30% sebelum produksi, sisanya setelah barang diterima.',
    poItems: [poItem('b1', 'Kursi kantor ergonomis', 12, 'unit', 1450000, { spec: 'Sandaran jaring, roda, adjustable', ppnRate: RULES.ppn })],
  }),
  // 3. CBD — barang, dibayar penuh sebelum dikirim.
  kasus({
    // Dibayar penuh sebelum dikirim dan tidak lewat gudang: fakturnya langsung dari PO.
    no: '3', purpose: 'Printer dan tinta lantai 2', dept: 'Keuangan', vendorId: 'v-delta', termId: 'cbd', lead: 10, withReceipt: false,
    items: [item('c1', 'Printer laser A4', 3, 'unit'), item('c2', 'Tinta printer', 10, 'box')],
    quotePrice: { c1: 4200000, c2: 185000 },
    quoteSpec: 'Pembayaran penuh di muka, kirim setelah dana masuk.',
    poItems: [poItem('c1', 'Printer laser A4', 3, 'unit', 4200000, { ppnRate: RULES.ppn }), poItem('c2', 'Tinta printer', 10, 'box', 185000, { ppnRate: RULES.ppn })],
  }),
  // 4. Bayar penuh di akhir — jasa tanpa jadwal termin: BAPP sekali, pakai isian qty.
  kasus({
    no: '4', purpose: 'Servis AC seluruh lantai', dept: 'Engineering', vendorId: 'v-delta', termId: 'net-30', lead: 14, isJasa: true,
    items: [item('d1', 'Jasa servis AC', 20, 'unit', { kind: 'jasa', spec: 'Cuci evaporator, isi freon bila perlu' })],
    quotePrice: { d1: 350000 },
    quoteSpec: 'Sudah termasuk material pembersih dan freon standar.',
    poItems: [poItem('d1', 'Jasa servis AC', 20, 'unit', 350000, { kind: 'jasa', spec: 'Cuci evaporator, isi freon bila perlu', ppnRate: RULES.ppn })],
  }),
  // 5. Termin progres — jasa, 3 milestone. BAPP dicentang per termin, tanpa kunci tanggal.
  kasus({
    no: '5', purpose: 'Renovasi lobi gedung A', dept: 'Engineering', vendorId: 'v-mitra', termId: 'progres-3', lead: 60, isJasa: true,
    items: [item('e1', 'Renovasi lobi gedung A', 1, 'paket', { kind: 'jasa', spec: 'Lantai, plafon, pencahayaan' })],
    quotePrice: { e1: 180000000 },
    quoteSpec: 'Sudah termasuk material, tenaga kerja, dan pembersihan akhir.',
    poItems: [
      schedItem('e1-s1', 'Renovasi lobi gedung A — Termin 1 dari 3 · 33.3%', 1, 3, 59940000, { pct: 33.3 }),
      schedItem('e1-s2', 'Renovasi lobi gedung A — Termin 2 dari 3 · 33.3%', 2, 3, 59940000, { pct: 33.3 }),
      schedItem('e1-s3', 'Renovasi lobi gedung A — Termin 3 dari 3 · 33.4%', 3, 3, 60120000, { pct: 33.4 }),
    ],
  }),
  // 6. DP + termin progres — uang muka 20% di luar jadwal, sisanya dibagi 4 termin.
  kasus({
    no: '6', purpose: 'Pembangunan pos jaga depan', dept: 'Engineering', vendorId: 'v-prima', termId: 'dp-progres', lead: 90, isJasa: true,
    items: [item('f1', 'Pembangunan pos jaga', 1, 'paket', { kind: 'jasa', spec: 'Struktur, atap, instalasi listrik' })],
    quotePrice: { f1: 100000000 },
    quoteSpec: 'Uang muka 20% untuk material awal, sisanya per termin progres.',
    poItems: [
      schedItem('f1-s1', 'Pembangunan pos jaga — Termin 1 dari 4 · 25%', 1, 4, 20000000, { pct: 25 }),
      schedItem('f1-s2', 'Pembangunan pos jaga — Termin 2 dari 4 · 25%', 2, 4, 20000000, { pct: 25 }),
      schedItem('f1-s3', 'Pembangunan pos jaga — Termin 3 dari 4 · 25%', 3, 4, 20000000, { pct: 25 }),
      schedItem('f1-s4', 'Pembangunan pos jaga — Termin 4 dari 4 · 25%', 4, 4, 20000000, { pct: 25 }),
    ],
  }),
  // 7. Berkala per periode — kontrak triwulan mulai Januari. Tiga periode sudah lewat dan bisa
  //    di-BAPP; periode Okt-Des masih terkunci sampai 31 Des, untuk menguji kunci tanggal.
  kasus({
    // Layanan berkala yang ditagih per periode tanpa berita acara per termin.
    no: '7', purpose: 'Cleaning service gedung 2026', dept: 'Housekeeping', vendorId: 'v-karya', termId: 'bulanan-12', lead: 7, isJasa: true, withReceipt: false,
    termParams: { period: 'triwulan', periods: 4 },
    items: [item('g1', 'Cleaning service gedung', 1, 'paket', { kind: 'jasa', spec: '6 orang, 6 hari kerja per minggu' })],
    quotePrice: { g1: 120000000 },
    quoteSpec: 'Sudah termasuk alat, bahan pembersih, dan seragam.',
    poItems: [
      schedItem('g1-s1', 'Cleaning service gedung — Triwulan ke-1 dari 4', 1, 4, 30000000, { unit: 'periode', periodFrom: '2026-01-01', periodTo: '2026-03-31' }),
      schedItem('g1-s2', 'Cleaning service gedung — Triwulan ke-2 dari 4', 2, 4, 30000000, { unit: 'periode', periodFrom: '2026-04-01', periodTo: '2026-06-30' }),
      schedItem('g1-s3', 'Cleaning service gedung — Triwulan ke-3 dari 4', 3, 4, 30000000, { unit: 'periode', periodFrom: '2026-07-01', periodTo: '2026-09-30' }),
      schedItem('g1-s4', 'Cleaning service gedung — Triwulan ke-4 dari 4', 4, 4, 30000000, { unit: 'periode', periodFrom: '2026-10-01', periodTo: '2026-12-31' }),
    ],
  }),
  // --- Dua kasus kembar untuk menguji penanda serah terima -------------------------------------
  // Isinya sengaja persis sama — vendor, termin, barang, qty, harga — supaya satu-satunya
  // yang berbeda adalah ada atau tidaknya FPB. Yang satu melewati gudang, yang satu dikirim
  // vendor langsung ke lokasi kerja dan ditagih tanpa penerimaan.
  // 8. Ada serah terima: PO -> FPB -> faktur dari FPB.
  kasus({
    no: '8', purpose: 'Pipa PVC dan elbow — stok gudang', dept: 'Engineering', vendorId: 'v-prima', termId: 'cad', lead: 7,
    withReceipt: true,
    items: [
      item('h1', 'Pipa PVC', 40, 'pcs', { spec: 'Diameter 3 inci, panjang 4 m' }),
      item('h2', 'Elbow PVC', 60, 'pcs', { spec: 'Sambungan 90 derajat, 3 inci' }),
    ],
    quotePrice: { h1: 65000, h2: 6500 },
    quoteSpec: 'Kirim ke gudang utama, diterima dan dihitung petugas gudang.',
    poItems: [
      poItem('h1', 'Pipa PVC', 40, 'pcs', 65000, { spec: 'Diameter 3 inci, panjang 4 m', ppnRate: RULES.ppn }),
      poItem('h2', 'Elbow PVC', 60, 'pcs', 6500, { spec: 'Sambungan 90 derajat, 3 inci', ppnRate: RULES.ppn }),
    ],
  }),
  // 9. Tanpa serah terima: PO -> faktur langsung dari PO.
  kasus({
    no: '9', purpose: 'Pipa PVC dan elbow — kirim langsung ke lokasi lantai 4', dept: 'Engineering', vendorId: 'v-prima', termId: 'cad', lead: 7,
    withReceipt: false,
    items: [
      item('j1', 'Pipa PVC', 40, 'pcs', { spec: 'Diameter 3 inci, panjang 4 m' }),
      item('j2', 'Elbow PVC', 60, 'pcs', { spec: 'Sambungan 90 derajat, 3 inci' }),
    ],
    quotePrice: { j1: 65000, j2: 6500 },
    quoteSpec: 'Dibongkar langsung di lokasi kerja lantai 4, tidak melewati gudang.',
    poItems: [
      poItem('j1', 'Pipa PVC', 40, 'pcs', 65000, { spec: 'Diameter 3 inci, panjang 4 m', ppnRate: RULES.ppn }),
      poItem('j2', 'Elbow PVC', 60, 'pcs', 6500, { spec: 'Sambungan 90 derajat, 3 inci', ppnRate: RULES.ppn }),
    ],
  }),
  // 10. Jasa tanpa jadwal termin: BAPP-nya dicatat per lingkup kerja — diterima atau ditolak,
  // bukan diisi qty. Dua lingkup yang berbeda supaya satu bisa diterima dan satu ditolak.
  kasus({
    no: '10', seq: '020', purpose: 'Servis AC dan pest control triwulan IV', dept: 'Engineering',
    vendorId: 'v-delta', termId: 'net-30', lead: 14, isJasa: true,
    items: [
      item('m1', 'Jasa servis AC', 12, 'unit', { kind: 'jasa', spec: 'Lantai 1-3, cuci evaporator dan isi freon' }),
      item('m2', 'Jasa pest control', 1, 'paket', { kind: 'jasa', spec: 'Seluruh area gedung, termasuk basement' }),
    ],
    quotePrice: { m1: 350000, m2: 1800000 },
    quoteSpec: 'Dikerjakan di luar jam operasional, laporan hasil diserahkan setelah selesai.',
    poItems: [
      poItem('m1', 'Jasa servis AC', 12, 'unit', 350000, { kind: 'jasa', spec: 'Lantai 1-3, cuci evaporator dan isi freon', ppnRate: RULES.ppn }),
      poItem('m2', 'Jasa pest control', 1, 'paket', 1800000, { kind: 'jasa', spec: 'Seluruh area gedung, termasuk basement', ppnRate: RULES.ppn }),
    ],
  }),
];

export const fppbjSeed = [
  // --- Tujuh kasus uji: satu per syarat pembayaran, semuanya sudah sampai PO/SPK ----------------
  // Barang -> PO -> FPB. Jasa -> SPK -> BAPP. Jalur vendor tunggal dipakai semuanya supaya
  // rantainya pendek dan yang diuji tetap penerimaannya, bukan proses biddingnya.
  ...uji.map((u) => u.fppbj),
  {
    id: 'fppbj-0001',
    number: 'FPPBJ/2026/11/0001',
    date: '2026-11-03',
    neededBy: '2026-11-20',
    dept: 'Housekeeping',
    purpose: 'Meja lipat untuk ruang pameran',
    iom: { no: 'IOM/OPS/11/021', date: '2026-11-02', file: 'iom-meja-lipat.pdf' },
    warehouseId: 'wh-1',
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
    warehouseId: 'wh-1',
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
    warehouseId: 'wh-1',
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
    warehouseId: 'wh-1',
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
    warehouseId: 'wh-1',
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
  // Sudah diverifikasi dan jalurnya ditetapkan bidding, tapi penawaran vendornya belum ada
  // satu pun. Inilah keadaan pengadaan yang paling sering tertahan: jalurnya sudah jelas,
  // yang kurang tinggal mengundang vendor dan memasukkan penawarannya.
  {
    id: 'fppbj-0006',
    number: 'FPPBJ/2026/10/0007',
    date: '2026-10-28',
    neededBy: '2026-12-01',
    dept: 'Security',
    purpose: 'Radio HT dan seragam untuk tim security',
    iom: { no: '', date: '', file: '' },
    warehouseId: 'wh-1',
    items: [
      item('s1', 'Radio HT', 10, 'unit', { spec: 'Dua arah, baterai cadangan, jangkauan seluruh gedung' }),
      item('s2', 'Seragam satpam', 15, 'set', { spec: 'Lengkap dengan atribut dan sepatu' }),
    ],
    status: 'dalam_pengadaan',
    note: '',
    returnNote: '',
    submittedAt: '2026-10-28',
    verifiedAt: '2026-10-29',
    routedAt: '2026-10-30',
    route: 'bidding',
    quotes: [],
    single: { on: false, reason: '' },
    procurement: {
      kind: 'bidding',
      status: 'draf',
      note: '',
      reason: '',
      termNote: '',
      negotiation: '',
      winners: {},
      finals: {},
      scores: {},
    },
    requester: 'Bagus Nugroho · Staff Security',
  },
];

// PO jasa yang sudah diterima dan difaktur tapi belum dibayar (lewat jatuh tempo) → contoh umur hutang.
const spkLift = {
  id: 'po-0036',
  number: 'SPK/2026/10/0036',
  date: '2026-10-01',
  fppbjId: 'fppbj-po-0036',
  vendorId: 'v-mitra',
  sent: true,
  term: TERM.postpaid(30),
  expectedAt: '2026-10-15',
  warehouse: '-',
  warehouseId: null,
  items: [poItem('s1', 'Servis berkala lift gedung A', 1, 'paket', 8500000, { kind: 'jasa' })],
  note: '',
};


// Riwayat PO selesai lainnya (diterima penuh, difaktur, lunas).
const histPo = (id, number, date, vendorId, items, term = TERM.cad()) => ({
  id,
  number,
  date,
  // Diisi histFppbj di bawah: setiap PO lahir dari permintaan, termasuk PO riwayat.
  fppbjId: `fppbj-${id}`,
  vendorId,
  sent: true,
  term,
  expectedAt: date,
  warehouse: 'Gudang Utama',
  warehouseId: 'wh-1',
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
// PO yang dikirim bertahap: tiga FPB atas satu PO, masing-masing bertanggal berbeda.
// Dipakai untuk mencoba menggabungkan beberapa penerimaan ke satu faktur — termasuk apa yang
// terjadi pada jatuh tempo ketika tanggal penerimaannya tidak sama.
const poAlfaStaged = histPo('po-0041', 'PO/2026/10/0041', '2026-10-20', 'v-alfa', [
  poItem('a1', 'Kertas A4 80 gsm', 50, 'rim', 56000, { ppnRate: RULES.ppn }),
  poItem('a2', 'Map plastik', 200, 'pcs', 3500, { ppnRate: RULES.ppn }),
]);

// Pesanan besar yang dikirim enam kali: dipakai untuk mencoba kepala kartu saat penerimaannya
// lebih dari lima — nomornya diringkas jadi satu badge yang membuka daftar.
const poBintangStaged = histPo('po-0042', 'PO/2026/09/0042', '2026-09-05', 'v-bintang', [
  poItem('k1', 'Kursi kantor ergonomis', 60, 'unit', 1450000, { spec: 'Sandaran jaring, roda, adjustable', ppnRate: RULES.ppn }),
]);

// Jasa semua → SPK, dengan termin jasa "bayar penuh di akhir".
const poMitra1 = histPo('po-0025', 'SPK/2026/08/0025', '2026-08-18', 'v-mitra', [
  poItem('m1', 'Jasa servis AC', 20, 'unit', 330000, { kind: 'jasa' }),
], TERM.postpaid(30));
// --- Contoh kebijakan harga perolehan ------------------------------------------------------
// Satu rangkaian dokumen yang memperlihatkan ketiga aturan sekaligus: vendor
// menagih ongkir terpisah (ongkir masuk harga barang), lalu sebagian barangnya
// diretur setelah difaktur (retur dinilai pada harga perolehan aslinya, dan
// porsi ongkir yang tidak dikembalikan vendor menjadi beban).
//
// Ongkir Rp 91.000 dibagi menurut DPP: Map plastik Rp 350.000 dari Rp 910.000
// → Rp 35.000 (Rp 350/pcs), Kertas A4 Rp 56.000 (Rp 5.600/rim). Harga
// perolehannya menjadi Rp 3.850/pcs dan Rp 61.600/rim.
const poOngkir = {
  ...histPo('po-0045', 'PO/2026/11/0045', '2026-10-30', 'v-alfa', [
    poItem('o1', 'Map plastik', 100, 'pcs', 3500, { ppnRate: RULES.ppn }),
    poItem('o2', 'Kertas A4 80 gsm', 10, 'rim', 56000, { ppnRate: RULES.ppn }),
  ]),
  shipping: 91_000,
};
const rcOngkir = {
  id: 'fpb-0045',
  number: 'FPB/2026/11/0003',
  poId: 'po-0045',
  vendorId: 'v-alfa',
  date: '2026-11-03',
  doNumber: 'SJ-ALF-7781',
  kind: 'barang',
  createdBy: 'Rudi Hermawan · Kepala Gudang',
  lines: [
    { itemId: 'o1', qty: 100, rejected: 0 },
    { itemId: 'o2', qty: 10, rejected: 0 },
  ],
  note: 'Ongkir ditagih terpisah pada faktur yang sama.',
};
const invOngkir = {
  id: 'fkt-0045',
  number: 'FKT/2026/11/0003',
  vendorNo: 'INV-ALF-10452',
  poId: 'po-0045',
  vendorId: 'v-alfa',
  date: '2026-11-03',
  dueDate: '2026-12-03',
  lines: [
    { receiptId: 'fpb-0045', itemId: 'o1', qty: 100, price: 3500 },
    { receiptId: 'fpb-0045', itemId: 'o2', qty: 10, price: 56000 },
  ],
  pphPct: 0,
  files: ['invoice-fkt-0045.pdf'],
};
// Vendor hanya memotong tagihan sebesar barangnya; ongkir 20 pcs (Rp 7.000)
// tidak dikembalikan sehingga jatuh ke Pengiriman & Pengangkutan.
const rtrOngkir = {
  id: 'rtr-0001',
  number: 'RTR/2026/11/0001',
  invoiceId: 'fkt-0045',
  vendorId: 'v-alfa',
  date: '2026-11-04',
  reason: 'Map plastik sobek pada 20 pcs.',
  settlement: 'potong',
  freightRefunded: false,
  status: 'selesai',
  lines: [{ itemId: 'o1', qty: 20, price: 3500 }],
};

const histDocs = [
  { po: poAlfa1, rc: ['fpb-0005', 'FPB/2026/07/0005', '2026-07-12', 'SJ-ALF-6120'], inv: ['fkt-0014', 'FKT/2026/07/0014', 'INV-ALF-70231', '2026-07-14', '2026-08-13'], pr: ['pr-0010', 'PR/2026/08/0010', '2026-08-10'] },
  { po: poAlfa2, rc: ['fpb-0006', 'FPB/2026/08/0006', '2026-08-09', 'SJ-ALF-6544'], inv: ['fkt-0017', 'FKT/2026/08/0017', 'INV-ALF-80377', '2026-08-11', '2026-09-10'], pr: ['pr-0013', 'PR/2026/09/0013', '2026-09-08'] },
  { po: poBintang1, rc: ['fpb-0004', 'FPB/2026/06/0004', '2026-06-20', 'SJ-BF-2210'], inv: ['fkt-0011', 'FKT/2026/06/0011', 'INV-BF-60418', '2026-06-22', '2026-07-22'], pr: ['pr-0008', 'PR/2026/07/0008', '2026-07-20'] },
  { po: poMitra1, rc: ['bapp-0002', 'BAPP/2026/08/0002', '2026-08-28', 'BAPP-MTL-0828'], inv: ['fkt-0019', 'FKT/2026/08/0019', 'INV-MTL-2208', '2026-08-29', '2026-09-28'], pr: ['pr-0014', 'PR/2026/09/0014', '2026-09-25'] },
];
const receiptOf = ({ po, rc }) => ({
  id: rc[0],
  number: rc[1],
  poId: po.id,
  vendorId: po.vendorId,
  date: rc[2],
  doNumber: rc[3],
  kind: po.items.every((i) => i.kind === 'jasa') ? 'jasa' : 'barang',
  createdBy: 'Rudi Hermawan · Kepala Gudang',
  lines: po.items.map((i) => ({ itemId: i.id, qty: i.qty, rejected: 0 })),
  note: '',
});
const histReceipts = histDocs.map(receiptOf);
const invoiceOf = ({ po, rc, inv }) => ({
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
});
const histInvoices = histDocs.map(invoiceOf);
const prOf = ({ po, inv, pr }) => {
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
};
const histPrs = histDocs.map(prOf);

// --- Pembelian di balik penerimaan contoh Gudang ------------------------------------------------
// Riwayat mutasi Gudang (Gudang/stock.js, mv-04 … mv-19) mencatat delapan penerimaan barang
// bernomor FPB. Dokumen Pembelian-nya ada di sini dengan id dan nomor FPB yang sama, jadi jurnal
// penerimaannya dibaca dari mutasi itu (lihat Pembelian/journal.js) dan Barang Diterima Belum
// Ditagih tertutup oleh fakturnya. Harga PO = harga perolehan di mutasinya.
//   Jul–Sep : difaktur dan lunas · Okt : difaktur, belum jatuh tempo · akhir Okt & Nov : menunggu faktur
const gPo = (id, number, date, vendorId, productId, desc, qty, unit, price) =>
  histPo(id, number, date, vendorId, [poItem('g1', desc, qty, unit, price, { productId })]);
const gudangDocs = [
  { po: gPo('po-0021', 'PO/2026/07/0021', '2026-07-03', 'v-karya', 'kertas-a4', 'Kertas A4 80 gsm', 40, 'rim', 56000),
    rc: ['gr-19', 'FPB/2026/07/0019', '2026-07-08', 'SJ-KO-0708'], inv: ['fkt-0015', 'FKT/2026/07/0015', 'INV-KO-0710', '2026-07-10', '2026-08-09'], pr: ['pr-0009', 'PR/2026/08/0009', '2026-08-07'],
    fppbj: { seq: '0022', purpose: 'Stok kertas Juli', dept: 'Umum', requester: 'Andi Wijaya · Staff Housekeeping' } },
  { po: gPo('po-0023', 'PO/2026/08/0023', '2026-08-01', 'v-karya', 'map-plastik', 'Map plastik', 100, 'pcs', 3500),
    rc: ['gr-24', 'FPB/2026/08/0024', '2026-08-05', 'SJ-KO-0805'], inv: ['fkt-0016', 'FKT/2026/08/0016', 'INV-KO-0806', '2026-08-06', '2026-09-05'], pr: ['pr-0012', 'PR/2026/09/0012', '2026-09-03'],
    fppbj: { seq: '0023', purpose: 'Map arsip Agustus', dept: 'Keuangan', requester: 'Maya Sari · Staff Keuangan' } },
  { po: gPo('po-0026', 'PO/2026/09/0026', '2026-09-09', 'v-karya', 'kertas-a4', 'Kertas A4 80 gsm', 50, 'rim', 56000),
    rc: ['gr-28', 'FPB/2026/09/0028', '2026-09-14', 'SJ-KO-0914'], inv: ['fkt-0020', 'FKT/2026/09/0020', 'INV-KO-0915', '2026-09-15', '2026-10-15'], pr: ['pr-0016', 'PR/2026/10/0016', '2026-10-13'],
    fppbj: { seq: '0024', purpose: 'Stok kertas September', dept: 'Umum', requester: 'Andi Wijaya · Staff Housekeeping' } },
  { po: gPo('po-0033', 'PO/2026/10/0033', '2026-10-14', 'v-alfa', 'pipa-pvc', 'Pipa PVC', 64, 'batang', 65000),
    rc: ['gr-37', 'FPB/2026/10/0037', '2026-10-20', 'SJ-ALF-7020'], inv: ['fkt-0025', 'FKT/2026/10/0025', 'INV-ALF-10211', '2026-10-21', '2026-11-20'],
    fppbj: { seq: '0025', purpose: 'Perbaikan saluran air basement', dept: 'Engineering', requester: 'Budi Santoso · Teknisi' } },
  { po: gPo('po-0034', 'PO/2026/10/0034', '2026-10-15', 'v-alfa', 'elbow-pvc', 'Elbow PVC', 60, 'pcs', 6500),
    rc: ['gr-38', 'FPB/2026/10/0038', '2026-10-22', 'SJ-ALF-7022'], inv: ['fkt-0026', 'FKT/2026/10/0026', 'INV-ALF-10233', '2026-10-23', '2026-11-22'],
    fppbj: { seq: '0026', purpose: 'Sambungan pipa saluran basement', dept: 'Engineering', requester: 'Budi Santoso · Teknisi' } },
  { po: gPo('po-0038', 'PO/2026/10/0038', '2026-10-24', 'v-alfa', 'cairan-lantai', 'Cairan pembersih lantai', 14, 'karton', 85000),
    rc: ['gr-41', 'FPB/2026/10/0041', '2026-10-30', 'SJ-ALF-7030'], inv: ['fkt-0027', 'FKT/2026/10/0027', 'INV-ALF-10310', '2026-10-31', '2026-11-30'],
    fppbj: { seq: '0027', purpose: 'Bahan kebersihan November', dept: 'Umum', requester: 'Andi Wijaya · Staff Housekeeping' } },
  { po: gPo('po-0039', 'PO/2026/10/0039', '2026-10-25', 'v-alfa', 'kain-pel', 'Kain pel microfiber', 11, 'pcs', 22500),
    rc: ['gr-42', 'FPB/2026/10/0042', '2026-10-31', 'SJ-ALF-7031'],
    fppbj: { seq: '0028', purpose: 'Kain pel pengganti', dept: 'Umum', requester: 'Andi Wijaya · Staff Housekeeping' } },
  { po: gPo('po-0043', 'PO/2026/10/0043', '2026-10-28', 'v-karya', 'tinta-printer', 'Tinta printer', 9, 'box', 185000),
    rc: ['gr-2', 'FPB/2026/11/0002', '2026-11-03', 'SJ-KO-1103'],
    fppbj: { seq: '0029', purpose: 'Tinta printer kuartal IV', dept: 'Keuangan', requester: 'Maya Sari · Staff Keuangan' } },
];
const gudangReceipts = gudangDocs.map(receiptOf);
const gudangInvoices = gudangDocs.filter((d) => d.inv).map(invoiceOf);
const gudangPrs = gudangDocs.filter((d) => d.pr).map(prOf);



// --- Permintaan di balik PO riwayat ---------------------------------------------------------
// Pesanan lama yang sudah selesai juga berasal dari FPPBJ (jalur vendor tunggal, pengadaan
// disetujui). Tanpanya detail PO dan pesan ulang tidak punya "Asal pesanan" untuk ditunjuk.
const histFppbj = (po, { seq, purpose, dept, requester }) => {
  const d = (n) => new Date(Date.parse(po.date) - n * 864e5).toISOString().slice(0, 10);
  const isJasa = po.items.every((i) => i.kind === 'jasa');
  return {
    id: po.fppbjId,
    number: `FPPBJ/${po.date.slice(0, 4)}/${po.date.slice(5, 7)}/${seq}`,
    date: d(6),
    neededBy: d(-14),
    dept,
    purpose,
    iom: { no: '', date: '', files: [] },
    warehouseId: isJasa ? null : po.warehouseId,
    items: po.items.map(({ price, ...it }) => (void price, it)),
    // Semua pesanannya sudah tuntas.
    status: 'selesai',
    note: '',
    returnNote: '',
    submittedAt: d(6),
    verifiedAt: d(5),
    routedAt: d(5),
    route: 'bidding',
    single: { on: true, reason: 'Vendor langganan, harga sesuai kontrak tahunan.' },
    quotes: [{
      id: `q-${po.id}`,
      vendorId: po.vendorId,
      no: `QT-${po.number.split('/').pop()}`,
      validUntil: d(-30),
      desc: '',
      file: `penawaran-${po.id}.pdf`,
      term: po.term,
      lead: 0,
      warranty: isJasa ? '6 bulan' : '12 bulan',
      lines: po.items.map((it) => ({ itemId: it.id, price: it.price, spec: it.spec || '-', taxes: it.ppnRate ? ['ppn'] : [] })),
    }],
    procurement: { kind: 'bidding', status: 'disetujui', note: '', reason: '', negotiation: '', winners: {}, finals: {} },
    requester,
  };
};
const histFppbjs = [
  histFppbj(poBintang1, { seq: '0009', purpose: 'Meja lipat dan lemari arsip ruang rapat', dept: 'Umum', requester: 'Andi Wijaya · Staff Housekeeping' }),
  histFppbj(poAlfa1, { seq: '0011', purpose: 'ATK bulanan Juli', dept: 'Keuangan', requester: 'Maya Sari · Staff Keuangan' }),
  histFppbj(poAlfa2, { seq: '0014', purpose: 'ATK bulanan Agustus', dept: 'Keuangan', requester: 'Maya Sari · Staff Keuangan' }),
  histFppbj(poMitra1, { seq: '0015', purpose: 'Servis AC berkala semester II', dept: 'Engineering', requester: 'Budi Santoso · Teknisi' }),
  histFppbj(poAlfaStaged, { seq: '0019', purpose: 'Stok kertas dan map kuartal IV', dept: 'Umum', requester: 'Andi Wijaya · Staff Housekeeping' }),
  histFppbj(poBintangStaged, { seq: '0016', purpose: 'Kursi kantor ruang kerja baru', dept: 'Umum', requester: 'Andi Wijaya · Staff Housekeeping' }),
  histFppbj(poOld, { seq: '0017', purpose: 'ATK bulanan September', dept: 'Keuangan', requester: 'Maya Sari · Staff Keuangan' }),
  histFppbj(spkLift, { seq: '0018', purpose: 'Servis berkala lift gedung A', dept: 'Engineering', requester: 'Budi Santoso · Teknisi' }),
  histFppbj(poOngkir, { seq: '0021', purpose: 'Map plastik dan kertas ruang arsip', dept: 'Umum', requester: 'Andi Wijaya · Staff Housekeeping' }),
  ...gudangDocs.map((d) => histFppbj(d.po, d.fppbj)),
];
// fppbjSeed didefinisikan di atas PO riwayat, jadi permintaannya ditambahkan di sini.
fppbjSeed.push(...histFppbjs);

export const posSeed = [...uji.map((u) => u.po), poOngkir, poOld, poChair, spkLift, poAlfaStaged, poBintangStaged, poAlfa2, poAlfa1, poBintang1, poMitra1, ...gudangDocs.map((d) => d.po)];

// poOld: selesai (diterima penuh, difaktur, lunas). poChair: diterima sebagian, DP disetujui.
export const receiptsSeed = [
  rcOngkir,
  ...histReceipts,
  ...gudangReceipts,
  {
    id: 'bapp-0003',
    number: 'BAPP/2026/10/0003',
    poId: 'po-0036',
    vendorId: 'v-mitra',
    date: '2026-10-15',
    kind: 'jasa',
    doNumber: 'BAPP-MTL-1015',
    file: 'bapp-mtl-1015-ttd.pdf',
    createdBy: 'Rudi Hermawan · Kepala Gudang',
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
    createdBy: 'Rudi Hermawan · Kepala Gudang',
    lines: [
      { itemId: 'i1', qty: 50, rejected: 0 },
      { itemId: 'i2', qty: 200, rejected: 0 },
    ],
    note: '',
  },
  // Tiga FPB dari satu vendor (PT Alfa Sejahtera) atas satu PO yang dikirim bertahap.
  // Ketiganya belum difaktur, jadi satu faktur bisa mencakup dua atau tiga FPB sekaligus
  // — inilah yang dipakai untuk mencoba pilih-banyak di langkah 1 form faktur.
  {
    id: 'fpb-0013',
    number: 'FPB/2026/10/0013',
    poId: 'po-0041',
    vendorId: 'v-alfa',
    date: '2026-10-22',
    doNumber: 'SJ-ALF-8801',
    kind: 'barang',
    createdBy: 'Rudi Hermawan · Kepala Gudang',
    file: 'sj-alf-8801.pdf',
    lines: [{ itemId: 'a1', qty: 20, rejected: 0 }],
    note: 'Kiriman tahap 1: kertas sebagian.',
  },
  {
    id: 'fpb-0014',
    number: 'FPB/2026/10/0014',
    poId: 'po-0041',
    vendorId: 'v-alfa',
    date: '2026-10-27',
    doNumber: 'SJ-ALF-8814',
    kind: 'barang',
    createdBy: 'Rudi Hermawan · Kepala Gudang',
    file: 'sj-alf-8814.pdf',
    lines: [{ itemId: 'a1', qty: 30, rejected: 0 }],
    note: 'Kiriman tahap 2: sisa kertas.',
  },
  {
    id: 'fpb-0015',
    number: 'FPB/2026/11/0015',
    poId: 'po-0041',
    vendorId: 'v-alfa',
    date: '2026-11-03',
    doNumber: 'SJ-ALF-8830',
    kind: 'barang',
    createdBy: 'Rudi Hermawan · Kepala Gudang',
    file: 'sj-alf-8830.pdf',
    lines: [{ itemId: 'a2', qty: 200, rejected: 0 }],
    note: 'Kiriman tahap 3: map plastik.',
  },
  // Dua penerimaan CV Delta Elektronik dengan termin BERBEDA: satu CBD (barang), satu
  // bayar penuh di akhir (jasa). Keduanya siap difaktur tapi TIDAK boleh digabung jadi satu
  // faktur — dipakai untuk mencoba penguncian termin di langkah 1 form faktur.
  {
    id: 'fpb-0016',
    number: 'FPB/2026/11/0016',
    poId: 'po-uji-3',
    vendorId: 'v-delta',
    date: '2026-11-03',
    doNumber: 'SJ-DLT-5521',
    kind: 'barang',
    createdBy: 'Rudi Hermawan · Kepala Gudang',
    file: 'sj-dlt-5521.pdf',
    lines: [
      { itemId: 'c1', qty: 3, rejected: 0 },
      { itemId: 'c2', qty: 10, rejected: 0 },
    ],
    note: 'Printer dan tinta diterima lengkap.',
  },
  {
    id: 'bapp-0017',
    number: 'BAPP/2026/11/0017',
    poId: 'po-uji-4',
    vendorId: 'v-delta',
    date: '2026-11-04',
    doNumber: 'BAPP-DLT-1109',
    kind: 'jasa',
    createdBy: 'Budi Santoso · Teknisi Engineering',
    file: 'bapp-dlt-1109-ttd.pdf',
    lines: [{ itemId: 'd1', qty: 20, rejected: 0 }],
    note: 'Servis AC 20 unit selesai, hasil diperiksa.',
  },
  // Enam kiriman atas satu pesanan kursi; semuanya belum difaktur dan berjatuh tempo berbeda.
  {
    id: 'fpb-0018',
    number: 'FPB/2026/09/0018',
    poId: 'po-0042',
    vendorId: 'v-bintang',
    date: '2026-09-10',
    doNumber: 'SJ-BF-918',
    kind: 'barang',
    createdBy: 'Rudi Hermawan · Kepala Gudang',
    file: 'sj-bf-918.pdf',
    lines: [{ itemId: 'k1', qty: 10, rejected: 0 }],
    note: 'Kiriman tahap 1 dari 6.',
  },
  {
    id: 'fpb-0019',
    number: 'FPB/2026/09/0019',
    poId: 'po-0042',
    vendorId: 'v-bintang',
    date: '2026-09-17',
    doNumber: 'SJ-BF-919',
    kind: 'barang',
    createdBy: 'Rudi Hermawan · Kepala Gudang',
    file: 'sj-bf-919.pdf',
    lines: [{ itemId: 'k1', qty: 10, rejected: 0 }],
    note: 'Kiriman tahap 2 dari 6.',
  },
  {
    id: 'fpb-0020',
    number: 'FPB/2026/09/0020',
    poId: 'po-0042',
    vendorId: 'v-bintang',
    date: '2026-09-24',
    doNumber: 'SJ-BF-920',
    kind: 'barang',
    createdBy: 'Rudi Hermawan · Kepala Gudang',
    file: 'sj-bf-920.pdf',
    lines: [{ itemId: 'k1', qty: 10, rejected: 0 }],
    note: 'Kiriman tahap 3 dari 6.',
  },
  {
    id: 'fpb-0021',
    number: 'FPB/2026/10/0021',
    poId: 'po-0042',
    vendorId: 'v-bintang',
    date: '2026-10-01',
    doNumber: 'SJ-BF-921',
    kind: 'barang',
    createdBy: 'Rudi Hermawan · Kepala Gudang',
    file: 'sj-bf-921.pdf',
    lines: [{ itemId: 'k1', qty: 10, rejected: 0 }],
    note: 'Kiriman tahap 4 dari 6.',
  },
  {
    id: 'fpb-0022',
    number: 'FPB/2026/10/0022',
    poId: 'po-0042',
    vendorId: 'v-bintang',
    date: '2026-10-08',
    doNumber: 'SJ-BF-922',
    kind: 'barang',
    createdBy: 'Rudi Hermawan · Kepala Gudang',
    file: 'sj-bf-922.pdf',
    lines: [{ itemId: 'k1', qty: 10, rejected: 0 }],
    note: 'Kiriman tahap 5 dari 6.',
  },
  {
    id: 'fpb-0023',
    number: 'FPB/2026/10/0023',
    poId: 'po-0042',
    vendorId: 'v-bintang',
    date: '2026-10-15',
    doNumber: 'SJ-BF-923',
    kind: 'barang',
    createdBy: 'Rudi Hermawan · Kepala Gudang',
    file: 'sj-bf-923.pdf',
    lines: [{ itemId: 'k1', qty: 10, rejected: 0 }],
    note: 'Kiriman tahap 6 dari 6.',
  },
  {
    id: 'fpb-0012',
    number: 'FPB/2026/11/0012',
    poId: 'po-0040',
    vendorId: 'v-bintang',
    date: '2026-11-03',
    doNumber: 'SJ-BF-3301',
    kind: 'barang',
    createdBy: 'Rudi Hermawan · Kepala Gudang',
    file: 'sj-bf-3301.pdf',
    lines: [{ itemId: 'c1', qty: 6, rejected: 2 }],
    note: 'Pengiriman tahap 1. 2 unit sandaran retak, dikembalikan ke vendor.',
  },
];

// Dua tagihan rutin non-PO dari vendor yang sama, dua-duanya belum dibayar. Bersama
// FKT/2026/10/0024 (vendor yang sama) jadi tiga faktur terbuka — dipakai untuk mencoba
// satu Payment Request yang mencakup beberapa faktur sekaligus.
const fakturRutin = [
  {
    id: 'fkt-0030', number: 'FKT/2026/10/0030', vendorNo: 'INV-MTL-2291',
    vendorId: 'v-mitra', date: '2026-10-05', dueDate: '2026-11-04', pphPct: 0,
    lines: [{ productId: 'jasa-pest', kind: 'jasa', desc: 'Jasa pest control', spec: 'Periode Oktober 2026', unit: 'bulan', qty: 1, price: 1800000, ppnRate: RULES.ppn, received: true }],
    files: ['invoice-mtl-2291.pdf', 'faktur-pajak-mtl-2291.pdf'],
  },
  {
    id: 'fkt-0031', number: 'FKT/2026/10/0031', vendorNo: 'INV-MTL-2302',
    vendorId: 'v-mitra', date: '2026-10-18', dueDate: '2026-11-17', pphPct: 0,
    lines: [{ productId: 'jasa-servis-lift', kind: 'jasa', desc: 'Jasa servis berkala lift', spec: 'Servis tambahan lift barang', unit: 'paket', qty: 1, price: 4250000, ppnRate: RULES.ppn, received: true }],
    files: ['invoice-mtl-2302.pdf', 'faktur-pajak-mtl-2302.pdf'],
  },
  {
    id: 'fkt-0032', number: 'FKT/2026/10/0032', vendorNo: 'INV-KRY-5510',
    vendorId: 'v-karya', date: '2026-10-12', dueDate: '2026-11-11', pphPct: 0,
    lines: [{ productId: 'tagihan-internet', kind: 'jasa', desc: 'Tagihan internet & telepon', spec: 'Periode Oktober 2026', unit: 'bulan', qty: 1, price: 2750000, ppnRate: RULES.ppn, received: true }],
    files: ['invoice-kry-5510.pdf', 'faktur-pajak-kry-5510.pdf'],
  },
];

export const invoicesSeed = [
  invOngkir,
  ...histInvoices,
  ...gudangInvoices,
  ...fakturRutin,
  {
    id: 'fkt-0024',
    number: 'FKT/2026/10/0024',
    vendorNo: 'INV-MTL-2210',
    poId: 'po-0036',
    vendorId: 'v-mitra',
    date: '2026-10-16',
    dueDate: '2026-10-25',
    lines: [{ receiptId: 'bapp-0003', itemId: 's1', qty: 1, price: 8500000 }],
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
    // 30% x total PO termasuk PPN (Rp13.875.000), sama dengan poDpAmount. Dulu 3.750.000
    // (30% dari nilai sebelum PPN) sehingga rincian PR menampilkan dua angka DP yang berbeda.
    amount: 4_162_500,
    date: '2026-10-29',
    status: 'disetujui',
    note: 'DP 30% PO/2026/10/0040',
  },
  // Paling akhir: nomor PV contoh diturunkan dari urutan PR ini, jadi PV lama tidak bergeser.
  ...gudangPrs,
];

export const returnsSeed = [rtrOngkir];

// Payment Voucher (PV): terbit saat kas benar-benar keluar, satu per pembayaran.
// Nomornya dipakai jurnal kas keluar; Payment Request tetap jadi dokumen permintaannya.
// PV dari PR yang sudah dibayar: terbit sehari sebelum transfernya, lalu dijurnal hari itu juga.
// Jarak satu hari itu disengaja supaya terlihat bahwa perintah bayar mendahului uang keluar.
const kemarin = (iso) => new Date(Date.parse(iso) - 864e5).toISOString().slice(0, 10);
export const vouchersSeed = prsSeed
  .filter((p) => p.status === 'dibayar')
  .map((p, i) => ({
    id: `pv-${String(i + 1).padStart(4, '0')}`,
    number: `PV/${p.paidAt.slice(0, 4)}/${p.paidAt.slice(5, 7)}/${String(i + 1).padStart(4, '0')}`,
    prIds: [p.id],
    vendorId: p.vendorId,
    date: kemarin(p.paidAt),
    paidAt: p.paidAt,
    amount: p.amount,
    source: 'BCA 288-123-9001 · Kas Operasional',
    payRef: `TRF-${p.paidAt.replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`,
    proofs: [`bukti-transfer-${p.number.split('/').pop()}.pdf`],
    note: '',
    status: 'dibayar',
    issuedBy: 'Dewi Lestari · Staff Finance',
    paidBy: 'Dewi Lestari · Staff Finance',
    journalPostedAt: p.paidAt,
    journalBy: 'Maya Sari · Staff Accounting',
  }));

// Dokumen contoh yang ditambahkan sesudah data Pembelian mungkin sudah tersimpan di browser.
// store.jsx menambahkannya ke data tersimpan bila id-nya belum ada, tanpa menyentuh dokumen lain.
const gudangPrIds = new Set(gudangPrs.map((p) => p.id));
export const seedAdditions = {
  fppbj: fppbjSeed.filter((f) => gudangDocs.some((d) => d.po.fppbjId === f.id)),
  pos: gudangDocs.map((d) => d.po),
  receipts: gudangReceipts,
  invoices: gudangInvoices,
  prs: gudangPrs,
  vouchers: vouchersSeed.filter((v) => v.prIds.some((id) => gudangPrIds.has(id))),
};
