// src/utils/validators/schemas/zod/SaidaRebanhoSchema.js

import { z } from 'zod/v4';

/** Motivos aceitos para a saída de animais. Validados aqui, gravados como texto. */
export const MOTIVOS_SAIDA = ['Venda', 'Morte', 'Abate', 'Outro'];

/**
 * Schema para registrar a saída de animais de um rebanho.
 *
 * Saída é evento imutável, como a movimentação: não há schema de update.
 */
export const SaidaRebanhoCreateSchema = z.object({
    id:                z.string().uuid('O ID deve ser um UUID válido.').optional(),
    rebanhoId:         z.string().uuid('O ID do rebanho deve ser um UUID válido.'),
    motivo:            z.enum(MOTIVOS_SAIDA, { error: 'O motivo deve ser Venda, Morte, Abate ou Outro.' }),
    quantidadeCabecas: z.number({ error: 'Informe a quantidade de cabeças que saíram.' })
                        .int('A quantidade de cabeças deve ser um número inteiro.')
                        .positive('A quantidade de cabeças deve ser maior que zero.'),
    dataSaida:         z.coerce.date({ error: 'A data da saída deve ser uma data válida.' })
                        .refine(d => d <= new Date(), { message: 'A data da saída não pode ser no futuro.' })
                        .optional(),
    observacoes:       z.string().max(500, 'Máximo 500 caracteres.').optional().nullable(),
    // Encerra o ciclo do rebanho mesmo que sobrem cabeças no cadastro. Saída
    // da quantidade inteira finaliza sozinha, sem precisar deste campo.
    finalizar:         z.boolean().optional().default(false),
}).strict();

export default SaidaRebanhoCreateSchema;
