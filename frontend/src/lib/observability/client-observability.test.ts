import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeStoredSession } from '../auth/session';
import { reportClientError } from './client-observability';

function token(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 }));
  return `header.${payload}.signature`;
}

describe('client observability', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('envia somente metadados sanitizados e nunca a mensagem do erro', async () => {
    writeStoredSession({
      accessToken: token(),
      user: {
        id: 'e1e28ad1-c2d0-4aef-a3ba-16e5b32532a1',
        email: 'operator@example.test',
        role: 'ADMIN',
        active: true,
      },
    });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 202 }));

    reportClientError(new Error('signed=https://storage.test/private?token=secret'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const [, init] = fetchMock.mock.calls[0] ?? [];
    if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body.');
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body).toMatchObject({ kind: 'RUNTIME', route: '/' });
    expect(body.fingerprint).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(body)).not.toContain('storage.test');
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(new Headers(init.headers).get('Authorization')).toMatch(/^Bearer /);
  });

  it('não envia relatórios sem sessão autenticada', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    reportClientError(new Error('failure'));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
