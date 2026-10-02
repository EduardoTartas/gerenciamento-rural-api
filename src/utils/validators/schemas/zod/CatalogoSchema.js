// src/utils/validators/schemas/zod/CatalogoSchema.js

import { z } from 'zod/v4';

/**
 * Schema para criar um item de catálogo global.
 * Base comum (`nome`); entidades com campo extra usam `schemaDeCriacao(entidade)`.
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

/**
 * Dias de descanso da forrageira (`tipos-pastagem`): padrão sugerido ao pasto.
 * Teto de um ano, mesmo limite do ajuste em `pasto.diasDescanso`.
 */
const diasDescanso = z
    .number()
    .int('Os dias de descanso devem ser um número inteiro.')
    .min(1, 'Os dias de descanso devem ser pelo menos 1.')
    .max(365, 'Os dias de descanso devem ser no máximo 365.');

/**
 * Campos extras por entidade (mesma chave de `CATALOGO_ENTITIES`): obrigatórios na
 * criação, opcionais na atualização. Entidade sem entrada aqui usa só a base.
 */
const CAMPOS_EXTRAS = {
    'tipos-pastagem': { diasDescanso },
};

export function schemaDeCriacao(entidade) {
    const extras = CAMPOS_EXTRAS[entidade];
    return extras ? CatalogoCreateSchema.extend(extras) : CatalogoCreateSchema;
}

export function schemaDeAtualizacao(entidade) {
    const extras = CAMPOS_EXTRAS[entidade];
    if (!extras) return CatalogoUpdateSchema;
    const opcionais = Object.fromEntries(
        Object.entries(extras).map(([campo, schema]) => [campo, schema.optional()]),
    );
    return CatalogoUpdateSchema.extend(opcionais);
}

export default CatalogoCreateSchema;
