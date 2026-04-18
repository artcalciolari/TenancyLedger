import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Tenant } from '../../../tenant/domain/entities/tenant.entity';
import { ITenantRepository } from '../../../tenant/domain/repositories/tenant.repository';

@Injectable()
export class TenantTypeOrmRepository implements ITenantRepository
{
  constructor(
    @InjectRepository(Tenant)
    private readonly repository: Repository<Tenant>,
  ) {}

  async save(tenant: Tenant): Promise<void>
  {
    await this.repository.save(tenant);
  }

  async findAll(): Promise<Tenant[]>
  {
    return this.repository.find();
  }

  async findById(id: string): Promise<Tenant | null>
  {
    return this.repository.findOne({ where: { id } });
  }

  async findByCpf(cpf: string): Promise<Tenant | null>
  {
    return this.repository.findOne({ where: { _cpf: { _value: cpf } } as unknown as FindOptionsWhere<Tenant> });
  }

  async findByEmail(email: string): Promise<Tenant | null>
  {
    return this.repository.findOne({ where: { _email: email } as unknown as FindOptionsWhere<Tenant> });
  }

  async findByMobilePhone(mobilePhone: string): Promise<Tenant | null>
  {
    return this.repository.findOne({ where: { _mobile: mobilePhone } as unknown as FindOptionsWhere<Tenant> });
  }
}
