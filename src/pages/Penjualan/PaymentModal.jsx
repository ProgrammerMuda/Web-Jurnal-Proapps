import {
  Box,
  Button,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import NumberField from '@/components/NumberField.jsx';
import { useState } from 'react';
import { Bank, CalendarBlank, CurrencyCircleDollar, Invoice } from '@/components/Icon.jsx';
import { Field } from './components.jsx';
import { depositAccounts, paymentMethods, TODAY } from './data.js';
import { computeTotals, rupiah, useCustomer } from './utils.js';

function PaymentForm({ sale, onCancel, onSave }) {
  const { total, balance } = computeTotals(sale);
  const customer = useCustomer(sale.customerId);
  const [account, setAccount] = useState(null);
  const [method, setMethod] = useState(null);
  const [date, setDate] = useState(TODAY);
  const [amount, setAmount] = useState(balance);
  const [memo, setMemo] = useState(`Pembayaran faktur ${sale.number}`);
  const [submitted, setSubmitted] = useState(false);

  const amountError =
    !amount || amount <= 0
      ? 'Jumlah pembayaran wajib diisi'
      : amount > balance
        ? `Melebihi sisa tagihan (${rupiah(balance)})`
        : null;
  const errors = {
    account: !account && 'Akun setor wajib dipilih',
    method: !method && 'Cara pembayaran wajib dipilih',
    date: !date && 'Tanggal wajib diisi',
    amount: amountError,
  };

  const submit = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    onSave({ account, method, date, amount, memo });
  };

  const err = (k) => submitted && errors[k];

  return (
    <Stack gap="md">
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

      <SimpleGrid cols={2} spacing="sm">
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
        label="Jumlah Pembayaran (Rp)"
        description="Dapat dicicil/dibayar sebagian"
        withAsterisk
        radius="md"
        min={0}
        thousandSeparator="."
        decimalSeparator=","
        allowNegative={false}
        decimalScale={0}
        value={amount}
        onChange={(v) => setAmount(Number(v) || 0)}
        leftSection={<CurrencyCircleDollar size={14} />}
        error={err('amount')}
      />

      <Textarea
        label="Catatan / Memo"
        radius="md"
        autosize
        minRows={2}
        value={memo}
        onChange={(e) => setMemo(e.currentTarget.value)}
      />

      <Group
        justify="flex-end"
        gap="sm"
        pt="md"
        style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
      >
        <Button variant="default" radius="md" onClick={onCancel}>
          Batal
        </Button>
        <Button radius="md" onClick={submit}>
          Simpan Pembayaran
        </Button>
      </Group>
    </Stack>
  );
}

export default function PaymentModal({ sale, onClose, onSave }) {
  return (
    <Modal
      opened={!!sale}
      onClose={onClose}
      centered
      size={500}
      radius="lg"
      padding="lg"
      title={
        <Group gap="xs">
          <ThemeIcon variant="light" bg="secondary.0" c="secondary.7" size={24} radius="sm">
            <Invoice size={14} />
          </ThemeIcon>
          <Text fw={700} fz="sm" c="slate.9">
            Catat Pembayaran Faktur
          </Text>
        </Group>
      }
    >
      {/* key: form di-reset setiap kali dibuka untuk faktur lain */}
      {sale && <PaymentForm key={sale.id} sale={sale} onCancel={onClose} onSave={onSave} />}
    </Modal>
  );
}
