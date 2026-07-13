import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiAcceptedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../contexts/auth/domain/entities/user.entity';
import type { AuthenticatedUser } from '../../contexts/auth/application/auth.service';
import { CurrentUser } from '../../contexts/auth/infrastructure/security/current-user.decorator';
import { Roles } from '../../contexts/auth/infrastructure/security/roles.decorator';
import { ApiProtected } from '../../core/infrastructure/http/openapi.decorators';
import { AuditLog } from '../../core/infrastructure/audit/audit-log.entity';
import { ClientErrorDto } from './client-error.dto';

@ApiProtected()
@ApiTags('Observabilidade do cliente')
@Controller('client-errors')
export class ClientObservabilityController {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogs: Repository<AuditLog>,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Registrar uma falha sanitizada do frontend' })
  @ApiAcceptedResponse({ description: 'Falha aceita para correlação operacional.' })
  async report(
    @CurrentUser() user: AuthenticatedUser,
    @Body() report: ClientErrorDto,
  ): Promise<void> {
    await this.auditLogs.insert({
      actorId: user.id,
      action: `CLIENT_ERROR ${report.kind}`,
      resourceType: 'frontend',
      resourceId: null,
      requestId: report.requestId ?? null,
      metadata: {
        fingerprint: report.fingerprint,
        route: report.route,
        release: report.release ?? null,
        status: report.status ?? null,
      },
    });
  }
}
