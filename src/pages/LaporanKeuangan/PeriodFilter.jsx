// Filter periode yang dipakai bersama laporan keuangan (Laba Rugi, Neraca): pilihan cepat +
// rentang tanggal untuk periode laporan dan pembandingnya. Neraca memakai tanggal akhir
// masing-masing rentang sebagai tanggal posisinya.
import { Box, Card, Group, Select, SimpleGrid, Text } from '@mantine/core';
import { useState } from 'react';
import DateField from '@/components/DateField.jsx';
import { TODAY } from '@/pages/Penjualan/data.js';
import { addDays, formatDate } from '@/pages/Penjualan/utils.js';

// --- Tanggal ------------------------------------------------------------------------------------
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const parts = (d) => d.split('-').map(Number);
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const monthEnd = (d) => { const [y, m] = parts(d); return ymd(y, m, lastDay(y, m)); };
const isMonthStart = (d) => parts(d)[2] === 1;
const isMonthEnd = (d) => d === monthEnd(d);
// Geser n bulan; tanggal yang tidak ada di bulan tujuan (31 Feb) dipotong ke akhir bulan.
function shiftMonths(d, n) {
  const [y, m, day] = parts(d);
  const idx = y * 12 + (m - 1) + n;
  const ty = Math.floor(idx / 12);
  const tm = (idx % 12) + 1;
  return ymd(ty, tm, Math.min(day, lastDay(ty, tm)));
}
// Rentang yang digeser n bulan. Rentang bulan penuh tetap jadi bulan penuh (Feb → Jan sampai 31).
export function shiftRange([from, to], n) {
  const f = shiftMonths(from, n);
  const t = isMonthStart(from) && isMonthEnd(to) ? monthEnd(shiftMonths(to, n)) : shiftMonths(to, n);
  return [f, t];
}
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

// Label pendek untuk kepala kolom angka: "Nov 2026", "2026", "1–4 Nov 2026", atau rentang lengkap.
export function shortLabel([from, to]) {
  const [fy, fm, fd] = parts(from);
  const [ty, tm, td] = parts(to);
  if (fd === 1 && fm === 1 && tm === 12 && td === 31 && fy === ty) return String(fy);
  if (fy === ty && fm === tm && isMonthStart(from) && isMonthEnd(to)) return `${MONTHS[fm - 1]} ${fy}`;
  if (fy === ty && fm === tm) return fd === td ? formatDate(from) : `${fd}–${td} ${MONTHS[fm - 1]} ${fy}`;
  if (fy === ty) return `${fd} ${MONTHS[fm - 1]} – ${td} ${MONTHS[tm - 1]} ${ty}`;
  return `${formatDate(from)} – ${formatDate(to)}`;
}
export const rangeText = ([from, to]) => `${formatDate(from)} s.d. ${formatDate(to)}`;

const [ty, tm] = parts(TODAY);
const qStart = ymd(ty, Math.floor((tm - 1) / 3) * 3 + 1, 1);
const lastMonthStart = shiftMonths(ymd(ty, tm, 1), -1);
// `unit` = berapa bulan rentang ini digeser untuk "periode sebelumnya".
export const PRESETS = [
  { value: 'month', label: 'Bulan ini', range: [ymd(ty, tm, 1), TODAY], unit: 1 },
  { value: 'lastMonth', label: 'Bulan lalu', range: [lastMonthStart, monthEnd(lastMonthStart)], unit: 1 },
  { value: 'quarter', label: 'Kuartal ini', range: [qStart, TODAY], unit: 3 },
  { value: 'year', label: 'Tahun ini', range: [`${ty}-01-01`, TODAY], unit: 12 },
  { value: 'lastYear', label: 'Tahun lalu', range: [`${ty - 1}-01-01`, `${ty - 1}-12-31`], unit: 12 },
  { value: 'custom', label: 'Tanggal lain' },
];
export const COMPARE = [
  { value: 'prev', label: 'Periode sebelumnya' },
  { value: 'yoy', label: 'Periode sama tahun lalu' },
  { value: 'none', label: 'Tanpa pembanding' },
  { value: 'custom', label: 'Tanggal lain' },
];
// Periode sebelumnya: preset bergeser sebesar satuannya; rentang bebas memakai rentang
// sepanjang periode itu, tepat sebelum tanggal mulainya.
function previousRange(range, preset) {
  const unit = PRESETS.find((p) => p.value === preset)?.unit;
  if (unit) return shiftRange(range, -unit);
  const len = daysBetween(range[0], range[1]);
  const to = addDays(range[0], -1);
  return [addDays(to, -len), to];
}
// "Dari" setelah "sampai" ditukar untuk hitungan; isiannya diberi pesan.
const ordered = ([a, b]) => (a && b && a > b ? [b, a] : [a, b]);
const invalid = ([a, b]) => !!(a && b && a > b);

// Status filter: periode laporan (`range`) dan pembandingnya (`cmpRange`, null bila tanpa).
// `initial` (opsional, [dari, sampai]) membuka filter di rentang itu, mis. dari tautan laporan;
// bila sama dengan salah satu pilihan cepat, pilihan itu yang terpilih.
export function usePeriodFilter(initial) {
  const startPreset = initial ? PRESETS.find((p) => p.range && p.range[0] === initial[0] && p.range[1] === initial[1])?.value ?? 'custom' : 'month';
  const [preset, setPreset] = useState(startPreset);
  const [customRange, setCustomRange] = useState(initial ?? PRESETS[0].range);
  const rawRange = preset === 'custom' ? customRange : PRESETS.find((p) => p.value === preset).range;
  const range = ordered(rawRange.map((d, i) => d || PRESETS[0].range[i]));

  const [cmpMode, setCmpMode] = useState('none');
  const [cmpCustom, setCmpCustom] = useState(() => previousRange(PRESETS[0].range, 'month'));
  const cmpRaw = cmpMode === 'none' ? [null, null]
    : cmpMode === 'custom' ? cmpCustom
      : cmpMode === 'yoy' ? shiftRange(range, -12)
        : previousRange(range, preset);
  const cmpRange = cmpMode === 'none' || !cmpRaw[0] || !cmpRaw[1] ? null : ordered(cmpRaw);

  return {
    range,
    cmpRange,
    compare: !!cmpRange,
    fieldProps: {
      preset, setPreset, rawRange, setCustomRange,
      cmpMode, setCmpMode, cmpRaw, setCmpCustom,
    },
  };
}

// Kartu filter: "Periode" dan "Dibandingkan dengan", berdampingan dan sama bentuknya.
// `noCompare`: laporan tanpa pembanding (Neraca Saldo) hanya menampilkan isian periode.
export function PeriodCard({ preset, setPreset, rawRange, setCustomRange, cmpMode, setCmpMode, cmpRaw, setCmpCustom, noCompare = false }) {
  return (
    <Card withBorder radius="lg" padding="lg" bg="white" className="no-print">
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        <RangeField
          label="Periode"
          options={PRESETS}
          value={preset}
          onChange={setPreset}
          range={rawRange}
          onRange={(v) => { setCustomRange(v); setPreset('custom'); }}
        />
        {!noCompare && <RangeField
          label="Dibandingkan dengan"
          options={COMPARE}
          value={cmpMode}
          onChange={setCmpMode}
          range={cmpRaw}
          onRange={(v) => { setCmpCustom(v); setCmpMode('custom'); }}
          disabled={cmpMode === 'none'}
        />}
      </SimpleGrid>
    </Card>
  );
}

function RangeField({ label, options, value, onChange, range, onRange, disabled }) {
  const bad = invalid(range);
  return (
    <Box>
      <Text fz="sm" fw={500} c="slate.9" mb={6}>{label}</Text>
      <Group gap={8} wrap="wrap">
        <Select
          size="sm"
          radius="md"
          style={{ flex: '1 1 190px', minWidth: 0 }}
          aria-label={label}
          allowDeselect={false}
          value={value}
          onChange={(v) => v && onChange(v)}
          data={options.map((o) => ({ value: o.value, label: o.label }))}
        />
        <Group gap={6} wrap="nowrap" style={{ flex: '1 1 260px', minWidth: 0 }}>
          <DateField
            size="sm"
            radius="md"
            style={{ flex: 1, minWidth: 0 }}
            aria-label={`${label}: dari tanggal`}
            value={range[0] ?? ''}
            max={TODAY}
            disabled={disabled}
            error={bad}
            onChange={(e) => onRange([e.currentTarget.value, range[1]])}
          />
          <Text fz="xs" c="slate.6">s.d.</Text>
          <DateField
            size="sm"
            radius="md"
            style={{ flex: 1, minWidth: 0 }}
            aria-label={`${label}: sampai tanggal`}
            value={range[1] ?? ''}
            max={TODAY}
            disabled={disabled}
            error={bad}
            onChange={(e) => onRange([range[0], e.currentTarget.value])}
          />
        </Group>
      </Group>
      {bad && <Text fz={12} c="red.8" mt={4}>Tanggal mulai setelah tanggal akhir. Laporan memakai urutan yang dibalik.</Text>}
    </Box>
  );
}
