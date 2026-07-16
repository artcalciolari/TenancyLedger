import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  NotFoundException,
  Patch,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateTenantUseCase } from '../../../application/use-cases/create-tenant.use-case';
import { TenantQueries } from '../../../application/queries/tenant.queries';
import { UserRole } from '../../../../auth/domain/entities/user.entity';
import { Roles } from '../../../../auth/infrastructure/security/roles.decorator';
import { CurrentUser } from '../../../../auth/infrastructure/security/current-user.decorator';
import type { AuthenticatedUser } from '../../../../auth/application/auth.service';
import { CreateTenantDto } from '../dtos/create-tenant.dto';
import { UpdateTenantDto } from '../dtos/update-tenant.dto';
import { PaginationDto } from '../dtos/pagination.dto';
import {
  PaginatedTenantResponseDto,
  TenantResponseDto,
  toPaginatedTenantResponse,
} from '../dtos/tenant-response.dto';
import {
  ApiConflictProblem,
  ApiNotFoundProblem,
  ApiProtected,
  ApiUnprocessableProblem,
} from '../../../../../core/infrastructure/http/openapi.decorators';
import { UpdateTenantUseCase } from '../../../application/use-cases/update-tenant.use-case';

@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
@ApiProtected()
@ApiTags('Locatários')
@Controller('tenants')
export class TenantController {
  constructor(
    private readonly createTenantUseCase: CreateTenantUseCase,
    private readonly updateTenantUseCase: UpdateTenantUseCase,
    private readonly tenantQueries: TenantQueries,
  ) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post()
  @ApiOperation({ summary: 'Cadastrar locatário' })
  @ApiCreatedResponse({ type: TenantResponseDto })
  @ApiConflictProblem('CPF ou e-mail já cadastrado.')
  @ApiUnprocessableProblem()
  async create(
    @Body() dto: CreateTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TenantResponseDto> {
    const tenant = await this.createTenantUseCase.execute(dto);
    return TenantResponseDto.from(tenant, user.role);
  }

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Patch(':id')
  @ApiOperation({ summary: 'Editar locatário' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TenantResponseDto })
  @ApiNotFoundProblem('Locatário não encontrado.')
  @ApiConflictProblem('Já existe um locatário com este e-mail ou telefone.')
  @ApiUnprocessableProblem()
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TenantResponseDto> {
    return TenantResponseDto.from(await this.updateTenantUseCase.execute(id, dto), user.role);
  }

  @Get()
  @ApiOperation({ summary: 'Listar locatários' })
  @ApiOkResponse({ type: PaginatedTenantResponseDto })
  async findAll(
    @Query() query: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedTenantResponseDto> {
    return toPaginatedTenantResponse(await this.tenantQueries.findAll(query), user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar locatário' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: TenantResponseDto })
  @ApiNotFoundProblem('Locatário não encontrado.')
  async findById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TenantResponseDto> {
    const tenant = await this.tenantQueries.findById(id);
    if (!tenant) {
      throw new NotFoundException('Inquilino não encontrado.');
    }
    return TenantResponseDto.from(tenant, user.role);
  }
}
