// Katalog syarat pembayaran (termin bayar) pembelian.
//
// Sebelumnya tiap termin dikenali dari nama tetap ('dp', 'progress', 'retention', ...) dan
// mesin hitung bercabang pada nama itu. Akibatnya termin baru tidak bisa ditambah tanpa
// mengubah kode. Sekarang termin didefinisikan sebagai DATA: satu termin = nama + beberapa
// saklar mekanis, dan mesin hitung membaca saklarnya, bukan namanya.
//
// Empat saklar itu:
//   advance  'none' | 'partial' | 'full'   -> berapa yang dibayar di muka
//   split    'none' | 'terms' | 'periods'  -> nilai dipecah jadi berapa tagihan
//   dpOutOfSchedule  true                  -> uang muka dikeluarkan dari nilai yang dibagi
//   retention        true                  -> sebagian ditahan sampai masa pemeliharaan habis
//   due              true                  -> faktur punya jatuh tempo (hari)
//   dueFrom  'receipt' | 'invoice'          -> jatuh tempo dihitung dari tanggal mana
//
// Kombinasi saklar inilah yang bisa membentuk termin baru. Contoh: "Cicilan 6x" = advance
// 'none' + split 'terms' + due, dengan default terms = 6.

// Isian tambahan yang perlu muncul di form penawaran untuk satu definisi termin.
// Titik hitung jatuh tempo. "Sejak barang/pekerjaan diterima" dan "sejak faktur vendor" adalah
// dua kesepakatan yang berbeda, dan sebelumnya keduanya tertulis sama: "30 hari".
export const DUE_FROM = [
  { value: 'receipt', label: 'Tanggal penerimaan (FPB / BAST)' },
  { value: 'invoice', label: 'Tanggal faktur vendor' },
];
export const dueFromLabel = (v) => (v === 'invoice' ? 'faktur' : 'penerimaan');

export function termFields(def) {
  if (!def) return [];
  return [
    def.advance === 'partial' && 'dp',
    def.split === 'terms' && 'terms',
    def.split === 'periods' && 'period',
    def.retention && 'retention',
    def.due && 'due',
  ].filter(Boolean);
}

// --- Katalog awal -----------------------------------------------------------------------------
// Sengaja kosong: syarat pembayaran dirakit sendiri lewat Pengaturan, tidak ada termin bawaan
// yang dipaksakan. Dokumen yang sudah terbit tetap terbaca karena masing-masing membawa
// salinan mekanismenya sendiri (lihat snapshotTerm di bawah).
export const paymentTermsSeed = [];

// --- Membaca mekanis dari satu termin tersimpan ----------------------------------------------
// Termin yang tersimpan di penawaran / PO membawa salinan saklarnya sendiri (lihat snapshotTerm).
// Salinan itu sengaja dibekukan: kalau katalog diubah bulan depan, dokumen yang sudah terbit
// tidak boleh ikut berubah artinya. Dokumen lama yang belum punya salinan dibaca dari katalog
// bawaan lewat id-nya.
export function termMechanics(t) {
  if (!t) return { advance: 'none', split: 'none', dpOutOfSchedule: false, retention: false, due: false, dueFrom: 'receipt' };
  // Tanpa salinan mekanis, satu-satunya tafsir yang aman adalah termin paling polos:
  // bayar sekali di belakang, tanpa tenggat. Dokumen yang dibuat aplikasi ini selalu
  // membawa salinannya, jadi ini hanya jaring pengaman untuk data yang dirakit manual.
  const src = t.mech ?? {};
  return {
    advance: src.advance ?? 'none',
    split: src.split ?? 'none',
    dpOutOfSchedule: !!src.dpOutOfSchedule,
    retention: !!src.retention,
    due: !!src.due,
    dueFrom: src.dueFrom ?? 'receipt',
    label: t.label ?? src.label ?? t.type,
  };
}

// Salinan saklar + label yang ikut disimpan bersama termin pada penawaran.
export const snapshotTerm = (def) => ({
  label: def.label,
  mech: {
    advance: def.advance ?? 'none',
    split: def.split ?? 'none',
    dpOutOfSchedule: !!def.dpOutOfSchedule,
    retention: !!def.retention,
    due: !!def.due,
    dueFrom: def.dueFrom ?? 'receipt',
    label: def.label,
  },
});
