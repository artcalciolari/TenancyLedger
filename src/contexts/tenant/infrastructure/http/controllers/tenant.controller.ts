import { Controller, Post, Body } from '@nestjs/common';
import { CreateTenantUseCase } from '../../../application/use-cases/create-tenant.use-case';
import { CreateTenantDto } from '../dtos/create-tenant.dto';

@Controller('tenants')
export class TenantController
{
  constructor(private readonly createTenantUseCase: CreateTenantUseCase) {}

  @Post()
  async create(@Body() dto: CreateTenantDto)
  {
    const tenant = await this.createTenantUseCase.execute(dto);

    // Mapeamento explícito (Presenter) para não vazar o encapsulamento (_cpf, _email, etc).
    // ATENÇÃO: Você precisará criar os getters correspondentes na entidade Tenant (ex: get rg(), get email()).
    return {
      id: tenant.id,
      cpf: tenant.cpf,
      rg: tenant.rg,
      profession: tenant.profession,
      civilStatus: tenant.civilStatus,
      email: tenant.email,
      mobile: tenant.mobile,
    };
  }
}
