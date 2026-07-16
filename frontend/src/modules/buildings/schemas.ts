import { z } from 'zod';

export const createBuildingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Informe o nome do prédio.')
    .max(120, 'O nome deve ter no máximo 120 caracteres.'),
  neighborhood: z
    .string()
    .trim()
    .min(1, 'Informe o bairro.')
    .max(120, 'O bairro deve ter no máximo 120 caracteres.'),
  address: z
    .string()
    .trim()
    .max(200, 'O endereço deve ter no máximo 200 caracteres.')
    .optional()
    .or(z.literal('')),
});

export type CreateBuildingForm = z.infer<typeof createBuildingSchema>;
