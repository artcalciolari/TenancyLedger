import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '../../domain/entities/user.entity';
import { currentUserFactory } from './current-user.decorator';

describe('currentUserFactory', () => {
  it('returns the authenticated HTTP request user', () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: UserRole.VIEWER,
      active: true,
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;

    expect(currentUserFactory(undefined, context)).toBe(user);
  });
});
