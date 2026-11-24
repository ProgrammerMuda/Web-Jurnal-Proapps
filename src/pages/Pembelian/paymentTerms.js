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
//   dpOutOfSchedule  true                  -> (lama) uang muka dikeluarkan dari nilai yang dibagi.
//                                             Termin baru memotong DP proporsional di tiap faktur.
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
  { value: 'receipt', label: 'Tanggal penerimaan (FPB / BAPP)' },
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
// Isi awal, bukan termin bawaan: semuanya termin biasa yang bisa diubah, dinonaktifkan, dan
// dihapus selama belum dipakai dokumen. Tujuannya cuma supaya penawaran vendor bisa langsung
// diisi tanpa menyiapkan katalog dari nol dulu. Hapus saja yang tidak dipakai gedung Anda.
const starter = (o) => ({ hint: '', example: '', active: true, dueFrom: 'receipt', defaults: {}, ...o });

export const paymentTermsSeed = [
  // --- Barang (PO): patokannya pengiriman ---
  starter({
    id: 'cad', label: 'CAD — bayar setelah diterima', scope: 'barang',
    hint: 'Dibayar penuh setelah barang diterima', example: 'ATK, consumable, vendor langganan',
    advance: 'none', split: 'none', due: false,
  }),
  starter({
    id: 'dp-30', label: 'DP + pelunasan', scope: 'barang',
    hint: 'Uang muka di awal, sisanya setelah barang diterima', example: 'Furnitur custom, mesin, pesanan khusus',
    advance: 'partial', split: 'none', due: false, defaults: { dpPct: 30 },
  }),
  starter({
    id: 'cbd', label: 'CBD — bayar sebelum kirim', scope: 'barang',
    hint: '100% dibayar sebelum barang dikirim', example: 'Vendor baru, pembelian kecil',
    advance: 'full', split: 'none', due: false,
  }),

  // --- Jasa (SPK): patokannya penyelesaian pekerjaan ---
  starter({
    id: 'net-30', label: 'Bayar penuh di akhir', scope: 'jasa',
    hint: 'Dibayar penuh setelah BAPP, dengan tempo', example: 'Servis AC, perbaikan kecil, konsultasi singkat',
    advance: 'none', split: 'none', due: true, defaults: { dueDays: 30 },
  }),
  starter({
    id: 'progres-3', label: 'Termin progres', scope: 'jasa',
    hint: 'Ditagih per milestone sesuai progres pekerjaan', example: 'Renovasi, instalasi jaringan',
    advance: 'none', split: 'terms', due: true, defaults: { terms: 3, dueDays: 30 },
  }),
  starter({
    id: 'dp-progres', label: 'DP + termin progres', scope: 'jasa',
    hint: 'Uang muka di awal, sisanya dibagi per milestone', example: 'Konstruksi, renovasi besar',
    advance: 'partial', split: 'terms', due: true,
    defaults: { dpPct: 20, terms: 4, dueDays: 30 },
  }),
  starter({
    id: 'retensi-5', label: 'Termin progres + retensi', scope: 'jasa',
    hint: 'Per milestone, sebagian ditahan selama masa pemeliharaan', example: 'Konstruksi, instalasi mesin, MEP',
    advance: 'none', split: 'terms', retention: true, due: true,
    defaults: { terms: 3, retentionPct: 5, retentionMonths: 6, dueDays: 30 },
  }),
  // Varian retensi: sebagian nilai ditahan sampai masa pemeliharaan habis, ditagih sebagai
  // baris "Retensi" tersendiri di SPK. Mekanisnya sama dengan termin di atas + saklar retensi.
  starter({
    id: 'penuh-retensi', label: 'Bayar penuh di akhir + retensi', scope: 'jasa',
    hint: 'Sekali tagih setelah BAPP, sebagian ditahan selama masa pemeliharaan', example: 'Instalasi AC, pengecatan gedung, pemasangan pompa',
    advance: 'none', split: 'none', retention: true, due: true,
    defaults: { retentionPct: 5, retentionMonths: 6, dueDays: 30 },
  }),
  starter({
    id: 'dp-progres-retensi', label: 'DP + termin progres + retensi', scope: 'jasa',
    hint: 'Uang muka di awal, sisanya per milestone, sebagian ditahan selama masa pemeliharaan', example: 'Konstruksi besar, renovasi total lantai',
    advance: 'partial', split: 'terms', retention: true, due: true,
    defaults: { dpPct: 20, terms: 4, retentionPct: 5, retentionMonths: 12, dueDays: 30 },
  }),
  starter({
    id: 'retensi-10', label: 'Termin progres + retensi 10%', scope: 'jasa',
    hint: 'Per milestone, 10% ditahan selama setahun masa pemeliharaan', example: 'Instalasi lift, genset, sistem pemadam kebakaran',
    advance: 'none', split: 'terms', retention: true, due: true,
    defaults: { terms: 3, retentionPct: 10, retentionMonths: 12, dueDays: 30 },
  }),
  starter({
    id: 'bulanan-12', label: 'Berkala per periode', scope: 'jasa',
    hint: 'Ditagih rutin tiap periode sesuai BAPP periode', example: 'Cleaning service, security, maintenance',
    advance: 'none', split: 'periods', due: true, defaults: { period: 'bulan', periods: 12, dueDays: 30 },
  }),
];

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
