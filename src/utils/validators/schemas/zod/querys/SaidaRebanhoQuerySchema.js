// src/utils/validators/schemas/zod/querys/SaidaRebanhoQuerySchema.js

import { z } from 'zod/v4';
import { MOTIVOS_SAIDA } from '../SaidaRebanhoSchema.js';

export const SaidaRebanhoIdSchema = z
    .string()
    .uuid('ID de saída inválido. Deve ser um UUID válido.');

export const SaidaRebanhoQuerySchema = z.object({
    rebanhoId:     z.string().uuid().optional(),
    propriedadeId: z.string().uuid().optional(),
    motivo:        z.enum(MOTIVOS_SAIDA, { error: 'O motivo deve ser Venda, Morte, Abate ou Outro.' }).optional(),
    dataInicio:    z.coerce.date({ error: 'Data de início inválida.' }).optional(),
    dataFim:       z.coerce.date({ error: 'Data de fim inválida.' }).optional(),
    ativo: z.enum(['true', 'false'], {
        error: "O filtro 'ativo' deve ser 'true' ou 'false'",
    }).transform(v => v === 'true').optional(),
    atualizadoDesde: z
        .string()
        .datetime({ message: 'atualizadoDesde deve ser uma data ISO 8601 em UTC.' })
        .transform((valor) => new Date(valor))
        .optional(),
    page:          z.coerce.number().int().positive().optional().default(1),
    limit:         z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { SaidaRebanhoIdSchema as default };
