import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { UserRole } from '../auth/domain/entities/user.entity';
import { Roles } from '../auth/infrastructure/security/roles.decorator';
import {
  ApiProtected,
  ApiUnprocessableProblem,
} from '../../core/infrastructure/http/openapi.decorators';
import { DashboardSummaryResponseDto } from './dashboard-response.dto';
import { DashboardService } from './dashboard.service';

export class DashboardPeriodQueryDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description: 'Início inclusivo dos recebimentos. Padrão: primeiro dia do mês corrente.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    description: 'Fim inclusivo dos recebimentos. Padrão: hoje.',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}

@ApiProtected()
@ApiTags('Dashboard')
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Consultar agregados globais do dashboard' })
  @ApiOkResponse({ type: DashboardSummaryResponseDto })
  @ApiUnprocessableProblem('O período de recebimentos é inválido.')
  summary(@Query() query: DashboardPeriodQueryDto): Promise<DashboardSummaryResponseDto> {
    return this.dashboardService.getSummary(undefined, query.from, query.to);
  }
}
