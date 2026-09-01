// src/utils/validators/schemas/zod/RegimeConsumoInsumoSchema.js
import { z } from 'zod/v4';

export const RegimeConsumoInsumoCreateSchema = z.object({
    id:            z.string().uuid('O ID deve ser um UUID válido.').optional(),
    rebanhoId:     z.string().uuid('O ID do rebanho deve ser um UUID válido.'),
    insumoId:      z.string().uuid('O ID do insumo deve ser um UUID válido.'),
    quantidadeDia: z.number({ error: 'A quantidade diária deve ser um número.' })
                     .positive('A quantidade diária deve ser maior que zero.'),
    dataInicio:    z.coerce.date({ error: 'A data de início deve ser uma data válida.' }),
    dataFim:       z.coerce.date({ error: 'A data de fim deve ser uma data válida.' }).optional().nullable(),
})
    .strict()
    .refine((r) => !r.dataFim || r.dataInicio <= r.dataFim, {
        message: 'A data de início não pode ser depois da data de fim.',
        path: ['dataFim'],
    });

export const RegimeConsumoInsumoUpdateSchema = z.object({
    quantidadeDia: z.number().positive('A quantidade diária deve ser maior que zero.').optional(),
    dataFim:       z.coerce.date({ error: 'A data de fim deve ser uma data válida.' }).optional().nullable(),
}).strict();

export default RegimeConsumoInsumoCreateSchema;
