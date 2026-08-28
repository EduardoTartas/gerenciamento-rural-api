// src/utils/validators/schemas/zod/querys/MovimentacaoInsumoQuerySchema.js
import { z } from 'zod/v4';

export const MovimentacaoInsumoIdSchema = z.string().uuid('ID de movimentação inválido. Deve ser um UUID válido.');

export const MovimentacaoInsumoQuerySchema = z.object({
    insumoId:   z.string().uuid('O ID do insumo deve ser um UUID válido.').optional(),
    tipo:       z.enum(['Entrada', 'Saida', 'Ajuste']).optional(),
    origem:     z.string().optional(),
    dataInicio: z.coerce.date().optional(),
    dataFim:    z.coerce.date().optional(),
    ativo: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
    atualizadoDesde: z.string().datetime({ message: 'atualizadoDesde deve ser uma data ISO 8601 em UTC.' })
        .transform((v) => new Date(v)).optional(),
    page:  z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { MovimentacaoInsumoIdSchema as default };
