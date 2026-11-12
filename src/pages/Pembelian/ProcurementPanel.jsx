// Pengadaan di dalam detail permintaan: panduan langkah, penawaran vendor, pemenang, ajukan & setujui.
// Jalur pengadaan dipilih saat permintaan dibuat; penawaran vendor diunggah di sini setelah diverifikasi.
import { useState } from 'react';
import { Badge, Box, Button, Card, Group, Text } from '@mantine/core';
import { QuoteModal, ReasonModal } from './Dialogs.jsx';
import { SuccessModal } from './components.jsx';
import { canCreate } from './permissions.js';
import { BiddingSection, Hint, ProcGuide, RepeatSection, RouteSelector } from './procurement.jsx';
import { toast } from './usePb.js';
import { createPOs, nextNumber, repeatCheck, routeLabel, uid } from './utils.js';

export default function ProcurementPanel({ f, pb, role, go }) {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [approvedPos, setApprovedPos] = useState(null); // daftar PO draf yang baru dibuat; tidak null = modal sukses tampil
  const [editQuote, setEditQuote] = useState(false); // true: ubah penawaran yang ada (vendor tunggal)
  const [rejectOpen, setRejectOpen] = useState(false);
  const patch = (fn) => pb.update('fpbj', f.id, fn);
  const patchProc = (obj) => patch((d) => ({ ...d, procurement: { ...d.procurement, ...obj } }));
  const pos = pb.pos.filter((p) => p.fpbjId === f.id);
  const vendor = (id) => pb.vendorsById[id]?.name ?? '—';

  if (f.status === 'dibatalkan') return null;

  // Data lama tanpa jalur: pilih jalur di sini (jalur normalnya dipilih saat permintaan dibuat).
  const pickRoute = (mode) =>
    patch((d) =>
      mode === 'repeat'
        ? {
            ...d,
            status: 'dalam_pengadaan',
            route: 'repeat',
            single: { on: false, reason: '' },
            procurement: d.procurement?.kind === 'repeat' ? d.procurement : { kind: 'repeat', status: 'draf', reason: '', comparators: {} },
          }
        : {
            ...d,
            status: 'dalam_pengadaan',
            route: 'bidding',
            single: { on: mode === 'single', reason: '' },
            procurement: d.procurement?.kind === 'bidding' ? d.procurement : { kind: 'bidding', status: 'draf', reason: '', winners: {}, finals: {}, negotiation: '' },
          },
    );
  // Pesan ulang: cocokkan item dengan PO referensi (nama sama = item lama).
  const applyRepeat = (vendorId, poId) => {
    const po = pb.posById[poId];
    patch((d) => ({
      ...d,
      refVendorId: vendorId,
      refPoId: poId,
      items: d.items.map((it) => {
        const m = po?.items.find((x) => x.desc.toLowerCase() === it.desc.toLowerCase());
        return m ? { ...it, isNew: false, refItemId: m.id, refPoId: po.id } : { ...it, isNew: true, refItemId: undefined };
      }),
    }));
  };
  const toBidding = () =>
    patch((d) => ({
      ...d,
      route: 'bidding',
      procurement: { kind: 'bidding', status: 'draf', reason: '', winners: {}, finals: {}, negotiation: '' },
    }));
  const submitProc = () => {
    patchProc({ status: 'diajukan', note: '' });
    toast('Diajukan ke approver.');
  };
  const approve = () => {
    patchProc({ status: 'disetujui' });
    setApprovedPos(pos.length === 0 ? createPOs(f, pb) : pos);
  };
  const rejectProc = (note) => {
    patchProc({ status: 'ditolak', note });
    setRejectOpen(false);
  };
  // Kasus 3 campuran: item baru dipisah ke permintaan turunan agar tiap paket dicek dengan aturannya sendiri.
  const splitMixed = () => {
    const c = repeatCheck(f, pb.pos);
    const newIds = c.rows.filter((r) => r.kind === 'baru').map((r) => r.item.id);
    const child = {
      ...f,
      id: uid('fpbj'),
      number: nextNumber('FPBJ', pb.fpbj),
      items: f.items.filter((i) => newIds.includes(i.id)),
      quotes: f.quotes.map((q) => ({ ...q, id: uid('q'), lines: q.lines.filter((l) => newIds.includes(l.itemId)) })),
      procurement: { kind: 'repeat', status: 'draf', reason: '', comparators: {} },
      splitFrom: f.id,
      refPoId: f.refPoId,
      note: `Dipecah dari ${f.number} (item baru)`,
    };
    pb.add('fpbj', child);
    patch((d) => ({
      ...d,
      items: d.items.filter((i) => !newIds.includes(i.id)),
      quotes: d.quotes.map((q) => ({ ...q, lines: q.lines.filter((l) => !newIds.includes(l.itemId)) })),
      splitTo: [...(d.splitTo ?? []), child.id],
      procurement: { kind: 'repeat', status: 'draf', reason: '', comparators: {} },
    }));
    toast(`Dipecah: item baru pindah ke ${child.number}. Keduanya bisa jadi PO terpisah ke vendor yang sama.`);
  };

  // Belum diverifikasi: penawaran vendor belum bisa diunggah.
  if (['draft', 'diajukan', 'dikembalikan'].includes(f.status)) {
    return (
      <Card withBorder radius="lg" padding="lg" bg="white">
        <Group justify="space-between" wrap="nowrap">
          <Box>
            <Group gap="xs">
              <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }}>Pengadaan</Text>
              {f.route && <Badge size="sm" radius="sm" variant="light" color="gray" c="slate.6" tt="none">{routeLabel(f)}</Badge>}
            </Group>
            <Text fz="xs" c="slate.6" mt={4}>Penawaran vendor bisa diunggah setelah permintaan diverifikasi Accounting.</Text>
          </Box>
        </Group>
      </Card>
    );
  }

  const sectionProps = {
    f,
    role,
    patchProc,
    onAddQuote: () => { setEditQuote(false); setQuoteOpen(true); },
    onEditQuote: () => { setEditQuote(true); setQuoteOpen(true); },
    onSubmit: submitProc,
    onApprove: approve,
    onReject: () => setRejectOpen(true),
  };

  return (
    <>
      {!f.route && (
        <Card withBorder radius="lg" padding="lg" bg="white">
          <Text fw={700} fz="sm" c="slate.9">Pilih jalur pengadaan</Text>
          <Text fz="xs" c="slate.6" mb="md">Permintaan ini belum punya jalur. Pilih sesuai riwayat vendor dan barang.</Text>
          <RouteSelector f={f} role={role} onPick={pickRoute} />
          {!canCreate(role, 'procurement') && <Box mt="sm"><Hint role="accounting" /></Box>}
        </Card>
      )}
      {f.route && <ProcGuide f={f} pb={pb} role={role} />}
      {f.route === 'bidding' && <BiddingSection {...sectionProps} pb={pb} vendor={vendor} />}
      {f.route === 'repeat' && <RepeatSection {...sectionProps} pb={pb} onToBidding={toBidding} onSplit={splitMixed} onApply={applyRepeat} />}

      <QuoteModal
        key={`q-${f.quotes.length}-${quoteOpen}-${editQuote}`}
        editing={editQuote ? f.quotes[0] : undefined}
        single={!!f.single?.on}
        opened={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        fpbj={f}
        pb={pb}
        repeatVendorId={f.route === 'repeat' ? f.refVendorId : undefined}
      />
      <SuccessModal
        opened={approvedPos !== null}
        onClose={() => setApprovedPos(null)}
        title="Pengadaan disetujui"
        text={approvedPos?.length ? `${approvedPos.length} PO dibuat sebagai draf. Kirim ke vendor dari detail PO.` : 'Pengadaan sudah disetujui.'}
      >
        <Button variant="default" radius="md" onClick={() => setApprovedPos(null)}>Tutup</Button>
        {approvedPos?.length === 1 && go && (
          <Button radius="md" onClick={() => { const id = approvedPos[0].id; setApprovedPos(null); go({ name: 'po', id }); }}>Lihat PO</Button>
        )}
      </SuccessModal>
      <ReasonModal
        opened={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Tolak pengadaan"
        label="Alasan penolakan"
        confirmLabel="Tolak"
        onConfirm={rejectProc}
      />
    </>
  );
}
