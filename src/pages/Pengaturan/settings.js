// Kebijakan perusahaan yang menentukan APA SAJA yang masuk harga perolehan
// persediaan. Dua-duanya dikumpulkan di sini karena keduanya menjawab pertanyaan
// yang sama: biaya mana yang menempel ke barang, dan mana yang langsung jadi beban.

export const FREIGHT_POLICY = {
  capitalize: {
    value: 'capitalize',
    label: 'Masuk harga perolehan',
    hint: 'Ongkir dibagi ke tiap barang sesuai nilainya, lalu menempel pada harga per unit (PSAK 14).',
  },
  expense: {
    value: 'expense',
    label: 'Dibebankan langsung',
    hint: 'Ongkir langsung jadi beban Pengiriman & Pengangkutan. Cocok bila ongkirnya kecil atau tidak material.',
  },
};

export const PKP_STATUS = {
  pkp: {
    value: true,
    label: 'PKP',
    hint: 'PPN Masukan dicatat sebagai pajak dan bisa dikreditkan, jadi tidak menambah harga barang.',
  },
  nonPkp: {
    value: false,
    label: 'Non-PKP',
    hint: 'PPN pembelian tidak bisa dikreditkan, jadi dimasukkan ke harga barang.',
  },
};

/** Akun beban ongkir saat kebijakannya "Dibebankan langsung". */
export const AKUN_ONGKIR = '5-10005';

/**
 * Pemetaan alasan selisih opname → akun. Nilai bawaannya ada di opname.js;
 * yang disimpan di sini hanya perubahan pengguna. Akun yang dipakai dikunci ke
 * dokumen saat diposting, jadi mengubahnya tidak menyentuh opname lama.
 */
/**
 * Kategori akun yang boleh dipakai, dipisah per arah selisih:
 * barang berkurang selalu jadi beban, barang bertambah jadi pendapatan lain
 * atau akun penyesuaian. Alasan yang bisa dua arah (Salah catat, Lainnya)
 * boleh memakai keduanya.
 */
export const OPNAME_ACCOUNT_CATEGORIES = {
  loss: ['Beban', 'Beban Lainnya'],
  gain: ['Pendapatan Lainnya', 'Beban Lainnya'],
  both: ['Beban', 'Beban Lainnya', 'Pendapatan Lainnya'],
};

export const defaultCompanySettings = {
  isPkp: true,
  freightPolicy: 'capitalize',
  opnameAccounts: null, // null = pakai bawaan dari opname.js
};

/**
 * PPN ikut menjadi harga perolehan bila perusahaan non-PKP, atau bila dokumen
 * itu ditandai PPN-nya tidak dapat dikreditkan. Tanda itu tidak lagi bisa dipasang dari
 * form FPB (gudang tidak tahu status pajak); yang dibaca di sini hanya dari data lama.
 * Kasus langka faktur pajak cacat diselesaikan accounting dengan jurnal penyesuaian.
 */
export const vatCapitalized = (settings, doc) =>
  !settings?.isPkp || !!doc?.vatNotCreditable;

/** Ongkir ikut menjadi harga perolehan? */
export const freightCapitalized = (settings) =>
  (settings?.freightPolicy ?? 'capitalize') === 'capitalize';
