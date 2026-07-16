import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Tenant, TenantCivilStatus } from '../../domain/entities/tenant.entity';
import { TenantAlreadyExistsError } from '../../domain/errors/tenant-already-exists.error';
import {
  TENANT_REPOSITORY_TOKEN,
  type ITenantRepository,
} from '../../domain/repositories/tenant.repository';
import { ValidationError } from '../../../../core/domain/errors/validation.error';

export interface UpdateTenantInput {
  name?: string;
  profession?: string;
  civilStatus?: TenantCivilStatus;
  email?: string;
  mobilePhone?: string;
  cpf?: string;
  rg?: string;
}

@Injectable()
export class UpdateTenantUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY_TOKEN)
    private readonly tenantRepository: ITenantRepository,
  ) {}

  async execute(id: string, input: UpdateTenantInput): Promise<Tenant> {
    const tenant = await this.tenantRepository.findById(id);
    if (!tenant) {
      throw new NotFoundException('Locatário não encontrado.');
    }
    if (input.cpf !== undefined || input.rg !== undefined) {
      throw new ValidationError('CPF e RG são imutáveis.');
    }

    tenant.updateProfile(input);
    const [emailOwner, phoneOwner] = await Promise.all([
      this.tenantRepository.findByEmail(tenant.email),
      this.tenantRepository.findByMobilePhone(tenant.mobilePhone),
    ]);
    if (
      (emailOwner && emailOwner.id !== tenant.id) ||
      (phoneOwner && phoneOwner.id !== tenant.id)
    ) {
      throw new TenantAlreadyExistsError('Já existe um locatário com este e-mail ou telefone.');
    }

    try {
      await this.tenantRepository.save(tenant);
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new TenantAlreadyExistsError('Já existe um locatário com este e-mail ou telefone.');
      }
      throw error;
    }
    return tenant;
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError: unknown = error.driverError;
    if (typeof driverError !== 'object' || driverError === null) return false;
    return Reflect.get(driverError, 'code') === '23505';
  }
}
