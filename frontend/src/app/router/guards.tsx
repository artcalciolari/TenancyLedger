import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { UserRole } from '../../api/contract';
import { LoadingState } from '../../components/feedback/QueryState';
import { useDelayedVisible } from '../../components/feedback/useDelayedVisible';
import { hasRole } from '../../lib/roles/roles';
import { useAuth } from '../../modules/auth/useAuth';

export function RequireAuth({ children }: PropsWithChildren) {
  const location = useLocation();
  const { session, reason, restoring } = useAuth();
  // A restauração costuma resolver em poucos ms; só mostramos o indicador se demorar.
  const showRestoring = useDelayedVisible(restoring);
  if (restoring) return showRestoring ? <LoadingState label="Restaurando sessão…" /> : null;
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
  const showRestoring = useDelayedVisible(restoring);
  if (restoring) return showRestoring ? <LoadingState label="Restaurando permissões…" /> : null;
  if (!session) return null;
  return hasRole(session.user.role, roles) ? children : <Navigate to="/forbidden" replace />;
}
