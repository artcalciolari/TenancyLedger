import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../auth/domain/entities/user.entity';
import { Roles } from '../auth/infrastructure/security/roles.decorator';
import { ApiProtected } from '../../core/infrastructure/http/openapi.decorators';
import { DashboardSummaryResponseDto } from './dashboard-response.dto';
import { DashboardService } from './dashboard.service';

@ApiProtected()
@ApiTags('Dashboard')
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Consultar agregados globais do dashboard' })
  @ApiOkResponse({ type: DashboardSummaryResponseDto })
  summary(): Promise<DashboardSummaryResponseDto> {
    return this.dashboardService.getSummary();
  }
}
