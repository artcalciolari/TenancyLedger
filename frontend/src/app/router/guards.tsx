import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { UserRole } from '../../api/contract';
import { LoadingState } from '../../components/feedback/QueryState';
import { hasRole } from '../../lib/roles/roles';
import { useAuth } from '../../modules/auth/useAuth';

export function RequireAuth({ children }: PropsWithChildren) {
  const location = useLocation();
  const { session, reason, restoring } = useAuth();
  if (restoring) return <LoadingState label="Restaurando sessão…" />;
  if (session) return children;
  if (reason === 'password-changed') {
    return <Navigate to="/login?reason=password-changed" replace />;
  }

  const returnTo = `${location.pathname}${location.search}`;
  const parameters = new URLSearchParams({ returnTo });
  if (reason === 'expired') parameters.set('reason', 'session-expired');
  return <Navigate to={`/login?${parameters.toString()}`} replace />;
}

interface RequireRoleProps extends PropsWithChildren {
  roles: readonly UserRole[];
}

export function RequireRole({ children, roles }: RequireRoleProps) {
  const { session, restoring } = useAuth();
  if (restoring) return <LoadingState label="Restaurando permissões…" />;
  if (!session) return null;
  return hasRole(session.user.role, roles) ? children : <Navigate to="/forbidden" replace />;
}
