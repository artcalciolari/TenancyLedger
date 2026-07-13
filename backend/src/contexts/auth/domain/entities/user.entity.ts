import { Exclude } from 'class-transformer';
import {
  Column,
  Check,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ValidationError } from '../../../../core/domain/errors/validation.error';

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  VIEWER = 'VIEWER',
}

@Entity('users')
@Check('CHK_users_email_normalized', 'email = lower(trim(email))')
@Check('CHK_users_password_hash', 'char_length(password_hash) >= 50')
@Check('CHK_users_token_version', 'token_version >= 0')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 254, unique: true })
  email!: string;

  @Column({ name: 'password_hash', select: false })
  @Exclude({ toPlainOnly: true })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole, enumName: 'user_role', default: UserRole.VIEWER })
  role!: UserRole;

  @Column({ default: true })
  active!: boolean;

  @Column({ name: 'token_version', type: 'integer', default: 0 })
  tokenVersion!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  static create(email: string, passwordHash: string, role: UserRole): User {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new ValidationError('E-mail de usuário inválido.');
    }
    if (passwordHash.length < 50) {
      throw new ValidationError('Hash de senha inválido.');
    }
    if (!Object.values(UserRole).includes(role)) {
      throw new ValidationError('Papel de usuário inválido.');
    }

    const user = new User();
    user.email = normalizedEmail;
    user.passwordHash = passwordHash;
    user.role = role;
    user.active = true;
    user.tokenVersion = 0;
    return user;
  }

  updateAccess(role: UserRole, active: boolean): void {
    if (!Object.values(UserRole).includes(role) || typeof active !== 'boolean') {
      throw new ValidationError('Configuração de acesso inválida.');
    }
    this.role = role;
    this.active = active;
    this.tokenVersion += 1;
  }

  changePasswordHash(passwordHash: string): void {
    this.passwordHash = passwordHash;
    this.tokenVersion += 1;
  }
}
