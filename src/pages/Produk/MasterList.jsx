// Tabel master sederhana (nama · deskripsi · dibuat) yang dipakai halaman
// Kategori Produk dan Satuan. Keduanya bentuknya sama, hanya kata-katanya berbeda.
import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Center,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { FormModal, PageIntro } from '@/components/common.jsx';
import {
  CheckCircle,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Trash,
  Warning,
} from '@/components/Icon.jsx';
import { formatDate } from '@/pages/Pembelian/utils.js';

const slug = (name, taken) => {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'item';
  let id = base;
  let i = 2;
  while (taken.includes(id)) id = `${base}-${i++}`;
  return id;
};

function EntryModal({ opened, entry, onClose, onSave, title, label, placeholder }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Isi ulang tiap kali modal dibuka untuk entri yang berbeda.
  const key = `${opened}-${entry?.id ?? 'baru'}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setName(entry?.name ?? '');
    setDescription(entry?.description ?? '');
    setSubmitted(false);
  }

  const save = () => {
    setSubmitted(true);
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim() });
    onClose();
  };

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={title}
      icon={entry ? PencilSimple : Plus}
      size={460}
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
      <TextInput
        label={label}
        withAsterisk
        radius="md"
        placeholder={placeholder}
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
        error={submitted && !name.trim() && 'Nama wajib diisi'}
        data-autofocus
      />
      <TextInput
        label="Deskripsi"
        description="Opsional, membantu tim memahami penggunaannya."
        radius="md"
        value={description}
        onChange={(e) => setDescription(e.currentTarget.value)}
      />
    </FormModal>
  );
}

/**
 * @param usedBy  (entry) => jumlah produk yang memakai entri ini. Yang masih
 *                dipakai tidak boleh dihapus, supaya data produk tidak putus.
 */
export default function MasterList({
  icon,
  title,
  description,
  hint,
  searchPlaceholder,
  addLabel,
  entryLabel,
  entryPlaceholder,
  nounSingular,
  entries,
  setEntries,
  usedBy,
}) {
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null); // { entry: null | entri }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter(
      (e) => !q || [e.name, e.description].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [entries, query]);

  const save = (data) => {
    if (modal.entry) {
      setEntries((list) =>
        list.map((e) => (e.id === modal.entry.id ? { ...e, ...data } : e)),
      );
    } else {
      const id = slug(data.name, entries.map((e) => e.id));
      setEntries((list) => [
        ...list,
        { id, ...data, createdAt: new Date().toISOString() },
      ]);
    }
    notifications.show({
      color: 'green',
      icon: <CheckCircle size={18} />,
      title: modal.entry ? `${nounSingular} diperbarui` : `${nounSingular} ditambahkan`,
      message: `"${data.name}" kini bisa dipakai di master Produk & Jasa.`,
      radius: 'md',
      withBorder: true,
    });
  };

  const remove = (entry) => {
    const dipakai = usedBy(entry);
    if (dipakai) {
      notifications.show({
        color: 'red',
        icon: <Warning size={18} />,
        title: `${nounSingular} masih dipakai`,
        message: `"${entry.name}" dipakai ${dipakai} produk. Pindahkan dulu produknya sebelum dihapus.`,
        radius: 'md',
        withBorder: true,
      });
      return;
    }
    setEntries((list) => list.filter((e) => e.id !== entry.id));
  };

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro icon={icon} title={title} description={description} />

      <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
        <Group
          gap="md"
          px="lg"
          py="sm"
          bg="slate.0"
          justify="space-between"
          style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
        >
          <Group gap="md">
            <TextInput
              placeholder={searchPlaceholder}
              size="sm"
              radius="md"
              w={320}
              maw="100%"
              leftSection={<MagnifyingGlass size={14} />}
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
            <Text fz="xs" c="slate.6" visibleFrom="md">
              {hint}
            </Text>
          </Group>
          <Button
            radius="md"
            leftSection={<Plus size={16} />}
            onClick={() => setModal({ entry: null })}
          >
            {addLabel}
          </Button>
        </Group>

        <Box p="lg">
          <Box
            style={{
              border: '1px solid var(--mantine-color-gray-3)',
              borderRadius: 'var(--mantine-radius-md)',
              overflow: 'hidden',
            }}
          >
            <ScrollArea type="auto">
              <Table
                verticalSpacing="sm"
                horizontalSpacing="md"
                miw={640}
                highlightOnHover
                styles={{
                  th: {
                    fontSize: 'var(--mantine-font-size-xs)',
                    color: 'var(--mantine-color-slate-7)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  },
                }}
              >
                <Table.Thead bg="slate.0">
                  <Table.Tr>
                    <Table.Th>Nama</Table.Th>
                    <Table.Th>Deskripsi</Table.Th>
                    <Table.Th>Dipakai</Table.Th>
                    <Table.Th>Dibuat</Table.Th>
                    <Table.Th ta="right">Aksi</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((e) => (
                    <Table.Tr key={e.id}>
                      <Table.Td>
                        <Text fz="sm" fw={700} c="slate.9">
                          {e.name}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" c={e.description ? 'slate.7' : 'slate.5'}>
                          {e.description || '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" c="slate.7">
                          {usedBy(e)} produk
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fz="sm" c="slate.7">
                          {e.createdAt ? formatDate(e.createdAt.slice(0, 10)) : '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          <Tooltip label="Ubah" withArrow fz="xs">
                            <ActionIcon
                              variant="subtle"
                              color="slate"
                              aria-label={`Ubah ${e.name}`}
                              onClick={() => setModal({ entry: e })}
                            >
                              <PencilSimple size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Hapus" withArrow fz="xs">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              aria-label={`Hapus ${e.name}`}
                              onClick={() => remove(e)}
                            >
                              <Trash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
            {!rows.length && (
              <Center py="xl">
                <Text fz="sm" c="slate.6">
                  Tidak ada data yang cocok dengan pencarian.
                </Text>
              </Center>
            )}
          </Box>
        </Box>
      </Card>

      <EntryModal
        opened={!!modal}
        entry={modal?.entry ?? null}
        onClose={() => setModal(null)}
        onSave={save}
        title={modal?.entry ? `Ubah ${nounSingular}` : addLabel}
        label={entryLabel}
        placeholder={entryPlaceholder}
      />
    </Stack>
  );
}
