import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { calendarPeriodFrom } from '../../../core/domain/calendar-period';
import { StorageService } from '../../../infrastructure/storage.service';
import { PropertyUnit } from '../../property/domain/property-unit.entity';
import { describePropertyUnit } from '../../property/domain/property-unit.description';
import { Tenant } from '../../tenant/domain/entities/tenant.entity';
import {
  ContractDocument,
  ContractDocumentKind,
} from '../domain/entities/contract-document.entity';
import { Contract, ContractStatus, ContractType } from '../domain/entities/contract.entity';
import { ContractDocumentRenderer } from '../infrastructure/contract-document.renderer';

export interface UploadContractDocumentInput {
  kind: ContractDocumentKind.SIGNED | ContractDocumentKind.OTHER;
  originalName: string;
  contentType: string;
  body: Buffer;
  uploadedByUserId: string;
}

export interface ContractDocumentView {
  id: string;
  contractId: string;
  kind: ContractDocumentKind;
  version: number;
  originalName: string;
  contentType: string;
  uploadedByUserId: string;
  createdAt: Date;
  url: string;
  expiresInSeconds: number;
}

@Injectable()
export class ContractDocumentsService {
  constructor(
    @InjectRepository(ContractDocument)
    private readonly documents: Repository<ContractDocument>,
    @InjectRepository(Contract)
    private readonly contracts: Repository<Contract>,
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    @InjectRepository(PropertyUnit)
    private readonly properties: Repository<PropertyUnit>,
    private readonly storage: StorageService,
    private readonly renderer: ContractDocumentRenderer,
  ) {}

  async preview(contractId: string): Promise<Buffer> {
    const { contract, tenant, property } = await this.loadContractData(contractId);
    if (contract.contractType !== ContractType.MONTH_TO_MONTH) {
      throw new ConflictException('A prévia mensal está disponível apenas para contratos mensais.');
    }
    return this.renderer.render({
      contractId: contract.id,
      tenantName: tenant.name,
      tenantCpf: tenant.cpf,
      tenantRg: tenant.rg,
      propertyDescription: describePropertyUnit(property),
      monthlyValueCents: contract.monthlyBaseValueCents,
      moveInDate: contract.moveInDate,
      firstPeriodEnd: calendarPeriodFrom(contract.moveInDate).end,
    });
  }

  async generate(contractId: string, actorId: string): Promise<ContractDocumentView> {
    let storedKey: string | undefined;
    try {
      const document = await this.documents.manager.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
          'contract-document-version',
          contractId,
        ]);
        const contract = await manager.getRepository(Contract).findOne({
          where: { id: contractId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!contract) throw new NotFoundException('Contrato não encontrado.');
        if (
          contract.contractType !== ContractType.MONTH_TO_MONTH ||
          contract.status !== ContractStatus.PENDING_SIGNATURE
        ) {
          throw new ConflictException(
            'A geração de contrato está disponível apenas para contratos mensais pendentes de assinatura.',
          );
        }

        const [tenant, property] = await Promise.all([
          this.tenants.findOneBy({ id: contract.tenantId }),
          this.properties.findOneBy({ id: contract.propertyUnitId }),
        ]);
        if (!tenant || !property) {
          throw new NotFoundException('Relacionamentos do contrato não encontrados.');
        }

        const raw = await manager
          .getRepository(ContractDocument)
          .createQueryBuilder('document')
          .select('COALESCE(MAX(document.version), 0)', 'version')
          .where('document.contract_id = :contractId', { contractId })
          .andWhere('document.kind = :kind', { kind: ContractDocumentKind.GENERATED })
          .getRawOne<{ version: string }>();
        const version = Number(raw?.version ?? 0) + 1;

        const pdf = await this.renderer.render({
          contractId: contract.id,
          tenantName: tenant.name,
          tenantCpf: tenant.cpf,
          tenantRg: tenant.rg,
          propertyDescription: describePropertyUnit(property),
          monthlyValueCents: contract.monthlyBaseValueCents,
          moveInDate: contract.moveInDate,
          firstPeriodEnd: calendarPeriodFrom(contract.moveInDate).end,
        });

        const generated = ContractDocument.create(
          contractId,
          ContractDocumentKind.GENERATED,
          version,
          actorId,
          `contrato-${contractId}-v${version}.pdf`,
          'application/pdf',
        );
        const stored = await this.storage.uploadDocument({
          folder: 'contract-documents',
          ownerId: generated.id,
          contentType: 'application/pdf',
          body: pdf,
        });
        storedKey = stored.key;
        generated.setStorageKey(stored.key);
        await manager.save(generated);
        return generated;
      });
      return this.toView(document, 'inline');
    } catch (error: unknown) {
      if (storedKey) {
        await this.storage.deleteObject(storedKey).catch(() => undefined);
      }
      throw error;
    }
  }

  async upload(
    contractId: string,
    input: UploadContractDocumentInput,
  ): Promise<ContractDocumentView> {
    let storedKey: string | undefined;
    try {
      const document = await this.documents.manager.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
          'contract-document-version',
          contractId,
        ]);
        const contract = await manager.getRepository(Contract).findOne({
          where: { id: contractId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!contract) throw new NotFoundException('Contrato não encontrado.');

        const raw = await manager
          .getRepository(ContractDocument)
          .createQueryBuilder('document')
          .select('COALESCE(MAX(document.version), 0)', 'version')
          .where('document.contract_id = :contractId', { contractId })
          .andWhere('document.kind = :kind', { kind: input.kind })
          .getRawOne<{ version: string }>();
        const document = ContractDocument.create(
          contractId,
          input.kind,
          Number(raw?.version ?? 0) + 1,
          input.uploadedByUserId,
          input.originalName,
          input.contentType,
        );
        const stored = await this.storage.uploadDocument({
          folder: 'contract-documents',
          ownerId: document.id,
          contentType: input.contentType,
          body: input.body,
        });
        storedKey = stored.key;
        document.setStorageKey(stored.key);
        await manager.save(document);

        if (
          input.kind === ContractDocumentKind.SIGNED &&
          contract.status === ContractStatus.PENDING_SIGNATURE
        ) {
          contract.markSigned();
          await manager.save(contract);
        }
        return document;
      });
      return this.toView(document);
    } catch (error: unknown) {
      if (storedKey) {
        await this.storage.deleteObject(storedKey).catch(() => undefined);
      }
      throw error;
    }
  }

  async list(contractId: string): Promise<ContractDocumentView[]> {
    await this.ensureContract(contractId);
    const documents = await this.documents.find({
      where: { contractId },
      order: { createdAt: 'DESC', id: 'ASC' },
    });
    return Promise.all(documents.map((document) => this.toView(document)));
  }

  async getDownloadUrl(
    contractId: string,
    documentId: string,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const document = await this.documents.findOne({
      where: { id: documentId, contractId },
    });
    if (!document) throw new NotFoundException('Documento do contrato não encontrado.');
    const expiresInSeconds = 300;
    return {
      url: await this.storage.createDocumentReadUrl(document.storageKey, expiresInSeconds),
      expiresInSeconds,
    };
  }

  private async toView(
    document: ContractDocument,
    disposition: 'attachment' | 'inline' = 'attachment',
  ): Promise<ContractDocumentView> {
    const expiresInSeconds = 300;
    return {
      id: document.id,
      contractId: document.contractId,
      kind: document.kind,
      version: document.version,
      originalName: document.originalName,
      contentType: document.contentType,
      uploadedByUserId: document.uploadedByUserId,
      createdAt: document.createdAt,
      url: await this.storage.createDocumentReadUrl(
        document.storageKey,
        expiresInSeconds,
        disposition,
      ),
      expiresInSeconds,
    };
  }

  private async ensureContract(contractId: string): Promise<void> {
    if (!(await this.contracts.existsBy({ id: contractId }))) {
      throw new NotFoundException('Contrato não encontrado.');
    }
  }

  private async loadContractData(contractId: string): Promise<{
    contract: Contract;
    tenant: Tenant;
    property: PropertyUnit;
  }> {
    const contract = await this.contracts.findOneBy({ id: contractId });
    if (!contract) throw new NotFoundException('Contrato não encontrado.');
    const [tenant, property] = await Promise.all([
      this.tenants.findOneBy({ id: contract.tenantId }),
      this.properties.findOneBy({ id: contract.propertyUnitId }),
    ]);
    if (!tenant || !property) {
      throw new NotFoundException('Relacionamentos do contrato não encontrados.');
    }
    return { contract, tenant, property };
  }
}
