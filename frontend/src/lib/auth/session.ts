import type { LoginResponse, UserRole, UserView } from '../../api/contract';

export const SESSION_STORAGE_KEY = 'tenancy-ledger:session:v1';
export const SESSION_UNAUTHORIZED_EVENT = 'tenancy-ledger:session-unauthorized';

export type AuthSession = LoginResponse;

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
}

export function clearStoredSession(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export function readAccessToken(): string | null {
  return readStoredSession()?.accessToken ?? null;
}

export function notifyUnauthorized(): void {
  window.dispatchEvent(new Event(SESSION_UNAUTHORIZED_EVENT));
}
