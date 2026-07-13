import { z } from 'zod';
import { parseBrlToCents } from '../../lib/money/money';

const maxMoneyCents = 2_147_483_647;

function isCivilDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export const createContractSchema = z.object({
  tenantId: z.string().uuid('Selecione um locatário.'),
  propertyUnitId: z.string().uuid('Selecione um imóvel.'),
  moveInDate: z.string().refine(isCivilDate, 'Informe uma data de entrada válida.'),
  monthlyBaseValue: z
    .string()
    .trim()
    .min(1, 'Informe o aluguel mensal.')
    .refine((value) => {
      const cents = parseBrlToCents(value);
      return cents !== null && cents >= 1 && cents <= maxMoneyCents;
    }, 'Informe um valor entre R$ 0,01 e R$ 21.474.836,47.'),
  durationInMonths: z
    .number({ error: 'Informe a duração.' })
    .int('A duração deve ser um número inteiro.')
    .min(1, 'A duração mínima é 1 mês.')
    .max(600, 'A duração máxima é 600 meses.'),
  billingDay: z
    .number()
    .int('O dia deve ser um número inteiro.')
    .min(1, 'O dia mínimo é 1.')
    .max(28, 'O dia máximo é 28.')
    .nullable(),
  isRenewable: z.boolean(),
});

export const renewContractSchema = z.object({
  extraMonths: z
    .number({ error: 'Informe a duração da renovação.' })
    .int('A duração deve ser um número inteiro.')
    .min(1, 'A renovação mínima é 1 mês.')
    .max(600, 'A renovação máxima é 600 meses.'),
});

export type CreateContractForm = z.infer<typeof createContractSchema>;
export type RenewContractForm = z.infer<typeof renewContractSchema>;
