import { NotFoundException } from '@nestjs/common';
import { IsNull, type Repository, type UpdateQueryBuilder } from 'typeorm';
import { Notification, NotificationType } from './domain/notification.entity';
import { NotificationService } from './notification.service';

const USER_ID = '7fdf9cde-2961-4ed2-a3ae-eedce12a42ee';
const OTHER_USER_ID = 'e5c1163a-8151-41e3-b953-350cb36435b1';
const NOTIFICATION_ID = 'dad91a88-583f-4b2a-9ac6-0d8eb14cd266';

function notification(): Notification {
  return Object.assign(new Notification(), {
    id: NOTIFICATION_ID,
    userId: USER_ID,
    type: NotificationType.PAYMENT_SUBMITTED,
    title: 'Pagamento aguardando revisão',
    message: 'Um pagamento foi submetido e precisa ser revisado.',
    resourceType: 'INVOICE',
    resourceId: '0a60a4ca-1a8e-4f0a-b0ee-2196db87ac51',
    readAt: null,
    createdAt: new Date('2026-07-12T12:00:00.000Z'),
  });
}

describe('NotificationService', () => {
  let repository: jest.Mocked<Repository<Notification>>;
  let update: jest.Mocked<UpdateQueryBuilder<Notification>>;
  let service: NotificationService;

  beforeEach(() => {
    update = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 2 }),
    } as unknown as jest.Mocked<UpdateQueryBuilder<Notification>>;
    repository = {
      find: jest.fn().mockResolvedValue([notification()]),
      countBy: jest.fn().mockResolvedValueOnce(21).mockResolvedValueOnce(3),
      findOne: jest.fn(),
      save: jest.fn((entry: Notification) => Promise.resolve(entry)),
      createQueryBuilder: jest.fn().mockReturnValue(update),
    } as unknown as jest.Mocked<Repository<Notification>>;
    service = new NotificationService(repository);
  });

  it('pagina somente as notificações do próprio usuário e informa as não lidas', async () => {
    await expect(service.list(USER_ID, 2, 10)).resolves.toMatchObject({
      data: [{ id: NOTIFICATION_ID, resourceType: 'INVOICE', readAt: null }],
      meta: { page: 2, limit: 10, total: 21, totalPages: 3 },
      unreadCount: 3,
    });
    expect(repository.find.mock.calls).toContainEqual([
      {
        where: { userId: USER_ID },
        order: { createdAt: 'DESC', id: 'ASC' },
        skip: 10,
        take: 10,
      },
    ]);
    expect(repository.countBy.mock.calls[0]).toEqual([{ userId: USER_ID }]);
    expect(repository.countBy.mock.calls[1]).toEqual([{ userId: USER_ID, readAt: IsNull() }]);
  });

  it('não permite marcar como lida uma notificação de outro usuário', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.markRead(OTHER_USER_ID, NOTIFICATION_ID)).rejects.toEqual(
      new NotFoundException('Notificação não encontrada.'),
    );
    expect(repository.findOne.mock.calls).toContainEqual([
      { where: { id: NOTIFICATION_ID, userId: OTHER_USER_ID } },
    ]);
  });

  it('marca uma notificação como lida de forma idempotente', async () => {
    const entry = notification();
    repository.findOne.mockResolvedValue(entry);

    const result = await service.markRead(USER_ID, NOTIFICATION_ID);
    expect(result.readAt).toBeInstanceOf(Date);
    expect(repository.save.mock.calls).toContainEqual([entry]);
  });

  it('marca em lote apenas as notificações não lidas do usuário', async () => {
    await expect(service.markAllRead(USER_ID)).resolves.toBe(2);
    expect(update.where.mock.calls).toContainEqual(['user_id = :userId', { userId: USER_ID }]);
    expect(update.andWhere.mock.calls).toContainEqual(['read_at IS NULL']);
  });
});
