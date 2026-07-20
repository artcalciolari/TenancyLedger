import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '../auth/domain/entities/user.entity';
import type { AuthenticatedUser } from '../auth/application/auth.service';
import { CurrentUser } from '../auth/infrastructure/security/current-user.decorator';
import { Roles } from '../auth/infrastructure/security/roles.decorator';
import {
  ApiProtected,
  ApiUnprocessableProblem,
} from '../../core/infrastructure/http/openapi.decorators';
import {
  CashClosingListQueryDto,
  CashClosingResponseDto,
  CloseCashboxDto,
  ReopenCashboxDto,
} from './cashbox.dto';
import { CashboxService } from './cashbox.service';

@ApiProtected()
@ApiTags('Fechamento de caixa')
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('cash-closings')
export class CashboxController {
  constructor(private readonly cashbox: CashboxService) {}

  @Get()
  @ApiOperation({ summary: 'Listar fechamentos de caixa' })
  @ApiOkResponse({ type: [CashClosingResponseDto] })
  @ApiUnprocessableProblem()
  list(@Query() query: CashClosingListQueryDto): Promise<CashClosingResponseDto[]> {
    return this.cashbox.list(query.from, query.to);
  }

  @Get(':date')
  @ApiOperation({ summary: 'Consultar o fechamento de uma data' })
  @ApiParam({ name: 'date', schema: { type: 'string', format: 'date' } })
  @ApiOkResponse({ type: CashClosingResponseDto })
  @ApiNotFoundResponse({ description: 'Fechamento não encontrado.' })
  @ApiUnprocessableProblem()
  get(@Param('date') date: string): Promise<CashClosingResponseDto> {
    return this.cashbox.get(date);
  }

  @Post(':date')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fechar ou fechar novamente o caixa de uma data' })
  @ApiParam({ name: 'date', schema: { type: 'string', format: 'date' } })
  @ApiOkResponse({ type: CashClosingResponseDto })
  @ApiConflictResponse({ description: 'O dia já está fechado.' })
  @ApiUnprocessableProblem()
  close(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('date') date: string,
    @Body() body: CloseCashboxDto,
  ): Promise<CashClosingResponseDto> {
    return this.cashbox.close(date, body.countedCashCents, actor.id);
  }

  @Post(':date/reopen')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reabrir o caixa de uma data' })
  @ApiParam({ name: 'date', schema: { type: 'string', format: 'date' } })
  @ApiOkResponse({ type: CashClosingResponseDto })
  @ApiNotFoundResponse({ description: 'Fechamento não encontrado.' })
  @ApiConflictResponse({ description: 'O dia já está reaberto.' })
  @ApiUnprocessableProblem()
  reopen(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('date') date: string,
    @Body() body: ReopenCashboxDto,
  ): Promise<CashClosingResponseDto> {
    return this.cashbox.reopen(date, body.reason, actor.id);
  }
}
