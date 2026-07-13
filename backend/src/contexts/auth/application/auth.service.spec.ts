import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { EntityManager, QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';
import { User, UserRole } from '../domain/entities/user.entity';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => {
  const actual = jest.requireActual<typeof import('bcryptjs')>('bcryptjs');
  return { ...actual, compare: jest.fn(), hash: jest.fn() };
});

const bcryptCompare = bcrypt.compare as unknown as jest.MockedFunction<
  (data: string, encrypted: string) => Promise<boolean>
>;
const bcryptHash = bcrypt.hash as unknown as jest.MockedFunction<
  (data: string, salt: number) => Promise<string>
>;
const storedPasswordHash = '$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234';
const newPasswordHash = '$2b$12$zyxwvutsrqponmlkjihgfedcbaABCDEFGHIJKLMNOPQRSTUVWXYZ01234';

async function captureUnauthorized(promise: Promise<unknown>): Promise<UnauthorizedException> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof UnauthorizedException) return error;
    throw error;
  }
  throw new Error('Esperava UnauthorizedException, mas a promessa foi resolvida.');
}

describe('AuthService', () => {
  let users: jest.Mocked<Repository<User>>;
  let queryBuilder: jest.Mocked<SelectQueryBuilder<User>>;
  let transactionManager: jest.Mocked<EntityManager>;
  let transactionUsers: jest.Mocked<Repository<User>>;
  let jwtService: jest.Mocked<JwtService>;
  let service: AuthService;

  beforeEach(() => {
    bcryptCompare.mockReset();
    bcryptHash.mockReset();
    queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    } as unknown as jest.Mocked<SelectQueryBuilder<User>>;
    transactionUsers = {
      findOne: jest.fn(),
      countBy: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
    transactionManager = {
      query: jest.fn().mockResolvedValue(undefined),
      getRepository: jest.fn().mockReturnValue(transactionUsers),
    } as unknown as jest.Mocked<EntityManager>;
    const manager = {
      transaction: jest
        .fn()
        .mockImplementation(async (operation: (manager: EntityManager) => Promise<unknown>) =>
          operation(transactionManager),
        ),
    } as unknown as jest.Mocked<EntityManager>;
    users = {
      manager,
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      countBy: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt'),
    } as unknown as jest.Mocked<JwtService>;
    service = new AuthService(users, jwtService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('autentica com e-mail normalizado e nunca retorna o hash', async () => {
    const user = User.create('admin@example.com', storedPasswordHash, UserRole.ADMIN);
    user.id = 'b20489d3-cfd4-4778-ab9f-aa3f63c5a908';
    queryBuilder.getOne.mockResolvedValue(user);
    bcryptCompare.mockResolvedValue(true);

    const result = await service.login(' ADMIN@example.com ', 'correct-password');

    expect(queryBuilder.where.mock.calls).toContainEqual([
      'user.email = :email',
      { email: 'admin@example.com' },
    ]);
    expect(result).toEqual({
      accessToken: 'signed.jwt',
      user: { id: user.id, email: user.email, role: UserRole.ADMIN, active: true },
    });
    expect(jwtService.signAsync.mock.calls).toContainEqual([
      {
        sub: user.id,
        email: user.email,
        role: UserRole.ADMIN,
        ver: 0,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('executa bcrypt com hash dummy e devolve a mesma resposta para usuário inexistente', async () => {
    queryBuilder.getOne.mockResolvedValue(null);
    bcryptCompare.mockResolvedValue(false);

    const missingUserError = await captureUnauthorized(
      service.login('missing@example.com', 'guess'),
    );

    expect(bcryptCompare).toHaveBeenCalledWith('guess', expect.stringMatching(/^\$2b\$12\$/));
    expect(missingUserError).toBeInstanceOf(UnauthorizedException);
    expect(missingUserError.getResponse()).toMatchObject({
      statusCode: 401,
      message: 'E-mail ou senha inválidos.',
    });

    const existing = User.create('admin@example.com', storedPasswordHash, UserRole.ADMIN);
    queryBuilder.getOne.mockResolvedValue(existing);
    const wrongPasswordError = await captureUnauthorized(
      service.login('admin@example.com', 'guess'),
    );

    expect(wrongPasswordError).toBeInstanceOf(UnauthorizedException);
    expect(wrongPasswordError.getResponse()).toEqual(missingUserError.getResponse());
    expect(wrongPasswordError.getStatus()).toBe(missingUserError.getStatus());
    expect(jwtService.signAsync.mock.calls).toHaveLength(0);
  });

  it('rejeita usuário inativo mesmo quando a senha confere', async () => {
    const inactive = User.create('inactive@example.com', storedPasswordHash, UserRole.MANAGER);
    inactive.active = false;
    queryBuilder.getOne.mockResolvedValue(inactive);
    bcryptCompare.mockResolvedValue(true);

    await expect(service.login(inactive.email, 'correct-password')).rejects.toThrow(
      'E-mail ou senha inválidos.',
    );
    expect(jwtService.signAsync.mock.calls).toHaveLength(0);
  });

  it('não valida tokens pertencentes a usuário inativo ou inexistente', async () => {
    users.findOne.mockResolvedValue(null);

    await expect(
      service.validatePayload({ sub: 'missing', email: 'x@y.com', role: UserRole.ADMIN, ver: 2 }),
    ).resolves.toBeNull();
    expect(users.findOne.mock.calls).toContainEqual([
      { where: { id: 'missing', active: true, tokenVersion: 2 } },
    ]);
  });

  describe('createUser', () => {
    it('gera hash bcrypt com custo 12, normaliza o e-mail e não expõe o hash', async () => {
      bcryptHash.mockResolvedValue(storedPasswordHash);
      const persistedUser = User.create(
        'new.manager@example.com',
        storedPasswordHash,
        UserRole.MANAGER,
      );
      persistedUser.id = 'new-user-id';
      users.save.mockResolvedValue(persistedUser);

      const result = await service.createUser(
        ' NEW.Manager@Example.com ',
        'a-strong-password',
        UserRole.MANAGER,
      );

      expect(bcryptHash).toHaveBeenCalledWith('a-strong-password', 12);
      const savedUser = users.save.mock.calls[0]?.[0];
      expect(savedUser).toMatchObject({
        email: 'new.manager@example.com',
        passwordHash: storedPasswordHash,
        role: UserRole.MANAGER,
        active: true,
        tokenVersion: 0,
      });
      expect(result).toEqual({
        id: 'new-user-id',
        email: 'new.manager@example.com',
        role: UserRole.MANAGER,
        active: true,
      });
      expect(JSON.stringify(result)).not.toContain('passwordHash');
    });

    it('converte violação unique do PostgreSQL em ConflictException', async () => {
      bcryptHash.mockResolvedValue(storedPasswordHash);
      users.save.mockRejectedValue(
        new QueryFailedError(
          'INSERT INTO users',
          [],
          Object.assign(new Error('duplicate key'), { code: '23505' }),
        ),
      );

      await expect(
        service.createUser('duplicate@example.com', 'a-strong-password', UserRole.VIEWER),
      ).rejects.toEqual(new ConflictException('Já existe um usuário com este e-mail.'));
    });
  });

  it('lista usuários com paginação determinística e metadados', async () => {
    const admin = User.create('admin@example.com', storedPasswordHash, UserRole.ADMIN);
    admin.id = 'admin-id';
    const viewer = User.create('viewer@example.com', storedPasswordHash, UserRole.VIEWER);
    viewer.id = 'viewer-id';
    users.findAndCount.mockResolvedValue([[admin, viewer], 21]);

    await expect(service.listUsers(2, 10)).resolves.toEqual({
      data: [
        { id: 'admin-id', email: 'admin@example.com', role: UserRole.ADMIN, active: true },
        { id: 'viewer-id', email: 'viewer@example.com', role: UserRole.VIEWER, active: true },
      ],
      meta: { page: 2, limit: 10, total: 21, totalPages: 3 },
    });
    expect(users.findAndCount.mock.calls).toContainEqual([
      {
        order: { createdAt: 'DESC', id: 'ASC' },
        skip: 10,
        take: 10,
      },
    ]);
  });

  describe('updateUserAccess', () => {
    it('impede que o administrador remova o próprio papel administrativo', async () => {
      const admin = User.create('admin@example.com', storedPasswordHash, UserRole.ADMIN);
      admin.id = 'current-admin';
      transactionUsers.findOne.mockResolvedValue(admin);

      await expect(
        service.updateUserAccess(admin.id, UserRole.MANAGER, true, admin.id),
      ).rejects.toEqual(
        new ConflictException('O administrador não pode remover o próprio acesso.'),
      );
      expect(admin).toMatchObject({ role: UserRole.ADMIN, active: true, tokenVersion: 0 });
      expect(transactionUsers.countBy.mock.calls).toHaveLength(0);
      expect(transactionUsers.save.mock.calls).toHaveLength(0);
    });

    it('impede desativar o último administrador ativo', async () => {
      const admin = User.create('last-admin@example.com', storedPasswordHash, UserRole.ADMIN);
      admin.id = 'last-admin';
      transactionUsers.findOne.mockResolvedValue(admin);
      transactionUsers.countBy.mockResolvedValue(1);

      await expect(
        service.updateUserAccess(admin.id, UserRole.ADMIN, false, 'another-admin'),
      ).rejects.toEqual(
        new ConflictException('O sistema deve manter ao menos um administrador ativo.'),
      );
      expect(transactionUsers.countBy.mock.calls).toContainEqual([
        { role: UserRole.ADMIN, active: true },
      ]);
      expect(admin).toMatchObject({ role: UserRole.ADMIN, active: true, tokenVersion: 0 });
      expect(transactionUsers.save.mock.calls).toHaveLength(0);
    });

    it('atualiza o acesso e incrementa tokenVersion para revogar tokens anteriores', async () => {
      const viewer = User.create('viewer@example.com', storedPasswordHash, UserRole.VIEWER);
      viewer.id = 'viewer-id';
      transactionUsers.findOne.mockResolvedValue(viewer);
      transactionUsers.save.mockResolvedValue(viewer);

      await expect(
        service.updateUserAccess(viewer.id, UserRole.MANAGER, false, 'admin-id'),
      ).resolves.toEqual({
        id: viewer.id,
        email: viewer.email,
        role: UserRole.MANAGER,
        active: false,
      });
      expect(viewer).toMatchObject({
        role: UserRole.MANAGER,
        active: false,
        tokenVersion: 1,
      });
      expect(transactionUsers.save.mock.calls).toContainEqual([viewer]);
    });

    it('serializa a revalidação e a persistência na mesma transação', async () => {
      const admin = User.create('admin@example.com', storedPasswordHash, UserRole.ADMIN);
      admin.id = 'admin-id';
      transactionUsers.findOne.mockResolvedValue(admin);
      transactionUsers.countBy.mockResolvedValue(2);
      transactionUsers.save.mockResolvedValue(admin);

      await service.updateUserAccess(admin.id, UserRole.MANAGER, true, 'another-admin');

      expect(transactionManager.query.mock.calls).toContainEqual([
        'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
        ['tenancy-ledger', 'active-admin-access'],
      ]);
      expect(transactionManager.getRepository.mock.calls).toContainEqual([User]);
      expect(transactionUsers.findOne.mock.calls).toContainEqual([
        {
          where: { id: admin.id },
          lock: { mode: 'pessimistic_write' },
        },
      ]);
      expect(transactionManager.query.mock.invocationCallOrder[0]).toBeLessThan(
        transactionUsers.findOne.mock.invocationCallOrder[0] ?? 0,
      );
      expect(transactionUsers.findOne.mock.invocationCallOrder[0]).toBeLessThan(
        transactionUsers.countBy.mock.invocationCallOrder[0] ?? 0,
      );
      expect(transactionUsers.countBy.mock.invocationCallOrder[0]).toBeLessThan(
        transactionUsers.save.mock.invocationCallOrder[0] ?? 0,
      );
      expect(users.findOne.mock.calls).toHaveLength(0);
      expect(users.countBy.mock.calls).toHaveLength(0);
      expect(users.save.mock.calls).toHaveLength(0);
    });
  });

  describe('changePassword', () => {
    it('rejeita a senha atual incorreta sem alterar o usuário', async () => {
      const user = User.create('user@example.com', storedPasswordHash, UserRole.VIEWER);
      user.id = 'user-id';
      queryBuilder.getOne.mockResolvedValue(user);
      bcryptCompare.mockResolvedValue(false);

      await expect(
        service.changePassword(user.id, 'wrong-password', 'brand-new-password'),
      ).rejects.toEqual(new UnauthorizedException('Senha atual inválida.'));
      expect(bcryptCompare.mock.calls).toEqual([['wrong-password', storedPasswordHash]]);
      expect(bcryptHash.mock.calls).toHaveLength(0);
      expect(users.save.mock.calls).toHaveLength(0);
      expect(user.tokenVersion).toBe(0);
    });

    it('exige que a nova senha seja diferente da senha atual', async () => {
      const user = User.create('user@example.com', storedPasswordHash, UserRole.VIEWER);
      user.id = 'user-id';
      queryBuilder.getOne.mockResolvedValue(user);
      bcryptCompare.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

      await expect(
        service.changePassword(user.id, 'current-password', 'current-password'),
      ).rejects.toEqual(new ConflictException('A nova senha deve ser diferente da senha atual.'));
      expect(bcryptCompare.mock.calls).toEqual([
        ['current-password', storedPasswordHash],
        ['current-password', storedPasswordHash],
      ]);
      expect(bcryptHash.mock.calls).toHaveLength(0);
      expect(users.save.mock.calls).toHaveLength(0);
      expect(user.tokenVersion).toBe(0);
    });

    it('troca a senha e incrementa tokenVersion para revogar tokens anteriores', async () => {
      const user = User.create('user@example.com', storedPasswordHash, UserRole.VIEWER);
      user.id = 'user-id';
      queryBuilder.getOne.mockResolvedValue(user);
      bcryptCompare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
      bcryptHash.mockResolvedValue(newPasswordHash);
      users.save.mockResolvedValue(user);

      await expect(
        service.changePassword(user.id, 'current-password', 'brand-new-password'),
      ).resolves.toBeUndefined();
      expect(queryBuilder.where.mock.calls).toContainEqual([
        'user.id = :userId',
        { userId: user.id },
      ]);
      expect(queryBuilder.andWhere.mock.calls).toContainEqual(['user.active = true']);
      expect(bcryptHash).toHaveBeenCalledWith('brand-new-password', 12);
      expect(user).toMatchObject({ passwordHash: newPasswordHash, tokenVersion: 1 });
      expect(users.save.mock.calls).toContainEqual([user]);
    });
  });
});
