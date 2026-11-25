// Halaman Jurnal Transaksi satu mutasi stok.
//
// Jurnalnya tidak disimpan — dibentuk ulang dari mutasinya setiap kali dibaca
// (lihat journal.js), jadi halaman ini selalu memperlihatkan keadaan terbaru.
// Tampilannya dari JournalView, sama dengan Jurnal Transaksi di modul lain.
import { Box, Group, Text } from '@mantine/core';
import JournalView from '@/components/JournalView.jsx';
import { CopyIcon, DocNumber, StatusPill } from '@/pages/Pembelian/components.jsx';
import { formatDate } from '@/pages/Pembelian/utils.js';
import { rupiah } from '@/pages/Penjualan/utils.js';
import { unitName } from '@/pages/Produk/catalog.js';
import { MOVE_TYPE, costBreakdownLabel } from './stock.js';
import { moveJournal } from './journal.js';

const number = new Intl.NumberFormat('id-ID');

export default function MoveJournal({ move, data, onBack, onOpenSource, onOpenCard }) {
  const product = data.products.find((p) => p.id === move.productId);
  const warehouse = data.warehouses.find((w) => w.id === move.warehouseId);
  const jurnal = moveJournal(move, product, move.amount, { residual: move.residual });
  const masuk = move.qtyIn > 0;
  const qty = masuk ? move.qtyIn : move.qtyOut;
  const satuan = unitName(data.units, product?.baseUnitId ?? product?.buyUnitId);

  const audit = [
    ['Tanggal transaksi', formatDate(move.date)],
    [
      'Dokumen sumber',
      <DocNumber key="src" onClick={() => onOpenSource?.(move)}>
        {move.sourceNo}
      </DocNumber>,
    ],
    ['Jenis mutasi', <StatusPill key="t" map={MOVE_TYPE} status={move.type} />],
    [
      'Produk',
      <DocNumber key="p" onClick={() => onOpenCard?.(move.productId, move.warehouseId)}>
        {product?.name ?? move.productId}
      </DocNumber>,
    ],
    ['Gudang', warehouse?.name ?? move.warehouseId],
    ['Qty', `${masuk ? '+' : '−'}${number.format(qty)} ${satuan}`],
    [
      'Harga satuan',
      <Box key="hs">
        {rupiah(Math.round(move.unit ?? move.unitCost ?? 0))}
        {costBreakdownLabel(move, rupiah) && (
          <Text fz={11} fw={500} c="slate.6">
            {costBreakdownLabel(move, rupiah)}
          </Text>
        )}
      </Box>,
    ],
    ['Dibukukan oleh', move.createdBy || '—'],
    [
      'ID sistem',
      <Group key="id" gap={6} wrap="nowrap">
        <Text fz="sm" fw={700} c="slate.9" ff="monospace">
          {move.id}
        </Text>
        <CopyIcon value={move.id} size={14} />
      </Group>,
    ],
  ];

  return (
    <JournalView
      // Penerimaan barang dari Pembelian dijurnal lewat FPB-nya, jadi nomornya ikut jurnal FPB.
      entryIds={[`gd-${move.id}`, move.sourceType === 'goods_receipt' ? `pb-rc-${move.sourceId}` : null]}
      backLabel="Kembali ke riwayat mutasi"
      onBack={onBack}
      typeLabel={MOVE_TYPE[move.type].label}
      badges={move.reversalOfId ? [{ label: 'Pembatalan', color: 'red' }] : []}
      date={move.date}
      subtitle={move.sourceNo}
      lines={jurnal}
      note={`${MOVE_TYPE[move.type].label} ${move.sourceNo ?? ''}`.trim()}
      audit={audit}
      notes={[move.note]}
    />
  );
}
