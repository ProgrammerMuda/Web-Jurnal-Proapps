import {
  ActionIcon,
  Avatar,
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
import { useState } from 'react';
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
          { key: 'pembelian:fpbj', label: 'Permintaan', icon: FileText },
          { key: 'pembelian:orders', label: 'Pesanan', icon: Package },
          { key: 'pembelian:receipts', label: 'Penerimaan Barang', icon: Truck },
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
      { label: 'Produk', icon: TreeStructure },
      { label: 'Produksi', icon: Package },
      { label: 'Pemenuhan', icon: Truck },
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
          { label: 'Pajak', icon: Percent },
        ],
      },
      {
        label: 'Transaksi & Dokumen',
        icon: ArrowsLeftRight,
        children: [
          { label: 'Syarat Pembayaran', icon: ClockCountdown },
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

function NavItem({ item, collapsed, opened, onToggle, activeKey, onNavigate }) {
  const hasChildren = !!item.children;
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
            <Menu.Item key={c.label} leftSection={<c.icon size={16} />} fz={12} onClick={() => c.key && onNavigate?.(c.key)}>
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
        rightSection={hasChildren ? <Chevron opened={opened} /> : null}
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
