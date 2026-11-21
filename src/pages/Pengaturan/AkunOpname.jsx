// Pengaturan › Akuntansi › Akun Selisih Opname.
//
// Satu baris per alasan selisih. Pemisahan ini yang membuat auditor bisa
// membedakan susut wajar (beban operasional) dari kehilangan (beban lain-lain)
// dan dari koreksi pencatatan. Satu akun untuk semuanya menyembunyikan
// kehilangan di antara susut biasa.
import { Box, Select, Stack, Table, Text } from '@mantine/core';
import { PageIntro } from '@/components/common.jsx';
import { ListChecks } from '@/components/Icon.jsx';
import { Callout, DataTable, Section } from '@/pages/Pembelian/components.jsx';
import { accounts } from '@/pages/DaftarAkun/accounts.js';
import { OPNAME_REASON, defaultOpnameAccounts } from '@/pages/Gudang/opname.js';
import { useData } from '@/lib/store.jsx';
import { OPNAME_ACCOUNT_CATEGORIES } from './settings.js';

const ARAH = { loss: 'Selisih kurang', gain: 'Selisih lebih', both: 'Kurang / lebih' };

// Akun induk hanya pengelompokan di laporan; yang boleh dijurnal adalah akun
// paling bawah. Induk dikenali dari kode yang dipakai sebagai parent akun lain.
const PARENT_CODES = new Set(accounts.map((a) => a.parent).filter(Boolean));
const isPostable = (a) => !PARENT_CODES.has(a.code);

export default function AkunOpname() {
  const { companySettings, setCompanySettings } = useData();
  const map = { ...defaultOpnameAccounts, ...(companySettings.opnameAccounts ?? {}) };

  // Pilihan dibatasi per arah selisih: akun Pendapatan tidak masuk akal untuk
  // barang yang hilang, dan sebaliknya.
  const pilihanUntuk = (dir) =>
    accounts
      .filter(isPostable)
      .filter((a) => OPNAME_ACCOUNT_CATEGORIES[dir].includes(a.category))
      .map((a) => ({ value: a.code, label: `${a.code} · ${a.name}` }));

  const set = (reason, code) =>
    setCompanySettings((s) => ({
      ...s,
      opnameAccounts: { ...defaultOpnameAccounts, ...(s.opnameAccounts ?? {}), [reason]: code },
    }));

  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <PageIntro
        icon={ListChecks}
        title="Akun Selisih Opname"
        description="Menentukan akun mana yang dipakai saat selisih stok opname diposting. Akun dikunci ke dokumen saat posting, jadi perubahan di sini tidak mengubah opname yang sudah terbit."
      />

      <Section
        divided
        flush
        icon={ListChecks}
        title="Akun per alasan selisih"
        description="Hanya akun Beban, Beban Lainnya, dan Pendapatan Lainnya yang bisa dipilih"
      >
        <DataTable
          bare
          head={[
            { label: 'Alasan selisih' },
            { label: 'Arah' },
            { label: 'Akun', w: 420 },
          ]}
          minWidth={760}
        >
          {Object.entries(OPNAME_REASON).map(([key, r]) => (
            <Table.Tr key={key}>
              <Table.Td>
                <Text fz="sm" fw={600} c="slate.9">
                  {r.label}
                </Text>
                {map[key] !== defaultOpnameAccounts[key] && (
                  <Text fz={11} c="slate.6">
                    Diubah dari bawaan {defaultOpnameAccounts[key]}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Text fz="sm" c="slate.7">
                  {ARAH[r.dir]}
                </Text>
              </Table.Td>
              <Table.Td>
                <Select
                  size="xs"
                  radius="md"
                  searchable
                  allowDeselect={false}
                  data={pilihanUntuk(r.dir)}
                  value={map[key] ?? null}
                  onChange={(v) => v && set(key, v)}
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </DataTable>
      </Section>

      <Box>
        <Callout tone="info" title="Kenapa dipisah">
          Rusak dan kedaluwarsa adalah susut wajar dari kegiatan operasional, jadi masuk beban
          operasional. Kehilangan tidak wajar dan harus terlihat terpisah supaya bisa
          ditindaklanjuti. Salah catat, Ditemukan, dan Lainnya adalah koreksi pencatatan, bukan
          kejadian fisik. Yang bisa dipilih hanya akun paling bawah — akun induk seperti
          6-10000 Beban Operasional tidak boleh dijurnal langsung.
        </Callout>
      </Box>
    </Stack>
  );
}
