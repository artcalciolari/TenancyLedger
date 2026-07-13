import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  THEME_PREFERENCE_STORAGE_KEY,
  ThemePreferenceProvider,
} from '../../app/theme/ThemePreferenceContext';
import { ThemePreferenceMenu } from './ThemePreferenceMenu';

describe('ThemePreferenceMenu', () => {
  it('persiste a preferência escolhida localmente', async () => {
    const user = userEvent.setup();
    render(
      <ThemePreferenceProvider>
        <ThemePreferenceMenu />
      </ThemePreferenceProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Escolher aparência' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Tema escuro' }));

    expect(localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('dark');
  });

  it('restaura a preferência persistida', async () => {
    localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'light');
    const user = userEvent.setup();
    render(
      <ThemePreferenceProvider>
        <ThemePreferenceMenu />
      </ThemePreferenceProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Escolher aparência' }));

    expect(screen.getByRole('menuitemradio', { name: 'Tema claro' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
