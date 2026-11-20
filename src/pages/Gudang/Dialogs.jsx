// Dialog konfirmasi menu Gudang. Semuanya memakai FormModal project.
import { useState } from 'react';
import { Box, Button, Group, Stack, Text } from '@mantine/core';
import NumberField from '@/components/NumberField.jsx';
import { FormModal } from '@/components/common.jsx';
import { Info, Prohibit, Trash, Warehouse, Warning } from '@/components/Icon.jsx';
import { rupiah } from '@/pages/Penjualan/utils.js';
import { Callout } from '@/pages/Pembelian/components.jsx';

// Modal Mantine memakai animasi keluar, jadi isinya masih dirender sesaat setelah
// datanya dikosongkan. Nilai terakhir ditahan supaya judulnya tidak berkedip kosong.
function useSticky(value) {
  const [last, setLast] = useState(value);
  if (value && value !== last) setLast(value);
  return value ?? last;
}

export function MakeDefaultDialog({ warehouse, current, onClose, onConfirm }) {
  const w = useSticky(warehouse);
  const from = useSticky(current);
  return (
    <FormModal
      opened={!!warehouse}
      onClose={onClose}
      title="Jadikan gudang utama?"
      subtitle="Hanya ada satu gudang utama"
      icon={Warehouse}
      size={460}
      footer={
        <>
          <Button variant="default" radius="md" onClick={onClose}>
            Batal
          </Button>
          <Button radius="md" onClick={onConfirm}>
            Jadikan utama
          </Button>
        </>
      }
    >
      <Text fz="sm" c="slate.7">
        Gudang utama pindah dari <b>{from?.name ?? '—'}</b> ke <b>{w?.name}</b>. Transaksi baru
        otomatis memakai {w?.name}. Transaksi lama tidak berubah.
      </Text>
    </FormModal>
  );
}

export function DeactivateDialog({ warehouse, blockers = [], showValue, onClose, onConfirm, onSolve }) {
  const w = useSticky(warehouse);
  const list = useSticky(blockers.length ? blockers : null) ?? [];
  const blocked = list.length > 0;
  return (
    <FormModal
      opened={!!warehouse}
      onClose={onClose}
      title={blocked ? `${w?.name} belum bisa dinonaktifkan` : `Nonaktifkan ${w?.name}?`}
      subtitle={blocked ? `Gudang ${w?.code ?? ''}` : 'Gudang tetap muncul di laporan dan riwayat'}
      icon={blocked ? Prohibit : Warning}
      size={520}
      footer={
        blocked ? (
          <Button variant="default" radius="md" onClick={onClose}>
            Tutup
          </Button>
        ) : (
          <>
            <Button variant="default" radius="md" onClick={onClose}>
              Batal
            </Button>
            <Button color="red" radius="md" onClick={onConfirm}>
              Nonaktifkan
            </Button>
          </>
        )
      }
    >
      {blocked ? (
        <Stack gap="sm">
          <Text fz="sm" c="slate.7">
            Selesaikan hal berikut dulu:
          </Text>
          <Stack gap="xs">
            {list.map((b) => (
              <Group
                key={b.key}
                justify="space-between"
                wrap="nowrap"
                gap="sm"
                p="sm"
                bg="slate.0"
                style={{ borderRadius: 'var(--mantine-radius-md)' }}
              >
                <Box style={{ minWidth: 0 }}>
                  <Text fz="xs" c="slate.8">
                    {b.text}
                    {showValue && b.value != null && (
                      <Text span fz="xs" c="slate.6">
                        {' '}
                        ({rupiah(b.value)})
                      </Text>
                    )}
                  </Text>
                </Box>
                <Button size="xs" variant="light" radius="md" onClick={() => onSolve(b)}>
                  {b.actionLabel}
                </Button>
              </Group>
            ))}
          </Stack>
        </Stack>
      ) : (
        <Text fz="sm" c="slate.7">
          Gudang ini tidak bisa dipilih di transaksi baru, tetapi tetap muncul di laporan dan
          riwayat.
        </Text>
      )}
    </FormModal>
  );
}

export function CancelTransferDialog({ transfer, warehouseName, posted, onClose, onConfirm }) {
  const t = useSticky(transfer);
  const sudahPosting = useSticky(posted || null) ?? false;
  return (
    <FormModal
      opened={!!transfer}
      onClose={onClose}
      title={sudahPosting ? `Batalkan ${t?.no ?? ''}?` : `Tarik ${t?.no ?? ''}?`}
      subtitle={sudahPosting ? 'Mutasi asli tetap tersimpan di riwayat' : 'Belum ada mutasi yang tercatat'}
      icon={Prohibit}
      size={460}
      footer={
        <>
          <Button variant="default" radius="md" onClick={onClose}>
            Kembali
          </Button>
          <Button color="red" radius="md" onClick={onConfirm}>
            {sudahPosting ? 'Batalkan pindah barang' : 'Tarik pengajuan'}
          </Button>
        </>
      }
    >
      <Text fz="sm" c="slate.7">
        {sudahPosting ? (
          <>
            Stok kembali ke <b>{warehouseName}</b>. Mutasi pembatalan dicatat sebagai baris baru —
            mutasi aslinya tidak dihapus, supaya jejaknya utuh.
          </>
        ) : (
          <>
            Pengajuan ditarik sebelum disetujui, jadi stok di <b>{warehouseName}</b> memang belum
            pernah berkurang dan tidak ada mutasi yang perlu dibalik.
          </>
        )}
      </Text>
    </FormModal>
  );
}

export function DeleteDialog({ warehouse, onClose, onConfirm }) {
  const w = useSticky(warehouse);
  return (
    <FormModal
      opened={!!warehouse}
      onClose={onClose}
      title={`Hapus ${w?.name}?`}
      subtitle="Tindakan ini tidak bisa dibatalkan"
      icon={Trash}
      size={440}
      footer={
        <>
          <Button variant="default" radius="md" onClick={onClose}>
            Batal
          </Button>
          <Button color="red" radius="md" onClick={onConfirm}>
            Hapus
          </Button>
        </>
      }
    >
      <Text fz="sm" c="slate.7">
        Gudang ini akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
      </Text>
    </FormModal>
  );
}

export function MinStockDialog({ row, warehouse, unit, onClose, onSave }) {
  const r = useSticky(row);
  const w = useSticky(warehouse);
  const [value, setValue] = useState(row?.minQty ?? 0);
  const [submitted, setSubmitted] = useState(false);
  const [lastKey, setLastKey] = useState(row?.productId ?? null);
  if ((row?.productId ?? null) !== lastKey) {
    setLastKey(row?.productId ?? null);
    setValue(row?.minQty ?? 0);
    setSubmitted(false);
  }

  // Kosong berarti tidak dipantau (0). Angka negatif ditolak, bukan diam-diam dibulatkan.
  const kosong = value === '' || value === null || value === undefined;
  const angka = kosong ? 0 : Number(value);
  const error =
    (!kosong && !Number.isFinite(angka) && 'Stok minimum harus berupa angka') ||
    (angka < 0 && 'Stok minimum tidak boleh negatif') ||
    undefined;

  const save = () => {
    setSubmitted(true);
    if (error) return;
    onSave(angka);
  };

  return (
    <FormModal
      opened={!!row}
      onClose={onClose}
      title={`Stok minimum ${r?.product?.name ?? ''}`}
      subtitle="Dipakai untuk menandai stok yang perlu ditambah"
      icon={Info}
      size={440}
      footer={
        <>
          <Button variant="default" radius="md" onClick={onClose}>
            Batal
          </Button>
          <Button radius="md" onClick={save}>
            Simpan
          </Button>
        </>
      }
    >
      <NumberField
        label={`Stok minimum di ${w?.name ?? ''}`}
        description="Boleh 0 atau kosong, berarti stok produk ini tidak dipantau."
        size="sm"
        radius="md"
        // Angka negatif sengaja boleh diketik supaya alasan penolakannya terbaca,
        // bukan diam-diam dibuang saat mengetik.
        unit={unit || undefined}
        // Teks bantuan di bawah kolom isian, bukan menyelip antara label dan input.
        inputWrapperOrder={['label', 'input', 'description', 'error']}
        value={value}
        error={submitted && error}
        onChange={(v) => setValue(v)}
        data-autofocus
      />
      <Callout tone="info">
        Stok minimum berlaku per produk per gudang, jadi angka ini hanya untuk{' '}
        {w?.name ?? 'gudang ini'}. Perubahannya tercatat di tab Riwayat perubahan.
      </Callout>
    </FormModal>
  );
}
