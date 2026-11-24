// Pengadaan di dalam detail permintaan: panduan langkah, penawaran vendor, pemenang, ajukan & setujui.
// Jalur pengadaan dipilih di sini, setelah permintaan lolos verifikasi; penawaran vendor menyusul.
import { approvalMessage, askConfirm } from './confirm.jsx';
import { useState } from 'react';
import { Badge, Box, Button, Card, Group, Text } from '@mantine/core';
import { ConfirmDeleteQuoteModal, QuoteDetailModal, QuoteModal, ReasonModal, SwitchRouteModal } from './Dialogs.jsx';
import { SuccessModal } from './components.jsx';
import { approvalState, canCreate, logEntry, signApproval } from './permissions.js';
import { BiddingSection, Hint, ProcGuide, RouteSelector, SingleSection } from './procurement.jsx';
import { TODAY } from './data.js';
import { toast } from './usePb.js';
import { biddingWinner, createPOs, routeLabel, routeSwitchEffects } from './utils.js';

export default function ProcurementPanel({ f, pb, role, go }) {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [approvedPos, setApprovedPos] = useState(null); // daftar PO draf yang baru dibuat; tidak null = modal sukses tampil
  const [editQuote, setEditQuote] = useState(null); // id penawaran yang sedang diubah
  const [delQuote, setDelQuote] = useState(null); // id penawaran yang menunggu konfirmasi hapus
  const [viewQuote, setViewQuote] = useState(null); // id penawaran yang dibuka detailnya
  const [rejectOpen, setRejectOpen] = useState(false);
  const [switchTo, setSwitchTo] = useState(null); // jalur yang menunggu konfirmasi pergantian
  const patch = (fn) => pb.update('fppbj', f.id, fn);
  const patchProc = (obj) => patch((d) => ({ ...d, procurement: { ...d.procurement, ...obj } }));
  const pos = pb.pos.filter((p) => p.fppbjId === f.id);
  const vendor = (id) => pb.vendorsById[id]?.name ?? '—';

  if (f.status === 'dibatalkan') return null;

  // Langkah pertama pengadaan: tentukan jalurnya. Ini yang memindahkan permintaan dari
  // 'diverifikasi' ke 'dalam_pengadaan'.
  // Vendor tunggal disimpan sebagai route 'bidding' dengan single.on = true: bentuk datanya sama,
  // yang berbeda hanya langkah dan layarnya. Jadi berpindah jalur tidak membuang penawaran.
  //
  // Dipakai untuk pemilihan pertama DAN untuk mengganti jalur. Mengganti jalur yang sudah
  // diajukan menarik pengajuannya kembali ke draf, karena approver menilai per jalur.
  const applyRoute = (mode) => {
    const nowSingle = mode === 'single';
    const pulled = f.procurement?.status === 'diajukan';
    patch((d) => {
      const w = nowSingle ? biddingWinner(d) : null;
      // Jalur tunggal selalu memakai penawaran pertama. Kalau di bidding sudah ada pemenang,
      // penawarannya dipindah ke depan supaya kartu dan PO menunjuk vendor yang sama — tanpa ini
      // layar bisa menampilkan vendor A sementara PO terbit ke vendor B.
      const quotes = w
        ? [...d.quotes.filter((q) => q.vendorId === w), ...d.quotes.filter((q) => q.vendorId !== w)]
        : d.quotes;
      return {
        ...d,
        status: 'dalam_pengadaan',
        routedAt: TODAY,
        route: 'bidding',
        single: { on: nowSingle, reason: d.single?.reason ?? '' },
        quotes,
        procurement: {
          ...(d.procurement ?? { kind: 'bidding', reason: '', finals: {}, negotiation: '' }),
          kind: 'bidding',
          status: pulled ? 'draf' : d.procurement?.status ?? 'draf',
          // Pemenang selalu dilepas: jalur tunggal tidak memilih pemenang, dan kembali ke
          // bidding berarti pemilihannya diulang dengan susunan penawaran yang sekarang.
          winners: {},
        },
      };
    });
    setSwitchTo(null);
    const label = nowSingle ? 'vendor tunggal' : 'bidding';
    if (!f.route) toast(`Jalur ${label} dipilih.`);
    else if (pulled) toast(`Jalur diganti ke ${label}. Pengajuan ditarik kembali ke draf, ajukan ulang setelah siap.`);
    else toast(`Jalur diganti ke ${label}. Penawaran yang sudah ada tetap tersimpan.`);
  };

  // Konfirmasi hanya kalau pergantiannya benar-benar berakibat. Memilih jalur pertama kali,
  // atau mengganti jalur selagi belum ada penawaran, langsung jalan tanpa modal.
  const pickRoute = (mode) => {
    if (f.route && !!f.single?.on === (mode === 'single')) return;
    if (f.route && routeSwitchEffects(f, mode).length > 0) return setSwitchTo(mode);
    applyRoute(mode);
  };
  const removeQuote = (id) => {
    const q = f.quotes.find((x) => x.id === id);
    if (!q) return setDelQuote(null);
    const name = vendor(q.vendorId);
    patch((d) => {
      const p = d.procurement ?? {};
      const drop = (obj) =>
        obj ? Object.fromEntries(Object.entries(obj).filter(([v]) => v !== q.vendorId)) : obj;
      return {
        ...d,
        quotes: d.quotes.filter((x) => x.id !== id),
        procurement: {
          ...p,
          // Pemenang yang menunjuk vendor ini ikut dilepas.
          winners: Object.fromEntries(Object.entries(p.winners ?? {}).filter(([, v]) => v !== q.vendorId)),
          offerFinals: drop(p.offerFinals),
          discounts: drop(p.discounts),
          shipping: drop(p.shipping),
          scores: drop(p.scores),
          // Pengajuan yang sedang dinilai ditarik: isinya sudah berubah.
          status: p.status === 'diajukan' ? 'draf' : p.status,
        },
      };
    });
    setDelQuote(null);
    toast(`Penawaran ${name} dihapus.`);
  };

  const submitProc = () => {
    patchProc({ status: 'diajukan', note: '', submittedAt: TODAY, log: [...(f.procurement?.log ?? []), logEntry(role, 'ajukan')] });
    toast('Diajukan ke approver.');
  };
  // Approval pengadaan berjenjang dua: Chief Finance lalu Building Manager. PO/SPK baru
  // terbit setelah tanda tangan kedua — bukan setelah yang pertama.
  const approve = () => askConfirm({
    title: `Setujui pengadaan ${f.number}?`,
    message: approvalMessage(approvalState(f.procurement ?? {}, 'procurement'), { final: 'Ini approval terakhir: pengadaan disetujui dan PO/SPK langsung diterbitkan.' }),
    confirmLabel: 'Ya, setujui',
    onConfirm: approveNow,
  });
  const approveNow = () => {
    const { doc, complete } = signApproval(f.procurement ?? {}, 'procurement', role);
    patchProc(complete ? { ...doc, status: 'disetujui' } : doc);
    if (complete) setApprovedPos(pos.length === 0 ? createPOs(f, pb) : pos);
    else toast(`Approval ${approvalState(doc, 'procurement').done.length} dari ${approvalState(doc, 'procurement').total} dicatat. Menunggu approval berikutnya.`);
  };
  const rejectProc = (note) => {
    const { next } = approvalState(f.procurement, 'procurement');
    patchProc({ status: 'ditolak', note, log: [...(f.procurement?.log ?? []), logEntry(role, 'tolak', { step: next, note })] });
    setRejectOpen(false);
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
            <Text fz="xs" c="slate.6" mt={4}>Pengadaan dimulai setelah permintaan diverifikasi. Jalurnya dipilih di langkah ini juga.</Text>
          </Box>
        </Group>
      </Card>
    );
  }

  const sectionProps = {
    f,
    role,
    patchProc,
    onAddQuote: () => { setEditQuote(null); setQuoteOpen(true); },
    onViewQuote: (id) => setViewQuote(id ?? f.quotes[0]?.id ?? null),
    onEditQuote: (id) => { setEditQuote(id ?? f.quotes[0]?.id ?? null); setQuoteOpen(true); },
    onDeleteQuote: (id) => setDelQuote(id ?? f.quotes[0]?.id ?? null),
    onSubmit: submitProc,
    onApprove: approve,
    onReject: () => setRejectOpen(true),
  };

  return (
    <>
      {/* Belum berjalur: kartu penuh, karena ini satu-satunya yang perlu dikerjakan. */}
      {!f.route && (
        <Card withBorder radius="lg" padding="lg" bg="white">
          <Text fw={700} fz="sm" c="slate.9">Pilih jalur pengadaan</Text>
          <Text fz="xs" c="slate.6" mb="md">
            Permintaan sudah diverifikasi. Tentukan jalurnya sesuai riwayat vendor dan barang — setelah dipilih,
            permintaan masuk status Dalam pengadaan dan penawaran vendor bisa diunggah.
          </Text>
          <RouteSelector f={f} role={role} onPick={pickRoute} />
          {!canCreate(role, 'procurement') && <Box mt="sm"><Hint role="accounting" /></Box>}
        </Card>
      )}
      {/* Sudah berjalur: tetap bisa ditukar sampai disetujui, tapi tampil ringkas supaya
          tidak menyaingi langkah dan form pengadaan di bawahnya. */}
      {f.route && f.procurement?.status !== 'disetujui' && canCreate(role, 'procurement') && (
        <Card withBorder radius="lg" padding="md" bg="white">
          <Text fz={11} fw={700} c="slate.6" tt="uppercase" style={{ letterSpacing: 0.5 }} mb={8}>Jalur pengadaan</Text>
          <RouteSelector f={f} role={role} onPick={pickRoute} />
        </Card>
      )}
      {f.route && <ProcGuide f={f} pb={pb} role={role} />}
      {/* Satu jalur, satu layar: vendor tunggal dan bidding tidak berbagi tampilan. */}
      {f.route && (f.single?.on
        ? <SingleSection {...sectionProps} pb={pb} vendor={vendor} />
        : <BiddingSection {...sectionProps} pb={pb} vendor={vendor} />)}

      <QuoteDetailModal
        opened={viewQuote !== null}
        onClose={() => setViewQuote(null)}
        quote={f.quotes.find((q) => q.id === viewQuote)}
        fppbj={f}
        pb={pb}
      />
      <ConfirmDeleteQuoteModal
        opened={delQuote !== null}
        onClose={() => setDelQuote(null)}
        quote={f.quotes.find((q) => q.id === delQuote)}
        fppbj={f}
        pb={pb}
        onConfirm={() => removeQuote(delQuote)}
      />
      <SwitchRouteModal
        opened={switchTo !== null}
        onClose={() => setSwitchTo(null)}
        mode={switchTo}
        fppbj={f}
        pb={pb}
        onConfirm={() => applyRoute(switchTo)}
      />
      <QuoteModal
        key={`q-${f.quotes.length}-${quoteOpen}-${editQuote ?? 'baru'}`}
        editing={editQuote ? f.quotes.find((q) => q.id === editQuote) : undefined}
        single={!!f.single?.on}
        opened={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        fppbj={f}
        pb={pb}
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
