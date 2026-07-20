import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { calendarPeriodFrom } from '../../../core/domain/calendar-period';
import { ValidationError } from '../../../core/domain/errors/validation.error';
import { StorageService } from '../../../infrastructure/storage.service';
import { Contract, ContractStatus } from '../../contract/domain/entities/contract.entity';
import { Invoice } from '../../invoice/domain/entities/invoice.entity';
import { PropertyUnit } from '../../property/domain/property-unit.entity';
import { TenantReference } from '../../tenant/domain/entities/tenant-reference.entity';
import { Tenant, TenantCivilStatus } from '../../tenant/domain/entities/tenant.entity';
import { OnboardingDraft, OnboardingDraftStatus } from '../domain/onboarding-draft.entity';

interface CompletionPayload {
  personalData: {
    name: string;
    cpf: string;
    rg: string;
    profession: string;
    civilStatus: TenantCivilStatus;
    email: string;
    mobilePhone: string;
  };
  references: Array<{
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  }>;
  propertyUnitId: string;
  moveInDate: string;
  monthlyBaseValueCents: number;
}

export interface CompleteOnboardingResult {
  draftId: string;
  tenantId: string;
  contractId: string;
  invoiceId: string;
  status: OnboardingDraftStatus.COMPLETED;
}

@Injectable()
export class CompleteOnboardingService {
  private readonly logger = new Logger(CompleteOnboardingService.name);

  constructor(
    @InjectRepository(OnboardingDraft)
    private readonly drafts: Repository<OnboardingDraft>,
    private readonly storage: StorageService,
  ) {}

  async complete(
    draftId: string,
    actorId: string,
    isAdmin: boolean,
  ): Promise<CompleteOnboardingResult> {
    let promotedPhotoKey: string | undefined;
    let draftPhotoKeyToCleanup: string | undefined;
    try {
      const result = await this.drafts.manager.transaction<CompleteOnboardingResult>(
        async (manager) => {
          const draft = await manager
            .getRepository(OnboardingDraft)
            .createQueryBuilder('draft')
            .setLock('pessimistic_write')
            .where('draft.id = :draftId', { draftId })
            .andWhere(isAdmin ? 'TRUE' : 'draft.created_by = :actorId', { actorId })
            .getOne();
          if (!draft) throw new NotFoundException('Rascunho de onboarding não encontrado.');
          if (draft.status !== OnboardingDraftStatus.DRAFT) {
            throw new ConflictException('O rascunho já foi concluído ou descartado.');
          }

          const payload = CompleteOnboardingService.parsePayload(draft.payload);
          const tenant = Tenant.create(
            payload.personalData.name,
            payload.personalData.cpf,
            payload.personalData.rg,
            payload.personalData.profession,
            payload.personalData.civilStatus,
            payload.personalData.email,
            payload.personalData.mobilePhone,
          );
          const property = await manager
            .getRepository(PropertyUnit)
            .findOneBy({ id: payload.propertyUnitId });
          if (!property) throw new NotFoundException('Unidade imobiliária não encontrada.');

          const overlapping = await manager
            .getRepository(Contract)
            .createQueryBuilder('contract')
            .where('contract.property_unit_id = :propertyUnitId', {
              propertyUnitId: payload.propertyUnitId,
            })
            .andWhere('contract.status NOT IN (:...terminalStatuses)', {
              terminalStatuses: [ContractStatus.TERMINATED, ContractStatus.CANCELLED],
            })
            .andWhere("COALESCE(contract.end_date, 'infinity'::date) >= :moveInDate", {
              moveInDate: payload.moveInDate,
            })
            .getExists();
          if (overlapping) {
            throw new ConflictException('A unidade já possui um contrato sobreposto.');
          }

          await manager.save(tenant);

          if (draft.photoStorageKey) {
            const promoted = await this.storage.promoteDraftPhotoToTenant(
              draft.photoStorageKey,
              tenant.id,
            );
            promotedPhotoKey = promoted.key;
            tenant.setPhotoStorageKey(promoted.key);
            draftPhotoKeyToCleanup = draft.photoStorageKey;
            await manager.save(tenant);
          }

          const references = payload.references.map((reference) =>
            TenantReference.create(tenant.id, reference),
          );
          await manager.save(references);

          const contract = Contract.createPendingSignature(
            tenant.id,
            property.id,
            payload.moveInDate,
            payload.monthlyBaseValueCents,
          );
          await manager.save(contract);

          const period = calendarPeriodFrom(payload.moveInDate);
          const competence = period.start.slice(0, 7);
          const contractualDueDate = contract.dueDateFor(competence);
          const dueDate = contractualDueDate < period.start ? period.start : contractualDueDate;
          const invoice = Invoice.create(
            contract.id,
            competence,
            contract.monthlyBaseValueCents,
            dueDate,
            period.start,
            period.end,
          );
          await manager.save(invoice);

          draft.markCompleted();
          await manager.save(draft);
          return {
            draftId: draft.id,
            tenantId: tenant.id,
            contractId: contract.id,
            invoiceId: invoice.id,
            status: OnboardingDraftStatus.COMPLETED,
          };
        },
      );

      if (draftPhotoKeyToCleanup) {
        await this.storage.deleteObject(draftPhotoKeyToCleanup).catch((error: unknown) => {
          this.logger.warn(
            'Não foi possível remover a foto temporária do rascunho concluído.',
            error,
          );
        });
      }
      return result;
    } catch (error: unknown) {
      if (promotedPhotoKey) {
        await this.storage.deleteObject(promotedPhotoKey).catch((cleanupError: unknown) => {
          this.logger.error(
            'Não foi possível remover a foto promovida órfã após falha na conclusão do onboarding.',
            cleanupError,
          );
        });
      }
      const code = CompleteOnboardingService.databaseErrorCode(error);
      if (code === '23505') {
        throw new ConflictException('CPF, e-mail ou telefone já cadastrado.');
      }
      if (code === '23P01') {
        throw new ConflictException('A unidade já possui um contrato sobreposto.');
      }
      throw error;
    }
  }

  private static parsePayload(payload: unknown): CompletionPayload {
    const root = CompleteOnboardingService.record(payload);
    if (root.version !== 1) {
      throw new ValidationError('A versão do rascunho de onboarding não é suportada.');
    }
    const personalData = CompleteOnboardingService.record(root.personalData);
    const civilStatus = CompleteOnboardingService.string(personalData.civilStatus, 'estado civil');
    if (!Object.values(TenantCivilStatus).includes(civilStatus as TenantCivilStatus)) {
      throw new ValidationError('O estado civil do rascunho é inválido.');
    }
    if (!Array.isArray(root.references) || root.references.length < 2) {
      throw new ValidationError('Informe pelo menos duas referências para concluir o cadastro.');
    }
    const monthlyBaseValueCents = root.monthlyBaseValueCents;
    if (!Number.isSafeInteger(monthlyBaseValueCents) || Number(monthlyBaseValueCents) <= 0) {
      throw new ValidationError('O valor mensal do rascunho é inválido.');
    }

    return {
      personalData: {
        name: CompleteOnboardingService.string(personalData.name, 'nome'),
        cpf: CompleteOnboardingService.string(personalData.cpf, 'CPF'),
        rg: CompleteOnboardingService.string(personalData.rg, 'RG'),
        profession: CompleteOnboardingService.string(personalData.profession, 'profissão'),
        civilStatus: civilStatus as TenantCivilStatus,
        email: CompleteOnboardingService.string(personalData.email, 'e-mail'),
        mobilePhone: CompleteOnboardingService.string(personalData.mobilePhone, 'telefone celular'),
      },
      references: root.references.map((entry, index) => {
        const reference = CompleteOnboardingService.record(entry);
        const email = reference.email;
        return {
          name: CompleteOnboardingService.string(reference.name, `nome da referência ${index + 1}`),
          relationship: CompleteOnboardingService.string(
            reference.relationship,
            `relacionamento da referência ${index + 1}`,
          ),
          phone: CompleteOnboardingService.string(
            reference.phone,
            `telefone da referência ${index + 1}`,
          ),
          ...(typeof email === 'string' && email.trim() ? { email } : {}),
        };
      }),
      propertyUnitId: CompleteOnboardingService.string(root.propertyUnitId, 'unidade'),
      moveInDate: CompleteOnboardingService.string(root.moveInDate, 'data de entrada'),
      monthlyBaseValueCents: Number(monthlyBaseValueCents),
    };
  }

  private static record(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ValidationError('O payload do rascunho de onboarding é inválido.');
    }
    return value as Record<string, unknown>;
  }

  private static string(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new ValidationError(`O campo ${field} do rascunho é obrigatório.`);
    }
    return value;
  }

  private static databaseErrorCode(error: unknown): string | undefined {
    if (!(error instanceof QueryFailedError)) return undefined;
    const driverError: unknown = error.driverError;
    if (typeof driverError !== 'object' || driverError === null) return undefined;
    const code = Reflect.get(driverError, 'code') as unknown;
    return typeof code === 'string' ? code : undefined;
  }
}
