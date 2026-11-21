// Pengaturan › Pajak & Biaya Perolehan.
//
// Dua kebijakan ini dikumpulkan di satu halaman karena keduanya menjawab
// pertanyaan yang sama: biaya mana yang menempel ke harga barang, dan mana yang
// langsung menjadi beban. Keduanya mengubah harga perolehan persediaan, jadi
// berlaku untuk dokumen berikutnya — dokumen yang sudah dibukukan tidak diubah.
import { Box, Card, Group, Radio, Stack, Text } from '@mantine/core';
import { PageIntro } from '@/components/common.jsx';
import { Calculator, Percent, Truck } from '@/components/Icon.jsx';
import { Callout, Section } from '@/pages/Pembelian/components.jsx';
import { accountLabel } from '@/pages/Gudang/journal.js';
import { useData } from '@/lib/store.jsx';
import { AKUN_ONGKIR, FREIGHT_POLICY, PKP_STATUS } from './settings.js';

function Choice({ checked, label, hint, onClick }) {
  return (
    <Card
      withBorder
      radius="md"
      padding="md"
      onClick={onClick}
      role="radio"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      style={{
        cursor: 'pointer',
        borderColor: checked ? 'var(--mantine-color-primary-9)' : undefined,
        backgroundColor: checked ? 'var(--mantine-color-primary-0)' : undefined,
      }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <Radio checked={checked} onChange={() => {}} size="sm" mt={2} />
        <Box>
          <Text fz="sm" fw={700} c="slate.9">
            {label}
          </Text>
          <Text fz="xs" c="slate.6">
            {hint}
          </Text>
        </Box>
      </Group>
    </Card>
  );
}

export default function PajakBiaya() {
  const { companySettings, setCompanySettings } = useData();
  const set = (patch) => setCompanySettings((s) => ({ ...s, ...patch }));

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro
        icon={Calculator}
        title="Pajak & Biaya Perolehan"
        description="Menentukan biaya mana yang menempel pada harga barang di persediaan, dan mana yang langsung menjadi beban. Perubahan hanya berlaku untuk dokumen berikutnya."
      />

      <Section
        icon={Percent}
        title="Status PKP"
        description="Menentukan apakah PPN pembelian bisa dikreditkan"
      >
        <Stack gap="sm">
          <Group grow align="stretch">
            {[PKP_STATUS.pkp, PKP_STATUS.nonPkp].map((o) => (
              <Choice
                key={String(o.value)}
                checked={companySettings.isPkp === o.value}
                label={o.label}
                hint={o.hint}
                onClick={() => set({ isPkp: o.value })}
              />
            ))}
          </Group>
          <Callout tone="info">
            Perusahaan PKP tetap bisa menandai satu penerimaan sebagai{' '}
            <b>PPN tidak dapat dikreditkan</b> — misalnya faktur pajak cacat. Untuk dokumen itu,
            PPN-nya ikut masuk harga barang.
          </Callout>
        </Stack>
      </Section>

      <Section
        icon={Truck}
        title="Ongkir pembelian barang"
        description="Perlakuan ongkir yang ditagih vendor pada pesanan barang"
      >
        <Stack gap="sm">
          <Group grow align="stretch">
            {[FREIGHT_POLICY.capitalize, FREIGHT_POLICY.expense].map((o) => (
              <Choice
                key={o.value}
                checked={companySettings.freightPolicy === o.value}
                label={o.label}
                hint={o.hint}
                onClick={() => set({ freightPolicy: o.value })}
              />
            ))}
          </Group>
          <Callout tone="info">
            Saat dibebankan langsung, ongkir masuk ke {accountLabel(AKUN_ONGKIR)}. Pesanan jasa
            (SPK) tidak terpengaruh karena tidak membentuk persediaan.
          </Callout>
        </Stack>
      </Section>
    </Stack>
  );
}
