// Detail permintaan: stepper alur, verifikasi, pengadaan (bidding / pesan ulang), approval, dan pembuatan PO.
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Menu,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { ArrowCounterClockwise, Briefcase, Info, Paperclip, Buildings, DotsThreeVertical, CalendarBlank, Check, ClipboardText, ListBullets, Money, Package, ShoppingCart, X } from '@/components/Icon.jsx';
import { BackLink, CardHead, Callout, StatCell, CopyIcon, DataTable, DocNumber, Section, StatusPill } from './components.jsx';
import { Hint } from './procurement.jsx';
import ProcurementPanel from './ProcurementPanel.jsx';
import PurchaseFlow from './PurchaseFlow.jsx';
import AttachmentList from './Attachments.jsx';
import { ReasonModal } from './Dialogs.jsx';
import { personLabel } from './data.js';
import { canCreate } from './permissions.js';
import {
  buildPOs,
  createPOs,
  formatDate,
  FPBJ_STATUS,
  iomFiles,
  requesterOf,
  routeLabel,
  fpbjTotal,
  PO_STATUS,
  poDocLabel,
  poStatus,
  poSubtotal,
  rupiah,
} from './utils.js';
import { toast } from './usePb.js';


function InfoCell({ label, children, divider }) {
  return (
    <Box
      px="lg"
      py="md"
      style={{ minWidth: 0, borderLeft: divider ? '1px solid var(--mantine-color-gray-2)' : undefined }}
    >
      <Text fz={11} fw={600} c="slate.6">{label}</Text>
      <Text fz="sm" fw={700} c="slate.9" lh={1.35} component="div" style={{ overflowWrap: 'anywhere' }}>{children}</Text>
    </Box>
  );
}

export default function FpbjDetail({ fpbj: f, pb, onBack, go }) {
  const role = pb.role;
  const [reason, setReason] = useState(null); // 'return' | 'reject'
  const pos = pb.pos.filter((p) => p.fpbjId === f.id);
  const patch = (fn) => pb.update('fpbj', f.id, fn);
  const proc = f.procurement;
  const vendor = (id) => pb.vendorsById[id]?.name ?? '—';
  const allPoDone = pos.length > 0 && pos.every((p) => poStatus(p, pb.calc) === 'selesai');
  const statusKey = allPoDone ? 'selesai' : f.status;

  // --- aksi ---
  const verify = () => {
    patch((d) => ({
      ...d,
      status: d.route ? 'dalam_pengadaan' : 'diverifikasi',
      procurement: d.route && !d.procurement ? (d.route === 'repeat' ? { kind: 'repeat', status: 'draf', reason: '', comparators: {} } : { kind: 'bidding', status: 'draf', reason: '', winners: {}, finals: {}, negotiation: '' }) : d.procurement,
    }));
    toast('Permintaan diverifikasi.');
  };
  const cancelRequest = (note) => {
    patch((d) => ({ ...d, status: 'dibatalkan', cancelNote: note, cancelledBy: personLabel(role) }));
    setReason(null);
    toast('Permintaan dibatalkan.');
  };
  const canCancel = (canCreate(role, 'fpbj') || canCreate(role, 'po')) && !['dibatalkan', 'selesai'].includes(f.status) && pos.length === 0;
  const sendBack = (note) => {
    patch((d) => ({ ...d, status: 'dikembalikan', returnNote: note }));
    setReason(null);
  };
  const makePOs = () => {
    const n = createPOs(f, pb).length;
    toast(`${n} pesanan dibuat sebagai draf. Kirim ke vendor dari halaman detailnya.`);
  };

  const canGeneratePO = proc?.status === 'disetujui' && pos.length === 0;

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto" className="pb-form">
      <BackLink label="Kembali ke daftar permintaan" onClick={onBack} />

      <Card withBorder radius="lg" padding={0} bg="white">
        <Group justify="space-between" align="center" gap="md" p="lg">
          <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
            <ThemeIcon size={52} radius="md" color="primary.9"><ClipboardText size={26} /></ThemeIcon>
            <Box style={{ minWidth: 0 }}>
              <Group gap="xs" wrap="wrap">
                <Title order={2} fz={{ base: 20, md: 24 }} c="slate.9">{f.number}</Title>
                <CopyIcon value={f.number} size={16} />
                <StatusPill map={FPBJ_STATUS} status={statusKey} />
                {f.route && <Badge size="sm" radius="sm" variant="light" color="gray" c="slate.6" tt="none">{routeLabel(f)}</Badge>}
              </Group>
              <Text fz="sm" c="slate.6">Diajukan oleh {requesterOf(f)}</Text>
            </Box>
          </Group>
          <Group gap="xs">
            {['draft', 'dikembalikan'].includes(f.status) && canCreate(role, 'fpbj') && (
              <Button radius="md" variant="default" onClick={() => go({ name: 'fpbj-edit', id: f.id })}>Ubah permintaan</Button>
            )}
            {/* Hanya peminta yang mengajukan permintaannya sendiri (spesifikasi 2.2). */}
            {f.status === 'draft' && canCreate(role, 'fpbj') && (
              <Button radius="md" onClick={() => patch((d) => ({ ...d, status: 'diajukan' }))}>Ajukan permintaan</Button>
            )}
            {f.status === 'dikembalikan' && canCreate(role, 'fpbj') && (
              <Button radius="md" onClick={() => patch((d) => ({ ...d, status: 'diajukan', returnNote: '' }))}>Ajukan ulang</Button>
            )}
            {f.status === 'diajukan' && canCreate(role, 'procurement') && (
              <>
                <Button radius="md" variant="default" leftSection={<ArrowCounterClockwise size={16} />} onClick={() => setReason('return')}>Kembalikan</Button>
                <Button radius="md" leftSection={<Check size={16} />} onClick={verify}>Verifikasi</Button>
              </>
            )}
            {f.status === 'diajukan' && !canCreate(role, 'procurement') && <Hint role="accounting" />}
            {canCancel && (
              <>
                <Divider orientation="vertical" mx={2} />
                <Menu position="bottom-end" width={220} shadow="md" withinPortal>
                  <Menu.Target>
                    <ActionIcon variant="default" size={36} radius="md" aria-label="Aksi lainnya">
                      <DotsThreeVertical size={18} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Label>Lainnya</Menu.Label>
                    <Menu.Item color="red" fz="sm" leftSection={<X size={16} />} onClick={() => setReason('cancel')}>
                      Batalkan permintaan
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </>
            )}
          </Group>
        </Group>
        <SimpleGrid
          cols={{ base: 1, xs: 2, md: 4 }}
          spacing={0}
          bg="slate.0"
          style={{ borderTop: '1px solid var(--mantine-color-gray-3)', borderRadius: '0 0 var(--mantine-radius-lg) var(--mantine-radius-lg)' }}
        >
          <StatCell icon={CalendarBlank} label="Tanggal permintaan">{formatDate(f.date)}</StatCell>
          <StatCell icon={CalendarBlank} label="Dibutuhkan pada">{formatDate(f.neededBy)}</StatCell>
          <StatCell icon={Buildings} label="Departemen">{f.dept}</StatCell>
          <StatCell icon={Money} label="Estimasi total">{rupiah(fpbjTotal(f))}</StatCell>
        </SimpleGrid>
      </Card>

      {(f.splitFrom || f.splitTo?.length > 0) && (
        <Callout title="Paket dipecah">
          {f.splitFrom && <>Paket item baru dari <DocNumber onClick={() => go({ name: 'fpbj', id: f.splitFrom })}>{pb.fpbjById[f.splitFrom]?.number}</DocNumber>. </>}
          {f.splitTo?.map((id) => <span key={id}>Item baru dipindah ke <DocNumber onClick={() => go({ name: 'fpbj', id })}>{pb.fpbjById[id]?.number}</DocNumber>. </span>)}
        </Callout>
      )}
      {f.status === 'dibatalkan' && (
        <Callout tone="stop" title="Permintaan dibatalkan">
          {f.cancelNote}
          {f.cancelledBy && <Text fz="xs" mt={4}>Dibatalkan oleh {f.cancelledBy}</Text>}
        </Callout>
      )}
      {f.status === 'dikembalikan' && (
        <Callout tone="stop" title="Dikembalikan oleh Accounting">{f.returnNote}</Callout>
      )}

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8.5 }}>
          <Stack gap="lg">
            {/* Pilih jalur */}
            <ProcurementPanel f={f} pb={pb} role={role} go={go} />

            {canGeneratePO && (
              <Section divided icon={ShoppingCart} title="Buat pesanan" description="Satu dokumen per vendor: PO untuk barang, SPK kalau isinya jasa semua. Harga dan termin diambil dari pengadaan yang disetujui.">
                {canCreate(role, 'po') ? (
                  <Stack gap="sm">
                    {buildPOs(f, pb.pos, pb.vendors).map((b, i) => (
                      <Group key={i} justify="space-between" p="sm" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
                        <Box>
                          <Text fz="sm" fw={700}>{poDocLabel({ items: b.items })} · {vendor(b.vendorId)}</Text>
                          <Text fz={11} c="slate.6">{b.items.map((x) => `${x.desc} ×${x.qty}`).join(', ')}</Text>
                        </Box>
                        <Text fz="sm" fw={700}>{rupiah(b.items.reduce((n, x) => n + x.qty * x.price, 0))}</Text>
                      </Group>
                    ))}
                    <Group><Button radius="md" leftSection={<ShoppingCart size={16} />} onClick={makePOs}>Buat pesanan</Button></Group>
                  </Stack>
                ) : (
                  <Hint role="accounting" />
                )}
              </Section>
            )}

            {pos.length > 0 && (
              <Section divided icon={ShoppingCart} title="Pesanan" description="Dokumen turunan permintaan ini. Lanjutkan penerimaan, faktur, dan pembayaran dari detailnya.">
                <DataTable head={[{ label: 'Nomor' }, { label: 'Vendor' }, { label: 'Status' }, { label: 'Nilai (DPP)', align: 'right' }]} minWidth={560}>
                  {pos.map((p) => (
                    <Table.Tr key={p.id}>
                      <Table.Td><DocNumber onClick={() => go({ name: 'po', id: p.id })}>{p.number}</DocNumber></Table.Td>
                      <Table.Td fz="sm">{vendor(p.vendorId)}</Table.Td>
                      <Table.Td><StatusPill map={PO_STATUS} status={poStatus(p, pb.calc)} size="xs" /></Table.Td>
                      <Table.Td ta="right" fz="sm" fw={700}>{rupiah(poSubtotal(p))}</Table.Td>
                    </Table.Tr>
                  ))}
                </DataTable>
              </Section>
            )}

            <Card withBorder radius="lg" padding={0} bg="white">
              <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                <CardHead icon={Info} desc="Keperluan, peminta, cara pengadaan, dan catatan">Informasi permintaan</CardHead>
              </Box>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={0}>
                <InfoCell label="Keperluan">{f.purpose}</InfoCell>
                <InfoCell label="Peminta" divider>
                  {requesterOf(f).split(' · ')[0]}
                  {requesterOf(f).includes(' · ') && <Text fz="xs" c="slate.6" fw={500}>{requesterOf(f).split(' · ')[1]}</Text>}
                </InfoCell>
              </SimpleGrid>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={0} style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                <InfoCell label="Cara pengadaan">
                  {f.route ? routeLabel(f) : <Text span fz="sm" c="slate.6">Belum ditentukan</Text>}
                </InfoCell>
                <InfoCell label="Catatan peminta" divider>
                  {f.note ? <Text fz="sm" fw={500} c="slate.8" style={{ whiteSpace: 'pre-wrap' }}>{f.note}</Text> : '—'}
                </InfoCell>
              </SimpleGrid>
            </Card>

            <Card withBorder radius="lg" padding={0} bg="white">
              <Group justify="space-between" px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                <CardHead icon={Paperclip} desc="Nomor, tanggal, dan berkas memo internal">IOM</CardHead>
                <Badge size="sm" radius="sm" variant="light" color="slate" tt="none">{iomFiles(f.iom).length} berkas</Badge>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={0}>
                <InfoCell label="No. IOM">{f.iom.no || '—'}</InfoCell>
                <InfoCell label="Tanggal IOM" divider>{f.iom.date ? formatDate(f.iom.date) : '—'}</InfoCell>
              </SimpleGrid>
              <Box px="lg" py="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                {iomFiles(f.iom).length ? (
                  <AttachmentList names={iomFiles(f.iom)} label={`IOM ${f.iom.no}`} />
                ) : (
                  <Text fz="xs" c="slate.6">Belum ada berkas IOM.</Text>
                )}
              </Box>
            </Card>

            <Card withBorder radius="lg" padding={0} bg="white">
              <Group justify="space-between" px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                {/* Ikon kepala seksi sengaja beda dari ikon baris (Package / Briefcase) supaya tidak kembar. */}
                <CardHead icon={ListBullets} desc="Barang dan jasa yang diminta, beserta estimasi harga">Item permintaan</CardHead>
                <Badge size="sm" radius="sm" variant="light" color="slate" tt="none">{f.items.length} item</Badge>
              </Group>
              {f.items.map((i, idx) => (
                <Box
                  key={i.id}
                  px="lg"
                  py="md"
                  style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 150px minmax(0, 1fr)', alignItems: 'center', columnGap: 'var(--mantine-spacing-md)', borderTop: idx ? '1px solid var(--mantine-color-gray-2)' : undefined }}
                >
                  <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
                    <ThemeIcon variant="light" size={44} radius="md" color={i.kind === 'jasa' ? 'grape' : 'primary'} style={{ flexShrink: 0 }}>
                      {i.kind === 'jasa' ? <Briefcase size={22} /> : <Package size={22} />}
                    </ThemeIcon>
                    <Box style={{ minWidth: 0 }}>
                      <Group gap={6} wrap="wrap">
                        <Text fz="sm" fw={700} c="slate.9">{i.desc}</Text>
                        <Badge size="xs" radius="sm" variant="light" color={i.isNew ? 'blue' : 'teal'} tt="none">{i.isNew ? 'Item baru' : 'Item lama'}</Badge>
                      </Group>
                      {i.spec && <Text fz="xs" c="slate.6">{i.spec}</Text>}
                    </Box>
                  </Group>
                  <Stack gap={4} align="center">
                    <Badge size="sm" radius="xl" variant="default" fw={600} tt="none">{i.qty} {i.unit}</Badge>
                    <Text fz="xs" c="slate.6" style={{ whiteSpace: 'nowrap' }}>× {rupiah(i.estPrice)}</Text>
                  </Stack>
                  <Box ta="right">
                    <Text fz={11} fw={600} c="slate.6">Jumlah</Text>
                    <Text fz="sm" fw={700} c="slate.9" style={{ whiteSpace: 'nowrap' }}>{rupiah(i.qty * i.estPrice)}</Text>
                  </Box>
                </Box>
              ))}
              <Group
                justify="space-between"
                px="lg"
                py="md"
                bg="primary.0"
                style={{ borderTop: '1px solid var(--mantine-color-primary-1)', borderRadius: '0 0 var(--mantine-radius-lg) var(--mantine-radius-lg)' }}
              >
                <Text fz="sm" fw={600} c="primary.9">Estimasi total</Text>
                <Text fz="lg" fw={700} c="primary.9">{rupiah(fpbjTotal(f))}</Text>
              </Group>
            </Card>
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 3.5 }}>
          <Stack gap="lg">
            <PurchaseFlow pb={pb} go={go} current={{ kind: 'fpbj', id: f.id }} />

          </Stack>
        </Grid.Col>
      </Grid>

      <ReasonModal
        opened={reason === 'return'}
        onClose={() => setReason(null)}
        title="Kembalikan permintaan"
        label="Catatan untuk peminta"
        confirmLabel="Kembalikan"
        onConfirm={sendBack}
      />
      <ReasonModal
        opened={reason === 'cancel'}
        onClose={() => setReason(null)}
        title="Batalkan permintaan"
        label="Alasan pembatalan"
        confirmLabel="Batalkan permintaan"
        onConfirm={cancelRequest}
      />
    </Stack>
  );
}

// Panduan langkah pengadaan per jalur: apa yang sudah beres dan apa yang berikutnya.
