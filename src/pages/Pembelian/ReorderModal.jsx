// Pesan ulang (repeat order) dari PO/SPK yang sudah Selesai.
// Vendor, termin, dan gudang mengikuti pesanan lama dan terkunci; item tidak bisa ditambah,
// hanya dipilih (centang), qty-nya, dan harganya. Harga satuan atau total yang naik dari
// Setiap pesan ulang perlu approval Chief Finance lalu Building Manager sebelum PO-nya berlaku;
// harga satuan atau total yang naik wajib disertai alasan.
import { useState } from 'react';
import { Box, Button, Checkbox, Group, SimpleGrid, Stack, Table, Text, Textarea } from '@mantine/core';
import { ArrowsClockwise } from '@/components/Icon.jsx';
import NumberField from '@/components/NumberField.jsx';
import { useData } from '@/lib/store.jsx';
import { warehouseById } from '@/pages/Gudang/data.js';
import { Callout, FormModal } from './components.jsx';
import { personLabel } from './data.js';
import { logEntry } from './permissions.js';
import { buildReorder, poDocLabel, poAllJasa, poStatus, poStatusMap, poTotal, reorderIncreased, reordersOf, rupiah, termText } from './utils.js';
import { toast } from './usePb.js';

const th = { th: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600, color: 'var(--mantine-color-slate-7)', whiteSpace: 'nowrap' } };
const ENDED = ['selesai', 'dibatalkan', 'ditutup', 'ditolak'];

// Selisih harga satuan: naik merah (perlu approval), turun hijau, sama tidak ditulis.
function Delta({ now, before }) {
  const d = now - before;
  if (!d) return null;
  return (
    <Text fz={11} fw={600} c={d > 0 ? 'red.7' : 'green.8'} style={{ whiteSpace: 'nowrap' }}>
      {d > 0 ? 'naik' : 'turun'} {rupiah(Math.abs(d))}
    </Text>
  );
}

export default function ReorderModal({ opened, onClose, po, pb, onSaved }) {
  const { warehouses } = useData();
  const [lines, setLines] = useState(() => Object.fromEntries(po.items.map((i) => [i.id, { on: true, qty: i.qty, price: i.price }])));
  const [reason, setReason] = useState('');
  const [sub, setSub] = useState(false);
  const label = poDocLabel(po);
  const isJasa = poAllJasa(po);
  const vendor = pb.vendorsById[po.vendorId];
  const gudang = warehouseById(warehouses, po.warehouseId);
  const setLine = (id, patch) => setLines((l) => ({ ...l, [id]: { ...l[id], ...patch } }));

  // Draf PO baru dibangun ulang tiap ketikan: total dan wajib-tidaknya alasan ikut hidup.
  const picked = Object.fromEntries(Object.entries(lines).filter(([, l]) => l.on && l.qty > 0).map(([id, l]) => [id, { qty: l.qty, price: l.price }]));
  const draft = buildReorder(po, picked, pb.pos);
  const none = draft.items.length === 0;
  const increased = !none && reorderIncreased(po, draft);
  const oldTotal = poTotal(po);
  const newTotal = poTotal(draft);

  // Pesanan ganda: PO ini sudah pernah dipesan ulang dan pesanan barunya belum selesai.
  const running = reordersOf(po, pb.pos)
    .map((p) => ({ p, st: poStatus(p, pb.calc) }))
    .filter(({ st }) => !ENDED.includes(st));

  const save = () => {
    setSub(true);
    if (none || (increased && !reason.trim())) return;
    const doc = buildReorder(po, picked, pb.pos, { reason: reason.trim(), by: personLabel(pb.role) });
    // Alasannya disimpan di reorder.reason dan tampil di detail PO; log cukup mencatat pengajuannya.
    doc.reorder.log = [logEntry(pb.role, 'ajukan')];
    pb.add('pos', doc);
    toast(`${doc.number} diajukan ke Chief Finance. Belum berlaku sampai disetujui.`);
    onSaved(doc.id);
  };

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={880}
      icon={ArrowsClockwise}
      title={`Pesan ulang dari ${po.number}`}
      subtitle={vendor?.name ?? '—'}
      footer={
        <>
          <Button variant="default" radius="md" onClick={onClose} mr="auto">Batal</Button>
          <Button radius="md" disabled={none} onClick={save}>Ajukan approval</Button>
        </>
      }
    >
      {running.length > 0 && (
        <Callout tone="warn" title="Mungkin pesanan ganda">
          {po.number} sudah dipesan ulang di {running.map(({ p }) => p.number).join(', ')} dan pesanannya masih{' '}
          {running.map(({ p, st }) => poStatusMap(p)[st]?.label.toLowerCase()).join(', ')}. Pastikan ini memang pesanan tambahan.
        </Callout>
      )}

      {/* Yang terkunci cukup dibaca, tidak perlu tampil seperti isian. */}
      <SimpleGrid cols={{ base: 1, sm: isJasa ? 2 : 3 }} spacing="md">
        {[
          ['Vendor', vendor?.name ?? '—'],
          ['Termin bayar', termText(po.term)],
          !isJasa && ['Kirim ke gudang', gudang?.name ?? 'Belum ditentukan'],
        ].filter(Boolean).map(([k, v]) => (
          <Box key={k}>
            <Text fz={11} fw={600} c="slate.6">{k}</Text>
            <Text fz="sm" fw={600} c="slate.9">{v}</Text>
          </Box>
        ))}
      </SimpleGrid>
      <Text fz={11} c="slate.6" mt={-8}>Mengikuti {po.number}. Untuk vendor, termin, atau item lain, buat permintaan baru.</Text>

      <Box style={{ overflow: 'auto', border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
        <Table verticalSpacing="xs" horizontalSpacing="sm" miw={720} styles={th}>
          <Table.Thead bg="slate.0">
            <Table.Tr>
              <Table.Th w={36} />
              <Table.Th>Item</Table.Th>
              <Table.Th w={150}>Qty</Table.Th>
              <Table.Th w={200}>Harga satuan</Table.Th>
              <Table.Th ta="right" w={150}>Jumlah</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {po.items.map((i) => {
              const l = lines[i.id];
              return (
                <Table.Tr key={i.id} style={{ opacity: l.on ? 1 : 0.5 }}>
                  <Table.Td>
                    <Checkbox size="xs" checked={l.on} aria-label={`Pesan ${i.desc}`} onChange={(e) => setLine(i.id, { on: e.currentTarget.checked })} />
                  </Table.Td>
                  <Table.Td>
                    <Text fz="sm" fw={600}>{i.desc}</Text>
                    <Text fz={11} c="slate.6">Sebelumnya {i.qty} {i.unit} × {rupiah(i.price)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <NumberField size="xs" radius="md" min={0} unit={i.unit} disabled={!l.on} aria-label={`Qty ${i.desc}`} value={l.qty} onChange={(v) => setLine(i.id, { qty: Number(v) || 0 })} />
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <NumberField size="xs" radius="md" money prefix="Rp " disabled={!l.on} aria-label={`Harga satuan ${i.desc}`} value={l.price} onChange={(v) => setLine(i.id, { price: Number(v) || 0 })} />
                      {l.on && <Delta now={l.price} before={i.price} />}
                    </Stack>
                  </Table.Td>
                  <Table.Td ta="right" fz="sm" fw={700}>{l.on ? rupiah(l.qty * l.price) : '–'}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Box>
      {sub && none && <Text fz="xs" c="red.7">Pilih minimal satu item dengan qty lebih dari 0.</Text>}

      <Group justify="flex-end" gap="xl">
        <Box ta="right">
          <Text fz={11} c="slate.6">Total {po.number}</Text>
          <Text fz="sm" fw={600} c="slate.7">{rupiah(oldTotal)}</Text>
        </Box>
        <Box ta="right">
          <Text fz={11} c="slate.6">Total {label} baru (termasuk PPN)</Text>
          <Text fz="lg" fw={700} c="slate.9">{rupiah(newTotal)}</Text>
          {!none && newTotal !== oldTotal && (
            <Text fz={11} fw={600} c={newTotal > oldTotal ? 'red.7' : 'green.8'}>
              {newTotal > oldTotal ? 'naik' : 'turun'} {rupiah(Math.abs(newTotal - oldTotal))}
            </Text>
          )}
        </Box>
      </Group>

      {!none && (
        <>
          <Callout tone="wait" title="Perlu persetujuan Chief Finance lalu Building Manager">
            {increased ? `Harga atau total lebih tinggi dari ${po.number}, jadi alasannya wajib diisi. ` : ''}
            {label} baru belum berlaku, belum bisa diterima atau ditagih, sampai disetujui.
          </Callout>
          <Textarea
            label={increased ? 'Alasan kenaikan' : 'Catatan untuk approver (opsional)'}
            withAsterisk={increased}
            size="sm"
            radius="md"
            autosize
            minRows={2}
            placeholder={increased ? 'Contoh: vendor menaikkan harga mulai November karena bahan baku naik' : 'Contoh: stok habis, kebutuhan bulan Desember'}
            value={reason}
            error={sub && increased && !reason.trim() && 'Alasan wajib diisi'}
            onChange={(e) => setReason(e.currentTarget.value)}
          />
        </>
      )}
    </FormModal>
  );
}
