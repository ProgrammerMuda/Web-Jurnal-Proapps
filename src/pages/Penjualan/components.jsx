import { Badge } from '@mantine/core';
import { STATUS } from './utils.js';

// Komponen umum dipakai ulang dari src/components/common.jsx.
export { BackLink, blockedProps, CopyIcon, Field, FormModal, PageIntro } from '@/components/common.jsx';

// map: peta status → label & warna. Faktur memakai STATUS, pesanan memakai ORDER_STATUS.
export function StatusBadge({ status, map = STATUS, size = 'sm' }) {
  const s = map[status] ?? { label: status, color: 'gray' };
  return (
    <Badge size={size} radius="sm" variant="light" color={s.color} fw={700}>
      {s.label}
    </Badge>
  );
}
