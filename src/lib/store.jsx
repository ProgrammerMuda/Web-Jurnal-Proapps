// Store data prototype bersama (belum ada backend). Disimpan di memori selama app terbuka,
// sehingga perubahan di satu halaman (mis. kontak baru) langsung terlihat di halaman lain.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { seedContacts, seedGroups } from '@/pages/Kontak/data.js';
import { seedSales } from '@/pages/Penjualan/data.js';
import { seedOrders } from '@/pages/Penjualan/orders.js';
import { seedQuotes } from '@/pages/Penjualan/quotes.js';
import { seedReturns } from '@/pages/Penjualan/returns.js';
import { paymentTermsSeed } from '@/pages/Pembelian/paymentTerms.js';
import { warehouseLogsSeed, warehousesSeed } from '@/pages/Gudang/data.js';
import {
  stockMinimumsSeed,
  stockMovesSeed,
  stockOpnamesSeed,
  stockTransfersSeed,
} from '@/pages/Gudang/stock.js';
import {
  productCategoriesSeed,
  productUnitsSeed,
  seedProducts,
  syncLegacyViews,
} from '@/pages/Produk/catalog.js';
import {
  fppbjSeed,
  invoicesSeed,
  posSeed,
  prsSeed,
  receiptsSeed,
  returnsSeed,
  vendorsSeed,
  vouchersSeed,
} from '@/pages/Pembelian/data.js';

const DataContext = createContext(null);

// Master Produk & Jasa ikut disimpan di localStorage seperti data Pembelian, supaya
// produk yang ditambahkan pengguna tidak hilang saat halaman dimuat ulang.
const PRODUK_KEY = 'proapps.produk.v2';
const produkSeed = {
  products: seedProducts,
  categories: productCategoriesSeed,
  units: productUnitsSeed,
};

// Master Gudang + saldo/riwayat stok. Saldo stok sengaja disimpan terpisah dari master
// produk maupun master gudang: ia milik Mutasi Stok, dan dua menu itu membacanya.
const GUDANG_KEY = 'proapps.gudang.v3';
const gudangSeed = {
  warehouses: warehousesSeed,
  logs: warehouseLogsSeed,
  minimums: stockMinimumsSeed,
  moves: stockMovesSeed,
  opnames: stockOpnamesSeed,
  transfers: stockTransfersSeed,
};

function loadGudang() {
  try {
    const raw = JSON.parse(localStorage.getItem(GUDANG_KEY));
    if (Array.isArray(raw?.warehouses) && raw.warehouses.length)
      return { ...gudangSeed, ...raw };
  } catch {
    /* abaikan: pakai data contoh */
  }
  return gudangSeed;
}

function loadProduk() {
  try {
    const raw = JSON.parse(localStorage.getItem(PRODUK_KEY));
    if (Array.isArray(raw?.products) && raw.products.length)
      return {
        products: raw.products,
        categories: Array.isArray(raw.categories) ? raw.categories : productCategoriesSeed,
        units: Array.isArray(raw.units) ? raw.units : productUnitsSeed,
      };
  } catch {
    /* abaikan: pakai katalog contoh */
  }
  return produkSeed;
}

// Data Pembelian disimpan di localStorage agar tidak hilang saat halaman dimuat ulang.
const PB_KEY = 'proapps.pembelian.v20';
const pbSeed = {
  vendors: vendorsSeed,
  paymentTerms: paymentTermsSeed,
  fppbj: fppbjSeed,
  pos: posSeed,
  receipts: receiptsSeed,
  invoices: invoicesSeed,
  prs: prsSeed,
  returns: returnsSeed,
  vouchers: vouchersSeed,
};
// Vendor tersimpan sering lebih tua dari seed dan belum punya kolom yang ditambahkan
// belakangan (mis. email). Kolom yang hilang diisi ulang dari seed tanpa menimpa isian
// pengguna, dan vendor contoh yang belum ada ikut ditambahkan.
function mergeVendors(saved) {
  if (!Array.isArray(saved)) return vendorsSeed;
  const seed = Object.fromEntries(vendorsSeed.map((v) => [v.id, v]));
  const merged = saved.map((v) => ({ ...seed[v.id], ...v }));
  const ids = new Set(merged.map((v) => v.id));
  return [...merged, ...vendorsSeed.filter((v) => !ids.has(v.id))];
}

function loadPb() {
  try {
    const raw = JSON.parse(localStorage.getItem(PB_KEY));
    // Gabung dengan seed supaya data lama yang belum punya koleksi baru tetap bisa dibuka.
    if (raw?.fppbj && raw?.pos)
      return { ...pbSeed, ...raw, vendors: mergeVendors(raw.vendors), paymentTerms: raw.paymentTerms ?? paymentTermsSeed };
  } catch {
    /* abaikan: pakai data contoh */
  }
  return pbSeed;
}

export function DataProvider({ children }) {
  const [contacts, setContacts] = useState(seedContacts);
  const [groups, setGroups] = useState(seedGroups);
  const [sales, setSales] = useState(seedSales);
  const [orders, setOrders] = useState(seedOrders);
  const [quotes, setQuotes] = useState(seedQuotes);
  const [salesReturns, setSalesReturns] = useState(seedReturns);
  // Modul Pembelian: semua dokumen dalam satu state agar tahap-tahapnya saling terhubung.
  const [pb, setPb] = useState(loadPb);
  const [produk, setProduk] = useState(loadProduk);
  const [gudang, setGudang] = useState(loadGudang);
  const [pbRole, setPbRole] = useState('accounting');

  useEffect(() => {
    try {
      localStorage.setItem(PB_KEY, JSON.stringify(pb));
    } catch {
      /* penyimpanan penuh / diblokir: abaikan */
    }
  }, [pb]);
  useEffect(() => {
    try {
      localStorage.setItem(PRODUK_KEY, JSON.stringify(produk));
    } catch {
      /* penyimpanan penuh / diblokir: abaikan */
    }
  }, [produk]);
  useEffect(() => {
    try {
      localStorage.setItem(GUDANG_KEY, JSON.stringify(gudang));
    } catch {
      /* penyimpanan penuh / diblokir: abaikan */
    }
  }, [gudang]);
  const resetPb = () => setPb(pbSeed);
  const resetProduk = () => setProduk(produkSeed);
  const resetGudang = () => setGudang(gudangSeed);

  const value = useMemo(() => {
    const contactsById = Object.fromEntries(contacts.map((c) => [c.id, c]));
    // Tampilan lama (`products` di Penjualan, `productCatalog` & `units` di Pembelian)
    // ditulis ulang di sini — saat render provider, sebelum halaman anak dirender —
    // supaya modul yang masih membacanya sebagai konstanta tetap melihat data terbaru.
    syncLegacyViews(produk.products, produk.units);
    return {
      contacts,
      setContacts,
      contactsById,
      groups,
      setGroups,
      sales,
      setSales,
      orders,
      setOrders,
      quotes,
      setQuotes,
      salesReturns,
      setSalesReturns,
      products: produk.products,
      productCategories: produk.categories,
      productUnits: produk.units,
      setProducts: (fn) =>
        setProduk((s2) => ({
          ...s2,
          products: typeof fn === 'function' ? fn(s2.products) : fn,
        })),
      setProductCategories: (fn) =>
        setProduk((s2) => ({
          ...s2,
          categories: typeof fn === 'function' ? fn(s2.categories) : fn,
        })),
      setProductUnits: (fn) =>
        setProduk((s2) => ({ ...s2, units: typeof fn === 'function' ? fn(s2.units) : fn })),
      resetProduk,
      warehouses: gudang.warehouses,
      warehouseLogs: gudang.logs,
      stockMinimums: gudang.minimums,
      stockMoves: gudang.moves,
      stockOpnames: gudang.opnames,
      stockTransfers: gudang.transfers,
      setWarehouses: (fn) =>
        setGudang((s2) => ({
          ...s2,
          warehouses: typeof fn === 'function' ? fn(s2.warehouses) : fn,
        })),
      setWarehouseLogs: (fn) =>
        setGudang((s2) => ({ ...s2, logs: typeof fn === 'function' ? fn(s2.logs) : fn })),
      setStockMinimums: (fn) =>
        setGudang((s2) => ({ ...s2, minimums: typeof fn === 'function' ? fn(s2.minimums) : fn })),
      setStockMoves: (fn) =>
        setGudang((s2) => ({ ...s2, moves: typeof fn === 'function' ? fn(s2.moves) : fn })),
      setStockTransfers: (fn) =>
        setGudang((s2) => ({ ...s2, transfers: typeof fn === 'function' ? fn(s2.transfers) : fn })),
      // Mencatat dokumen persediaan sekaligus mutasinya dalam satu perubahan state,
      // supaya saldo tidak pernah terlihat setengah jadi.
      postStock: ({ moves = [], transfer = null, updateTransfer = null }) =>
        setGudang((s2) => ({
          ...s2,
          moves: [...s2.moves, ...moves],
          transfers: transfer
            ? [transfer, ...s2.transfers]
            : updateTransfer
              ? s2.transfers.map((t) => (t.id === updateTransfer.id ? { ...t, ...updateTransfer } : t))
              : s2.transfers,
        })),
      resetGudang,
      pb,
      setPb,
      pbRole,
      setPbRole,
      resetPb,
    };
  }, [contacts, groups, sales, orders, quotes, salesReturns, produk, gudang, pb, pbRole]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
