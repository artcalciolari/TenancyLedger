import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../domain/entities/tenant.entity';
import { TENANT_REPOSITORY_TOKEN } from '../domain/repositories/tenant.repository';
import { TenantTypeOrmRepository } from './database/tenant.typeorm.repository';
import { CreateTenantUseCase } from '../application/use-cases/create-tenant.use-case';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  providers: [
    {
      provide: TENANT_REPOSITORY_TOKEN,
      useClass: TenantTypeOrmRepository,
    },
    CreateTenantUseCase,
  ],
  exports: [CreateTenantUseCase], // Expondo caso algum outro contexto precise (opcional)
})
export class TenantModule {}
