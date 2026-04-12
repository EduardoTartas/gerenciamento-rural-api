// src/utils/validators/schemas/zod/UserSchema.js

import { z } from 'zod/v4';

/**
 * Schema para atualizar o perfil de um usuário.
 * Todos os campos são opcionais — o controller valida se pelo menos um campo está presente.
 */
export const UserUpdateSchema = z.object({
    name: z
        .string()
        .min(2, 'O nome deve ter no mínimo 2 caracteres.')
        .max(100, 'O nome deve ter no máximo 100 caracteres.')
        .optional(),
    email: z
        .email('Formato de e-mail inválido.')
        .optional(),
    image: z
        .string()
        .url('A imagem deve ser uma URL válida.')
        .optional()
        .nullable(),
}).strict();

export default UserUpdateSchema;
