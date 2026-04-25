// src/utils/validators/schemas/zod/querys/CatalogoQuerySchema.js

import { z } from 'zod/v4';

/**
 * Valida o parâmetro de caminho (ID) como UUID para catálogos.
 */
export const CatalogoIdSchema = z
    .string()
    .uuid('ID de catálogo inválido. Deve ser um UUID válido.');

/**
 * Valida os parâmetros de consulta (query) para listagem de catálogos.
 */
export const CatalogoQuerySchema = z.object({
    nome: z.string().optional(),
    ativo: z.enum(['true', 'false'], {
        errorMap: () => ({ message: "O filtro 'ativo' deve ser 'true' ou 'false'" }),
    }).transform(v => v === 'true').optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { CatalogoIdSchema as default };
