// Hak akses modul Pembelian — acuan: spesifikasi bagian 2 (hak per peran, matriks per langkah,
// matriks approval pengadaan, pemisahan tugas).
// Semua pengecekan peran di layar memanggil fungsi di sini, bukan membandingkan string peran
// langsung, supaya aturannya hanya ada di satu tempat dan gampang dicocokkan dengan spesifikasi.
import { personLabel, roleOf, TODAY } from './data.js';

// --- 2.2 Siapa yang MEMBUAT dokumen ---------------------------------------------------------------
const CREATE = {
  fppbj: ['peminta'],
  quote: ['accounting'], // penawaran vendor
  procurement: ['accounting'], // pilih jalur, form bidding & vendor tunggal
  po: ['accounting'], // PO / SPK, kirim ke vendor, tutup / batalkan
  fpb: ['gudang'], // penerimaan barang
  bapp: ['gudang'], // serah terima jasa — peran yang sama dengan gudang
  invoice: ['accounting'],
  pr: ['accounting'], // PR DP, pelunasan, retensi
  pv: ['finance'],
  return: ['gudang', 'accounting'],
  // Biaya operasional boleh diajukan siapa saja yang menerima tagihannya; akun dan pajaknya
  // ditetapkan Accounting saat verifikasi.
  expense: ['peminta', 'accounting', 'bm', 'gudang', 'cfo', 'finance'],
};

// Superadmin boleh membuat dan menyetujui apa pun, serta tidak terkena pemisahan tugas.
export const isSuperadmin = (role) => role === 'superadmin';

// --- Siapa yang MEMVERIFIKASI permintaan ----------------------------------------------------------
// Verifikasi FPPBJ dipegang sisi pengadaan / hutang usaha (AP). Pembagiannya beda-beda tiap gedung:
// ada yang di Procurement, ada yang di AP, ada yang dua-duanya. Daftarnya sengaja dibuat terbuka —
// untuk menambah atau mengurangi peran yang boleh memverifikasi, ubah baris ini saja; seluruh layar
// membaca lewat canVerify().
const VERIFY = {
  fppbj: ['accounting'],
  // Biaya: Accounting memilih akun beban, PPN, dan PPh sebelum biaya diajukan ke approver.
  expense: ['accounting'],
};
export const canVerify = (role, doc = 'fppbj') => isSuperadmin(role) || (VERIFY[doc] ?? []).includes(role);
// Peran yang ditunggu untuk verifikasi; dipakai pada chip "Menunggu <peran>".
export const verifierRole = (doc = 'fppbj') => (VERIFY[doc] ?? [])[0];
export const verifierRoles = (doc = 'fppbj') => VERIFY[doc] ?? [];

// --- Siapa yang MENYETUJUI ------------------------------------------------------------------------
// Setiap approval berjenjang DUA tanda tangan, berurutan: Chief Finance lebih dulu, lalu
// Building Manager. Dua sudut pandang yang berbeda — Chief Finance menimbang anggaran dan
// kasnya, Building Manager menimbang kebutuhan operasional gedungnya — jadi urutannya pun
// bermakna, bukan sekadar dua orang menekan tombol yang sama.
//
// Verifikasi FPPBJ sengaja TIDAK berjenjang: itu pemeriksaan kelengkapan berkas, bukan
// keputusan membelanjakan uang. Cukup Accounting.
const APPROVE = {
  procurement: ['cfo', 'bm'], // hasil bidding & vendor tunggal
  // Pesan ulang dengan harga lebih tinggi dari pesanan sebelumnya: keputusan belanja baru,
  // jadi rantainya sama dengan approval pengadaan.
  reorder: ['cfo', 'bm'],
  // Ubah harga PO karena invoice vendor berbeda, naik maupun turun: harga yang disepakati
  // berubah, jadi rantainya sama dengan pesan ulang.
  priceChange: ['cfo', 'bm'],
  fpb: ['cfo', 'bm'], // penerimaan barang
  bapp: ['cfo', 'bm'], // serah terima jasa
  pr: ['cfo', 'bm'], // PR DP, pelunasan, retensi
  // Membatalkan uang muka mengubah syarat bayar yang disepakati di pengadaan: cukup Chief Finance.
  dpWaiver: ['cfo'],
  // Biaya operasional berjenjang menurut nilainya (lihat expenses.js): sampai batas cukup
  // Building Manager, di atasnya Chief Finance lebih dulu.
  expense: ['bm'],
  expenseBig: ['cfo', 'bm'],
};
export const approvalChain = (doc) => APPROVE[doc] ?? [];

// Keadaan approval satu dokumen: siapa saja yang sudah, giliran siapa, dan sudah genap belum.
// Dokumen lama tanpa kolom `approvals` tapi statusnya sudah disetujui dianggap genap — kalau
// tidak, semua dokumen lama akan terlihat mundur jadi menunggu approval lagi.
export function approvalState(doc, kind, { settled = false } = {}) {
  const chain = approvalChain(kind);
  const got = doc?.approvals ?? (settled ? Object.fromEntries(chain.map((r) => [r, { by: '—', at: doc?.date }])) : {});
  const done = chain.filter((r) => got[r]);
  const next = chain.find((r) => !got[r]) ?? null;
  return { chain, got, done, next, complete: !next, total: chain.length };
}

// Giliran peran ini atau tidak. Superadmin boleh mengisi slot mana pun yang kosong.
export const isApproverTurn = (role, doc, kind) =>
  isSuperadmin(role) ? !approvalState(doc, kind).complete : approvalState(doc, kind).next === role;

// --- Log approval & verifikasi ------------------------------------------------------------------
// Setiap ajukan / verifikasi / kembalikan / setujui / tolak dicatat sebagai satu baris log pada
// dokumennya: siapa (nama + peran), kapan (tanggal + jam), langkah yang mana, dan alasannya bila
// ditolak. Log hanya ditambah, tidak pernah diubah, supaya riwayat keputusan bisa dirunut.
// Tanggal memakai TODAY (tanggal prototipe), jamnya jam saat tindakan dilakukan.
export const nowStamp = () => {
  const d = new Date();
  return `${TODAY}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
// action: 'ajukan' | 'verifikasi' | 'kembalikan' | 'setuju' | 'tolak'
// step: peran yang ditunggu pada langkah itu (mis. 'cfo'); berbeda dari `role` bila
// Superadmin mengisi slot orang lain.
export const logEntry = (role, action, extra = {}) => ({ action, role, by: personLabel(role), at: nowStamp(), ...extra });
export const withLog = (doc, entry) => ({ ...doc, log: [...(doc?.log ?? []), entry] });

// Satu tanda tangan dibubuhkan. Mengembalikan dokumen baru + apakah approval-nya sudah genap.
export function signApproval(doc, kind, role) {
  const { next } = approvalState(doc, kind);
  const slot = isSuperadmin(role) ? next : role;
  if (!slot) return { doc, complete: true };
  const at = nowStamp();
  const approvals = { ...(doc.approvals ?? {}), [slot]: { by: personLabel(role), role, at } };
  const signed = withLog({ ...doc, approvals }, { ...logEntry(role, 'setuju', { step: slot }), at });
  return { doc: signed, complete: approvalState({ approvals }, kind).complete };
}

export const canCreate = (role, doc) => isSuperadmin(role) || (CREATE[doc] ?? []).includes(role);
export const canApprove = (role, doc) => isSuperadmin(role) || (APPROVE[doc] ?? []).includes(role);
// Peran yang ditunggu untuk satu langkah; dipakai untuk menampilkan chip "Menunggu <peran>".
export const creatorRole = (doc) => (CREATE[doc] ?? [])[0];
export const approverRole = (doc) => (APPROVE[doc] ?? [])[0];
// Peran yang sedang ditunggu untuk dokumen tertentu; dipakai chip "Menunggu <peran>".
export const pendingApprover = (doc, kind) => approvalState(doc, kind).next;

// Penerimaan: barang lewat FPB (Gudang), jasa lewat BAPP (PIC jasa).
export const receiptDoc = (isJasa) => (isJasa ? 'bapp' : 'fpb');
// Jenis approval untuk satu dokumen penerimaan yang sudah tersimpan: FPB dan BAPP punya
// rantai approval masing-masing (saat ini sama: Chief Finance lalu Building Manager).
export const receiptKind = (r) => (r?.kind === 'jasa' || r?.number?.startsWith('BAPP') ? 'bapp' : 'fpb');
export const receiptName = (r) => (receiptKind(r) === 'bapp' ? 'BAPP' : 'FPB');

// Gudang melihat pesanan dan tanggal kirim, tanpa harga.
export const hidesPrices = (role) => role === 'gudang';

// --- 2.4 Pemisahan tugas ---------------------------------------------------------------------------
// Satu orang tidak boleh menyetujui dokumen yang dia buat sendiri. Di prototype ini tiap peran
// dipegang satu orang, jadi pelanggaran baru mungkin terjadi kalau satu user memegang dua peran.
export const samePerson = (role, personText) =>
  !isSuperadmin(role) && !!personText && personText === personLabel(role);
// Approval pengadaan: pembuat FPPBJ tidak boleh menyetujui pengadaannya sendiri.
export const blockedBySoD = (role, fppbj) => samePerson(role, fppbj?.requester);
// Approval PR: pembuat PR tidak boleh menyetujui PR-nya sendiri.
export const prBlockedBySoD = (role, pr) => samePerson(role, pr?.createdBy);

export const roleLabel = (role) => roleOf(role)?.label ?? role;
