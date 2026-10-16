// src/utils/validators/schemas/zod/querys/FotoAtividadeQuerySchema.js

import { z } from 'zod/v4';

/** ID de foto de atividade no caminho. */
export const FotoAtividadeIdSchema = z
    .string()
    .uuid('ID de foto inválido. Deve ser um UUID válido.');

/**
 * Filtros de `GET /manejos/fotos`. Com `atualizadoDesde` a resposta traz também
 * as fotos excluídas (leitura por diferença), como as demais listas.
 */
export const FotoAtividadeQuerySchema = z.object({
    manejoPastoId:   z.string().uuid('O ID do manejo de pastagem deve ser um UUID válido.').optional(),
    manejoRebanhoId: z.string().uuid('O ID do manejo de rebanho deve ser um UUID válido.').optional(),
    pastoId:         z.string().uuid('O ID do pasto deve ser um UUID válido.').optional(),
    rebanhoId:       z.string().uuid('O ID do rebanho deve ser um UUID válido.').optional(),
    propriedadeId:   z.string().uuid('O ID da propriedade deve ser um UUID válido.').optional(),
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

export { FotoAtividadeIdSchema as default };
