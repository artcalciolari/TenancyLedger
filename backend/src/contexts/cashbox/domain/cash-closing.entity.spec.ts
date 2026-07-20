import { CashClosing, CashClosingStateError, CashClosingStatus } from './cash-closing.entity';
import { ValidationError } from '../../../core/domain/errors/validation.error';

const USER_ID = '7fdf9cde-2961-4ed2-a3ae-eedce12a42ee';
const OTHER_USER_ID = 'e5c1163a-8151-41e3-b953-350cb36435b1';

describe('CashClosing', () => {
  const closedAt = new Date('2026-07-18T22:00:00.000Z');

  it('fecha, reabre com auditoria e permite novo fechamento', () => {
    const closing = CashClosing.create('2026-07-18', 100_00, 98_00, USER_ID, closedAt);
    expect(closing).toMatchObject({
      closingDate: '2026-07-18',
      expectedCashCents: 100_00,
      countedCashCents: 98_00,
      status: CashClosingStatus.CLOSED,
      closedBy: USER_ID,
      reopenReason: null,
    });
    expect(closing.closedAt).not.toBe(closedAt);

    closing.reopen('  conferência   adicional ', OTHER_USER_ID, new Date('2026-07-18T22:05:00Z'));
    expect(closing).toMatchObject({
      status: CashClosingStatus.REOPENED,
      reopenReason: 'conferência adicional',
      reopenedBy: OTHER_USER_ID,
    });

    closing.closeAgain(101_00, 101_00, USER_ID, new Date('2026-07-18T22:10:00Z'));
    expect(closing).toMatchObject({
      status: CashClosingStatus.CLOSED,
      expectedCashCents: 101_00,
      countedCashCents: 101_00,
    });
  });

  it.each([
    ['data', () => CashClosing.create('18/07/2026', 0, 0, USER_ID, closedAt)],
    ['dia inexistente', () => CashClosing.create('2026-02-31', 0, 0, USER_ID, closedAt)],
    ['esperado negativo', () => CashClosing.create('2026-07-18', -1, 0, USER_ID, closedAt)],
    ['contado decimal', () => CashClosing.create('2026-07-18', 0, 1.5, USER_ID, closedAt)],
    [
      'valor acima do limite',
      () => CashClosing.create('2026-07-18', 0, CashClosing.MAX_MONEY_CENTS + 1, USER_ID, closedAt),
    ],
    ['usuário', () => CashClosing.create('2026-07-18', 0, 0, 'invalid', closedAt)],
    ['instante', () => CashClosing.create('2026-07-18', 0, 0, USER_ID, new Date('invalid'))],
  ])('rejeita %s inválido', (_label, action) => {
    expect(action).toThrow(ValidationError);
  });

  it('protege as transições e a ordem temporal', () => {
    const closing = CashClosing.create('2026-07-18', 0, 0, USER_ID, closedAt);
    expect(() => closing.closeAgain(0, 0, USER_ID, closedAt)).toThrow(CashClosingStateError);
    expect(() => closing.reopen('', USER_ID, closedAt)).toThrow(ValidationError);
    expect(() => closing.reopen('x'.repeat(501), USER_ID, closedAt)).toThrow(ValidationError);
    expect(() => closing.reopen('motivo', 'invalid', closedAt)).toThrow(ValidationError);
    expect(() => closing.reopen('motivo', USER_ID, new Date('invalid'))).toThrow(ValidationError);
    expect(() => closing.reopen('motivo', USER_ID, new Date('2026-07-18T21:59:00Z'))).toThrow(
      ValidationError,
    );

    closing.reopen('motivo', USER_ID, closedAt);
    expect(() => closing.reopen('outro', USER_ID, closedAt)).toThrow(CashClosingStateError);
    expect(() => closing.closeAgain(-1, 0, USER_ID, closedAt)).toThrow(ValidationError);
    expect(() => closing.closeAgain(0, -1, USER_ID, closedAt)).toThrow(ValidationError);
    expect(() => closing.closeAgain(0, 0, 'invalid', closedAt)).toThrow(ValidationError);
    expect(() => closing.closeAgain(0, 0, USER_ID, new Date('invalid'))).toThrow(ValidationError);
    expect(() => closing.closeAgain(0, 0, USER_ID, new Date('2026-07-18T21:59:00Z'))).toThrow(
      ValidationError,
    );
  });
});
