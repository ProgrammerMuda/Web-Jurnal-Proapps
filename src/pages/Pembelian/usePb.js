import { useMemo } from 'react';
import { notifications } from '@mantine/notifications';
import { useData } from '@/lib/store.jsx';

// Akses state Pembelian + aksi sederhana (tambah / ubah dokumen).
export function usePb() {
  const { pb, setPb, pbRole, setPbRole, resetPb, warehouses } = useData();
  return useMemo(() => {
    const vendorsById = Object.fromEntries(pb.vendors.map((v) => [v.id, v]));
    const byId = (kind) => Object.fromEntries(pb[kind].map((d) => [d.id, d]));
    return {
      ...pb,
      // Master gudang dipakai saat PO dibuat (gudang tujuan bawaan) dan saat dokumen
      // menampilkan nama gudangnya.
      warehouses,
      reset: resetPb,
      role: pbRole,
      setRole: setPbRole,
      vendorsById,
      fppbjById: byId('fppbj'),
      posById: byId('pos'),
      receiptsById: byId('receipts'),
      invoicesById: byId('invoices'),
      prsById: byId('prs'),
      vouchersById: byId('vouchers'),
      // Payment Voucher yang memuat satu Payment Request tertentu.
      voucherOfPr: (prId) => pb.vouchers.find((v) => v.prIds?.includes(prId)),
      // PR multi-vendor menerbitkan satu PV per vendor.
      vouchersOfPr: (prId) => pb.vouchers.filter((v) => v.prIds?.includes(prId)),
      add: (kind, doc) => setPb((s) => ({ ...s, [kind]: [doc, ...s[kind]] })),
      update: (kind, id, fn) =>
        setPb((s) => ({ ...s, [kind]: s[kind].map((d) => (d.id === id ? fn(d) : d)) })),
      // ctx ringkas untuk fungsi hitung di utils.js
      calc: {
        pos: pb.pos,
        receipts: pb.receipts,
        invoices: pb.invoices,
        prs: pb.prs,
        returns: pb.returns,
      },
    };
  }, [pb, pbRole, setPb, setPbRole, resetPb, warehouses]);
}

export const toast = (message, title = 'Berhasil') =>
  notifications.show({ title, message, color: 'green' });
