import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Card,
  Center,
  SimpleGrid,
  Group,
  Menu,
  Pagination,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMemo, useState } from 'react';
import {
  AddressBook,
  Archive,
  ArrowCounterClockwise,
  ArrowsClockwise,
  Briefcase,
  CheckCircle,
  ClockCounterClockwise,
  DotsThree,
  DotsThreeVertical,
  DownloadSimple,
  EnvelopeSimple,
  Eye,
  House,
  MagnifyingGlass,
  PencilSimple,
  Phone,
  Plus,
  SquaresFour,
  Truck,
  UploadSimple,
  User,
  UserCheck,
} from '@/components/Icon.jsx';
import { PageIntro } from '@/components/common.jsx';
import { useData } from '@/lib/store.jsx';
import { computeTotals, formatDate, nowIso, statusOf } from '@/pages/Penjualan/utils.js';
import ContactDetail from './ContactDetail.jsx';
import ContactFormModal from './ContactFormModal.jsx';
import ContactHistory from './ContactHistory.jsx';
import { ContactAvatar, TypeBadges } from './components.jsx';
import { accountLabel } from './data.js';
import styles from './ContactFilters.module.css';
import { ArchiveModal, GroupModal, ImportModal } from './OtherModals.jsx';
import { contactRows, downloadCsv, fullName, generateContactNumber } from './utils.js';

const tabs = [
  { value: 'all', label: 'Semua Kontak', icon: AddressBook },
  { value: 'customer', label: 'Pelanggan', icon: UserCheck },
  { value: 'supplier', label: 'Pemasok / Vendor', icon: Truck },
  { value: 'employee', label: 'Karyawan', icon: Briefcase },
  { value: 'unit', label: 'Unit', icon: House },
  { value: 'other', label: 'Lainnya', icon: User },
];
const pageSizes = ['10', '20', '50'].map((v) => ({ value: v, label: `${v} / hal` }));
const number = new Intl.NumberFormat('id-ID');
function ContactFilters({ contacts, selected, onSelect }) {
  return (
    <SimpleGrid component="section" aria-label="Statistik kontak" cols={{ base: 2, sm: 3, lg: 6 }} spacing={6} p="sm">
      {tabs.map(({ value, label, icon: Icon }) => {
        const count = value === 'all' ? contacts.length : contacts.filter((c) => c.types.includes(value)).length;
        return (
          <UnstyledButton key={value} className={styles.filter} aria-pressed={selected === value} onClick={() => onSelect(value)}>
            <Group justify="space-between" wrap="nowrap" gap="xs">
              <ThemeIcon variant="light" bg="secondary.0" c="secondary.7" radius="md" size={28}>
                <Icon size={16} />
              </ThemeIcon>
              <Text component="span" className={styles.count}>{number.format(count)}</Text>
            </Group>
            <Text component="span" className={styles.label}>{label}</Text>
          </UnstyledButton>
        );
      })}
    </SimpleGrid>
  );
}

function Mapping({ contact }) {
  if (!contact.arAccount && !contact.apAccount) {
    return (
      <Text fz="xs" c="slate.6">
        Standar Sistem
      </Text>
    );
  }
  const line = (label, code) => (
    <Text
      fz="xs"
      c="primary.7"
      truncate="end"
      maw={240}
      title={accountLabel(code) ?? 'Standar sistem'}
    >
      {label}: {accountLabel(code) ?? 'Standar sistem'}
    </Text>
  );
  return (
    <>
      {line('Piutang', contact.arAccount)}
      {line('Hutang', contact.apAccount)}
    </>
  );
}

function ContactRow({ contact, onView, onEdit, onHistory, onArchive, onRestore }) {
  const name = fullName(contact);
  return (
    <Table.Tr>
      <Table.Td>
        <Group gap="sm" wrap="nowrap">
          <ContactAvatar name={contact.displayName} />
          <Box>
            <Group gap={4} wrap="nowrap">
              <UnstyledButton onClick={onView}>
                <Text fz="sm" fw={700} c="slate.9">
                  {contact.displayName}
                </Text>
              </UnstyledButton>
              {contact.archived && (
                <Tooltip label="Diarsipkan" withArrow fz="xs">
                  <Archive size={14} color="var(--mantine-color-slate-6)" />
                </Tooltip>
              )}
            </Group>
            <Text fz={11} c="slate.6" ff="monospace" style={{ whiteSpace: 'nowrap' }}>
              {contact.number}
            </Text>
          </Box>
        </Group>
      </Table.Td>
      <Table.Td>
        <TypeBadges types={contact.types} max={2} />
      </Table.Td>
      <Table.Td>
        <Text fz="sm" fw={600} c="slate.9">
          {contact.company || '—'}
        </Text>
        {name && (
          <Text fz={11} c="slate.6">
            {name}
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {contact.email || contact.mobile ? (
          <Stack gap={2}>
            {contact.email && (
              <Group gap={4} wrap="nowrap">
                <EnvelopeSimple size={12} />
                <Text fz="xs" c="slate.8">
                  {contact.email}
                </Text>
              </Group>
            )}
            {contact.mobile && (
              <Group gap={4} wrap="nowrap">
                <Phone size={12} />
                <Text fz="xs" c="slate.8">
                  {contact.mobile}
                </Text>
              </Group>
            )}
          </Stack>
        ) : (
          <Text fz="sm" c="slate.6">
            —
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <Mapping contact={contact} />
      </Table.Td>
      <Table.Td>
        <Group gap={2} justify="flex-end" wrap="nowrap">
          <Menu position="bottom-end" withinPortal shadow="md" width={190}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="slate" aria-label={`Aksi ${contact.displayName}`}>
                <DotsThreeVertical size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item fz="xs" leftSection={<Eye size={14} />} onClick={onView}>
                Lihat Rincian
              </Menu.Item>
              <Menu.Item fz="xs" leftSection={<PencilSimple size={14} />} onClick={onEdit}>
                Ubah Data
              </Menu.Item>
              <Menu.Item
                fz="xs"
                leftSection={<ClockCounterClockwise size={14} />}
                onClick={onHistory}
              >
                Riwayat Transaksi
              </Menu.Item>
              <Menu.Divider />
              {contact.archived ? (
                <Menu.Item
                  fz="xs"
                  color="green"
                  leftSection={<ArrowCounterClockwise size={14} />}
                  onClick={onRestore}
                >
                  Pulihkan Kontak
                </Menu.Item>
              ) : (
                <Menu.Item
                  fz="xs"
                  color="red"
                  leftSection={<Archive size={14} />}
                  onClick={onArchive}
                >
                  Arsipkan Kontak
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

const salesRows = (sales) => [
  ['Nomor Faktur', 'Tanggal', 'Jatuh Tempo', 'Status', 'Total Tagihan', 'Sisa Tagihan'],
  ...sales.map((s) => {
    const t = computeTotals(s);
    const status = { draft: 'Draft', sent: 'Terkirim', paid: 'Lunas' }[statusOf(s)];
    return [s.number, formatDate(s.date), formatDate(s.dueDate), status, t.total, t.balance];
  }),
];

// params dari halaman lain: { contactId } membuka rincian kontak tersebut.
export default function Kontak({ params, onNavigate }) {
  const { contacts, setContacts, contactsById, sales } = useData();

  // view: daftar | rincian | riwayat transaksi
  const [view, setView] = useState(() =>
    params?.contactId ? { name: 'detail', id: params.contactId } : { name: 'list' },
  );
  const [form, setForm] = useState(null); // { contact: null | kontak }
  const [archiveId, setArchiveId] = useState(null);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [notice, setNotice] = useState(null);

  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState('10');

  const go = (next) => {
    setView(next);
    window.scrollTo({ top: 0 });
  };
  const updateContact = (id, patch) =>
    setContacts((list) =>
      list.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: nowIso() } : c)),
    );

  const saveContact = (data) => {
    if (form.contact) {
      updateContact(form.contact.id, data);
    } else {
      const now = nowIso();
      const id = `c${Date.now()}`;
      setContacts((list) => [
        { ...data, id, number: generateContactNumber(), createdAt: now, updatedAt: now },
        ...list,
      ]);
      setTab('all');
      setQuery('');
      setPage(1);
      notifications.show({
        color: 'green',
        icon: <CheckCircle size={18} />,
        title: 'Kontak berhasil ditambahkan',
        message: `${data.displayName} kini ada di Direktori Kontak dan siap dipakai di transaksi.`,
        autoClose: 5000,
        withBorder: true,
        radius: 'md',
      });
    }
    setForm(null);
  };

  const confirmArchive = () => {
    updateContact(archiveId, { archived: true });
    setArchiveId(null);
  };
  const restore = (id) => updateContact(id, { archived: false });

  // Daftar menampilkan kontak aktif; "Lihat Diarsipkan" ikut menampilkan yang diarsipkan.
  const pool = useMemo(
    () => (showArchived ? contacts : contacts.filter((c) => !c.archived)),
    [contacts, showArchived],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pool.filter(
      (c) =>
        (tab === 'all' || c.types.includes(tab)) &&
        (!q ||
          [c.displayName, c.company, c.number, c.email, fullName(c)].some((v) =>
            v?.toLowerCase().includes(q),
          )),
    );
  }, [pool, tab, query]);

  const size = Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * size;
  const rows = filtered.slice(start, start + size);

  const contactSales = (id) => sales.filter((s) => s.customerId === id);
  const openSale = (saleId) => onNavigate?.('penjualan', { saleId });
  const exportSales = (c) =>
    downloadCsv(`transaksi-${c.number}.csv`, salesRows(contactSales(c.id)));

  const modals = (
    <>
      <ContactFormModal
        opened={!!form}
        contact={form?.contact ?? null}
        onClose={() => setForm(null)}
        onSave={saveContact}
      />
      <ArchiveModal
        contact={contactsById[archiveId]}
        onClose={() => setArchiveId(null)}
        onConfirm={confirmArchive}
      />
      <GroupModal opened={groupsOpen} onClose={() => setGroupsOpen(false)} />
      <ImportModal
        opened={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={(file) =>
          setNotice(
            `File "${file.name}" diterima. Pemrosesan impor akan aktif setelah prototype terhubung ke server.`,
          )
        }
      />
    </>
  );

  const selected = contactsById[view.id];

  if (view.name === 'detail' && selected) {
    return (
      <>
        <ContactDetail
          contact={selected}
          sales={contactSales(selected.id)}
          onBack={() => go({ name: 'list' })}
          onEdit={() => setForm({ contact: selected })}
          onArchive={() => setArchiveId(selected.id)}
          onRestore={() => restore(selected.id)}
          onOpenHistory={() => go({ name: 'history', id: selected.id })}
          onOpenSale={openSale}
          onExportSales={() => exportSales(selected)}
        />
        {modals}
      </>
    );
  }

  if (view.name === 'history' && selected) {
    return (
      <>
        <ContactHistory
          contact={selected}
          sales={contactSales(selected.id)}
          onBack={() => go({ name: 'detail', id: selected.id })}
          onCreateSale={() => onNavigate?.('penjualan', { createFor: selected.id })}
          onOpenSale={openSale}
          onExport={() => exportSales(selected)}
        />
        {modals}
      </>
    );
  }

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro
        icon={AddressBook}
        title="Direktori Kontak"
        description="Kelola seluruh profil rekanan bisnis, pelanggan, pemasok, unit properti, dan karyawan. Hubungkan dengan akun piutang dan hutang untuk kemudahan pencatatan transaksi yang konsisten dan akurat."
        actions={
          <>
            <ActionIcon variant="default" size="lg" radius="md" aria-label="Segarkan data kontak">
              <ArrowsClockwise size={16} />
            </ActionIcon>
            <Menu position="bottom-end" withinPortal shadow="md" width={180}>
              <Menu.Target>
                <Button variant="default" radius="md" leftSection={<DotsThree size={16} />}>
                  Aksi lainnya
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  fz="xs"
                  leftSection={<SquaresFour size={14} />}
                  onClick={() => setGroupsOpen(true)}
                >
                  Kelola Grup
                </Menu.Item>
                <Menu.Item
                  fz="xs"
                  leftSection={<DownloadSimple size={14} />}
                  onClick={() => downloadCsv('data-kontak.csv', contactRows(pool))}
                >
                  Ekspor Data
                </Menu.Item>
                <Menu.Item
                  fz="xs"
                  leftSection={<UploadSimple size={14} />}
                  onClick={() => setImportOpen(true)}
                >
                  Impor Kontak
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Button
              radius="md"
              leftSection={<Plus size={16} />}
              onClick={() => setForm({ contact: null })}
            >
              Tambah Kontak
            </Button>
          </>
        }
      />

      {notice && (
        <Alert
          color="primary"
          variant="light"
          radius="md"
          withCloseButton
          onClose={() => setNotice(null)}
          icon={<UploadSimple size={16} />}
        >
          <Text fz="xs">{notice}</Text>
        </Alert>
      )}

      <Card withBorder radius="lg" padding={0} bg="white" style={{ overflow: 'hidden' }}>
        <ContactFilters contacts={pool} selected={tab} onSelect={(value) => {
          setTab(value);
          setPage(1);
        }} />

        {/* Section filter: latar abu muda, garis bawah mentok kiri-kanan */}
        <Group
          gap="md"
          px="lg"
          py="sm"
          bg="slate.0"
          style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
        >
          <TextInput
            placeholder="Cari nama, perusahaan, nomor kontak, atau email..."
            size="sm"
            radius="md"
            w={320}
            maw="100%"
            leftSection={<MagnifyingGlass size={14} />}
            value={query}
            onChange={(e) => {
              setQuery(e.currentTarget.value);
              setPage(1);
            }}
          />
          <Switch
            size="sm"
            label="Lihat Diarsipkan"
            checked={showArchived}
            onChange={(e) => {
              setShowArchived(e.currentTarget.checked);
              setPage(1);
            }}
          />
        </Group>

        {/* Area tabel: padding kiri-kanan-atas-bawah, tabel berbingkai seperti sebelumnya */}
        <Box p="lg">
          <Box
            className="table-frame"
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
                miw={1150}
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
                    <Table.Th>Kontak & Nomor</Table.Th>
                    <Table.Th>Tipe</Table.Th>
                    <Table.Th>Perusahaan / Nama Lengkap</Table.Th>
                    <Table.Th>Email & Telepon</Table.Th>
                    <Table.Th>Pemetaan Akun</Table.Th>
                    <Table.Th ta="right">Aksi</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((c) => (
                    <ContactRow
                      key={c.id}
                      contact={c}
                      onView={() => go({ name: 'detail', id: c.id })}
                      onEdit={() => setForm({ contact: c })}
                      onHistory={() => go({ name: 'history', id: c.id })}
                      onArchive={() => setArchiveId(c.id)}
                      onRestore={() => restore(c.id)}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>

            {filtered.length === 0 && (
              <Center py="xl">
                <Text fz="sm" c="slate.6">
                  Tidak ada kontak yang cocok dengan pencarian atau filter.
                </Text>
              </Center>
            )}

            {/* Footer tabel: jumlah data + pagination, menyatu di dalam bingkai tabel */}
            <Group
              justify="space-between"
              gap="sm"
              px="md"
              py="sm"
              style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
            >
              <Text fz="xs" c="slate.7">
                Menampilkan {filtered.length ? start + 1 : 0}–{start + rows.length} dari{' '}
                {number.format(filtered.length)} kontak
              </Text>
              <Group gap="sm">
                <Select
                  size="xs"
                  radius="md"
                  w={96}
                  allowDeselect={false}
                  data={pageSizes}
                  value={pageSize}
                  onChange={(v) => {
                    setPageSize(v);
                    setPage(1);
                  }}
                />
                <Pagination
                  size="sm"
                  radius="md"
                  total={totalPages}
                  value={current}
                  onChange={setPage}
                />
              </Group>
            </Group>
          </Box>
        </Box>
      </Card>

      {modals}
    </Stack>
  );
}
