// src/utils/validators/schemas/zod/querys/RegimeConsumoInsumoQuerySchema.js
import { z } from 'zod/v4';

export const RegimeConsumoInsumoIdSchema = z.string().uuid('ID de regime inválido. Deve ser um UUID válido.');

export const RegimeConsumoInsumoQuerySchema = z.object({
    rebanhoId: z.string().uuid('O ID do rebanho deve ser um UUID válido.').optional(),
    insumoId:  z.string().uuid('O ID do insumo deve ser um UUID válido.').optional(),
    // 'true' => só os em aberto (dataFim IS NULL); default: todos
    emAberto:  z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    ativo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    atualizadoDesde: z.string().datetime({ message: 'atualizadoDesde deve ser uma data ISO 8601 em UTC.' })
        .transform((v) => new Date(v)).optional(),
    page:  z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { RegimeConsumoInsumoIdSchema as default };
