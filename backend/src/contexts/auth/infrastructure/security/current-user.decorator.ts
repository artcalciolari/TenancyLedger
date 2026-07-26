import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../application/auth.service';

export const currentUserFactory = (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
  context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user;

export const CurrentUser = createParamDecorator(currentUserFactory);
