import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  cssVariables: true,
  palette: {
    primary: { main: '#15558f', dark: '#0e3d6a', light: '#4b7daf' },
    secondary: { main: '#526778' },
    success: { main: '#20744a' },
    warning: { main: '#a15c00' },
    error: { main: '#b42318' },
    info: { main: '#1769aa' },
    background: { default: '#f5f7fa', paper: '#ffffff' },
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', fontWeight: 700, lineHeight: 1.2 },
    h2: { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.3 },
    button: { textTransform: 'none', fontWeight: 650 },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButtonBase: { defaultProps: { disableRipple: false } },
    MuiButton: { defaultProps: { variant: 'contained' } },
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    MuiLink: {
      styleOverrides: {
        root: {
          '&:focus-visible': { outline: '3px solid #75a7d5', outlineOffset: 3 },
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        '*:focus-visible': { outline: '3px solid #75a7d5', outlineOffset: 2 },
        body: { minWidth: 320 },
      },
    },
  },
});
