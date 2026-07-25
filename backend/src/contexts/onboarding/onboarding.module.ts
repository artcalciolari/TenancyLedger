import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingDraftService } from './application/onboarding-draft.service';
import { OnboardingDraft } from './domain/onboarding-draft.entity';
import { OnboardingDraftController } from './infrastructure/http/onboarding-draft.controller';
import { CompleteOnboardingService } from './application/complete-onboarding.service';
import { Tenant } from '../tenant/domain/entities/tenant.entity';
import { TenantReference } from '../tenant/domain/entities/tenant-reference.entity';
import { Room } from '../property/domain/room.entity';
import { Contract } from '../contract/domain/entities/contract.entity';
import { Invoice } from '../invoice/domain/entities/invoice.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([OnboardingDraft, Tenant, TenantReference, Room, Contract, Invoice]),
  ],
  controllers: [OnboardingDraftController],
  providers: [OnboardingDraftService, CompleteOnboardingService],
  exports: [OnboardingDraftService, CompleteOnboardingService],
})
export class OnboardingModule {}
