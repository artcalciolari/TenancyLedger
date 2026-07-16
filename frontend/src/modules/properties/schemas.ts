import { z } from 'zod';
import { UNIT_TYPES } from '../../api/contract';

export const createPropertySchema = z.object({
  neighborhood: z
    .string()
    .trim()
    .min(1, 'Informe o bairro.')
    .max(120, 'O bairro deve ter no máximo 120 caracteres.'),
  type: z.enum(UNIT_TYPES),
  unitNumber: z
    .string()
    .trim()
    .min(1, 'Informe o número da unidade.')
    .max(40, 'O número deve ter no máximo 40 caracteres.'),
  buildingId: z.string().uuid().optional().or(z.literal('')),
});

export type CreatePropertyForm = z.infer<typeof createPropertySchema>;
