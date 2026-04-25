// src/utils/validators/schemas/zod/RebanhoSchema.js

import { z } from 'zod/v4';

const uuidOpcional = z.string().uuid().optional().nullable();

/**
 * Schema para criar um novo rebanho.
 */
export const RebanhoCreateSchema = z.object({
    propriedadeId:        z.string().uuid('O ID da propriedade deve ser um UUID válido.'),
    nomeRebanho:          z.string().min(2, 'O nome deve ter pelo menos 2 caracteres.').max(150, 'O nome deve ter no máximo 150 caracteres.'),
    quantidadeCabecas:    z.number().int().positive('A quantidade de cabeças deve ser um número inteiro positivo.').optional().nullable(),
    pesoMedioAtual:       z.number().positive('O peso médio deve ser um número positivo.').optional().nullable(),
    dataEntradaPastoAtual: z.coerce.date().optional().nullable(),
    pastoAtualId:         z.string().uuid('O ID do pasto atual deve ser um UUID válido.'),
    racaId:               uuidOpcional,
    sistemaProducaoId:    uuidOpcional,
    regimeAlimentarId:    uuidOpcional,
}).strict();

/**
 * Schema para atualizar um rebanho existente.
 */
export const RebanhoUpdateSchema = z.object({
    nomeRebanho:          z.string().min(2).max(150).optional(),
    quantidadeCabecas:    z.number().int().positive().optional().nullable(),
    pesoMedioAtual:       z.number().positive().optional().nullable(),
    dataEntradaPastoAtual: z.coerce.date().optional().nullable(),
    pastoAtualId:         uuidOpcional,
    racaId:               uuidOpcional,
    sistemaProducaoId:    uuidOpcional,
    regimeAlimentarId:    uuidOpcional,
    ativo:                z.boolean().optional(),
}).strict();

export default RebanhoCreateSchema;
