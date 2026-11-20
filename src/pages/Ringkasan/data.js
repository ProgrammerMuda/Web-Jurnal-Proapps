// Sisa data contoh halaman Ringkasan.
//
// B4: angka penjualan, piutang, umur piutang, penagihan, dan kas & bank TIDAK lagi
// diambil dari sini — semuanya dihitung dari store di summary.js supaya cocok dengan
// halaman Faktur Penjualan. Yang tertinggal di bawah hanya yang memang belum punya
// sumber data: posisi keuangan dan jejak audit (buku besarnya belum dibangun), serta
// daftar tombol aksi cepat.

// Format akuntan: dua angka di belakang koma, mis. Rp 1.234.000,00.
export const rupiah = (n) =>
  `${n < 0 ? '-' : ''}Rp ${Math.abs(n).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const quickActions = [
  { label: 'Jurnal Umum', icon: 'notebook' },
  { label: 'Terima Uang', icon: 'coins' },
  { label: 'Kirim Uang', icon: 'send' },
  { label: 'Transfer Kas', icon: 'transfer' },
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
