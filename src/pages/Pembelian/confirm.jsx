// Konfirmasi sebelum keputusan approval. Setujui / verifikasi tidak bisa dibatalkan begitu
// tercatat (tanda tangan masuk log, dan approval terakhir menggerakkan stok & jurnal), jadi
// satu klik tidak boleh langsung mengeksekusinya.
//
// Pakai: askConfirm({ title, message, confirmLabel, onConfirm }). <ConfirmHost /> dipasang
// sekali di halaman Pembelian. Penolakan sudah lewat ReasonModal (alasan wajib), jadi itu
// sendiri sudah langkah konfirmasi.
import { useEffect, useState } from 'react';
import { Button, Text } from '@mantine/core';
import { Check } from '@/components/Icon.jsx';
import { FormModal } from './components.jsx';
import { roleLabel } from './permissions.js';

let show = null;
export function askConfirm(opts) {
  if (show) show(opts);
  else opts.onConfirm?.();
}

export function ConfirmHost() {
  const [req, setReq] = useState(null);
  useEffect(() => {
    show = setReq;
    return () => { if (show === setReq) show = null; };
  }, []);
  const close = () => setReq(null);
  return (
    <FormModal
      opened={!!req}
      onClose={close}
      size={460}
      icon={req?.icon ?? Check}
      title={req?.title ?? ''}
      footer={
        <>
          <Button variant="default" radius="md" onClick={close}>Batal</Button>
          <Button
            radius="md"
            color={req?.color}
            leftSection={<Check size={16} />}
            data-autofocus
            onClick={() => { const fn = req?.onConfirm; close(); fn?.(); }}
          >
            {req?.confirmLabel ?? 'Ya, lanjutkan'}
          </Button>
        </>
      }
    >
      {typeof req?.message === 'string' ? <Text fz="sm" c="slate.8">{req.message}</Text> : req?.message}
    </FormModal>
  );
}

// Kalimat "apa yang terjadi setelah ini" untuk satu tanda tangan approval berjenjang.
export function approvalMessage(ap, { final } = {}) {
  const ke = ap.done.length + 1;
  const tetap = 'Keputusan ini tercatat di log approval dan tidak bisa dibatalkan.';
  if (ke >= ap.total) return `${final ?? `Ini approval terakhir (${ke} dari ${ap.total}).`} ${tetap}`;
  const next = ap.chain?.[ke];
  return `Approval ${ke} dari ${ap.total}. Setelah ini menunggu ${next ? roleLabel(next) : 'approver berikutnya'}. ${tetap}`;
}
