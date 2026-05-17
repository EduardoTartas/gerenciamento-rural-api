// src/utils/validators/schemas/zod/querys/MovimentacaoQuerySchema.js

import { z } from 'zod/v4';

export const MovimentacaoIdSchema = z
    .string()
    .uuid('ID de movimentação inválido. Deve ser um UUID válido.');

export const MovimentacaoQuerySchema = z.object({
    rebanhoId:     z.string().uuid().optional(),
    propriedadeId: z.string().uuid().optional(),
    pastoOrigemId:  z.string().uuid().optional(),
    pastoDestinoId: z.string().uuid().optional(),
    dataInicio:    z.coerce.date({ error: 'Data de início inválida.' }).optional(),
    dataFim:       z.coerce.date({ error: 'Data de fim inválida.' }).optional(),
    page:          z.coerce.number().int().positive().optional().default(1),
    limit:         z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { MovimentacaoIdSchema as default };
