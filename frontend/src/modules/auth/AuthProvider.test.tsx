import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession } from '../../lib/auth/session';
import { isLogoutPending, readStoredSession, writeStoredSession } from '../../lib/auth/session';
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
  const { endSession, reason, restoring, session: currentSession } = useAuth();
  return (
    <>
      <span>{restoring ? 'restoring' : (currentSession?.user.email ?? reason ?? 'anonymous')}</span>
      <button type="button" onClick={() => endSession()}>
        logout
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
});
