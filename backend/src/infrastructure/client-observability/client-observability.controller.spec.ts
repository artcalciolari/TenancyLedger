import type { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../../contexts/auth/application/auth.service';
import { UserRole } from '../../contexts/auth/domain/entities/user.entity';
import { AuditLog } from '../../core/infrastructure/audit/audit-log.entity';
import { ClientErrorKind } from './client-error.dto';
import { ClientObservabilityController } from './client-observability.controller';

describe('ClientObservabilityController', () => {
  it('persists only the allow-listed correlation fields', async () => {
    const insert = jest.fn().mockResolvedValue(undefined);
    const controller = new ClientObservabilityController({ insert } as unknown as Repository<AuditLog>);
    const user: AuthenticatedUser = {
      id: '039e0ba5-2c28-4616-8983-b3c332da522e',
      email: 'viewer@example.test',
      role: UserRole.VIEWER,
      active: true,
    };

    await controller.report(user, {
      kind: ClientErrorKind.NETWORK,
      fingerprint: '5f9c6bb1a4438e12',
      route: '/invoices/123',
      requestId: 'request-123',
      release: 'sha-123',
      status: 503,
    });

    expect(insert).toHaveBeenCalledWith({
      actorId: user.id,
      action: 'CLIENT_ERROR NETWORK',
      resourceType: 'frontend',
      resourceId: null,
      requestId: 'request-123',
      metadata: {
        fingerprint: '5f9c6bb1a4438e12',
        route: '/invoices/123',
        release: 'sha-123',
        status: 503,
      },
    });
  });
});
