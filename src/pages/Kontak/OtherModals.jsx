import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  FileInput,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useState } from 'react';
import {
  Archive,
  Check,
  DownloadSimple,
  FileXls,
  Info,
  PencilSimple,
  Plus,
  SquaresFour,
  Trash,
  UploadSimple,
  X,
} from '@/components/Icon.jsx';
import { useData } from '@/lib/store.jsx';
import { downloadCsv, templateRows } from './utils.js';

const boxStyle = {
  border: '1px solid var(--mantine-color-gray-3)',
  borderRadius: 'var(--mantine-radius-md)',
};

function ModalTitle({ icon: Icon, children }) {
  return (
    <Group gap="xs">
      <ThemeIcon variant="light" bg="secondary.0" c="secondary.7" size={26} radius="sm">
        <Icon size={15} />
      </ThemeIcon>
      <Text fw={700} fz="sm" c="slate.9">
        {children}
      </Text>
    </Group>
  );
}

function GroupRow({ name, onRename, onDelete, taken }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const clean = value.trim();
  const invalid = !clean || (clean.toLowerCase() !== name.toLowerCase() && taken(clean));

  const save = () => {
    if (invalid) return;
    onRename(clean);
    setEditing(false);
  };

  return (
    <Group justify="space-between" px="sm" py={8} style={boxStyle} wrap="nowrap">
      {editing ? (
        <TextInput
          size="xs"
          radius="md"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          error={clean && invalid ? 'Nama grup sudah dipakai' : null}
          style={{ flex: 1 }}
        />
      ) : (
        <Badge size="sm" radius="sm" variant="light" color="grape" fw={700}>
          {name}
        </Badge>
      )}
      <Group gap={4} wrap="nowrap">
        {editing ? (
          <>
            <ActionIcon
              variant="subtle"
              color="green"
              size="sm"
              onClick={save}
              disabled={invalid}
              aria-label="Simpan nama grup"
            >
              <Check size={14} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="slate"
              size="sm"
              onClick={() => {
                setValue(name);
                setEditing(false);
              }}
              aria-label="Batal ubah grup"
            >
              <X size={14} />
            </ActionIcon>
          </>
        ) : (
          <>
            <ActionIcon
              variant="subtle"
              color="slate"
              size="sm"
              onClick={() => setEditing(true)}
              aria-label={`Ubah grup ${name}`}
            >
              <PencilSimple size={14} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              size="sm"
              onClick={onDelete}
              aria-label={`Hapus grup ${name}`}
            >
              <Trash size={14} />
            </ActionIcon>
          </>
        )}
      </Group>
    </Group>
  );
}

export function GroupModal({ opened, onClose }) {
  const { groups, setGroups, setContacts } = useData();
  const [name, setName] = useState('');
  const taken = (n) => groups.some((g) => g.toLowerCase() === n.toLowerCase());
  const clean = name.trim();

  const add = () => {
    if (!clean || taken(clean)) return;
    setGroups((g) => [...g, clean]);
    setName('');
  };
  // Ubah/hapus grup ikut diterapkan ke kontak yang memakai grup tersebut.
  const rename = (from, to) => {
    setGroups((g) => g.map((x) => (x === from ? to : x)));
    setContacts((list) =>
      list.map((c) => ({ ...c, groups: c.groups.map((x) => (x === from ? to : x)) })),
    );
  };
  const remove = (target) => {
    setGroups((g) => g.filter((x) => x !== target));
    setContacts((list) =>
      list.map((c) => ({ ...c, groups: c.groups.filter((x) => x !== target) })),
    );
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size={420}
      radius="lg"
      padding="lg"
      title={<ModalTitle icon={SquaresFour}>Kelola Grup Kontak</ModalTitle>}
    >
      <Stack gap="md">
        <Box p="sm" bg="slate.0" style={boxStyle}>
          <Text fz="xs" fw={700} c="slate.9" mb={6}>
            Tambah Grup Baru
          </Text>
          <Group gap="xs" wrap="nowrap" align="flex-start">
            <TextInput
              size="sm"
              radius="md"
              placeholder="Contoh: Reseller / VIP / Vendor Tetap"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              error={clean && taken(clean) ? 'Grup sudah ada' : null}
              style={{ flex: 1 }}
            />
            <Button
              size="sm"
              radius="md"
              variant="light"
              leftSection={<Plus size={14} />}
              disabled={!clean || taken(clean)}
              onClick={add}
            >
              Tambah
            </Button>
          </Group>
        </Box>

        <Box pt="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
          <Text fz="xs" c="slate.7" mb="xs">
            Daftar Grup Kontak
          </Text>
          <Stack gap={6}>
            {groups.length === 0 && (
              <Text fz="xs" c="slate.6" ta="center" py="sm">
                Belum ada grup kontak.
              </Text>
            )}
            {groups.map((g) => (
              <GroupRow
                key={g}
                name={g}
                taken={taken}
                onRename={(to) => rename(g, to)}
                onDelete={() => remove(g)}
              />
            ))}
          </Stack>
        </Box>

        <Group justify="flex-end">
          <Button variant="default" radius="md" onClick={onClose}>
            Tutup
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function ImportModal({ opened, onClose, onImport }) {
  const [file, setFile] = useState(null);
  const close = () => {
    setFile(null);
    onClose();
  };
  return (
    <Modal
      opened={opened}
      onClose={close}
      centered
      size={420}
      radius="lg"
      padding="lg"
      title={<ModalTitle icon={UploadSimple}>Impor Data Kontak</ModalTitle>}
    >
      <Stack gap="md">
        <Alert variant="light" color="primary" radius="md" icon={<Info size={16} />} p="sm">
          <Text fz="xs" c="slate.8">
            Pastikan format file sesuai dengan template resmi sistem. Gunakan tombol di bawah untuk
            mengunduh template terbaru sebelum mengunggah.
          </Text>
        </Alert>
        <Box p="sm" bg="slate.0" style={boxStyle}>
          <Text fz="xs" fw={700} c="slate.9">
            Template Data Kontak
          </Text>
          <Text fz={11} c="slate.6" mb="xs">
            Format spreadsheet lengkap dengan kolom pemetaan.
          </Text>
          <Button
            size="xs"
            radius="md"
            variant="outline"
            leftSection={<DownloadSimple size={14} />}
            onClick={() => downloadCsv('template-data-kontak.csv', templateRows())}
          >
            Unduh Template
          </Button>
        </Box>
        <FileInput
          label="Pilih File Excel / Spreadsheet"
          placeholder="Klik untuk memilih file .xlsx atau .xls"
          withAsterisk
          radius="md"
          accept=".xlsx,.xls,.csv"
          clearable
          leftSection={<FileXls size={14} />}
          value={file}
          onChange={setFile}
        />
        <Group
          justify="flex-end"
          gap="sm"
          pt="md"
          style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
        >
          <Button variant="default" radius="md" onClick={close}>
            Batal
          </Button>
          <Button
            radius="md"
            leftSection={<UploadSimple size={16} />}
            disabled={!file}
            onClick={() => {
              onImport(file);
              close();
            }}
          >
            Mulai Impor
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function ArchiveModal({ contact, onClose, onConfirm }) {
  return (
    <Modal
      opened={!!contact}
      onClose={onClose}
      centered
      size={400}
      radius="lg"
      padding="lg"
      title={<ModalTitle icon={Archive}>Arsipkan Kontak</ModalTitle>}
    >
      <Stack gap="md">
        <Text fz="sm" c="slate.8">
          Arsipkan kontak <b>{contact?.displayName}</b>? Kontak yang diarsipkan tidak muncul di
          daftar dan pilihan transaksi, tetapi riwayatnya tetap tersimpan dan bisa dipulihkan kapan
          saja lewat <b>Lihat Diarsipkan</b>.
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" radius="md" onClick={onClose}>
            Batal
          </Button>
          <Button color="red" radius="md" leftSection={<Archive size={16} />} onClick={onConfirm}>
            Arsipkan
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
