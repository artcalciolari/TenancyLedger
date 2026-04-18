import { Tenant } from '../entities/tenant.entity';

export const TENANT_REPOSITORY_TOKEN = Symbol('TENANT_REPOSITORY_TOKEN');

export interface ITenantRepository {
  save(tenant: Tenant): Promise<void>;
  findAll(): Promise<Tenant[]>;
  findByCpf(cpf: string): Promise<Tenant | null>;
  findByEmail(email: string): Promise<Tenant | null>;
  findByMobilePhone(mobilePhone: string): Promise<Tenant | null>;
  findById(id: string): Promise<Tenant | null>;
}
