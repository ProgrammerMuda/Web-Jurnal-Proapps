import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { theme } from '@/theme/theme.js';
import { IconProvider } from '@/components/Icon.jsx';
import AppLayout from '@/components/layout/AppLayout.jsx';
import { DataProvider } from '@/lib/store.jsx';
import Ringkasan from '@/pages/Ringkasan/Ringkasan.jsx';
import LaporanKeuangan from '@/pages/LaporanKeuangan/LaporanKeuangan.jsx';
import DaftarAkun from '@/pages/DaftarAkun/DaftarAkun.jsx';
import Penjualan from '@/pages/Penjualan/Penjualan.jsx';
import Pembelian from '@/pages/Pembelian/Pembelian.jsx';
import { formatHash, pembelianNavKey, pembelianTitle } from '@/pages/Pembelian/routes.js';
import {
  formatHash as formatPenjualanHash,
  penjualanNavKey,
  penjualanTitle,
} from '@/pages/Penjualan/routes.js';
import Kontak from '@/pages/Kontak/Kontak.jsx';
import SyaratPembayaran from '@/pages/Pengaturan/SyaratPembayaran.jsx';
import PublicInvoice from '@/pages/Penjualan/PublicInvoice.jsx';

// Registry halaman prototype (belum memakai router; navigasi lewat state).
const pages = {
  ringkasan: { section: 'Utama', title: 'Ringkasan', Component: Ringkasan },
  laporan: { section: 'Utama', title: 'Laporan Keuangan', Component: LaporanKeuangan },
  penjualan: { section: 'Transaksi', title: 'Penjualan', Component: Penjualan },
  pembelian: { section: 'Transaksi', title: 'Pembelian', Component: Pembelian },
  'daftar-akun': { section: 'Master Data', title: 'Daftar Akun', Component: DaftarAkun },
  kontak: { section: 'Master Data', title: 'Kontak', Component: Kontak },
  'syarat-pembayaran': { section: 'Pengaturan', title: 'Syarat Pembayaran', Component: SyaratPembayaran },
};

export default function App() {
  // params: data opsional untuk halaman tujuan (mis. { saleId } untuk membuka rincian faktur).
  const pageFromHash = () => {
    const key = window.location.hash.slice(1).split('/')[0];
    return pages[key] ? key : 'ringkasan';
  };
  const [nav, setNav] = useState(() => ({ page: pageFromHash(), params: null, seq: 0 }));
  const [hash, setHash] = useState(() => window.location.hash);

  // Tombol back/forward browser: ikuti segmen pertama hash.
  useEffect(() => {
    const onHash = () => {
      setHash(window.location.hash);
      setNav((n) => (pageFromHash() === n.page ? n : { page: pageFromHash(), params: null, seq: n.seq + 1 }));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // #invoice/<id>: faktur yang dibagikan ke pelanggan. Dibuka tanpa sidebar dan tanpa
  // menu aplikasi, karena yang membukanya bukan pengguna aplikasi ini.
  const publicInvoiceId = hash.startsWith('#invoice/') ? hash.slice('#invoice/'.length) : null;
  if (publicInvoiceId) {
    return (
      <MantineProvider theme={theme} defaultColorScheme="light">
        <IconProvider>
          <DataProvider>
            <PublicInvoice id={publicInvoiceId} />
          </DataProvider>
        </IconProvider>
      </MantineProvider>
    );
  }

  const { section, title: pageTitle, Component } = pages[nav.page];
  // Pembelian dan Penjualan punya submenu sidebar; menu & judul header mengikuti rute di hash.
  const isPembelian = nav.page === 'pembelian';
  const isPenjualan = nav.page === 'penjualan';
  const activeKey = isPembelian
    ? pembelianNavKey(hash)
    : isPenjualan
      ? penjualanNavKey(hash)
      : nav.page;
  const title = isPembelian
    ? pembelianTitle(hash)
    : isPenjualan
      ? penjualanTitle(hash)
      : pageTitle;

  // Menu yang belum punya halaman diabaikan.
  const navigate = (key, params = null) => {
    if (key.startsWith('pembelian:')) {
      window.location.hash = formatHash({ name: 'tab', tab: key.split(':')[1] });
      window.scrollTo({ top: 0 });
      return;
    }
    if (key.startsWith('penjualan:')) {
      window.location.hash = formatPenjualanHash({ name: 'tab', tab: key.split(':')[1] });
      window.scrollTo({ top: 0 });
      return;
    }
    if (!pages[key]) return;
    if (pageFromHash() !== key) window.location.hash = key;
    setNav((n) => ({ page: key, params, seq: n.seq + 1 }));
    window.scrollTo({ top: 0 });
  };

  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <IconProvider>
        <Notifications position="top-right" limit={3} />
        <DataProvider>
          <AppLayout title={title} section={section} activeKey={activeKey} onNavigate={navigate}>
            {/* key: halaman dipasang ulang setiap navigasi agar params dipakai sebagai state awal */}
            <Component key={nav.seq} params={nav.params} onNavigate={navigate} />
          </AppLayout>
        </DataProvider>
      </IconProvider>
    </MantineProvider>
  );
}
