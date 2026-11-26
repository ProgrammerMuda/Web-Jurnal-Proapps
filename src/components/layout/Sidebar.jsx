import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Center,
  Collapse,
  Group,
  Image,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import { usePb } from '@/pages/Pembelian/usePb.js';
import { actionCountsByMenu } from '@/pages/Pembelian/selectors.js';
import { actionCountsByTab } from '@/pages/Penjualan/selectors.js';
import { useData } from '@/lib/store.jsx';
import badge from '@/assets/badge.svg';
import mark from '@/assets/mark.svg';
import {
  AddressBook,
  Bank,
  Briefcase,
  Buildings,
  Calculator,
  CaretRight,
  ArrowCounterClockwise,
  ChartBar,
  ChartPieSlice,
  ClipboardText,
  FileText,
  HandCoins,
  Invoice,
  SquaresFour,
  ClockCountdown,
  Coins,
  CreditCard,
  Hash,
  House,
  IdentificationCard,
  ListBullets,
  Money,
  Package,
  Percent,
  ListChecks,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  SidebarSimple,
  SignOut,
  SlidersHorizontal,
  Storefront,
  Tag,
  TreeStructure,
  Truck,
  ArrowsLeftRight,
  Warehouse,
  Garage,
  Ruler,
  Factory,
  Handshake,
  SelectionAll,
  UserCircle,
  UsersThree,
  Wallet,
} from '@/components/Icon.jsx';
import { FOOTER_HEIGHT, HEADER_HEIGHT } from './constants.js';

const groups = [
  {
    label: 'Utama',
    items: [
      { key: 'ringkasan', label: 'Ringkasan', icon: House },
      { key: 'laporan', label: 'Laporan Keuangan', icon: ChartPieSlice },
      { label: 'Perencanaan Anggaran', icon: Money },
    ],
  },
  {
    label: 'Transaksi',
    items: [
      {
        label: 'Kas & Bank',
        icon: Bank,
        children: [
          { label: 'Akun Kas & Bank', icon: Wallet },
          { label: 'Kas Kecil', icon: Coins },
        ],
      },
      {
        label: 'Penjualan',
        icon: Storefront,
        children: [
          { key: 'penjualan:overview', label: 'Ringkasan Penjualan', icon: SquaresFour },
          { key: 'penjualan:invoices', label: 'Faktur Penjualan', icon: Invoice },
          { key: 'penjualan:quotes', label: 'Penawaran', icon: FileText },
          { key: 'penjualan:orders', label: 'Pesanan Penjualan', icon: ClipboardText },
          { key: 'penjualan:payments', label: 'Pembayaran Masuk', icon: HandCoins },
          { key: 'penjualan:returns', label: 'Retur Penjualan', icon: ArrowCounterClockwise },
          { key: 'penjualan:receivables', label: 'Piutang Usaha', icon: ChartBar },
        ],
      },
      {
        label: 'Pembelian',
        icon: ShoppingCart,
        children: [
          { key: 'pembelian:overview', label: 'Ringkasan Pembelian', icon: SquaresFour },
          { key: 'pembelian:fppbj', label: 'Permintaan', icon: FileText },
          { key: 'pembelian:orders', label: 'Pesanan', icon: Package },
          { key: 'pembelian:receipts', label: 'Penerimaan Barang/Jasa', icon: Truck },
          { key: 'pembelian:bills', label: 'Tagihan Vendor', icon: Receipt },
          { key: 'pembelian:payments', label: 'Pembayaran', icon: Wallet },
          { key: 'pembelian:returns', label: 'Retur Pembelian', icon: ArrowCounterClockwise },
          { key: 'pembelian:payables', label: 'Hutang Usaha', icon: ChartBar },
        ],
      },
      { label: 'Biaya', icon: Receipt },
      { label: 'Persetujuan Perubahan', icon: ShieldCheck },
    ],
  },
  {
    label: 'Operasional',
    items: [
      {
        label: 'Persediaan',
        icon: Warehouse,
        children: [
          { key: 'produk:items', label: 'Produk & Jasa', icon: SelectionAll },
          { key: 'produk:categories', label: 'Kategori Produk', icon: Tag },
          { key: 'produk:units', label: 'Satuan', icon: Ruler },
          { key: 'gudang:warehouses', label: 'Gudang', icon: Garage },
          { key: 'gudang:moves', label: 'Mutasi Stok', icon: ArrowsLeftRight },
          { key: 'gudang:opname', label: 'Stok Opname', icon: ClipboardText },
        ],
      },
      { label: 'Produksi', icon: Factory },
      { label: 'Pemenuhan', icon: Handshake },
    ],
  },
  {
    label: 'Master Data',
    items: [
      { key: 'daftar-akun', label: 'Daftar Akun', icon: ListBullets },
      { label: 'Asset', icon: Briefcase },
      { key: 'kontak', label: 'Kontak', icon: AddressBook },
    ],
  },
  {
    label: 'Pengaturan',
    items: [
      {
        label: 'Umum',
        icon: Buildings,
        children: [
          { label: 'Profil Perusahaan', icon: IdentificationCard },
          { label: 'Presisi Angka', icon: SlidersHorizontal },
        ],
      },
      {
        label: 'Akuntansi',
        icon: Calculator,
        children: [
          { label: 'Pemetaan Akun', icon: TreeStructure },
          { key: 'pajak-biaya', label: 'Pajak & Biaya Perolehan', icon: Percent },
          { key: 'akun-opname', label: 'Akun Selisih Opname', icon: ListChecks },
        ],
      },
      {
        label: 'Transaksi & Dokumen',
        icon: ArrowsLeftRight,
        children: [
          { key: 'syarat-pembayaran', label: 'Syarat Pembayaran', icon: ClockCountdown },
          { label: 'Metode Pembayaran', icon: CreditCard },
          { label: 'Penomoran Dokumen', icon: Hash },
          { label: 'Tag Transaksi', icon: Tag },
        ],
      },
      { label: 'Pengguna & Peran', icon: UsersThree },
      { label: 'Profil', icon: UserCircle },
    ],
  },
];

const hasActiveChild = (item, activeKey) => !!item.children?.some((c) => c.key === activeKey);

function navStyles({ active, collapsed, parentOfActive, child }) {
  const highlighted = active || parentOfActive;
  return {
    root: {
      borderRadius: 'var(--mantine-radius-md)',
      padding: collapsed ? '10px 0' : child ? '7px 10px' : '9px 12px',
      justifyContent: collapsed ? 'center' : undefined,
      color: highlighted
        ? 'var(--mantine-color-primary-9)'
        : child
          ? 'var(--mantine-color-slate-6)'
          : 'var(--mantine-color-slate-7)',
      backgroundColor: active ? 'var(--mantine-color-slate-1)' : undefined,
    },
    section: collapsed ? { margin: 0 } : undefined,
    // Area label tetap dirender (flex: 1) walau kosong; sembunyikan agar ikon rata tengah.
    body: collapsed ? { display: 'none' } : undefined,
    label: {
      fontSize: 12,
      fontWeight: highlighted ? 700 : 500,
      whiteSpace: 'nowrap',
    },
  };
}

function Chevron({ opened }) {
  return (
    <CaretRight
      size={12}
      style={{ transform: opened ? 'rotate(90deg)' : undefined, transition: 'transform 150ms' }}
    />
  );
}

// Angka tugas yang menunggu peran aktif. Hanya untuk menu yang punya tugas; nol tidak ditulis.
function Count({ n, dot }) {
  if (!n) return null;
  if (dot) return <Box w={8} h={8} bg="red.6" style={{ borderRadius: 99, position: 'absolute', top: 6, right: 10 }} />;
  return (
    <Badge size="xs" radius="xl" color="red.6" variant="filled" fw={700} miw={18} px={5} styles={{ label: { overflow: 'visible' } }}>
      {n > 99 ? '99+' : n}
    </Badge>
  );
}

function NavItem({ item, collapsed, opened, onToggle, activeKey, onNavigate, counts = {} }) {
  const hasChildren = !!item.children;
  const total = hasChildren ? item.children.reduce((n, c) => n + (counts[c.key] ?? 0), 0) : counts[item.key] ?? 0;
  const parentOfActive = hasActiveChild(item, activeKey);
  const active = item.key === activeKey;
  const go = () => item.key && onNavigate?.(item.key);

  // Mode rail: ikon saja. Submenu muncul sebagai popover saat kursor diarahkan.
  if (collapsed) {
    const link = (
      <NavLink
        aria-label={item.label}
        onClick={hasChildren ? undefined : go}
        active={active}
        leftSection={<item.icon size={20} />}
        styles={navStyles({ active, collapsed, parentOfActive })}
        rightSection={<Count n={total} dot />}
        style={{ position: 'relative' }}
      />
    );
    if (!hasChildren) {
      return (
        <Tooltip label={item.label} position="right" withArrow>
          {link}
        </Tooltip>
      );
    }
    return (
      <Menu trigger="hover" position="right-start" offset={12} withArrow shadow="md">
        <Menu.Target>{link}</Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{item.label}</Menu.Label>
          {item.children.map((c) => (
            <Menu.Item key={c.label} leftSection={<c.icon size={16} />} rightSection={<Count n={counts[c.key]} />} fz={12} onClick={() => c.key && onNavigate?.(c.key)}>
              {c.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    );
  }

  return (
    <>
      <NavLink
        label={item.label}
        active={active}
        leftSection={<item.icon size={20} />}
        // Grup tertutup tetap memberi tahu ada tugas di dalamnya; saat terbuka angkanya pindah ke submenu.
        rightSection={hasChildren ? <Group gap={6} wrap="nowrap">{!opened && <Count n={total} />}<Chevron opened={opened} /></Group> : <Count n={total} />}
        onClick={hasChildren ? onToggle : go}
        aria-expanded={hasChildren ? opened : undefined}
        styles={navStyles({ active, collapsed, parentOfActive })}
      />
      {hasChildren && (
        <Collapse expanded={opened}>
          <Stack
            gap={2}
            ml={20}
            pl={8}
            my={4}
            style={{ borderLeft: '1px solid var(--mantine-color-slate-2)' }}
          >
            {item.children.map((c) => (
              <NavLink
                key={c.label}
                label={c.label}
                active={c.key === activeKey}
                onClick={() => c.key && onNavigate?.(c.key)}
                leftSection={<c.icon size={16} />}
                rightSection={<Count n={counts[c.key]} />}
                styles={navStyles({ active: c.key === activeKey, collapsed, child: true })}
              />
            ))}
          </Stack>
        </Collapse>
      )}
    </>
  );
}

export default function Sidebar({ collapsed, onToggle, activeKey, onNavigate }) {
  // Badge angka Pembelian: tugas "Perlu tindakan" milik peran yang sedang dilihat.
  // Badge Penjualan: tugas "Perlu tindakan" dari Ringkasan Penjualan, per halaman pemiliknya.
  const pb = usePb();
  const { sales, quotes, orders, salesReturns } = useData();
  const counts = useMemo(
    () => ({
      ...Object.fromEntries(Object.entries(actionCountsByMenu(pb.role, pb)).map(([k, n]) => [`pembelian:${k}`, n])),
      ...Object.fromEntries(
        Object.entries(actionCountsByTab({ sales, quotes, orders, salesReturns })).map(([k, n]) => [`penjualan:${k}`, n]),
      ),
    }),
    [pb, sales, quotes, orders, salesReturns],
  );
  // Dropdown bisa terbuka bersamaan (bukan akordeon); grup yang berisi menu aktif terbuka awal.
  const [open, setOpen] = useState(
    () =>
      new Set(
        groups.flatMap((g) =>
          g.items.filter((i) => hasActiveChild(i, activeKey)).map((i) => i.label),
        ),
      ),
  );
  const toggleItem = (label) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  return (
    <Stack h="100%" gap={0} bg="white">
      {/* Header sidebar: logo + tombol tutup (terbuka) / lambang logo untuk membuka (tertutup) */}
      <Group
        h={HEADER_HEIGHT}
        px={collapsed ? 0 : 'md'}
        justify={collapsed ? 'center' : 'space-between'}
        wrap="nowrap"
        style={{ flexShrink: 0, borderBottom: '1px solid var(--mantine-color-slate-2)' }}
      >
        {collapsed ? (
          <Tooltip label="Buka sidebar" position="right" withArrow>
            <UnstyledButton onClick={onToggle} aria-label="Buka sidebar" h={34} w={34}>
              <Image src={mark} alt="ProApps" h={34} w={34} />
            </UnstyledButton>
          </Tooltip>
        ) : (
          <>
            <Image src={badge} alt="ProApps" h={36} w="auto" fit="contain" />
            <ActionIcon
              variant="light"
              size="lg"
              radius="md"
              onClick={onToggle}
              aria-label="Tutup sidebar"
            >
              <SidebarSimple size={18} />
            </ActionIcon>
          </>
        )}
      </Group>

      <ScrollArea flex={1} mih={0} px="sm" pt="sm" scrollbarSize={6}>
        <Stack gap="md" pb="md">
          {groups.map((group) => (
            <Box key={group.label}>
              {collapsed ? (
                <Text
                  ta="center"
                  fz={9}
                  fw={700}
                  c="slate.5"
                  tt="uppercase"
                  mb={4}
                  title={group.label}
                  style={{ letterSpacing: 0.5 }}
                >
                  {group.label.slice(0, 4)}
                </Text>
              ) : (
                <Text
                  fz={10}
                  fw={700}
                  c="slate.5"
                  tt="uppercase"
                  px="xs"
                  mb={4}
                  style={{ letterSpacing: 1 }}
                >
                  {group.label}
                </Text>
              )}
              <Stack gap={2}>
                {group.items.map((item) => (
                  <NavItem
                    key={item.label}
                    item={item}
                    collapsed={collapsed}
                    opened={open.has(item.label)}
                    onToggle={() => toggleItem(item.label)}
                    activeKey={activeKey}
                    onNavigate={onNavigate}
                    counts={counts}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </ScrollArea>

      <Box
        px="sm"
        h={FOOTER_HEIGHT}
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          borderTop: '1px solid var(--mantine-color-slate-2)',
        }}
      >
        {collapsed ? (
          <Center w="100%">
            <Avatar size={36} radius="md" color="primary" variant="filled">
              F
            </Avatar>
          </Center>
        ) : (
          <Group w="100%" gap="sm" wrap="nowrap" justify="space-between">
            <Group gap="sm" wrap="nowrap">
              <Avatar size={36} radius="md" color="primary" variant="filled">
                F
              </Avatar>
              <Box>
                <Text fz="sm" fw={700} c="slate.9" lh={1.2}>
                  Finance
                </Text>
                <Text fz="xs" c="slate.6">
                  Jurnal Accounting
                </Text>
              </Box>
            </Group>
            <ActionIcon variant="subtle" color="red" aria-label="Keluar">
              <SignOut size={18} />
            </ActionIcon>
          </Group>
        )}
      </Box>
    </Stack>
  );
}
