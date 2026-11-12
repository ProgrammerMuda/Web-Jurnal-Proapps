import {
  Checkbox,
  CloseButton,
  createTheme,
  Group,
  MultiSelect,
  Pagination,
  Select,
} from '@mantine/core';
import { createElement as h } from 'react';
import {
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  CaretUpDown,
  Check,
  DotsThree,
  Minus,
  X,
} from '@/components/Icon.jsx';
import { mantineColors, primary, secondary, slate, semanticColors } from './colors.js';

// Ikon bawaan Mantine (×, ✓, chevron dropdown, panah pagination) diganti Phosphor duotone
// agar konsisten dengan aturan ikon proyek. Panah atas/bawah NumberInput: lihat NumberField.jsx.

// Opsi Select/MultiSelect: ikon centang Phosphor di kiri label (pengganti CheckIcon Mantine).
const renderOption = ({ option, checked }) =>
  h(
    Group,
    { gap: 8, wrap: 'nowrap' },
    checked ? h(Check, { size: 14, style: { flexShrink: 0 } }) : null,
    h('span', null, option.label),
  );

// Select: caret bawah saat tertutup, caret atas saat terbuka (CSS memilih ikon lewat
// aria-expanded pada input). MultiSelect: caret atas-bawah.
const selectCaret = h(
  'span',
  { className: 'select-caret' },
  h(CaretDown, { size: 14, className: 'select-caret-down' }),
  h(CaretUp, { size: 14, className: 'select-caret-up' }),
);

const comboboxDefaults = { withCheckIcon: false, renderOption };

// Ikon checkbox: centang / strip (indeterminate). className dari Mantine mengatur ukurannya.
const CheckboxIcon = ({ indeterminate, ...others }) => h(indeterminate ? Minus : Check, others);

// Typography, spacing, radius: pakai default Mantine v8 (tidak di-override).
export const theme = createTheme({
  colors: { ...mantineColors, primary, secondary, slate },
  primaryColor: 'primary',
  primaryShade: { light: 9, dark: 4 },
  fontFamily: '"Figtree Variable", Figtree, sans-serif',
  headings: { fontFamily: '"Figtree Variable", Figtree, sans-serif' },
  black: slate[9],
  autoContrast: true,
  other: { semanticColors },
  components: {
    // Dipakai Modal, Alert, Pill (hapus pilihan MultiSelect), dan tombol clear input.
    CloseButton: CloseButton.extend({
      defaultProps: {
        icon: h(X, { style: { width: 'var(--cb-icon-size)', height: 'var(--cb-icon-size)' } }),
      },
    }),
    Select: Select.extend({ defaultProps: { ...comboboxDefaults, rightSection: selectCaret } }),
    MultiSelect: MultiSelect.extend({
      defaultProps: { ...comboboxDefaults, rightSection: h(CaretUpDown, { size: 14 }) },
    }),
    Checkbox: Checkbox.extend({ defaultProps: { icon: CheckboxIcon } }),
    Pagination: Pagination.extend({
      defaultProps: {
        previousIcon: CaretLeft,
        nextIcon: CaretRight,
        dotsIcon: DotsThree,
      },
    }),
  },
});
