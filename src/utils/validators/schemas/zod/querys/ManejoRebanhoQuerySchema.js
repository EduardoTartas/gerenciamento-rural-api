// src/utils/validators/schemas/zod/querys/ManejoRebanhoQuerySchema.js

import { z } from 'zod/v4';

export const ManejoRebanhoIdSchema = z
    .string()
    .uuid('ID de manejo de rebanho inválido. Deve ser um UUID válido.');

export const ManejoRebanhoQuerySchema = z.object({
    rebanhoId:    z.string().uuid('O ID do rebanho deve ser um UUID válido.').optional(),
    tipoManejoId: z.string().uuid('O ID do tipo de manejo deve ser um UUID válido.').optional(),
    propriedadeId: z.string().uuid('O ID da propriedade deve ser um UUID válido.').optional(),
    dataInicio:   z.coerce.date({ error: 'Data de início inválida.' }).optional(),
    dataFim:      z.coerce.date({ error: 'Data de fim inválida.' }).optional(),
    page:         z.coerce.number().int().positive().optional().default(1),
    limit:        z.coerce.number().int().positive().max(100).optional().default(10),
}).strict();

export { ManejoRebanhoIdSchema as default };
