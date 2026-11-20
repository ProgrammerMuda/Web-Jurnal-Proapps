// Nilai rupiah dalam huruf, untuk dokumen yang perlu dibaca dan ditandatangani.
// Angka di belakang koma diabaikan: nilai dokumen pembelian selalu rupiah bulat.

const ANGKA = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas'];

// "se-" dipakai untuk satuan tunggal (seratus, seribu), bukan "satu ratus".
function kata(n) {
  if (n < 12) return ANGKA[n];
  if (n < 20) return `${ANGKA[n - 10]} belas`;
  if (n < 100) return `${kata(Math.floor(n / 10))} puluh ${kata(n % 10)}`.trim();
  if (n < 200) return `seratus ${kata(n - 100)}`.trim();
  if (n < 1000) return `${kata(Math.floor(n / 100))} ratus ${kata(n % 100)}`.trim();
  if (n < 2000) return `seribu ${kata(n - 1000)}`.trim();
  if (n < 1e6) return `${kata(Math.floor(n / 1000))} ribu ${kata(n % 1000)}`.trim();
  if (n < 1e9) return `${kata(Math.floor(n / 1e6))} juta ${kata(n % 1e6)}`.trim();
  if (n < 1e12) return `${kata(Math.floor(n / 1e9))} miliar ${kata(n % 1e9)}`.trim();
  return `${kata(Math.floor(n / 1e12))} triliun ${kata(n % 1e12)}`.trim();
}

export function terbilang(n) {
  const nilai = Math.round(Math.abs(Number(n) || 0));
  const inti = nilai === 0 ? 'nol' : kata(nilai).replace(/\s+/g, ' ').trim();
  const hasil = `${Number(n) < 0 ? 'minus ' : ''}${inti} rupiah`;
  return hasil.charAt(0).toUpperCase() + hasil.slice(1);
}
