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

export const theme = createTheme({
  primaryColor: 'rose',
  primaryShade: { light: 6, dark: 5 },
  colors: { rose },
  defaultRadius: 'md',
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
    fontWeight: '600',
  },
  components: {
    Card: { defaultProps: { radius: 'lg' } },
    Paper: { defaultProps: { radius: 'lg' } },
    Button: { defaultProps: { radius: 'xl' } },
    Badge: { defaultProps: { radius: 'xl' } },
  },
});
