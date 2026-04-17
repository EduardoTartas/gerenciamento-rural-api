// src/utils/validators/schemas/zod/ManejoPastoSchema.js

import { z } from 'zod/v4';

/**
 * Tipos de manejo de pasto disponíveis.
 * Lista fixa para padronização de dados e facilitar relatórios.
 */
export const TIPOS_MANEJO_PASTO = [
    'Roçagem',
    'Adubação',
    'Calagem',
    'Aplicação de Pesticida',
    'Reforma de Cerca',
    'Limpeza Geral',
    'Plantio/Reforma',
    'Outro',
];

/**
 * Schema para criar um novo manejo de pasto.
 */
export const ManejoPastoCreateSchema = z
    .object({
        pastoId: z
            .string()
            .uuid('O ID do pasto deve ser um UUID válido.'),
        tipoManejo: z
            .enum(TIPOS_MANEJO_PASTO, {
                error: `O tipo de manejo deve ser um dos seguintes valores: ${TIPOS_MANEJO_PASTO.join(', ')}.`,
            }),
        dataAtividade: z
            .coerce.date({ error: 'A data da atividade deve ser uma data válida.' })
            .refine((date) => date <= new Date(), { message: 'A data da atividade não pode ser no futuro.' }),
        observacoes: z
            .string()
            .max(500, 'As observações devem ter no máximo 500 caracteres.')
            .optional()
            .nullable(),
    })
    .strict();

/**
 * Schema para atualizar um manejo de pasto existente.
 */
export const ManejoPastoUpdateSchema = z
    .object({
        tipoManejo: z
            .enum(TIPOS_MANEJO_PASTO, {
                error: `O tipo de manejo deve ser um dos seguintes valores: ${TIPOS_MANEJO_PASTO.join(', ')}.`,
            })
            .optional(),
        dataAtividade: z
            .coerce.date({ error: 'A data da atividade deve ser uma data válida.' })
            .refine((date) => date <= new Date(), { message: 'A data da atividade não pode ser no futuro.' })
            .optional(),
        observacoes: z
            .string()
            .max(500, 'As observações devem ter no máximo 500 caracteres.')
            .optional()
            .nullable(),
    })
    .strict();

export default ManejoPastoCreateSchema;
