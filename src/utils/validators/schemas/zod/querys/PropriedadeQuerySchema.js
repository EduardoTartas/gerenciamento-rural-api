// src/utils/validators/schemas/zod/querys/PropriedadeQuerySchema.js

import { z } from 'zod/v4';

/**
 * Valida o parâmetro de caminho (ID) como um UUID para propriedade.
 */
export const PropriedadeIdSchema = z
    .string()
    .uuid('ID de propriedade inválido. Deve ser um UUID válido.');

/**
 * Valida os parâmetros de consulta (query) para listagem de propriedades.
 * Suporta filtragem por nome e localizacao (ex: "Vilhena,RO").
 */
export const PropriedadeQuerySchema = z.object({
    nome: z.string().optional(),
    localizacao: z.string().optional(),
    ativo: z.enum(['true', 'false'], {
        errorMap: () => ({ message: "O filtro 'ativo' deve ser 'true' ou 'false'" })
    }).transform(v => v === 'true').optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { PropriedadeIdSchema as default };
