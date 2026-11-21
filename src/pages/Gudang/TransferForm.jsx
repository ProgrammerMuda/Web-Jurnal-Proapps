// Form Pindah Barang — satu-satunya dokumen yang dibuat dari menu Mutasi Stok,
// karena ia memang milik persediaan, bukan milik Pembelian atau Penjualan.
// Simpan menghasilkan dua mutasi per item (keluar dari asal, masuk ke tujuan)
// dan tidak berjurnal: akun persediaannya sama di kedua gudang.
import { useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
} from '@mantine/core';
import NumberField from '@/components/NumberField.jsx';
import DateField from '@/components/DateField.jsx';
import { FormModal, blockedProps } from '@/components/common.jsx';
import { ArrowsLeftRight, Plus, Trash, Warning } from '@/components/Icon.jsx';
import { BackLink, Callout, DataTable, FormActions, Section } from '@/pages/Pembelian/components.jsx';
import { unitName } from '@/pages/Produk/catalog.js';
import { periodLocked } from '@/pages/Penjualan/data.js';
import { formatDate } from '@/pages/Pembelian/utils.js';
import { canIssue, getBalance } from './stock.js';
import { runningOpnameOf } from './opname.js';

const number = new Intl.NumberFormat('id-ID');
// "2026-09-14" → "Sep 2026"
const monthLabel = (iso) => formatDate(`${iso.slice(0, 7)}-01`).replace(/^\d+ /, '');
const blankLine = () => ({ key: Math.random().toString(36).slice(2), productId: null, qty: 1 });

export default function TransferForm({ data, preset, onCancel, onSave }) {
  const aktif = useMemo(
    () => data.warehouses.filter((w) => w.status === 'active'),
    [data.warehouses],
  );
  // Gudang yang sedang diopname dibekukan (O4): tetap terlihat, tapi tidak bisa
  // dipilih — asal maupun tujuan.
  const opnameOf = (id) => runningOpnameOf(data.opnames, id);
  const options = aktif.map((w) => {
    const o = opnameOf(w.id);
    return {
      value: w.id,
      label: `${w.code} · ${w.name}${o ? ` — Sedang diopname (${o.number})` : ''}`,
      disabled: !!o,
    };
  });

  const [date, setDate] = useState(data.today);
  const [from, setFrom] = useState(preset.fromWarehouseId ?? null);
  const [to, setTo] = useState(null);
  const [lines, setLines] = useState(() => (preset.lines?.length ? preset.lines : [blankLine()]));
  const [notes, setNotes] = useState(preset.notes ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [confirmReset, setConfirmReset] = useState(null); // gudang asal yang menunggu konfirmasi
  const body = useRef(null);

  // Stok tersedia ikut berubah saat tanggal atau gudang asal diganti.
  const availableOf = (productId) =>
    from && productId ? getBalance(data.moves, productId, from, date) : 0;

  const productOptions = useMemo(
    () =>
      data.products
        .filter((p) => p.tracked && getBalance(data.moves, p.id, from, date) > 0)
        .map((p) => ({ value: p.id, label: p.name })),
    [data.products, data.moves, from, date],
  );

  const setLine = (key, patch) =>
    setLines((l) => l.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const pickFrom = (v) => {
    const terisi = lines.some((l) => l.productId);
    if (terisi && v !== from) return setConfirmReset(v);
    setFrom(v);
  };
  const applyFrom = () => {
    setFrom(confirmReset);
    setLines([blankLine()]);
    setConfirmReset(null);
  };

  const dupes = lines
    .map((l) => l.productId)
    .filter((id, i, arr) => id && arr.indexOf(id) !== i);

  const lineError = (l) => {
    if (!l.productId) return 'Pilih produk';
    if (dupes.includes(l.productId)) return 'Produk ini sudah ada di daftar';
    if (!(l.qty > 0)) return 'Qty harus lebih dari 0';
    // Bukan sekadar membandingkan dengan saldo hari itu: saldo pada hari-hari
    // SESUDAHNYA juga tidak boleh jadi negatif, sehingga dokumen bertanggal mundur
    // tertahan di sini — bukan baru saat disetujui.
    const cek = canIssue(data.moves, l.productId, from, date, Number(l.qty) || 0);
    if (!cek.ok) {
      const p = data.products.find((x) => x.id === l.productId);
      const satuan = unitName(data.units, p?.baseUnitId ?? p?.buyUnitId);
      return cek.afterwards
        ? `Hanya ${number.format(Math.max(0, cek.available))} ${satuan} yang bisa dipindah — sisanya sudah dipakai dokumen setelah tanggal ini`
        : `Melebihi stok tersedia (${number.format(cek.available)} ${satuan})`;
    }
    return null;
  };

  const errors = {
    date:
      (!date && 'Tanggal wajib diisi') ||
      (periodLocked(date) && `Periode ${monthLabel(date)} sudah dikunci`) ||
      (date > data.today && 'Tanggal tidak boleh melewati hari ini') ||
      null,
    from:
      (!from && 'Pilih gudang asal') ||
      (opnameOf(from) &&
        `${aktif.find((w) => w.id === from)?.name} sedang diopname (${opnameOf(from).number}). Selesaikan atau batalkan opname dulu`) ||
      null,
    to:
      (!to && 'Pilih gudang tujuan') ||
      (to === from && 'Gudang tujuan harus berbeda dari gudang asal') ||
      (opnameOf(to) &&
        `${aktif.find((w) => w.id === to)?.name} sedang diopname (${opnameOf(to).number}). Selesaikan atau batalkan opname dulu`) ||
      null,
    lines:
      (!lines.length && 'Tambahkan minimal satu produk') ||
      (lines.every((l) => !l.productId) && 'Pilih produk yang akan dipindah') ||
      (lines.some((l) => !l.productId) && 'Ada baris produk yang masih kosong') ||
      (lines.some((l) => lineError(l)) && 'Ada baris yang belum benar') ||
      null,
  };
  const blocked = errors.date || errors.from || errors.to || errors.lines;

  const submit = () => {
    setSubmitted(true);
    if (blocked) {
      body.current?.querySelector?.('[data-invalid]')?.focus?.();
      return;
    }
    onSave({
      date,
      fromWarehouseId: from,
      toWarehouseId: to,
      lines: lines.map((l) => ({ productId: l.productId, qty: Number(l.qty) })),
      notes: notes.trim(),
    });
  };

  const err = (k) => (submitted ? errors[k] : undefined);

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" ref={body}>
      <BackLink label="Kembali ke mutasi stok" onClick={onCancel} />

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group gap="md" wrap="nowrap" align="flex-start">
          <Box
            bg="primary.0"
            c="primary.9"
            style={{ width: 44, height: 44, borderRadius: 'var(--mantine-radius-md)', display: 'grid', placeItems: 'center' }}
          >
            <ArrowsLeftRight size={24} />
          </Box>
          <Box>
            <Text fz="xl" fw={700} c="slate.9">
              Pindah barang
            </Text>
            <Text fz="xs" c="slate.6" maw={620}>
              Memindahkan stok antar gudang. Nilai persediaan tidak berubah, jadi
              perpindahan ini tidak membuat jurnal.
            </Text>
          </Box>
        </Group>
      </Card>

      <Section title="Informasi dokumen" description="Tanggal dan gudang asal / tujuan">
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <DateField
            label="Tanggal"
            withAsterisk
            size="sm"
            radius="md"
            max={data.today}
            value={date}
            error={err('date')}
            data-invalid={submitted && errors.date ? true : undefined}
            onChange={(e) => setDate(e.currentTarget.value)}
          />
          <Select
            label="Gudang asal"
            withAsterisk
            size="sm"
            radius="md"
            searchable
            placeholder="Pilih gudang"
            data={options}
            value={from}
            error={err('from')}
            onChange={pickFrom}
          />
          <Select
            label="Gudang tujuan"
            withAsterisk
            size="sm"
            radius="md"
            searchable
            placeholder="Pilih gudang"
            data={options.filter((o) => o.value !== from)}
            value={to}
            error={err('to')}
            onChange={setTo}
          />
        </SimpleGrid>
      </Section>

      <Section
        title="Barang yang dipindah"
        description="Hanya produk yang stoknya tersedia di gudang asal pada tanggal itu"
        right={
          <Button
            variant="light"
            size="xs"
            radius="md"
            leftSection={<Plus size={14} />}
            disabled={!from}
            onClick={() => setLines((l) => [...l, blankLine()])}
          >
            Tambah produk
          </Button>
        }
      >
        {!from ? (
          <Callout tone="info">Pilih gudang asal dulu supaya stok tersedianya bisa dihitung.</Callout>
        ) : (
          <Stack gap="sm">
            <DataTable
              head={[
                { label: 'Produk' },
                { label: 'Tersedia', align: 'right', w: 140 },
                { label: 'Qty', align: 'right', w: 160 },
                { label: 'Satuan', w: 100 },
                { label: '', w: 50 },
              ]}
              minWidth={720}
            >
              {lines.map((l) => {
                const produk = data.products.find((p) => p.id === l.productId);
                const tersedia = availableOf(l.productId);
                const pesan = submitted ? lineError(l) : null;
                return (
                  <Table.Tr key={l.key} style={{ verticalAlign: 'top' }}>
                    <Table.Td>
                      <Select
                        size="xs"
                        radius="md"
                        searchable
                        placeholder="Pilih produk"
                        data={productOptions}
                        value={l.productId}
                        error={pesan}
                        data-invalid={pesan ? true : undefined}
                        onChange={(v) => setLine(l.key, { productId: v })}
                      />
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text fz="sm" c="slate.7" pt={6}>
                        {l.productId ? number.format(tersedia) : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <NumberField
                        size="xs"
                        radius="md"
                        min={0}
                        value={l.qty}
                        onChange={(v) => setLine(l.key, { qty: Number(v) || 0 })}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text fz="sm" c="slate.7" pt={6}>
                        {produk ? unitName(data.units, produk.baseUnitId ?? produk.buyUnitId) : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label="Hapus baris"
                        disabled={lines.length === 1}
                        onClick={() => setLines((x) => x.filter((y) => y.key !== l.key))}
                      >
                        <Trash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </DataTable>
            <Textarea
              label="Catatan"
              size="sm"
              radius="md"
              minRows={2}
              autosize
              placeholder="Alasan perpindahan, nomor surat jalan internal, dan sebagainya"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
          </Stack>
        )}
      </Section>

      <FormActions error={submitted ? blocked : null} onCancel={onCancel}>
        <Button radius="md" onClick={submit} {...blockedProps(blocked, () => setSubmitted(true))}>
          Simpan
        </Button>
      </FormActions>

      <FormModal
        opened={!!confirmReset}
        onClose={() => setConfirmReset(null)}
        title="Daftar produk akan dikosongkan"
        subtitle="Stok tersedia dihitung per gudang asal"
        icon={Warning}
        size={440}
        footer={
          <>
            <Button variant="default" radius="md" onClick={() => setConfirmReset(null)}>
              Batal
            </Button>
            <Button color="red" radius="md" onClick={applyFrom}>
              Ganti gudang asal
            </Button>
          </>
        }
      >
        <Text fz="sm" c="slate.7">
          Mengganti gudang asal membuat daftar produk yang sudah diisi tidak berlaku lagi.
        </Text>
      </FormModal>
    </Stack>
  );
}
