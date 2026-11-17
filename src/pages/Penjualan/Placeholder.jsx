// Halaman tab Penjualan yang belum dibangun. Menyatakan apa yang akan ada di sini,
// bukan layar kosong — supaya struktur menu bisa ditelusuri tanpa menyesatkan.
import { Box, Card, Group, List, Text, ThemeIcon } from '@mantine/core';
import { Info } from '@/components/Icon.jsx';
import { PageIntro } from './components.jsx';

export default function Placeholder({ icon, title, description, plan = [] }) {
  return (
    <>
      <PageIntro icon={icon} title={title} description={description} />
      <Card withBorder radius="lg" padding="xl" bg="white">
        <Group gap="md" wrap="nowrap" align="flex-start">
          <ThemeIcon size={40} radius="md" variant="light" color="slate">
            <Info size={22} />
          </ThemeIcon>
          <Box>
            <Text fz="sm" fw={700} c="slate.9">
              Halaman ini belum dibangun
            </Text>
            <Text fz="xs" c="slate.6" maw={620}>
              Menu dan rutenya sudah aktif, isinya menyusul. Rencana isi halaman ini:
            </Text>
            <List fz="xs" c="slate.7" spacing={4} mt="sm" withPadding>
              {plan.map((p) => (
                <List.Item key={p}>{p}</List.Item>
              ))}
            </List>
          </Box>
        </Group>
      </Card>
    </>
  );
}
