import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  configureSessionRefresh,
  clearStoredSession,
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('recusa resposta de sucesso sem corpo tipado', async () => {
    await expect(
      executeOpenApi(Promise.resolve({ response: new Response(null, { status: 200 }) })),
    ).rejects.toMatchObject({ status: 200 });
  });

  it('preserva cancelamentos AbortError', async () => {
    const error = new DOMException('cancelled', 'AbortError');
    await expect(executeOpenApi(Promise.reject(error))).rejects.toBe(error);
    await expect(executeOpenApiVoid(Promise.reject(error))).rejects.toBe(error);
  });

  it('aceita respostas sem conteúdo', async () => {
    await expect(
      executeOpenApiVoid(Promise.resolve({ response: new Response(null, { status: 204 }) })),
    ).resolves.toBeUndefined();
  });

  it('normaliza erro HTTP e falha de rede em respostas sem conteúdo', async () => {
    await expect(
      executeOpenApiVoid(
        Promise.resolve({
          error: { title: 'Conflict', status: 409 },
          response: new Response(null, { status: 409 }),
        }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      executeOpenApiVoid(Promise.reject(new TypeError('offline'))),
    ).rejects.toMatchObject({ status: 0 });
  });
});

describe('OpenAPI client authentication', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(unauthorized()));

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

  it('não tenta refresh em endpoint de sessão ou chamada anônima', async () => {
    configureSessionRefresh(vi.fn());
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(unauthorized()));

    await expect(
      executeOpenApi(
        openApiClient.POST('/auth/login', {
          body: { email: 'admin@example.com', password: 'Password-123!' },
        }),
      ),
    ).rejects.toMatchObject({ status: 401 });
    await expect(executeOpenApi(openApiClient.GET('/auth/users'))).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('encerra a sessão quando a repetição também recebe 401', async () => {
    const original = session('rejected');
    const renewed = session('renewed-rejected');
    writeStoredSession(original);
    configureSessionRefresh(() => Promise.resolve(renewed));
    const listener = vi.fn();
    window.addEventListener(SESSION_UNAUTHORIZED_EVENT, listener);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(unauthorized());

    await expect(executeOpenApi(openApiClient.GET('/auth/users'))).rejects.toMatchObject({
      status: 401,
    });
    expect(readStoredSession()).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(SESSION_UNAUTHORIZED_EVENT, listener);
  });

  it('preserva uma sessão mais nova criada durante a repetição', async () => {
    const original = session('stale');
    const renewed = session('renewed');
    const newest = session('newest');
    writeStoredSession(original);
    configureSessionRefresh(() => Promise.resolve(renewed));
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const request = input instanceof Request ? input : new Request(input);
      if (request.headers.get('Authorization') === `Bearer ${renewed.accessToken}`) {
        writeStoredSession(newest);
      }
      return Promise.resolve(unauthorized());
    });

    await expect(executeOpenApi(openApiClient.GET('/auth/users'))).rejects.toMatchObject({
      status: 401,
    });
    expect(readStoredSession()).toEqual(newest);
  });

  it('repete diretamente com token atualizado por outra chamada', async () => {
    const original = session('original-request');
    const newest = session('newest-request');
    writeStoredSession(original);
    const refresh = vi.fn();
    configureSessionRefresh(refresh);
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const request = input instanceof Request ? input : new Request(input);
      if (request.headers.get('Authorization') === `Bearer ${original.accessToken}`) {
        writeStoredSession(newest);
        return Promise.resolve(unauthorized());
      }
      return Promise.resolve(success());
    });

    await expect(executeOpenApi(openApiClient.GET('/auth/users'))).resolves.toEqual(usersPage);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('renova quando a sessão some enquanto a requisição está em trânsito', async () => {
    const original = session('removed');
    const renewed = session('restored');
    writeStoredSession(original);
    configureSessionRefresh(() => Promise.resolve(renewed));
    let calls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      calls += 1;
      if (calls === 1) {
        clearStoredSession();
        return Promise.resolve(unauthorized());
      }
      return Promise.resolve(success());
    });

    await expect(executeOpenApi(openApiClient.GET('/auth/users'))).resolves.toEqual(usersPage);
    expect(readStoredSession()).toEqual(renewed);
  });

  it('remove requisição retentável quando o fetch falha', async () => {
    writeStoredSession(session('offline'));
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));

    await expect(executeOpenApi(openApiClient.GET('/auth/users'))).rejects.toMatchObject({
      status: 0,
    });
  });
});
