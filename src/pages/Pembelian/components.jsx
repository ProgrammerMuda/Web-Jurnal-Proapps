import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Group,
  Menu,
  Modal,
  Pagination,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { Fragment, useState } from 'react';
import { Buildings, Check, CheckCircle, DotsThreeVertical, Info, MagnifyingGlass, Warning } from '@/components/Icon.jsx';
import { roleOf } from './data.js';
import { approvalState, roleLabel } from './permissions.js';

import { FormModal } from '@/components/common.jsx';

export { BackLink, blockedProps, CopyIcon, Field, FormModal, PageIntro } from '@/components/common.jsx';

// Opsi dropdown vendor: ikon, nama vendor, dan jumlah PO sebelumnya.
// Jumlah PO dihitung dari PO yang benar-benar ada, bukan statistik vendor, supaya sama dengan isi dropdown PO referensi.
// pos boleh dikosongkan: vendor tanpa riwayat PO (mis. PLN, pemilik gedung) tetap harus bisa
// dipilih untuk tagihan non-PO, jadi daftarnya tidak disaring.
export const vendorSelectData = (vendors, pos = []) =>
  vendors.map((v) => ({ value: v.id, label: v.name, po: pos.filter((p) => p.vendorId === v.id).length }));
export const renderVendorOption = ({ option, checked }) => (
  <Group gap="sm" wrap="nowrap" style={{ width: '100%' }}>
    <ThemeIcon variant="light" size={32} radius="md" style={{ flexShrink: 0 }}>
      <Buildings size={18} />
    </ThemeIcon>
    <Box style={{ minWidth: 0, flex: 1 }}>
      <Text fz="sm" fw={600} c="slate.9" truncate>{option.label}</Text>
      <Text fz={11} c="slate.6">{option.po ? `${option.po} PO sebelumnya` : 'Belum ada PO'}</Text>
    </Box>
    {checked && <Check size={16} />}
  </Group>
);

// Modal sukses: ikon centang, judul, penjelasan singkat, dan tombol aksi.
export function SuccessModal({ opened, onClose, title, text, children }) {
  return (
    <Modal opened={opened} onClose={onClose} centered radius="lg" size={400} withCloseButton={false} padding="xl">
      <Stack align="center" gap="xs" ta="center">
        <ThemeIcon variant="light" color="green" size={64} radius="xl">
          <CheckCircle size={36} />
        </ThemeIcon>
        <Text fw={700} fz="lg" c="slate.9" mt="xs">{title}</Text>
        {text && <Text fz="sm" c="slate.6">{text}</Text>}
        <Group gap="sm" mt="md" justify="center">{children}</Group>
      </Stack>
    </Modal>
  );
}

// Semua status yang menunggu approval memakai satu nama, "Menunggu approval". Siapa yang
// harus menyetujui (dan giliran siapa sekarang) ditaruh di info pada pill-nya, bukan di
// namanya: nama status tetap seragam di semua alur, rinciannya tetap bisa dibaca.
// Kirim `approval={{ doc, kind }}` agar info approver-nya muncul.
export function approvalNote(doc, kind) {
  const ap = approvalState(doc, kind);
  if (!ap.total) return null;
  const chain = ap.chain.map(roleLabel).join(' lalu ');
  return ap.next
    ? `Butuh approval ${chain}. Sekarang menunggu ${roleLabel(ap.next)} (${ap.done.length + 1} dari ${ap.total}).`
    : `Butuh approval ${chain}.`;
}

export function StatusPill({ map, status, size = 'sm', approval }) {
  const s = map[status] ?? { label: status, color: 'gray' };
  const note = s.pending && approval ? approvalNote(approval.doc, approval.kind) : null;
  const pill = (
    <Badge size={size} radius="sm" variant={s.variant ?? 'light'} color={s.color} fw={700} tt="none" rightSection={note ? <Info size={size === 'xs' ? 11 : 13} /> : null}>
      {s.label}
    </Badge>
  );
  if (!note) return pill;
  return (
    <Tooltip label={note} multiline w={240} withArrow fz="xs" events={{ hover: true, focus: true, touch: true }}>
      <span tabIndex={0} style={{ display: 'inline-flex', cursor: 'help' }}>{pill}</span>
    </Tooltip>
  );
}

export function RoleChip({ role }) {
  const r = roleOf(role);
  return (
    <Badge size="xs" radius="sm" variant="light" color={r.color} fw={700} tt="none">
      {r.label}
    </Badge>
  );
}

// Kartu bagian dengan judul kecil (dipakai di detail dokumen).
export function Section({ title, description, icon: Icon, right, divided, flush, children, ...rest }) {
  const head = (
    <Group
      justify="space-between"
      align="flex-start"
      wrap="nowrap"
      {...(divided ? { px: 'lg', py: 'md', style: { borderBottom: '1px solid var(--mantine-color-gray-2)' } } : { mb: 'md' })}
    >
      <Group gap="sm" wrap="nowrap" align="center">
        {Icon && (
          <ThemeIcon variant="light" size={32} radius="md" style={{ flexShrink: 0 }}>
            <Icon size={18} />
          </ThemeIcon>
        )}
        <Box>
          <Text fw={700} fz="sm" c="slate.9">
            {title}
          </Text>
          {description && (
            <Text fz="xs" c="slate.6">
              {description}
            </Text>
          )}
        </Box>
      </Group>
      {right}
    </Group>
  );
  return (
    <Card withBorder radius="lg" padding={divided ? 0 : 'lg'} bg="white" {...rest}>
      {head}
      {divided && !flush ? <Box p="lg">{children}</Box> : children}
    </Card>
  );
}

export function StatCell({ icon: Icon, label, children }) {
  return (
    <Group gap="sm" wrap="nowrap" px="lg" py="md" style={{ minWidth: 0 }}>
      <ThemeIcon variant="light" size={40} radius="md"><Icon size={20} /></ThemeIcon>
      <Box style={{ minWidth: 0 }}>
        <Text fz={11} fw={600} c="slate.6">{label}</Text>
        <Text fz="sm" fw={700} c="slate.9" truncate>{children}</Text>
      </Box>
    </Group>
  );
}

// Judul card berikon (huruf kapital kecil), dipakai pada card tanpa padding bawaan Section.
export function CardHead({ icon: Icon, desc, children }) {
  return (
    <Group gap="sm" wrap="nowrap">
      <ThemeIcon variant="light" size={32} radius="md" style={{ flexShrink: 0 }}>
        <Icon size={18} />
      </ThemeIcon>
      <Box>
        <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }}>{children}</Text>
        {desc && <Text fz="xs" c="slate.6">{desc}</Text>}
      </Box>
    </Group>
  );
}

// Kotak aturan/peringatan.
export function Callout({ tone = 'info', title, children }) {
  const tones = {
    info: { bg: 'primary.0', bd: 'primary.2', c: 'primary.9' },
    // Menunggu giliran peran lain: oranye, sewarna status "Menunggu approval".
    wait: { bg: 'orange.0', bd: 'orange.2', c: 'orange.8' },
    warn: { bg: 'yellow.0', bd: 'yellow.4', c: 'yellow.9' },
    stop: { bg: 'red.0', bd: 'red.3', c: 'red.8' },
    ok: { bg: 'green.0', bd: 'green.3', c: 'green.9' },
  };
  const t = tones[tone];
  const Icon = tone === 'warn' || tone === 'stop' ? Warning : Info;
  return (
    <Box
      p="sm"
      bg={t.bg}
      style={{
        border: `1px solid var(--mantine-color-${t.bd.replace('.', '-')})`,
        borderRadius: 'var(--mantine-radius-md)',
      }}
    >
      <Group gap="xs" align="flex-start" wrap="nowrap">
        <Icon size={16} color={`var(--mantine-color-${t.c.replace('.', '-')})`} style={{ flexShrink: 0, marginTop: 2 }} />
        <Box fz="xs" c="slate.8" style={{ minWidth: 0 }}>
          {title && (
            <Text fz="xs" fw={700} c={t.c}>
              {title}
            </Text>
          )}
          {children}
        </Box>
      </Group>
    </Box>
  );
}

// Tabel dengan bingkai seperti halaman Penjualan.
export function DataTable({ head, children, empty, minWidth = 760, bare }) {
  return (
    <Box
      className="table-frame"
      style={{
        border: bare ? undefined : '1px solid var(--mantine-color-gray-3)',
        borderRadius: bare ? undefined : 'var(--mantine-radius-md)',
        overflow: 'auto',
      }}
    >
      <Table
        verticalSpacing="sm"
        horizontalSpacing="md"
        miw={minWidth}
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
            {head.map((h) => (
              <Table.Th key={h.label} ta={h.align} w={h.w}>
                {h.label}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{children}</Table.Tbody>
      </Table>
      {empty}
    </Box>
  );
}

export function EmptyState({ icon: Icon, title, text, actions }) {
  return (
    <Center py={40}>
      <Stack align="center" gap="xs" maw={420} ta="center">
        <ThemeIcon variant="light" bg="slate.1" c="slate.6" size={48} radius="xl">
          <Icon size={24} />
        </ThemeIcon>
        <Text fw={700} fz="sm" c="slate.9">
          {title}
        </Text>
        <Text fz="xs" c="slate.6">
          {text}
        </Text>
        {actions && <Group gap="xs">{actions}</Group>}
      </Stack>
    </Center>
  );
}

export const docLink = { fontSize: 'var(--mantine-font-size-sm)', fontWeight: 700 };

export function DocNumber({ children, onClick }) {
  return (
    <UnstyledButton onClick={onClick}>
      <Text fz="sm" fw={700} c="primary.9" style={{ whiteSpace: 'nowrap' }}>
        {children}
      </Text>
    </UnstyledButton>
  );
}

// Dialog "Pilih referensi": daftar dengan pencarian; multi untuk faktur dari beberapa FPB, dll.
export function ReferencePicker({
  opened,
  onClose,
  title,
  rows,
  multi,
  emptyTitle,
  emptyText,
  emptyActions,
  onPick,
  icon,
  subtitle,
  placeholder = 'Cari nomor dokumen atau vendor…',
}) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState([]);
  const filtered = rows.filter((r) =>
    [r.number, r.vendor, r.hint, r.search].some((v) => v?.toLowerCase().includes(q.trim().toLowerCase())),
  );
  const vendorOfSel = rows.find((r) => r.id === sel[0])?.vendorId;
  const close = () => {
    setQ('');
    setSel([]);
    onClose();
  };
  const toggle = (r) => {
    if (r.disabled) return;
    if (!multi || r.solo) return onPick([r.id]);
    setSel((s) =>
      s.includes(r.id) ? s.filter((x) => x !== r.id) : r.vendorId === (vendorOfSel ?? r.vendorId) ? [...s, r.id] : s,
    );
  };
  return (
    <FormModal
      opened={opened}
      onClose={close}
      size={640}
      icon={icon}
      title={title}
      subtitle={subtitle ?? (multi ? 'Pilih satu atau beberapa dokumen dari vendor yang sama.' : 'Pilih dokumen yang akan dilanjutkan.')}
      footer={
        multi && rows.length > 0 ? (
          <>
            <Button variant="default" radius="md" onClick={close}>
              Batal
            </Button>
            <Button
              radius="md"
              disabled={!sel.length}
              onClick={() => {
                onPick(sel);
                setSel([]);
              }}
            >
              Lanjutkan ({sel.length})
            </Button>
          </>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <EmptyState icon={icon ?? Info} title={emptyTitle} text={emptyText} actions={emptyActions} />
      ) : (
        <>
          <TextInput
            data-autofocus
            placeholder={placeholder}
            size="sm"
            radius="md"
            leftSection={<MagnifyingGlass size={14} />}
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
          />
          <Stack gap={6}>
            {filtered.map((r, idx) => {
              const on = sel.includes(r.id);
              const blocked = r.disabled || (multi && vendorOfSel && (r.solo || r.vendorId !== vendorOfSel));
              return (
                <Fragment key={r.id}>
                {r.group && r.group !== filtered[idx - 1]?.group && (
                  <Text fz={11} fw={700} c="slate.6" tt="uppercase" mt={idx ? 'xs' : 0}>{r.group}</Text>
                )}
                <UnstyledButton
                  onClick={() => toggle(r)}
                  disabled={blocked}
                  p="sm"
                  style={{
                    border: `1px solid var(--mantine-color-${on ? 'primary-9' : 'gray-3'})`,
                    borderRadius: 'var(--mantine-radius-md)',
                    background: on ? 'var(--mantine-color-primary-0)' : undefined,
                    opacity: blocked ? 0.45 : 1,
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Box>
                      <Text fz="sm" fw={700} c="primary.9">
                        {r.number}
                      </Text>
                      <Text fz="xs" c="slate.7">
                        {r.vendor}
                      </Text>
                      {r.hint && (
                        <Text fz={11} c="slate.6">
                          {r.hint}
                        </Text>
                      )}
                      {r.disabled && r.disabledNote && (
                        <Text fz={11} fw={600} c="slate.7">
                          {r.disabledNote}
                        </Text>
                      )}
                    </Box>
                    <Box ta="right">
                      <Text fz="sm" fw={700} c="slate.9">
                        {r.value}
                      </Text>
                      {r.remain && (
                        <Text fz={11} c="slate.6">
                          {r.remain}
                        </Text>
                      )}
                    </Box>
                  </Group>
                </UnstyledButton>
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <Text fz="xs" c="slate.6" ta="center" py="md">
                Tidak ada dokumen yang cocok.
              </Text>
            )}
          </Stack>
        </>
      )}
    </FormModal>
  );
}

// --- Pola daftar seperti halaman Kontak ---------------------------------------------------------
const pageSizes = ['10', '20', '50'].map((v) => ({ value: v, label: `${v} / hal` }));

// Menu aksi baris (titik tiga). items: [{ label, icon, onClick, color }]; item falsy diabaikan.
/**
 * Pita aksi di kaki form satu halaman. Dibungkus kartu sendiri supaya tombolnya
 * tidak mengambang di bawah halaman — bentuknya sama dengan kaki form faktur
 * penjualan: Batal berdiri sendiri di kiri karena ia membatalkan seluruh form,
 * sedangkan aksi yang memajukan dokumen berkumpul di kanan.
 */
export function FormActions({ error, onCancel, cancelLabel = 'Batal', children }) {
  return (
    <Card withBorder radius="lg" padding={0} bg="white">
      <Group justify="space-between" gap="md" px="lg" py="md" wrap="wrap">
        <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
          <Button variant="outline" color="slate" radius="md" onClick={onCancel}>
            {cancelLabel}
          </Button>
          {error && (
            <Text fz="xs" c="red.7" style={{ minWidth: 0 }}>
              {error}
            </Text>
          )}
        </Group>
        <Group gap="sm">{children}</Group>
      </Group>
    </Card>
  );
}

export function RowMenu({ items, label }) {
  const list = items.filter(Boolean);
  if (!list.length) return null;
  return (
    <Menu position="bottom-end" withinPortal shadow="md" width={200}>
      <Menu.Target>
        <ActionIcon variant="subtle" color="slate" aria-label={`Aksi ${label}`}>
          <DotsThreeVertical size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {list.map((i) =>
          i.divider ? (
            <Menu.Divider key={i.key} />
          ) : (
            <Menu.Item key={i.label} fz="xs" color={i.color} leftSection={i.icon && <i.icon size={14} />} onClick={i.onClick}>
              {i.label}
            </Menu.Item>
          ),
        )}
      </Menu.Dropdown>
    </Menu>
  );
}

// Tab bar: header kartu, garis bawah mentok kiri-kanan, tab aktif bergaya item aktif sidebar.
export function TabBar({ tabs, value, onChange }) {
  return (
    <Group gap={4} px="lg" py="sm" wrap="wrap" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
      {tabs.map((t) => {
        const active = value === t.value;
        return (
          <Button
            key={t.value}
            size="sm"
            radius="md"
            variant="subtle"
            color={active ? 'primary.9' : 'slate.7'}
            bg={active ? 'slate.1' : undefined}
            c={active ? 'primary.9' : 'slate.7'}
            leftSection={<t.icon size={16} />}
            fw={active ? 700 : 500}
            fz="xs"
            onClick={() => onChange(t.value)}
          >
            {t.label}
          </Button>
        );
      })}
    </Group>
  );
}

// Band filter (latar abu muda) + tabel berbingkai + footer jumlah data & pagination.
// rows: elemen <Table.Tr> sudah terfilter; paging dilakukan di sini.
export function ListShell({ query, onQuery, placeholder, filters, head, rows, noun, empty, minWidth = 1000, page, setPage, pageSize, setPageSize }) {
  const size = Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * size;
  const shown = rows.slice(start, start + size);
  return (
    <>
      <Group gap="md" px="lg" py="sm" bg="slate.0" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <TextInput
          placeholder={placeholder}
          size="sm"
          radius="md"
          w={320}
          maw="100%"
          leftSection={<MagnifyingGlass size={14} />}
          value={query}
          onChange={(e) => onQuery(e.currentTarget.value)}
        />
        {filters}
      </Group>
      <Box p="lg">
        <Box className="table-frame" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }}>
          <ScrollArea type="auto">
            <Table
              verticalSpacing="sm"
              horizontalSpacing="md"
              miw={minWidth}
              highlightOnHover
              styles={{ th: { fontSize: 'var(--mantine-font-size-xs)', color: 'var(--mantine-color-slate-7)', textTransform: 'uppercase', fontWeight: 600, whiteSpace: 'nowrap' } }}
            >
              <Table.Thead bg="slate.0">
                <Table.Tr>
                  {head.map((h) => (
                    <Table.Th key={h.label || 'aksi'} ta={h.align} w={h.w}>
                      {h.label}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{shown}</Table.Tbody>
            </Table>
          </ScrollArea>
          {rows.length === 0 && (empty ?? (
            <Center py="xl">
              <Text fz="sm" c="slate.6">Tidak ada {noun} yang cocok dengan pencarian atau filter.</Text>
            </Center>
          ))}
          <Group justify="space-between" gap="sm" px="md" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
            <Text fz="xs" c="slate.7">
              Menampilkan {rows.length ? start + 1 : 0}–{start + shown.length} dari {rows.length} {noun}
            </Text>
            <Group gap="sm">
              <Select size="xs" radius="md" w={96} allowDeselect={false} data={pageSizes} value={pageSize} onChange={(v) => { setPageSize(v); setPage(1); }} />
              <Pagination size="sm" radius="md" total={totalPages} value={current} onChange={setPage} />
            </Group>
          </Group>
        </Box>
      </Box>
    </>
  );
}
