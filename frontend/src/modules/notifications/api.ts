import type { NotificationList, NotificationView } from '../../api/contract';
import { executeOpenApi, executeOpenApiVoid, openApiClient } from '../../api/openapi-client';

export const notificationsApi = {
  list: (): Promise<NotificationList> => executeOpenApi(openApiClient.GET('/notifications')),
  markRead: (id: string): Promise<NotificationView> =>
    executeOpenApi(openApiClient.PATCH('/notifications/{id}/read', { params: { path: { id } } })),
  markAllRead: (): Promise<void> =>
    executeOpenApiVoid(openApiClient.PATCH('/notifications/read-all')),
};
