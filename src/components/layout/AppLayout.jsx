import {
  ActionIcon,
  AppShell,
  Avatar,
  Box,
  Group,
  Menu,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Bell, CalendarBlank, CaretDown, Plus } from '@/components/Icon.jsx';
import Sidebar from './Sidebar.jsx';
import { FOOTER_HEIGHT, HEADER_HEIGHT } from './constants.js';

export default function AppLayout({ title, section, activeKey, onNavigate, children }) {
  const [collapsed, { toggle }] = useDisclosure(false);

  return (
    <AppShell
      layout="alt"
      header={{ height: HEADER_HEIGHT }}
      navbar={{ width: collapsed ? 64 : 248, breakpoint: 'sm', collapsed: { mobile: true } }}
      footer={{ height: FOOTER_HEIGHT }}
      padding={0}
      bg="slate.0"
    >
      <AppShell.Header withBorder bg="white">
        <Group h="100%" px="lg" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Box>
              <Text
                fz={10}
                fw={600}
                c="slate.5"
                tt="uppercase"
                lh={1.2}
                style={{ letterSpacing: 1 }}
              >
                {section}
              </Text>
              <Text fw={700} fz="md" c="slate.9" lh={1.3}>
                {title}
              </Text>
            </Box>
          </Group>

          <Group gap="md" wrap="nowrap">
            <Menu withinPortal>
              <Menu.Target>
                <UnstyledButton>
                  <Group gap={4}>
                    <Text fz="xs" fw={600} c="slate.7">
                      ID
                    </Text>
                    <CaretDown size={12} />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item>ID</Menu.Item>
                <Menu.Item>EN</Menu.Item>
              </Menu.Dropdown>
            </Menu>

            <Group gap={6} wrap="nowrap" visibleFrom="sm">
              <CalendarBlank size={16} color="var(--mantine-color-slate-6)" />
              <Text fz="xs" fw={500} c="slate.7">
                Rab, 4 Nov 2026
              </Text>
            </Group>

            <ActionIcon size="lg" radius="md" aria-label="Buat baru">
              <Plus size={18} />
            </ActionIcon>
            <ActionIcon size="lg" radius="md" variant="default" aria-label="Notifikasi">
              <Bell size={18} />
            </ActionIcon>

            <Menu withinPortal position="bottom-end">
              <Menu.Target>
                <UnstyledButton>
                  <Group gap="xs" wrap="nowrap">
                    <Avatar size={28} radius="sm" color="primary" variant="light">
                      F
                    </Avatar>
                    <Text fz="sm" fw={600} c="slate.8" visibleFrom="sm">
                      Finance
                    </Text>
                    <CaretDown size={12} />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item>Profil</Menu.Item>
                <Menu.Item c="red">Keluar</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar withBorder>
        <Sidebar
          collapsed={collapsed}
          onToggle={toggle}
          activeKey={activeKey}
          onNavigate={onNavigate}
        />
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>

      <AppShell.Footer withBorder bg="white">
        <Group h="100%" px="lg">
          <Text fz="xs" c="slate.6">
            © 2026{' '}
            <Text span fw={700} inherit>
              ProApps
            </Text>{' '}
            · Jurnal Accounting
          </Text>
        </Group>
      </AppShell.Footer>
    </AppShell>
  );
}
