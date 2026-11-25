// Master Produk & Jasa — satu katalog yang dipakai bersama modul Penjualan dan Pembelian.
// Sebelumnya tiap modul punya daftar produknya sendiri (Penjualan: `products`,
// Pembelian: `productCatalog`). Keduanya sekarang hanya "tampilan" dari katalog ini,
// supaya menambah produk di satu tempat langsung terpakai di faktur penjualan,
// permintaan pembelian, maupun tagihan vendor.
//
// Modul ini sengaja tidak mengimpor apa pun dari Penjualan/Pembelian agar tidak
// terjadi impor melingkar — merekalah yang mengimpor katalog ini.

// ---------------------------------------------------------------------------
// Kategori & satuan
// ---------------------------------------------------------------------------

const SEED_AT_ISO = '2026-11-04T09:00:00.000Z';
const withSeedDate = (list) => list.map((x) => ({ ...x, createdAt: SEED_AT_ISO }));

export const productCategoriesSeed = withSeedDate([
  { id: 'ipl', name: 'IPL', description: 'Iuran pengelolaan lingkungan dan dana cadangan' },
  { id: 'utility', name: 'Utility', description: 'Listrik, air, internet, dan utilitas gedung' },
  { id: 'home-service', name: 'Home Service', description: 'Pekerjaan perbaikan di dalam unit' },
  { id: 'sewa', name: 'Sewa & Reservasi', description: 'Sewa ruang, lahan, parkir, dan reservasi fasilitas' },
  { id: 'lainnya', name: 'Lainnya', description: 'Deposit, denda, dan penerimaan lain-lain' },
  { id: 'atk', name: 'ATK & Kantor', description: 'Alat tulis dan perlengkapan kantor' },
  { id: 'peralatan', name: 'Peralatan & Mesin', description: 'Peralatan kerja, mesin, dan inventaris' },
  { id: 'material', name: 'Material Teknik', description: 'Material plumbing, elektrikal, dan sipil' },
  { id: 'kebersihan', name: 'Kebersihan', description: 'Chemical, alat kebersihan, dan jasa cleaning' },
  { id: 'keamanan', name: 'Keamanan', description: 'Perlengkapan dan jasa keamanan gedung' },
  { id: 'pemeliharaan', name: 'Jasa Pemeliharaan', description: 'Servis berkala peralatan dan fasilitas gedung' },
]);

// id satuan sengaja dibuat sama dengan namanya: modul Pembelian menyimpan satuan
// sebagai teks biasa pada baris dokumennya, jadi id = teks yang tersimpan.
export const productUnitsSeed = withSeedDate([
  { id: 'pcs', name: 'pcs', description: 'Buah / satuan terkecil' },
  { id: 'unit', name: 'unit', description: 'Satu unit utuh' },
  { id: 'set', name: 'set', description: 'Satu set lengkap' },
  { id: 'rim', name: 'rim', description: '500 lembar' },
  { id: 'box', name: 'box', description: 'Satu kotak' },
  { id: 'lot', name: 'lot', description: 'Satu lot borongan' },
  { id: 'paket', name: 'paket', description: 'Satu paket pekerjaan' },
  { id: 'bulan', name: 'bulan', description: 'Per bulan' },
  { id: 'orang', name: 'orang', description: 'Per orang' },
  { id: 'kWh', name: 'kWh', description: 'Kilowatt hour' },
  { id: 'm3', name: 'm3', description: 'Meter kubik' },
]);

// Pajak yang bisa dipilih pada produk. Nilai penjualan mengikuti kode pajak
// modul Penjualan ('ppn11'), nilai pembelian mengikuti kode modul Pembelian ('ppn').
export const saleTaxOptions = [
  { value: 'ppn11', label: 'PPN 11%', rate: 0.11 },
];
export const buyTaxOptions = [
  { value: 'ppn', label: 'PPN 11%', rate: 0.11 },
];

export const KIND = { barang: 'Barang', jasa: 'Jasa' };

// ---------------------------------------------------------------------------
// Bentuk data produk
// ---------------------------------------------------------------------------
// {
//   id, sku, externalCode, name, description, categoryId, kind,
//   sellable, salePrice, saleUnitId, saleTax, saleAccount, arAccount,
//   purchasable, buyPrice, buyUnitId, buyTax, buyAccount,
//   tracked, inventoryAccount, baseUnitId,  (qty stok TIDAK disimpan di sini)
//   createdAt, updatedAt,
// }
// Akun disimpan sebagai kode akun (mis. '4-10001') agar cocok dengan Daftar Akun.

const SEED_DATE = '2026-11-04';
const SEED_AT = SEED_AT_ISO;

// SKU contoh dibuat tetap (bukan acak) supaya data awal selalu sama di tiap browser.
function seedSku(id, i) {
  let h = 0;
  for (const ch of id) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  const hex = h.toString(16).toUpperCase().padStart(6, '0').slice(-6);
  const t = String(90000 + i * 37).padStart(6, '0');
  return `SKU-${SEED_DATE.replaceAll('-', '')}-${t}-${hex}`;
}

const base = {
  description: '',
  categoryId: 'lainnya',
  kind: 'jasa',
  image: null,
  externalCode: '',
  sellable: false,
  salePrice: 0,
  saleUnitId: null,
  saleTax: null,
  saleAccount: null,
  arAccount: '1-10108',
  purchasable: false,
  buyPrice: 0,
  buyUnitId: null,
  buyTax: null,
  buyAccount: null,
  tracked: false,
  inventoryAccount: null,
  // Satuan dasar: satuan yang dipakai saat stok dicatat di gudang. Qty saldo stok
  // selalu disimpan dalam satuan ini.
  baseUnitId: null,
};

const raw = [
  // --- Dijual ke pelanggan (sebelumnya `products` di modul Penjualan) --------
  {
    id: 'drain-ac', name: 'PEMBERSIHAN DRAIN AC', description: 'PEMBERSIHAN DRAIN AC',
    categoryId: 'home-service', sellable: true, salePrice: 320000, saleTax: 'ppn11',
    saleUnitId: 'unit', saleAccount: '4-20005', arAccount: '1-10108',
  },
  {
    id: 'pameran', name: 'Pameran', description: 'Pameran',
    categoryId: 'sewa', sellable: true, salePrice: 1000000, saleTax: 'ppn11',
    saleUnitId: 'paket', saleAccount: '4-20013', arAccount: '1-10108',
  },
  {
    id: 'ipl', name: 'Iuran Pengelolaan Lingkungan', description: 'IPL bulanan unit',
    categoryId: 'ipl', sellable: true, salePrice: 300000, saleTax: 'ppn11',
    saleUnitId: 'bulan', saleAccount: '4-10001', arAccount: '1-10101',
  },
  {
    id: 'sewa', name: 'Sewa Ruang Usaha', description: 'Sewa ruang usaha per bulan',
    categoryId: 'sewa', sellable: true, salePrice: 2000000, saleTax: 'ppn11',
    saleUnitId: 'bulan', saleAccount: '4-20013', arAccount: '1-10108',
  },
  {
    id: 'listrik', name: 'Tagihan Listrik', description: 'Pemakaian listrik unit',
    categoryId: 'utility', sellable: true, salePrice: 200000, saleTax: null,
    saleUnitId: 'kWh', saleAccount: '4-10002', arAccount: '1-10104',
  },
  {
    id: 'air', name: 'Tagihan Air', description: 'Pemakaian air unit',
    categoryId: 'utility', sellable: true, salePrice: 50000, saleTax: null,
    saleUnitId: 'm3', saleAccount: '4-10003', arAccount: '1-10103',
  },
  {
    id: 'fitout', name: 'Deposit Fit Out', description: 'Deposit renovasi unit',
    categoryId: 'lainnya', sellable: true, salePrice: 10000000, saleTax: null,
    saleUnitId: 'unit', saleAccount: '4-20001', arAccount: '1-10108',
  },
  {
    id: 'parkir', name: 'Sewa Parkir', description: 'Sewa parkir kendaraan',
    categoryId: 'sewa', sellable: true, salePrice: 222000, saleTax: 'ppn11',
    saleUnitId: 'bulan', saleAccount: '4-20007', arAccount: '1-10106',
  },
  {
    id: 'denda', name: 'Denda Keterlambatan', description: 'Denda atas keterlambatan pembayaran',
    categoryId: 'lainnya', sellable: true, salePrice: 0, saleTax: null,
    saleUnitId: 'pcs', saleAccount: '4-20000', arAccount: '1-10105',
  },

  // --- Dibeli dari vendor (sebelumnya `productCatalog` di modul Pembelian) ---
  {
    id: 'kertas-a4', name: 'Kertas A4 80 gsm', description: 'Kertas HVS A4 80 gsm, isi 500 lembar',
    categoryId: 'atk', kind: 'barang', purchasable: true, buyPrice: 56000, buyUnitId: 'rim',
    buyTax: 'ppn', buyAccount: '6-60003', tracked: true, inventoryAccount: '1-10300',
  },
  {
    id: 'map-plastik', name: 'Map plastik', description: 'Map plastik folder arsip',
    categoryId: 'atk', kind: 'barang', purchasable: true, buyPrice: 3500, buyUnitId: 'pcs',
    buyTax: 'ppn', buyAccount: '6-60003', tracked: true, inventoryAccount: '1-10300',
  },
  {
    id: 'tinta-printer', name: 'Tinta printer', description: 'Tinta refill printer, isi 4 warna',
    categoryId: 'atk', kind: 'barang', purchasable: true, buyPrice: 185000, buyUnitId: 'box',
    buyTax: 'ppn', buyAccount: '6-60003', tracked: true, inventoryAccount: '1-10300',
  },
  {
    id: 'printer-laser', name: 'Printer laser A4', description: 'Printer laser monokrom A4',
    categoryId: 'peralatan', kind: 'barang', purchasable: true, buyPrice: 4200000, buyUnitId: 'unit',
    buyTax: 'ppn', buyAccount: '1-20004',
  },
  {
    id: 'meja-lipat', name: 'Meja lipat 120x60', description: 'Meja lipat rangka besi, 120x60 cm',
    categoryId: 'peralatan', kind: 'barang', purchasable: true, buyPrice: 650000, buyUnitId: 'pcs',
    buyTax: 'ppn', buyAccount: '1-20004',
  },
  {
    id: 'kursi-kantor', name: 'Kursi kantor ergonomis', description: 'Sandaran jaring, roda, ketinggian bisa diatur',
    categoryId: 'peralatan', kind: 'barang', purchasable: true, buyPrice: 1450000, buyUnitId: 'unit',
    buyTax: 'ppn', buyAccount: '1-20004',
  },
  {
    id: 'lemari-arsip', name: 'Lemari arsip besi 4 laci', description: 'Lemari arsip besi 4 laci berkunci',
    categoryId: 'peralatan', kind: 'barang', purchasable: true, buyPrice: 2500000, buyUnitId: 'unit',
    buyTax: 'ppn', buyAccount: '1-20004',
  },
  {
    id: 'pipa-pvc', name: 'Pipa PVC', description: 'Pipa PVC saluran air, panjang 4 m',
    categoryId: 'material', kind: 'barang', purchasable: true, buyPrice: 65000, buyUnitId: 'pcs',
    buyTax: 'ppn', buyAccount: '6-30009', tracked: true, inventoryAccount: '1-10300',
  },
  {
    id: 'elbow-pvc', name: 'Elbow PVC', description: 'Sambungan elbow PVC 90 derajat',
    categoryId: 'material', kind: 'barang', purchasable: true, buyPrice: 6500, buyUnitId: 'pcs',
    buyTax: 'ppn', buyAccount: '6-30009', tracked: true, inventoryAccount: '1-10300',
  },
  {
    id: 'pompa-air', name: 'Pompa air', description: 'Pompa air dorong untuk tandon gedung',
    categoryId: 'peralatan', kind: 'barang', purchasable: true, buyPrice: 2500000, buyUnitId: 'unit',
    buyTax: 'ppn', buyAccount: '6-30009',
  },
  {
    id: 'cairan-lantai', name: 'Cairan pembersih lantai', description: 'Cairan pembersih lantai, isi 12 botol',
    categoryId: 'kebersihan', kind: 'barang', purchasable: true, buyPrice: 85000, buyUnitId: 'box',
    buyTax: 'ppn', buyAccount: '6-40001', tracked: true, inventoryAccount: '1-10300',
  },
  {
    id: 'kain-pel', name: 'Kain pel microfiber', description: 'Kain pel microfiber daya serap tinggi',
    categoryId: 'kebersihan', kind: 'barang', purchasable: true, buyPrice: 22500, buyUnitId: 'pcs',
    buyTax: 'ppn', buyAccount: '6-40001', tracked: true, inventoryAccount: '1-10300',
  },
  {
    id: 'radio-ht', name: 'Radio HT', description: 'Radio HT dua arah untuk petugas keamanan',
    categoryId: 'keamanan', kind: 'barang', purchasable: true, buyPrice: 1250000, buyUnitId: 'unit',
    buyTax: 'ppn', buyAccount: '6-40002',
  },
  {
    id: 'seragam-satpam', name: 'Seragam satpam', description: 'Seragam satpam lengkap, satu set',
    categoryId: 'keamanan', kind: 'barang', purchasable: true, buyPrice: 450000, buyUnitId: 'set',
    buyTax: 'ppn', buyAccount: '6-40002',
  },
  {
    id: 'jasa-servis-lift', name: 'Jasa servis berkala lift', description: 'Servis berkala lift termasuk sparepart habis pakai',
    categoryId: 'pemeliharaan', purchasable: true, buyPrice: 8500000, buyUnitId: 'paket',
    buyTax: 'ppn', buyAccount: '6-30001',
  },
  {
    id: 'jasa-cctv', name: 'Jasa instalasi CCTV', description: 'Instalasi CCTV termasuk kabel dan konfigurasi',
    categoryId: 'pemeliharaan', purchasable: true, buyPrice: 3500000, buyUnitId: 'paket',
    buyTax: 'ppn', buyAccount: '6-30004',
  },
  {
    id: 'jasa-ac', name: 'Jasa servis AC', description: 'Cuci evaporator dan isi freon bila perlu',
    categoryId: 'pemeliharaan', purchasable: true, buyPrice: 350000, buyUnitId: 'unit',
    buyTax: 'ppn', buyAccount: '6-30000',
  },
  {
    id: 'jasa-pest', name: 'Jasa pest control', description: 'Pengendalian hama berkala seluruh area gedung',
    categoryId: 'pemeliharaan', purchasable: true, buyPrice: 1800000, buyUnitId: 'bulan',
    buyTax: 'ppn', buyAccount: '6-40004',
  },
  // Tagihan rutin non-PO: harga mengikuti tagihan, jadi harga katalognya 0.
  {
    id: 'tagihan-listrik', name: 'Tagihan listrik', description: 'Pemakaian listrik gedung',
    categoryId: 'utility', purchasable: true, buyPrice: 0, buyUnitId: 'bulan',
    buyTax: null, buyAccount: '5-10001',
  },
  {
    id: 'tagihan-air', name: 'Tagihan air (PDAM)', description: 'Pemakaian air PDAM gedung',
    categoryId: 'utility', purchasable: true, buyPrice: 0, buyUnitId: 'bulan',
    buyTax: null, buyAccount: '5-10002',
  },
  {
    id: 'tagihan-internet', name: 'Tagihan internet & telepon', description: 'Langganan internet dan telepon gedung',
    categoryId: 'utility', purchasable: true, buyPrice: 0, buyUnitId: 'bulan',
    buyTax: 'ppn', buyAccount: '6-20003',
  },
  {
    id: 'sewa-ruang', name: 'Sewa ruang / lahan', description: 'Sewa ruang atau lahan per bulan',
    categoryId: 'sewa', purchasable: true, buyPrice: 0, buyUnitId: 'bulan',
    buyTax: 'ppn', buyAccount: '6-60000',
  },
  {
    id: 'jasa-cleaning', name: 'Jasa cleaning service', description: 'Tenaga kebersihan harian gedung',
    categoryId: 'kebersihan', purchasable: true, buyPrice: 0, buyUnitId: 'bulan',
    buyTax: 'ppn', buyAccount: '6-40001',
  },
  {
    id: 'jasa-security', name: 'Jasa security', description: 'Tenaga keamanan gedung per bulan',
    categoryId: 'keamanan', purchasable: true, buyPrice: 0, buyUnitId: 'bulan',
    buyTax: 'ppn', buyAccount: '6-40002',
  },
];

export const seedProducts = raw.map((p, i) => ({
  ...base,
  ...p,
  // Satuan dasar seed mengikuti satuan pembelian (atau penjualan untuk produk jasa).
  baseUnitId: p.baseUnitId ?? p.buyUnitId ?? p.saleUnitId ?? null,
  sku: seedSku(p.id, i),
  externalCode: p.externalCode ?? '',
  createdAt: SEED_AT,
  updatedAt: SEED_AT,
}));

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

export const categoryName = (categories, id) =>
  categories.find((c) => c.id === id)?.name ?? '';
export const unitName = (units, id) => units.find((u) => u.id === id)?.name ?? '';

export const emptyProduct = () => ({ ...base, id: '', sku: '', name: '' });

// SKU baru mengikuti pola situs: SKU-<tanggal>-<jam>-<6 hex acak>.
export function generateSku(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const tgl = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`;
  const jam = `${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
  const hex = Math.floor(Math.random() * 0xffffff).toString(16).toUpperCase().padStart(6, '0');
  return `SKU-${tgl}-${jam}-${hex}`;
}

// Satuan dasar produk; jatuh kembali ke satuan beli / jual bila belum diisi.
export const baseUnitOf = (p) => p.baseUnitId ?? p.buyUnitId ?? p.saleUnitId ?? null;

// ---------------------------------------------------------------------------
// Tampilan lama (jembatan kompatibilitas)
// ---------------------------------------------------------------------------
// Modul Penjualan dan Pembelian masih mengimpor daftar produk sebagai konstanta
// modul. Dua array di bawah adalah array yang SAMA sepanjang umur aplikasi —
// isinya ditulis ulang di tempat setiap katalog berubah, jadi pemanggil yang
// membacanya saat render selalu melihat data terbaru.

/** Bentuk yang dipakai modul Penjualan: { id, name, description, price, tax }. */
export const toSalesItem = (p) => ({
  id: p.id,
  name: p.name,
  description: p.description || p.name,
  price: p.salePrice,
  tax: p.saleTax,
});

/** Bentuk yang dipakai modul Pembelian: { id, name, description, kind, unit, price }. */
export const toPurchaseItem = (p) => ({
  id: p.id,
  name: p.name,
  description: p.description || p.name,
  kind: p.kind,
  unit: p.buyUnitId ?? 'pcs',
  price: p.buyPrice,
});

export const salesView = seedProducts.filter((p) => p.sellable).map(toSalesItem);
export const purchaseView = seedProducts.filter((p) => p.purchasable).map(toPurchaseItem);
/** Nama satuan sebagai teks — dipakai Select satuan pada dokumen Pembelian. */
export const unitNames = productUnitsSeed.map((u) => u.name);

const rewrite = (target, next) => {
  target.length = 0;
  target.push(...next);
};

/** Dipanggil store setiap katalog berubah, sebelum halaman lain dirender ulang. */
export function syncLegacyViews(list, units = productUnitsSeed) {
  rewrite(salesView, list.filter((p) => p.sellable).map(toSalesItem));
  rewrite(purchaseView, list.filter((p) => p.purchasable).map(toPurchaseItem));
  rewrite(unitNames, units.map((u) => u.name));
}
