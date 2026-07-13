import { describe, expect, it } from 'vitest';
import { availableToSubmit, formatCents, parseBrlToCents } from './money';

describe('money utilities', () => {
  it('converte entrada BRL sem usar ponto flutuante', () => {
    expect(parseBrlToCents('1.500,25')).toBe(150025);
    expect(parseBrlToCents('1500,25')).toBe(150025);
    expect(parseBrlToCents('10')).toBe(1000);
    expect(parseBrlToCents('10,5')).toBe(1050);
  });

  it('formata centavos em reais', () => {
    expect(formatCents(150025)).toContain('1.500,25');
  });

  it('reserva pagamentos aprovados e submetidos', () => {
    expect(
      availableToSubmit(100_000, [
        { amountCents: 20_000, status: 'APPROVED' },
        { amountCents: 30_000, status: 'SUBMITTED' },
        { amountCents: 10_000, status: 'REJECTED' },
      ]),
    ).toBe(50_000);
  });
});
