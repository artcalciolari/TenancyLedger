import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamicModule, Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../../auth.module';
import { AuthenticatedUser, AuthService, JwtPayload } from '../../application/auth.service';
import { UserRole } from '../../domain/entities/user.entity';
import { JwtStrategy } from './jwt.strategy';

const jwtConfiguration = {
  JWT_SECRET: 'a-test-jwt-secret-with-at-least-32-characters',
  JWT_EXPIRES_IN: '2h',
  JWT_ISSUER: 'test-issuer',
  JWT_AUDIENCE: 'test-audience',
};

function configService(values = jwtConfiguration): ConfigService {
  return {
    get: jest.fn((key: keyof typeof values) => values[key]),
    getOrThrow: jest.fn((key: keyof typeof values) => {
      const value = values[key];
      if (value === undefined) throw new Error(`Missing ${String(key)}`);
      return value;
    }),
  } as unknown as ConfigService;
}

describe('configuração JWT do AuthModule', () => {
  function jwtOptionsFactory(): (config: ConfigService) => unknown {
    const imports = Reflect.getMetadata('imports', AuthModule) as DynamicModule[];
    const jwtImport = imports.find((item) => item.module === JwtModule);
    const factoryProvider = jwtImport?.providers?.find(
      (provider): provider is Provider & { useFactory: (config: ConfigService) => unknown } =>
        typeof provider === 'object' && provider !== null && 'useFactory' in provider,
    );

    if (!factoryProvider || !('useFactory' in factoryProvider)) {
      throw new Error('Factory de configuração do JwtModule não encontrada');
    }
    return factoryProvider.useFactory;
  }

  it('assina com HS256, emissor, audiência e expiração convertida para segundos', () => {
    expect(jwtOptionsFactory()(configService())).toEqual({
      secret: jwtConfiguration.JWT_SECRET,
      signOptions: {
        expiresIn: 7200,
        algorithm: 'HS256',
        issuer: jwtConfiguration.JWT_ISSUER,
        audience: jwtConfiguration.JWT_AUDIENCE,
      },
    });
  });

  it.each(['0', '15 minutes', '1y'])('rejeita expiração inválida no módulo: %s', (expiresIn) => {
    const config = configService({ ...jwtConfiguration, JWT_EXPIRES_IN: expiresIn });

    expect(() => jwtOptionsFactory()(config)).toThrow('JWT_EXPIRES_IN deve usar o formato');
  });
});

describe('JwtStrategy', () => {
  let authService: jest.Mocked<AuthService>;

  beforeEach(() => {
    authService = {
      validatePayload: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;
  });

  it('verifica somente HS256 com emissor e audiência configurados', () => {
    const strategy = new JwtStrategy(configService(), authService);
    const verificationOptions = (
      strategy as unknown as {
        _verifOpts: { algorithms: string[]; issuer: string; audience: string };
      }
    )._verifOpts;

    expect(verificationOptions).toMatchObject({
      algorithms: ['HS256'],
      issuer: jwtConfiguration.JWT_ISSUER,
      audience: jwtConfiguration.JWT_AUDIENCE,
    });
  });

  it('devolve o usuário ativo validado pelo AuthService', async () => {
    const strategy = new JwtStrategy(configService(), authService);
    const payload: JwtPayload = {
      sub: 'user-id',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      ver: 0,
    };
    const authenticatedUser: AuthenticatedUser = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    authService.validatePayload.mockResolvedValue(authenticatedUser);

    await expect(strategy.validate(payload)).resolves.toEqual(authenticatedUser);
    expect(authService.validatePayload.mock.calls).toContainEqual([payload]);
  });

  it('rejeita token quando o usuário não existe ou está inativo', async () => {
    const strategy = new JwtStrategy(configService(), authService);
    authService.validatePayload.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'missing', email: 'x@example.com', role: UserRole.VIEWER, ver: 0 }),
    ).rejects.toEqual(new UnauthorizedException('Token inválido ou usuário inativo.'));
  });

  it('falha cedo com segredo curto', () => {
    const config = configService({
      ...jwtConfiguration,
      JWT_SECRET: 'short',
    });

    expect(() => new JwtStrategy(config, authService)).toThrow(
      'JWT_SECRET deve conter pelo menos 32 caracteres.',
    );
  });
});
