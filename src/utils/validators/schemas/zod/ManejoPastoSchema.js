// src/utils/validators/schemas/zod/ManejoPastoSchema.js

import { z } from 'zod/v4';

/**
 * Schema para criar um novo manejo de pasto.
 * tipoManejoId referencia a tabela global 'tipoManejoPasto' via catálogo.
 */
export const ManejoPastoCreateSchema = z
    .object({
        pastoId: z
            .string()
            .uuid('O ID do pasto deve ser um UUID válido.'),
        tipoManejoId: z
            .string()
            .uuid('O ID do tipo de manejo deve ser um UUID válido.'),
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
        tipoManejoId: z
            .string()
            .uuid('O ID do tipo de manejo deve ser um UUID válido.')
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
