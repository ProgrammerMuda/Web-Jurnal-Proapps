// Shell modul Penjualan: menentukan tab aktif dari hash, lalu memasang halaman tab itu.
// Tab yang belum dibangun memakai Placeholder — struktur menu dan rutenya sudah jalan.
import { Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import {
  ChartBar,
  CheckCircle,
  Invoice as InvoiceIcon,
} from '@/components/Icon.jsx';
import { useData } from '@/lib/store.jsx';
import Invoices from './Invoices.jsx';
import Orders from './Orders.jsx';
import Payments from './Payments.jsx';
import Quotes from './Quotes.jsx';
import Placeholder from './Placeholder.jsx';
import Returns from './Returns.jsx';
import ReturnForm from './ReturnForm.jsx';
import SaleForm from './SaleForm.jsx';
import {
  applyReturnToSale,
  canEditReturn,
  nextReturnNumber,
  newReturnFrom,
} from './returns.js';
import { DOC } from './docTypes.js';
import {
  applyInvoicedQty,
  canEditOrder,
  canInvoiceOrder,
  invoicePrefillFromOrder,
  nextOrderNumber,
} from './orders.js';
import {
  canConvertQuote,
  canEditQuote,
  invoicePrefillFromQuote,
  nextQuoteNumber,
  orderPrefillFromQuote,
  QUOTE_VALID_DAYS,
} from './quotes.js';
import { formatHash, parseHash } from './routes.js';
import { formatAddress } from '@/pages/Kontak/utils.js';
import { LATE_FEE_RATE, paymentTerms, TODAY } from './data.js';
import {
  addDays,
  canEdit,
  lateFeeAmount,
  nextInvoiceNumber,
  nowIso,
  numberTaken,
} from './utils.js';

// Isi tiap tab yang belum dibangun: ikon, judul, deskripsi, dan rencana isinya.
// Tab yang belum dibangun: ikon, judul, deskripsi, dan rencana isinya.
const stubs = {
  receivables: {
    icon: ChartBar,
    title: 'Piutang Usaha',
    description:
      'Umur piutang per pelanggan, dihitung dari faktur yang belum lunas dan tanggal jatuh temponya.',
    plan: [
      'Kelompok umur: belum jatuh tempo, 1\u201330, 31\u201360, 61\u201390, > 90 hari',
      'Rekap per pelanggan dengan rincian faktur di dalamnya',
      'Ekspor dan penanda faktur yang perlu segera ditagih',
    ],
  },
};

// #29: isian faktur denda — satu baris denda, nilainya dari sisa tagihan yang telat.
function lateFeePrefill(sale) {
  const { bulan, amount } = lateFeeAmount(sale, LATE_FEE_RATE);
  return {
    customerId: sale.customerId,
    unit: sale.unit,
    billingAddress: sale.billingAddress,
    date: TODAY,
    dueDate: addDays(TODAY, 14),
    term: 'net15',
    items: [
      {
        productId: 'denda',
        description: `Denda ${bulan} bulan atas ${sale.number} (jatuh tempo ${sale.dueDate})`,
        qty: 1,
        price: amount,
        tax: null,
      },
    ],
    memo: `Denda keterlambatan ${LATE_FEE_RATE * 100}% per bulan atas faktur ${sale.number}.`,
  };
}

// Halaman form faktur: menyimpan ke store, lalu pindah ke rincian faktur yang tersimpan.
function SalePage({ view }) {
  const { sales, setSales, orders, setOrders, quotes, setQuotes, contactsById } = useData();
  const editing = view.name === 'sale-edit' ? sales.find((s) => s.id === view.id) : null;

  // S1/S5: faktur yang dibuat dari pesanan atau penawaran datang dengan isian awal.
  const [jenis, sumberId] = (view.from ?? '').split(':');
  const order = jenis === 'order' ? orders.find((o) => o.id === sumberId) : null;
  const quote = jenis === 'quote' ? quotes.find((q) => q.id === sumberId) : null;
  // #29: faktur denda atas faktur yang lewat jatuh tempo.
  const telat = jenis === 'late' ? sales.find((s) => s.id === sumberId) : null;
  const sumber = order ?? quote;
  const kontak = sumber ? contactsById[sumber.customerId] : null;
  const hariIni = TODAY;
  const termDays = sumber
    ? (paymentTerms.find((t) => t.value === sumber.term)?.days ?? 30)
    : null;
  const prefill = telat
    ? lateFeePrefill(telat)
    : order
    ? invoicePrefillFromOrder(order, {
        billingAddress: kontak ? formatAddress(kontak.billing) : '',
        dueDate: addDays(hariIni, termDays),
      })
    : quote
      ? {
          ...invoicePrefillFromQuote(quote, {
            billingAddress: kontak ? formatAddress(kontak.billing) : '',
            dueDate: addDays(hariIni, termDays),
          }),
        }
      : null;

  // Faktur yang sudah terkirim tidak bisa diubah: rutenya dikembalikan ke rinciannya.
  if (view.name === 'sale-edit' && (!editing || !canEdit(editing))) {
    return <Invoices key={view.id} params={{ saleId: view.id }} />;
  }

  const save = (sale) => {
    setSales((list) =>
      list.some((s) => s.id === sale.id)
        ? list.map((s) => (s.id === sale.id ? sale : s))
        : [sale, ...list],
    );
    // S4: qty yang difakturkan dikurangkan dari sisa pesanan, dan fakturnya dicatat
    // sebagai turunan. Penautan terjadi di sini, bukan saat tombol diklik.
    if (!sale.draft && sale.fromOrder) {
      setOrders((list) =>
        list.map((o) =>
          o.id === sale.fromOrder
            ? {
                ...o,
                items: applyInvoicedQty(o, sale.items),
                invoiceIds: [...(o.invoiceIds ?? []), sale.id],
                updatedAt: nowIso(),
              }
            : o,
        ),
      );
    }
    if (!sale.draft && sale.fromQuote) {
      setQuotes((list) =>
        list.map((q) =>
          q.id === sale.fromQuote ? { ...q, invoiceId: sale.id, updatedAt: nowIso() } : q,
        ),
      );
    }
    notifications.show({
      color: 'green',
      icon: <CheckCircle size={18} />,
      title: editing ? 'Faktur diperbarui' : 'Faktur tersimpan',
      message: `${sale.number} ${sale.draft ? 'disimpan sebagai draf' : 'diterbitkan'}.`,
      autoClose: 5000,
      withBorder: true,
      radius: 'md',
    });
    goHash({ name: 'invoice', id: sale.id });
  };

  // #7: dokumen yang masih boleh dijadikan sumber faktur.
  const sumberFaktur = (customerId) =>
    !customerId
      ? []
      : [
          ...orders
            .filter((o) => o.customerId === customerId && canInvoiceOrder(o))
            .map((o) => ({ value: `order:${o.id}`, label: `${o.number} · pesanan` })),
          ...quotes
            .filter((q) => q.customerId === customerId && canConvertQuote(q))
            .map((q) => ({ value: `quote:${q.id}`, label: `${q.number} · penawaran` })),
        ];

  const ambilSumber = (key) => {
    const [jenis, id] = key.split(':');
    const kontakDari = (c) => (contactsById[c] ? formatAddress(contactsById[c].billing) : '');
    if (jenis === 'order') {
      const o = orders.find((x) => x.id === id);
      return (
        o &&
        invoicePrefillFromOrder(o, {
          billingAddress: kontakDari(o.customerId),
          dueDate: addDays(TODAY, paymentTerms.find((t) => t.value === o.term)?.days ?? 30),
        })
      );
    }
    const q = quotes.find((x) => x.id === id);
    return (
      q &&
      invoicePrefillFromQuote(q, {
        billingAddress: kontakDari(q.customerId),
        dueDate: addDays(TODAY, paymentTerms.find((t) => t.value === q.term)?.days ?? 30),
      })
    );
  };

  return (
    <SaleForm
      key={editing?.id ?? 'new'}
      sourcesFor={editing ? null : sumberFaktur}
      loadSource={ambilSumber}
      nextNumber={() => nextInvoiceNumber(sales)}
      numberTaken={(n, id) => numberTaken(sales, n, id)}
      prefill={prefill}
      sourceLabel={
        telat
          ? `Denda keterlambatan atas ${telat.number}`
          : sumber
            ? `Dibuat dari ${sumber.number}`
            : null
      }
      editing={editing}
      initialCustomerId={view.customerId}
      onCancel={() => goHash(editing ? { name: 'invoice', id: editing.id } : { name: 'tab', tab: 'invoices' })}
      onSave={save}
    />
  );
}

// Halaman form penawaran. Masa berlaku bawaannya diisi di sini, bukan di form,
// karena itu aturan penawaran — bukan aturan form.
function QuotePage({ view }) {
  const { quotes, setQuotes } = useData();
  const editing = view.name === 'quote-edit' ? quotes.find((q) => q.id === view.id) : null;

  if (view.name === 'quote-edit' && (!editing || !canEditQuote(editing))) {
    return <Quotes key={view.id} params={{ quoteId: view.id }} />;
  }

  const save = (quote) => {
    setQuotes((list) =>
      list.some((q) => q.id === quote.id)
        ? list.map((q) => (q.id === quote.id ? quote : q))
        : [quote, ...list],
    );
    notifications.show({
      color: 'green',
      icon: <CheckCircle size={18} />,
      title: editing ? 'Penawaran diperbarui' : 'Penawaran tersimpan',
      message: `${quote.number} ${quote.draft ? 'disimpan sebagai draf' : 'siap dikirim'}.`,
      autoClose: 5000,
      withBorder: true,
      radius: 'md',
    });
    goHash({ name: 'quote', id: quote.id });
  };

  return (
    <SaleForm
      key={editing?.id ?? 'new'}
      doc={DOC.quote}
      nextNumber={() => nextQuoteNumber(quotes)}
      numberTaken={(n, id) => numberTaken(quotes, n, id)}
      defaultDueDays={QUOTE_VALID_DAYS}
      editing={editing}
      initialCustomerId={view.customerId}
      onCancel={() =>
        goHash(editing ? { name: 'quote', id: editing.id } : { name: 'tab', tab: 'quotes' })
      }
      onSave={save}
    />
  );
}

// Halaman form pesanan: memakai form yang sama dengan faktur, hanya istilah dan
// penomorannya yang mengikuti jenis dokumen pesanan.
function OrderPage({ view }) {
  const { orders, setOrders, quotes, setQuotes } = useData();
  const editing = view.name === 'order-edit' ? orders.find((o) => o.id === view.id) : null;

  const [jenis, sumberId] = (view.from ?? '').split(':');
  const quote = jenis === 'quote' ? quotes.find((q) => q.id === sumberId) : null;
  const prefill = quote ? orderPrefillFromQuote(quote) : null;

  if (view.name === 'order-edit' && (!editing || !canEditOrder(editing))) {
    return <Orders key={view.id} params={{ orderId: view.id }} />;
  }

  const save = (order) => {
    setOrders((list) =>
      list.some((o) => o.id === order.id)
        ? list.map((o) => (o.id === order.id ? order : o))
        : [order, ...list],
    );
    // Penawaran asal ditandai sudah jadi pesanan begitu pesanannya tersimpan (S5).
    if (order.fromQuote) {
      setQuotes((list) =>
        list.map((q) =>
          q.id === order.fromQuote ? { ...q, orderId: order.id, updatedAt: nowIso() } : q,
        ),
      );
    }
    notifications.show({
      color: 'green',
      icon: <CheckCircle size={18} />,
      title: editing ? 'Pesanan diperbarui' : 'Pesanan tersimpan',
      message: `${order.number} ${order.draft ? 'disimpan sebagai draf' : 'siap dikirim'}.`,
      autoClose: 5000,
      withBorder: true,
      radius: 'md',
    });
    goHash({ name: 'order', id: order.id });
  };

  return (
    <SaleForm
      key={editing?.id ?? 'new'}
      doc={DOC.order}
      sourcesFor={
        editing
          ? null
          : (customerId) =>
              !customerId
                ? []
                : quotes
                    .filter((q) => q.customerId === customerId && canConvertQuote(q))
                    .map((q) => ({ value: `quote:${q.id}`, label: `${q.number} · penawaran` }))
      }
      loadSource={(key) => {
        const q = quotes.find((x) => x.id === key.split(':')[1]);
        return q ? orderPrefillFromQuote(q) : null;
      }}
      nextNumber={() => nextOrderNumber(orders)}
      numberTaken={(n, id) => numberTaken(orders, n, id)}
      prefill={prefill}
      sourceLabel={quote ? `Dibuat dari ${quote.number}` : null}
      editing={editing}
      initialCustomerId={view.customerId}
      onCancel={() =>
        goHash(editing ? { name: 'order', id: editing.id } : { name: 'tab', tab: 'orders' })
      }
      onSave={save}
    />
  );
}

// Halaman form retur. Fakturnya ditentukan dari rute (?from=invoice:<id>) karena
// retur tidak pernah berdiri sendiri; retur yang langsung diterbitkan sekalian
// menempel ke fakturnya di sini, sama seperti saat diterbitkan dari daftar.
function ReturnPage({ view }) {
  const { salesReturns, setSalesReturns, sales, setSales } = useData();
  const editing = view.name === 'return-edit' ? salesReturns.find((r) => r.id === view.id) : null;
  const sumberId = (view.from ?? '').split(':')[1];
  const sale = sales.find((s) => s.id === (editing ? editing.invoiceId : sumberId));
  const [draft] = useState(() =>
    editing ?? (sale ? newReturnFrom(sale, nextReturnNumber(salesReturns)) : null),
  );

  // Rute tanpa faktur yang sah, atau retur yang sudah terbit: kembali ke daftarnya.
  if (!sale || !draft || (editing && !canEditReturn(editing))) {
    return <Returns params={editing ? { returnId: editing.id } : null} />;
  }

  const save = (ret) => {
    setSalesReturns((list) =>
      list.some((r) => r.id === ret.id)
        ? list.map((r) => (r.id === ret.id ? ret : r))
        : [ret, ...list],
    );
    if (!ret.draft) {
      setSales((list) =>
        list.map((s) => (s.id === ret.invoiceId ? { ...applyReturnToSale(s, ret), updatedAt: nowIso() } : s)),
      );
    }
    notifications.show({
      color: 'green',
      icon: <CheckCircle size={18} />,
      title: editing ? 'Retur diperbarui' : 'Retur tersimpan',
      message: `${ret.number} ${ret.draft ? 'disimpan sebagai draf' : 'diterbitkan'}.`,
      autoClose: 5000,
      withBorder: true,
      radius: 'md',
    });
    goHash({ name: 'return', id: ret.id });
  };

  return (
    <ReturnForm
      key={draft.id}
      draft={draft}
      sale={sale}
      numberTaken={(n, id) => numberTaken(salesReturns, n, id)}
      onCancel={() =>
        goHash(editing ? { name: 'return', id: editing.id } : { name: 'tab', tab: 'returns' })
      }
      onSave={save}
    />
  );
}

const goHash = (v) => {
  window.location.hash = formatHash(v);
  window.scrollTo({ top: 0 });
};

// params (dari halaman lain): { saleId } membuka rincian faktur, { createFor } membuka form.
export default function Penjualan({ params }) {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const { tab, view } = parseHash(hash);

  if (tab === 'invoices') {
    // Form faktur punya halaman sendiri (stepper), bukan modal.
    if (view.name === 'sale-new' || view.name === 'sale-edit') {
      return <SalePage view={view} />;
    }
    // #penjualan/invoice/<id> membuka rincian faktur langsung dari URL.
    const p = view.name === 'invoice' ? { ...params, saleId: view.id } : params;
    return <Invoices key={view.name === 'invoice' ? view.id : 'list'} params={p} />;
  }

  if (tab === 'payments') return <Payments />;

  if (tab === 'quotes') {
    if (view.name === 'quote-new' || view.name === 'quote-edit') return <QuotePage view={view} />;
    return (
      <Quotes
        key={view.name === 'quote' ? view.id : 'list'}
        params={view.name === 'quote' ? { quoteId: view.id } : null}
      />
    );
  }

  if (tab === 'orders') {
    if (view.name === 'order-new' || view.name === 'order-edit') return <OrderPage view={view} />;
    return (
      <Orders
        key={view.name === 'order' ? view.id : 'list'}
        params={view.name === 'order' ? { orderId: view.id } : null}
      />
    );
  }

  if (tab === 'returns') {
    if (view.name === 'return-new' || view.name === 'return-edit') return <ReturnPage view={view} />;
    return (
      <Returns
        key={view.name === 'return' ? view.id : 'list'}
        params={view.name === 'return' ? { returnId: view.id } : null}
      />
    );
  }

  const stub = stubs[tab];
  return (
    <Stack gap="lg" p="lg" maw={1440} mx="auto">
      <Placeholder
        icon={stub.icon ?? InvoiceIcon}
        title={stub.title}
        description={stub.description}
        plan={stub.plan}
      />
    </Stack>
  );
}
