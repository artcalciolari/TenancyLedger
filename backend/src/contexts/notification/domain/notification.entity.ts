import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../auth/domain/entities/user.entity';

export enum NotificationType {
  PAYMENT_SUBMITTED = 'PAYMENT_SUBMITTED',
  PAYMENT_APPROVED = 'PAYMENT_APPROVED',
  PAYMENT_REJECTED = 'PAYMENT_REJECTED',
  RENEWAL_DUE = 'RENEWAL_DUE',
  PAYMENT_OVERDUE = 'PAYMENT_OVERDUE',
}

@Entity('notifications')
@Index('IDX_notifications_user_created', ['userId', 'createdAt', 'id'])
@Index('IDX_notifications_user_unread', ['userId', 'createdAt'], {
  where: 'read_at IS NULL',
})
@Index('UQ_notifications_user_deduplication', ['userId', 'deduplicationKey'], {
  unique: true,
  where: 'deduplication_key IS NOT NULL',
})
@Check(
  'CHK_notifications_type',
  "type IN ('PAYMENT_SUBMITTED', 'PAYMENT_APPROVED', 'PAYMENT_REJECTED', 'RENEWAL_DUE', 'PAYMENT_OVERDUE')",
)
@Check(
  'CHK_notifications_content',
  'char_length(trim(title)) > 0 AND char_length(trim(message)) > 0',
)
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @ForeignKey(() => User, {
    name: 'FK_notifications_user',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  })
  userId!: string;

  @Column({ type: 'varchar', length: 40 })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  @Column({ type: 'varchar', length: 500 })
  message!: string;

  @Column({ name: 'resource_type', type: 'varchar', length: 40 })
  resourceType!: string;

  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId!: string;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @Column({
    name: 'deduplication_key',
    type: 'varchar',
    length: 160,
    nullable: true,
    select: false,
  })
  deduplicationKey!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  markRead(at: Date): void {
    if (!this.readAt) this.readAt = new Date(at);
  }
}
