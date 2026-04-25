// src/utils/validators/schemas/zod/querys/ManejoPastoQuerySchema.js

import { z } from 'zod/v4';

/**
 * Valida o parâmetro de caminho (ID) como um UUID para manejo de pasto.
 */
export const ManejoPastoIdSchema = z
    .string()
    .uuid('ID de manejo de pasto inválido. Deve ser um UUID válido.');

/**
 * Valida os parâmetros de consulta (query) para listagem de manejos de pasto.
 * tipoManejoId agora é UUID (FK para catálogo global).
 */
export const ManejoPastoQuerySchema = z.object({
    pastoId:      z.string().uuid('O ID do pasto deve ser um UUID válido.').optional(),
    propriedadeId: z.string().uuid('O ID da propriedade deve ser um UUID válido.').optional(),
    tipoManejoId: z.string().uuid('O ID do tipo de manejo deve ser um UUID válido.').optional(),
    dataInicio:   z.coerce.date({ error: 'A data de início deve ser uma data válida.' }).optional(),
    dataFim:      z.coerce.date({ error: 'A data de fim deve ser uma data válida.' }).optional(),
    page:         z.coerce.number().int().positive().optional().default(1),
    limit:        z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { ManejoPastoIdSchema as default };
