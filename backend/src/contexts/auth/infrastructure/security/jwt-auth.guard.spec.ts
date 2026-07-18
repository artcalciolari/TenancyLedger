import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const handler = jest.fn();
  class Controller {}

  let context: ExecutionContext;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;

  beforeEach(() => {
    context = {
      getHandler: jest.fn(() => handler),
      getClass: jest.fn(() => Controller),
    } as unknown as ExecutionContext;
    reflector = {
      getAllAndOverride: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('libera rotas públicas sem acionar a autenticação Passport', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const inheritedCanActivate = jest.spyOn(
      Object.getPrototypeOf(JwtAuthGuard.prototype) as {
        canActivate: (currentContext: ExecutionContext) => unknown;
      },
      'canActivate',
    );

    const result = new JwtAuthGuard(reflector as unknown as Reflector).canActivate(context);

    expect(result).toBe(true);
    expect(inheritedCanActivate).not.toHaveBeenCalled();
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [handler, Controller]);
  });

  it('delega rotas protegidas para a autenticação Passport', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const inheritedCanActivate = jest
      .spyOn(
        Object.getPrototypeOf(JwtAuthGuard.prototype) as {
          canActivate: (currentContext: ExecutionContext) => unknown;
        },
        'canActivate',
      )
      .mockReturnValue(true);

    const result = new JwtAuthGuard(reflector as unknown as Reflector).canActivate(context);

    expect(result).toBe(true);
    expect(inheritedCanActivate).toHaveBeenCalledWith(context);
  });
});
