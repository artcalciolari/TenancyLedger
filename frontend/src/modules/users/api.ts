import type {
  CreateUserInput,
  Paginated,
  UpdateUserAccessInput,
  UserView,
} from '../../api/contract';
import { executeOpenApi, openApiClient } from '../../api/openapi-client';

export const usersApi = {
  list: (page: number, limit: number): Promise<Paginated<UserView>> =>
    executeOpenApi(openApiClient.GET('/auth/users', { params: { query: { page, limit } } })),
  create: (input: CreateUserInput): Promise<UserView> =>
    executeOpenApi(openApiClient.POST('/auth/users', { body: input })),
  updateAccess: (id: string, input: UpdateUserAccessInput): Promise<UserView> =>
    executeOpenApi(
      openApiClient.PATCH('/auth/users/{id}/access', {
        params: { path: { id } },
        body: input,
      }),
    ),
};
