// Nama lengkap PIC: "Bapak Firman Utina". Gelar ditulis tanpa keterangan dalam kurung.
export function fullName(c) {
  const salutation = c.salutation?.replace(/\s*\(.*\)$/, '');
  const name = [c.firstName, c.middleName, c.lastName].filter(Boolean).join(' ');
  return name ? [salutation, name].filter(Boolean).join(' ') : '';
}

// "Jakarta Selatan, DKI Jakarta, 12190" (baris kedua alamat).
export const areaLine = (a) => [a?.city, a?.province, a?.zip].filter(Boolean).join(', ');

export const formatAddress = (a) => [a?.address, areaLine(a)].filter(Boolean).join(', ');

export const shippingOf = (c) => (c.shippingSame ? c.billing : c.shipping);

export function initials(name) {
  const words = name.trim().split(/\s+/);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

export function generateContactNumber() {
  const rand = Math.random().toString(16).slice(2, 8).toUpperCase();
  return `CNT-${Date.now()}-${rand}`;
}

// Bentuk ringkas yang dipakai halaman Penjualan.
export const toCustomer = (c) =>
  c && { id: c.id, name: c.displayName, email: c.email, address: formatAddress(c.billing) };

// Unduh baris data sebagai CSV (dibuka langsung oleh Excel / Google Sheets).
export function downloadCsv(filename, rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

const columns = [
  ['Nomor Kontak', (c) => c.number],
  ['Nama Tampilan', (c) => c.displayName],
  ['Tipe', (c) => c.types.join('; ')],
  ['Perusahaan', (c) => c.company],
  ['Nama Lengkap', fullName],
  ['Email', (c) => c.email],
  ['Handphone', (c) => c.mobile],
  ['Telepon Kantor', (c) => c.phone],
  ['NPWP', (c) => c.npwp],
  ['Alamat Penagihan', (c) => formatAddress(c.billing)],
  ['Akun Piutang', (c) => c.arAccount],
  ['Akun Hutang', (c) => c.apAccount],
  ['Termin (hari)', (c) => c.termDays],
  ['Grup', (c) => c.groups.join('; ')],
  ['Diarsipkan', (c) => (c.archived ? 'Ya' : 'Tidak')],
];

export const contactRows = (contacts) => [
  columns.map(([h]) => h),
  ...contacts.map((c) => columns.map(([, get]) => get(c))),
];

export const templateRows = () => [columns.slice(1, -1).map(([h]) => h)];

export const canBeInvoiced = (c) =>
  !c.archived && c.types.some((t) => t === 'customer' || t === 'unit');
