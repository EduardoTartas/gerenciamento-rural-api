
import { z } from 'zod/v4';

export const UserIdSchema = z
    .string()
    .min(20, 'Formato de ID de usuário inválido.');

export const UserQuerySchema = z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { UserIdSchema as default };
