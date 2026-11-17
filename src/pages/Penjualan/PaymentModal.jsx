import {
  Alert,
  Box,
  Button,
  Checkbox,
  Select,
  SimpleGrid,
  TagsInput,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import NumberField from '@/components/NumberField.jsx';
import { DropField } from '@/components/DropField.jsx';
import { useState } from 'react';
import { ArrowCounterClockwise, Bank, CalendarBlank, Invoice, Tag } from '@/components/Icon.jsx';
import { blockedProps, Field, FormModal } from './components.jsx';
import {
  depositAccounts,
  lockedMessage,
  paymentMethods,
  periodLocked,
  TODAY,
  transactionTags,
} from './data.js';
import { accountLabel, WITHHOLDING_TYPES, withholdingType } from './journal.js';
import { computeTotals, rupiah, useCustomer } from './utils.js';

function PaymentForm({ sale, credit = 0, onCancel, onSave }) {
  const { total, balance } = computeTotals(sale);
  const customer = useCustomer(sale.customerId);
  const [account, setAccount] = useState(null);
  const [method, setMethod] = useState(null);
  const [date, setDate] = useState(TODAY);
  // B3: saldo kredit dari retur bisa dipakai menutup tagihan, bukan hanya mengendap.
  const [fromCredit, setFromCredit] = useState(false);
  const maksimal = fromCredit ? Math.min(balance, credit) : balance;
  const [amount, setAmount] = useState(balance);
  const [memo, setMemo] = useState(`Pembayaran faktur ${sale.number}`);
  const [proofs, setProofs] = useState([]);
  const [tags, setTags] = useState([]);
  // #25: jenis potongan yang dipakai pelanggan saat membayar; tarif dan akunnya ikut.
  const [withholding, setWithholding] = useState('none');
  const [submitted, setSubmitted] = useState(false);

  const amountError =
    !amount || amount <= 0
      ? 'Jumlah pembayaran wajib diisi'
      : amount > balance
        ? `Melebihi sisa tagihan (${rupiah(balance)})`
        : fromCredit && amount > credit
          ? `Melebihi saldo kredit pelanggan (${rupiah(credit)})`
          : null;
  const errors = {
    // Pemakaian kredit tidak menyentuh kas, jadi akun setor dan cara bayarnya kosong.
    account: !fromCredit && !account && 'Akun setor wajib dipilih',
    method: !fromCredit && !method && 'Cara pembayaran wajib dipilih',
    date: (!date && 'Tanggal wajib diisi') || (periodLocked(date) && lockedMessage(date)),
    amount: amountError,
  };

  const submit = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    onSave(
      fromCredit
        ? {
            account: null,
            method: 'Kredit pelanggan',
            date,
            amount,
            memo,
            proofs,
            tags,
            withholdingType: 'none',
            fromCredit: true,
          }
        : { account, method, date, amount, memo, proofs, tags, withholdingType: withholding },
    );
  };

  // Kelebihan bayar ditampilkan seketika (tidak menunggu tombol ditekan) karena
  // angkanya sudah pasti salah saat itu juga — beda dengan kolom yang belum diisi.
  const pph = withholdingType(withholding);
  const potongan = pph.rate ? Math.round(amount * pph.rate) : 0;

  // Kelebihan bayar dan periode tertutup ditandai seketika: dua-duanya sudah pasti
  // salah saat itu juga, beda dengan kolom yang memang belum sempat diisi.
  const err = (k) =>
    (k === 'amount' && amountError) ||
    (k === 'date' && periodLocked(date) && lockedMessage(date)) ||
    (submitted && errors[k]);
  const blocked = Object.values(errors).find(Boolean) ?? null;

  return (
    <FormModal
      opened
      onClose={onCancel}
      size={560}
      icon={Invoice}
      title="Catat Pembayaran Faktur"
      subtitle={`Penerimaan pembayaran untuk ${sale.number}`}
      footer={
        <>
          <Button variant="default" radius="md" onClick={onCancel}>
            Batal
          </Button>
          <Tooltip label={blocked} disabled={!blocked} withArrow fz="xs" position="top">
            <Button
              radius="md"
              onClick={submit}
              {...blockedProps(blocked, () => setSubmitted(true))}
            >
              Simpan Pembayaran
            </Button>
          </Tooltip>
        </>
      }
    >
      <Box
        p="sm"
        bg="slate.0"
        style={{
          border: '1px solid var(--mantine-color-gray-3)',
          borderRadius: 'var(--mantine-radius-md)',
        }}
      >
        <SimpleGrid cols={2} spacing="sm" verticalSpacing="xs">
          <Field label="Nomor Faktur">{sale.number}</Field>
          <Field label="Pelanggan">{customer?.name}</Field>
          <Field label="Total Nilai Faktur">{rupiah(total)}</Field>
          <Field label="Sisa Tagihan" valueProps={{ c: 'red.8' }}>
            {rupiah(balance)}
          </Field>
        </SimpleGrid>
      </Box>

      {credit > 0 && (
        <Checkbox
          radius="sm"
          checked={fromCredit}
          onChange={(e) => {
            const on = e.currentTarget.checked;
            setFromCredit(on);
            setAmount(on ? Math.min(balance, credit) : balance);
          }}
          label={
            <Box>
              <Text fz="sm" fw={600} c="slate.9">
                Gunakan kredit pelanggan
              </Text>
              <Text fz={11} c="slate.6">
                Tersedia {rupiah(credit)} dari retur {customer?.name ?? 'pelanggan ini'}
              </Text>
            </Box>
          }
        />
      )}

      {fromCredit && (
        <Alert
          variant="light"
          color="blue"
          radius="md"
          icon={<ArrowCounterClockwise size={16} />}
        >
          <Text fz="xs">
            Tidak ada uang masuk ke kas: saldo kredit dipakai menutup tagihan, dengan jurnal
            Kredit Pelanggan (debit) lawan piutang (kredit). Maksimal {rupiah(maksimal)}.
          </Text>
        </Alert>
      )}

      {!fromCredit && (
      <Select
        label="Setor ke Akun (Kas & Bank)"
        placeholder="Pilih rekening bank atau kas penerima..."
        withAsterisk
        radius="md"
        searchable
        data={depositAccounts}
        value={account}
        onChange={setAccount}
        leftSection={<Bank size={14} />}
        error={err('account')}
      />
      )}

      <SimpleGrid cols={fromCredit ? 1 : 2} spacing="sm">
        {!fromCredit && (
        <Select
          label="Cara Pembayaran"
          placeholder="Pilih metode transfer/va..."
          withAsterisk
          radius="md"
          data={paymentMethods}
          value={method}
          onChange={setMethod}
          error={err('method')}
        />
        )}
        <TextInput
          type="date"
          label="Tanggal Pembayaran"
          withAsterisk
          radius="md"
          value={date}
          onChange={(e) => setDate(e.currentTarget.value)}
          leftSection={<CalendarBlank size={14} />}
          error={err('date')}
        />
      </SimpleGrid>

      <NumberField
        money
        label="Jumlah Pembayaran"
        description="Dapat dicicil/dibayar sebagian"
        withAsterisk
        radius="md"
        prefix="Rp "
        value={amount}
        onChange={(v) => setAmount(Number(v) || 0)}
        error={err('amount')}
      />

      {/* #25: potongan pajak dicatat saat pembayaran, karena di situlah pelanggan
          memotongnya. Tarif dan akunnya mengikuti jenis yang dipilih. */}
      {!fromCredit && (
      <Select
        label="Potongan pajak oleh pelanggan"
        description={
          pph.rate
            ? `${rupiah(potongan)} dipotong · masuk ${accountLabel(pph.account)}`
            : 'Pilih bila pelanggan memotong PPh saat membayar'
        }
        radius="md"
        allowDeselect={false}
        data={WITHHOLDING_TYPES.map((t) => ({ value: t.value, label: t.label }))}
        value={withholding}
        onChange={setWithholding}
      />
      )}

      {/* Tag transaksi: boleh pilih dari saran atau ketik tag baru lalu Enter. */}
      <TagsInput
        label="Tag"
        description="Untuk mengelompokkan penerimaan di laporan"
        placeholder={tags.length ? '' : 'Pilih tag atau ketik baru...'}
        radius="md"
        clearable
        data={transactionTags}
        value={tags}
        onChange={setTags}
        leftSection={<Tag size={14} />}
      />

      {/* Bukti transfer: komponen unggah yang sama dengan modul Pembelian. */}
      {!fromCredit && (
      <DropField
        label="Bukti pembayaran"
        multiple
        value={proofs}
        onChange={setProofs}
        accept=".pdf,image/*"
        hint="Bukti transfer: PDF atau gambar"
      />
      )}

      <Textarea
        label="Catatan / Memo"
        radius="md"
        autosize
        minRows={2}
        value={memo}
        onChange={(e) => setMemo(e.currentTarget.value)}
      />
    </FormModal>
  );
}

// key: form di-reset setiap kali dibuka untuk faktur lain.
export default function PaymentModal({ sale, credit = 0, onClose, onSave }) {
  if (!sale) return null;
  return (
    <PaymentForm key={sale.id} sale={sale} credit={credit} onCancel={onClose} onSave={onSave} />
  );
}
