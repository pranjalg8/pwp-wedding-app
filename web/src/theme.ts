import { createTheme, type MantineColorsTuple } from '@mantine/core';

const rose: MantineColorsTuple = [
  '#fff0f3',
  '#ffdfe6',
  '#ffbccb',
  '#ff97af',
  '#f7708f',
  '#e54d72',
  '#c93a5e',
  '#a62e4d',
  '#85243e',
  '#661b30',
];

// Marigold, for small warm accents next to the rose (ornaments, highlights).
const gold: MantineColorsTuple = [
  '#fff8e6',
  '#fcedc9',
  '#f6dc98',
  '#f0c964',
  '#e9b842',
  '#d9a441',
  '#c18b2a',
  '#9c6f1f',
  '#785517',
  '#563c0f',
];

export const theme = createTheme({
  primaryColor: 'rose',
  primaryShade: { light: 6, dark: 5 },
  colors: { rose, gold },
  defaultRadius: 'md',
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '34px', fontWeight: '500', lineHeight: '1.25' },
      h2: { fontSize: '26px', fontWeight: '500', lineHeight: '1.25' },
      h3: { fontSize: '20px', fontWeight: '500', lineHeight: '1.25' },
      h4: { fontSize: '17px', lineHeight: '1.25' },
    },
  },
  components: {
    Card: { defaultProps: { radius: 'lg', withBorder: true, shadow: 'xs' } },
    Paper: { defaultProps: { radius: 'lg', withBorder: true, shadow: 'xs' } },
    Button: { defaultProps: { radius: 'xl' } },
    Badge: { defaultProps: { radius: 'xl', variant: 'light', tt: 'none' } },
  },
});
