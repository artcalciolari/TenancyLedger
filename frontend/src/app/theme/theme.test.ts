import { describe, expect, it } from 'vitest';
import { createAppTheme } from './theme';

describe('createAppTheme', () => {
  it('cria um tema claro fixo com a paleta da marca', () => {
    const theme = createAppTheme();

    expect(theme.palette.mode).toBe('light');
    expect(theme.palette.background.default).toBe('#F3F1EA');
    expect(theme.palette.primary.main).toBe('#0E6E78');
  });

  it('mantém alvos interativos e campos com ao menos 44 px', () => {
    const theme = createAppTheme();
    expect(theme.components?.MuiButtonBase?.styleOverrides?.root).toMatchObject({
      minWidth: 44,
      minHeight: 44,
    });
    expect(theme.components?.MuiInputBase?.styleOverrides?.root).toMatchObject({ minHeight: 44 });
    expect(theme.components?.MuiLink?.styleOverrides?.root).toMatchObject({ minHeight: 44 });
  });
});
