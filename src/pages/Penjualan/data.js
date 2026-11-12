// Data contoh halaman Penjualan — meniru jurnal.proapps.id/sales (dilihat 4 Nov 2026).
// Semua angka/tanggal disimpan mentah; total & status dihitung di utils.js.
import { accounts } from '@/pages/DaftarAkun/accounts.js';

// Tanggal "hari ini" prototype mengikuti tanggal di header aplikasi.
export const TODAY = '2026-11-04';

export const products = [
  {
    id: 'drain-ac',
    name: 'PEMBERSIHAN DRAIN AC',
    description: 'PEMBERSIHAN DRAIN AC',
    price: 320000,
  },
  { id: 'pameran', name: 'Pameran', description: 'Pameran', price: 1000000 },
  {
    id: 'ipl',
    name: 'Iuran Pengelolaan Lingkungan',
    description: 'IPL bulanan unit',
    price: 300000,
  },
  {
    id: 'sewa',
    name: 'Sewa Ruang Usaha',
    description: 'Sewa ruang usaha per bulan',
    price: 2000000,
  },
  { id: 'listrik', name: 'Tagihan Listrik', description: 'Pemakaian listrik unit', price: 200000 },
  { id: 'air', name: 'Tagihan Air', description: 'Pemakaian air unit', price: 50000 },
  { id: 'fitout', name: 'Deposit Fit Out', description: 'Deposit renovasi unit', price: 10000000 },
  { id: 'parkir', name: 'Sewa Parkir', description: 'Sewa parkir kendaraan', price: 222000 },
];

export const taxes = [{ value: 'ppn11', label: 'PPN 11%', rate: 0.11 }];

export const paymentTerms = [
  { value: 'cod', label: 'Cash on Delivery', days: 0 },
  { value: 'net30', label: 'Net 30', days: 30 },
  { value: 'net15', label: 'Net 15', days: 15 },
  { value: 'net60', label: 'Net 60', days: 60 },
  { value: 'custom', label: 'Custom', days: null },
];

export const paymentMethods = [
  'BCA Virtual Account (API)',
  'Midtrans (Biaya: Rp 1.940)',
  'Registered Virtual Account',
  'Company Bank Account',
  'Installment',
];

// Akun setor pembayaran & akun potongan diambil dari COA (Daftar Akun).
const toOption = (a) => ({ value: a.code, label: `${a.code} - ${a.name}` });
export const depositAccounts = accounts.filter((a) => a.bankCash).map(toOption);
export const allAccounts = accounts.map(toOption);

const item = (productId, qty = 1, price, tax = null) => {
  const p = products.find((x) => x.id === productId);
  return { productId, description: p.description, qty, price: price ?? p.price, tax };
};

const base = {
  ref: '',
  term: 'net30',
  taxInclusive: false,
  discountType: 'percent',
  discountValue: 0,
  withholdingType: 'nominal',
  withholdingValue: 0,
  withholdingAccount: null,
  message: '',
  memo: '',
  draft: false,
  payments: [],
  invoiceLink: null,
};

export const seedSales = [
  {
    ...base,
    id: 's1',
    number: '0123124',
    customerId: 'aag0808',
    billingAddress: 'Kl. Muwardi No. 455, Padangpanjang 80378, Jateng',
    date: '2026-11-04',
    dueDate: '2026-12-04',
    items: [item('drain-ac')],
    createdAt: '2026-11-04T11:00',
    updatedAt: '2026-11-04T11:00',
  },
  {
    ...base,
    id: 's2',
    number: '0123123124124',
    customerId: 'aag1109',
    billingAddress: 'Jl. Gatot Subroto No. 12, Medan 20112, Sumut',
    term: 'custom',
    date: '2026-11-04',
    dueDate: '2027-01-21',
    items: [item('sewa')],
    createdAt: '2026-11-04T10:42',
    updatedAt: '2026-11-04T10:42',
  },
  {
    ...base,
    id: 's3',
    number: '123124124',
    customerId: 'aldi',
    date: '2026-11-05',
    dueDate: '2026-11-30',
    term: 'custom',
    items: [item('ipl')],
    createdAt: '2026-11-04T10:15',
    updatedAt: '2026-11-04T10:15',
  },
  {
    ...base,
    id: 's4',
    number: 'INV-1793763665866-1AF6AD',
    ref: 'PO-11241',
    customerId: 'firman',
    date: '2026-11-04',
    dueDate: '2026-12-04',
    items: [item('parkir')],
    discountType: 'nominal',
    discountValue: 40000,
    createdAt: '2026-11-04T09:30',
    updatedAt: '2026-11-04T09:30',
  },
  {
    ...base,
    id: 's5',
    number: 'INV-1793676682381-B33B04',
    customerId: 'testtttt',
    date: '2026-11-03',
    dueDate: '2026-12-03',
    items: [item('pameran', 1, 1000000, 'ppn11')],
    payments: [
      {
        date: '2026-11-03',
        amount: 1110000,
        account: '1-10000',
        method: 'Company Bank Account',
        memo: 'Pembayaran faktur INV-1793676682381-B33B04',
      },
    ],
    createdAt: '2026-11-03T10:31',
    updatedAt: '2026-11-03T10:57',
  },
  {
    ...base,
    id: 's6',
    number: '0124123123',
    customerId: 'aaljooz',
    date: '2026-11-02',
    dueDate: '2026-11-17',
    term: 'net15',
    items: [item('listrik')],
    createdAt: '2026-11-02T14:05',
    updatedAt: '2026-11-02T14:05',
  },
  {
    ...base,
    id: 's7',
    number: '0124123123',
    customerId: 'aaljooz',
    date: '2026-11-02',
    dueDate: '2026-11-17',
    term: 'net15',
    items: [item('listrik', 1, 198000)],
    discountType: 'nominal',
    discountValue: 21622,
    createdAt: '2026-11-02T13:50',
    updatedAt: '2026-11-02T13:50',
  },
  {
    ...base,
    id: 's8',
    number: 'PRO/INV/202610/40685',
    customerId: 'aab2606',
    date: '2026-10-23',
    dueDate: '2026-10-24',
    term: 'custom',
    items: [item('air')],
    payments: [
      {
        date: '2026-10-23',
        amount: 50000,
        account: '1-10000',
        method: 'BCA Virtual Account (API)',
        memo: '',
      },
    ],
    createdAt: '2026-10-23T08:12',
    updatedAt: '2026-10-23T09:40',
  },
  {
    ...base,
    id: 's9',
    number: 'PRO/INV/202610/40684',
    customerId: 'aab2606',
    date: '2026-10-23',
    dueDate: '2026-10-24',
    term: 'custom',
    items: [item('air')],
    payments: [
      {
        date: '2026-10-23',
        amount: 50000,
        account: '1-10000',
        method: 'BCA Virtual Account (API)',
        memo: '',
      },
    ],
    createdAt: '2026-10-23T08:10',
    updatedAt: '2026-10-23T09:38',
  },
  {
    ...base,
    id: 's10',
    number: 'INV-1792742375457-0D797B',
    customerId: 'aag1007',
    billingAddress: 'Jl. Pemuda No. 88, Semarang 50132, Jateng',
    date: '2026-10-23',
    dueDate: '2026-11-22',
    items: [item('fitout')],
    createdAt: '2026-10-23T07:55',
    updatedAt: '2026-10-23T07:55',
  },
  {
    ...base,
    id: 's11',
    number: 'PRO/INV/202610/40612',
    customerId: 'aag0808',
    billingAddress: 'Kl. Muwardi No. 455, Padangpanjang 80378, Jateng',
    date: '2026-10-15',
    dueDate: '2026-10-30',
    term: 'net15',
    items: [item('ipl', 2)],
    payments: [
      { date: '2026-10-20', amount: 250000, account: '1-10000', method: 'Installment', memo: '' },
    ],
    createdAt: '2026-10-15T10:00',
    updatedAt: '2026-10-20T15:21',
  },
  {
    ...base,
    id: 's12',
    number: 'PRO/INV/202610/40598',
    customerId: 'aag1109',
    date: '2026-10-12',
    dueDate: '2026-11-11',
    draft: true,
    items: [item('drain-ac', 2)],
    createdAt: '2026-10-12T16:44',
    updatedAt: '2026-10-12T16:44',
  },
];
