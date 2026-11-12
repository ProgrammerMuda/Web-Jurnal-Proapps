// Data dummy untuk prototype halaman Pusat Laporan Keuangan.

export const categories = [
  { value: 'all', label: 'Semua Laporan', icon: 'all' },
  { value: 'keuangan', label: 'Laporan Keuangan', icon: 'keuangan' },
  { value: 'buku', label: 'Buku & Jurnal', icon: 'buku' },
  { value: 'anggaran', label: 'Anggaran & Analisis', icon: 'anggaran' },
];

export const heroStats = [
  { label: 'Total Laporan', value: '9 Modul', icon: 'file' },
  {
    label: 'Status Sinkron',
    value: 'Live Sync',
    icon: 'database',
    highlight: true,
  },
  { label: 'Format Ekspor', value: 'PDF & XLSX', icon: 'download' },
  { label: 'Standar Buku', value: 'Double Entry', icon: 'check' },
];

export const reports = [
  {
    key: 'buku-besar',
    title: 'Buku Besar',
    subtitle: 'General Ledger',
    description:
      'Telusuri mutasi debit, kredit, dan pergerakan saldo berjalan setiap akun secara komprehensif dalam satu periode pembukuan.',
    category: 'buku',
    icon: 'book',
  },
  {
    key: 'neraca',
    title: 'Neraca',
    subtitle: 'Balance Sheet',
    description:
      'Menampilkan posisi keuangan perusahaan yang mencakup total aset, liabilitas, dan ekuitas modal pada titik waktu tertentu.',
    category: 'keuangan',
    icon: 'scales',
  },
  {
    key: 'laba-rugi',
    title: 'Laba Rugi',
    subtitle: 'Income Statement / Profit & Loss',
    description:
      'Ringkasan pendapatan usaha dikurangi seluruh beban operasional untuk menghitung laba atau rugi bersih bisnis dalam periode terpilih.',
    category: 'keuangan',
    icon: 'chart',
  },
  {
    key: 'neraca-saldo',
    title: 'Neraca Saldo',
    subtitle: 'Trial Balance',
    description:
      'Memastikan keseimbangan total debit dan kredit dari seluruh akun sebelum proses penutupan buku dan laporan akhir.',
    category: 'keuangan',
    icon: 'table',
  },
  {
    key: 'arus-kas',
    title: 'Arus Kas',
    subtitle: 'Cash Flow Statement',
    description:
      'Melacak seluruh aliran kas masuk dan keluar yang terbagi menjadi aktivitas operasi, investasi, dan pendanaan perusahaan.',
    category: 'keuangan',
    icon: 'money',
  },
  {
    key: 'jurnal-umum',
    title: 'Jurnal Umum',
    subtitle: 'Journal Entry Log',
    description:
      'Daftar kronologis dari seluruh pencatatan transaksi jurnal debit-kredit dengan referensi transaksi dan memo penjelasan.',
    category: 'buku',
    icon: 'trend',
  },
  {
    key: 'perubahan-ekuitas',
    title: 'Perubahan Ekuitas',
    subtitle: 'Statement of Changes in Equity',
    description:
      'Menganalisis pergerakan modal pemilik, tambahan modal disetor, penarikan prive, serta akumulasi laba ditahan selama periode berjalan.',
    category: 'keuangan',
    icon: 'transfer',
  },
  {
    key: 'ringkasan-bisnis',
    title: 'Ringkasan Bisnis',
    subtitle: 'Business Executive Summary',
    description:
      'Ikhtisar ringkas metrik performa utama perusahaan dari penjualan, kas, hingga laba operasional untuk manajemen.',
    category: 'anggaran',
    icon: 'pie',
  },
  {
    key: 'laba-rugi-anggaran',
    title: 'Laba Rugi Anggaran',
    subtitle: 'Budget vs Actual Income Statement',
    description:
      'Membandingkan realisasi laba rugi dengan target anggaran belanja untuk melihat deviasi dan efisiensi pengeluaran.',
    category: 'anggaran',
    icon: 'budget',
  },
];
