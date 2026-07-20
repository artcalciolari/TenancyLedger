import { ValidationError } from '../../../../core/domain/errors/validation.error';
import { Contract, ContractStateError, ContractStatus, ContractType } from './contract.entity';

const TENANT_ID = 'c16a5325-1d5c-49c5-a5cb-452e75a72c75';
const PROPERTY_ID = 'f04b6434-28f1-49a7-99aa-e49624bc68b9';

function createContract(durationInMonths = 12, isRenewable = true, billingDay?: number): Contract {
  return Contract.create(
    TENANT_ID,
    PROPERTY_ID,
    '2026-01-01',
    100_00,
    durationInMonths,
    isRenewable,
    billingDay,
  );
}

describe('Contract', () => {
  it('creates a contract with an explicit, inclusive validity period and cents', () => {
    const contract = Contract.create(TENANT_ID, PROPERTY_ID, '2026-01-01', 125_050, 12, true, 10);

    expect(contract.moveInDate).toBe('2026-01-01');
    expect(contract.endDate).toBe('2026-12-31');
    expect(contract.monthlyBaseValueCents).toBe(125_050);
    expect(contract.billingDay).toBe(10);
    expect(contract.status).toBe(ContractStatus.ACTIVE);
  });

  it('handles calendar-month boundaries deterministically', () => {
    expect(Contract.calculateEndDate('2025-01-31', 1)).toBe('2025-02-27');
    expect(Contract.calculateEndDate('2024-02-29', 12)).toBe('2025-02-27');
  });

  it.each([
    ['the move-in day', '2026-01-10', 10],
    ['day 28 for a later move-in day', '2026-01-31', 28],
  ])('defaults the billing day to %s', (_scenario, moveInDate, expectedBillingDay) => {
    const contract = Contract.create(TENANT_ID, PROPERTY_ID, moveInDate, 100_00, 1, true);

    expect(contract.billingDay).toBe(expectedBillingDay);
  });

  it('accepts the documented upper bounds', () => {
    expect(() =>
      Contract.create(
        TENANT_ID,
        PROPERTY_ID,
        '2026-01-01',
        Contract.MAX_MONEY_CENTS,
        600,
        true,
        28,
      ),
    ).not.toThrow();
  });

  it('renews a renewable contract and recomputes its end date', () => {
    const contract = Contract.create(TENANT_ID, PROPERTY_ID, '2026-01-01', 100_00, 12, true);

    contract.renew(6);

    expect(contract.durationInMonths).toBe(18);
    expect(contract.endDate).toBe('2027-06-30');
  });

  it('rejects renewal when it is not allowed', () => {
    const contract = Contract.create(TENANT_ID, PROPERTY_ID, '2026-01-01', 100_00, 12, false);
    expect(() => contract.renew(1)).toThrow(ContractStateError);
  });

  it.each([
    {
      scenario: 'a terminated contract',
      expectedError: ContractStateError,
      arrange: () => {
        const contract = createContract();
        Object.assign(contract, { _status: ContractStatus.TERMINATED });
        return contract;
      },
      extraMonths: 1,
    },
    {
      scenario: 'a term beyond 600 months',
      expectedError: ValidationError,
      arrange: () => createContract(600),
      extraMonths: 1,
    },
    {
      scenario: 'zero extra months',
      expectedError: ValidationError,
      arrange: () => createContract(),
      extraMonths: 0,
    },
    {
      scenario: 'fractional extra months',
      expectedError: ValidationError,
      arrange: () => createContract(),
      extraMonths: 1.5,
    },
  ])('rejects renewal for $scenario', ({ arrange, extraMonths, expectedError }) => {
    const contract = arrange();

    expect(() => contract.renew(extraMonths)).toThrow(expectedError);
  });

  it('reactivates an expired renewable contract with an extended end date', () => {
    const contract = createContract(1);
    contract.markExpired('2026-02-01');

    expect(contract.status).toBe(ContractStatus.EXPIRED);

    contract.renew(1);

    expect(contract.status).toBe(ContractStatus.ACTIVE);
    expect(contract.endDate).toBe('2026-02-28');
  });

  it.each([
    {
      scenario: 'tenant ID',
      create: () => Contract.create('not-a-uuid', PROPERTY_ID, '2026-01-01', 100, 1, true),
    },
    {
      scenario: 'property ID',
      create: () => Contract.create(TENANT_ID, 'not-a-uuid', '2026-01-01', 100, 1, true),
    },
    {
      scenario: 'date format',
      create: () => Contract.create(TENANT_ID, PROPERTY_ID, '01/01/2026', 100, 1, true),
    },
    {
      scenario: 'civil date',
      create: () => Contract.create(TENANT_ID, PROPERTY_ID, '2026-02-30', 100, 1, true),
    },
    {
      scenario: 'zero money',
      create: () => Contract.create(TENANT_ID, PROPERTY_ID, '2026-01-01', 0, 1, true),
    },
    {
      scenario: 'fractional money',
      create: () => Contract.create(TENANT_ID, PROPERTY_ID, '2026-01-01', 100.5, 1, true),
    },
    {
      scenario: 'money above the maximum',
      create: () =>
        Contract.create(
          TENANT_ID,
          PROPERTY_ID,
          '2026-01-01',
          Contract.MAX_MONEY_CENTS + 1,
          1,
          true,
        ),
    },
    {
      scenario: 'zero duration',
      create: () => Contract.create(TENANT_ID, PROPERTY_ID, '2026-01-01', 100, 0, true),
    },
    {
      scenario: 'fractional duration',
      create: () => Contract.create(TENANT_ID, PROPERTY_ID, '2026-01-01', 100, 1.5, true),
    },
    {
      scenario: 'duration above the maximum',
      create: () => Contract.create(TENANT_ID, PROPERTY_ID, '2026-01-01', 100, 601, true),
    },
    {
      scenario: 'billing day below the minimum',
      create: () => Contract.create(TENANT_ID, PROPERTY_ID, '2026-01-01', 100, 1, true, 0),
    },
    {
      scenario: 'fractional billing day',
      create: () => Contract.create(TENANT_ID, PROPERTY_ID, '2026-01-01', 100, 1, true, 1.5),
    },
    {
      scenario: 'billing day above the maximum',
      create: () => Contract.create(TENANT_ID, PROPERTY_ID, '2026-01-01', 100, 1, true, 29),
    },
  ])('rejects an invalid $scenario', ({ create }) => {
    expect(create).toThrow(ValidationError);
  });

  it('reports billing eligibility only while active and in force', () => {
    const contract = Contract.create(TENANT_ID, PROPERTY_ID, '2026-07-10', 100_00, 2, true, 15);

    expect(contract.isActiveOn('2026-07-09')).toBe(false);
    expect(contract.isActiveOn('2026-07-15')).toBe(true);
    expect(contract.isActiveOn('2026-09-10')).toBe(false);
    expect(contract.dueDateFor('2026-07')).toBe('2026-07-15');
  });

  it.each(['2026-00', '2026-13', '07-2026'])('rejects invalid billing competence %s', (value) => {
    expect(() => createContract().dueDateFor(value)).toThrow(ValidationError);
  });

  it('expires only after the inclusive end date and remains expired on repeated refreshes', () => {
    const contract = createContract(1);

    contract.markExpired('2026-01-31');
    expect(contract.status).toBe(ContractStatus.ACTIVE);

    contract.markExpired('2026-02-01');
    contract.markExpired('2026-02-02');

    expect(contract.status).toBe(ContractStatus.EXPIRED);
    expect(contract.isActiveOn('2026-01-15')).toBe(false);
  });

  it.each(['2026/02/01', '2026-02-30'])('rejects invalid status reference date %s', (value) => {
    const contract = createContract();

    expect(() => contract.markExpired(value)).toThrow(ValidationError);
    expect(() => contract.isActiveOn(value)).toThrow(ValidationError);
  });

  it('creates an open-ended month-to-month contract', () => {
    const contract = Contract.create(
      TENANT_ID,
      PROPERTY_ID,
      '2026-07-18',
      150_000,
      null,
      true,
      undefined,
      ContractType.MONTH_TO_MONTH,
    );

    expect(contract).toMatchObject({
      contractType: ContractType.MONTH_TO_MONTH,
      durationInMonths: null,
      endDate: null,
      billingDay: 18,
      status: ContractStatus.ACTIVE,
    });
    contract.markExpired('2126-01-01');
    expect(contract.status).toBe(ContractStatus.ACTIVE);
    expect(contract.isActiveOn('2126-01-01')).toBe(true);
    expect(() => contract.renew(1)).toThrow(ContractStateError);
  });

  it('rejects incoherent type and duration combinations', () => {
    expect(() =>
      Contract.create(
        TENANT_ID,
        PROPERTY_ID,
        '2026-07-18',
        150_000,
        12,
        true,
        18,
        ContractType.MONTH_TO_MONTH,
      ),
    ).toThrow(ValidationError);
    expect(() =>
      Contract.create(
        TENANT_ID,
        PROPERTY_ID,
        '2026-07-18',
        150_000,
        null,
        true,
        18,
        ContractType.FIXED_TERM,
      ),
    ).toThrow(ValidationError);
  });

  it('follows the signature, payment, ending and termination lifecycle', () => {
    const contract = Contract.createPendingSignature(TENANT_ID, PROPERTY_ID, '2026-07-18', 150_000);
    const signedAt = new Date('2026-07-18T12:00:00.000Z');
    const activatedAt = new Date('2026-07-18T13:00:00.000Z');

    expect(contract.status).toBe(ContractStatus.PENDING_SIGNATURE);
    expect(contract.isOccupyingOn('2026-07-18')).toBe(true);
    contract.markSigned(signedAt);
    expect(contract.status).toBe(ContractStatus.PAYMENT_PENDING);
    contract.activate(activatedAt);
    expect(contract.statusChangedAt).toEqual(activatedAt);
    contract.scheduleEnding(' Mudança do inquilino ');
    expect(contract).toMatchObject({
      status: ContractStatus.ENDING,
      statusReason: 'Mudança do inquilino',
    });
    contract.terminate('Entrega das chaves');
    expect(contract.status).toBe(ContractStatus.TERMINATED);
    expect(contract.isOccupyingOn('2026-07-19')).toBe(false);
  });

  it('cancels a pre-active contract and rejects invalid transitions', () => {
    const contract = Contract.createPendingSignature(TENANT_ID, PROPERTY_ID, '2026-07-18', 150_000);

    expect(() => contract.activate()).toThrow(ContractStateError);
    expect(() => contract.cancel('   ')).toThrow(ValidationError);
    contract.cancel('Desistência antes da assinatura');
    expect(contract.status).toBe(ContractStatus.CANCELLED);
    expect(() => contract.markSigned()).toThrow(ContractStateError);
  });

  it('rejects values that bypass compile-time contract creation types', () => {
    expect(() =>
      Contract.create(
        TENANT_ID,
        PROPERTY_ID,
        '2026-07-18',
        150_000,
        12,
        true,
        18,
        'UNKNOWN' as ContractType,
      ),
    ).toThrow(new ValidationError('O tipo do contrato é inválido.'));
    expect(() =>
      Contract.create(
        TENANT_ID,
        PROPERTY_ID,
        '2026-07-18',
        150_000,
        12,
        'yes' as unknown as boolean,
      ),
    ).toThrow(new ValidationError('A indicação de renovação deve ser booleana.'));
  });

  it('rejects cancellation and termination from incompatible lifecycle states', () => {
    const active = createContract();
    const pending = Contract.createPendingSignature(TENANT_ID, PROPERTY_ID, '2026-07-18', 150_000);

    expect(() => active.cancel('Desistência')).toThrow(ContractStateError);
    expect(() => pending.terminate('Entrega das chaves')).toThrow(ContractStateError);
  });

  it('does not report occupation after the fixed-term end date', () => {
    const contract = createContract(1);

    expect(contract.isOccupyingOn('2026-02-01')).toBe(false);
  });

  it('rejects an invalid lifecycle timestamp without mutating the contract', () => {
    const contract = Contract.createPendingSignature(TENANT_ID, PROPERTY_ID, '2026-07-18', 150_000);

    expect(() => contract.markSigned(new Date(Number.NaN))).toThrow(ValidationError);
    expect(contract.status).toBe(ContractStatus.PENDING_SIGNATURE);
  });
});
