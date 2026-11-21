// Harga perolehan persediaan (PSAK 14).
//
// Harga perolehan = harga beli (DPP setelah diskon) + biaya yang dapat diatribusikan
// langsung — di sini ongkir — ditambah PPN bila PPN-nya tidak bisa dikreditkan.
//
// Modul ini sengaja tidak mengimpor apa pun selain kebijakan perusahaan: ia dipakai
// PO, penerimaan barang, retur, dan pembuatan mutasi stok, sehingga keempatnya tidak
// mungkin memakai angka yang berbeda.
import { freightCapitalized, vatCapitalized } from '@/pages/Pengaturan/settings.js';

const sum = (arr, fn) => arr.reduce((n, x) => n + fn(x), 0);

/** Baris barang saja — jasa tidak masuk persediaan, jadi tidak menyerap ongkir. */
const goodsLines = (po) => (po?.items ?? []).filter((i) => i.kind !== 'jasa');

/**
 * Porsi ongkir satu baris PO, dialokasikan proporsional terhadap nilai DPP baris
 * (setelah diskon, karena harga baris PO sudah bersih diskon).
 */
export function freightShare(po, itemId) {
  const ship = Number(po?.shipping) || 0;
  if (!ship) return 0;
  const barang = goodsLines(po);
  const total = sum(barang, (i) => i.qty * i.price);
  const line = barang.find((i) => i.id === itemId);
  if (!line || total <= 0) return 0;
  return (ship * (line.qty * line.price)) / total;
}

/**
 * Harga perolehan PER UNIT satu barang pada sebuah PO.
 *
 * Ongkir per unit dihitung dari qty PESANAN, bukan qty yang diterima, supaya
 * penerimaan sebagian memakai angka per unit yang sama dengan penerimaan penuh.
 *
 * @param doc dokumen yang sedang diproses (penerimaan / faktur); dipakai membaca
 *            tanda "PPN tidak dapat dikreditkan" yang berlaku untuk dokumen itu saja
 * @returns {{ dpp: number, freight: number, vat: number, total: number }} per unit
 */
export function landedUnitCost(po, itemId, settings, doc) {
  const line = (po?.items ?? []).find((i) => i.id === itemId);
  if (!line) return { dpp: 0, freight: 0, vat: 0, total: 0 };
  const dpp = Number(line.price) || 0;
  const freight =
    freightCapitalized(settings) && line.qty > 0 ? freightShare(po, itemId) / line.qty : 0;
  const vat = vatCapitalized(settings, doc) ? dpp * (line.ppnRate ?? 0) : 0;
  return { dpp, freight, vat, total: dpp + freight + vat };
}

/** Ongkir yang menempel pada sejumlah qty barang — dipakai saat retur (H14). */
export const freightOf = (po, itemId, qty, settings) =>
  freightCapitalized(settings) ? landedUnitCost(po, itemId, settings).freight * qty : 0;

/** Total ongkir PO yang jatuh ke baris barang. */
export const totalFreight = (po) => (Number(po?.shipping) || 0);
