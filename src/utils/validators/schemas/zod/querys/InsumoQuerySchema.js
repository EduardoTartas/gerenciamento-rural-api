// src/utils/validators/schemas/zod/querys/InsumoQuerySchema.js
import { z } from 'zod/v4';

export const InsumoIdSchema = z.string().uuid('ID de insumo inválido. Deve ser um UUID válido.');

export const InsumoQuerySchema = z.object({
    propriedadeId: z.string().uuid('O ID da propriedade deve ser um UUID válido.').optional(),
    tipoInsumoId:  z.string().uuid('O ID do tipo de insumo deve ser um UUID válido.').optional(),
    destino:       z.enum(['Pasto', 'Rebanho', 'Ambos']).optional(),
    nome:          z.string().optional(),
    ativo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    atualizadoDesde: z.string().datetime({ message: 'atualizadoDesde deve ser uma data ISO 8601 em UTC.' })
        .transform((v) => new Date(v)).optional(),
    page:  z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { InsumoIdSchema as default };
