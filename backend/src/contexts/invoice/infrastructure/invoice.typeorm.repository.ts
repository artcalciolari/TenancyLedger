import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice } from '../domain/entities/invoice.entity';
import { PaymentStatus, PaymentTransaction } from '../domain/entities/payment-transaction.entity';
import { Contract } from '../../contract/domain/entities/contract.entity';
import { Tenant } from '../../tenant/domain/entities/tenant.entity';
import { PropertyUnit } from '../../property/domain/property-unit.entity';
import {
  IInvoiceRepository,
  InvoiceFilterOptions,
  InvoiceListOptions,
  InvoiceListResult,
  PaymentReviewListOptions,
  PaymentReviewListResult,
  PaymentReviewRecord,
} from '../domain/invoice.repository';
import type { SelectQueryBuilder } from 'typeorm';

@Injectable()
export class InvoiceTypeOrmRepository implements IInvoiceRepository {
  constructor(
    @InjectRepository(Invoice)
    private readonly repository: Repository<Invoice>,
    @InjectRepository(PaymentTransaction)
    private readonly payments: Repository<PaymentTransaction>,
  ) {}

  findById(id: string): Promise<Invoice | null> {
    return this.repository.findOne({ where: { id } });
  }

  findByContractAndCompetence(contractId: string, competence: string): Promise<Invoice | null> {
    return this.repository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice._transactions', 'transaction')
      .where('invoice._contractId = :contractId', { contractId })
      .andWhere('invoice._competence = :competence', { competence })
      .getOne();
  }

  async list(options: InvoiceListOptions): Promise<InvoiceListResult> {
    const query = this.filteredQuery(options)
      .orderBy('invoice._dueDate', 'DESC')
      .addOrderBy('invoice.id', 'ASC')
      .skip((options.page - 1) * options.limit)
      .take(options.limit);
    const [items, total] = await query.getManyAndCount();
    return { items, total };
  }

  listForExport(options: InvoiceFilterOptions): Promise<Invoice[]> {
    return this.filteredQuery(options)
      .orderBy('invoice._dueDate', 'DESC')
      .addOrderBy('invoice.id', 'ASC')
      .getMany();
  }

  async listPaymentsForReview(options: PaymentReviewListOptions): Promise<PaymentReviewListResult> {
    const query = this.payments
      .createQueryBuilder('payment')
      .innerJoin('payment.invoice', 'invoice')
      .innerJoin(Contract, 'contract', 'contract.id = invoice.contract_id')
      .innerJoin(Tenant, 'tenant', 'tenant.id = contract.tenant_id')
      .innerJoin(PropertyUnit, 'property', 'property.id = contract.property_unit_id')
      .where('payment.status = :submitted', { submitted: PaymentStatus.SUBMITTED });
    if (options.method) query.andWhere('payment.method = :method', { method: options.method });
    if (options.competence)
      query.andWhere('invoice.competence = :competence', { competence: options.competence });
    if (options.tenantId)
      query.andWhere('contract.tenant_id = :tenantId', { tenantId: options.tenantId });
    if (options.propertyUnitId)
      query.andWhere('contract.property_unit_id = :propertyUnitId', {
        propertyUnitId: options.propertyUnitId,
      });
    if (options.submittedFrom)
      query.andWhere('payment.submitted_at >= :submittedFrom', {
        submittedFrom: options.submittedFrom,
      });
    if (options.submittedTo)
      query.andWhere("payment.submitted_at < (:submittedTo::date + INTERVAL '1 day')", {
        submittedTo: options.submittedTo,
      });
    const term = options.q?.trim();
    if (term) {
      const escaped = this.escapeLike(term);
      const digits = term.replace(/\D/g, '');
      query.andWhere(
        `(
          CAST(invoice.id AS text) ILIKE :q ESCAPE '\\'
          OR CAST(contract.id AS text) ILIKE :q ESCAPE '\\'
          OR tenant.full_name ILIKE :q ESCAPE '\\'
          OR tenant.profession ILIKE :q ESCAPE '\\'
          OR tenant.email ILIKE :q ESCAPE '\\'
          OR tenant.cpf LIKE :digits ESCAPE '\\'
          OR property.neighborhood ILIKE :q ESCAPE '\\'
          OR property.unit_number ILIKE :q ESCAPE '\\'
        )`,
        { q: `%${escaped}%`, digits: `%${digits || escaped}%` },
      );
    }

    const total = await query.clone().getCount();
    const approvedExpression = `COALESCE((
      SELECT SUM(approved.amount_cents)
      FROM payment_transactions approved
      WHERE approved.invoice_id = invoice.id AND approved.status = 'APPROVED'
    ), 0)::int`;
    const items = await query
      .select('payment.id', 'paymentId')
      .addSelect('payment.amount_cents', 'amountCents')
      .addSelect('payment.submitted_at', 'submittedAt')
      .addSelect('payment.method', 'method')
      .addSelect('payment.proof_type', 'proofType')
      .addSelect('(payment.proof_reference IS NOT NULL)', 'hasProof')
      .addSelect('payment.status', 'status')
      .addSelect('payment.reviewed_at', 'reviewedAt')
      .addSelect('payment.rejection_reason', 'rejectionReason')
      .addSelect('payment.submitted_by_user_id', 'submittedByUserId')
      .addSelect('payment.reviewed_by_user_id', 'reviewedByUserId')
      .addSelect('invoice.id', 'invoiceId')
      .addSelect('invoice.competence', 'competence')
      .addSelect('invoice.due_date', 'dueDate')
      .addSelect('invoice.status', 'invoiceStatus')
      .addSelect('invoice.total_value_cents', 'totalValueCents')
      .addSelect(approvedExpression, 'approvedAmountCents')
      .addSelect(`invoice.total_value_cents - ${approvedExpression}`, 'outstandingAmountCents')
      .addSelect('contract.id', 'contractId')
      .addSelect('contract.status', 'contractStatus')
      .addSelect('contract.end_date', 'contractEndDate')
      .addSelect('tenant.id', 'tenantId')
      .addSelect('tenant.full_name', 'tenantName')
      .addSelect('tenant.cpf', 'tenantCpf')
      .addSelect('tenant.profession', 'tenantProfession')
      .addSelect('tenant.civil_status', 'tenantCivilStatus')
      .addSelect('tenant.email', 'tenantEmail')
      .addSelect('tenant.mobile_phone', 'tenantMobilePhone')
      .addSelect('property.id', 'propertyUnitId')
      .addSelect('property.neighborhood', 'propertyNeighborhood')
      .addSelect('property.type', 'propertyType')
      .addSelect('property.unit_number', 'propertyUnitNumber')
      .orderBy('payment.submitted_at', 'ASC')
      .addOrderBy('payment.id', 'ASC')
      .offset((options.page - 1) * options.limit)
      .limit(options.limit)
      .getRawMany<PaymentReviewRecord>();
    return { items, total };
  }

  private filteredQuery(options: InvoiceFilterOptions): SelectQueryBuilder<Invoice> {
    const query = this.repository
      .createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice._transactions', 'transaction')
      .leftJoin(Contract, 'contract', 'contract.id = invoice.contract_id')
      .leftJoin(Tenant, 'tenant', 'tenant.id = contract.tenant_id')
      .leftJoin(PropertyUnit, 'property', 'property.id = contract.property_unit_id');
    if (options.contractId)
      query.andWhere('invoice.contract_id = :contractId', { contractId: options.contractId });
    if (options.competence)
      query.andWhere('invoice.competence = :competence', { competence: options.competence });
    if (options.status) query.andWhere('invoice.status = :status', { status: options.status });
    if (options.tenantId)
      query.andWhere('contract.tenant_id = :tenantId', { tenantId: options.tenantId });
    if (options.propertyUnitId)
      query.andWhere('contract.property_unit_id = :propertyUnitId', {
        propertyUnitId: options.propertyUnitId,
      });
    if (options.dueFrom)
      query.andWhere('invoice.due_date >= :dueFrom', { dueFrom: options.dueFrom });
    if (options.dueTo) query.andWhere('invoice.due_date <= :dueTo', { dueTo: options.dueTo });
    if (options.paymentStatus) {
      query.andWhere(
        `EXISTS (
          SELECT 1 FROM payment_transactions payment_filter
          WHERE payment_filter.invoice_id = invoice.id AND payment_filter.status = :paymentStatus
        )`,
        { paymentStatus: options.paymentStatus },
      );
    }
    if (options.paymentMethod) {
      query.andWhere(
        `EXISTS (
          SELECT 1 FROM payment_transactions method_filter
          WHERE method_filter.invoice_id = invoice.id AND method_filter.method = :paymentMethod
        )`,
        { paymentMethod: options.paymentMethod },
      );
    }
    const term = options.q?.trim();
    if (term) {
      const escaped = this.escapeLike(term);
      const digits = term.replace(/\D/g, '');
      query.andWhere(
        `(
          CAST(invoice.id AS text) ILIKE :q ESCAPE '\\'
          OR CAST(contract.id AS text) ILIKE :q ESCAPE '\\'
          OR tenant.full_name ILIKE :q ESCAPE '\\'
          OR tenant.profession ILIKE :q ESCAPE '\\'
          OR tenant.email ILIKE :q ESCAPE '\\'
          OR tenant.cpf LIKE :digits ESCAPE '\\'
          OR property.neighborhood ILIKE :q ESCAPE '\\'
          OR property.unit_number ILIKE :q ESCAPE '\\'
        )`,
        { q: `%${escaped}%`, digits: `%${digits || escaped}%` },
      );
    }
    return query;
  }

  private escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (character) => `\\${character}`);
  }

  async insertIfAbsent(invoice: Invoice): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .into(Invoice)
      .values(invoice)
      .orIgnore()
      .returning('id')
      .execute();
    return Array.isArray(result.raw) && result.raw.length > 0;
  }

  async updateWithLock(
    id: string,
    update: (invoice: Invoice) => void | Promise<void>,
    transactionKey?: string,
  ): Promise<Invoice | null> {
    return this.repository.manager.transaction(async (manager) => {
      if (transactionKey) {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [
          'invoice-payment-idempotency',
          `${id}:${transactionKey}`,
        ]);
      }

      const invoice = await manager
        .getRepository(Invoice)
        .createQueryBuilder('invoice')
        .setLock('pessimistic_write', undefined, ['invoice'])
        .leftJoinAndSelect('invoice._transactions', 'transaction')
        .where('invoice.id = :id', { id })
        .getOne();
      if (!invoice) return null;
      await update(invoice);
      return manager.save(invoice);
    });
  }

  async markOpenInvoicesOverdue(asOf: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .update(Invoice)
      .set({ _status: 'OVERDUE' } as never)
      .where('status = :status', { status: 'OPEN' })
      .andWhere('due_date < :asOf', { asOf })
      .execute();
    return result.affected ?? 0;
  }
}
