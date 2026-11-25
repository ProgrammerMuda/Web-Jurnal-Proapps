// Potongan tampilan yang dipakai bersama laporan keuangan (Neraca, Laba Rugi): format angka,
// sel angka tabel laporan, kartu statistik & rasio, dan tabel mutasi jurnal di modal rincian akun.
import { Anchor, Badge, Box, Group, Stack, Table, Text } from '@mantine/core';
import { formatDate, rupiah, rupiahShort } from '@/pages/Penjualan/utils.js';

export const iso = (d) => d.toISOString().slice(0, 10);

// Tautan ke halaman detail akun (Daftar Akun), membawa periode laporan bila ada.
export const accountHref = (code, range) => `#daftar-akun/${encodeURIComponent(code)}${range ? `?from=${range[0]}&to=${range[1]}` : ''}`;

// Nama akun berwarna biru seperti di Daftar Akun; diklik membuka detail akun.
export function AccountLink({ code, range, children, fz = 'sm', fw = 500 }) {
  return (
    <Anchor href={accountHref(code, range)} fz={fz} fw={fw} c="primary.9" underline="hover" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'left' }}>
      {children}
    </Anchor>
  );
}
export const MODULE_COLOR = { Penjualan: 'green', Pembelian: 'primary', Gudang: 'orange' };
export const money = (n) => (Math.round(n) < 0 ? `(${rupiah(-n)})` : rupiah(n));

// Angka laporan: tanpa "Rp", minus dalam kurung, nol ditulis "-" seperti kertas kerja.
const fmt = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = (n) => {
  if (n == null) return '';
  const r = Math.round(n);
  if (r === 0) return '-';
  return r < 0 ? `(${fmt.format(-n)})` : fmt.format(n);
};
// Persen rasio; negatif dalam kurung seperti angka rupiah: (667%).
export const pct = (n) => { const v = Math.round(n * 100); return v < 0 ? `(${-v}%)` : `${v}%`; };
export const times = (n) => `${n.toLocaleString('id-ID', { maximumFractionDigits: 1 })}×`;

// Dipakai modal rincian akun (dengan "Rp").
export function Amount({ value, fw = 500, fz = 'sm' }) {
  const neg = Math.round(value) < 0;
  return (
    <Text fz={fz} fw={fw} c={neg ? 'red.8' : 'slate.9'} ta="right" style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
      {money(value)}
    </Text>
  );
}

const cellNum = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'right' };

// Sel angka satu baris laporan: nilai periode, lalu (bila ada pembanding) nilai pembanding,
// perubahan, dan persennya.
export function NumCells({ a, b, compare, fw = 500, c }) {
  const diff = compare && b != null ? a - b : null;
  const ratio = compare && b ? diff / Math.abs(b) : null;
  const tone = (v) => c ?? (Math.round(v ?? 0) < 0 ? 'red.8' : 'slate.9');
  return (
    <>
      <Table.Td style={cellNum}><Text span fz="sm" fw={fw} c={tone(a)}>{num(a)}</Text></Table.Td>
      {compare && (
        <>
          <Table.Td style={cellNum}><Text span fz="sm" fw={fw} c={tone(b)}>{num(b)}</Text></Table.Td>
          <Table.Td style={cellNum}><Text span fz="sm" fw={fw} c="slate.7">{num(diff)}</Text></Table.Td>
          <Table.Td style={cellNum}><Text span fz="xs" c="slate.6">{ratio == null ? '' : `${ratio > 0 ? '+' : ''}${Math.round(ratio * 100)}%`}</Text></Table.Td>
        </>
      )}
    </>
  );
}

// Label kelompok & total mulai dari tepi kiri (melintasi kolom kode). Di ponsel kolom kode
// disembunyikan, jadi labelnya cukup satu kolom supaya angka tetap di kolomnya.
export function LeadCell({ phone, children }) {
  return phone ? <><Table.Td className="bs-code" /><Table.Td>{children}</Table.Td></> : <Table.Td colSpan={2}>{children}</Table.Td>;
}

// Angka singkat (Rp 36,8 jt) dengan aturan yang sama seperti angka penuh: minus ditulis dalam kurung.
export const moneyShort = (n) => (Math.round(n) < 0 ? `(${rupiahShort(-n)})` : rupiahShort(n));
const shortOrDash = (v) => (Math.round(v) === 0 ? '–' : moneyShort(v));

// Satu sel statistik: label, angka besar, kalimat perubahan, lalu rincian label-angka.
export function Stat({ label, value, negative, tone, delta, parts }) {
  return (
    <Box className="bs-stat">
      <Text fz="sm" c="slate.6">{label}</Text>
      <Text fz={24} fw={700} lh="32px" mt={2} c={tone ?? (negative ? 'red.8' : 'slate.9')} className="bs-figure">
        {value}
      </Text>
      <Text fz="xs" c="slate.6" mih={16}>{delta ?? ''}</Text>
      {parts?.length > 0 && <Stack gap={4} mt="sm" pt="sm" className="bs-parts">
        {parts.map(([l, v]) => (
          <Group key={l} justify="space-between" gap="sm" wrap="nowrap">
            <Text fz="sm" c="slate.6" truncate>{l}</Text>
            {typeof v === 'number'
              ? <Text fz="sm" c={Math.round(v) < 0 ? 'red.8' : 'slate.9'} className="bs-figure">{shortOrDash(v)}</Text>
              : <Text fz="sm" c="slate.9" className="bs-figure">{v}</Text>}
          </Group>
        ))}
      </Stack>}
    </Box>
  );
}

export function Ratio({ label, value, note }) {
  return (
    <Box className="bs-stat">
      <Group justify="space-between" gap="sm" wrap="nowrap" align="baseline">
        <Text fz="sm" c="slate.8">{label}</Text>
        <Text fz="md" fw={700} c="slate.9" className="bs-figure">{value}</Text>
      </Group>
      <Text fz="xs" c="slate.6" mt={2}>{note}</Text>
    </Box>
  );
}

// Tabel mutasi jurnal satu akun (hasil accountMutations). `onOpen` menerima href dokumen sumber.
// `footer` (opsional) ditampilkan sebagai baris total di bawah; `opening` (opsional) sebagai
// baris saldo awal di atas: { label, saldo }.
// Halaman detail satu jurnal (ditentukan buku besar, lihat journalPage di ledger.js).
export const journalHref = (entry) => entry.journalHref;
const goJournal = (entry) => {
  window.location.hash = journalHref(entry).slice(1);
  window.scrollTo({ top: 0 });
};

// Daftar jurnal yang menyentuh satu akun, dengan saldo berjalan. Tiap baris adalah satu jurnal:
// nomornya membuka detail jurnal, dan di bawahnya tertulis dari transaksi mana jurnal itu dibuat.
// `onOpen` (opsional) dipanggil sebelum pindah halaman, mis. untuk menutup jendela.
export function MutationTable({ rows, onOpen, footer, opening, emptyText }) {
  const open = (e) => { onOpen?.(e); goJournal(e); };
  return (
    <Box className="table-frame" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)', overflow: 'auto' }}>
      <Table verticalSpacing="sm" horizontalSpacing="md" miw={820} highlightOnHover>
        <Table.Thead bg="slate.0">
          <Table.Tr>
            {['TANGGAL', 'TRANSAKSI', 'SUMBER', 'DEBIT', 'KREDIT', 'SALDO'].map((h, i) => (
              <Table.Th key={h} fz="xs" c="slate.7" ta={i >= 3 ? 'right' : undefined}>{h}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {opening && (
            <Table.Tr bg="slate.0">
              <Table.Td colSpan={5}><Text fz="sm" fw={600} c="slate.8">{opening.label}</Text></Table.Td>
              <Table.Td><Amount value={opening.saldo} fw={700} /></Table.Td>
            </Table.Tr>
          )}
          {rows.map(({ entry: e, line: l, saldo }, i) => (
            <Table.Tr key={`${e.id}-${i}`} onClick={() => open(e)} style={{ cursor: 'pointer' }}>
              <Table.Td fz="sm" style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>{formatDate(e.date)}</Table.Td>
              <Table.Td style={{ verticalAlign: 'top' }}>
                <Anchor
                  href={journalHref(e)}
                  fz="sm"
                  fw={600}
                  c="primary.9"
                  underline="hover"
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); open(e); }}
                >
                  Jurnal Transaksi #{e.no}
                </Anchor>
                {l.memo && <Text fz={11} c="slate.6" maw={240} truncate>{l.memo}</Text>}
              </Table.Td>
              <Table.Td style={{ verticalAlign: 'top' }}>
                <Group gap={6} wrap="nowrap">
                  <Badge size="xs" radius="sm" variant="light" color={MODULE_COLOR[e.module]} tt="none">{e.module}</Badge>
                  <Text fz="sm" c="slate.9" style={{ whiteSpace: 'nowrap' }}>{e.title}</Text>
                </Group>
                <Text fz={11} c="slate.6" style={{ whiteSpace: 'nowrap' }}>{e.ref}</Text>
              </Table.Td>
              <Table.Td style={{ verticalAlign: 'top' }}>{l.debit ? <Amount value={l.debit} /> : <Text fz="sm" c="slate.4" ta="right">—</Text>}</Table.Td>
              <Table.Td style={{ verticalAlign: 'top' }}>{l.credit ? <Amount value={l.credit} /> : <Text fz="sm" c="slate.4" ta="right">—</Text>}</Table.Td>
              <Table.Td style={{ verticalAlign: 'top' }}><Amount value={saldo} fw={700} /></Table.Td>
            </Table.Tr>
          ))}
          {footer && (rows.length > 0 || opening) && (
            <Table.Tr bg="slate.0">
              <Table.Td colSpan={3}><Text fz="sm" fw={700} c="slate.9">{footer.label}</Text></Table.Td>
              <Table.Td><Amount value={footer.debit} fw={700} /></Table.Td>
              <Table.Td><Amount value={footer.credit} fw={700} /></Table.Td>
              <Table.Td><Amount value={footer.saldo} fw={700} /></Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
      {!rows.length && <Text fz="xs" c="slate.6" ta="center" py="md">{emptyText ?? (opening ? 'Tidak ada jurnal di periode ini.' : 'Belum ada jurnal ke akun ini.')}</Text>}
    </Box>
  );
}
