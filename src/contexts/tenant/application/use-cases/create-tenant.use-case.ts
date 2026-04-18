import { Injectable, Inject } from '@nestjs/common';
import { Tenant } from '../../domain/entities/tenant.entity';
import { TENANT_REPOSITORY_TOKEN } from '../../domain/repositories/tenant.repository';
import type { ITenantRepository } from '../../domain/repositories/tenant.repository';
import { TenantAlreadyExistsError } from '../../domain/errors/tenant-already-exists.error';

// Pode virar um arquivo separado depois se reaproveitar, mas manter perto do Use Case é pragmático agora.
export interface CreateTenantInput {
  cpf: string;
  rg: string;
  profession: string;
  civilStatus: string;
  email: string;
  mobile: string;
}

@Injectable()
export class CreateTenantUseCase
{
  constructor(
    @Inject(TENANT_REPOSITORY_TOKEN)
    private readonly tenantRepository: ITenantRepository,
  ) {}

  async execute(input: CreateTenantInput): Promise<Tenant>
  {
    const existingTenant = await this.tenantRepository.findByCpf(input.cpf);
    if (existingTenant)
    {
      throw new TenantAlreadyExistsError(input.cpf);
    }

    const tenant = Tenant.create(
      input.cpf,
      input.rg,
      input.profession,
      input.civilStatus,
      input.email,
      input.mobile,
    );

    await this.tenantRepository.save(tenant);
    return tenant;
  }
}
