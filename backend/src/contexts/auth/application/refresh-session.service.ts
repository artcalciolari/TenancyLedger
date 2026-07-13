import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { EntityManager, Repository } from 'typeorm';
import { User } from '../domain/entities/user.entity';
import { RefreshSession } from '../domain/entities/refresh-session.entity';

export const REFRESH_TOKEN_COOKIE = 'refresh_token';

export interface RotatedRefreshSession {
  refreshToken: string;
  user: User;
}

type RotationResult = RotatedRefreshSession | { failure: 'invalid' } | { failure: 'replay' };

@Injectable()
export class RefreshSessionService {
  readonly ttlMilliseconds: number;

  constructor(
    @InjectRepository(RefreshSession)
    private readonly sessions: Repository<RefreshSession>,
    config: ConfigService,
  ) {
    this.ttlMilliseconds =
      config.getOrThrow<number>('REFRESH_TOKEN_TTL_DAYS') * 24 * 60 * 60 * 1000;
  }

  async issue(user: User): Promise<string> {
    const refreshToken = this.generateToken();
    const session = this.sessions.create({
      userId: user.id,
      familyId: randomUUID(),
      tokenVersion: user.tokenVersion,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + this.ttlMilliseconds),
      revokedAt: null,
      replacedBySessionId: null,
    });
    await this.sessions.save(session);
    return refreshToken;
  }

  async rotate(refreshToken: string | undefined): Promise<RotatedRefreshSession> {
    if (!this.isToken(refreshToken)) throw this.invalidToken();
    const tokenHash = this.hashToken(refreshToken);

    const result = await this.sessions.manager.transaction<RotationResult>(async (manager) => {
      const repository = manager.getRepository(RefreshSession);
      const candidate = await repository
        .createQueryBuilder('session')
        .addSelect('session.tokenHash')
        .where('session.tokenHash = :tokenHash', { tokenHash })
        .getOne();
      if (!candidate) throw this.invalidToken();

      await this.lockFamily(manager, candidate.familyId);
      const user = await manager.getRepository(User).findOne({
        where: { id: candidate.userId, active: true },
        lock: { mode: 'pessimistic_read' },
      });
      const session = await repository
        .createQueryBuilder('session')
        .addSelect('session.tokenHash')
        .setLock('pessimistic_write')
        .where('session.id = :id', { id: candidate.id })
        .getOne();
      if (!session) throw this.invalidToken();

      const now = new Date();
      if (session.revokedAt) {
        await this.revokeFamily(repository, session.familyId, now);
        return { failure: 'replay' };
      }
      if (session.expiresAt <= now) {
        session.revokedAt = now;
        await repository.save(session);
        return { failure: 'invalid' };
      }

      if (!user || user.tokenVersion !== session.tokenVersion) {
        await this.revokeFamily(repository, session.familyId, now);
        return { failure: 'invalid' };
      }

      const nextToken = this.generateToken();
      const replacement = repository.create({
        userId: session.userId,
        familyId: session.familyId,
        tokenVersion: user.tokenVersion,
        tokenHash: this.hashToken(nextToken),
        expiresAt: new Date(now.getTime() + this.ttlMilliseconds),
        revokedAt: null,
        replacedBySessionId: null,
      });
      await repository.save(replacement);
      session.revokedAt = now;
      session.replacedBySessionId = replacement.id;
      await repository.save(session);

      return { refreshToken: nextToken, user };
    });

    if ('failure' in result) {
      if (result.failure === 'replay') {
        throw new UnauthorizedException(
          'Reutilização de refresh token detectada; a família de sessões foi revogada.',
        );
      }
      throw this.invalidToken();
    }
    return result;
  }

  async revoke(refreshToken: string | undefined): Promise<void> {
    if (!this.isToken(refreshToken)) return;
    const tokenHash = this.hashToken(refreshToken);
    await this.sessions.manager.transaction(async (manager) => {
      const repository = manager.getRepository(RefreshSession);
      const candidate = await repository
        .createQueryBuilder('session')
        .addSelect('session.tokenHash')
        .where('session.tokenHash = :tokenHash', { tokenHash })
        .getOne();
      if (!candidate) return;
      await this.lockFamily(manager, candidate.familyId);
      const session = await repository
        .createQueryBuilder('session')
        .addSelect('session.tokenHash')
        .setLock('pessimistic_write')
        .where('session.id = :id', { id: candidate.id })
        .getOne();
      if (session) await this.revokeFamily(repository, session.familyId, new Date());
    });
  }

  async revokeAllForUser(userId: string, manager?: EntityManager): Promise<void> {
    const repository = (manager ?? this.sessions.manager).getRepository(RefreshSession);
    await repository
      .createQueryBuilder()
      .update(RefreshSession)
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  private revokeFamily(
    repository: Repository<RefreshSession>,
    familyId: string,
    revokedAt: Date,
  ): Promise<unknown> {
    return repository
      .createQueryBuilder()
      .update(RefreshSession)
      .set({ revokedAt })
      .where('family_id = :familyId', { familyId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  private async lockFamily(manager: EntityManager, familyId: string): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
      'refresh-session-family',
      familyId,
    ]);
  }

  private generateToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private isToken(token: string | undefined): token is string {
    return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
  }

  private invalidToken(): UnauthorizedException {
    return new UnauthorizedException('Refresh token ausente, inválido ou expirado.');
  }
}
