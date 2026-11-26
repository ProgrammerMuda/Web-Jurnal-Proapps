// Ajukan ubah harga PO dari form faktur: harga di invoice vendor berbeda dari harga PO.
// Naik maupun turun tetap perlu approval Chief Finance lalu Building Manager. Selama menunggu,
// sisa pesanan belum bisa difaktur; setelah disetujui harga baru berlaku untuk qty yang belum
// difaktur, dan faktur dicatat dengan harga itu.
import { useState } from 'react';
import { Box, Button, Group, Stack, Table, Text, Textarea } from '@mantine/core';
import { CurrencyCircleDollar } from '@/components/Icon.jsx';
import NumberField from '@/components/NumberField.jsx';
import { Callout, FormModal } from './components.jsx';
import { personLabel } from './data.js';
import { logEntry } from './permissions.js';
import { buildPriceChange, poDocLabel, rupiah } from './utils.js';
import { toast } from './usePb.js';

const th = { th: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600, color: 'var(--mantine-color-slate-7)', whiteSpace: 'nowrap' } };

function Delta({ d }) {
  if (!d) return <Text fz="sm" c="slate.5">–</Text>;
  return (
    <Text fz="sm" fw={600} c={d > 0 ? 'red.7' : 'green.8'} style={{ whiteSpace: 'nowrap' }}>
      {d > 0 ? '+' : '−'}{rupiah(Math.abs(d))}
    </Text>
  );
}

// Harga satuan yang membuat total faktur sama dengan total invoice vendor, untuk faktur satu item.
// Total faktur hampir linear terhadap harga (PPN, PPh, potongan DP proporsional), jadi ditaksir
// dari dua titik lalu dicari angka bulat terdekat yang pas, karena pembulatan per rupiah.
function suggestPrice(row, vendorTotal, totalWith) {
  const at = (p) => totalWith({ [row.key]: p });
  const t0 = at(row.price);
  const slope = (at(row.price + 1000) - t0) / 1000;
  if (!(slope > 0)) return null;
  const guess = Math.round(row.price + (vendorTotal - t0) / slope);
  if (!(guess > 0)) return null;
  for (const d of [0, -1, 1, -2, 2, -3, 3]) if (at(guess + d) === vendorTotal) return guess + d;
  return guess;
}

// lines: baris faktur yang sedang dicatat ({ poId, itemId, desc, unit, qty, price }).
// vendorTotal: total di invoice vendor yang diketik di form; totalWith(hargaPerBaris) menghitung
// total faktur dengan harga pengganti, dengan rumus yang sama dengan form.
export default function PriceChangeModal({ opened, onClose, pb, lines, vendorNo, file, vendorTotal, totalWith, onSent }) {
  // Satu baris per item PO, qty-nya dijumlah bila item yang sama datang dari beberapa penerimaan.
  const rows = Object.values(lines.reduce((acc, l) => {
    const k = `${l.poId}:${l.itemId}`;
    acc[k] = acc[k] ? { ...acc[k], qty: acc[k].qty + l.qty } : { key: k, poId: l.poId, itemId: l.itemId, desc: l.desc, unit: l.unit, qty: l.qty, price: l.price };
    return acc;
  }, {}));
  // Satu item saja: harga di invoice langsung ditaksir dari total vendor, tinggal dicek.
  const [suggested] = useState(() => (rows.length === 1 && vendorTotal > 0 ? suggestPrice(rows[0], vendorTotal, totalWith) : null));
  const [prices, setPrices] = useState(() => (suggested ? { [rows[0].key]: suggested } : {}));
  const [reason, setReason] = useState('');
  const [sub, setSub] = useState(false);
  // undefined = belum disentuh (sama dengan harga PO); null = dikosongkan, belum diisi.
  const priceOf = (r) => (prices[r.key] === undefined ? r.price : prices[r.key]);
  const empty = rows.filter((r) => !(priceOf(r) > 0));
  const changed = rows.filter((r) => priceOf(r) > 0 && priceOf(r) !== r.price);
  const poIds = [...new Set(changed.map((r) => r.poId))];
  const multiPo = new Set(rows.map((r) => r.poId)).size > 1;
  const newTotal = empty.length ? null : totalWith(Object.fromEntries(rows.map((r) => [r.key, priceOf(r)])));
  const gapLeft = vendorTotal > 0 && newTotal != null ? vendorTotal - newTotal : null;
  // Harga satuan harus bulat: naik Rp 1 per unit menggeser total sebesar `step`. Sisa yang lebih
  // kecil dari itu tidak bisa dihilangkan lewat harga, jadi dianggap pembulatan dan cocok.
  const step = newTotal != null ? Math.abs(totalWith(Object.fromEntries(rows.map((r) => [r.key, priceOf(r) + 1]))) - newTotal) : 0;
  const match = gapLeft != null && Math.abs(gapLeft) <= Math.max(1, step);

  const save = () => {
    setSub(true);
    if (empty.length || !changed.length || !reason.trim()) return;
    for (const poId of poIds) {
      const per = Object.fromEntries(changed.filter((r) => r.poId === poId).map((r) => [r.itemId, priceOf(r)]));
      pb.update('pos', poId, (d) => ({
        ...d,
        priceChange: {
          ...buildPriceChange(d, per, { reason: reason.trim(), invoiceNo: vendorNo?.trim() || null, file: file || null, by: personLabel(pb.role) }),
          log: [logEntry(pb.role, 'ajukan')],
        },
      }));
    }
    const nums = poIds.map((id) => pb.posById[id]?.number).join(', ');
    toast(`Ubah harga ${nums} diajukan ke Chief Finance. Faktur bisa dicatat setelah disetujui.`);
    onSent?.();
  };

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={880}
      icon={CurrencyCircleDollar}
      title="Ajukan ubah harga PO"
      subtitle={vendorNo ? `Sesuai invoice vendor ${vendorNo}` : 'Sesuai invoice vendor'}
      footer={
        <>
          <Button variant="default" radius="md" onClick={onClose} mr="auto">Batal</Button>
          <Button radius="md" disabled={!changed.length} onClick={save}>Ajukan approval</Button>
        </>
      }
    >
      <Text fz="sm" c="slate.7">
        Isi harga satuan yang tertulis di invoice vendor pada item yang berbeda. Item lain biarkan sama dengan harga PO.
      </Text>

      <Box style={{ overflow: 'auto', border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
        <Table verticalSpacing="xs" horizontalSpacing="sm" miw={720} styles={th}>
          <Table.Thead bg="slate.0">
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th ta="right" w={110}>Qty ditagih</Table.Th>
              <Table.Th ta="right" w={130}>Harga PO</Table.Th>
              <Table.Th w={190}>Harga di invoice</Table.Th>
              <Table.Th ta="right" w={140}>Selisih</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => {
              const po = pb.posById[r.poId];
              return (
                <Table.Tr key={r.key}>
                  <Table.Td>
                    <Text fz="sm" fw={600}>{r.desc}</Text>
                    {multiPo && <Text fz={11} c="slate.6">{poDocLabel(po)} {po?.number}</Text>}
                  </Table.Td>
                  <Table.Td ta="right" fz="sm">{r.qty} {r.unit}</Table.Td>
                  <Table.Td ta="right" fz="sm">{rupiah(r.price)}</Table.Td>
                  <Table.Td>
                    <NumberField
                      size="xs"
                      radius="md"
                      money
                      prefix="Rp "
                      aria-label={`Harga di invoice ${r.desc}`}
                      value={priceOf(r) ?? ''}
                      error={sub && !(priceOf(r) > 0)}
                      onChange={(v) => setPrices((p) => ({ ...p, [r.key]: v === '' || v == null ? null : Number(v) }))}
                    />
                  </Table.Td>
                  <Table.Td ta="right">{priceOf(r) > 0 ? <Delta d={r.qty * (priceOf(r) - r.price)} /> : <Text fz="sm" c="slate.5">–</Text>}</Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Box>
      {suggested && prices[rows[0].key] === suggested && (
        <Text fz="xs" c="slate.6" mt={-8}>Harga diisi otomatis dari total invoice vendor. Cocokkan dengan harga satuan di kertas invoice-nya.</Text>
      )}
      {sub && empty.length > 0 && <Text fz="xs" c="red.7">Isi harga di invoice untuk {empty.map((r) => r.desc).join(', ')}. Harga 0 tidak bisa diajukan.</Text>}
      {sub && !empty.length && !changed.length && <Text fz="xs" c="red.7">Belum ada harga yang diubah.</Text>}

      {/* Dua angka sejajar: keduanya total yang dibayar ke vendor (termasuk PPN, setelah potongan). */}
      <Group justify="flex-end" gap="xl" align="flex-end">
        {vendorTotal > 0 && (
          <Box ta="right">
            <Text fz={11} c="slate.6">Total di invoice vendor</Text>
            <Text fz="sm" fw={600} c="slate.7">{rupiah(vendorTotal)}</Text>
          </Box>
        )}
        <Box ta="right">
          <Text fz={11} c="slate.6">Total setelah harga baru (termasuk PPN)</Text>
          <Text fz="lg" fw={700} c="slate.9">{newTotal != null ? rupiah(newTotal) : '–'}</Text>
          {gapLeft != null && (
            <Text fz={11} fw={600} c={match ? 'green.8' : 'orange.8'}>
              {match
                ? (Math.abs(gapLeft) > 1 ? `Cocok, selisih pembulatan ${rupiah(Math.abs(gapLeft))}` : 'Cocok dengan invoice vendor')
                : `Masih selisih ${rupiah(Math.abs(gapLeft))}`}
            </Text>
          )}
        </Box>
      </Group>

      <Stack gap="sm">
        <Callout tone="wait" title="Perlu persetujuan Chief Finance lalu Building Manager">
          Harga baru berlaku untuk sisa {poIds.length > 1 ? 'pesanan' : 'PO'} yang belum difaktur, naik maupun turun. Selama menunggu,
          fakturnya belum bisa dicatat.
        </Callout>
        <Textarea
          label="Alasan perubahan harga"
          withAsterisk
          size="sm"
          radius="md"
          autosize
          minRows={2}
          placeholder="Contoh: vendor menaikkan harga mulai November karena bahan baku naik"
          value={reason}
          error={sub && !reason.trim() && 'Alasan wajib diisi'}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
      </Stack>
    </FormModal>
  );
}
