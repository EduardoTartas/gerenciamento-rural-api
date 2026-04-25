// src/utils/validators/schemas/zod/querys/RebanhoQuerySchema.js

import { z } from 'zod/v4';

export const RebanhoIdSchema = z
    .string()
    .uuid('ID de rebanho inválido. Deve ser um UUID válido.');

export const RebanhoQuerySchema = z.object({
    nomeRebanho:      z.string().optional(),
    propriedadeId:    z.string().uuid('O ID da propriedade deve ser um UUID válido.').optional(),
    pastoAtualId:     z.string().uuid('O ID do pasto deve ser um UUID válido.').optional(),
    racaId:           z.string().uuid('O ID da raça deve ser um UUID válido.').optional(),
    sistemaProducaoId: z.string().uuid('O ID do sistema de produção deve ser um UUID válido.').optional(),
    regimeAlimentarId: z.string().uuid('O ID do regime alimentar deve ser um UUID válido.').optional(),
    ativo: z.enum(['true', 'false'], {
        errorMap: () => ({ message: "O filtro 'ativo' deve ser 'true' ou 'false'" }),
    }).transform(v => v === 'true').optional(),
    page:  z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { RebanhoIdSchema as default };
