// src/utils/validators/schemas/zod/querys/UserQuerySchema.js

import { z } from 'zod/v4';

/**
 * Validates a UUID path parameter.
 */
export const UserIdSchema = z
    .string()
    .uuid('Invalid user ID format. Must be a valid UUID.');

/**
 * Validates query parameters for listing users.
 */
export const UserQuerySchema = z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { UserIdSchema as default };
