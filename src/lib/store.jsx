// Store data prototype bersama (belum ada backend). Disimpan di memori selama app terbuka,
// sehingga perubahan di satu halaman (mis. kontak baru) langsung terlihat di halaman lain.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { seedContacts, seedGroups } from '@/pages/Kontak/data.js';
import { seedSales } from '@/pages/Penjualan/data.js';
import { seedOrders } from '@/pages/Penjualan/orders.js';
import { seedQuotes } from '@/pages/Penjualan/quotes.js';
import { seedReturns } from '@/pages/Penjualan/returns.js';
import { paymentTermsSeed } from '@/pages/Pembelian/paymentTerms.js';
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

// Data Pembelian disimpan di localStorage agar tidak hilang saat halaman dimuat ulang.
const PB_KEY = 'proapps.pembelian.v19';
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
  const [pbRole, setPbRole] = useState('accounting');

  useEffect(() => {
    try {
      localStorage.setItem(PB_KEY, JSON.stringify(pb));
    } catch {
      /* penyimpanan penuh / diblokir: abaikan */
    }
  }, [pb]);
  const resetPb = () => setPb(pbSeed);

  const value = useMemo(() => {
    const contactsById = Object.fromEntries(contacts.map((c) => [c.id, c]));
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
      pb,
      setPb,
      pbRole,
      setPbRole,
      resetPb,
    };
  }, [contacts, groups, sales, orders, quotes, salesReturns, pb, pbRole]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
