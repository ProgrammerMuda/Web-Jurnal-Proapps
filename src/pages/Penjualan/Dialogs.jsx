// Dialog aksi faktur penjualan: kirim / kirim ulang email, dan hapus faktur draf.
import {
  Alert,
  Badge,
  Box,
  Button,
  Grid,
  Group,
  MultiSelect,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Tooltip,
  Textarea,
  TextInput,
} from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import {
  ClipboardText,
  DownloadSimple,
  Invoice,
  Notebook,
  PaperPlaneTilt,
  Trash,
  Warning,
} from '@/components/Icon.jsx';
import { blockedProps, Field, FormModal } from './components.jsx';
import { DOC } from './docTypes.js';
import { accountLabel, journalTotals, saleJournals } from './journal.js';
import { downloadInvoice, invoicePdfBlob } from './invoicePdf.js';
import NumberField from '@/components/NumberField.jsx';
import { lockedMessage, periodLocked, products, TODAY } from './data.js';
import { addDays, computeTotals, formatDate, rupiah, useCustomer } from './utils.js';

// Ringkasan faktur yang dipakai kedua dialog.
function SaleSummary({ sale, customer, doc }) {
  const t = computeTotals(sale);
  return (
    <SimpleGrid cols={2} spacing="sm">
      <Field label={`Nomor ${doc.word}`}>{sale.number}</Field>
      <Field label="Pelanggan">{customer?.name ?? '—'}</Field>
      <Field label={doc.kind === 'order' ? 'Target kirim' : 'Jatuh tempo'}>
        {formatDate(sale.dueDate)}
      </Field>
      <Field label={`Total ${doc.word}`}>{rupiah(t.total)}</Field>
    </SimpleGrid>
  );
}

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

const emailLooksValid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// Kirim faktur draf, atau kirim ulang faktur yang sudah terbit.
// Dipasang hanya saat ada faktur terpilih, dengan key={sale.id} dari pemanggilnya.
export function SendModal({ sale, doc = DOC.invoice, resend = false, onClose, onSend }) {
  const customer = useCustomer(sale.customerId);
  const [to, setTo] = useState(() => customer?.email ?? '');
  const [note, setNote] = useState(() => sale.message ?? '');
  const [submitted, setSubmitted] = useState(false);

  const error =
    (!to.trim() && 'Email tujuan wajib diisi') ||
    (!emailLooksValid(to) && 'Format email belum benar');

  const submit = () => {
    setSubmitted(true);
    if (error) return;
    onSend({ to: to.trim(), note: note.trim() });
  };

  return (
    <FormModal
      opened
      onClose={onClose}
      size={920}
      icon={PaperPlaneTilt}
      title={resend ? `Kirim Ulang ${cap(doc.word)}` : `Kirim ${cap(doc.word)} ke Pelanggan`}
      subtitle={
        resend
          ? `${cap(doc.word)} yang sama dikirim ulang, status dan nomornya tidak berubah.`
          : `Setelah dikirim, ${doc.word} tidak bisa diubah atau dihapus lagi.`
      }
      footer={
        <>
          <Button variant="default" radius="md" onClick={onClose}>
            Batal
          </Button>
          <Button radius="md" leftSection={<PaperPlaneTilt size={16} />} onClick={submit}>
            {resend ? 'Kirim ulang' : `Kirim ${doc.word}`}
          </Button>
        </>
      }
    >
      <Grid gutter="lg" align="stretch">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Stack gap="md">
            <SaleSummary sale={sale} customer={customer} doc={doc} />

            {!resend && (
              <Alert variant="light" color="orange" radius="md" icon={<Warning size={16} />}>
                <Text fz="xs">
                  {doc.kind === 'order'
                    ? 'Pesanan draf akan terbit menjadi Terkirim dan menunggu konfirmasi pelanggan.'
                    : 'Faktur draf akan terbit menjadi Terkirim dan mulai dihitung sebagai piutang.'}
                </Text>
              </Alert>
            )}

            <TextInput
              label="Email tujuan"
              placeholder="nama@perusahaan.co.id"
              withAsterisk
              radius="md"
              value={to}
              error={submitted && error}
              onChange={(e) => setTo(e.currentTarget.value)}
              description={
                customer?.email
                  ? `Email pelanggan: ${customer.email}`
                  : 'Pelanggan belum punya email.'
              }
            />
            <Textarea
              label="Pesan untuk pelanggan"
              placeholder="Terima kasih atas kerja sama Anda..."
              radius="md"
              autosize
              minRows={2}
              value={note}
              onChange={(e) => setNote(e.currentTarget.value)}
            />
          </Stack>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <PdfPreview sale={sale} customer={customer} doc={doc} />
        </Grid.Col>
      </Grid>
    </FormModal>
  );
}

// Pratinjau berkas yang benar-benar akan dikirim: PDF yang sama dengan tombol Unduh.
// Blob dibuat ulang tiap faktur berganti dan URL-nya dilepas saat dialog ditutup.
function PdfPreview({ sale, customer, doc }) {
  const frame = useRef(null);

  // Blob URL dipasang langsung ke iframe (bukan lewat state) dan dilepas saat dialog
  // ditutup, supaya berkasnya tidak menumpuk di memori.
  useEffect(() => {
    const url = URL.createObjectURL(invoicePdfBlob(sale, { customer, doc }));
    if (frame.current) frame.current.src = `${url}#toolbar=0&navpanes=0&view=FitH`;
    return () => URL.revokeObjectURL(url);
  }, [sale, customer, doc]);

  return (
    <Stack gap={6} h="100%">
      <Group justify="space-between" align="center">
        <Text fz="sm" fw={600} c="slate.9">
          Lampiran
        </Text>
        <Button
          size="compact-xs"
          variant="subtle"
          color="slate"
          leftSection={<DownloadSimple size={14} />}
          onClick={() => downloadInvoice(sale, { customer, doc })}
        >
          Unduh
        </Button>
      </Group>
      <Text fz={11} c="slate.6">
        {sale.number.replace(/\//g, '-')}.pdf
      </Text>
      <Box
        style={{
          flex: 1,
          minHeight: 360,
          border: '1px solid var(--mantine-color-gray-3)',
          borderRadius: 'var(--mantine-radius-md)',
          overflow: 'hidden',
          background: 'var(--mantine-color-slate-0)',
        }}
      >
        <iframe
          ref={frame}
          title={`Pratinjau ${doc.word} ${sale.number}`}
          style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
        />
      </Box>
    </Stack>
  );
}

// Hapus faktur draf. Faktur terkirim tidak pernah sampai ke dialog ini.
export function DeleteModal({ sale, doc = DOC.invoice, onClose, onDelete }) {
  const customer = useCustomer(sale.customerId);

  return (
    <FormModal
      opened
      onClose={onClose}
      size={480}
      icon={Trash}
      title={`Hapus ${cap(doc.word)} Draf`}
      subtitle={`${cap(doc.word)} dihapus permanen dan tidak bisa dikembalikan.`}
      footer={
        <>
          <Button variant="default" radius="md" onClick={onClose}>
            Batal
          </Button>
          <Button color="red" radius="md" leftSection={<Trash size={16} />} onClick={onDelete}>
            Hapus {doc.word}
          </Button>
        </>
      }
    >
      <Stack gap="md">
        <SaleSummary sale={sale} customer={customer} doc={doc} />
        <Alert variant="light" color="red" radius="md" icon={<Warning size={16} />}>
          <Text fz="xs">
            Draf ini belum pernah dikirim ke pelanggan, jadi penghapusannya tidak memengaruhi
            piutang maupun jurnal.
          </Text>
        </Alert>
      </Stack>
    </FormModal>
  );
}

// Dialog alasan: dipakai menolak penawaran (P8) dan membatalkannya (P4).
// Alasan disimpan supaya laporan kalah-menang punya datanya, bukan sekadar status.
export function ReasonModal({
  title,
  subtitle,
  label,
  options,
  // Dialog ini dipakai beberapa aksi (tolak penawaran, batalkan faktur, batalkan
  // pembayaran), jadi contoh catatannya ikut jenis aksinya.
  notePlaceholder = 'Opsional, keterangan tambahan untuk jejak audit...',
  confirmLabel,
  color = 'red',
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState(options?.[0] ?? '');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const error = !reason && 'Alasan wajib dipilih';

  const submit = () => {
    setSubmitted(true);
    if (error) return;
    onConfirm([reason, note.trim()].filter(Boolean).join(' — '));
  };

  return (
    <FormModal
      opened
      onClose={onClose}
      size={480}
      icon={Warning}
      title={title}
      subtitle={subtitle}
      footer={
        <>
          <Button variant="default" radius="md" onClick={onClose}>
            Batal
          </Button>
          <Button color={color} radius="md" onClick={submit}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {options ? (
        <Select
          label={label}
          withAsterisk
          radius="md"
          data={options}
          value={reason}
          error={submitted && error}
          onChange={setReason}
        />
      ) : (
        <TextInput
          label={label}
          withAsterisk
          radius="md"
          value={reason}
          error={submitted && error}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
      )}
      <Textarea
        label="Catatan tambahan"
        placeholder={notePlaceholder}
        radius="md"
        autosize
        minRows={2}
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
      />
    </FormModal>
  );
}

// #22: jurnal di level dokumen — faktur, pembayaran, dan nanti retur/pembatalan.
// Belum ada buku besar, jadi jurnalnya dibentuk ulang dari dokumennya setiap kali dibuka.
// `journals` boleh dikirim langsung untuk dokumen yang jurnalnya dibentuk di luar sini
// (mis. retur, yang butuh faktur sumbernya juga).
export function JournalModal({ sale, journals: given, word = 'Faktur', onClose }) {
  const journals = given ?? saleJournals(sale);

  return (
    <FormModal
      opened
      onClose={onClose}
      size={760}
      icon={Notebook}
      title={`Jurnal ${sale.number}`}
      subtitle="Dibentuk otomatis dari dokumen. Setiap jurnal selalu seimbang."
      footer={
        <Button variant="default" radius="md" onClick={onClose}>
          Tutup
        </Button>
      }
    >
      {journals.length === 0 && (
        <Alert variant="light" color="gray" radius="md" icon={<Warning size={16} />}>
          <Text fz="xs">
            {word} ini masih draf, jadi belum membentuk jurnal. Jurnal terbentuk saat
            dokumennya diterbitkan.
          </Text>
        </Alert>
      )}

      {journals.map((j) => {
        const total = journalTotals(j.lines);
        return (
          <Box
            key={j.id}
            style={{
              border: '1px solid var(--mantine-color-gray-3)',
              borderRadius: 'var(--mantine-radius-md)',
              overflow: 'hidden',
            }}
          >
            <Group justify="space-between" px="md" py="xs" bg="slate.0" wrap="nowrap">
              <Box>
                <Text fz="sm" fw={700} c="slate.9">
                  {j.title}
                </Text>
                <Text fz={11} c="slate.6">
                  {formatDate(j.date)} · {j.source}
                </Text>
              </Box>
              <Badge size="sm" radius="sm" variant="light" color="green" fw={700} tt="none">
                Seimbang
              </Badge>
            </Group>
            <Table verticalSpacing="xs" horizontalSpacing="md" fz="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Akun</Table.Th>
                  <Table.Th w={130} ta="right">
                    Debit
                  </Table.Th>
                  <Table.Th w={130} ta="right">
                    Kredit
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {j.lines.map((l, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>
                      <Text fz="xs" fw={600} c="slate.9">
                        {accountLabel(l.code)}
                      </Text>
                      <Text fz={11} c="slate.6">
                        {l.note}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                      {l.debit ? rupiah(l.debit) : '—'}
                    </Table.Td>
                    <Table.Td ta="right" style={{ whiteSpace: 'nowrap' }}>
                      {l.credit ? rupiah(l.credit) : '—'}
                    </Table.Td>
                  </Table.Tr>
                ))}
                <Table.Tr bg="slate.0">
                  <Table.Td>
                    <Text fz="xs" fw={700} c="slate.9">
                      Total
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right" fw={700} style={{ whiteSpace: 'nowrap' }}>
                    {rupiah(total.debit)}
                  </Table.Td>
                  <Table.Td ta="right" fw={700} style={{ whiteSpace: 'nowrap' }}>
                    {rupiah(total.credit)}
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Box>
        );
      })}
    </FormModal>
  );
}

// #28: tagihan rutin massal — IPL, air, listrik, parkir yang ditagih tiap periode
// ke banyak unit sekaligus. Hasilnya draf, supaya masih diperiksa sebelum terbit.
export function BulkBillingModal({ contacts, onClose, onCreate }) {
  const periodik = products.filter((p) => ['ipl', 'air', 'listrik', 'parkir'].includes(p.id));
  const [productId, setProductId] = useState(periodik[0]?.id ?? '');
  const [period, setPeriod] = useState(TODAY.slice(0, 7));
  const [date, setDate] = useState(TODAY);
  const [due, setDue] = useState(addDays(TODAY, 30));
  const [price, setPrice] = useState(periodik[0]?.price ?? 0);
  const [picked, setPicked] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  const produk = products.find((p) => p.id === productId);
  const pilihProduk = (id) => {
    setProductId(id);
    setPrice(products.find((p) => p.id === id)?.price ?? 0);
  };

  const errors = {
    picked: !picked.length && 'Pilih minimal satu pelanggan',
    price: price <= 0 && 'Harga wajib diisi',
    date: periodLocked(date) && lockedMessage(date),
  };
  const blocked = Object.values(errors).find(Boolean) ?? null;
  const total = price * picked.length;

  const submit = () => {
    setSubmitted(true);
    if (blocked) return;
    onCreate({ productId, period, date, due, price, customerIds: picked });
  };

  return (
    <FormModal
      opened
      onClose={onClose}
      size={640}
      icon={ClipboardText}
      title="Tagihan Rutin Massal"
      subtitle="Membuat satu draf faktur per unit untuk periode yang sama."
      footer={
        <>
          <Button variant="default" radius="md" onClick={onClose}>
            Batal
          </Button>
          <Tooltip label={blocked} disabled={!blocked} withArrow fz="xs" position="top">
            <Button
              radius="md"
              onClick={submit}
              {...blockedProps(blocked, () => setSubmitted(true))}
            >
              Buat {picked.length || ''} draf faktur
            </Button>
          </Tooltip>
        </>
      }
    >
      <SimpleGrid cols={2} spacing="sm">
        <Select
          label="Jenis tagihan"
          radius="md"
          allowDeselect={false}
          data={periodik.map((p) => ({ value: p.id, label: p.name }))}
          value={productId}
          onChange={pilihProduk}
        />
        <TextInput
          type="month"
          label="Periode"
          description="Dicantumkan di deskripsi baris faktur"
          radius="md"
          value={period}
          onChange={(e) => setPeriod(e.currentTarget.value)}
        />
        <TextInput
          type="date"
          label="Tanggal faktur"
          withAsterisk
          radius="md"
          value={date}
          error={submitted && errors.date}
          onChange={(e) => setDate(e.currentTarget.value)}
        />
        <TextInput
          type="date"
          label="Jatuh tempo"
          withAsterisk
          radius="md"
          value={due}
          min={date}
          onChange={(e) => setDue(e.currentTarget.value)}
        />
      </SimpleGrid>

      <NumberField
        money
        label="Harga per unit"
        description={`Harga bawaan ${produk?.name ?? ''} dari master Produk, boleh diubah`}
        withAsterisk
        radius="md"
        prefix="Rp "
        value={price}
        error={submitted && errors.price}
        onChange={(v) => setPrice(Number(v) || 0)}
      />

      <MultiSelect
        label="Unit / pelanggan yang ditagih"
        placeholder={picked.length ? '' : 'Pilih pelanggan...'}
        withAsterisk
        searchable
        clearable
        radius="md"
        data={contacts.map((c) => ({ value: c.id, label: c.displayName }))}
        value={picked}
        error={submitted && errors.picked}
        onChange={setPicked}
      />

      <Alert variant="light" color="primary" radius="md" icon={<Invoice size={16} />}>
        <Text fz="xs">
          {picked.length
            ? `${picked.length} draf faktur akan dibuat · total ${rupiah(total)}. Semuanya berstatus draf, jadi masih bisa diperiksa dan diubah sebelum diterbitkan.`
            : 'Pilih pelanggan untuk melihat jumlah faktur yang akan dibuat.'}
        </Text>
      </Alert>
    </FormModal>
  );
}
