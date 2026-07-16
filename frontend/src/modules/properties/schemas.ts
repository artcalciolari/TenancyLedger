import { z } from 'zod';
import { UNIT_TYPES } from '../../api/contract';

const propertySchema = z.object({
  neighborhood: z
    .string()
    .trim()
    .max(120, 'O bairro deve ter no máximo 120 caracteres.')
    .optional(),
  type: z.enum(UNIT_TYPES),
  unitNumber: z
    .string()
    .trim()
    .min(1, 'Informe o número da unidade.')
    .max(40, 'O número deve ter no máximo 40 caracteres.'),
  buildingId: z.string().uuid().optional().or(z.literal('')),
});

export const createPropertySchema = propertySchema.superRefine((value, context) => {
  if (!value.buildingId && !value.neighborhood) {
    context.addIssue({
      code: 'custom',
      message: 'Informe o bairro.',
      path: ['neighborhood'],
    });
  }
});

export type CreatePropertyForm = z.infer<typeof createPropertySchema>;

export const updatePropertySchema = propertySchema.omit({ buildingId: true }).partial();
export type UpdatePropertyForm = z.infer<typeof updatePropertySchema>;
