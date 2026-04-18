import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../domain/entities/tenant.entity';

// Defina exatamente o que a sua API vai devolver.
// Isso evita vazar o modelo de Domínio para fora.
export interface TenantView {
  id: string | null;
  cpf: string | null;
  email: string | null;
  mobilePhone: string | null;
}

@Injectable()
export class TenantQueries
{
  constructor(
    @InjectRepository(Tenant)
    private readonly repository: Repository<Tenant>,
  ) { }

  // O QueryBuilder é a melhor forma de consultar dados de leitura,
  // pois permite apelidar os retornos e usar getRawMany/getRawOne
  // para pular a pesada hidratação de Entidades do TypeORM.
  private get baseQuery()
  {
    return this.repository.createQueryBuilder('tenant')
      .select('tenant.id', 'id')
      .addSelect('tenant.cpf', 'cpf')
      .addSelect('tenant._email', '_email')
      .addSelect('tenant._mobilePhone', '_mobilePhone')
      .addSelect('tenant._profession', '_profession')
      .addSelect('tenant._civilStatus', '_civilStatus');
  }

  async findAll(): Promise<TenantView[]>
  {
    return this.baseQuery.getRawMany();
  }

  async findById(id: string): Promise<TenantView | null>
  {
    return await this.baseQuery.where('tenant.id = :id', { id }).getRawOne() ?? null;
  }

  async findByCpf(cpf: string): Promise<TenantView | null>
  {
    return await this.baseQuery.where('tenant.cpf = :cpf', { cpf }).getRawOne() ?? null;
  }

  async findByEmail(email: string): Promise<TenantView | null>
  {
    return await this.baseQuery.where('tenant._email = :email', { email }).getRawOne() ?? null;
  }

  async findByMobilePhone(mobilePhone: string): Promise<TenantView | null>
  {
    return await this.baseQuery.where('tenant._mobilePhone = :mobilePhone', { mobilePhone }).getRawOne() ?? null;
  }
}
