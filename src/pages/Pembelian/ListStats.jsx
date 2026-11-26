import StatCards from '@/components/StatCards.jsx';
import { CheckCircle, ClipboardText, Clock, Invoice, ShoppingCart, Truck, Wallet, Warning } from '@/components/Icon.jsx';
import { hidesPrices } from './permissions.js';
import { fppbjStatus, invStatus, invTotals, poStatus, prCancelledPo, receiptStatus, rupiah, sum } from './utils.js';

const card = (label, value, hint, icon, color) => ({ label, value, hint, icon, color });
const count = (statuses, key) => statuses.filter((status) => status === key).length;

function metrics(tab, pb) {
  switch (tab) {
    case 'fppbj': {
      const statuses = pb.fppbj.map((f) => fppbjStatus(f, pb.calc));
      return [
        card('Total permintaan', statuses.length, 'Seluruh dokumen permintaan', ClipboardText, 'blue'),
        card('Menunggu verifikasi', count(statuses, 'diajukan'), 'Sudah diajukan oleh peminta', Clock, 'orange'),
        card('Menunggu pengadaan', count(statuses, 'diverifikasi'), 'Terverifikasi, belum masuk pengadaan', ShoppingCart, 'cyan'),
        card('Dalam pengadaan', count(statuses, 'dalam_pengadaan'), 'Pengadaan sedang diproses', ShoppingCart, 'blue'),
      ];
    }
    case 'orders': {
      const statuses = pb.pos.map((p) => poStatus(p, pb.calc));
      return [
        card('Total pesanan', statuses.length, 'Seluruh PO barang dan SPK jasa', ShoppingCart, 'blue'),
        card('Menunggu penerimaan', count(statuses, 'menunggu'), 'Menunggu barang atau hasil pekerjaan', Truck, 'blue'),
        card('Diterima sebagian', count(statuses, 'sebagian'), 'Sebagian barang atau jasa sudah diterima', ClipboardText, 'orange'),
        card('Selesai', count(statuses, 'selesai'), 'Pesanan dengan status selesai', CheckCircle, 'green'),
      ];
    }
    case 'receipts': {
      const statuses = pb.receipts.map((r) => receiptStatus(r, pb.invoices));
      return [
        card('Total penerimaan', statuses.length, 'Seluruh dokumen FPB dan BAPP', Truck, 'blue'),
        card('Menunggu persetujuan', count(statuses, 'draf'), 'Penerimaan menunggu tanda tangan', Clock, 'orange'),
        card('Belum difaktur', count(statuses, 'belum_difaktur'), 'Masih ada item yang belum ditagih', Invoice, 'cyan'),
        card('Sudah difaktur', count(statuses, 'sudah_difaktur'), 'Penerimaan selesai ditagih', CheckCircle, 'green'),
      ];
    }
    case 'bills': {
      const bills = pb.invoices.map((invoice) => {
        const totals = invTotals(invoice, pb.calc);
        return { balance: totals.balance, status: invStatus(invoice, totals) };
      });
      const open = bills.filter((bill) => bill.balance > 0);
      const overdue = open.filter((bill) => bill.status === 'tempo');
      return [
        card('Total tagihan', bills.length, 'Seluruh faktur vendor', Invoice, 'blue'),
        card('Belum lunas', open.length, 'Faktur dengan sisa hutang', Clock, 'orange'),
        card('Lewat jatuh tempo', overdue.length, 'Faktur lewat tempo dengan sisa hutang', Warning, 'red'),
        ...(hidesPrices(pb.role) ? [] : [
          card('Sisa hutang', rupiah(sum(open, (bill) => bill.balance)), 'Saldo seluruh faktur belum lunas', Wallet, 'indigo'),
        ]),
      ];
    }
    case 'payments': {
      const active = pb.prs.filter((pr) => !prCancelledPo(pr, pb.calc)).map((pr) => pr.status);
      return [
        card('Total permintaan bayar', pb.prs.length, 'Payment Request DP dan pelunasan', Wallet, 'blue'),
        card('Menunggu persetujuan', count(active, 'diajukan'), 'Permintaan menunggu tanda tangan', Clock, 'orange'),
        card('Menunggu voucher', count(active, 'disetujui'), 'Disetujui, menunggu Payment Voucher', ClipboardText, 'cyan'),
        card('Menunggu pembayaran', count(active, 'diproses'), 'Permintaan yang sedang diproses Finance', Wallet, 'indigo'),
      ];
    }
    default:
      return [];
  }
}

export default function ListStats({ tab, pb }) {
  const items = metrics(tab, pb);
  return items.length ? <StatCards items={items} /> : null;
}
