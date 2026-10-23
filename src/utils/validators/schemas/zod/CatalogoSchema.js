
import { z } from 'zod/v4';

export const CatalogoCreateSchema = z.object({
    nome: z
        .string()
        .min(2, 'O nome deve ter pelo menos 2 caracteres.')
        .max(100, 'O nome deve ter no máximo 100 caracteres.')
        .trim(),
}).strict();

export const CatalogoUpdateSchema = z.object({
    nome: z
        .string()
        .min(2, 'O nome deve ter pelo menos 2 caracteres.')
        .max(100, 'O nome deve ter no máximo 100 caracteres.')
        .trim()
        .optional(),
    ativo: z.boolean().optional(),
}).strict();

const diasDescanso = z
    .number()
    .int('Os dias de descanso devem ser um número inteiro.')
    .min(1, 'Os dias de descanso devem ser pelo menos 1.')
    .max(365, 'Os dias de descanso devem ser no máximo 365.');

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
