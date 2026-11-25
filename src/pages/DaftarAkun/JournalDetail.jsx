// Detail Jurnal Transaksi untuk jurnal yang modulnya tidak punya halaman jurnal sendiri
// (Penjualan), dibuka dari daftar jurnal di detail akun (#daftar-akun/jurnal/<id>).
// Jurnal Pembelian dan Gudang dibuka di modulnya; ketiganya memakai JournalView yang sama.
import { Badge, Card, Group, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import { BackLink } from '@/components/common.jsx';
import JournalView from '@/components/JournalView.jsx';
import { useData } from '@/lib/store.jsx';
import { buildLedger } from '@/pages/LaporanKeuangan/ledger.js';
import { MODULE_COLOR } from '@/pages/LaporanKeuangan/StatementParts.jsx';
import { CopyIcon, DocNumber } from '@/pages/Pembelian/components.jsx';
import { formatDate } from '@/pages/Penjualan/utils.js';

const goBack = () => {
  if (window.history.length > 1) window.history.back();
  else window.location.hash = 'daftar-akun';
};
const openSource = (href) => {
  window.location.assign(href);
  window.scrollTo({ top: 0 });
};

export default function JournalDetail({ id }) {
  const data = useData();
  const ledger = useMemo(
    () => buildLedger(data),
    [data.sales, data.salesReturns, data.pb, data.stockMoves, data.products], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const e = ledger.find((x) => x.id === id);

  if (!e) {
    return (
      <Stack gap="lg" p="lg" maw={1440} mx="auto" w="100%">
        <BackLink label="Kembali" onClick={goBack} />
        <Card withBorder radius="lg" padding="xl" bg="white">
          <Text fw={700} c="slate.9">Jurnal tidak ditemukan</Text>
          <Text fz="sm" c="slate.6">Transaksi sumbernya mungkin sudah dibatalkan atau dihapus, sehingga jurnalnya tidak ada lagi.</Text>
        </Card>
      </Stack>
    );
  }

  // Judul jurnal Penjualan memuat tanggal atau nomor dokumen ("Pembayaran 20 Okt 2026"), yang
  // sudah tertulis di bawah judul halaman; badge cukup jenis transaksinya.
  const jenis = e.title.replace(e.ref, '').replace(/\s\d{1,2} \S+ \d{4}$/, '').trim() || e.title;
  const audit = [
    ['Tanggal transaksi', formatDate(e.date)],
    ['Dokumen sumber', <DocNumber key="src" onClick={() => openSource(e.href)}>{e.ref}</DocNumber>],
    ['Jenis transaksi', jenis],
    ['Modul', <Badge key="m" size="sm" radius="sm" variant="light" color={MODULE_COLOR[e.module]} tt="none">{e.module}</Badge>],
    ['Dibukukan oleh', 'Otomatis oleh sistem'],
    ['ID sistem', <Group key="id" gap={6} wrap="nowrap"><Text fz="sm" fw={700} c="slate.9" ff="monospace">{e.id}</Text><CopyIcon value={e.id} size={14} /></Group>],
  ];

  return (
    <JournalView
      entryIds={[e.id]}
      backLabel="Kembali"
      onBack={goBack}
      typeLabel={jenis}
      date={e.date}
      subtitle={e.ref}
      lines={e.lines}
      note={`${jenis} ${e.ref}`}
      audit={audit}
    />
  );
}
