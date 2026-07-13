import createClient, { type Middleware } from 'openapi-fetch';
import { notifyUnauthorized, readAccessToken } from '../lib/auth/session';
import type { paths } from './generated/schema';
import { API_BASE_URL } from './client';
import { ApiError, normalizeProblem } from './problem';

const authenticationMiddleware: Middleware = {
  onRequest({ request }) {
    const accessToken = readAccessToken();
    request.headers.set('Accept', 'application/json, application/problem+json');
    if (accessToken) request.headers.set('Authorization', `Bearer ${accessToken}`);
    return request;
  },
  onResponse({ response }) {
    if (response.status === 401 && readAccessToken()) notifyUnauthorized();
    return response;
  },
};

/** Cliente preferencial para endpoints descritos no snapshot OpenAPI. */
const runtimeFetch: typeof fetch = (input, init) => globalThis.fetch(input, init);

export const openApiClient = createClient<paths>({ baseUrl: API_BASE_URL, fetch: runtimeFetch });
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
