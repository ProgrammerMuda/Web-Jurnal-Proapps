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

// lines: baris faktur yang sedang dicatat ({ poId, itemId, desc, unit, qty, price }).
export default function PriceChangeModal({ opened, onClose, pb, lines, vendorNo, file, vendorGap, onSent }) {
  // Satu baris per item PO, qty-nya dijumlah bila item yang sama datang dari beberapa penerimaan.
  const rows = Object.values(lines.reduce((acc, l) => {
    const k = `${l.poId}:${l.itemId}`;
    acc[k] = acc[k] ? { ...acc[k], qty: acc[k].qty + l.qty } : { key: k, poId: l.poId, itemId: l.itemId, desc: l.desc, unit: l.unit, qty: l.qty, price: l.price };
    return acc;
  }, {}));
  const [prices, setPrices] = useState({});
  const [reason, setReason] = useState('');
  const [sub, setSub] = useState(false);
  const priceOf = (r) => prices[r.key] ?? r.price;
  const changed = rows.filter((r) => priceOf(r) !== r.price);
  const gap = rows.reduce((n, r) => n + r.qty * (priceOf(r) - r.price), 0);
  const poIds = [...new Set(changed.map((r) => r.poId))];
  const multiPo = new Set(rows.map((r) => r.poId)).size > 1;

  const save = () => {
    setSub(true);
    if (!changed.length || !reason.trim()) return;
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
                      value={priceOf(r)}
                      onChange={(v) => setPrices((p) => ({ ...p, [r.key]: Number(v) || 0 }))}
                    />
                  </Table.Td>
                  <Table.Td ta="right"><Delta d={r.qty * (priceOf(r) - r.price)} /></Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Box>
      {sub && !changed.length && <Text fz="xs" c="red.7">Belum ada harga yang diubah.</Text>}

      <Group justify="flex-end" gap="xl">
        {vendorGap ? (
          <Box ta="right">
            <Text fz={11} c="slate.6">Selisih dengan invoice vendor</Text>
            <Text fz="sm" fw={600} c="slate.7">{vendorGap > 0 ? '+' : '−'}{rupiah(Math.abs(vendorGap))}</Text>
          </Box>
        ) : null}
        <Box ta="right">
          <Text fz={11} c="slate.6">Selisih tagihan ini (sebelum pajak)</Text>
          <Text fz="lg" fw={700} c={gap > 0 ? 'red.7' : gap < 0 ? 'green.8' : 'slate.9'}>
            {gap ? `${gap > 0 ? '+' : '−'}${rupiah(Math.abs(gap))}` : rupiah(0)}
          </Text>
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
