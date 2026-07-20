import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  Between,
  LessThanOrEqual,
  MoreThanOrEqual,
  type DataSource,
  type EntityManager,
  type Repository,
} from 'typeorm';
import { CashboxService } from './cashbox.service';
import { CashClosing, CashClosingStatus } from './domain/cash-closing.entity';
import { ValidationError } from '../../core/domain/errors/validation.error';

const USER_ID = '7fdf9cde-2961-4ed2-a3ae-eedce12a42ee';

function savedClosing(status = CashClosingStatus.CLOSED): CashClosing {
  return Object.assign(
    CashClosing.create('2026-07-18', 120_00, 118_00, USER_ID, new Date('2026-07-18T22:00:00Z')),
    { id: 'dad91a88-583f-4b2a-9ac6-0d8eb14cd266', status },
  );
}

describe('CashboxService', () => {
  let repository: jest.Mocked<Repository<CashClosing>>;
  let transactionalRepository: jest.Mocked<Repository<CashClosing>>;
  let manager: jest.Mocked<EntityManager>;
  let dataSource: jest.Mocked<DataSource>;
  let service: CashboxService;
  let repositoryFind: jest.Mock;
  let repositoryFindOne: jest.Mock;
  let transactionalFindOne: jest.Mock;
  let transactionalSave: jest.Mock;
  let managerQuery: jest.Mock;
  let dataSourceTransaction: jest.Mock;

  beforeEach(() => {
    repositoryFindOne = jest.fn();
    repositoryFind = jest.fn().mockResolvedValue([]);
    repository = {
      findOne: repositoryFindOne,
      find: repositoryFind,
    } as unknown as jest.Mocked<Repository<CashClosing>>;
    transactionalFindOne = jest.fn();
    transactionalSave = jest.fn((closing: CashClosing) => Promise.resolve(closing));
    transactionalRepository = {
      findOne: transactionalFindOne,
      save: transactionalSave,
    } as unknown as jest.Mocked<Repository<CashClosing>>;
    managerQuery = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ expectedCashCents: '12000' }]);
    manager = {
      query: managerQuery,
      getRepository: jest.fn().mockReturnValue(transactionalRepository),
    } as unknown as jest.Mocked<EntityManager>;
    dataSourceTransaction = jest.fn((callback: (entityManager: EntityManager) => unknown) =>
      callback(manager),
    );
    dataSource = {
      transaction: dataSourceTransaction,
    } as unknown as jest.Mocked<DataSource>;
    service = new CashboxService(repository, dataSource);
  });

  it('calcula o esperado no servidor e persiste o fechamento sob lock', async () => {
    transactionalRepository.findOne.mockResolvedValue(null);

    await expect(service.close('2026-07-18', 118_00, USER_ID)).resolves.toMatchObject({
      expectedCashCents: 120_00,
      countedCashCents: 118_00,
      differenceCents: -200,
      status: CashClosingStatus.CLOSED,
    });
    expect(managerQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('pg_advisory_xact_lock'),
      ['tenancy-ledger:cashbox:2026-07-18'],
    );
    expect(managerQuery).toHaveBeenNthCalledWith(2, expect.stringContaining("method = 'CASH'"), [
      '2026-07-18',
    ]);
    expect(transactionalSave).toHaveBeenCalledTimes(1);
  });

  it('impede um segundo fechamento e permite fechar novamente após reabertura', async () => {
    transactionalRepository.findOne.mockResolvedValue(savedClosing());
    await expect(service.close('2026-07-18', 0, USER_ID)).rejects.toEqual(
      new ConflictException('O caixa deste dia já foi fechado.'),
    );

    managerQuery.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const reopened = savedClosing(CashClosingStatus.REOPENED);
    Object.assign(reopened, {
      reopenReason: 'ajuste',
      reopenedBy: USER_ID,
      reopenedAt: new Date('2026-07-18T22:05:00Z'),
    });
    transactionalRepository.findOne.mockResolvedValue(reopened);
    await expect(
      service.close('2026-07-18', 0, USER_ID, new Date('2026-07-18T22:06:00Z')),
    ).resolves.toMatchObject({ status: CashClosingStatus.CLOSED, expectedCashCents: 0 });
  });

  it('reabre um fechamento e exige que ele exista', async () => {
    transactionalRepository.findOne.mockResolvedValue(savedClosing());
    await expect(
      service.reopen('2026-07-18', 'contagem incorreta', USER_ID),
    ).resolves.toMatchObject({
      status: CashClosingStatus.REOPENED,
      reopenReason: 'contagem incorreta',
    });

    transactionalRepository.findOne.mockResolvedValue(null);
    await expect(service.reopen('2026-07-19', 'motivo', USER_ID)).rejects.toEqual(
      new NotFoundException('Fechamento de caixa não encontrado.'),
    );
  });

  it('consulta e lista fechamentos com filtro opcional', async () => {
    repository.findOne.mockResolvedValue(savedClosing());
    repository.find.mockResolvedValue([savedClosing()]);
    await expect(service.get('2026-07-18')).resolves.toMatchObject({ closingDate: '2026-07-18' });
    await expect(service.list('2026-07-01', '2026-07-31')).resolves.toHaveLength(1);
    expect(repositoryFind).toHaveBeenCalledWith({
      where: { closingDate: Between('2026-07-01', '2026-07-31') },
      order: { closingDate: 'DESC' },
    });
    await service.list();
    expect(repositoryFind).toHaveBeenLastCalledWith({
      where: undefined,
      order: { closingDate: 'DESC' },
    });
    await service.list('2026-07-01');
    expect(repositoryFind).toHaveBeenLastCalledWith({
      where: { closingDate: MoreThanOrEqual('2026-07-01') },
      order: { closingDate: 'DESC' },
    });
    await service.list(undefined, '2026-07-31');
    expect(repositoryFind).toHaveBeenLastCalledWith({
      where: { closingDate: LessThanOrEqual('2026-07-31') },
      order: { closingDate: 'DESC' },
    });
  });

  it('retorna 404 ao consultar data inexistente e bloqueia mutações em dia fechado', async () => {
    repository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(savedClosing());
    await expect(service.get('2026-07-18')).rejects.toEqual(
      new NotFoundException('Fechamento de caixa não encontrado.'),
    );
    await expect(service.assertOpen('2026-07-18')).rejects.toBeInstanceOf(ConflictException);

    repository.findOne.mockResolvedValue(savedClosing(CashClosingStatus.REOPENED));
    await expect(service.assertOpen('2026-07-18')).resolves.toBeUndefined();
  });

  it('valida datas e a ordem do período antes de consultar o banco', async () => {
    await expect(service.get('2026-02-31')).rejects.toBeInstanceOf(ValidationError);
    await expect(service.close('18/07/2026', 0, USER_ID)).rejects.toBeInstanceOf(ValidationError);
    await expect(service.reopen('invalid', 'motivo', USER_ID)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(service.assertOpen('2026-13-01')).rejects.toBeInstanceOf(ValidationError);
    await expect(service.list('2026-07-20', '2026-07-01')).rejects.toEqual(
      new ValidationError('O período do caixa é inválido.'),
    );
    await expect(service.list('invalid')).rejects.toBeInstanceOf(ValidationError);
    await expect(service.list(undefined, 'invalid')).rejects.toBeInstanceOf(ValidationError);
    expect(repositoryFind).not.toHaveBeenCalled();
    expect(dataSourceTransaction).not.toHaveBeenCalled();
  });
});
