import { ValidationError } from '../../../../core/domain/errors/validation.error';
import { User, UserRole } from './user.entity';

const PASSWORD_HASH = 'h'.repeat(60);

function createUser(): User {
  return User.create('manager@example.com', PASSWORD_HASH, UserRole.MANAGER);
}

describe('User', () => {
  it('normalizes the email and starts with active access at token version zero', () => {
    const user = User.create('  MANAGER@EXAMPLE.COM  ', 'h'.repeat(50), UserRole.MANAGER);

    expect(user).toMatchObject({
      email: 'manager@example.com',
      passwordHash: 'h'.repeat(50),
      role: UserRole.MANAGER,
      active: true,
      tokenVersion: 0,
    });
  });

  it.each([
    {
      scenario: 'malformed email',
      create: () => User.create('manager.example.com', PASSWORD_HASH, UserRole.MANAGER),
    },
    {
      scenario: 'email above 254 characters',
      create: () => User.create(`${'a'.repeat(250)}@x.com`, PASSWORD_HASH, UserRole.MANAGER),
    },
    {
      scenario: 'short password hash',
      create: () => User.create('manager@example.com', 'h'.repeat(49), UserRole.MANAGER),
    },
    {
      scenario: 'unknown role',
      create: () => User.create('manager@example.com', PASSWORD_HASH, 'SUPER_ADMIN' as UserRole),
    },
  ])('rejects a $scenario', ({ create }) => {
    expect(create).toThrow(ValidationError);
  });

  it('updates access and increments the token version on repeated changes', () => {
    const user = createUser();

    user.updateAccess(UserRole.VIEWER, false);
    expect(user).toMatchObject({
      role: UserRole.VIEWER,
      active: false,
      tokenVersion: 1,
    });

    user.updateAccess(UserRole.VIEWER, false);
    expect(user.tokenVersion).toBe(2);
  });

  it.each([
    {
      scenario: 'unknown role',
      update: (user: User) => user.updateAccess('SUPER_ADMIN' as UserRole, false),
    },
    {
      scenario: 'non-boolean active flag',
      update: (user: User) => user.updateAccess(UserRole.ADMIN, 'yes' as unknown as boolean),
    },
  ])('rejects an access update with $scenario without mutating state', ({ update }) => {
    const user = createUser();

    expect(() => update(user)).toThrow(ValidationError);
    expect(user).toMatchObject({
      role: UserRole.MANAGER,
      active: true,
      tokenVersion: 0,
    });
  });

  it('changes the password hash and revokes sessions on every change', () => {
    const user = createUser();
    const firstHash = 'a'.repeat(60);
    const secondHash = 'b'.repeat(60);

    user.changePasswordHash(firstHash);
    user.changePasswordHash(secondHash);

    expect(user.passwordHash).toBe(secondHash);
    expect(user.tokenVersion).toBe(2);
  });

  it('rejects a short replacement hash without mutating the hash or token version', () => {
    const user = createUser();

    expect(() => user.changePasswordHash('a'.repeat(49))).toThrow(ValidationError);
    expect(user.passwordHash).toBe(PASSWORD_HASH);
    expect(user.tokenVersion).toBe(0);
  });

  it('accepts a 50-character replacement hash and increments the token version once', () => {
    const user = createUser();
    const replacementHash = 'a'.repeat(50);

    user.changePasswordHash(replacementHash);

    expect(user.passwordHash).toBe(replacementHash);
    expect(user.tokenVersion).toBe(1);
  });
});
