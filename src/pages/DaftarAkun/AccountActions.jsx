// Tombol di kepala detail akun: "Buat Transaksi Jurnal", dan untuk akun Terbuka (tidak terkunci)
// menu ubah, arsipkan, dan hapus akun. Akun terkunci adalah akun standar sistem, jadi tidak
// bisa diubah dari sini.
//
// Daftar Akun di prototype masih data tetap (accounts.js) tanpa penyimpanan, sehingga aksi ini
// baru sampai konfirmasi dan pemberitahuan; datanya belum benar-benar berubah.
import { Button, Group, Menu, Select, SimpleGrid, Stack, Text, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { FormModal } from '@/components/common.jsx';
import { Archive, CaretDown, CheckCircle, DotsThreeVertical, PencilSimple, Plus, Trash, Warning } from '@/components/Icon.jsx';
import { accountCategories } from './accounts.js';

const toast = (title, message, color = 'green') => notifications.show({
  color,
  icon: color === 'green' ? <CheckCircle size={18} /> : <Warning size={18} />,
  title,
  message,
  radius: 'md',
  withBorder: true,
});
const PROTOTYPE_NOTE = 'Prototype: Daftar Akun belum tersimpan, jadi datanya belum berubah.';

export default function AccountActions({ acc, hasTx, hasChildren }) {
  const [dialog, setDialog] = useState(null);
  const close = () => setDialog(null);
  // Akun yang sudah punya jurnal atau sub-akun tidak dihapus: saldonya dan riwayatnya ikut hilang.
  const deleteBlock = hasTx
    ? 'Sudah ada transaksi. Arsipkan saja.'
    : hasChildren
      ? 'Masih punya sub-akun.'
      : null;

  return (
    <>
      <Group gap="xs">
        {!acc.locked && (
          <Menu position="bottom-end" withinPortal shadow="md" width={250}>
            <Menu.Target>
              <Button variant="default" radius="md" leftSection={<DotsThreeVertical size={16} />} rightSection={<CaretDown size={12} />}>
                Aksi Akun
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<PencilSimple size={14} />} onClick={() => setDialog('edit')}>Ubah akun</Menu.Item>
              <Menu.Item leftSection={<Archive size={14} />} onClick={() => setDialog('archive')}>Arsipkan akun</Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<Trash size={14} />}
                disabled={!!deleteBlock}
                onClick={() => setDialog('delete')}
              >
                Hapus akun
                {deleteBlock && <Text fz={11} c="slate.6">{deleteBlock}</Text>}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
        <Button radius="md" leftSection={<Plus size={16} />} onClick={() => toast('Buat Transaksi Jurnal', 'Form transaksi jurnal belum tersedia di prototype.', 'orange')}>
          Buat Transaksi Jurnal
        </Button>
      </Group>

      {dialog === 'edit' && <EditModal acc={acc} onClose={close} />}
      {dialog === 'archive' && (
        <ConfirmModal
          icon={Archive}
          title={`Arsipkan ${acc.name}?`}
          text="Akun yang diarsipkan tidak muncul lagi di pilihan akun transaksi baru. Saldo dan riwayat jurnalnya tetap ada di laporan, dan akun bisa diaktifkan lagi dari arsip."
          confirm="Arsipkan akun"
          onClose={close}
          onConfirm={() => { close(); toast(`${acc.code} ${acc.name} diarsipkan`, PROTOTYPE_NOTE); }}
        />
      )}
      {dialog === 'delete' && (
        <ConfirmModal
          icon={Trash}
          danger
          title={`Hapus ${acc.name}?`}
          text="Akun ini belum punya transaksi. Akun akan dihapus permanen dari Daftar Akun dan tidak bisa dikembalikan."
          confirm="Hapus akun"
          onClose={close}
          onConfirm={() => { close(); toast(`${acc.code} ${acc.name} dihapus`, PROTOTYPE_NOTE); }}
        />
      )}
    </>
  );
}

function ConfirmModal({ icon, title, text, confirm, danger, onClose, onConfirm }) {
  return (
    <FormModal
      opened
      onClose={onClose}
      size={480}
      icon={icon}
      title={title}
      footer={(
        <Group justify="flex-end" gap="xs">
          <Button variant="default" radius="md" onClick={onClose}>Batal</Button>
          <Button radius="md" color={danger ? 'red' : undefined} onClick={onConfirm}>{confirm}</Button>
        </Group>
      )}
    >
      <Text fz="sm" c="slate.8">{text}</Text>
    </FormModal>
  );
}

function EditModal({ acc, onClose }) {
  const [form, setForm] = useState({ code: acc.code, name: acc.name, category: acc.category, description: acc.description ?? '' });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const invalid = !form.code.trim() || !form.name.trim();
  return (
    <FormModal
      opened
      onClose={onClose}
      size={560}
      icon={PencilSimple}
      title="Ubah akun"
      subtitle={`${acc.code} · ${acc.name}`}
      footer={(
        <Group justify="flex-end" gap="xs">
          <Button variant="default" radius="md" onClick={onClose}>Batal</Button>
          <Button radius="md" disabled={invalid} onClick={() => { onClose(); toast(`${form.code} ${form.name} diperbarui`, PROTOTYPE_NOTE); }}>Simpan perubahan</Button>
        </Group>
      )}
    >
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput label="Kode akun" radius="md" required value={form.code} onChange={(e) => set('code')(e.currentTarget.value)} />
          <Select
            label="Kategori"
            radius="md"
            allowDeselect={false}
            data={accountCategories}
            value={form.category}
            onChange={(v) => v && set('category')(v)}
          />
        </SimpleGrid>
        <TextInput label="Nama akun" radius="md" required value={form.name} onChange={(e) => set('name')(e.currentTarget.value)} />
        <Textarea label="Deskripsi" radius="md" autosize minRows={2} placeholder="Opsional" value={form.description} onChange={(e) => set('description')(e.currentTarget.value)} />
      </Stack>
    </FormModal>
  );
}
