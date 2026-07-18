import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare } from 'bcryptjs';
import { Repository } from 'typeorm';
import { User, UserRole } from '../domain/entities/user.entity';
import { AdminBootstrapService } from './admin-bootstrap.service';

describe('AdminBootstrapService', () => {
  let users: jest.Mocked<Repository<User>>;
  let log: jest.SpiedFunction<Logger['log']>;
  let warn: jest.SpiedFunction<Logger['warn']>;

  function config(values: Record<string, string | undefined>): ConfigService {
    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  }

  beforeEach(() => {
    users = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ignora o bootstrap quando nenhuma credencial foi configurada', async () => {
    await new AdminBootstrapService(users, config({})).onApplicationBootstrap();

    expect(warn.mock.calls).toEqual([
      [
        'AUTH_BOOTSTRAP_EMAIL/AUTH_BOOTSTRAP_PASSWORD ausentes; bootstrap do administrador ignorado.',
      ],
    ]);
    expect(users.findOne.mock.calls).toHaveLength(0);
    expect(users.save.mock.calls).toHaveLength(0);
  });

  it('é idempotente quando o administrador ativo já existe', async () => {
    users.findOne.mockResolvedValue({
      id: '7d1f4472-5950-4054-8a27-acace26a8748',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      active: true,
    } as User);
    const configured = config({
      AUTH_BOOTSTRAP_EMAIL: 'ADMIN@example.com',
      AUTH_BOOTSTRAP_PASSWORD: 'a-secure-password',
    });

    await new AdminBootstrapService(users, configured).onApplicationBootstrap();

    expect(users.findOne.mock.calls).toContainEqual([{ where: { email: 'admin@example.com' } }]);
    expect(users.save.mock.calls).toHaveLength(0);
  });

  it.each([
    {
      configured: { AUTH_BOOTSTRAP_EMAIL: 'admin@example.com' },
      missing: 'senha',
    },
    {
      configured: { AUTH_BOOTSTRAP_PASSWORD: 'a-secure-password' },
      missing: 'e-mail',
    },
  ])('exige e-mail e senha em conjunto quando falta $missing', async ({ configured }) => {
    await expect(
      new AdminBootstrapService(users, config(configured)).onApplicationBootstrap(),
    ).rejects.toThrow('devem ser configurados em conjunto');
    expect(users.findOne.mock.calls).toHaveLength(0);
  });

  it('rejeita senha de bootstrap com menos de doze caracteres', async () => {
    await expect(
      new AdminBootstrapService(
        users,
        config({
          AUTH_BOOTSTRAP_EMAIL: 'admin@example.com',
          AUTH_BOOTSTRAP_PASSWORD: 'short-pass',
        }),
      ).onApplicationBootstrap(),
    ).rejects.toThrow('deve conter pelo menos 12 caracteres');
    expect(users.findOne.mock.calls).toHaveLength(0);
  });

  it.each([
    { role: UserRole.MANAGER, active: true, reason: 'não é administrador' },
    { role: UserRole.ADMIN, active: false, reason: 'está inativo' },
  ])('recusa o usuário existente quando $reason', async ({ role, active }) => {
    users.findOne.mockResolvedValue({ role, active } as User);

    await expect(
      new AdminBootstrapService(
        users,
        config({
          AUTH_BOOTSTRAP_EMAIL: 'admin@example.com',
          AUTH_BOOTSTRAP_PASSWORD: 'a-secure-password',
        }),
      ).onApplicationBootstrap(),
    ).rejects.toThrow('não é um administrador ativo');
    expect(users.save.mock.calls).toHaveLength(0);
  });

  it('cria um administrador normalizado com hash bcrypt quando ele não existe', async () => {
    users.findOne.mockResolvedValue(null);
    users.save.mockImplementation((user) => Promise.resolve(user as User));

    await new AdminBootstrapService(
      users,
      config({
        AUTH_BOOTSTRAP_EMAIL: '  ADMIN@example.com ',
        AUTH_BOOTSTRAP_PASSWORD: 'a-secure-password',
      }),
    ).onApplicationBootstrap();

    const saved = users.save.mock.calls[0]?.[0] as User;
    expect(saved).toMatchObject({
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      active: true,
      tokenVersion: 0,
    });
    await expect(compare('a-secure-password', saved.passwordHash)).resolves.toBe(true);
    expect(log.mock.calls).toEqual([['Administrador inicial criado.']]);
  });
});
