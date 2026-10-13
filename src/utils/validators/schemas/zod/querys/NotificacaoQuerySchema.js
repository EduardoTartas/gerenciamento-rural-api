// src/utils/validators/schemas/zod/querys/NotificacaoQuerySchema.js

import { z } from 'zod/v4';

export const NotificacaoIdSchema = z
    .string()
    .uuid('ID de notificação inválido. Deve ser um UUID válido.');

export const NotificacaoQuerySchema = z.object({
    lida: z.enum(['true', 'false'], {
        error: "O filtro 'lida' deve ser 'true' ou 'false'",
    }).transform((v) => v === 'true').optional(),
    propriedadeId: z.string().uuid().optional(),
    ativo: z.enum(['true', 'false'], {
        error: "O filtro 'ativo' deve ser 'true' ou 'false'",
    }).transform((v) => v === 'true').optional(),
    atualizadoDesde: z
        .string()
        .datetime({ message: 'atualizadoDesde deve ser uma data ISO 8601 em UTC.' })
        .transform((valor) => new Date(valor))
        .optional(),
    page:  z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { NotificacaoIdSchema as default };
