// Kartu "Log approval": siapa saja yang harus memverifikasi / menyetujui dokumen ini, sudah
// sampai mana, dan riwayat setiap keputusan (ajukan, verifikasi, kembalikan, setujui, tolak)
// lengkap dengan nama, peran, tanggal, jam, dan alasannya.
//
// Dipakai di semua dokumen yang punya approval atau verifikasi: permintaan (verifikasi +
// approval pengadaan), FPB/BAPP, Payment Request, dan pembatalan uang muka di PO/SPK.
import { Badge, Box, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { ArrowCounterClockwise, Check, ListChecks, PaperPlaneTilt, X } from '@/components/Icon.jsx';
import { Section } from './components.jsx';
import { approvalState, roleLabel } from './permissions.js';
import { formatDate } from './utils.js';

// "2026-11-04T14:32" -> "4 Nov 2026, 14:32". Data lama hanya menyimpan tanggal.
// Persetujuan yang dibubuhkan sebelum jam ikut disimpan tidak punya jam: jangan dikarang.
export const stampLabel = (at) => (at ? `${formatDate(at.slice(0, 10))}, ${at.length > 10 ? at.slice(11, 16) : 'jam tidak tercatat'}` : '—');

const ACTION = {
  ajukan: { label: 'Diajukan', color: 'gray', icon: PaperPlaneTilt },
  verifikasi: { label: 'Diverifikasi', color: 'green', icon: Check },
  kembalikan: { label: 'Dikembalikan', color: 'red', icon: ArrowCounterClockwise },
  setuju: { label: 'Disetujui', color: 'green', icon: Check },
  tolak: { label: 'Ditolak', color: 'red', icon: X },
  batal: { label: 'Dibatalkan', color: 'gray', icon: X },
};

// Langkah approval berjenjang dari rantai peran (mis. Chief Finance lalu Building Manager).
// `rejected`: dokumen sedang ditolak, jadi langkah yang sedang ditunggu tampil "Ditolak".
export function chainSteps(doc, kind, { settled = false, rejected = false, active = true } = {}) {
  const ap = approvalState(doc, kind, { settled });
  return ap.chain.map((role) => ({
    key: `${kind}-${role}`,
    verb: 'Approval',
    role,
    done: ap.got[role] ?? null,
    state: ap.got[role] ? 'done' : !active ? 'idle' : role === ap.next ? (rejected ? 'rejected' : 'current') : 'idle',
  }));
}

const STATE = {
  done: { label: 'Selesai', color: 'green' },
  current: { label: 'Menunggu', color: 'orange' },
  rejected: { label: 'Ditolak', color: 'red' },
  idle: { label: 'Belum', color: 'gray' },
};

function StepRow({ step, index }) {
  const s = STATE[step.state];
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      <ThemeIcon size={22} radius="xl" variant={step.state === 'done' ? 'filled' : 'light'} color={s.color} style={{ flexShrink: 0 }}>
        {step.state === 'done' ? <Check size={12} /> : step.state === 'rejected' ? <X size={12} /> : <Text fz={11} fw={700}>{index + 1}</Text>}
      </ThemeIcon>
      <Box style={{ minWidth: 0, flex: 1 }}>
        <Group justify="space-between" gap={6} wrap="nowrap">
          <Text fz="xs" fw={700} c="slate.9">{step.verb} {roleLabel(step.role)}</Text>
          <Badge size="xs" radius="sm" variant="light" color={s.color} tt="none" fw={700}>{step.state === 'rejected' && step.rejectedLabel ? step.rejectedLabel : s.label}</Badge>
        </Group>
        {/* Nama dan waktunya cukup di Riwayat; di sini hanya urutan dan statusnya. */}
      </Box>
    </Group>
  );
}

function LogRow({ e }) {
  const a = ACTION[e.action] ?? { label: e.action, color: 'gray', icon: Check };
  const Icon = a.icon;
  // Superadmin bisa mengisi slot peran lain; tulis jelas atas nama siapa.
  const sebagai = e.step && e.role !== e.step ? ` sebagai ${roleLabel(e.step)}` : '';
  const [nama, jabatan] = (e.by ?? '—').split(' · ');
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start">
      <ThemeIcon size={22} radius="xl" variant="light" color={a.color} style={{ flexShrink: 0 }}>
        <Icon size={12} />
      </ThemeIcon>
      <Box style={{ minWidth: 0 }}>
        <Text fz="xs" c="slate.9">
          <Text span fw={700} c={a.color === 'gray' ? 'slate.9' : `${a.color}.8`}>{e.note && e.action === 'ajukan' ? e.note : a.label}</Text>
          {' oleh '}
          <Text span fw={700}>{nama}</Text>
        </Text>
        <Text fz={11} c="slate.6">
          {roleLabel(e.role)}{jabatan && jabatan !== roleLabel(e.role) ? ` (${jabatan})` : ''}{sebagai} · {stampLabel(e.at)}
        </Text>
        {e.note && e.action !== 'ajukan' && (
          <Text fz={11} c="slate.7" mt={2} style={{ borderLeft: '2px solid var(--mantine-color-gray-3)', paddingLeft: 6 }}>{e.note}</Text>
        )}
        {/* Alasan pengajuan (mis. pembatalan uang muka): dikutip di bawah, judulnya tetap "Diajukan". */}
        {e.reason && (
          <Text fz={11} c="slate.7" mt={2} style={{ borderLeft: '2px solid var(--mantine-color-gray-3)', paddingLeft: 6 }}>Alasan: {e.reason}</Text>
        )}
      </Box>
    </Group>
  );
}

export default function ApprovalLog({ steps = [], log = [], title = 'Log approval', description }) {
  // Terbaru di atas. Log hanya menyimpan jam:menit, jadi dua tindakan di menit yang sama
  // diurutkan dari posisinya di log (yang dicatat belakangan tampil lebih atas).
  const entries = log.map((e, i) => ({ e, i })).sort((a, b) => String(b.e.at).localeCompare(String(a.e.at)) || b.i - a.i).map((x) => x.e);
  return (
    <Section
      divided
      icon={ListChecks}
      title={title}
      description={description ?? (steps.length ? `Urutan: ${steps.map((s) => `${s.verb.toLowerCase()} ${roleLabel(s.role)}`).join(' → ')}` : undefined)}
    >
      <Stack gap="md">
        {steps.length > 0 && (
          <Stack gap={10}>
            {steps.map((s, i) => <StepRow key={s.key} step={s} index={i} />)}
          </Stack>
        )}
        <Box style={{ borderTop: steps.length ? '1px solid var(--mantine-color-gray-2)' : undefined }} pt={steps.length ? 'md' : 0}>
          <Text fz={11} fw={700} c="slate.6" mb={8}>Riwayat</Text>
          {entries.length === 0 ? (
            <Text fz="xs" c="slate.6">Belum ada tindakan tercatat.</Text>
          ) : (
            <Stack gap={10}>
              {entries.map((e, i) => <LogRow key={`${e.at}-${i}`} e={e} />)}
            </Stack>
          )}
        </Box>
      </Stack>
    </Section>
  );
}

// Dokumen yang dibuat sebelum log ada: susun riwayat dari tanda tangan yang tersimpan, supaya
// kartu ini tidak kosong untuk dokumen lama.
export function legacyLog(doc) {
  if (doc?.log?.length) return doc.log;
  return Object.entries(doc?.approvals ?? {}).map(([step, a]) => ({ action: 'setuju', role: a.role ?? step, step, by: a.by, at: a.at }));
}
