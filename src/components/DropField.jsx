// Unggah berkas dengan drag & drop (atau klik untuk memilih), dipakai modul Pembelian
// dan Penjualan. Prototype menyimpan nama berkas di data, isinya di IndexedDB.
import { useRef, useState } from 'react';
import { ActionIcon, Box, Center, Group, Input, Stack, Text, Tooltip } from '@mantine/core';
import { CheckCircle, FileText, Trash, UploadSimple, Warning, X } from '@/components/Icon.jsx';
import { fmtMB, registerFiles } from '@/lib/fileStore.js';

export const MAX_UPLOAD_MB = 5;
// Finder/Explorer menampilkan ukuran dalam MB desimal (1 MB = 1.000.000 byte); batas mengikuti angka yang dilihat pengguna.
const MAX_BYTES = MAX_UPLOAD_MB * 1_000_000;

// size mengikuti ukuran kolom isian di sekitarnya, supaya labelnya sama dengan label
// TextInput / Select di baris yang sama.
export function DropField({ label, value = [], onChange, error, withAsterisk, multiple = false, accept = '.pdf,.doc,.docx,.xls,.xlsx,image/*', hint = 'PDF, Word, Excel, atau gambar', size = 'sm' }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const [rejected, setRejected] = useState([]);
  const take = (list) => {
    const files = [...(list ?? [])];
    const big = files.filter((f) => f.size > MAX_BYTES);
    setRejected(big.map((f) => ({ name: f.name, size: fmtMB(f.size) })));
    const ok = files.filter((f) => f.size <= MAX_BYTES);
    registerFiles(ok);
    const names = ok.map((f) => f.name);
    if (!names.length) return;
    if (!multiple) return onChange([names[0]]);
    const fresh = names.filter((n) => !value.includes(n));
    if (fresh.length) onChange([...value, ...fresh]);
  };
  const has = value.length > 0;
  // Labelnya diserahkan ke Input.Wrapper milik Mantine, bukan ditiru dengan <Text> +
  // nama kelasnya: tiruan itu tidak ikut mendapat --input-label-size maupun jarak bawah
  // yang sama, jadi ukuran dan tebalnya meleset dari label TextInput / Select di sebelahnya.
  // `error` tidak diteruskan ke wrapper karena pesannya sudah ditampilkan sendiri di bawah,
  // setelah petak unggahnya — bukan menempel di bawah label.
  return (
    <Input.Wrapper label={label} withAsterisk={withAsterisk} size={size}>
      <input ref={input} type="file" multiple={multiple} accept={accept} hidden onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
      <Stack gap="xs">
        {value.map((name) => (
          <Group
            key={name}
            justify="space-between"
            wrap="nowrap"
            p="xs"
            style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-md)', background: 'white' }}
          >
            <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
              <Center w={36} h={36} style={{ flexShrink: 0, borderRadius: 'var(--mantine-radius-md)', background: 'var(--mantine-color-primary-0)' }}>
                <FileText size={20} color="var(--mantine-color-primary-9)" />
              </Center>
              <Box style={{ minWidth: 0 }}>
                <Text fz="sm" fw={700} c="slate.9" truncate>{name}</Text>
                <Group gap={4} wrap="nowrap">
                  <CheckCircle size={13} color="var(--mantine-color-green-7)" />
                  <Text fz={11} fw={600} c="slate.6">
                    {(name.includes('.') ? name.split('.').pop().toUpperCase() + ' · ' : '') + 'Siap dilampirkan'}
                  </Text>
                </Group>
              </Box>
            </Group>
            <Tooltip label="Hapus berkas" withArrow>
              <ActionIcon variant="subtle" color="red" size="lg" radius="md" aria-label={`Hapus ${name}`} onClick={() => onChange(value.filter((v) => v !== name))}>
                <Trash size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ))}
        <Stack
          align="center"
          gap={4}
          py={has ? 'sm' : 'lg'}
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
          style={{
            cursor: 'pointer',
            border: `1.5px dashed var(--mantine-color-${error ? 'red-5' : over ? 'primary-9' : 'gray-4'})`,
            borderRadius: 'var(--mantine-radius-md)',
            background: over ? 'var(--mantine-color-primary-0)' : 'var(--mantine-color-gray-0)',
          }}
        >
          {!has && <UploadSimple size={24} color="var(--mantine-color-slate-6)" />}
          <Text fz="sm" fw={600}>
            {has ? (multiple ? 'Tambah berkas lain: ' : 'Ganti berkas: ') : 'Tarik berkas ke sini, atau '}
            <Text span c="primary.9" fw={700}>pilih berkas</Text>
          </Text>
          {!has && <Text fz={11} c="slate.6">{multiple ? 'Bisa lebih dari satu · ' : ''}{hint} · maks. {MAX_UPLOAD_MB} MB</Text>}
        </Stack>
        {rejected.length > 0 && (
          <Group
            align="flex-start"
            justify="space-between"
            wrap="nowrap"
            p="sm"
            style={{ border: '1px solid var(--mantine-color-red-2)', borderRadius: 'var(--mantine-radius-md)', background: 'var(--mantine-color-red-0)' }}
          >
            <Group gap="sm" align="flex-start" wrap="nowrap" style={{ minWidth: 0 }}>
              <Center w={32} h={32} style={{ flexShrink: 0, borderRadius: 'var(--mantine-radius-md)', background: 'white' }}>
                <Warning size={18} color="var(--mantine-color-red-7)" />
              </Center>
              <Box style={{ minWidth: 0 }}>
                <Text fz="sm" fw={700} c="red.9">{rejected.length > 1 ? `${rejected.length} berkas terlalu besar` : 'Berkas terlalu besar'}</Text>
                <Text fz="xs" c="red.8">Ukuran maksimal {MAX_UPLOAD_MB} MB per berkas dan tidak diunggah.</Text>
                <Stack gap={2} mt={6}>
                  {rejected.map((r) => (
                    <Group key={r.name} gap={6} wrap="nowrap">
                      <Text fz="xs" fw={600} c="slate.8" truncate style={{ minWidth: 0 }}>{r.name}</Text>
                      <Text fz="xs" fw={700} c="red.8" style={{ flexShrink: 0 }}>{r.size}</Text>
                    </Group>
                  ))}
                </Stack>
              </Box>
            </Group>
            <ActionIcon variant="subtle" color="red" size="sm" radius="md" aria-label="Tutup pesan" onClick={() => setRejected([])}>
              <X size={14} />
            </ActionIcon>
          </Group>
        )}
      </Stack>
      {error && <Text fz="xs" c="red.6" mt={4}>{error}</Text>}
    </Input.Wrapper>
  );
}

