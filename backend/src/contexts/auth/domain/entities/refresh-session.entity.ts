import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('refresh_sessions')
@Index('IDX_refresh_sessions_user_id', ['userId'])
@Index('IDX_refresh_sessions_family_id', ['familyId'])
@Check('CHK_refresh_sessions_token_hash', "token_hash ~ '^[0-9a-f]{64}$'")
@Check('CHK_refresh_sessions_expiration', 'expires_at > created_at')
@Check('CHK_refresh_sessions_token_version', 'token_version >= 0')
export class RefreshSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @ForeignKey(() => User, {
    name: 'FK_refresh_sessions_user',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  userId!: string;

  @Column({ name: 'family_id', type: 'uuid' })
  familyId!: string;

  @Column({ name: 'token_version', type: 'integer' })
  tokenVersion!: number;

  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true, select: false })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'replaced_by_session_id', type: 'uuid', nullable: true })
  replacedBySessionId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
