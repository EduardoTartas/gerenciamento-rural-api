// src/utils/validators/schemas/zod/querys/ManejoPastoQuerySchema.js

import { z } from 'zod/v4';
import { TIPOS_MANEJO_PASTO } from '../ManejoPastoSchema.js';

/**
 * Valida o parâmetro de caminho (ID) como um UUID para manejo de pasto.
 */
export const ManejoPastoIdSchema = z
    .string()
    .uuid('ID de manejo de pasto inválido. Deve ser um UUID válido.');

/**
 * Valida os parâmetros de consulta (query) para listagem de manejos de pasto.
 * Suporta filtragem por pastoId, tipoManejo e propriedadeId.
 */
export const ManejoPastoQuerySchema = z.object({
    pastoId: z.string().uuid('O ID do pasto deve ser um UUID válido.').optional(),
    propriedadeId: z.string().uuid('O ID da propriedade deve ser um UUID válido.').optional(),
    tipoManejo: z.enum(TIPOS_MANEJO_PASTO).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { ManejoPastoIdSchema as default };
