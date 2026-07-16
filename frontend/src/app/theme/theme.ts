import { createTheme } from '@mui/material/styles';

const focusColor = '#3178b8';

/**
 * Brand tokens outside the MUI palette (sidebar ink, tints, hairlines) — see
 * docs/design/design-handoff-tenancy-ledger-redesign/README.md "Sistema de Design".
 */
export const brand = {
  pageBg: '#F3F1EA',
  surface: '#FFFFFF',
  surfaceSubtle: '#FBFAF6',
  sidebarBg: '#16242B',
  sidebarBorder: 'rgba(255,255,255,0.07)',
  sidebarItemActiveBg: 'rgba(255,255,255,0.08)',
  sidebarItemInactiveFg: '#AEBBBD',
  sidebarIconInactive: '#7C8C90',
  sidebarIconActive: '#79C2C7',
  sidebarGroupLabel: '#8A9AA0',
  sidebarFooterMuted: '#8D9B9E',
  accent: '#0E6E78',
  accentDark: '#0B565E',
  accentTint: '#E4EFF0',
  accentBright: '#79C2C7',
  ocre: '#B9822F',
  textPrimary: '#1C2A30',
  textSecondary: '#5E6E73',
  textTertiary: '#8A969A',
  borderCard: '#EBE6D8',
  borderInput: '#E4DFD2',
  borderRow: '#F1EEE4',
  cardShadow: '0 1px 2px rgba(20,36,43,0.03), 0 10px 26px -18px rgba(20,36,43,0.18)',
  buttonShadow: '0 8px 18px -8px rgba(14,110,120,0.5)',
} as const;

export const statusTones = {
  success: { bg: '#E7F1EA', fg: '#1F5E3C', dot: '#2F7D53' },
  neutral: { bg: '#ECEDEA', fg: '#4B5A5F', dot: '#7C8C90' },
  info: { bg: '#E4EFF0', fg: '#0B565E', dot: '#0E6E78' },
  warning: { bg: '#F6EEDA', fg: '#855812', dot: '#B0771C' },
  error: { bg: '#F7E7E4', fg: '#973129', dot: '#B4443C' },
} as const;

export type StatusTone = keyof typeof statusTones;

export function createAppTheme() {
  return createTheme({
    cssVariables: true,
    palette: {
      mode: 'light',
      primary: { main: brand.accent, dark: brand.accentDark, light: brand.accentBright },
      secondary: { main: brand.textSecondary },
      success: { main: statusTones.success.dot, dark: statusTones.success.fg },
      warning: { main: statusTones.warning.dot, dark: statusTones.warning.fg },
      error: { main: statusTones.error.dot, dark: statusTones.error.fg },
      info: { main: statusTones.info.dot, dark: statusTones.info.fg },
      background: { default: brand.pageBg, paper: brand.surface },
      text: { primary: brand.textPrimary, secondary: brand.textSecondary },
      divider: brand.borderCard,
    },
    typography: {
      fontFamily: '"Hanken Grotesk", ui-sans-serif, system-ui, -apple-system, sans-serif',
      h1: {
        fontFamily: '"Newsreader", Georgia, serif',
        fontSize: 'clamp(1.75rem, 3vw, 2.1rem)',
        fontWeight: 500,
        letterSpacing: '-0.01em',
        lineHeight: 1.2,
      },
      h2: { fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.3 },
      button: { textTransform: 'none', fontWeight: 650 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButtonBase: {
        defaultProps: { disableRipple: false },
        styleOverrides: { root: { minWidth: 44, minHeight: 44 } },
      },
      MuiButton: {
        defaultProps: { variant: 'contained' },
        styleOverrides: {
          root: { borderRadius: 11 },
          contained: {
            boxShadow: brand.buttonShadow,
            '&:hover': { boxShadow: brand.buttonShadow },
          },
        },
      },
      MuiInputBase: { styleOverrides: { root: { minHeight: 44 } } },
      MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 11 } } },
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
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: { borderRadius: 16, borderColor: brand.borderCard, boxShadow: brand.cardShadow },
        },
      },
      MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 600 } } },
      MuiTableCell: {
        styleOverrides: {
          head: {
            textTransform: 'uppercase',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            color: brand.textTertiary,
            backgroundColor: brand.surfaceSubtle,
          },
          root: { borderBottomColor: brand.borderRow },
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
