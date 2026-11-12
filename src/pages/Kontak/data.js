// Data & opsi halaman Kontak — meniru jurnal.proapps.id/contact (dilihat 4 Nov 2026).
import { accounts } from '@/pages/DaftarAkun/accounts.js';

// Urutan & warna mengikuti bar "Komposisi tipe kontak" di aslinya.
export const contactTypes = [
  {
    value: 'customer',
    label: 'Pelanggan',
    long: 'Pelanggan (Customer)',
    badge: 'PELANGGAN',
    color: 'primary.9',
    badgeColor: 'teal',
  },
  {
    value: 'supplier',
    label: 'Pemasok / Vendor',
    long: 'Pemasok / Vendor (Supplier)',
    badge: 'SUPPLIER',
    detailBadge: 'PEMASOK',
    color: 'cyan.6',
    badgeColor: 'blue',
  },
  {
    value: 'employee',
    label: 'Karyawan',
    long: 'Karyawan (Employee)',
    badge: 'KARYAWAN',
    color: 'teal.6',
    badgeColor: 'violet',
  },
  {
    value: 'unit',
    label: 'Unit',
    long: 'Unit (Penghuni / Unit Properti)',
    badge: 'UNIT',
    color: 'indigo.5',
    badgeColor: 'cyan',
  },
  {
    value: 'other',
    label: 'Lainnya',
    long: 'Lainnya (Other)',
    badge: 'LAINNYA',
    color: 'slate.7',
    badgeColor: 'gray',
  },
];
export const typeOf = (value) => contactTypes.find((t) => t.value === value);

export const salutations = [
  'Bapak',
  'Ibu',
  'Sdr (Saudara)',
  'Sdri (Saudari)',
  'Mr.',
  'Mrs.',
  'Ms.',
];

export const idTypes = [
  { value: 'ktp', label: 'KTP (Kartu Tanda Penduduk)', short: 'KTP' },
  { value: 'sim', label: 'SIM (Surat Izin Mengemudi)', short: 'SIM' },
  { value: 'passport', label: 'Paspor (Passport)', short: 'Paspor' },
];

export const contactTerms = [
  { value: 'cod', label: 'Cash on Delivery (Langsung Tunai)', short: 'Cash on Delivery', days: 0 },
  { value: 'net30', label: 'Net 30 (30 hari)', short: 'Net 30 hari', days: 30 },
  { value: 'net15', label: 'Net 15 (15 hari)', short: 'Net 15 hari', days: 15 },
  { value: 'net60', label: 'Net 60 (60 hari)', short: 'Net 60 hari', days: 60 },
];

export const provinces = {
  'DKI Jakarta': [
    'Jakarta Pusat',
    'Jakarta Selatan',
    'Jakarta Barat',
    'Jakarta Timur',
    'Jakarta Utara',
  ],
  'Jawa Barat': ['Kota Bandung', 'Kota Bekasi', 'Kota Bogor', 'Kota Depok', 'Kabupaten Bekasi'],
  Banten: ['Kota Tangerang', 'Kota Tangerang Selatan', 'Kabupaten Tangerang', 'Kota Serang'],
  'Jawa Tengah': ['Kota Semarang', 'Kota Surakarta', 'Kota Magelang', 'Kabupaten Kudus'],
  'Jawa Timur': ['Kota Surabaya', 'Kota Malang', 'Kabupaten Sidoarjo'],
  'Sumatera Utara': ['Kota Medan', 'Kota Binjai', 'Kabupaten Deli Serdang'],
  'Sumatera Barat': ['Kota Padang', 'Kota Padang Panjang', 'Kota Bukittinggi'],
  Bali: ['Kota Denpasar', 'Kabupaten Badung', 'Kabupaten Gianyar'],
};

export const banks = [
  'BCA',
  'Bank Mandiri',
  'BRI',
  'BNI',
  'BSI (Bank Syariah Indonesia)',
  'CIMB Niaga',
  'Bank Permata',
  'Bank Danamon',
  'BTN',
  'OCBC NISP',
  'Bank Mega',
  'Maybank Indonesia',
];

const option = (a) => ({ value: a.code, label: `${a.code} - ${a.name}` });
export const arAccounts = accounts.filter((a) => a.category === 'Akun Piutang').map(option);
export const apAccounts = accounts.filter((a) => a.category === 'Akun Hutang').map(option);
export const accountLabel = (code) => {
  const a = accounts.find((x) => x.code === code);
  return a ? `${a.code} · ${a.name}` : null;
};

export const seedGroups = ['Vendor'];

const emptyAddress = { address: '', province: null, city: null, zip: '' };

export const emptyContact = () => ({
  displayName: '',
  types: ['customer'],
  company: '',
  groups: [],
  salutation: null,
  firstName: '',
  middleName: '',
  lastName: '',
  idType: 'ktp',
  idNumber: '',
  npwp: '',
  email: '',
  mobile: '',
  phone: '',
  fax: '',
  notes: '',
  billing: { ...emptyAddress },
  shippingSame: true,
  shipping: { ...emptyAddress },
  banks: [],
  arAccount: null,
  apAccount: null,
  term: 'net30',
  termDays: 30,
  externalCode: '',
  archived: false,
});

const c = (data) => ({
  ...emptyContact(),
  arAccount: '1-10100',
  apAccount: '2-10000',
  createdAt: '2026-11-03T10:00',
  updatedAt: '2026-11-03T10:00',
  ...data,
});

// Kontak contoh. Id dipakai juga oleh data Penjualan (customerId).
export const seedContacts = [
  c({
    id: 'aldi',
    number: 'CNT-1793698472027-1DC12C',
    displayName: 'Aldi Mahafirman',
    salutation: 'Mr.',
    firstName: 'Aldi',
    middleName: 'Mahar',
    lastName: 'Diansyah',
    email: 'aldimdiansyah@gmail.com',
    createdAt: '2026-11-04T09:12',
    updatedAt: '2026-11-04T09:12',
  }),
  c({
    id: 'firman',
    number: 'CNT-1793693875087-723686',
    displayName: 'Firman GM',
    types: ['supplier', 'employee', 'unit', 'customer', 'other'],
    billing: {
      address: 'dadadadaad',
      province: 'DKI Jakarta',
      city: 'Jakarta Selatan',
      zip: '12190',
    },
    createdAt: '2026-11-03T15:20',
    updatedAt: '2026-11-03T15:20',
  }),
  c({
    id: 'firman-utina',
    number: 'CNT-1793680225015-B7B1E6',
    displayName: 'Firman Utina',
    company: 'PT UMBI UMBIAN',
    groups: ['Vendor'],
    salutation: 'Bapak',
    firstName: 'Firman',
    lastName: 'Utina',
    email: 'zakiamin@gmail.com',
    mobile: '081823773483',
  }),
  c({
    id: 'adada',
    number: 'CNT-1793613734092-8405ED',
    displayName: 'adada',
    types: ['other'],
  }),
  c({
    id: 'adaa',
    number: 'CNT-1793613720168-8AAA38',
    displayName: 'adaa',
    types: ['employee'],
  }),
  c({
    id: 'asep-arsip',
    number: 'CNT-1793611407375-41F530',
    displayName: 'asep',
    types: ['employee'],
    company: 'jajang sukija',
    salutation: 'Ms.',
    firstName: 'jajang',
    lastName: 'asep',
    email: 'asep@gmail.com',
    mobile: '0899612312132',
    archived: true,
  }),
  c({
    id: 'asep',
    number: 'CNT-1793610540580-1AA7B8',
    displayName: 'asep',
    company: 'PT Indoland Manajemen Properti Terpadu',
    salutation: 'Ibu',
    firstName: 'jadja',
    middleName: 'jaja',
    lastName: 'ajadja',
    email: 'indolandgroup.id@gmail.com',
    mobile: '087781842034',
    arAccount: '1-10101',
  }),
  c({ id: 'adad', number: 'CNT-1793610418033-AFAA33', displayName: 'adad' }),
  c({ id: 'testtttt', number: 'CNT-1793610020444-CEF7A7', displayName: 'testtttt' }),
  c({
    id: 'jaya-abadi',
    number: 'CNT-1793602167222-3F635E',
    displayName: 'PT Jaya abadi',
    salutation: 'Ibu',
    firstName: 'Asep',
    middleName: 'Septiadi',
    lastName: 'jajajng',
    email: 'raga@gmail.com',
    mobile: '0895124124124',
  }),
  c({
    id: 'aaljooz',
    number: 'CNT-1791962038618-A4E512',
    displayName: 'AAlJooz',
    types: ['unit'],
    firstName: 'IJooz',
    email: 'ijooz@gmail.com',
    mobile: '02129429242',
    arAccount: null,
    apAccount: null,
  }),
  c({
    id: 'aag0808',
    number: 'CNT-1791958815471-9C2D10',
    displayName: 'AAG0808',
    types: ['unit'],
    firstName: 'Shakila',
    lastName: 'Samosir',
    email: 'shakila.samosir@proapps.id',
    billing: {
      address: 'Kl. Muwardi No. 455',
      province: 'Sumatera Barat',
      city: 'Kota Padang Panjang',
      zip: '80378',
    },
    arAccount: '1-10101',
    apAccount: null,
  }),
  c({
    id: 'aag1109',
    number: 'CNT-1791958815502-04B7A1',
    displayName: 'AAG1109',
    types: ['unit'],
    firstName: 'Karen',
    lastName: 'Marpaung',
    email: 'karen.marpaung@proapps.id',
    billing: {
      address: 'Jl. Gatot Subroto No. 12',
      province: 'Sumatera Utara',
      city: 'Kota Medan',
      zip: '20112',
    },
    arAccount: '1-10101',
    apAccount: null,
  }),
  c({
    id: 'aag1007',
    number: 'CNT-1791958815388-77E0C3',
    displayName: 'AAG1007',
    types: ['unit'],
    firstName: 'Ghani',
    lastName: 'Gunarto',
    email: 'ghani.gunarto@proapps.id',
    billing: {
      address: 'Jl. Pemuda No. 88',
      province: 'Jawa Tengah',
      city: 'Kota Semarang',
      zip: '50132',
    },
    arAccount: '1-10101',
    apAccount: null,
  }),
  c({
    id: 'aab2606',
    number: 'CNT-1791958815120-5A3F9E',
    displayName: 'AAB2606',
    types: ['unit'],
    arAccount: '1-10101',
    apAccount: null,
  }),
  c({
    id: 'mitra-teknik',
    number: 'CNT-1791802211743-C19A04',
    displayName: 'CV Mitra Teknik Lift',
    types: ['supplier'],
    company: 'CV Mitra Teknik Lift',
    groups: ['Vendor'],
    salutation: 'Bapak',
    firstName: 'Hendra',
    lastName: 'Wijaya',
    email: 'admin@mitrateknik.co.id',
    phone: '021-5550192',
    npwp: '01.234.567.8-012.000',
    billing: {
      address: 'Jl. TB Simatupang No. 21',
      province: 'DKI Jakarta',
      city: 'Jakarta Selatan',
      zip: '12560',
    },
    banks: [
      { bank: 'BCA', number: '5270123456', holder: 'CV Mitra Teknik Lift', branch: 'KCU Cilandak' },
    ],
    arAccount: null,
    apAccount: '2-10001',
    term: 'net15',
    termDays: 15,
    createdAt: '2026-10-01T08:30',
    updatedAt: '2026-10-12T14:02',
  }),
];
