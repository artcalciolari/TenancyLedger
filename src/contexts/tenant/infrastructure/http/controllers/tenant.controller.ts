import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { CreateTenantUseCase } from '../../../application/use-cases/create-tenant.use-case';
import { TenantQueries } from '../../../application/queries/tenant.queries';
import { UserRole } from '../../../../auth/domain/entities/user.entity';
import { Roles } from '../../../../auth/infrastructure/security/roles.decorator';
import { CreateTenantDto } from '../dtos/create-tenant.dto';
import { PaginationDto } from '../dtos/pagination.dto';
import {
  PaginatedTenantResponseDto,
  TenantResponseDto,
  toPaginatedTenantResponse,
} from '../dtos/tenant-response.dto';

@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.VIEWER)
@Controller('tenants')
export class TenantController {
  constructor(
    private readonly createTenantUseCase: CreateTenantUseCase,
    private readonly tenantQueries: TenantQueries,
  ) {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Post()
  async create(@Body() dto: CreateTenantDto): Promise<TenantResponseDto> {
    const tenant = await this.createTenantUseCase.execute(dto);
    return TenantResponseDto.from(tenant);
  }

  @Get()
  async findAll(@Query() query: PaginationDto): Promise<PaginatedTenantResponseDto> {
    return toPaginatedTenantResponse(await this.tenantQueries.findAll(query.page, query.limit));
  }

  @Get(':id')
  async findById(@Param('id', new ParseUUIDPipe()) id: string): Promise<TenantResponseDto> {
    const tenant = await this.tenantQueries.findById(id);
    if (!tenant) {
      throw new NotFoundException('Inquilino não encontrado.');
    }
    return TenantResponseDto.from(tenant);
  }
}
