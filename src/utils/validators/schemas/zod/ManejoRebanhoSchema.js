// src/utils/validators/schemas/zod/ManejoRebanhoSchema.js

import { z } from 'zod/v4';

export const ManejoRebanhoCreateSchema = z.object({
    rebanhoId:        z.string().uuid('O ID do rebanho deve ser um UUID válido.'),
    tipoManejoId:     z.string().uuid('O ID do tipo de manejo deve ser um UUID válido.'),
    dataAtividade:    z.coerce.date({ error: 'A data da atividade deve ser uma data válida.' })
                        .refine(d => d <= new Date(), { message: 'A data da atividade não pode ser no futuro.' }),
    medicamentoVacina: z.string().max(200, 'Máximo 200 caracteres.').optional().nullable(),
    pesoRegistrado:   z.number().positive('O peso deve ser um número positivo.').optional().nullable(),
    observacoes:      z.string().max(500, 'Máximo 500 caracteres.').optional().nullable(),
}).strict();

export const ManejoRebanhoUpdateSchema = z.object({
    tipoManejoId:     z.string().uuid().optional(),
    dataAtividade:    z.coerce.date().refine(d => d <= new Date(), { message: 'A data não pode ser no futuro.' }).optional(),
    medicamentoVacina: z.string().max(200).optional().nullable(),
    pesoRegistrado:   z.number().positive().optional().nullable(),
    observacoes:      z.string().max(500).optional().nullable(),
}).strict();

export default ManejoRebanhoCreateSchema;
