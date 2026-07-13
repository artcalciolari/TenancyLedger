import { createContext } from 'react';
import type { AuthSession } from '../../lib/auth/session';

export type SessionEndReason = 'expired' | 'logged-out' | null;

export interface AuthContextValue {
  session: AuthSession | null;
  reason: SessionEndReason;
  startSession: (session: AuthSession) => void;
  endSession: (reason?: Exclude<SessionEndReason, null>) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
