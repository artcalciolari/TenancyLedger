import { createTheme } from '@mui/material/styles';

const focusColor = '#3178b8';

/**
 * Tokens da direção "Livro-Razão": tinta verde-negra, verde-garrafa, porcelana,
 * latão em fio e o vermelho de margem contábil. Ver
 * docs/design/design-handoff-tenancy-ledger-redesign/README.md e a proposta aprovada.
 */
export const brand = {
  pageBg: '#FAFAF6',
  surface: '#FFFFFF',
  surfaceSubtle: '#F7F6F0',
  sidebarBg: '#16211C',
  sidebarBorder: 'rgba(242,241,234,0.12)',
  sidebarItemActiveBg: 'rgba(255,255,255,0.05)',
  sidebarItemInactiveFg: '#B9C0B7',
  sidebarIconInactive: '#77837C',
  sidebarIconActive: '#E8E7DF',
  sidebarGroupLabel: '#8B968D',
  sidebarFooterMuted: '#8B968D',
  accent: '#175045',
  accentDark: '#103A32',
  accentTint: '#E7EEEB',
  accentBright: '#7FB8A6',
  latao: '#A98C4B',
  razao: '#B03A2E',
  razaoTint: '#F7E9E6',
  textPrimary: '#1B2620',
  textSecondary: '#4C5A53',
  textTertiary: '#79837D',
  borderCard: '#E6E3D8',
  borderInput: '#DDD9CC',
  borderRow: '#EFEDE4',
  cardShadow: '0 1px 2px rgba(16,26,20,0.04)',
  buttonShadow: '0 1px 2px rgba(16,26,20,0.16)',
  fontDisplay: '"Fraunces Variable", Georgia, serif',
  fontMono: '"IBM Plex Mono", ui-monospace, monospace',
} as const;

export const statusTones = {
  success: { bg: '#E9F0EB', fg: '#2E6B4F', dot: '#3B7A5D' },
  neutral: { bg: '#EDECE6', fg: '#4C5A53', dot: '#79837D' },
  info: { bg: '#E7EEEB', fg: '#175045', dot: '#1F6152' },
  warning: { bg: '#F5EEDC', fg: '#8A6116', dot: '#A67A1F' },
  error: { bg: '#F7E9E6', fg: '#9C3327', dot: '#B03A2E' },
} as const;

export type StatusTone = keyof typeof statusTones;

export function createAppTheme() {
  return createTheme({
    cssVariables: true,
    breakpoints: {
      // iPad em portrait usa a composição compacta; a partir de md (landscape), desktop.
      values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 },
    },
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
      fontFamily: '"Archivo Variable", ui-sans-serif, system-ui, -apple-system, sans-serif',
      h1: {
        fontFamily: brand.fontDisplay,
        fontSize: 'clamp(1.75rem, 3vw, 2.15rem)',
        fontWeight: 540,
        letterSpacing: '-0.015em',
        lineHeight: 1.15,
      },
      h2: { fontSize: '1.02rem', fontWeight: 650, lineHeight: 1.3 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiButtonBase: {
        defaultProps: { disableRipple: false },
        styleOverrides: {
          root: {
            minWidth: 44,
            minHeight: 44,
            touchAction: 'manipulation',
          },
        },
      },
      MuiButton: {
        defaultProps: { variant: 'contained' },
        styleOverrides: {
          root: { borderRadius: 8, letterSpacing: '0.01em' },
          contained: {
            boxShadow: brand.buttonShadow,
            '&:hover': { boxShadow: brand.buttonShadow },
          },
        },
      },
      MuiInputBase: { styleOverrides: { root: { minHeight: 44 } } },
      MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
      MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8 } } },
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
          root: { borderRadius: 10, borderColor: brand.borderCard, boxShadow: brand.cardShadow },
        },
      },
      MuiChip: { styleOverrides: { root: { borderRadius: 4, fontWeight: 600 } } },
      MuiTableCell: {
        styleOverrides: {
          head: {
            textTransform: 'uppercase',
            fontSize: '0.7rem',
            fontWeight: 650,
            letterSpacing: '0.09em',
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
