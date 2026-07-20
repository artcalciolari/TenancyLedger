import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './domain/entities/tenant.entity';
import { TENANT_REPOSITORY_TOKEN } from './domain/repositories/tenant.repository';
import { TenantTypeOrmRepository } from './infrastructure/database/tenant.typeorm.repository';
import { CreateTenantUseCase } from './application/use-cases/create-tenant.use-case';
import { TenantQueries } from './application/queries/tenant.queries';
import { TenantController } from './infrastructure/http/controllers/tenant.controller';
import { UpdateTenantUseCase } from './application/use-cases/update-tenant.use-case';
import { TenantReference } from './domain/entities/tenant-reference.entity';
import { TenantPhotoUseCase } from './application/use-cases/tenant-photo.use-case';
import { TenantReferencesUseCase } from './application/use-cases/tenant-references.use-case';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant, TenantReference])],
  controllers: [TenantController],
  providers: [
    {
      provide: TENANT_REPOSITORY_TOKEN,
      useClass: TenantTypeOrmRepository,
    },
    CreateTenantUseCase,
    UpdateTenantUseCase,
    TenantPhotoUseCase,
    TenantReferencesUseCase,
    TenantQueries,
  ],
  exports: [CreateTenantUseCase, UpdateTenantUseCase, TenantQueries, TenantReferencesUseCase],
})
export class TenantModule {}
