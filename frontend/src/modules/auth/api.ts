import type { ChangePasswordInput, LoginInput, LoginResponse } from '../../api/contract';
import { executeOpenApi, executeOpenApiVoid, openApiClient } from '../../api/openapi-client';

export const authApi = {
  login: (input: LoginInput): Promise<LoginResponse> =>
    executeOpenApi(openApiClient.POST('/auth/login', { body: input })),
  changePassword: (input: ChangePasswordInput): Promise<void> =>
    executeOpenApiVoid(openApiClient.POST('/auth/change-password', { body: input })),
};
