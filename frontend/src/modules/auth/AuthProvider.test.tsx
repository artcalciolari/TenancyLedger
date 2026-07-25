import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession } from '../../lib/auth/session';
import {
  isLogoutPending,
  LOGOUT_PENDING_STORAGE_KEY,
  readStoredSession,
  SessionRefreshCancelledError,
  SESSION_UNAUTHORIZED_EVENT,
  SESSION_UPDATED_EVENT,
  writeStoredSession,
} from '../../lib/auth/session';
import { AuthProvider } from './AuthProvider';
import { authApi } from './api';
import { useAuth } from './useAuth';

vi.mock('./api', () => ({
  authApi: {
    changePassword: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
}));

function jwt(subject: string, expiresAt: number): string {
  const payload = btoa(JSON.stringify({ sub: subject, exp: Math.floor(expiresAt / 1000) }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  return `header.${payload}.signature`;
}

function session(subject = 'admin', expiresAt = Date.now() + 15 * 60_000): AuthSession {
  return {
    accessToken: jwt(subject, expiresAt),
    user: { id: subject, email: `${subject}@example.com`, role: 'ADMIN', active: true },
  };
}

function SessionProbe() {
  const { endSession, reason, restoring, session: currentSession, startSession } = useAuth();
  return (
    <>
      <span>{restoring ? 'restoring' : (currentSession?.user.email ?? reason ?? 'anonymous')}</span>
      <button type="button" onClick={() => endSession()}>
        logout
      </button>
      <button type="button" onClick={() => endSession('expired')}>
        expire
      </button>
      <button type="button" onClick={() => startSession(session('started'))}>
        start
      </button>
    </>
  );
}

function TestProviders({ children, queryClient }: PropsWithChildren<{ queryClient: QueryClient }>) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    vi.mocked(authApi.logout).mockResolvedValue();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mantém os consumidores em restoring até restaurar a sessão pelo cookie', async () => {
    const restored = session();
    let resolveRefresh: ((value: AuthSession) => void) | undefined;
    vi.mocked(authApi.refresh).mockReturnValue(
      new Promise<AuthSession>((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    render(
      <TestProviders queryClient={new QueryClient()}>
        <SessionProbe />
      </TestProviders>,
    );
    expect(screen.getByText('restoring')).toBeVisible();

    resolveRefresh?.(restored);
    expect(await screen.findByText(restored.user.email)).toBeVisible();
  });

  it('limpa dados locais e revoga o cookie no logout explícito', async () => {
    const restored = session();
    writeStoredSession(restored);
    vi.mocked(authApi.refresh).mockResolvedValue(restored);
    const queryClient = new QueryClient();
    queryClient.setQueryData(['private'], { value: 'cached' });

    render(
      <TestProviders queryClient={queryClient}>
        <SessionProbe />
      </TestProviders>,
    );
    expect(await screen.findByText(restored.user.email)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => expect(authApi.logout).toHaveBeenCalledOnce());
    expect(screen.getByText('logged-out')).toBeVisible();
    expect(readStoredSession()).toBeNull();
    expect(queryClient.getQueryData(['private'])).toBeUndefined();
    await waitFor(() => expect(isLogoutPending()).toBe(false));
  });

  it('não restaura a sessão após logout remoto falhar', async () => {
    const restored = session();
    writeStoredSession(restored);
    vi.mocked(authApi.logout).mockRejectedValue(new Error('offline'));
    const first = render(
      <TestProviders queryClient={new QueryClient()}>
        <SessionProbe />
      </TestProviders>,
    );
    expect(screen.getByText(restored.user.email)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'logout' }));
    await waitFor(() => expect(isLogoutPending()).toBe(true));
    first.unmount();

    render(
      <TestProviders queryClient={new QueryClient()}>
        <SessionProbe />
      </TestProviders>,
    );
    expect(screen.getByText('anonymous')).toBeVisible();
    expect(authApi.refresh).not.toHaveBeenCalled();
  });

  it('renova a sessão antes da expiração do access token', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T12:00:00.000Z'));
    const restored = session('first', Date.now() + 120_000);
    const renewed = session('second', Date.now() + 15 * 60_000);
    vi.mocked(authApi.refresh).mockResolvedValueOnce(restored).mockResolvedValueOnce(renewed);

    render(
      <TestProviders queryClient={new QueryClient()}>
        <SessionProbe />
      </TestProviders>,
    );
    await act(async () => Promise.resolve());
    expect(screen.getByText(restored.user.email)).toBeVisible();

    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(authApi.refresh).toHaveBeenCalledTimes(2);
    expect(screen.getByText(renewed.user.email)).toBeVisible();
  });

  it('inicia sessão, reage a atualização e encerra por expiração', async () => {
    writeStoredSession(session('initial'));
    const queryClient = new QueryClient();
    queryClient.setQueryData(['private'], 'cached');
    render(
      <TestProviders queryClient={queryClient}>
        <SessionProbe />
      </TestProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'start' }));
    expect(await screen.findByText('started@example.com')).toBeVisible();

    const external = session('external');
    sessionStorage.setItem('tenancy-ledger:session:v1', JSON.stringify(external));
    window.dispatchEvent(new Event(SESSION_UPDATED_EVENT));
    expect(await screen.findByText('external@example.com')).toBeVisible();

    window.dispatchEvent(new Event(SESSION_UNAUTHORIZED_EVENT));
    expect(await screen.findByText('expired')).toBeVisible();
    expect(queryClient.getQueryData(['private'])).toBeUndefined();
  });

  it('encerra sessão quando outra aba marca logout pendente', async () => {
    const current = session();
    writeStoredSession(current);
    render(
      <TestProviders queryClient={new QueryClient()}>
        <SessionProbe />
      </TestProviders>,
    );

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: LOGOUT_PENDING_STORAGE_KEY,
        newValue: '1',
      }),
    );
    expect(await screen.findByText('logged-out')).toBeVisible();
  });

  it('encerra sessão por expiração sem revogar cookie remoto', async () => {
    writeStoredSession(session());
    render(
      <TestProviders queryClient={new QueryClient()}>
        <SessionProbe />
      </TestProviders>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'expire' }));
    expect(await screen.findByText('expired')).toBeVisible();
    expect(authApi.logout).not.toHaveBeenCalled();
  });

  it('ignora eventos de storage sem novo logout pendente', () => {
    const current = session();
    writeStoredSession(current);
    render(
      <TestProviders queryClient={new QueryClient()}>
        <SessionProbe />
      </TestProviders>,
    );

    window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: '1' }));
    window.dispatchEvent(
      new StorageEvent('storage', { key: LOGOUT_PENDING_STORAGE_KEY, newValue: null }),
    );
    expect(screen.getByText(current.user.email)).toBeVisible();
  });

  it('limpa sessão quando restauração falha', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['private'], 'cached');
    vi.mocked(authApi.refresh).mockRejectedValue(new Error('offline'));

    render(
      <TestProviders queryClient={queryClient}>
        <SessionProbe />
      </TestProviders>,
    );

    expect(await screen.findByText('anonymous')).toBeVisible();
    expect(queryClient.getQueryData(['private'])).toBeUndefined();
  });

  it('ignora cancelamento esperado durante restauração', async () => {
    vi.mocked(authApi.refresh).mockRejectedValue(new SessionRefreshCancelledError());

    render(
      <TestProviders queryClient={new QueryClient()}>
        <SessionProbe />
      </TestProviders>,
    );

    expect(await screen.findByText('anonymous')).toBeVisible();
  });

  it('ignora conclusão de restauração após desmontagem', async () => {
    let resolveRefresh: ((value: AuthSession) => void) | undefined;
    vi.mocked(authApi.refresh).mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );
    const view = render(
      <TestProviders queryClient={new QueryClient()}>
        <SessionProbe />
      </TestProviders>,
    );
    view.unmount();
    resolveRefresh?.(session());
    await act(async () => Promise.resolve());
  });

  it('ignora falha de restauração após desmontagem', async () => {
    let rejectRefresh: ((error: Error) => void) | undefined;
    vi.mocked(authApi.refresh).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectRefresh = reject;
      }),
    );
    const view = render(
      <TestProviders queryClient={new QueryClient()}>
        <SessionProbe />
      </TestProviders>,
    );
    view.unmount();
    rejectRefresh?.(new Error('offline'));
    await act(async () => Promise.resolve());
  });

  it('não agenda renovação para token sem expiração', () => {
    const current = { ...session(), accessToken: jwt('no-expiration', Number.NaN) };
    writeStoredSession(current);
    const timeout = vi.spyOn(window, 'setTimeout');

    render(
      <TestProviders queryClient={new QueryClient()}>
        <SessionProbe />
      </TestProviders>,
    );

    expect(screen.getByText(current.user.email)).toBeVisible();
    expect(timeout).not.toHaveBeenCalled();
  });

  it('expira sessão quando renovação agendada falha', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T12:00:00.000Z'));
    const current = session('current', Date.now() + 60_000);
    writeStoredSession(current);
    vi.mocked(authApi.refresh).mockRejectedValue(new Error('offline'));

    render(
      <TestProviders queryClient={new QueryClient()}>
        <SessionProbe />
      </TestProviders>,
    );
    await act(async () => vi.runOnlyPendingTimersAsync());
    expect(screen.getByText('expired')).toBeVisible();
  });

  it('preserva sessão quando renovação agendada é cancelada', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T12:00:00.000Z'));
    const current = session('current', Date.now() + 60_000);
    writeStoredSession(current);
    vi.mocked(authApi.refresh).mockRejectedValue(new SessionRefreshCancelledError());

    render(
      <TestProviders queryClient={new QueryClient()}>
        <SessionProbe />
      </TestProviders>,
    );
    await act(async () => vi.runOnlyPendingTimersAsync());
    expect(screen.getByText(current.user.email)).toBeVisible();
  });
});
