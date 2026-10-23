
import { z } from 'zod/v4';

export const PastoIdSchema = z
    .string()
    .uuid('ID de pastagem inválido. Deve ser um UUID válido.');

export const PastoQuerySchema = z.object({
    nome: z.string().optional(),
    propriedadeId: z.string().uuid('O ID da propriedade deve ser um UUID válido.').optional(),
    status: z.enum(['Ocupado', 'Vazio', 'Descanso']).optional(),
    tipoPastagemId: z.string().uuid('O ID do tipo de pastagem deve ser um UUID válido.').optional(),
    ativo: z.enum(['true', 'false'], {
        error: "O filtro 'ativo' deve ser 'true' ou 'false'",
    }).transform(v => v === 'true').optional(),
    atualizadoDesde: z
        .string()
        .datetime({ message: 'atualizadoDesde deve ser uma data ISO 8601 em UTC.' })
        .transform((valor) => new Date(valor))
        .optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { PastoIdSchema as default };
