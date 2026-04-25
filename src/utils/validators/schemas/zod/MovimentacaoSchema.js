// src/utils/validators/schemas/zod/MovimentacaoSchema.js

import { z } from 'zod/v4';

/**
 * Schema para registrar uma nova movimentação de rebanho.
 * O pastoOrigemId é preenchido automaticamente pelo sistema (pasto atual do rebanho).
 */
export const MovimentacaoCreateSchema = z.object({
    rebanhoId:       z.string().uuid('O ID do rebanho deve ser um UUID válido.'),
    pastoDestinoId:  z.string().uuid('O ID do pasto de destino deve ser um UUID válido.'),
    dataMovimentacao: z.coerce.date({ error: 'A data da movimentação deve ser uma data válida.' })
                        .refine(d => d <= new Date(), { message: 'A data da movimentação não pode ser no futuro.' })
                        .optional(),
    observacoes:     z.string().max(500, 'Máximo 500 caracteres.').optional().nullable(),
}).strict();

export default MovimentacaoCreateSchema;
