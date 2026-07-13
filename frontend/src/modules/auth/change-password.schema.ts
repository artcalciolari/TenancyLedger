import { z } from 'zod';

const newPassword = z
  .string()
  .min(12, 'A nova senha deve ter no mínimo 12 caracteres.')
  .max(128, 'A nova senha deve ter no máximo 128 caracteres.')
  .regex(/[a-z]/, 'Inclua ao menos uma letra minúscula.')
  .regex(/[A-Z]/, 'Inclua ao menos uma letra maiúscula.')
  .regex(/\d/, 'Inclua ao menos um número.')
  .regex(/[^A-Za-z0-9]/, 'Inclua ao menos um símbolo.');

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(12, 'A senha atual deve ter no mínimo 12 caracteres.')
      .max(128, 'A senha atual deve ter no máximo 128 caracteres.'),
    newPassword,
    confirmPassword: z.string(),
  })
  .superRefine((value, context) => {
    if (value.newPassword === value.currentPassword) {
      context.addIssue({
        code: 'custom',
        message: 'A nova senha deve ser diferente da senha atual.',
        path: ['newPassword'],
      });
    }
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: 'custom',
        message: 'As senhas não coincidem.',
        path: ['confirmPassword'],
      });
    }
  });

export type ChangePasswordForm = z.infer<typeof changePasswordSchema>;
