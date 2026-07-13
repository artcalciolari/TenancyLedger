import type { LoginResponse, UserRole, UserView } from '../../api/contract';

export const SESSION_STORAGE_KEY = 'tenancy-ledger:session:v1';
export const SESSION_UNAUTHORIZED_EVENT = 'tenancy-ledger:session-unauthorized';
export const SESSION_UPDATED_EVENT = 'tenancy-ledger:session-updated';
export const LOGOUT_PENDING_STORAGE_KEY = 'tenancy-ledger:logout-pending:v1';

export type AuthSession = LoginResponse;

type SessionRefreshRequest = () => Promise<AuthSession>;

let requestSessionRefresh: SessionRefreshRequest | null = null;
let refreshInFlight: Promise<AuthSession> | null = null;
let cookieMutationTail: Promise<void> = Promise.resolve();
let sessionRevision = 0;
let latestBroadcastSession: { session: AuthSession; receivedAt: number } | null = null;

interface JwtPayload {
  exp?: number;
  sub?: string;
  email?: string;
  role?: UserRole;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isUser = (value: unknown): value is UserView => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.email === 'string' &&
    typeof value.active === 'boolean' &&
    (value.role === 'ADMIN' || value.role === 'MANAGER' || value.role === 'VIEWER')
  );
};

const isSession = (value: unknown): value is AuthSession =>
  isRecord(value) && typeof value.accessToken === 'string' && isUser(value.user);

const sessionChannel =
  typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function'
    ? new window.BroadcastChannel('tenancy-ledger:auth-session:v1')
    : null;

sessionChannel?.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (!isRecord(event.data) || event.data.type !== 'refreshed' || !isSession(event.data.session)) {
    return;
  }
  if (isLogoutPending()) return;
  latestBroadcastSession = { session: event.data.session, receivedAt: Date.now() };
  writeStoredSession(event.data.session);
});

export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const encoded = token.split('.')[1];
    if (!encoded) return null;
    const padded = encoded
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      .padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    const value: unknown = JSON.parse(atob(padded));
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

export function getTokenExpiration(token: string): number | null {
  const expiration = decodeJwtPayload(token)?.exp;
  return typeof expiration === 'number' && Number.isFinite(expiration) ? expiration * 1000 : null;
}

export function isSessionExpired(session: AuthSession, now = Date.now()): boolean {
  const expiration = getTokenExpiration(session.accessToken);
  return expiration !== null && expiration <= now;
}

export function readStoredSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!isSession(value) || isSessionExpired(value)) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return value;
  } catch {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function writeStoredSession(session: AuthSession): void {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  sessionRevision += 1;
  window.dispatchEvent(new Event(SESSION_UPDATED_EVENT));
}

export function clearStoredSession(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
  latestBroadcastSession = null;
  sessionRevision += 1;
}

export function markLogoutPending(): void {
  localStorage.setItem(LOGOUT_PENDING_STORAGE_KEY, String(Date.now()));
}

export function clearLogoutPending(): void {
  localStorage.removeItem(LOGOUT_PENDING_STORAGE_KEY);
}

export function isLogoutPending(): boolean {
  return localStorage.getItem(LOGOUT_PENDING_STORAGE_KEY) !== null;
}

export function readAccessToken(): string | null {
  return readStoredSession()?.accessToken ?? null;
}

export function notifyUnauthorized(): void {
  window.dispatchEvent(new Event(SESSION_UNAUTHORIZED_EVENT));
}

/** Registra a chamada HTTP sem acoplar o armazenamento ao cliente OpenAPI. */
export function configureSessionRefresh(request: SessionRefreshRequest): void {
  requestSessionRefresh = request;
}

/** Serializa qualquer operação que possa rotacionar ou expirar o cookie de sessão. */
export function withSessionCookieLock<T>(operation: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks
        .request<Promise<T>>('tenancy-ledger:refresh-session', operation)
        .then((result) => result);
    }
    return operation();
  };
  const result = cookieMutationTail.then(run, run);
  cookieMutationTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Rotaciona a sessão uma única vez para todos os consumidores concorrentes.
 * O token opaco de refresh permanece no cookie HttpOnly e nunca entra neste módulo.
 */
export function refreshSession(): Promise<AuthSession> {
  if (refreshInFlight) return refreshInFlight;
  const request = requestSessionRefresh;
  if (!request) {
    return Promise.reject(new Error('A renovação da sessão não foi configurada.'));
  }

  const revisionAtStart = sessionRevision;
  const startedAt = Date.now();
  const performRefresh = async (): Promise<AuthSession> => {
    if (latestBroadcastSession && latestBroadcastSession.receivedAt >= startedAt) {
      writeStoredSession(latestBroadcastSession.session);
      return latestBroadcastSession.session;
    }
    const session = await request();
    if (revisionAtStart !== sessionRevision) {
      throw new SessionRefreshCancelledError();
    }
    writeStoredSession(session);
    sessionChannel?.postMessage({ type: 'refreshed', session });
    return session;
  };
  const operation = withSessionCookieLock(performRefresh);

  refreshInFlight = operation;
  void operation.then(
    () => {
      if (refreshInFlight === operation) refreshInFlight = null;
    },
    () => {
      if (refreshInFlight === operation) refreshInFlight = null;
    },
  );
  return operation;
}

export class SessionRefreshCancelledError extends Error {
  constructor() {
    super('A renovação foi descartada porque a sessão mudou.');
    this.name = 'SessionRefreshCancelledError';
  }
}
