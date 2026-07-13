import createClient, { type Middleware } from 'openapi-fetch';
import {
  clearStoredSession,
  notifyUnauthorized,
  readAccessToken,
  refreshSession,
} from '../lib/auth/session';
import type { paths } from './generated/schema';
import { API_BASE_URL } from './client';
import { ApiError, normalizeProblem } from './problem';

const sessionEndpoints = new Set(['/auth/login', '/auth/logout', '/auth/refresh']);
const retryableRequests = new Map<string, Request>();

function authorizationToken(request: Request): string | null {
  const value = request.headers.get('Authorization');
  return value?.startsWith('Bearer ') ? value.slice('Bearer '.length) : null;
}

function withAccessToken(request: Request, accessToken: string): Request {
  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  return new Request(request, { headers });
}

function invalidateUnauthorizedSession(accessToken: string): void {
  if (readAccessToken() !== accessToken) return;
  clearStoredSession();
  notifyUnauthorized();
}

const authenticationMiddleware: Middleware = {
  onRequest({ id, request, schemaPath }) {
    const accessToken = readAccessToken();
    const headers = new Headers(request.headers);
    headers.set('Accept', 'application/json, application/problem+json');
    if (accessToken && !sessionEndpoints.has(schemaPath)) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const authenticatedRequest = new Request(request, { headers });
    if (accessToken && !sessionEndpoints.has(schemaPath)) {
      retryableRequests.set(id, authenticatedRequest.clone());
    }
    return authenticatedRequest;
  },
  async onResponse({ id, options, response, schemaPath }) {
    const retryableRequest = retryableRequests.get(id);
    retryableRequests.delete(id);
    if (response.status !== 401 || sessionEndpoints.has(schemaPath) || !retryableRequest) {
      return response;
    }

    const rejectedToken = authorizationToken(retryableRequest);
    if (!rejectedToken) return response;

    try {
      const currentToken = readAccessToken();
      const nextToken =
        currentToken && currentToken !== rejectedToken
          ? currentToken
          : (await refreshSession()).accessToken;
      const retriedResponse = await options.fetch(withAccessToken(retryableRequest, nextToken));
      if (retriedResponse.status === 401) invalidateUnauthorizedSession(nextToken);
      return retriedResponse;
    } catch {
      invalidateUnauthorizedSession(rejectedToken);
      return response;
    }
  },
  onError({ id }) {
    retryableRequests.delete(id);
  },
};

/** Cliente preferencial para endpoints descritos no snapshot OpenAPI. */
const runtimeFetch: typeof fetch = (input, init) =>
  globalThis.fetch(input, { ...init, credentials: 'include' });

export const openApiClient = createClient<paths>({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  fetch: runtimeFetch,
});
openApiClient.use(authenticationMiddleware);

interface OpenApiResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

export async function executeOpenApi<T>(request: Promise<OpenApiResult<T>>): Promise<T> {
  try {
    const { data, error, response } = await request;
    if (!response.ok || error !== undefined) {
      throw new ApiError(
        normalizeProblem(error, response.status, response.headers.get('x-request-id')),
      );
    }
    if (data === undefined) {
      throw new ApiError(
        normalizeProblem(undefined, response.status, response.headers.get('x-request-id')),
      );
    }
    return data;
  } catch (error: unknown) {
    if (
      error instanceof ApiError ||
      (error instanceof DOMException && error.name === 'AbortError')
    ) {
      throw error;
    }
    throw new ApiError(normalizeProblem(undefined, 0), { cause: error });
  }
}

export async function executeOpenApiVoid(request: Promise<OpenApiResult<unknown>>): Promise<void> {
  try {
    const { error, response } = await request;
    if (!response.ok || error !== undefined) {
      throw new ApiError(
        normalizeProblem(error, response.status, response.headers.get('x-request-id')),
      );
    }
  } catch (error: unknown) {
    if (
      error instanceof ApiError ||
      (error instanceof DOMException && error.name === 'AbortError')
    ) {
      throw error;
    }
    throw new ApiError(normalizeProblem(undefined, 0), { cause: error });
  }
}
