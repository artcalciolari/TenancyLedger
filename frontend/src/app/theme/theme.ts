import { createTheme, type PaletteMode } from '@mui/material/styles';

export function createAppTheme(mode: PaletteMode) {
  const focusColor = mode === 'dark' ? '#90caf9' : '#3178b8';

  return createTheme({
    cssVariables: true,
    palette: {
      mode,
      primary:
        mode === 'dark'
          ? { main: '#75a7d5', dark: '#4b7daf', light: '#a4d4ff' }
          : { main: '#15558f', dark: '#0e3d6a', light: '#4b7daf' },
      secondary: { main: mode === 'dark' ? '#9eb1c1' : '#526778' },
      success: { main: mode === 'dark' ? '#66bb8a' : '#20744a' },
      warning: { main: mode === 'dark' ? '#ffb74d' : '#a15c00' },
      error: { main: mode === 'dark' ? '#f2766d' : '#b42318' },
      info: { main: mode === 'dark' ? '#64b5f6' : '#1769aa' },
      background:
        mode === 'dark'
          ? { default: '#101820', paper: '#18232d' }
          : { default: '#f5f7fa', paper: '#ffffff' },
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
      MuiButtonBase: {
        defaultProps: { disableRipple: false },
        styleOverrides: { root: { minWidth: 44, minHeight: 44 } },
      },
      MuiButton: { defaultProps: { variant: 'contained' } },
      MuiInputBase: { styleOverrides: { root: { minHeight: 44 } } },
      MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
      MuiLink: {
        styleOverrides: {
          root: {
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 44,
            '&:focus-visible': { outline: `3px solid ${focusColor}`, outlineOffset: 3 },
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          '*:focus-visible': { outline: `3px solid ${focusColor}`, outlineOffset: 2 },
          body: { minWidth: 320 },
        },
      },
    },
  });
}
