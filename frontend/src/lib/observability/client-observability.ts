import { API_BASE_URL } from '../../api/client';
import { ApiError } from '../../api/problem';
import { readAccessToken } from '../auth/session';

export type ClientErrorKind = 'RUNTIME' | 'RENDER' | 'NETWORK';

interface ReportContext {
  kind?: ClientErrorKind;
  requestId?: string | null;
  status?: number;
}

function fingerprint(value: string): string {
  let first = 0xcbf29ce4;
  let second = 0x84222325;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ code, 0x811c9dc5) >>> 0;
  }
  return `${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`;
}

function errorSignature(error: unknown): string {
  if (error instanceof ApiError) return `ApiError:${error.status}:${error.problem.type}`;
  if (error instanceof Error) {
    const frame = error.stack
      ?.split('\n')
      .slice(0, 3)
      .join('|')
      .replaceAll(/https?:\/\/[^\s)]+/g, 'url');
    return `${error.name}:${frame ?? 'no-stack'}`;
  }
  return `unknown:${typeof error}`;
}

export function reportClientError(error: unknown, context: ReportContext = {}): void {
  const token = readAccessToken();
  if (!token || typeof window === 'undefined') return;
  const apiError = error instanceof ApiError ? error : null;
  const report = {
    kind: context.kind ?? (apiError ? 'NETWORK' : 'RUNTIME'),
    fingerprint: fingerprint(errorSignature(error)),
    route: window.location.pathname.slice(0, 240) || '/',
    requestId: context.requestId ?? apiError?.problem.requestId ?? undefined,
    release: import.meta.env.VITE_APP_RELEASE?.slice(0, 80),
    status: context.status ?? apiError?.status,
  };

  void fetch(`${API_BASE_URL}/client-errors`, {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: {
      Accept: 'application/json, application/problem+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(report),
  }).catch(() => undefined);
}

export function installGlobalErrorReporting(): () => void {
  const handleError = (event: ErrorEvent) => reportClientError(event.error ?? event.message);
  const handleRejection = (event: PromiseRejectionEvent) => reportClientError(event.reason);
  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);
  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleRejection);
  };
}
