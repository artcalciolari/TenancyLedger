import type { Repository } from 'typeorm';
import { Contract, ContractStatus, ContractType } from '../domain/entities/contract.entity';
import { ContractTypeOrmRepository } from './contract.typeorm.repository';

describe('ContractTypeOrmRepository', () => {
  it('expires ACTIVE and ENDING fixed contracts with coherent lifecycle metadata', async () => {
    const builder = {
      update: jest.fn(),
      set: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      execute: jest.fn().mockResolvedValue({ affected: 2 }),
    };
    builder.update.mockReturnValue(builder);
    let capturedUpdate: unknown;
    builder.set.mockImplementation((value: unknown) => {
      capturedUpdate = value;
      return builder;
    });
    builder.where.mockReturnValue(builder);
    builder.andWhere.mockReturnValue(builder);
    const repository = {
      createQueryBuilder: jest.fn(() => builder),
    } as unknown as Repository<Contract>;
    const contracts = new ContractTypeOrmRepository(repository);

    await expect(contracts.markExpired('2026-07-18')).resolves.toBe(2);

    expect(builder.update.mock.calls).toContainEqual([Contract]);
    const statusUpdate = capturedUpdate as {
      _status: ContractStatus;
      _statusReason: null;
      _statusChangedAt: () => string;
    };
    expect(statusUpdate).toMatchObject({
      _status: ContractStatus.EXPIRED,
      _statusReason: null,
    });
    expect(statusUpdate._statusChangedAt()).toBe('CURRENT_TIMESTAMP');
    expect(builder.where.mock.calls).toContainEqual([
      'status IN (:...expirableStatuses)',
      { expirableStatuses: [ContractStatus.ACTIVE, ContractStatus.ENDING] },
    ]);
    expect(builder.andWhere.mock.calls).toContainEqual([
      'contract_type = :fixedTerm',
      { fixedTerm: ContractType.FIXED_TERM },
    ]);
    expect(builder.andWhere.mock.calls).toContainEqual([
      'end_date < :asOf',
      { asOf: '2026-07-18' },
    ]);
  });

  it('normalizes a driver result without affected rows', async () => {
    const builder = {
      update: jest.fn(),
      set: jest.fn(),
      where: jest.fn(),
      andWhere: jest.fn(),
      execute: jest.fn().mockResolvedValue({ affected: undefined }),
    };
    builder.update.mockReturnValue(builder);
    builder.set.mockReturnValue(builder);
    builder.where.mockReturnValue(builder);
    builder.andWhere.mockReturnValue(builder);
    const contracts = new ContractTypeOrmRepository({
      createQueryBuilder: jest.fn(() => builder),
    } as unknown as Repository<Contract>);

    await expect(contracts.markExpired('2026-07-18')).resolves.toBe(0);
  });
});
