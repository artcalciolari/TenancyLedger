import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { QueryFailedError, Repository } from 'typeorm';
import { User, UserRole } from '../domain/entities/user.entity';

const dummyPasswordHash = '$2b$12$ZqxB49XFtCJPJPojjNn1Z.Da6Y6CgeN33AeGyQRzzyAD8LhElMCc2';
const accessManagementAdvisoryLock = ['tenancy-ledger', 'active-admin-access'] as const;

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: User['role'];
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: User['role'];
  ver: number;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: normalizedEmail })
      .getOne();

    const passwordMatches = await compare(password, user?.passwordHash ?? dummyPasswordHash);
    if (!user?.active || !passwordMatches) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const authenticatedUser = this.toAuthenticatedUser(user);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      ver: user.tokenVersion,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: authenticatedUser,
    };
  }

  async validatePayload(payload: JwtPayload): Promise<AuthenticatedUser | null> {
    const user = await this.users.findOne({
      where: { id: payload.sub, active: true, tokenVersion: payload.ver },
    });
    return user ? this.toAuthenticatedUser(user) : null;
  }

  async createUser(email: string, password: string, role: UserRole): Promise<AuthenticatedUser> {
    const passwordHash = await hash(password, 12);
    try {
      const user = await this.users.save(User.create(email, passwordHash, role));
      return this.toAuthenticatedUser(user);
    } catch (error: unknown) {
      if (this.databaseErrorCode(error) === '23505') {
        throw new ConflictException('Já existe um usuário com este e-mail.');
      }
      throw error;
    }
  }

  async listUsers(
    page: number,
    limit: number,
  ): Promise<{
    data: AuthenticatedUser[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const [users, total] = await this.users.findAndCount({
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: users.map((user) => this.toAuthenticatedUser(user)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateUserAccess(
    id: string,
    role: UserRole,
    active: boolean,
    actorId: string,
  ): Promise<AuthenticatedUser> {
    return this.users.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
        ...accessManagementAdvisoryLock,
      ]);

      const users = manager.getRepository(User);
      const user = await users.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('Usuário não encontrado.');
      if (user.id === actorId && (!active || role !== UserRole.ADMIN)) {
        throw new ConflictException('O administrador não pode remover o próprio acesso.');
      }
      if (user.role === UserRole.ADMIN && user.active && (!active || role !== UserRole.ADMIN)) {
        const activeAdmins = await users.countBy({
          role: UserRole.ADMIN,
          active: true,
        });
        if (activeAdmins <= 1) {
          throw new ConflictException('O sistema deve manter ao menos um administrador ativo.');
        }
      }
      user.updateAccess(role, active);
      return this.toAuthenticatedUser(await users.save(user));
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :userId', { userId })
      .andWhere('user.active = true')
      .getOne();
    const passwordMatches = await compare(currentPassword, user?.passwordHash ?? dummyPasswordHash);
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Senha atual inválida.');
    }
    if (await compare(newPassword, user.passwordHash)) {
      throw new ConflictException('A nova senha deve ser diferente da senha atual.');
    }
    user.changePasswordHash(await hash(newPassword, 12));
    await this.users.save(user);
  }

  private toAuthenticatedUser(user: User): AuthenticatedUser {
    return { id: user.id, email: user.email, role: user.role };
  }

  private databaseErrorCode(error: unknown): string | undefined {
    if (!(error instanceof QueryFailedError)) return undefined;
    const driverError: unknown = error.driverError;
    if (typeof driverError !== 'object' || driverError === null) return undefined;
    const code = Reflect.get(driverError, 'code') as unknown;
    return typeof code === 'string' ? code : undefined;
  }
}
