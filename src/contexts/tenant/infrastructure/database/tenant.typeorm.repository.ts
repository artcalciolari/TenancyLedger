import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../../tenant/domain/entities/tenant.entity';
import { ITenantRepository } from '../../../tenant/domain/repositories/tenant.repository';

@Injectable()
export class TenantTypeOrmRepository implements ITenantRepository {
  constructor(
    @InjectRepository(Tenant)
    private readonly repository: Repository<Tenant>,
  ) {}

  async save(tenant: Tenant): Promise<void> {
    await this.repository.save(tenant);
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByCpf(cpf: string): Promise<Tenant | null> {
    return this.repository.findOne({ where: { cpf } });
  }

  async findByEmail(email: string): Promise<Tenant | null> {
    return this.repository.findOne({ where: { email } });
  }

  async findByMobilePhone(mobilePhone: string): Promise<Tenant | null> {
    return this.repository.findOne({ where: { mobilePhone } });
  }
}
