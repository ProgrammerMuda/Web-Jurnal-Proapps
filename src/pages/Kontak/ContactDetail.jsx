import {
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import {
  AddressBook,
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  Archive,
  Bank,
  DownloadSimple,
  FileText,
  Invoice,
  MapPin,
  PencilSimple,
  User,
} from '@/components/Icon.jsx';
import { CopyIcon } from '@/components/common.jsx';
import { formatDate } from '@/pages/Penjualan/utils.js';
import { GroupBadge, InfoItem, SectionCard, TypeBadges } from './components.jsx';
import { accountLabel, contactTerms, idTypes } from './data.js';
import InvoiceTable from './InvoiceTable.jsx';
import { areaLine, canBeInvoiced, fullName, shippingOf } from './utils.js';

function AddressBox({ title, value, badge }) {
  return (
    <Box
      p="sm"
      style={{
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 'var(--mantine-radius-md)',
      }}
    >
      <Group justify="space-between" mb={6}>
        <Text fz={11} fw={600} c="slate.7">
          {title}
        </Text>
        {badge}
      </Group>
      <Text fz="sm" fw={600} c="slate.9">
        {value?.address || 'Belum diisi'}
      </Text>
      {areaLine(value) && (
        <Text fz={11} c="slate.6">
          {areaLine(value)}
        </Text>
      )}
    </Box>
  );
}

function AccountBox({ label, code }) {
  return (
    <Group
      gap="sm"
      p="sm"
      bg="slate.0"
      wrap="nowrap"
      style={{ borderRadius: 'var(--mantine-radius-md)' }}
    >
      <ArrowRight size={14} color="var(--mantine-color-primary-9)" />
      <Box>
        <Text fz={11} c="slate.6">
          {label}
        </Text>
        <Text fz="sm" fw={600} c="slate.9">
          {accountLabel(code) ?? 'Standar sistem'}
        </Text>
      </Box>
    </Group>
  );
}

function Profile({ contact }) {
  const idLabel = idTypes.find((t) => t.value === contact.idType)?.short ?? 'KTP';
  const term =
    contactTerms.find((t) => t.value === contact.term)?.short ??
    (contact.termDays != null ? `${contact.termDays} hari` : null);

  return (
    <Grid gutter="md" align="flex-start">
      <Grid.Col span={{ base: 12, lg: 8 }}>
        <Stack gap="md">
          <SectionCard
            icon={User}
            title="Identitas kontak"
            description="Data utama dan cara menghubungi kontak ini."
          >
            <SimpleGrid cols={2} spacing="md" verticalSpacing="sm">
              <InfoItem label="Nama lengkap" value={fullName(contact) || contact.displayName} />
              <InfoItem label="Perusahaan" value={contact.company} />
              <InfoItem label="NPWP" value={contact.npwp} />
              <InfoItem label={idLabel} value={contact.idNumber} />
            </SimpleGrid>
            <Divider my="md" color="gray.3" />
            <Text fz="sm" fw={700} c="slate.9" mb="sm">
              Hubungi kontak
            </Text>
            <SimpleGrid cols={2} spacing="md" verticalSpacing="sm">
              <InfoItem
                label="Email"
                value={contact.email}
                after={<CopyIcon value={contact.email} size={12} />}
              />
              <InfoItem
                label="Ponsel"
                value={contact.mobile}
                after={<CopyIcon value={contact.mobile} size={12} />}
              />
              <InfoItem label="Telepon kantor" value={contact.phone} />
              <InfoItem label="Fax" value={contact.fax} />
            </SimpleGrid>
            {contact.notes && (
              <>
                <Divider my="md" color="gray.3" />
                <InfoItem label="Catatan" value={contact.notes} />
              </>
            )}
          </SectionCard>

          <SectionCard icon={MapPin} title="Alamat" description="Lokasi penagihan dan pengiriman.">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <AddressBox title="Alamat penagihan" value={contact.billing} />
              <AddressBox
                title="Alamat pengiriman"
                value={shippingOf(contact)}
                badge={
                  contact.shippingSame && (
                    <Badge size="xs" radius="sm" variant="light" color="blue">
                      Sama dengan penagihan
                    </Badge>
                  )
                }
              />
            </SimpleGrid>
          </SectionCard>

          <SectionCard
            icon={Bank}
            title="Rekening bank"
            description="Rekening yang tersimpan untuk kontak ini."
          >
            {contact.banks.length ? (
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                {contact.banks.map((b, i) => (
                  <Box
                    key={i}
                    p="sm"
                    style={{
                      border: '1px solid var(--mantine-color-gray-3)',
                      borderRadius: 'var(--mantine-radius-md)',
                    }}
                  >
                    <Text fz={11} fw={600} c="slate.7">
                      {b.bank || 'Bank'}
                    </Text>
                    <Group gap={4}>
                      <Text fz="sm" fw={700} c="slate.9" ff="monospace">
                        {b.number || '—'}
                      </Text>
                      {b.number && <CopyIcon value={b.number} size={12} />}
                    </Group>
                    <Text fz={11} c="slate.6">
                      a.n. {b.holder || '—'}
                      {b.branch && ` · ${b.branch}`}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>
            ) : (
              <Text fz="sm" c="slate.7">
                Belum ada rekening bank tersimpan.
              </Text>
            )}
          </SectionCard>
        </Stack>
      </Grid.Col>

      <Grid.Col span={{ base: 12, lg: 4 }}>
        <Stack gap="md">
          <SectionCard
            accent
            icon={FileText}
            title="Pengaturan transaksi"
            description="Akun dan termin yang tercatat pada profil kontak."
          >
            <Stack gap="sm">
              <AccountBox label="Akun piutang" code={contact.arAccount} />
              <AccountBox label="Akun hutang" code={contact.apAccount} />
              <Divider color="gray.3" />
              <InfoItem label="Termin pembayaran" value={term} empty="Belum diatur" />
              <InfoItem label="Batas piutang" value={null} empty="Belum diatur" />
              <InfoItem label="Batas hutang" value={null} empty="Belum diatur" />
            </Stack>
          </SectionCard>

          <SectionCard title="Rincian data">
            <Stack gap="sm">
              <InfoItem
                label="Nomor kontak"
                value={contact.number}
                after={<CopyIcon value={contact.number} size={12} />}
              />
              <InfoItem label="Kode eksternal" value={contact.externalCode} />
              <InfoItem
                label="ID sistem"
                value={contact.id}
                after={<CopyIcon value={contact.id} size={12} />}
              />
              <InfoItem label="Dibuat" value={formatDate(contact.createdAt)} />
              <InfoItem label="Diperbarui" value={formatDate(contact.updatedAt)} />
            </Stack>
          </SectionCard>
        </Stack>
      </Grid.Col>
    </Grid>
  );
}

export default function ContactDetail({
  contact,
  sales,
  onBack,
  onEdit,
  onArchive,
  onRestore,
  onOpenHistory,
  onOpenSale,
  onExportSales,
}) {
  const invoiceable = canBeInvoiced({ ...contact, archived: false });
  const [tab, setTab] = useState('profile');
  const tabs = [
    { value: 'profile', label: 'Profil & Pengaturan', icon: User },
    ...(invoiceable ? [{ value: 'invoices', label: 'Faktur Penjualan', icon: Invoice }] : []),
  ];

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" align="flex-start" gap="md">
          <Group gap="md" wrap="nowrap">
            <ThemeIcon size={40} radius="md" color="primary.9">
              <AddressBook size={22} />
            </ThemeIcon>
            <Box>
              <Group gap="xs">
                <Title order={3} fz="lg" c="slate.9">
                  {contact.displayName}
                </Title>
                {contact.archived && (
                  <Badge
                    size="xs"
                    radius="sm"
                    color="orange"
                    variant="light"
                    leftSection={<Archive size={10} />}
                  >
                    Diarsipkan
                  </Badge>
                )}
              </Group>
              <Group gap={4} mt={4}>
                <TypeBadges types={contact.types} detail />
                {contact.groups.map((g) => (
                  <GroupBadge key={g} name={g} />
                ))}
              </Group>
            </Box>
          </Group>
          <Group gap="xs">
            <Button
              variant="default"
              radius="md"
              leftSection={<ArrowLeft size={16} />}
              onClick={onBack}
            >
              Kembali ke Kontak
            </Button>
            {contact.archived ? (
              <Button
                variant="default"
                radius="md"
                leftSection={<ArrowCounterClockwise size={16} />}
                onClick={onRestore}
              >
                Pulihkan
              </Button>
            ) : (
              <Button
                variant="default"
                radius="md"
                leftSection={<Archive size={16} />}
                onClick={onArchive}
              >
                Arsipkan
              </Button>
            )}
            <Button radius="md" leftSection={<PencilSimple size={16} />} onClick={onEdit}>
              Ubah Kontak
            </Button>
          </Group>
        </Group>
      </Card>

      <Card withBorder radius="lg" padding="xs" bg="white">
        <Group gap={4}>
          {tabs.map((t) => {
            const active = tab === t.value;
            return (
              <Button
                key={t.value}
                size="sm"
                radius="md"
                variant={active ? 'filled' : 'subtle'}
                color={active ? 'primary.9' : 'slate.7'}
                leftSection={<t.icon size={16} />}
                fw={active ? 700 : 500}
                fz="xs"
                onClick={() => setTab(t.value)}
              >
                {t.label}
              </Button>
            );
          })}
        </Group>
      </Card>

      {tab === 'profile' ? (
        <Profile contact={contact} />
      ) : (
        <SectionCard
          title="Faktur penjualan"
          description="Cari dan tinjau faktur yang terkait dengan kontak ini."
          right={
            <Group gap="xs">
              <Button
                size="sm"
                radius="md"
                variant="default"
                leftSection={<DownloadSimple size={16} />}
                onClick={onExportSales}
              >
                Ekspor data
              </Button>
              <Button size="sm" radius="md" variant="light" onClick={onOpenHistory}>
                Halaman transaksi penuh
              </Button>
            </Group>
          }
        >
          <InvoiceTable sales={sales} variant="detail" onOpenSale={onOpenSale} />
        </SectionCard>
      )}
    </Stack>
  );
}
