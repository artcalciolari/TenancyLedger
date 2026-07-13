import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/application/auth.service';
import { UserRole } from '../auth/domain/entities/user.entity';
import { CurrentUser } from '../auth/infrastructure/security/current-user.decorator';
import { Roles } from '../auth/infrastructure/security/roles.decorator';
import {
  ApiNotFoundProblem,
  ApiProtected,
} from '../../core/infrastructure/http/openapi.decorators';
import {
  NotificationPaginationDto,
  NotificationResponseDto,
  PaginatedNotificationsResponseDto,
} from './notification.dto';
import { NotificationService } from './notification.service';

@ApiTags('Notificações')
@ApiProtected()
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Listar as notificações do usuário autenticado' })
  @ApiOkResponse({ type: PaginatedNotificationsResponseDto })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationPaginationDto,
  ): ReturnType<NotificationService['list']> {
    return this.notifications.list(user.id, query.page, query.limit);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marcar todas as notificações do usuário como lidas' })
  @ApiNoContentResponse()
  async markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.notifications.markAllRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marcar uma notificação do usuário como lida' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: NotificationResponseDto })
  @ApiNotFoundProblem('Notificação não encontrada.')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<NotificationResponseDto> {
    return this.notifications.markRead(user.id, id);
  }
}
