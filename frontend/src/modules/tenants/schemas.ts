import { z } from 'zod';
import { TENANT_CIVIL_STATUSES } from '../../api/contract';

export const createTenantSchema = z.object({
  cpf: z
    .string()
    .trim()
    .regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, 'Informe um CPF válido.'),
  rg: z
    .string()
    .trim()
    .min(5, 'O RG deve ter no mínimo 5 caracteres.')
    .max(20, 'O RG deve ter no máximo 20 caracteres.')
    .regex(/^[\p{L}\d.\-/]+$/u, 'O RG contém caracteres inválidos.'),
  profession: z
    .string()
    .trim()
    .min(2, 'A profissão deve ter no mínimo 2 caracteres.')
    .max(100, 'A profissão deve ter no máximo 100 caracteres.'),
  civilStatus: z.enum(TENANT_CIVIL_STATUSES),
  email: z.string().trim().email('Informe um e-mail válido.').max(254),
  mobilePhone: z
    .string()
    .trim()
    .min(10, 'Informe um telefone com DDD.')
    .max(20, 'O telefone deve ter no máximo 20 caracteres.')
    .regex(/^\+?[\d ()-]+$/, 'Informe um telefone válido.'),
});

export type CreateTenantForm = z.infer<typeof createTenantSchema>;
