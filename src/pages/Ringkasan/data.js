// Data dummy untuk prototype halaman Ringkasan.

// Format akuntan: dua angka di belakang koma, mis. Rp 1.234.000,00.
export const rupiah = (n) =>
  `${n < 0 ? '-' : ''}Rp ${Math.abs(n).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const kpis = [
  {
    key: 'kas',
    label: 'Saldo Kas & Bank',
    value: 'Rp 8,7 jt',
    sub: '6 rekening kas & bank aktif',
    kind: 'bars',
    caption: 'Saldo positif',
    bars: [100, 46, 46, 5, 2],
  },
  {
    key: 'piutang',
    label: 'Piutang Berjalan',
    value: 'Rp 131,2 jt',
    sub: '95 faktur belum lunas',
    kind: 'ring',
    ring: 5,
    caption: 'Tertagih',
  },
  {
    key: 'tempo',
    label: 'Piutang Jatuh Tempo',
    value: 'Rp 118 jt',
    sub: '88 faktur melewati tempo',
    kind: 'meter',
    meter: 90,
    caption: 'Dari piutang',
  },
  {
    key: 'penjualan',
    label: 'Penjualan Bulan Ini',
    value: 'Rp 4,1 jt',
    sub: '7 faktur terbit · 0 draft',
    kind: 'bars',
    caption: '6 bulan',
    bars: [0, 0, 0, 100, 14, 3],
  },
];

export const billing = {
  koleksi: 5,
  totals: [
    { label: 'Total Ditagihkan (6 Bln)', value: 'Rp 137.668.663,00' },
    { label: 'Total Kas Diterima', value: 'Rp 6.510.000,00' },
    { label: 'Sisa Belum Tertagih', value: 'Rp 131.158.663,00' },
  ],
  max: 116.3,
  ticks: ['Rp 116,3 jt', 'Rp 87,2 jt', 'Rp 58,1 jt', 'Rp 29,1 jt', 'Rp 0'],
  months: [
    { m: 'Jun 26', billed: 0, paid: 0 },
    { m: 'Jul 26', billed: 0, paid: 0 },
    { m: 'Agu 26', billed: 0, paid: 0 },
    { m: 'Sep 26', billed: 116.3, paid: 0 },
    { m: 'Okt 26', billed: 17.9, paid: 5.0 },
    { m: 'Nov 26', billed: 3.47, paid: 1.51 },
  ],
};

export const workToday = [
  { label: 'Persetujuan Tertunda', count: '0', icon: 'shield' },
  { label: 'Faktur Berstatus Draft', count: '0', icon: 'file' },
  { label: 'Periode Pembukuan', count: 'OPEN', icon: 'calendar', badge: true },
];

export const quickActions = [
  { label: 'Jurnal Umum', icon: 'notebook' },
  { label: 'Terima Uang', icon: 'coins' },
  { label: 'Kirim Uang', icon: 'send' },
  { label: 'Transfer Kas', icon: 'transfer' },
];

export const priority = [
  { name: 'AAG1007', count: 1, due: '22 Nov 2026', amount: 10000000, late: false },
  { name: 'AAPT DEREAM KORINDO JAYA', count: 1, due: '15 Sep 2026', amount: 7110869, late: true },
  { name: 'AAF2703', count: 1, due: '15 Sep 2026', amount: 5764975, late: true },
  { name: 'AAB0701', count: 1, due: '15 Sep 2026', amount: 4770801, late: true },
  { name: 'AAA1001', count: 2, due: '15 Sep 2026', amount: 4443935, late: true },
];

export const recentInvoices = [
  { name: 'AAG1007', count: 1, due: '22 Nov 2026', amount: 10000000, late: false },
  { name: 'AAF2703', count: 1, due: '15 Sep 2026', amount: 5764975, late: true },
  { name: 'AAB0701', count: 1, due: '15 Sep 2026', amount: 4770801, late: true },
];

export const aging = {
  total: 'Rp 131.158.663,00',
  invoices: 95,
  rows: [
    { label: 'Belum jatuh tempo', invoices: 7, amount: 13178378, pct: 10, color: 'primary.3' },
    { label: 'Terlambat 1–30 hari', invoices: 2, amount: 5625360, pct: 4, color: 'yellow.5' },
    { label: 'Terlambat 31–60 hari', invoices: 86, amount: 112354925, pct: 86, color: 'orange.6' },
    { label: 'Terlambat > 60 hari', invoices: 0, amount: 0, pct: 0, color: 'red.6' },
  ],
};

export const cashAccounts = [
  { name: 'BCA A/C ….....', code: '1-10004', amount: 11110000, pct: 50 },
  { name: 'Kas Kecil Kasir', code: '1-10002', amount: 5000000, pct: 22 },
  { name: 'Bank OCBC', code: '1-10133', amount: 5000000, pct: 22 },
  { name: 'Kas dan Setara Kas', code: '1-10000', amount: 600000, pct: 3 },
  { name: 'Kas Kecil Badan Pengelola', code: '1-10001', amount: 600000, pct: 3 },
  { name: 'Bank Mandiri A/C …....', code: '1-10003', amount: -13562000, pct: 0 },
];

export const financialPosition = {
  asOf: '4 Nov 2026',
  assets: 'Rp 6.694.280.188,00',
  liabilities: 'Rp 370.327.620,00',
  equity: 'Rp 6.323.952.568,00',
  liabilitiesPct: 5.5,
  equityPct: 94.5,
  workingCapital: 'Rp 6.325.952.568,00',
};

export const auditTrail = [
  { who: 'Finance', no: '#31284', at: '4 Nov, 10.59' },
  { who: 'Finance', no: '#31283', at: '4 Nov, 10.44' },
  { who: 'Finance', no: '#31282', at: '4 Nov, 10.41' },
  { who: '—', no: '#31281', at: '4 Nov, 01.16' },
  { who: '—', no: '#31280', at: '4 Nov, 01.16' },
  { who: '—', no: '#31279', at: '4 Nov, 01.16' },
  { who: '—', no: '#31278', at: '4 Nov, 01.16' },
  { who: '—', no: '#31277', at: '4 Nov, 01.16' },
  { who: '—', no: '#31276', at: '4 Nov, 01.16' },
  { who: '—', no: '#31275', at: '4 Nov, 01.16' },
];
