import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import {
  clearStoredSession,
  clearLogoutPending,
  getTokenExpiration,
  isLogoutPending,
  LOGOUT_PENDING_STORAGE_KEY,
  markLogoutPending,
  readStoredSession,
  SessionRefreshCancelledError,
  SESSION_UNAUTHORIZED_EVENT,
  SESSION_UPDATED_EVENT,
  writeStoredSession,
  type AuthSession,
} from '../../lib/auth/session';
import { AuthContext, type SessionEndReason } from './AuthContext';
import { authApi } from './api';

const REFRESH_LEEWAY_MS = 60_000;

function revokeRemoteSession(): void {
  void authApi
    .logout()
    .then(clearLogoutPending)
    .catch(() => undefined);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [logoutPending] = useState(() => isLogoutPending());
  const [initialSession] = useState<AuthSession | null>(() =>
    logoutPending ? null : readStoredSession(),
  );
  const [session, setSession] = useState<AuthSession | null>(initialSession);
  const [reason, setReason] = useState<SessionEndReason>(null);
  const [restoring, setRestoring] = useState(initialSession === null && !logoutPending);

  const clearSession = useCallback(
    (endReason: Exclude<SessionEndReason, null>) => {
      clearStoredSession();
      queryClient.clear();
      setSession(null);
      setReason(endReason);
    },
    [queryClient],
  );

  const endSession = useCallback(
    (endReason: Exclude<SessionEndReason, null> = 'logged-out') => {
      if (endReason === 'logged-out') markLogoutPending();
      clearSession(endReason);
      if (endReason === 'logged-out') revokeRemoteSession();
    },
    [clearSession],
  );

  const startSession = useCallback((nextSession: AuthSession) => {
    clearLogoutPending();
    writeStoredSession(nextSession);
    setSession(nextSession);
    setReason(null);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => clearSession('expired');
    window.addEventListener(SESSION_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(SESSION_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [clearSession]);

  useEffect(() => {
    const handleSessionUpdated = () => setSession(readStoredSession());
    window.addEventListener(SESSION_UPDATED_EVENT, handleSessionUpdated);
    return () => window.removeEventListener(SESSION_UPDATED_EVENT, handleSessionUpdated);
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOGOUT_PENDING_STORAGE_KEY && event.newValue !== null) {
        clearSession('logged-out');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [clearSession]);

  useEffect(() => {
    if (initialSession) return;
    if (logoutPending) {
      revokeRemoteSession();
      return;
    }
    let active = true;
    void authApi
      .refresh()
      .then((restoredSession) => {
        if (!active) return;
        setSession(restoredSession);
        setReason(null);
      })
      .catch((error: unknown) => {
        if (!active || error instanceof SessionRefreshCancelledError) return;
        clearStoredSession();
        queryClient.clear();
        setSession(null);
        setReason(initialSession ? 'expired' : null);
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [initialSession, logoutPending, queryClient]);

  useEffect(() => {
    if (!session || restoring) return;
    const expiration = getTokenExpiration(session.accessToken);
    if (expiration === null) return;
    const delay = expiration - Date.now() - REFRESH_LEEWAY_MS;
    const timeout = window.setTimeout(
      () => {
        void authApi
          .refresh()
          .then((renewedSession) => setSession(renewedSession))
          .catch((error: unknown) => {
            if (!(error instanceof SessionRefreshCancelledError)) clearSession('expired');
          });
      },
      Math.max(0, Math.min(delay, 2_147_483_647)),
    );
    return () => window.clearTimeout(timeout);
  }, [clearSession, restoring, session]);

  const value = useMemo(
    () => ({ session, reason, restoring, startSession, endSession }),
    [endSession, reason, restoring, session, startSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
