// src/utils/validators/schemas/zod/querys/UserQuerySchema.js

import { z } from 'zod/v4';

/**
 * Valida o parâmetro de caminho UUID.
 */
export const UserIdSchema = z
    .string()
    .uuid('Formato de ID de usuário inválido. Deve ser um UUID válido.');

/**
 * Valida os parâmetros de query para a listagem de usuários.
 */
export const UserQuerySchema = z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { UserIdSchema as default };
