import type { ChangePasswordInput, LoginInput, LoginResponse } from '../../api/contract';
import { executeOpenApi, executeOpenApiVoid, openApiClient } from '../../api/openapi-client';
import {
  configureSessionRefresh,
  refreshSession,
  withSessionCookieLock,
} from '../../lib/auth/session';

const requestSessionRefresh = (): Promise<LoginResponse> =>
  executeOpenApi(openApiClient.POST('/auth/refresh'));

configureSessionRefresh(requestSessionRefresh);

let logoutInFlight: Promise<void> | null = null;

function logout(): Promise<void> {
  if (logoutInFlight) return logoutInFlight;
  const request = withSessionCookieLock(() =>
    executeOpenApiVoid(openApiClient.POST('/auth/logout')),
  );
  logoutInFlight = request.finally(() => {
    logoutInFlight = null;
  });
  return logoutInFlight;
}

async function login(input: LoginInput): Promise<LoginResponse> {
  const pendingLogout = logoutInFlight;
  if (pendingLogout) await pendingLogout.catch(() => undefined);
  return withSessionCookieLock(() =>
    executeOpenApi(openApiClient.POST('/auth/login', { body: input })),
  );
}

export const authApi = {
  login,
  refresh: refreshSession,
  logout,
  changePassword: (input: ChangePasswordInput): Promise<void> =>
    executeOpenApiVoid(openApiClient.POST('/auth/change-password', { body: input })),
};
