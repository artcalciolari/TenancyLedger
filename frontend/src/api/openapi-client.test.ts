import { describe, expect, it, vi } from 'vitest';
import {
  configureSessionRefresh,
  readStoredSession,
  SESSION_UNAUTHORIZED_EVENT,
  writeStoredSession,
  type AuthSession,
} from '../lib/auth/session';
import type { ApiError } from './problem';
import { executeOpenApi, executeOpenApiVoid, openApiClient } from './openapi-client';

function jwt(subject: string): string {
  const payload = btoa(
    JSON.stringify({ sub: subject, exp: Math.floor(Date.now() / 1000) + 15 * 60 }),
  )
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  return `header.${payload}.signature`;
}

function session(subject: string): AuthSession {
  return {
    accessToken: jwt(subject),
    user: { id: subject, email: `${subject}@example.com`, role: 'ADMIN', active: true },
  };
}

const usersPage = {
  data: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

const unauthorized = () =>
  new Response(JSON.stringify({ title: 'Unauthorized', status: 401 }), {
    status: 401,
    headers: { 'Content-Type': 'application/problem+json' },
  });

const success = () =>
  new Response(JSON.stringify(usersPage), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('OpenAPI client execution', () => {
  it('retorna a resposta tipada de sucesso', async () => {
    const data = { id: '123' };
    await expect(
      executeOpenApi(Promise.resolve({ data, response: new Response(null, { status: 200 }) })),
    ).resolves.toEqual(data);
  });

  it('normaliza respostas problem+json', async () => {
    const error = {
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'Registro em conflito.',
      instance: '/resource',
      requestId: 'req-1',
      timestamp: '2026-07-12T00:00:00.000Z',
    };
    const request = executeOpenApi(
      Promise.resolve({ error, response: new Response(null, { status: 409 }) }),
    );
    const expected: Pick<ApiError, 'status' | 'problem'> = { status: 409, problem: error };
    await expect(request).rejects.toMatchObject(expected);
  });

  it('converte falha de rede em ApiError de status zero', async () => {
    await expect(executeOpenApi(Promise.reject(new TypeError('offline')))).rejects.toMatchObject({
      status: 0,
    });
  });

  it('aceita respostas sem conteúdo', async () => {
    await expect(
      executeOpenApiVoid(Promise.resolve({ response: new Response(null, { status: 204 }) })),
    ).resolves.toBeUndefined();
  });
});

describe('OpenAPI client authentication', () => {
  it('inclui credenciais e coordena um único refresh para respostas 401 concorrentes', async () => {
    const original = session('original');
    const renewed = session('renewed');
    writeStoredSession(original);

    let resolveRefresh: ((value: AuthSession) => void) | undefined;
    const requestRefresh = vi.fn(
      () =>
        new Promise<AuthSession>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    configureSessionRefresh(requestRefresh);

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.credentials).toBe('include');
      return Promise.resolve(
        request.headers.get('Authorization') === `Bearer ${renewed.accessToken}`
          ? success()
          : unauthorized(),
      );
    });

    const first = executeOpenApi(openApiClient.GET('/auth/users'));
    const second = executeOpenApi(openApiClient.GET('/auth/users'));
    await vi.waitFor(() => expect(requestRefresh).toHaveBeenCalledOnce());
    resolveRefresh?.(renewed);

    await expect(Promise.all([first, second])).resolves.toEqual([usersPage, usersPage]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(readStoredSession()).toEqual(renewed);
  });

  it('não cria loop nem tempestade quando o refresh concorrente falha', async () => {
    const original = session('failure');
    writeStoredSession(original);

    let rejectRefresh: ((reason: Error) => void) | undefined;
    const requestRefresh = vi.fn(
      () =>
        new Promise<AuthSession>((_resolve, reject) => {
          rejectRefresh = reject;
        }),
    );
    configureSessionRefresh(requestRefresh);
    const unauthorizedListener = vi.fn();
    window.addEventListener(SESSION_UNAUTHORIZED_EVENT, unauthorizedListener);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(unauthorized());

    const first = executeOpenApi(openApiClient.GET('/auth/users'));
    const second = executeOpenApi(openApiClient.GET('/auth/users'));
    await vi.waitFor(() => expect(requestRefresh).toHaveBeenCalledOnce());
    rejectRefresh?.(new Error('refresh recusado'));

    await expect(Promise.allSettled([first, second])).resolves.toMatchObject([
      { status: 'rejected' },
      { status: 'rejected' },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestRefresh).toHaveBeenCalledOnce();
    expect(unauthorizedListener).toHaveBeenCalledOnce();
    expect(readStoredSession()).toBeNull();
    window.removeEventListener(SESSION_UNAUTHORIZED_EVENT, unauthorizedListener);
  });

  it('repete uma mutação uma única vez preservando seu corpo', async () => {
    const original = session('mutation-old');
    const renewed = session('mutation-new');
    writeStoredSession(original);
    configureSessionRefresh(() => Promise.resolve(renewed));

    const bodies: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      bodies.push(await request.text());
      return request.headers.get('Authorization') === `Bearer ${renewed.accessToken}`
        ? new Response(null, { status: 204 })
        : unauthorized();
    });

    await expect(
      executeOpenApiVoid(
        openApiClient.POST('/auth/change-password', {
          body: { currentPassword: 'Current-password-123!', newPassword: 'New-password-456!' },
        }),
      ),
    ).resolves.toBeUndefined();
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toBe(bodies[0]);
  });
});
