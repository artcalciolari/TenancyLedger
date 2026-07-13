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

export interface TenantListFilters {
  page: number;
  limit: number;
  q?: string;
  civilStatus?: TenantCivilStatus;
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

  async findAll(filters: TenantListFilters): Promise<PaginatedTenantView> {
    const { page, limit } = filters;
    const dataQuery = this.applyFilters(this.baseQuery, filters);
    const countQuery = this.applyFilters(this.repository.createQueryBuilder('tenant'), filters);
    const [data, total] = await Promise.all([
      dataQuery
        .orderBy('tenant.createdAt', 'DESC')
        .addOrderBy('tenant.id', 'ASC')
        .offset((page - 1) * limit)
        .limit(limit)
        .getRawMany<TenantView>(),
      countQuery.getCount(),
    ]);

    return { data, total, page, limit };
  }

  private applyFilters(
    query: SelectQueryBuilder<Tenant>,
    filters: Pick<TenantListFilters, 'q' | 'civilStatus'>,
  ): SelectQueryBuilder<Tenant> {
    const q = filters.q?.trim();
    if (q) {
      const escaped = q.replace(/[\\%_]/g, (character) => `\\${character}`);
      const digits = q.replace(/\D/g, '');
      query.andWhere(
        `(
          tenant.profession ILIKE :q ESCAPE '\\'
          OR tenant.email ILIKE :q ESCAPE '\\'
          OR tenant.cpf LIKE :digits ESCAPE '\\'
          OR tenant.mobilePhone LIKE :digits ESCAPE '\\'
        )`,
        { q: `%${escaped}%`, digits: `%${digits || escaped}%` },
      );
    }
    if (filters.civilStatus) {
      query.andWhere('tenant.civilStatus = :civilStatus', { civilStatus: filters.civilStatus });
    }
    return query;
  }

  async findById(id: string): Promise<TenantView | null> {
    return (await this.baseQuery.where('tenant.id = :id', { id }).getRawOne<TenantView>()) ?? null;
  }
}
