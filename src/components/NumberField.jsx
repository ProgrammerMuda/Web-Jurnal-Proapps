// NumberInput Mantine dengan tombol naik/turun ikon Phosphor (duotone).
// Pakai komponen ini sebagai pengganti NumberInput; semua prop NumberInput tetap berlaku.
import { NumberInput, UnstyledButton } from '@mantine/core';
import { useRef } from 'react';
import { CaretDown, CaretUp } from '@/components/Icon.jsx';

const iconSizes = { xs: 10, sm: 14, md: 16, lg: 18, xl: 20 };

export default function NumberField({ size = 'sm', disabled, readOnly, hideControls, ...props }) {
  const handlers = useRef(null);
  const iconSize = iconSizes[size] ?? 14;
  const off = disabled || readOnly;

  const control = (dir, Icon) => (
    <UnstyledButton
      className="number-field-control"
      tabIndex={-1}
      aria-hidden
      disabled={off}
      // Jangan pindahkan fokus dari input saat tombol diklik.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => handlers.current?.[dir]()}
    >
      <Icon size={iconSize} />
    </UnstyledButton>
  );

  return (
    <NumberInput
      {...props}
      size={size}
      disabled={disabled}
      readOnly={readOnly}
      hideControls
      handlersRef={handlers}
      rightSection={
        hideControls ? null : (
          <div className="number-field-controls">
            {control('increment', CaretUp)}
            {control('decrement', CaretDown)}
          </div>
        )
      }
      rightSectionPointerEvents="auto"
      rightSectionWidth={`var(--ni-right-section-width-${size})`}
    />
  );
}
