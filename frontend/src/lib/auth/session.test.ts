import { describe, expect, it, vi } from 'vitest';
import {
  clearStoredSession,
  decodeJwtPayload,
  getTokenExpiration,
  isSessionExpired,
  notifyUnauthorized,
  readAccessToken,
  readStoredSession,
  SESSION_STORAGE_KEY,
  SESSION_UNAUTHORIZED_EVENT,
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
});

describe('JWT e expiração', () => {
  it('decodifica payload base64url e calcula expiração em milissegundos', () => {
    const token = jwt({ exp: 123, email: 'a@example.com' });
    expect(decodeJwtPayload(token)).toMatchObject({ exp: 123, email: 'a@example.com' });
    expect(getTokenExpiration(token)).toBe(123_000);
  });

  it('trata tokens inválidos ou sem expiração como não agendáveis', () => {
    expect(decodeJwtPayload('invalid')).toBeNull();
    expect(getTokenExpiration(jwt({ exp: 'tomorrow' }))).toBeNull();
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
});
