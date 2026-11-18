// Faktur, pesanan, dan (nanti) penawaran memakai form yang sama: isian, perhitungan,
// dan langkahnya identik. Yang berbeda hanya istilah dan nomor dokumennya, dan itu
// dikumpulkan di sini supaya formnya tidak perlu digandakan per jenis dokumen.
export const DOC = {
  invoice: {
    kind: 'invoice',
    word: 'faktur',
    // Judul dan istilah di PDF dokumen ini.
    pdf: { heading: 'FAKTUR PENJUALAN', totalLabel: 'Total tagihan', showBalance: true },
    newTitle: 'Buat Faktur Penjualan',
    editTitle: 'Ubah Faktur Draf',
    newHint:
      'Isi dalam tiga langkah: informasi umum, rincian produk dan jasa, lalu diskon dan tambahan.',
    numberLabel: 'Nomor Faktur',
    dateLabel: 'Tanggal Transaksi',
    dueLabel: 'Tanggal Jatuh Tempo',
    saveLabel: 'Simpan Faktur',
    publishLabel: 'Simpan & Terbitkan',
    backList: 'Daftar faktur',
    backDetail: 'Rincian faktur',
    // Kolom yang hanya pantas ada di jenis dokumen ini.
    totalLabel: 'Total Tagihan Akhir',
    steps: { items: 'Yang ditagihkan', extras: 'Diskon, potongan, catatan' },
    fields: {
      billing: 'Alamat Penagihan (Billing)',
      unit: 'Unit / Tower',
      terms: null,
      linesTitle: 'Baris tagihan',
      sourceLabel: 'Ambil dari Pesanan / Penawaran',
      // Hanya faktur yang jatuh temponya ditentukan termin pembayaran (S3).
      termDrivesDue: true,
    },
  },
  quote: {
    kind: 'quote',
    word: 'penawaran',
    pdf: { heading: 'PENAWARAN HARGA', totalLabel: 'Total penawaran', showBalance: false },
    pdfDateLabel: 'Tanggal penawaran',
    pdfDueLabel: 'Berlaku sampai',
    newTitle: 'Buat Penawaran',
    editTitle: 'Ubah Penawaran Draf',
    newHint:
      'Isi dalam tiga langkah: informasi umum, rincian produk dan jasa, lalu diskon dan tambahan.',
    numberLabel: 'Nomor Penawaran',
    dateLabel: 'Tanggal Penawaran',
    // Penawaran tidak menagih; tanggalnya batas berlakunya harga yang ditawarkan.
    dueLabel: 'Berlaku Sampai',
    saveLabel: 'Simpan Penawaran',
    publishLabel: 'Simpan Penawaran',
    backList: 'Daftar penawaran',
    backDetail: 'Rincian penawaran',
    totalLabel: 'Total Penawaran',
    steps: { items: 'Yang ditawarkan', extras: 'Diskon, syarat, catatan' },
    fields: {
      // Penawaran belum menagih: tidak ada alamat penagihan.
      billing: null,
      // Unitnya sudah ikut kontak pelanggan yang dipilih, dan penawaran sering
      // dibuat sebelum unitnya pasti. Jadi tidak ada isian unit/tower di sini.
      unit: null,
      terms: 'Syarat & Ketentuan',
      linesTitle: 'Baris penawaran',
      termDrivesDue: false,
    },
  },
  order: {
    kind: 'order',
    word: 'pesanan',
    pdf: { heading: 'PESANAN PENJUALAN', totalLabel: 'Total pesanan', showBalance: false },
    pdfDateLabel: 'Tanggal pesanan',
    pdfDueLabel: 'Target selesai',
    newTitle: 'Buat Pesanan Penjualan',
    editTitle: 'Ubah Pesanan Draf',
    newHint:
      'Isi dalam tiga langkah: informasi umum, rincian produk dan jasa, lalu diskon dan tambahan.',
    numberLabel: 'Nomor Pesanan',
    dateLabel: 'Tanggal Pesanan',
    // S15: transaksi di sini kebanyakan jasa, jadi yang ditunggu penyelesaiannya.
    dueLabel: 'Target Selesai',
    saveLabel: 'Simpan Pesanan',
    publishLabel: 'Simpan Pesanan',
    backList: 'Daftar pesanan',
    backDetail: 'Rincian pesanan',
    totalLabel: 'Total Pesanan',
    steps: { items: 'Yang dipesan', extras: 'Diskon, potongan, catatan' },
    fields: {
      // Pesanan dikirim, belum ditagih: yang relevan alamat pengiriman.
      billing: 'Alamat / Catatan Pengiriman',
      // Sama seperti penawaran: unitnya sudah ikut kontak pelanggan. Isian
      // unit/tower baru muncul di faktur, dokumen yang benar-benar menagih.
      unit: null,
      // S13: syarat dari penawaran ikut terbawa ke pesanan.
      terms: 'Syarat & Ketentuan',
      linesTitle: 'Baris pesanan',
      sourceLabel: 'Ambil dari Penawaran',
      termDrivesDue: false,
    },
  },
};
