// src/utils/validators/schemas/zod/querys/UserQuerySchema.js

import { z } from 'zod/v4';

/**
 * Valida o parâmetro de caminho do usuário.
 * O BetterAuth gera o id como string alfanumérica de 32 caracteres (sem
 * hífens), não UUID — apesar do default do schema Prisma sugerir isso. O
 * schema aceita esse formato e o UUID (usado em testes e no id opcional do
 * fluxo offline-first) pelo comprimento, sem travar num charset específico.
 */
export const UserIdSchema = z
    .string()
    .min(20, 'Formato de ID de usuário inválido.');

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
