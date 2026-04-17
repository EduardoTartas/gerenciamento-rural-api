// src/utils/validators/schemas/zod/querys/PastoQuerySchema.js

import { z } from 'zod/v4';

/**
 * Valida o parâmetro de caminho (ID) como um UUID para pasto.
 */
export const PastoIdSchema = z
    .string()
    .uuid('ID de pastagem inválido. Deve ser um UUID válido.');

/**
 * Valida os parâmetros de consulta (query) para listagem de pastos.
 * Suporta filtragem por nome, propriedadeId, status e tipoPastagem.
 */
export const PastoQuerySchema = z.object({
    nome: z.string().optional(),
    propriedadeId: z.string().uuid('O ID da propriedade deve ser um UUID válido.').optional(),
    status: z.enum(['Ocupado', 'Vazio', 'Descanso']).optional(),
    tipoPastagem: z.string().optional(),
    ativo: z.string().transform(v => v === 'true').optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { PastoIdSchema as default };
