import { TextInput } from '@mantine/core';
import { CalendarBlank } from '@/components/Icon.jsx';

// Input tanggal: ikon kalender duotone di kiri; ikon bawaan browser disembunyikan (tetap bisa diklik).
export default function DateField(props) {
  return (
    <TextInput
      {...props}
      type="date"
      className={`date-field ${props.className ?? ''}`}
      leftSection={<CalendarBlank size={16} />}
    />
  );
}
