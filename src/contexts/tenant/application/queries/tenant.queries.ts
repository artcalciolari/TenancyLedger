import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Tenant, TenantCivilStatus } from '../../domain/entities/tenant.entity';

export interface TenantView {
  id: string;
  cpf: string;
  profession: string;
  civilStatus: TenantCivilStatus;
  email: string;
  mobilePhone: string;
}

export interface PaginatedTenantView {
  data: TenantView[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class TenantQueries {
  constructor(
    @InjectRepository(Tenant)
    private readonly repository: Repository<Tenant>,
  ) {}

  private get baseQuery(): SelectQueryBuilder<Tenant> {
    return this.repository
      .createQueryBuilder('tenant')
      .select('tenant.id', 'id')
      .addSelect('tenant.cpf', 'cpf')
      .addSelect('tenant.profession', 'profession')
      .addSelect('tenant.civilStatus', 'civilStatus')
      .addSelect('tenant.email', 'email')
      .addSelect('tenant.mobilePhone', 'mobilePhone');
  }

  async findAll(page: number, limit: number): Promise<PaginatedTenantView> {
    const [data, total] = await Promise.all([
      this.baseQuery
        .orderBy('tenant.createdAt', 'DESC')
        .addOrderBy('tenant.id', 'ASC')
        .offset((page - 1) * limit)
        .limit(limit)
        .getRawMany<TenantView>(),
      this.repository.count(),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<TenantView | null> {
    return (await this.baseQuery.where('tenant.id = :id', { id }).getRawOne<TenantView>()) ?? null;
  }
}
