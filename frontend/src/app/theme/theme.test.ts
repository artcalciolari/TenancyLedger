import { describe, expect, it } from 'vitest';
import { createAppTheme } from './theme';

describe('createAppTheme', () => {
  it('cria paletas distintas para os modos claro e escuro', () => {
    const light = createAppTheme('light');
    const dark = createAppTheme('dark');

    expect(light.palette.mode).toBe('light');
    expect(dark.palette.mode).toBe('dark');
    expect(light.palette.background.default).not.toBe(dark.palette.background.default);
  });

  it('mantém alvos interativos e campos com ao menos 44 px', () => {
    const theme = createAppTheme('light');
    expect(theme.components?.MuiButtonBase?.styleOverrides?.root).toMatchObject({
      minWidth: 44,
      minHeight: 44,
    });
    expect(theme.components?.MuiInputBase?.styleOverrides?.root).toMatchObject({ minHeight: 44 });
    expect(theme.components?.MuiLink?.styleOverrides?.root).toMatchObject({ minHeight: 44 });
  });
});
