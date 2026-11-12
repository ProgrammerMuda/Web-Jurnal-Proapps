// Daftar berkas terlampir: lihat (pratinjau), unduh, dan bagikan.
import { useEffect, useState } from 'react';
import { ActionIcon, Box, Button, Center, Group, Menu, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { Copy, DownloadSimple, EnvelopeSimple, Eye, FileText, Link, ShareNetwork } from '@/components/Icon.jsx';
import { FormModal } from './components.jsx';
import { downloadFile, extOf, fmtMB, loadFile } from './fileStore.js';
import { toast } from './usePb.js';

function Preview({ name, file, onClose }) {
  const [url] = useState(() => (file ? URL.createObjectURL(file) : null));
  const close = () => {
    if (url) URL.revokeObjectURL(url);
    onClose();
  };
  const isImg = file?.type.startsWith('image/');
  const isPdf = file?.type === 'application/pdf';
  return (
    <FormModal
      opened
      onClose={close}
      size={860}
      icon={FileText}
      title={name}
      subtitle={file ? `${extOf(name)} · ${fmtMB(file.size)}` : extOf(name)}
      footer={
        <>
          <Button variant="default" radius="md" onClick={close}>Tutup</Button>
          <Button radius="md" leftSection={<DownloadSimple size={16} />} onClick={() => downloadFile(name)}>Unduh</Button>
        </>
      }
    >
      {url && isImg && <Box component="img" src={url} alt={name} style={{ maxWidth: '100%', borderRadius: 'var(--mantine-radius-md)' }} />}
      {url && isPdf && <Box component="iframe" src={url} title={name} style={{ width: '100%', height: 480, border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }} />}
      {(!file || (!isImg && !isPdf)) && (
        <Stack align="center" gap={6} py={48} bg="slate.0" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
          <ThemeIcon variant="light" size={56} radius="xl"><FileText size={28} /></ThemeIcon>
          <Text fz="sm" fw={700}>Pratinjau tidak tersedia</Text>
          <Text fz="xs" c="slate.6" ta="center" maw={380}>
            {file ? 'Jenis berkas ini tidak bisa ditampilkan di sini. Unduh untuk membukanya.' : 'Isi berkas ini tidak ditemukan di browser ini. Unggah ulang berkasnya untuk melihat pratinjau.'}
          </Text>
        </Stack>
      )}
    </FormModal>
  );
}

function AttachmentRow({ name, label, compact }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    let alive = true;
    loadFile(name).then((f) => alive && setFile(f));
    return () => { alive = false; };
  }, [name]);
  const link = typeof window !== 'undefined' ? window.location.href : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast(`Tautan ${name} disalin.`);
    } catch {
      toast('Tautan tidak bisa disalin di browser ini.', 'Gagal');
    }
  };
  const email = () => window.open(`mailto:?subject=${encodeURIComponent(`${label} · ${name}`)}&body=${encodeURIComponent(`Berkas ${name} (${label}):\n${link}`)}`, '_self');
  const wa = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${label} · ${name}\n${link}`)}`, '_blank', 'noopener');
  if (compact) {
    return (
      <Group gap={4} wrap="nowrap">
        <FileText size={16} color="var(--mantine-color-primary-9)" style={{ flexShrink: 0 }} />
        <Text fz="xs" fw={600} c="slate.8" truncate maw={150}>{name}</Text>
        <Tooltip label="Lihat" withArrow>
          <ActionIcon variant="subtle" size="sm" aria-label={`Lihat ${name}`} onClick={() => setPreview(true)}><Eye size={15} /></ActionIcon>
        </Tooltip>
        <Tooltip label="Unduh" withArrow>
          <ActionIcon variant="subtle" size="sm" aria-label={`Unduh ${name}`} onClick={() => downloadFile(name)}><DownloadSimple size={15} /></ActionIcon>
        </Tooltip>
        {preview && <Preview name={name} file={file} onClose={() => setPreview(false)} />}
      </Group>
    );
  }
  return (
    <Group justify="space-between" wrap="nowrap" p="sm" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)' }}>
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
        <Center w={40} h={40} style={{ flexShrink: 0, borderRadius: 'var(--mantine-radius-md)', background: 'var(--mantine-color-primary-0)' }}>
          <FileText size={22} color="var(--mantine-color-primary-9)" />
        </Center>
        <Box style={{ minWidth: 0 }}>
          <Text fz="sm" fw={700} c="slate.9" truncate>{name}</Text>
          <Text fz={11} c="slate.6">{extOf(name)}{file ? ` · ${fmtMB(file.size)}` : ''}</Text>
        </Box>
      </Group>
      <Group gap={4} wrap="nowrap">
        <Tooltip label="Lihat" withArrow>
          <ActionIcon variant="default" size="lg" radius="md" aria-label={`Lihat ${name}`} onClick={() => setPreview(true)}><Eye size={18} /></ActionIcon>
        </Tooltip>
        <Tooltip label="Unduh" withArrow>
          <ActionIcon variant="default" size="lg" radius="md" aria-label={`Unduh ${name}`} onClick={() => downloadFile(name)}><DownloadSimple size={18} /></ActionIcon>
        </Tooltip>
        <Menu position="bottom-end" width={220} shadow="md" withinPortal>
          <Menu.Target>
            <Tooltip label="Bagikan" withArrow>
              <ActionIcon variant="default" size="lg" radius="md" aria-label={`Bagikan ${name}`}><ShareNetwork size={18} /></ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Bagikan berkas</Menu.Label>
            <Menu.Item fz="sm" leftSection={<Copy size={16} />} onClick={copy}>Salin tautan</Menu.Item>
            <Menu.Item fz="sm" leftSection={<EnvelopeSimple size={16} />} onClick={email}>Kirim lewat email</Menu.Item>
            <Menu.Item fz="sm" leftSection={<Link size={16} />} onClick={wa}>Kirim lewat WhatsApp</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      {preview && <Preview name={name} file={file} onClose={() => setPreview(false)} />}
    </Group>
  );
}

export default function AttachmentList({ names, label, compact }) {
  return (
    <Stack gap="xs">
      {names.map((name) => <AttachmentRow key={name} name={name} label={label} compact={compact} />)}
    </Stack>
  );
}
