import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import {
  clearStoredSession,
  getTokenExpiration,
  readStoredSession,
  SESSION_UNAUTHORIZED_EVENT,
  writeStoredSession,
  type AuthSession,
} from '../../lib/auth/session';
import { AuthContext, type SessionEndReason } from './AuthContext';

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [reason, setReason] = useState<SessionEndReason>(null);

  const endSession = useCallback(
    (endReason: Exclude<SessionEndReason, null> = 'logged-out') => {
      clearStoredSession();
      queryClient.clear();
      setSession(null);
      setReason(endReason);
    },
    [queryClient],
  );

  const startSession = useCallback((nextSession: AuthSession) => {
    writeStoredSession(nextSession);
    setSession(nextSession);
    setReason(null);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => endSession('expired');
    window.addEventListener(SESSION_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(SESSION_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [endSession]);

  useEffect(() => {
    if (!session) return;
    const expiration = getTokenExpiration(session.accessToken);
    if (expiration === null) return;
    const delay = expiration - Date.now();
    const timeout = window.setTimeout(
      () => endSession('expired'),
      Math.max(0, Math.min(delay, 2_147_483_647)),
    );
    return () => window.clearTimeout(timeout);
  }, [endSession, session]);

  const value = useMemo(
    () => ({ session, reason, startSession, endSession }),
    [endSession, reason, session, startSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
