// src/utils/validators/schemas/zod/CatalogoSchema.js

import { z } from 'zod/v4';

/**
 * Schema para criar um item de catálogo global.
 * Todos os catálogos têm apenas o campo 'nome'.
 */
export const CatalogoCreateSchema = z.object({
    nome: z
        .string()
        .min(2, 'O nome deve ter pelo menos 2 caracteres.')
        .max(100, 'O nome deve ter no máximo 100 caracteres.')
        .trim(),
}).strict();

/**
 * Schema para atualizar um item de catálogo global.
 */
export const CatalogoUpdateSchema = z.object({
    nome: z
        .string()
        .min(2, 'O nome deve ter pelo menos 2 caracteres.')
        .max(100, 'O nome deve ter no máximo 100 caracteres.')
        .trim()
        .optional(),
    ativo: z.boolean().optional(),
}).strict();

export default CatalogoCreateSchema;
