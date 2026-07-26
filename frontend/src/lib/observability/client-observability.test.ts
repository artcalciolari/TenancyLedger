import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiProblem } from '../../api/problem';
import { writeStoredSession } from '../auth/session';
import { installGlobalErrorReporting, reportClientError } from './client-observability';

function token(): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 }));
  return `header.${payload}.signature`;
}

describe('client observability', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('não envia relatório fora do browser', () => {
    writeStoredSession({
      accessToken: token(),
      user: {
        id: 'e1e28ad1-c2d0-4aef-a3ba-16e5b32532a1',
        email: 'operator@example.test',
        role: 'ADMIN',
        active: true,
      },
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    vi.stubGlobal('window', undefined);
    reportClientError(new Error('failure'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('prioriza contexto explícito para ApiError e tolera falha ao reportar', async () => {
    writeStoredSession({
      accessToken: token(),
      user: {
        id: 'e1e28ad1-c2d0-4aef-a3ba-16e5b32532a1',
        email: 'operator@example.test',
        role: 'ADMIN',
        active: true,
      },
    });
    const problem: ApiProblem = {
      type: 'https://example.test/problem',
      title: 'Conflict',
      status: 409,
      detail: 'Conflict',
      instance: '',
      requestId: 'problem-request',
      timestamp: '2026-07-13T00:00:00.000Z',
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    reportClientError(new ApiError(problem), {
      kind: 'RENDER',
      requestId: 'context-request',
      status: 503,
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, init] = fetchMock.mock.calls[0] ?? [];
    if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body.');
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body).toMatchObject({
      kind: 'RENDER',
      requestId: 'context-request',
      status: 503,
    });
  });

  it('usa metadados do ApiError e rota atual por padrão', async () => {
    writeStoredSession({
      accessToken: token(),
      user: {
        id: 'e1e28ad1-c2d0-4aef-a3ba-16e5b32532a1',
        email: 'operator@example.test',
        role: 'ADMIN',
        active: true,
      },
    });
    window.history.pushState({}, '', '/contracts');
    const problem: ApiProblem = {
      type: 'https://example.test/problem',
      title: 'Conflict',
      status: 409,
      detail: 'Conflict',
      instance: '',
      requestId: 'problem-request',
      timestamp: '2026-07-13T00:00:00.000Z',
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 202 }));

    reportClientError(new ApiError(problem));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, init] = fetchMock.mock.calls[0] ?? [];
    if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body.');
    expect(JSON.parse(init.body)).toMatchObject({
      kind: 'NETWORK',
      route: '/contracts',
      requestId: 'problem-request',
      status: 409,
    });
    window.history.pushState({}, '', '/');
  });

  it('gera assinatura para erro sem stack e valores desconhecidos', async () => {
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
    const withoutStack = new Error('failure');
    withoutStack.stack = undefined;

    reportClientError(withoutStack);
    reportClientError('failure');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('instala e remove captura global de erros e rejeições', async () => {
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
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const uninstall = installGlobalErrorReporting();

    window.dispatchEvent(new ErrorEvent('error', { error: new Error('runtime') }));
    window.dispatchEvent(new ErrorEvent('error', { message: 'message fallback' }));
    const rejection = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(rejection, 'reason', { value: 'rejected' });
    window.dispatchEvent(rejection);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    uninstall();
    expect(removeEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
  });
});
