// Halaman Jurnal Transaksi satu mutasi stok.
//
// Jurnalnya tidak disimpan — dibentuk ulang dari mutasinya setiap kali dibaca
// (lihat journal.js), jadi halaman ini selalu memperlihatkan keadaan terbaru.
// Bentuknya mengikuti Jurnal Transaksi di modul Pembelian.
import {
  Badge,
  Box,
  Card,
  Grid,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { Calculator, ClipboardText, Info } from '@/components/Icon.jsx';
import {
  BackLink,
  CardHead,
  CopyIcon,
  DataTable,
  DocNumber,
  Section,
  StatusPill,
} from '@/pages/Pembelian/components.jsx';
import { formatDate } from '@/pages/Pembelian/utils.js';
import { rupiah } from '@/pages/Penjualan/utils.js';
import { unitName } from '@/pages/Produk/catalog.js';
import { MOVE_TYPE, costBreakdownLabel } from './stock.js';
import { accountLabel, moveJournal } from './journal.js';

const number = new Intl.NumberFormat('id-ID');

// Satu angka ringkasan di pita atas.
function StatBox({ label, value, hint, color = 'slate.9', dot }) {
  return (
    <Box px="lg" py="md" style={{ minWidth: 0 }}>
      <Text fz={11} fw={600} c="slate.6">
        {label}
      </Text>
      <Group gap={6} wrap="nowrap" align="center" mt={2}>
        {dot && (
          <Box
            w={7}
            h={7}
            style={{ borderRadius: '50%', background: `var(--mantine-color-${dot})`, flexShrink: 0 }}
          />
        )}
        <Text fz={20} fw={700} c={color} lh={1.2} style={{ whiteSpace: 'nowrap' }}>
          {value}
        </Text>
      </Group>
      <Text fz={11} c="slate.6" mt={2}>
        {hint}
      </Text>
    </Box>
  );
}

function InfoCell({ label, value, divider }) {
  return (
    <Box
      px="lg"
      py="md"
      style={{
        minWidth: 0,
        borderLeft: divider ? '1px solid var(--mantine-color-gray-2)' : undefined,
      }}
    >
      <Text fz={11} fw={600} c="slate.6">
        {label}
      </Text>
      <Box fz="sm" fw={600} c="slate.9" mt={2} style={{ overflowWrap: 'anywhere' }}>
        {value ?? '—'}
      </Box>
    </Box>
  );
}

export default function MoveJournal({ move, data, onBack, onOpenSource, onOpenCard }) {
  const product = data.products.find((p) => p.id === move.productId);
  const warehouse = data.warehouses.find((w) => w.id === move.warehouseId);
  const jurnal = moveJournal(move, product, move.amount, { residual: move.residual });
  const debit = jurnal.reduce((n, l) => n + l.debit, 0);
  const credit = jurnal.reduce((n, l) => n + l.credit, 0);
  const selisih = debit - credit;
  const masuk = move.qtyIn > 0;
  const qty = masuk ? move.qtyIn : move.qtyOut;
  const satuan = unitName(data.units, product?.baseUnitId ?? product?.buyUnitId);

  const audit = [
    ['Tanggal transaksi', formatDate(move.date)],
    [
      'Dokumen sumber',
      <DocNumber key="src" onClick={() => onOpenSource?.(move)}>
        {move.sourceNo}
      </DocNumber>,
    ],
    ['Jenis mutasi', <StatusPill key="t" map={MOVE_TYPE} status={move.type} />],
    [
      'Produk',
      <DocNumber key="p" onClick={() => onOpenCard?.(move.productId, move.warehouseId)}>
        {product?.name ?? move.productId}
      </DocNumber>,
    ],
    ['Gudang', warehouse?.name ?? move.warehouseId],
    ['Qty', `${masuk ? '+' : '−'}${number.format(qty)} ${satuan}`],
    [
      'Harga satuan',
      <Box key="hs">
        {rupiah(Math.round(move.unit ?? move.unitCost ?? 0))}
        {costBreakdownLabel(move, rupiah) && (
          <Text fz={11} fw={500} c="slate.6">
            {costBreakdownLabel(move, rupiah)}
          </Text>
        )}
      </Box>,
    ],
    ['Dibukukan oleh', move.createdBy || '—'],
    [
      'ID sistem',
      <Group key="id" gap={6} wrap="nowrap">
        <Text fz="sm" fw={700} c="slate.9" ff="monospace">
          {move.id}
        </Text>
        <CopyIcon value={move.id} size={14} />
      </Group>,
    ],
  ];

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <BackLink label="Kembali ke riwayat mutasi" onClick={onBack} />

      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon size={52} radius="md" color="primary.9">
            <Calculator size={26} />
          </ThemeIcon>
          <Box style={{ minWidth: 0 }}>
            <Group gap="xs" wrap="wrap">
              <Title order={2} fz={{ base: 20, md: 24 }} c="slate.9">
                Jurnal Transaksi
              </Title>
              <Badge size="sm" radius="sm" variant="light" color="primary" fw={700} tt="none">
                {MOVE_TYPE[move.type].label}
              </Badge>
              {move.reversalOfId && (
                <Badge size="sm" radius="sm" variant="light" color="red" fw={700} tt="none">
                  Pembatalan
                </Badge>
              )}
            </Group>
            <Text fz="sm" c="slate.6">
              {formatDate(move.date)} · {move.sourceNo}
            </Text>
          </Box>
        </Group>
      </Card>

      <Card withBorder radius="lg" padding={0} bg="white">
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing={0}>
          {[
            <StatBox key="d" label="Total debit" value={rupiah(debit)} hint="Jumlah seluruh sisi debit" />,
            <StatBox key="k" label="Total kredit" value={rupiah(credit)} hint="Jumlah seluruh sisi kredit" />,
            <StatBox
              key="s"
              label="Selisih keseimbangan"
              value={selisih === 0 ? 'Seimbang' : rupiah(Math.abs(selisih))}
              hint={selisih === 0 ? 'Debit dan kredit sama' : 'Debit dan kredit belum sama'}
              color={selisih === 0 ? 'slate.9' : 'red.7'}
              dot={selisih === 0 ? 'green-6' : 'red-6'}
            />,
            <StatBox
              key="p"
              label="Rincian pos jurnal"
              value={`${jurnal.length} pos akun`}
              hint="Debit dan kredit per akun"
            />,
          ].map((el, i) => (
            <Box key={el.key} style={{ borderLeft: i ? '1px solid var(--mantine-color-gray-2)' : undefined }}>
              {el}
            </Box>
          ))}
        </SimpleGrid>
      </Card>

      <Grid gutter="lg" align="flex-start">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Section
            divided
            flush
            icon={ClipboardText}
            title="Rincian pos jurnal"
            description="Akun yang terlibat dan nominal tiap sisi"
          >
            {/* Lajur yang tidak terpakai dibiarkan "—", bukan Rp 0 — di jurnal, nol
                berarti sesuatu yang lain daripada tidak ada nilai. */}
            <DataTable
              bare
              head={[
                { label: 'Akun perkiraan (COA)' },
                { label: 'Debit', align: 'right' },
                { label: 'Kredit', align: 'right' },
              ]}
              minWidth={620}
            >
              {jurnal.map((l, i) => (
                <Table.Tr key={`${l.account}-${i}`}>
                  <Table.Td>
                    <Text fz="sm" fw={600} c="primary.9">
                      {accountLabel(l.account)}
                    </Text>
                    <Text fz={11} c="slate.6">
                      {l.debit ? 'Sisi debit' : 'Sisi kredit'}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fz="sm" fw={l.debit ? 700 : 400} c={l.debit ? 'slate.9' : 'slate.5'}>
                      {l.debit ? rupiah(l.debit) : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fz="sm" fw={l.credit ? 700 : 400} c={l.credit ? 'slate.9' : 'slate.5'}>
                      {l.credit ? rupiah(l.credit) : '—'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
              <Table.Tr bg="slate.0">
                <Table.Td>
                  <Text fz="xs" fw={700} c="slate.7" tt="uppercase">
                    Total
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text fz="sm" fw={700} c="slate.9">
                    {rupiah(debit)}
                  </Text>
                </Table.Td>
                <Table.Td ta="right">
                  <Text fz="sm" fw={700} c="slate.9">
                    {rupiah(credit)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            </DataTable>
          </Section>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card withBorder radius="lg" padding={0} bg="white">
            <Box px="lg" py="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
              <CardHead icon={Info} desc="Asal angka dan jejak pembukuannya">
                Informasi transaksi
              </CardHead>
            </Box>
            {audit.map(([label, value], i) => (
              <Box
                key={label}
                style={i ? { borderTop: '1px solid var(--mantine-color-gray-2)' } : undefined}
              >
                <InfoCell label={label} value={value} />
              </Box>
            ))}
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
