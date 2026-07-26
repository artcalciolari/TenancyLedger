import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../domain/entities/user.entity';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  it('permite acesso quando rota não exige papel', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const switchToHttp = jest.fn();
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp,
    } as unknown as ExecutionContext;

    expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
    expect(switchToHttp).not.toHaveBeenCalled();
  });

  it('permite apenas um papel explicitamente autorizado', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    } as unknown as Reflector;
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: '1', email: 'viewer@example.com', role: UserRole.VIEWER },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(new RolesGuard(reflector).canActivate(context)).toBe(false);
  });
});
