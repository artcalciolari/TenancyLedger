import { z } from 'zod';

const roomNumberSchema = z
  .string()
  .trim()
  .min(1, 'Informe o número do quarto.')
  .max(40, 'O número deve ter no máximo 40 caracteres.');

export const createRoomSchema = z.object({
  buildingId: z.string().uuid('Selecione um prédio.'),
  number: roomNumberSchema,
});

export type CreateRoomForm = z.infer<typeof createRoomSchema>;

export const updateRoomSchema = z.object({
  number: roomNumberSchema,
});

export type UpdateRoomForm = z.infer<typeof updateRoomSchema>;
