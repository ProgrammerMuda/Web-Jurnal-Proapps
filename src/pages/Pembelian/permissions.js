// Hak akses modul Pembelian — acuan: spesifikasi bagian 2 (hak per peran, matriks per langkah,
// matriks approval pengadaan, pemisahan tugas).
// Semua pengecekan peran di layar memanggil fungsi di sini, bukan membandingkan string peran
// langsung, supaya aturannya hanya ada di satu tempat dan gampang dicocokkan dengan spesifikasi.
import { personLabel, roleOf } from './data.js';

// --- 2.2 Siapa yang MEMBUAT dokumen ---------------------------------------------------------------
const CREATE = {
  fpbj: ['peminta'], // Pesan ulang juga membuat FPBJ baru, pemiliknya tetap peminta
  quote: ['accounting'], // penawaran vendor
  procurement: ['accounting'], // form bidding & pesan ulang
  po: ['accounting'], // PO / SPK, kirim ke vendor, tutup / batalkan
  fpb: ['gudang'], // penerimaan barang
  bast: ['gudang'], // serah terima jasa — peran yang sama dengan gudang
  invoice: ['accounting'],
  pr: ['accounting'], // PR DP, pelunasan, retensi
  pv: ['finance'],
  return: ['gudang', 'accounting'],
};

// Superadmin boleh membuat dan menyetujui apa pun, serta tidak terkena pemisahan tugas.
export const isSuperadmin = (role) => role === 'superadmin';

// --- Siapa yang MENYETUJUI ------------------------------------------------------------------------
// Building Manager memegang semua keputusan: hasil pengadaan, serah terima pekerjaan,
// dan permintaan pembayaran. Finance hanya mengeksekusi pembayarannya.
const APPROVE = {
  procurement: ['bm'], // form bidding & pesan ulang
  bast: ['bm'],
  pr: ['bm'], // PR DP, pelunasan, retensi
};

export const canCreate = (role, doc) => isSuperadmin(role) || (CREATE[doc] ?? []).includes(role);
export const canApprove = (role, doc) => isSuperadmin(role) || (APPROVE[doc] ?? []).includes(role);
// Peran yang ditunggu untuk satu langkah; dipakai untuk menampilkan chip "Menunggu <peran>".
export const creatorRole = (doc) => (CREATE[doc] ?? [])[0];
export const approverRole = (doc) => (APPROVE[doc] ?? [])[0];

// Penerimaan: barang lewat FPB (Gudang), jasa lewat BAST (PIC jasa).
export const receiptDoc = (isJasa) => (isJasa ? 'bast' : 'fpb');

// Gudang melihat pesanan dan tanggal kirim, tanpa harga.
export const hidesPrices = (role) => role === 'gudang';

// --- 2.4 Pemisahan tugas ---------------------------------------------------------------------------
// Satu orang tidak boleh menyetujui dokumen yang dia buat sendiri. Di prototype ini tiap peran
// dipegang satu orang, jadi pelanggaran baru mungkin terjadi kalau satu user memegang dua peran.
export const samePerson = (role, personText) =>
  !isSuperadmin(role) && !!personText && personText === personLabel(role);
// Approval pengadaan: pembuat FPBJ tidak boleh menyetujui pengadaannya sendiri.
export const blockedBySoD = (role, fpbj) => samePerson(role, fpbj?.requester);
// Approval PR: pembuat PR tidak boleh menyetujui PR-nya sendiri.
export const prBlockedBySoD = (role, pr) => samePerson(role, pr?.createdBy);

export const roleLabel = (role) => roleOf(role)?.label ?? role;
