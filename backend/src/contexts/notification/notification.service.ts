import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Notification } from './domain/notification.entity';
import type { NotificationResponseDto } from './notification.dto';

export interface PaginatedNotifications {
  data: NotificationResponseDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  unreadCount: number;
}

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
  ) {}

  async list(userId: string, page: number, limit: number): Promise<PaginatedNotifications> {
    const [items, total, unreadCount] = await Promise.all([
      this.notifications.find({
        where: { userId },
        order: { createdAt: 'DESC', id: 'ASC' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.notifications.countBy({ userId }),
      this.notifications.countBy({ userId, readAt: IsNull() }),
    ]);
    return {
      data: items.map((notification) => this.toView(notification)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      unreadCount,
    };
  }

  async markRead(userId: string, id: string): Promise<NotificationResponseDto> {
    const notification = await this.notifications.findOne({ where: { id, userId } });
    if (!notification) throw new NotFoundException('Notificação não encontrada.');
    notification.markRead(new Date());
    return this.toView(await this.notifications.save(notification));
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.notifications
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('read_at IS NULL')
      .execute();
    return result.affected ?? 0;
  }

  private toView(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      resourceType: notification.resourceType,
      resourceId: notification.resourceId,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}
