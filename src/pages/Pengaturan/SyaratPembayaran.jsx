// Pengaturan → Transaksi & Dokumen → Syarat Pembayaran.
//
// Katalog termin bayar pembelian. Termin tidak lagi ditulis di kode: di sini satu termin
// dirakit dari beberapa saklar mekanis, dan mesin hitung pembelian membaca saklar itu.
// Lihat src/pages/Pembelian/paymentTerms.js untuk arti tiap saklar.
import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { Check, ClockCountdown, Eye, PencilSimple, Plus, Trash } from '@/components/Icon.jsx';
import NumberField from '@/components/NumberField.jsx';
import { Field, FormModal } from '@/components/common.jsx';
import { Callout, DataTable, EmptyState, RowMenu } from '@/pages/Pembelian/components.jsx';
import { periodOptions } from '@/pages/Pembelian/data.js';
import { DUE_FROM, dueFromLabel, termFields } from '@/pages/Pembelian/paymentTerms.js';
import { uid } from '@/pages/Pembelian/utils.js';
import { toast } from '@/pages/Pembelian/usePb.js';
import { useData } from '@/lib/store.jsx';

const SCOPE = [
  { value: 'barang', label: 'Barang (PO)' },
  { value: 'jasa', label: 'Jasa (SPK)' },
  { value: 'both', label: 'Barang & jasa' },
];
const ADVANCE = [
  { value: 'none', label: 'Tidak ada' },
  { value: 'partial', label: 'Sebagian (uang muka %)' },
  { value: 'full', label: 'Penuh (100% di muka)' },
];
const SPLIT = [
  { value: 'none', label: 'Sekali tagih' },
  { value: 'terms', label: 'Beberapa termin / milestone' },
  { value: 'periods', label: 'Berulang per periode' },
];

// Badge + keterangan kecil di bawahnya; dipakai kolom Pembayaran dan Tagihan.
function Mech({ label, detail, color }) {
  return (
    <Box>
      <Badge size="sm" radius="sm" variant="light" color={color} fw={700} tt="none">{label}</Badge>
      <Text fz={11} c="slate.6" mt={2}>{detail}</Text>
    </Box>
  );
}

const scopeLabel = (v) => SCOPE.find((o) => o.value === v)?.label ?? v;
const scopeShort = (v) => ({ barang: 'Barang', jasa: 'Jasa', both: 'Barang & jasa' }[v] ?? v);
const dueDaysOfDef = (t) => (t.due ? Math.max(t.defaults?.dueDays ?? 0, 0) : 0);

// Dua keterangan yang paling membedakan satu termin dari yang lain:
//   1. kapan uangnya keluar  — di muka (sebagian / penuh) atau di belakang
//   2. tagihannya dipecah bagaimana
// Sisanya (tenggat, retensi, titik hitung) ada di modal detail.
const payMode = (t) => {
  if (t.advance === 'full') return { label: 'Di muka', detail: 'penuh 100%', color: 'orange' };
  if (t.advance === 'partial') return { label: 'Di muka', detail: `sebagian · DP ${t.defaults?.dpPct ?? 0}%`, color: 'orange' };
  return { label: 'Di belakang', detail: 'setelah diterima', color: 'teal' };
};
const splitMode = (t) => {
  if (t.split === 'terms') return { label: `${t.defaults?.terms ?? 2} termin`, detail: 'per milestone', color: 'primary' };
  if (t.split === 'periods') return { label: `${t.defaults?.periods ?? 1} periode`, detail: 'berulang', color: 'grape' };
  return { label: 'Sekali tagih', detail: 'satu faktur', color: 'gray' };
};

const blank = () => ({
  id: uid('term'),
  label: '',
  hint: '',
  example: '',
  scope: 'jasa',
  advance: 'none',
  split: 'terms',
  dpOutOfSchedule: false,
  retention: false,
  due: true,
  dueFrom: 'receipt',
  defaults: { terms: 6, dueDays: 30 },
  active: true,
});

function TermModal({ opened, onClose, term, onSave }) {
  const [f, setF] = useState(() => term ?? blank());
  const set = (p) => setF((x) => ({ ...x, ...p }));
  const setDef = (p) => setF((x) => ({ ...x, defaults: { ...x.defaults, ...p } }));
  const fields = termFields(f);
  const invalid = !f.label.trim();
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={720}
      icon={ClockCountdown}
      title={term ? 'Ubah syarat pembayaran' : 'Syarat pembayaran baru'}
      subtitle="Rakit terminnya dari mekanisme di bawah"
      footer={
        <Group justify="flex-end" w="100%">
          <Button variant="default" radius="md" onClick={onClose}>Batal</Button>
          <Button radius="md" disabled={invalid} onClick={() => onSave(f)}>Simpan</Button>
        </Group>
      }
    >
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <TextInput label="Nama termin" withAsterisk size="sm" radius="md" placeholder="Contoh: Cicilan 6x" value={f.label} onChange={(e) => set({ label: e.currentTarget.value })} />
          <Select label="Berlaku untuk" size="sm" radius="md" allowDeselect={false} data={SCOPE} value={f.scope} onChange={(v) => set({ scope: v })} />
          <TextInput label="Keterangan singkat" size="sm" radius="md" placeholder="Contoh: Dibayar 6 kali, tiap bulan" value={f.hint} onChange={(e) => set({ hint: e.currentTarget.value })} />
          <TextInput label="Contoh pemakaian" size="sm" radius="md" placeholder="Contoh: Sewa alat berat" value={f.example} onChange={(e) => set({ example: e.currentTarget.value })} />
        </SimpleGrid>

        <Box>
          <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }} mb={6}>Mekanisme</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select label="Pembayaran di muka" size="sm" radius="md" allowDeselect={false} data={ADVANCE} value={f.advance} onChange={(v) => set({ advance: v })} />
            <Select label="Pemecahan tagihan" size="sm" radius="md" allowDeselect={false} data={SPLIT} value={f.split} onChange={(v) => set({ split: v })} />
          </SimpleGrid>
          {(
            <Stack gap={8} mt="sm">
              <Switch
                size="sm"
                label="Faktur punya tenggat pembayaran"
                description={
                  f.due
                    ? 'Vendor diberi waktu sekian hari sebelum harus dibayar.'
                    : 'Tanpa tenggat: faktur jatuh tempo pada hari penerimaan — harus dibayar hari itu juga.'
                }
                checked={f.due}
                onChange={(e) => set({ due: e.currentTarget.checked })}
              />
              {f.split === 'terms' && (
                <Switch size="sm" label="Tahan sebagian sampai masa pemeliharaan selesai (retensi)" checked={!!f.retention} onChange={(e) => set({ retention: e.currentTarget.checked })} />
              )}
              {f.advance === 'partial' && f.split === 'terms' && (
                <Switch
                  size="sm"
                  label="Uang muka dikeluarkan dari nilai yang dibagi ke termin"
                  description="Nyalakan kalau termin dihitung dari sisa setelah uang muka. Kalau mati, tiap termin dipotong uang muka saat difaktur."
                  checked={!!f.dpOutOfSchedule}
                  onChange={(e) => set({ dpOutOfSchedule: e.currentTarget.checked })}
                />
              )}
            </Stack>
          )}
        </Box>

        {f.advance !== 'full' && (
          <Select
            label="Jatuh tempo dihitung dari"
            size="sm"
            radius="md"
            allowDeselect={false}
            data={DUE_FROM}
            value={f.dueFrom ?? 'receipt'}
            onChange={(v) => set({ dueFrom: v })}
            description={'"30 hari sejak barang diterima" dan "30 hari sejak faktur vendor" adalah dua kesepakatan berbeda.'}
          />
        )}

        {fields.length > 0 && (
          <Box>
            <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }} mb={6}>Nilai awal di form penawaran</Text>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
              {fields.includes('dp') && <NumberField label="Uang muka (%)" size="sm" radius="md" min={1} max={99} clampBehavior="strict" value={f.defaults?.dpPct ?? 30} onChange={(v) => setDef({ dpPct: Number(v) || 0 })} />}
              {fields.includes('terms') && <NumberField label="Jumlah termin" size="sm" radius="md" min={2} max={24} clampBehavior="strict" value={f.defaults?.terms ?? 2} onChange={(v) => setDef({ terms: Number(v) || 0 })} />}
              {fields.includes('due') && (
                <NumberField
                  label="Tenggat (hari)"
                  size="sm"
                  radius="md"
                  min={0}
                  max={180}
                  clampBehavior="strict"
                  value={f.defaults?.dueDays ?? 30}
                  onChange={(v) => setDef({ dueDays: Number(v) || 0 })}
                />
              )}
              {fields.includes('retention') && (
                <Box style={{ gridColumn: 'span 2' }}>
                  <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
                    <NumberField label="Retensi (%)" size="sm" radius="md" min={1} max={20} clampBehavior="strict" value={f.defaults?.retentionPct ?? 5} onChange={(v) => setDef({ retentionPct: Number(v) || 0 })} />
                    <NumberField label="Masa pemeliharaan (bulan)" size="sm" radius="md" min={1} max={36} clampBehavior="strict" value={f.defaults?.retentionMonths ?? 3} onChange={(v) => setDef({ retentionMonths: Number(v) || 0 })} />
                  </SimpleGrid>
                </Box>
              )}
              {fields.includes('period') && (
                <Box style={{ gridColumn: 'span 2' }}>
                  <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
                    <Select label="Periode" size="sm" radius="md" allowDeselect={false} data={periodOptions} value={f.defaults?.period ?? 'bulan'} onChange={(v) => setDef({ period: v })} />
                    <NumberField label="Jumlah periode" size="sm" radius="md" min={1} max={60} clampBehavior="strict" value={f.defaults?.periods ?? 12} onChange={(v) => setDef({ periods: Number(v) || 0 })} />
                  </SimpleGrid>
                </Box>
              )}
            </SimpleGrid>
            <Stack gap={2} mt={8}>
              {fields.includes('due') && (
                <Text fz="xs" c="slate.6">
                  Tenggat <strong>0 hari</strong> berarti jatuh tempo pada tanggal {dueFromLabel(f.dueFrom)} itu sendiri — harus
                  dibayar hari itu juga.
                </Text>
              )}
              <Text fz="xs" c="slate.6">
                Nilai di atas hanya mengisi form penawaran saat termin dipilih. Accounting tetap bisa mengubahnya per penawaran.
              </Text>
            </Stack>
          </Box>
        )}
      </Stack>
    </FormModal>
  );
}

// Urutan tagihan yang terbentuk dari satu definisi termin. Dipakai di modal detail sebagai
// "alur pembayaran": kombinasi saklar mekanis susah dibayangkan, jadi ditunjukkan langsung
// sebagai rangkaian tagihan yang akan terbit.
function flowSteps(t) {
  const d = t.defaults ?? {};
  const dp = t.advance === 'full' ? 100 : t.advance === 'partial' ? (d.dpPct ?? 0) : 0;
  const ret = t.retention ? (d.retentionPct ?? 0) : 0;
  const out = [];
  if (dp > 0) {
    out.push({ key: 'dp', label: dp >= 100 ? 'Bayar penuh' : `Uang muka ${dp}%`, sub: 'sebelum diterima', color: 'orange' });
  }
  if (dp < 100) {
    // Kalau uang muka dikeluarkan dari jadwal, termin membagi sisanya. Kalau tidak, termin
    // membagi nilai penuh dan uang mukanya dipotong proporsional saat difaktur.
    const base = t.dpOutOfSchedule ? 100 - dp - ret : 100 - ret;
    if (t.split === 'terms') {
      const n = Math.max(d.terms ?? 2, 1);
      const share = Math.round((base / n) * 10) / 10;
      for (let i = 0; i < Math.min(n, 4); i += 1) {
        out.push({ key: `t${i}`, label: `Termin ${i + 1}`, sub: `${share}% dari nilai`, color: 'primary' });
      }
      if (n > 4) out.push({ key: 'more', label: `+${n - 4} termin`, sub: `masing-masing ${share}%`, color: 'primary', muted: true });
    } else if (t.split === 'periods') {
      const n = Math.max(d.periods ?? 1, 1);
      const unit = periodOptions.find((o) => o.value === d.period)?.label ?? 'periode';
      const share = Math.round((base / n) * 10) / 10;
      for (let i = 0; i < Math.min(n, 3); i += 1) {
        out.push({ key: `p${i}`, label: `${unit} ${i + 1}`, sub: `${share}% dari nilai`, color: 'grape' });
      }
      if (n > 3) out.push({ key: 'more', label: `+${n - 3} periode`, sub: `masing-masing ${share}%`, color: 'grape', muted: true });
    } else {
      out.push({ key: 'rest', label: dp > 0 ? 'Pelunasan' : 'Tagihan penuh', sub: `${base}% dari nilai`, color: 'teal' });
    }
  }
  if (ret > 0) {
    out.push({ key: 'ret', label: `Retensi ${ret}%`, sub: `cair ${t.defaults?.retentionMonths ?? 0} bln setelah selesai`, color: 'slate' });
  }
  return out;
}

// Satu langkah pada alur pembayaran.
function FlowStep({ label, sub, color, muted }) {
  return (
    <Box
      p="sm"
      style={{
        minWidth: 132,
        flex: '1 1 132px',
        borderRadius: 'var(--mantine-radius-md)',
        border: `1px solid var(--mantine-color-${muted ? 'gray-3' : `${color}-2`})`,
        background: muted ? 'var(--mantine-color-gray-0)' : `var(--mantine-color-${color}-0)`,
      }}
    >
      <Text fz="sm" fw={700} c={muted ? 'slate.6' : `${color}.9`} lh={1.3}>{label}</Text>
      <Text fz={11} c="slate.6" lh={1.3} mt={2}>{sub}</Text>
    </Box>
  );
}

// Detail satu syarat pembayaran. Semua yang bisa diisi di form tambah/ubah muncul di sini,
// dengan urutan yang sama, supaya yang dibaca ketemu di tempat yang sama saat diubah.
function DetailModal({ opened, onClose, term: t, usage, onEdit }) {
  if (!t) return null;
  const hari = dueDaysOfDef(t);
  const steps = flowSteps(t);
  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      size={720}
      icon={ClockCountdown}
      title={t.label}
      subtitle={[scopeLabel(t.scope), t.active === false ? 'nonaktif' : 'aktif'].join(' · ')}
      footer={
        <Group justify="flex-end" w="100%">
          <Button variant="default" radius="md" onClick={onClose}>Tutup</Button>
          <Button radius="md" leftSection={<PencilSimple size={16} />} onClick={onEdit}>Ubah</Button>
        </Group>
      }
    >
      <Stack gap="lg">
        {/* Alur pembayaran jadi satu-satunya tempat mekanisme dijelaskan. Dulu hal yang sama
            diulang di ringkasan kotak, grid Mekanisme, dan grid Nilai awal — tiga kali. */}
        <Box>
          <Group justify="space-between" align="baseline" mb={8}>
            <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }}>Alur pembayaran</Text>
            <Text fz={11} c="slate.6">{steps.length} tagihan per item</Text>
          </Group>
          <Group gap="xs" align="stretch" wrap="wrap">
            {steps.map((st) => <FlowStep key={st.key} {...st} />)}
          </Group>
        </Box>

        {/* Yang tidak terlihat dari alur di atas. Tiap keterangan hanya muncul kalau berlaku. */}
        <Box>
          <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }} mb={6}>Ketentuan</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Field label="Tenggat pembayaran">
              {hari > 0 ? `${hari} hari sejak ${dueFromLabel(t.dueFrom)}` : `Tanpa tenggat — jatuh tempo pada tanggal ${dueFromLabel(t.dueFrom)}`}
            </Field>
            {t.advance === 'partial' && t.split === 'terms' && (
              <Field label="Perlakuan uang muka">
                {t.dpOutOfSchedule ? 'Di luar termin — termin membagi sisa, faktur tidak dipotong lagi' : 'Di dalam termin — tiap faktur dipotong uang muka proporsional'}
              </Field>
            )}
            {t.retention && (
              <Field label="Retensi">{t.defaults?.retentionPct ?? 0}% ditahan {t.defaults?.retentionMonths ?? 0} bulan setelah serah terima</Field>
            )}
          </SimpleGrid>
        </Box>

        <Box>
          <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }} mb={6}>Identitas</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Field label="Berlaku untuk">{scopeLabel(t.scope)}</Field>
            <Field label="Status">{t.active === false ? 'Nonaktif — tidak muncul di penawaran baru' : 'Aktif'}</Field>
            <Field label="Keterangan singkat">{t.hint || '—'}</Field>
            <Field label="Contoh pemakaian">{t.example || '—'}</Field>
          </SimpleGrid>
        </Box>

        <Callout tone={usage > 0 ? 'warn' : undefined} title={usage > 0 ? `Dipakai ${usage} dokumen` : 'Belum dipakai dokumen mana pun'}>
          {usage > 0
            ? 'Dokumen yang sudah terbit membawa salinan mekanismenya sendiri, jadi perubahan di sini tidak mengubahnya. Termin ini tidak bisa dihapus — nonaktifkan saja bila sudah tidak dipakai.'
            : 'Termin ini aman dihapus. Setelah dihapus ia hilang dari pilihan termin pada penawaran berikutnya.'}
        </Callout>
      </Stack>
    </FormModal>
  );
}

export default function SyaratPembayaran() {
  const { pb, setPb } = useData();
  const terms = pb.paymentTerms ?? [];
  const [edit, setEdit] = useState(null); // definisi yang sedang dibuka, atau 'baru'
  const [del, setDel] = useState(null);
  const [view, setView] = useState(null);

  const write = (fn) => setPb((d) => ({ ...d, paymentTerms: fn(d.paymentTerms ?? []) }));
  const save = (t) => {
    write((list) => (list.some((x) => x.id === t.id) ? list.map((x) => (x.id === t.id ? t : x)) : [...list, t]));
    setEdit(null);
    toast(terms.some((x) => x.id === t.id) ? 'Syarat pembayaran diperbarui.' : 'Syarat pembayaran ditambahkan.');
  };
  const toggle = (id) => write((list) => list.map((x) => (x.id === id ? { ...x, active: x.active === false } : x)));
  const remove = (id) => {
    write((list) => list.filter((x) => x.id !== id));
    setDel(null);
    toast('Syarat pembayaran dihapus.');
  };

  // Termin yang sudah dipakai dokumen tidak boleh hilang begitu saja.
  const usage = (id) =>
    pb.fppbj.reduce((n, f) => n + f.quotes.filter((q) => q.term?.type === id).length, 0) +
    pb.pos.filter((p) => p.term?.type === id).length;

  return (
    <Stack gap="lg" p="lg" maw={1200} mx="auto">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <Box>
          <Title order={2} fz={{ base: 20, md: 24 }} c="slate.9">Syarat Pembayaran</Title>
          <Text fz="sm" c="slate.6">
            Pilihan termin bayar yang muncul saat Accounting mengunggah penawaran vendor.
          </Text>
        </Box>
        <Button radius="md" leftSection={<Plus size={16} />} onClick={() => setEdit('baru')}>Tambah syarat</Button>
      </Group>

      <Callout>
        Daftar di bawah hanya isi awal, bukan termin bawaan — semuanya bisa diubah, dinonaktifkan, dan dihapus selama
        belum dipakai dokumen. Termin disimpan bersama penawaran beserta salinan mekanismenya, jadi mengubah atau
        menonaktifkan termin tidak mengubah dokumen yang sudah terbit; yang berubah hanya pilihan untuk penawaran
        berikutnya.
      </Callout>

      <Card withBorder radius="lg" padding={0} bg="white">
        {terms.length === 0 ? (
          <Box p="lg"><EmptyState
              icon={ClockCountdown}
              title="Belum ada syarat pembayaran"
              text="Rakit sendiri termin bayar yang dipakai gedung Anda — misalnya CAD, DP 30%, atau cicilan 6x. Tanpa ini penawaran vendor belum bisa disimpan."
              actions={[<Button key="n" size="xs" radius="md" leftSection={<Plus size={14} />} onClick={() => setEdit('baru')}>Tambah syarat pertama</Button>]}
            /></Box>
        ) : (
          <DataTable
            bare
            minWidth={760}
            head={[
              { label: 'Nama termin' },
              { label: 'Berlaku untuk', w: 130 },
              { label: 'Pembayaran', w: 170 },
              { label: 'Tagihan', w: 150 },
              { label: 'Status', w: 120 },
              { label: 'Aksi', align: 'right', w: 70 },
            ]}
          >
            {terms.map((t) => {
              const n = usage(t.id);
              return (
                <Table.Tr key={t.id}>
                  <Table.Td>
                    <Group gap={6} wrap="wrap">
                      <Text fz="sm" fw={600} c="slate.9">{t.label}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" radius="sm" variant="light" color="gray" c="slate.7" tt="none">{scopeShort(t.scope)}</Badge>
                  </Table.Td>
                  <Table.Td><Mech {...payMode(t)} /></Table.Td>
                  <Table.Td><Mech {...splitMode(t)} /></Table.Td>
                  <Table.Td>
                    <Switch
                      size="xs"
                      checked={t.active !== false}
                      onChange={() => toggle(t.id)}
                      aria-label={`Aktifkan ${t.label}`}
                      label={<Text fz={11} c="slate.6">{t.active === false ? 'Nonaktif' : 'Aktif'}</Text>}
                    />
                  </Table.Td>
                  <Table.Td ta="right">
                    <RowMenu
                      label={t.label}
                      items={[
                        { label: 'Lihat detail', icon: Eye, onClick: () => setView(t) },
                        { label: 'Ubah', icon: PencilSimple, onClick: () => setEdit(t) },
                        // Yang sudah dipakai dokumen tidak bisa dihapus; menunya disembunyikan
                        // daripada ditampilkan mati tanpa penjelasan.
                        n === 0 && { label: 'Hapus', icon: Trash, color: 'red', onClick: () => setDel(t) },
                      ]}
                    />
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </DataTable>
        )}
      </Card>

      <Text fz="xs" c="slate.6">
        Tabel memuat yang pokok saja; rinciannya ada di <strong>Lihat detail</strong> pada menu aksi. Termin yang sudah
        dipakai dokumen tidak bisa dihapus — nonaktifkan saja, ia hilang dari pilihan penawaran baru tanpa mengganggu
        dokumen lama.
      </Text>

      <DetailModal
        key={view?.id}
        opened={view !== null}
        onClose={() => setView(null)}
        term={view}
        usage={view ? usage(view.id) : 0}
        onEdit={() => { const t = view; setView(null); setEdit(t); }}
      />
      {edit && (
        <TermModal
          key={edit === 'baru' ? 'baru' : edit.id}
          opened
          onClose={() => setEdit(null)}
          term={edit === 'baru' ? null : edit}
          onSave={save}
        />
      )}
      <FormModal
        opened={del !== null}
        onClose={() => setDel(null)}
        size={460}
        icon={Trash}
        title="Hapus syarat pembayaran?"
        subtitle={del?.label}
        footer={
          <Group justify="flex-end" w="100%">
            <Button variant="default" radius="md" onClick={() => setDel(null)}>Batal</Button>
            <Button radius="md" color="red" leftSection={<Check size={16} />} onClick={() => remove(del.id)}>Hapus</Button>
          </Group>
        }
      >
        <Text fz="sm" c="slate.7">
          Termin ini belum dipakai dokumen mana pun, jadi aman dihapus. Ia akan hilang dari pilihan termin bayar
          pada penawaran vendor berikutnya.
        </Text>
      </FormModal>
    </Stack>
  );
}
