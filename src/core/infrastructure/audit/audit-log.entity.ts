import {
  Column,
  CreateDateColumn,
  Entity,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../../contexts/auth/domain/entities/user.entity';

@Entity('audit_logs')
@Index('idx_audit_logs_actor_occurred_at', ['actorId', 'occurredAt'])
@Index('idx_audit_logs_resource', ['resourceType', 'resourceId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  readonly id!: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  @ForeignKey(() => User, {
    name: 'FK_audit_logs_actor',
    onDelete: 'SET NULL',
    onUpdate: 'RESTRICT',
  })
  actorId!: string | null;

  @Column({ length: 120 })
  action!: string;

  @Column({ name: 'resource_type', length: 80 })
  resourceType!: string;

  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId!: string | null;

  @Column({ name: 'request_id', type: 'varchar', length: 100, nullable: true })
  requestId!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, string | number | boolean | null>;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;
}
