import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TenantReference,
  type TenantReferenceFields,
  type UpdateTenantReferenceFields,
} from '../../domain/entities/tenant-reference.entity';
import {
  TENANT_REPOSITORY_TOKEN,
  type ITenantRepository,
} from '../../domain/repositories/tenant.repository';

@Injectable()
export class TenantReferencesUseCase {
  constructor(
    @InjectRepository(TenantReference)
    private readonly references: Repository<TenantReference>,
    @Inject(TENANT_REPOSITORY_TOKEN)
    private readonly tenants: ITenantRepository,
  ) {}

  async create(tenantId: string, fields: TenantReferenceFields): Promise<TenantReference> {
    await this.ensureTenant(tenantId);
    return this.references.save(TenantReference.create(tenantId, fields));
  }

  async list(tenantId: string): Promise<TenantReference[]> {
    await this.ensureTenant(tenantId);
    return this.references.find({
      where: { tenantId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  async get(tenantId: string, referenceId: string): Promise<TenantReference> {
    return this.findReference(tenantId, referenceId);
  }

  async update(
    tenantId: string,
    referenceId: string,
    fields: UpdateTenantReferenceFields,
  ): Promise<TenantReference> {
    const reference = await this.findReference(tenantId, referenceId);
    reference.update(fields);
    return this.references.save(reference);
  }

  async remove(tenantId: string, referenceId: string): Promise<void> {
    await this.references.remove(await this.findReference(tenantId, referenceId));
  }

  async verify(
    tenantId: string,
    referenceId: string,
    verifiedByUserId: string,
  ): Promise<TenantReference> {
    const reference = await this.findReference(tenantId, referenceId);
    reference.markVerified(verifiedByUserId, new Date());
    return this.references.save(reference);
  }

  private async ensureTenant(tenantId: string): Promise<void> {
    if (!(await this.tenants.findById(tenantId))) {
      throw new NotFoundException('Locatário não encontrado.');
    }
  }

  private async findReference(tenantId: string, referenceId: string): Promise<TenantReference> {
    const reference = await this.references.findOne({
      where: { id: referenceId, tenantId },
    });
    if (!reference) throw new NotFoundException('Referência do locatário não encontrada.');
    return reference;
  }
}
