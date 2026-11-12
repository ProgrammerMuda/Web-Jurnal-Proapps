// Store data prototype bersama (belum ada backend). Disimpan di memori selama app terbuka,
// sehingga perubahan di satu halaman (mis. kontak baru) langsung terlihat di halaman lain.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { seedContacts, seedGroups } from '@/pages/Kontak/data.js';
import { seedSales } from '@/pages/Penjualan/data.js';
import {
  fpbjSeed,
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
const PB_KEY = 'proapps.pembelian.v1';
const pbSeed = {
  vendors: vendorsSeed,
  fpbj: fpbjSeed,
  pos: posSeed,
  receipts: receiptsSeed,
  invoices: invoicesSeed,
  prs: prsSeed,
  returns: returnsSeed,
  vouchers: vouchersSeed,
};
function loadPb() {
  try {
    const raw = JSON.parse(localStorage.getItem(PB_KEY));
    // Gabung dengan seed supaya data lama yang belum punya koleksi baru tetap bisa dibuka.
    if (raw?.fpbj && raw?.pos) return { ...pbSeed, ...raw };
  } catch {
    /* abaikan: pakai data contoh */
  }
  return pbSeed;
}

export function DataProvider({ children }) {
  const [contacts, setContacts] = useState(seedContacts);
  const [groups, setGroups] = useState(seedGroups);
  const [sales, setSales] = useState(seedSales);
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
      pb,
      setPb,
      pbRole,
      setPbRole,
      resetPb,
    };
  }, [contacts, groups, sales, pb, pbRole]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
