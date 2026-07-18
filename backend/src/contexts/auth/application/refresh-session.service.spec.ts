import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { EntityManager, Repository, SelectQueryBuilder, UpdateQueryBuilder } from 'typeorm';
import { RefreshSession } from '../domain/entities/refresh-session.entity';
import { User, UserRole } from '../domain/entities/user.entity';
import { RefreshSessionService } from './refresh-session.service';

const USER_ID = '7fdf9cde-2961-4ed2-a3ae-eedce12a42ee';
const FAMILY_ID = '62f5440b-6916-4600-a37a-2fa1b779949a';
const SESSION_ID = '6c314215-6937-4998-acfa-5c6e4a679979';
const TOKEN = Buffer.alloc(32, 1).toString('base64url');
const NOW = new Date('2026-07-12T12:00:00.000Z');

function refreshSession(overrides: Partial<RefreshSession> = {}): RefreshSession {
  return Object.assign(new RefreshSession(), {
    id: SESSION_ID,
    userId: USER_ID,
    familyId: FAMILY_ID,
    tokenVersion: 0,
    tokenHash: createHash('sha256').update(TOKEN).digest('hex'),
    expiresAt: new Date('2026-08-12T12:00:00.000Z'),
    revokedAt: null,
    replacedBySessionId: null,
    createdAt: new Date('2026-07-01T12:00:00.000Z'),
    ...overrides,
  });
}

function activeUser(tokenVersion = 0): User {
  const user = User.create('manager@example.com', 'x'.repeat(60), UserRole.MANAGER);
  user.id = USER_ID;
  user.tokenVersion = tokenVersion;
  return user;
}

describe('RefreshSessionService', () => {
  let sessions: jest.Mocked<Repository<RefreshSession>>;
  let transactionSessions: jest.Mocked<Repository<RefreshSession>>;
  let users: jest.Mocked<Repository<User>>;
  let select: jest.Mocked<SelectQueryBuilder<RefreshSession>>;
  let update: jest.Mocked<UpdateQueryBuilder<RefreshSession>>;
  let transactionManager: jest.Mocked<EntityManager>;
  let sessionsManager: jest.Mocked<EntityManager>;
  let service: RefreshSessionService;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    select = {
      addSelect: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    } as unknown as jest.Mocked<SelectQueryBuilder<RefreshSession>>;
    update = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    } as unknown as jest.Mocked<UpdateQueryBuilder<RefreshSession>>;
    transactionSessions = {
      create: jest.fn((input: Partial<RefreshSession>) => input as RefreshSession),
      save: jest.fn((session: RefreshSession): Promise<RefreshSession> => {
        if (!session.id) session.id = 'c68ffec8-39a5-4d3e-af16-401ff6ed83fd';
        return Promise.resolve(session);
      }),
      createQueryBuilder: jest.fn().mockReturnValue(select),
    } as unknown as jest.Mocked<Repository<RefreshSession>>;
    users = {
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
    transactionManager = {
      query: jest.fn().mockResolvedValue(undefined),
      getRepository: jest.fn((entity: unknown) =>
        entity === RefreshSession ? transactionSessions : users,
      ),
    } as unknown as jest.Mocked<EntityManager>;
    sessionsManager = {
      transaction: jest.fn(async (operation: (manager: EntityManager) => Promise<unknown>) =>
        operation(transactionManager),
      ),
      getRepository: jest.fn().mockReturnValue(transactionSessions),
    } as unknown as jest.Mocked<EntityManager>;
    sessions = {
      manager: sessionsManager,
      create: jest.fn((input: Partial<RefreshSession>) => input as RefreshSession),
      save: jest.fn((session: RefreshSession) => Promise.resolve(session)),
    } as unknown as jest.Mocked<Repository<RefreshSession>>;
    const config = {
      getOrThrow: jest.fn().mockReturnValue(30),
    } as unknown as ConfigService;
    service = new RefreshSessionService(sessions, config);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('persiste somente o hash de um token opaco forte', async () => {
    const user = User.create('user@example.com', 'x'.repeat(60), UserRole.VIEWER);
    user.id = USER_ID;
    const token = await service.issue(user);

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const persisted = sessions.save.mock.calls[0]?.[0];
    expect(persisted).toMatchObject({
      userId: USER_ID,
      tokenVersion: 0,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      revokedAt: null,
      replacedBySessionId: null,
    });
    expect(JSON.stringify(persisted)).not.toContain(token);
  });

  it('rotaciona a sessão sob lock e preserva a família', async () => {
    const session = refreshSession();
    const user = activeUser();
    select.getOne.mockResolvedValue(session);
    users.findOne.mockResolvedValue(user);

    const result = await service.rotate(TOKEN);

    expect(result.user).toBe(user);
    expect(result.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.refreshToken).not.toBe(TOKEN);
    expect(select.setLock.mock.calls).toContainEqual(['pessimistic_write']);
    expect(transactionManager.query.mock.calls).toContainEqual([
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      ['refresh-session-family', FAMILY_ID],
    ]);
    const replacement = transactionSessions.create.mock.calls[0]?.[0];
    expect(replacement).toMatchObject({ userId: USER_ID, familyId: FAMILY_ID, revokedAt: null });
    expect(session.revokedAt).toEqual(NOW);
    expect(session.replacedBySessionId).toBe('c68ffec8-39a5-4d3e-af16-401ff6ed83fd');
  });

  it('detecta replay e revoga todas as sessões ainda ativas da família', async () => {
    const replayed = refreshSession({
      revokedAt: new Date('2026-07-12T11:00:00.000Z'),
      replacedBySessionId: 'c68ffec8-39a5-4d3e-af16-401ff6ed83fd',
    });
    select.getOne.mockResolvedValue(replayed);
    transactionSessions.createQueryBuilder
      .mockReturnValueOnce(select)
      .mockReturnValueOnce(select)
      .mockReturnValueOnce(update as never);

    await expect(service.rotate(TOKEN)).rejects.toEqual(
      new UnauthorizedException(
        'Reutilização de refresh token detectada; a família de sessões foi revogada.',
      ),
    );
    expect(update.where.mock.calls).toContainEqual([
      'family_id = :familyId',
      { familyId: FAMILY_ID },
    ]);
    expect(update.andWhere.mock.calls).toContainEqual(['revoked_at IS NULL']);
  });

  it('não revela se um token opaco desconhecido já existiu', async () => {
    select.getOne.mockResolvedValue(null);
    await expect(service.rotate(TOKEN)).rejects.toEqual(
      new UnauthorizedException('Refresh token ausente, inválido ou expirado.'),
    );
  });

  it.each([
    ['ausente', undefined],
    ['curto demais', 'short-token'],
    ['com caracteres fora de base64url', '!'.repeat(43)],
  ])('rejeita um token %s antes de abrir transação', async (_description, token) => {
    await expect(service.rotate(token)).rejects.toEqual(
      new UnauthorizedException('Refresh token ausente, inválido ou expirado.'),
    );
    expect(sessionsManager.transaction.mock.calls).toHaveLength(0);
  });

  it('rejeita a rotação se a sessão desaparecer depois do lock da família', async () => {
    select.getOne.mockResolvedValueOnce(refreshSession()).mockResolvedValueOnce(null);
    users.findOne.mockResolvedValue(activeUser());

    await expect(service.rotate(TOKEN)).rejects.toEqual(
      new UnauthorizedException('Refresh token ausente, inválido ou expirado.'),
    );
    expect(transactionManager.query.mock.calls).toContainEqual([
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      ['refresh-session-family', FAMILY_ID],
    ]);
  });

  it('revoga uma sessão expirada e recusa a rotação', async () => {
    const expired = refreshSession({ expiresAt: new Date(NOW) });
    select.getOne.mockResolvedValue(expired);
    users.findOne.mockResolvedValue(activeUser());

    await expect(service.rotate(TOKEN)).rejects.toEqual(
      new UnauthorizedException('Refresh token ausente, inválido ou expirado.'),
    );

    expect(expired.revokedAt).toEqual(NOW);
    expect(transactionSessions.save.mock.calls).toContainEqual([expired]);
    expect(update.execute.mock.calls).toHaveLength(0);
  });

  it('revoga a família quando a versão do usuário invalida a sessão', async () => {
    const stale = refreshSession({ tokenVersion: 1 });
    select.getOne.mockResolvedValue(stale);
    users.findOne.mockResolvedValue(activeUser(2));
    transactionSessions.createQueryBuilder
      .mockReturnValueOnce(select)
      .mockReturnValueOnce(select)
      .mockReturnValueOnce(update as never);

    await expect(service.rotate(TOKEN)).rejects.toEqual(
      new UnauthorizedException('Refresh token ausente, inválido ou expirado.'),
    );

    expect(update.set.mock.calls).toContainEqual([{ revokedAt: NOW }]);
    expect(update.where.mock.calls).toContainEqual([
      'family_id = :familyId',
      { familyId: FAMILY_ID },
    ]);
  });

  describe('revoke', () => {
    it('ignora logout sem token válido antes de abrir transação', async () => {
      await expect(service.revoke(undefined)).resolves.toBeUndefined();
      expect(sessionsManager.transaction.mock.calls).toHaveLength(0);
    });

    it('trata token opaco desconhecido como logout idempotente', async () => {
      select.getOne.mockResolvedValue(null);

      await expect(service.revoke(TOKEN)).resolves.toBeUndefined();

      expect(transactionManager.query.mock.calls).toHaveLength(0);
    });

    it('não revoga outra família se a sessão desaparecer após o lock', async () => {
      select.getOne.mockResolvedValueOnce(refreshSession()).mockResolvedValueOnce(null);

      await expect(service.revoke(TOKEN)).resolves.toBeUndefined();

      expect(transactionManager.query.mock.calls).toHaveLength(1);
      expect(update.execute.mock.calls).toHaveLength(0);
    });

    it('revoga todas as sessões ativas da família encontrada', async () => {
      const session = refreshSession();
      select.getOne.mockResolvedValue(session);
      transactionSessions.createQueryBuilder
        .mockReturnValueOnce(select)
        .mockReturnValueOnce(select)
        .mockReturnValueOnce(update as never);

      await expect(service.revoke(TOKEN)).resolves.toBeUndefined();

      expect(update.set.mock.calls).toContainEqual([{ revokedAt: NOW }]);
      expect(update.andWhere.mock.calls).toContainEqual(['revoked_at IS NULL']);
    });
  });

  it('revoga todas as sessões do usuário com o manager padrão ou o transacional', async () => {
    transactionSessions.createQueryBuilder.mockReturnValue(update as never);

    await service.revokeAllForUser(USER_ID);
    expect(sessionsManager.getRepository.mock.calls).toContainEqual([RefreshSession]);
    expect(update.where.mock.calls).toContainEqual(['user_id = :userId', { userId: USER_ID }]);

    const explicitManager = {
      getRepository: jest.fn().mockReturnValue(transactionSessions),
    } as unknown as jest.Mocked<EntityManager>;
    await service.revokeAllForUser(USER_ID, explicitManager);

    expect(explicitManager.getRepository.mock.calls).toContainEqual([RefreshSession]);
    expect(update.execute.mock.calls).toHaveLength(2);
  });
});
