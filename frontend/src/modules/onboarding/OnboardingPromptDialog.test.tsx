import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRole } from '../../api/contract';
import type { AuthSession } from '../../lib/auth/session';
import { AuthContext } from '../auth/AuthContext';
import {
  OnboardingPromptDialog,
  PROMPT_DISMISSED_KEY_PREFIX,
  PROMPT_SNOOZED_KEY_PREFIX,
} from './OnboardingPromptDialog';

const userId = 'a1111111-1111-4111-8111-111111111111';
const dismissedKey = `${PROMPT_DISMISSED_KEY_PREFIX}${userId}`;
const snoozedKey = `${PROMPT_SNOOZED_KEY_PREFIX}${userId}`;

function makeSession(role: UserRole): AuthSession {
  return {
    accessToken: 'token',
    user: { id: userId, email: 'admin@example.com', active: true, role },
  };
}

function renderPrompt({
  role = 'ADMIN',
  detectIpad = () => true,
}: { role?: UserRole; detectIpad?: () => boolean } = {}) {
  const router = createMemoryRouter(
    [
      {
        path: '/dashboard',
        element: (
          <>
            <OnboardingPromptDialog detectIpad={detectIpad} />
            <p>Conteúdo do painel</p>
          </>
        ),
      },
      { path: '/onboarding', element: <div>Assistente</div> },
    ],
    { initialEntries: ['/dashboard'] },
  );
  render(
    <AuthContext.Provider
      value={{
        session: makeSession(role),
        reason: null,
        restoring: false,
        startSession: vi.fn(),
        endSession: vi.fn(),
      }}
    >
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  );
  return router;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('OnboardingPromptDialog', () => {
  it('aparece para ADMIN em iPad', async () => {
    renderPrompt();
    expect(await screen.findByRole('region', { name: 'Cadastro assistido' })).toBeVisible();
  });

  it('não bloqueia o conteúdo da página', async () => {
    renderPrompt();
    await screen.findByRole('region', { name: 'Cadastro assistido' });
    // Um diálogo modal tornaria o restante da página inerte; o convite não.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Conteúdo do painel')).toBeVisible();
  });

  it('não aparece para VIEWER', () => {
    renderPrompt({ role: 'VIEWER' });
    expect(screen.queryByRole('region', { name: 'Cadastro assistido' })).not.toBeInTheDocument();
  });

  it('não aparece fora do iPad', () => {
    renderPrompt({ detectIpad: () => false });
    expect(screen.queryByRole('region', { name: 'Cadastro assistido' })).not.toBeInTheDocument();
  });

  it('não aparece com dispensa permanente registrada', () => {
    localStorage.setItem(dismissedKey, String(Date.now()));
    renderPrompt();
    expect(screen.queryByRole('region', { name: 'Cadastro assistido' })).not.toBeInTheDocument();
  });

  it('não aparece com adiamento na sessão atual', () => {
    sessionStorage.setItem(snoozedKey, String(Date.now()));
    renderPrompt();
    expect(screen.queryByRole('region', { name: 'Cadastro assistido' })).not.toBeInTheDocument();
  });

  it('"Agora não" adia apenas na sessão', async () => {
    renderPrompt();
    await userEvent.click(await screen.findByRole('button', { name: 'Agora não' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Cadastro assistido' })).not.toBeInTheDocument(),
    );
    expect(sessionStorage.getItem(snoozedKey)).not.toBeNull();
    expect(localStorage.getItem(dismissedKey)).toBeNull();
  });

  it('"Não mostrar novamente" dispensa permanentemente', async () => {
    renderPrompt();
    await userEvent.click(await screen.findByRole('button', { name: 'Não mostrar novamente' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Cadastro assistido' })).not.toBeInTheDocument(),
    );
    expect(localStorage.getItem(dismissedKey)).not.toBeNull();
  });

  it('"Dispensar convite" apenas adia', async () => {
    renderPrompt();
    await userEvent.click(await screen.findByRole('button', { name: 'Dispensar convite' }));
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Cadastro assistido' })).not.toBeInTheDocument(),
    );
    expect(sessionStorage.getItem(snoozedKey)).not.toBeNull();
    expect(localStorage.getItem(dismissedKey)).toBeNull();
  });

  it('"Abrir assistente" navega, informa a origem e apenas adia', async () => {
    const router = renderPrompt();
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir assistente' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding'));
    expect(router.state.location.state).toEqual({ from: '/dashboard' });
    // Abrir o assistente não é recusa: continua aparecendo em sessões futuras.
    expect(localStorage.getItem(dismissedKey)).toBeNull();
    expect(sessionStorage.getItem(snoozedKey)).not.toBeNull();
  });
});
