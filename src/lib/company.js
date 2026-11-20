// Identitas perusahaan yang dicetak di kepala dokumen.
//
// Nantinya diambil dari Pengaturan → Profil Perusahaan. Selama menu itu belum ada,
// nilainya dikunci di sini supaya hanya ada satu tempat yang perlu diubah — bukan
// disebar sebagai teks di tiap pembuat PDF.
export const COMPANY = {
  name: 'Demo Site',
  // Inisial untuk kotak logo; dihitung dari nama bila tidak diisi.
  initials: '',
  address: 'Alamat perusahaan, Kota, Kode Pos',
  npwp: '00.000.000.0-000.000',
  phone: '(021) 000-0000',
};

export const companyInitials = (c = COMPANY) =>
  c.initials ||
  c.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
