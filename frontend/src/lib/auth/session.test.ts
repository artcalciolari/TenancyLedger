import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearStoredSession,
  clearLogoutPending,
  configureSessionRefresh,
  decodeJwtPayload,
  getTokenExpiration,
  isSessionExpired,
  isLogoutPending,
  markLogoutPending,
  notifyUnauthorized,
  readAccessToken,
  readStoredSession,
  refreshSession,
  SESSION_STORAGE_KEY,
  SESSION_UNAUTHORIZED_EVENT,
  SESSION_UPDATED_EVENT,
  withSessionCookieLock,
  writeStoredSession,
  type AuthSession,
} from './session';

function jwt(payload: object): string {
  const encoded = btoa(JSON.stringify(payload))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  return `header.${encoded}.signature`;
}

function session(exp = Math.floor(Date.now() / 1000) + 60): AuthSession {
  return {
    accessToken: jwt({ exp, sub: '123' }),
    user: { id: '123', email: 'admin@example.com', role: 'ADMIN', active: true },
  };
}

describe('armazenamento de sessão', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('grava, lê e remove uma sessão válida', () => {
    const value = session();
    writeStoredSession(value);
    expect(readStoredSession()).toEqual(value);
    expect(readAccessToken()).toBe(value.accessToken);
    clearStoredSession();
    expect(readStoredSession()).toBeNull();
  });

  it('remove dados inválidos ou expirados', () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, '{invalid');
    expect(readStoredSession()).toBeNull();

    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session(1)));
    expect(readStoredSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('rejeita shape de usuário inválido', () => {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ accessToken: jwt({}), user: { id: '1', email: 'a@b.com', role: 'OWNER' } }),
    );
    expect(readStoredSession()).toBeNull();
  });

  it.each([
    [null],
    ['text'],
    [{}],
    [{ accessToken: 42, user: {} }],
    [{ accessToken: 'token', user: null }],
    [{ accessToken: 'token', user: { id: 1 } }],
    [{ accessToken: 'token', user: { id: '1', email: 1 } }],
    [{ accessToken: 'token', user: { id: '1', email: 'a@b.com', active: 'yes' } }],
    [
      {
        accessToken: 'token',
        user: { id: '1', email: 'a@b.com', active: true, role: 'OWNER' },
      },
    ],
  ])('remove cada shape inválido %#', (value) => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(value));
    expect(readStoredSession()).toBeNull();
  });

  it.each(['ADMIN', 'MANAGER', 'VIEWER'] as const)('aceita usuário com papel %s', (role) => {
    const value = { ...session(), user: { ...session().user, role } };
    writeStoredSession(value);
    expect(readStoredSession()).toEqual(value);
  });

  it('marca e limpa logout pendente', () => {
    expect(isLogoutPending()).toBe(false);
    markLogoutPending();
    expect(isLogoutPending()).toBe(true);
    clearLogoutPending();
    expect(isLogoutPending()).toBe(false);
  });
});

describe('JWT e expiração', () => {
  it('decodifica payload base64url e calcula expiração em milissegundos', () => {
    const token = jwt({ exp: 123, email: 'a@example.com' });
    expect(decodeJwtPayload(token)).toMatchObject({ exp: 123, email: 'a@example.com' });
    expect(getTokenExpiration(token)).toBe(123_000);
  });

  it('trata tokens inválidos ou sem expiração como não agendáveis', () => {
    expect(decodeJwtPayload('invalid')).toBeNull();
    expect(decodeJwtPayload('header.!.signature')).toBeNull();
    expect(decodeJwtPayload(`header.${btoa('null')}.signature`)).toBeNull();
    expect(getTokenExpiration(jwt({ exp: 'tomorrow' }))).toBeNull();
    expect(getTokenExpiration(jwt({ exp: Number.POSITIVE_INFINITY }))).toBeNull();
    expect(isSessionExpired({ ...session(), accessToken: jwt({}) }, Number.MAX_SAFE_INTEGER)).toBe(
      false,
    );
  });

  it('compara a expiração com o relógio informado', () => {
    const value = session(100);
    expect(isSessionExpired(value, 99_999)).toBe(false);
    expect(isSessionExpired(value, 100_000)).toBe(true);
  });
});

describe('notificação de 401', () => {
  it('publica um evento sem expor o token', () => {
    const listener = vi.fn();
    window.addEventListener(SESSION_UNAUTHORIZED_EVENT, listener);
    notifyUnauthorized();
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_UNAUTHORIZED_EVENT, listener);
  });

  it('notifica atualizações sem transportar o token no evento', () => {
    const listener = vi.fn();
    window.addEventListener(SESSION_UPDATED_EVENT, listener);
    writeStoredSession(session());
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0]?.[0]).not.toHaveProperty('detail');
    window.removeEventListener(SESSION_UPDATED_EVENT, listener);
  });
});

describe('renovação coordenada', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('compartilha uma única rotação entre chamadas concorrentes', async () => {
    const renewed = session();
    let resolveRefresh: ((value: AuthSession) => void) | undefined;
    const requestRefresh = vi.fn(
      () =>
        new Promise<AuthSession>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    configureSessionRefresh(requestRefresh);

    const first = refreshSession();
    const second = refreshSession();
    expect(first).toBe(second);
    await vi.waitFor(() => expect(requestRefresh).toHaveBeenCalledOnce());

    resolveRefresh?.(renewed);
    await expect(first).resolves.toEqual(renewed);
    await expect(second).resolves.toEqual(renewed);
    expect(readStoredSession()).toEqual(renewed);
  });

  it('descarta uma rotação que termina depois do logout local', async () => {
    let resolveRefresh: ((value: AuthSession) => void) | undefined;
    configureSessionRefresh(
      () =>
        new Promise<AuthSession>((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const pending = refreshSession();
    await vi.waitFor(() => expect(resolveRefresh).toBeTypeOf('function'));
    clearStoredSession();
    resolveRefresh?.(session());

    await expect(pending).rejects.toMatchObject({ name: 'SessionRefreshCancelledError' });
    expect(readStoredSession()).toBeNull();
  });

  it('serializa operações que podem alterar o cookie de sessão', async () => {
    const order: string[] = [];
    let finishFirst: (() => void) | undefined;
    const first = withSessionCookieLock(
      () =>
        new Promise<void>((resolve) => {
          order.push('first');
          finishFirst = resolve;
        }),
    );
    const second = withSessionCookieLock(() => {
      order.push('second');
      return Promise.resolve('done');
    });

    await vi.waitFor(() => expect(order).toEqual(['first']));
    finishFirst?.();
    await first;
    await expect(second).resolves.toBe('done');
    expect(order).toEqual(['first', 'second']);
  });

  it('usa Web Locks quando disponível', async () => {
    const request = vi.fn((_name: string, operation: () => Promise<string>) => operation());
    vi.stubGlobal('navigator', { locks: { request } });

    await expect(withSessionCookieLock(() => Promise.resolve('done'))).resolves.toBe('done');
    expect(request).toHaveBeenCalledWith('tenancy-ledger:refresh-session', expect.any(Function));
  });

  it('rejeita refresh antes da configuração', async () => {
    vi.resetModules();
    const freshSession = await import('./session');
    await expect(freshSession.refreshSession()).rejects.toThrow(
      'A renovação da sessão não foi configurada.',
    );
  });

  it('carrega sem BroadcastChannel fora do browser', async () => {
    vi.resetModules();
    vi.stubGlobal('window', undefined);
    await expect(import('./session')).resolves.toBeDefined();
  });

  it('coordena sessão por BroadcastChannel e ignora mensagens inválidas ou durante logout', async () => {
    vi.resetModules();
    let handleMessage: ((event: MessageEvent<unknown>) => void) | undefined;
    const postMessage = vi.fn();
    class FakeBroadcastChannel {
      addEventListener(_type: string, listener: (event: MessageEvent<unknown>) => void) {
        handleMessage = listener;
      }

      postMessage = postMessage;
    }
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    vi.spyOn(Date, 'now').mockReturnValue(123);
    const freshSession = await import('./session');
    const broadcast = session();

    handleMessage?.(new MessageEvent('message', { data: null }));
    handleMessage?.(new MessageEvent('message', { data: { type: 'other' } }));
    handleMessage?.(
      new MessageEvent('message', { data: { type: 'refreshed', session: { invalid: true } } }),
    );
    freshSession.markLogoutPending();
    handleMessage?.(
      new MessageEvent('message', { data: { type: 'refreshed', session: broadcast } }),
    );
    expect(freshSession.readStoredSession()).toBeNull();

    freshSession.clearLogoutPending();
    handleMessage?.(
      new MessageEvent('message', { data: { type: 'refreshed', session: broadcast } }),
    );
    expect(freshSession.readStoredSession()).toEqual(broadcast);

    const requestRefresh = vi.fn(() => Promise.resolve(session()));
    freshSession.configureSessionRefresh(requestRefresh);
    await expect(freshSession.refreshSession()).resolves.toEqual(broadcast);
    expect(requestRefresh).not.toHaveBeenCalled();
    await Promise.resolve();
    freshSession.clearStoredSession();
    await freshSession.refreshSession();
    expect(postMessage).toHaveBeenCalled();
  });
});
