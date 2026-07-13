import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { User, UserRole } from '../domain/entities/user.entity';
import { AdminBootstrapService } from './admin-bootstrap.service';

describe('AdminBootstrapService', () => {
  let users: jest.Mocked<Repository<User>>;

  beforeEach(() => {
    users = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;
  });

  it('é idempotente quando o administrador ativo já existe', async () => {
    users.findOne.mockResolvedValue({
      id: '7d1f4472-5950-4054-8a27-acace26a8748',
      email: 'admin@example.com',
      role: UserRole.ADMIN,
      active: true,
    } as User);
    const config = {
      get: jest.fn(
        (key: string) =>
          ({
            AUTH_BOOTSTRAP_EMAIL: 'ADMIN@example.com',
            AUTH_BOOTSTRAP_PASSWORD: 'a-secure-password',
          })[key],
      ),
    } as unknown as ConfigService;

    await new AdminBootstrapService(users, config).onApplicationBootstrap();

    expect(users.findOne.mock.calls).toContainEqual([{ where: { email: 'admin@example.com' } }]);
    expect(users.save.mock.calls).toHaveLength(0);
  });

  it('exige que e-mail e senha sejam configurados em conjunto', async () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'AUTH_BOOTSTRAP_EMAIL' ? 'admin@example.com' : undefined,
      ),
    } as unknown as ConfigService;

    await expect(new AdminBootstrapService(users, config).onApplicationBootstrap()).rejects.toThrow(
      'devem ser configurados em conjunto',
    );
  });
});
