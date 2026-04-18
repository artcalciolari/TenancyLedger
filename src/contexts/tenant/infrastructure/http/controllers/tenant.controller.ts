import { Controller, Post, Body, Get } from '@nestjs/common';
import { CreateTenantUseCase } from '../../../application/use-cases/create-tenant.use-case';
import { CreateTenantDto } from '../dtos/create-tenant.dto';
import { TenantQueries } from '../../../application/queries/tenant.queries';

@Controller('tenants')
export class TenantController
{
  constructor(
    private readonly createTenantUseCase: CreateTenantUseCase,
    private readonly tenantQueries: TenantQueries,
  ) {}

  @Post()
  async create(@Body() dto: CreateTenantDto)
  {
    const tenant = await this.createTenantUseCase.execute(dto);

    return {
      id: tenant.id,
      cpf: tenant.cpf,
      rg: tenant.rg,
      profession: tenant.profession,
      civilStatus: tenant.civilStatus,
      email: tenant.email,
      mobilePhone: tenant.mobilePhone,
    };
  }

  @Get()
  async findAll()
  {
    return this.tenantQueries.findAll();
  }
}
