// Halaman detail Jurnal Transaksi satu dokumen pembelian: FPB/BAPP, faktur, atau Payment Voucher.
//
// Jurnalnya tidak disimpan — dibentuk ulang dari dokumennya setiap kali dibaca (lihat
// journal.js). Jadi halaman ini selalu memperlihatkan keadaan terbaru dokumen sumbernya,
// bukan salinan yang bisa basi. Tampilannya dari JournalView, sama dengan modul lain.
import { Group, Text } from '@mantine/core';
import JournalView from '@/components/JournalView.jsx';
import { useData } from '@/lib/store.jsx';
import { CopyIcon, DocNumber } from './components.jsx';
import { journalEntry } from './journal.js';
import { formatDate } from './utils.js';

// Id jurnal dokumen ini di buku besar (LaporanKeuangan/ledger.js).
const LEDGER_PREFIX = { receipt: 'pb-rc', invoice: 'pb-inv', pv: 'pb-pv' };

export default function JournalDetail({ kind = 'pv', doc: v, pb, onBack, go }) {
  const { stockMoves, products } = useData();
  const e = journalEntry(kind, v, pb, { stockMoves, products });

  const audit = [
    ['Tanggal transaksi', formatDate(e.date)],
    ['Dokumen sumber', <DocNumber key="src" onClick={() => go(e.source.view)}>{e.source.label}</DocNumber>],
    ['Jenis transaksi', e.typeLabel],
    ['Pihak terkait', e.party],
    [e.basisLabel, e.basis.length
      ? <Group key="basis" gap={6} wrap="wrap">{e.basis.map((b) => <DocNumber key={b.label} onClick={() => go(b.view)}>{b.label}</DocNumber>)}</Group>
      : '—'],
    ...e.extra,
    ['Dibukukan oleh', e.by],
    ['ID sistem', <Group key="id" gap={6} wrap="nowrap"><Text fz="sm" fw={700} c="slate.9" ff="monospace">{v.id}</Text><CopyIcon value={v.id} size={14} /></Group>],
  ];

  return (
    <JournalView
      entryIds={[`${LEDGER_PREFIX[kind]}-${v.id}`]}
      backLabel={`Kembali ke ${v.number}`}
      onBack={onBack}
      typeLabel={e.typeLabel}
      date={e.date}
      subtitle={v.number}
      lines={e.lines}
      note={e.note}
      audit={audit}
      notes={[e.note, v.note]}
      files={e.files}
      filesLabel={e.filesLabel}
    />
  );
}
