import { DEFAULT_THEME } from '@mantine/core';

// primary  = #053079 (shade 9), secondary = #09B2FF (shade 5), slate = Tailwind slate (untuk font)
export const primary = [
  '#eef4ff',
  '#d9e5fb',
  '#b0c8f4',
  '#84a8ec',
  '#5f8ce5',
  '#4678e1',
  '#3a6ee0',
  '#2d5cc4',
  '#1b4399',
  '#053079',
];

export const secondary = [
  '#e5f8ff',
  '#cdeeff',
  '#9bdcff',
  '#64caff',
  '#3bbbff',
  '#09b2ff',
  '#00a0e8',
  '#0082c0',
  '#006a9b',
  '#005578',
];

export const slate = [
  '#f8fafc',
  '#f1f5f9',
  '#e2e8f0',
  '#cbd5e1',
  '#94a3b8',
  '#64748b',
  '#475569',
  '#334155',
  '#1e293b',
  '#0f172a',
];

// Warna sisanya (dark, gray, red, pink, grape, violet, indigo, blue, cyan, teal, green, lime, yellow, orange)
// diambil apa adanya dari palet default Mantine v8.
export const mantineColors = DEFAULT_THEME.colors;

// Pemakaian warna Mantine untuk status/semantik di seluruh aplikasi.
export const semanticColors = {
  success: 'green',
  warning: 'yellow',
  danger: 'red',
  info: 'blue',
  neutral: 'gray',
};
