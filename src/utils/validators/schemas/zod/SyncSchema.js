// src/utils/validators/schemas/zod/SyncSchema.js

import { z } from 'zod/v4';

/** Teto alinhado ao limite de paginação que a API já pratica. */
export const MAXIMO_DE_MUTACOES = 100;

const MutacaoSchema = z
    .object({
        id: z.string().uuid('O id da mutação deve ser um UUID válido.'),
        entidade: z.string().min(1, 'Informe a entidade.'),
        acao: z.enum(['CREATE', 'UPDATE', 'DELETE'], {
            message: 'A ação deve ser CREATE, UPDATE ou DELETE.',
        }),
        entidadeId: z.string().uuid('O id da entidade deve ser um UUID válido.'),
        dependeDe: z.string().uuid().nullish(),
        dados: z.record(z.string(), z.unknown()).optional(),
    })
    .strict()
    .refine((m) => !(m.dados && 'id' in m.dados), {
        message: 'O identificador vem em entidadeId; não repita `id` dentro de dados.',
        path: ['dados'],
    })
    .refine((m) => m.acao === 'DELETE' || m.dados !== undefined, {
        message: 'CREATE e UPDATE exigem o campo dados.',
        path: ['dados'],
    });

export const SyncLoteSchema = z
    .object({
        mutacoes: z
            .array(MutacaoSchema)
            .min(1, 'Envie ao menos uma mutação.')
            .max(MAXIMO_DE_MUTACOES, `O lote aceita no máximo ${MAXIMO_DE_MUTACOES} mutações.`),
    })
    .strict();
