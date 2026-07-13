import { z } from 'zod';
import { USER_ROLES } from '../../api/contract';

export const strongPassword = z
  .string()
  .min(12, 'A senha deve ter no mínimo 12 caracteres.')
  .max(128, 'A senha deve ter no máximo 128 caracteres.')
  .regex(/[a-z]/, 'Inclua ao menos uma letra minúscula.')
  .regex(/[A-Z]/, 'Inclua ao menos uma letra maiúscula.')
  .regex(/\d/, 'Inclua ao menos um número.')
  .regex(/[^A-Za-z0-9]/, 'Inclua ao menos um símbolo.');

export const createUserSchema = z
  .object({
    email: z.string().trim().email('Informe um e-mail válido.').max(254),
    password: strongPassword,
    confirmPassword: z.string(),
    role: z.enum(USER_ROLES),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

export type CreateUserForm = z.infer<typeof createUserSchema>;

export const updateUserAccessSchema = z.object({
  role: z.enum(USER_ROLES),
  active: z.boolean(),
});

export type UpdateUserAccessForm = z.infer<typeof updateUserAccessSchema>;
