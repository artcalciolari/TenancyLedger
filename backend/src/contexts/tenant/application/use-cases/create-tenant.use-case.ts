import { Injectable, Inject } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Tenant, TenantCivilStatus } from '../../domain/entities/tenant.entity';
import { TENANT_REPOSITORY_TOKEN } from '../../domain/repositories/tenant.repository';
import type { ITenantRepository } from '../../domain/repositories/tenant.repository';
import { TenantAlreadyExistsError } from '../../domain/errors/tenant-already-exists.error';
import { CpfVO } from '../../domain/value-objects/cpf.vo';

// Pode virar um arquivo separado depois se reaproveitar, mas manter perto do Use Case é pragmático agora.
export interface CreateTenantInput {
  name: string;
  cpf: string;
  rg: string;
  profession: string;
  civilStatus: TenantCivilStatus;
  email: string;
  mobilePhone: string;
}

@Injectable()
export class CreateTenantUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY_TOKEN)
    private readonly tenantRepository: ITenantRepository,
  ) {}

  async execute(input: CreateTenantInput): Promise<Tenant> {
    const normalizedCpf = CpfVO.create(input.cpf).value;
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedMobilePhone = Tenant.normalizeMobilePhone(input.mobilePhone);
    const duplicates = await Promise.all([
      this.tenantRepository.findByCpf(normalizedCpf),
      this.tenantRepository.findByEmail(normalizedEmail),
      this.tenantRepository.findByMobilePhone(normalizedMobilePhone),
    ]);
    if (duplicates.some(Boolean)) {
      throw new TenantAlreadyExistsError();
    }

    const tenant = Tenant.create(
      input.name,
      normalizedCpf,
      input.rg,
      input.profession,
      input.civilStatus,
      normalizedEmail,
      normalizedMobilePhone,
    );

    try {
      await this.tenantRepository.save(tenant);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new TenantAlreadyExistsError();
      }
      throw error;
    }
    return tenant;
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    return (error.driverError as Error & { code?: string }).code === '23505';
  }
}
