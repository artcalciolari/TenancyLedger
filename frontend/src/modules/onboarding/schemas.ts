import { z } from 'zod';
import { TENANT_CIVIL_STATUSES } from '../../api/contract';
import { normalizeBrazilianReferencePhone } from '../../lib/validation/phone';

export const tenantReferenceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome da referência.')
    .max(120, 'O nome deve ter no máximo 120 caracteres.'),
  relationship: z
    .string()
    .trim()
    .min(2, 'Informe a relação com o locatário.')
    .max(80, 'A relação deve ter no máximo 80 caracteres.'),
  phone: z
    .string()
    .trim()
    .transform(normalizeBrazilianReferencePhone)
    .refine((value) => /^[1-9]{2}[2-9]\d{7,8}$/.test(value), {
      message: 'Informe um telefone brasileiro válido com DDD.',
    }),
  email: z
    .string()
    .trim()
    .max(254, 'O e-mail deve ter no máximo 254 caracteres.')
    .refine((value) => value === '' || z.string().email().safeParse(value).success, {
      message: 'Informe um e-mail válido.',
    })
    .optional(),
});

export const referencesSchema = z
  .array(tenantReferenceSchema)
  .min(2, 'Informe pelo menos duas referências.');

export const reviewSchema = z.object({
  propertyUnitId: z.string().uuid('Selecione um quarto disponível.'),
  moveInDate: z.iso.date('Informe uma data de entrada válida.'),
  monthlyBaseValueCents: z
    .number('Informe o valor mensal.')
    .int()
    .min(1, 'O valor mensal deve ser maior que zero.')
    .max(1_000_000_000, 'O valor mensal informado é muito alto.'),
});

export const photoMetadataSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number().nonnegative(),
  skipped: z.boolean(),
});

export const onboardingPayloadSchema = z.object({
  version: z.literal(1).catch(1),
  personalData: z
    .object({
      name: z.string().catch(''),
      cpf: z.string().catch(''),
      rg: z.string().catch(''),
      profession: z.string().catch(''),
      civilStatus: z.enum(TENANT_CIVIL_STATUSES).catch('SINGLE'),
      email: z.string().catch(''),
      mobilePhone: z.string().catch(''),
    })
    .catch({
      name: '',
      cpf: '',
      rg: '',
      profession: '',
      civilStatus: 'SINGLE',
      email: '',
      mobilePhone: '',
    }),
  photo: photoMetadataSchema.nullable().catch(null),
  references: z.array(tenantReferenceSchema).catch([]),
  propertyUnitId: z.string().nullable().catch(null),
  moveInDate: z.string().catch(''),
  monthlyBaseValueCents: z.number().int().positive().nullable().catch(null),
});

export type FieldErrors = Record<string, string | undefined>;

export function issuesToFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    if (key && errors[key] === undefined) errors[key] = issue.message;
  }
  return errors;
}
