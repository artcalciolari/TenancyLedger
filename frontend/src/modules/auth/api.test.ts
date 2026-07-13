import { beforeEach, describe, expect, it, vi } from 'vitest';

const { configureSessionRefresh, executeOpenApi, executeOpenApiVoid, post } = vi.hoisted(() => ({
  configureSessionRefresh: vi.fn(),
  executeOpenApi: vi.fn(),
  executeOpenApiVoid: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../api/openapi-client', () => ({
  executeOpenApi,
  executeOpenApiVoid,
  openApiClient: { POST: post },
}));

vi.mock('../../lib/auth/session', () => ({
  configureSessionRefresh,
  refreshSession: vi.fn(),
  withSessionCookieLock: (operation: () => Promise<unknown>) => operation(),
}));

import { authApi } from './api';

describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    post.mockImplementation((path: string) => ({ path }));
  });

  it('aguarda o logout pendente antes de enviar um novo login', async () => {
    let finishLogout: (() => void) | undefined;
    executeOpenApiVoid.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishLogout = resolve;
      }),
    );
    executeOpenApi.mockResolvedValueOnce({
      accessToken: 'access.jwt',
      user: { id: 'admin', email: 'admin@example.test', role: 'ADMIN', active: true },
    });

    const firstLogout = authApi.logout();
    const duplicateLogout = authApi.logout();
    const login = authApi.login({ email: 'admin@example.test', password: 'password' });

    expect(duplicateLogout).toBe(firstLogout);
    expect(post.mock.calls).toEqual([['/auth/logout']]);

    finishLogout?.();
    await firstLogout;
    await login;

    expect(post.mock.calls).toEqual([
      ['/auth/logout'],
      ['/auth/login', { body: { email: 'admin@example.test', password: 'password' } }],
    ]);
  });
});
