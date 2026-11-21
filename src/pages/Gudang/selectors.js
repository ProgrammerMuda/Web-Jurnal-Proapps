// Aturan turunan menu Gudang: apakah gudang pernah dipakai, dan apa yang
// menghalangi gudang dinonaktifkan.
import { remainingQty } from '@/pages/Pembelian/utils.js';
import { balanceRows, distinctItemCount, sumValue } from './stock.js';
import { runningOpnameOf } from './opname.js';

/** Peran yang boleh melihat nilai persediaan (R9). Staf gudang cukup tahu qty. */
const VALUE_ROLES = ['accounting', 'cfo', 'finance', 'superadmin'];
export const canViewInventoryValue = (role) => VALUE_ROLES.includes(role);

/**
 * R3 & R4: gudang pernah dipakai di dokumen mana pun?
 * Yang dihitung: mutasi stok, permintaan & pesanan pembelian, penerimaan barang,
 * pesanan penjualan, dan stok opname.
 */
export function hasTransactions(warehouseId, { moves = [], opnames = [], pb, orders = [] }) {
  return (
    moves.some((m) => m.warehouseId === warehouseId) ||
    opnames.some((o) => o.warehouseId === warehouseId) ||
    (pb?.fppbj ?? []).some((d) => d.warehouseId === warehouseId) ||
    (pb?.pos ?? []).some((d) => d.warehouseId === warehouseId) ||
    (pb?.receipts ?? []).some((d) => d.warehouseId === warehouseId) ||
    orders.some((d) => d.warehouseId === warehouseId)
  );
}

/** PO yang belum diterima penuh ke gudang ini — dipakai cek R5. */
export function openPurchaseOrders(warehouseId, pb) {
  const receipts = pb?.receipts ?? [];
  return (pb?.pos ?? []).filter(
    (po) =>
      po.warehouseId === warehouseId &&
      po.withReceipt !== false &&
      !po.closedAs &&
      po.items.some((i) => remainingQty(po, i.id, receipts) > 0),
  );
}

/**
 * R5: daftar alasan gudang belum bisa dinonaktifkan. Kosong = boleh dinonaktifkan.
 * Tiap alasan membawa tautan solusinya.
 */
export function deactivateBlockers(warehouse, ctx) {
  const { moves, minimums, products, warehouses, pb, opnames, today } = ctx;
  const rows = balanceRows(
    { moves, minimums, products, warehouses },
    { warehouseId: warehouse.id, asOf: today },
  );
  const sisa = rows.filter((r) => r.qty > 0);
  const openPo = openPurchaseOrders(warehouse.id, pb);
  const opname = runningOpnameOf(opnames, warehouse.id);

  const list = [];
  if (sisa.length)
    list.push({
      key: 'stok',
      text: `Masih ada stok ${distinctItemCount(rows)} item`,
      value: sumValue(rows),
      action: 'pindah',
      actionLabel: 'Pindah barang',
    });
  if (openPo.length)
    list.push({
      key: 'po',
      text: `${openPo.length} PO belum diterima ke gudang ini`,
      action: 'po',
      actionLabel: 'Lihat PO',
    });
  if (opname)
    list.push({
      key: 'opname',
      text: `Stok opname ${opname.number} masih berjalan`,
      action: 'opname',
      actionLabel: 'Buka opname',
    });
  if (warehouse.isDefault)
    list.push({
      key: 'utama',
      text: 'Ini gudang utama. Pilih gudang utama lain dulu',
      action: 'utama',
      actionLabel: 'Pilih gudang utama',
    });
  return list;
}

// Helper dropdown & pencarian gudang ada di data.js supaya modul lain (Pembelian,
// Penjualan) bisa memakainya tanpa ikut menarik aturan yang bergantung pada
// dokumen pembelian — itu akan membuat impor saling melingkar.
export {
  defaultWarehouseId,
  warehouseById,
  warehouseFilterOptions,
  warehouseOptions,
  warehouseText,
} from './data.js';
