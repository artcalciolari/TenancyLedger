import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  EntityManager,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { CashClosing, CashClosingStatus } from './domain/cash-closing.entity';
import type { CashClosingResponseDto } from './cashbox.dto';
import { assertCivilDate } from '../../core/domain/calendar-period';
import { ValidationError } from '../../core/domain/errors/validation.error';

interface ExpectedCashRow {
  expectedCashCents: string | number;
}

@Injectable()
export class CashboxService {
  constructor(
    @InjectRepository(CashClosing)
    private readonly closings: Repository<CashClosing>,
    private readonly dataSource: DataSource,
  ) {}

  async close(
    closingDate: string,
    countedCashCents: number,
    actorId: string,
    now = new Date(),
  ): Promise<CashClosingResponseDto> {
    CashboxService.assertDate(closingDate);
    return this.dataSource.transaction(async (manager) => {
      await this.lockDate(manager, closingDate);
      const repository = manager.getRepository(CashClosing);
      const current = await repository.findOne({ where: { closingDate } });
      if (current?.status === CashClosingStatus.CLOSED) {
        throw new ConflictException('O caixa deste dia já foi fechado.');
      }
      const expected = await this.expectedCash(manager, closingDate);
      const closing =
        current ?? CashClosing.create(closingDate, expected, countedCashCents, actorId, now);
      if (current) current.closeAgain(expected, countedCashCents, actorId, now);
      return this.toView(await repository.save(closing));
    });
  }

  async reopen(
    closingDate: string,
    reason: string,
    actorId: string,
    now = new Date(),
  ): Promise<CashClosingResponseDto> {
    CashboxService.assertDate(closingDate);
    return this.dataSource.transaction(async (manager) => {
      await this.lockDate(manager, closingDate);
      const repository = manager.getRepository(CashClosing);
      const closing = await repository.findOne({ where: { closingDate } });
      if (!closing) throw new NotFoundException('Fechamento de caixa não encontrado.');
      closing.reopen(reason, actorId, now);
      return this.toView(await repository.save(closing));
    });
  }

  async get(closingDate: string): Promise<CashClosingResponseDto> {
    CashboxService.assertDate(closingDate);
    const closing = await this.closings.findOne({ where: { closingDate } });
    if (!closing) throw new NotFoundException('Fechamento de caixa não encontrado.');
    return this.toView(closing);
  }

  async list(from?: string, to?: string): Promise<CashClosingResponseDto[]> {
    if (from) CashboxService.assertDate(from);
    if (to) CashboxService.assertDate(to);
    if (from && to && from > to) throw new ValidationError('O período do caixa é inválido.');
    const where = from
      ? { closingDate: to ? Between(from, to) : MoreThanOrEqual(from) }
      : to
        ? { closingDate: LessThanOrEqual(to) }
        : undefined;
    const closings = await this.closings.find({ where, order: { closingDate: 'DESC' } });
    return closings.map((closing) => this.toView(closing));
  }

  async assertOpen(closingDate: string): Promise<void> {
    CashboxService.assertDate(closingDate);
    const closing = await this.closings.findOne({ where: { closingDate } });
    if (closing?.status === CashClosingStatus.CLOSED) {
      throw new ConflictException(
        'O caixa deste dia está fechado. Reabra-o antes de registrar ou estornar dinheiro.',
      );
    }
  }

  private async expectedCash(manager: EntityManager, closingDate: string): Promise<number> {
    const rows = await manager.query<ExpectedCashRow[]>(
      `SELECT COALESCE(SUM(amount_cents), 0)::bigint AS "expectedCashCents"
       FROM payment_transactions
       WHERE method = 'CASH'
         AND status = 'APPROVED'
         AND (reviewed_at AT TIME ZONE 'America/Sao_Paulo')::date = $1::date`,
      [closingDate],
    );
    return Number(rows[0]?.expectedCashCents ?? 0);
  }

  private async lockDate(manager: EntityManager, closingDate: string): Promise<void> {
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `tenancy-ledger:cashbox:${closingDate}`,
    ]);
  }

  private toView(closing: CashClosing): CashClosingResponseDto {
    return {
      id: closing.id,
      closingDate: closing.closingDate,
      expectedCashCents: closing.expectedCashCents,
      countedCashCents: closing.countedCashCents,
      differenceCents: closing.countedCashCents - closing.expectedCashCents,
      status: closing.status,
      closedBy: closing.closedBy,
      closedAt: closing.closedAt,
      reopenReason: closing.reopenReason,
      reopenedBy: closing.reopenedBy,
      reopenedAt: closing.reopenedAt,
    };
  }

  private static assertDate(value: string): void {
    try {
      assertCivilDate(value, 'data do caixa');
    } catch {
      throw new ValidationError('A data do caixa é inválida.');
    }
  }
}
