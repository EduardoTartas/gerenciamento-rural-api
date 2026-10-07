// src/utils/validators/schemas/zod/RebanhoSchema.js

import { z } from 'zod/v4';

const uuidOpcional = z.string().uuid().optional().nullable();

const positivoOpcional = (rotulo) => z.number({ error: `${rotulo} deve ser um número.` })
    .finite(`${rotulo} inválido.`)
    .positive(`${rotulo} deve ser maior que zero.`)
    .optional()
    .nullable();

/**
 * Compra do lote (issue #71): tudo opcional e independente — o produtor pode
 * informar só o valor, ou valor, peso e arroba. `null` limpa na edição. A data
 * tolera +5 min como as demais: o app offline usa o relógio do celular.
 */
const camposDeCompra = {
    valorCompra:       positivoOpcional('O valor da compra'),
    pesoCompraKg:      positivoOpcional('O peso da compra'),
    precoArrobaCompra: positivoOpcional('O preço da arroba da compra'),
    cabecasCompra:     z.number({ error: 'As cabeças na compra devem ser um número.' })
                         .int('As cabeças na compra devem ser um número inteiro.')
                         .positive('As cabeças na compra devem ser maior que zero.')
                         .optional()
                         .nullable(),
    dataCompra:        z.coerce.date({ error: 'A data da compra deve ser uma data válida.' })
                         .refine((d) => d.getTime() <= Date.now() + 5 * 60 * 1000, { message: 'A data da compra não pode ser no futuro.' })
                         .optional()
                         .nullable(),
};

/**
 * Schema para criar um novo rebanho.
 */
export const RebanhoCreateSchema = z.object({
    id:                   uuidOpcional,
    propriedadeId:        z.string().uuid('O ID da propriedade deve ser um UUID válido.'),
    nomeRebanho:          z.string().min(2, 'O nome deve ter pelo menos 2 caracteres.').max(150, 'O nome deve ter no máximo 150 caracteres.'),
    quantidadeCabecas:    z.number().int().positive('A quantidade de cabeças deve ser um número inteiro positivo.').optional().nullable(),
    pesoMedioAtual:       z.number().positive('O peso médio deve ser um número positivo.').optional().nullable(),
    dataEntradaPastoAtual: z.coerce.date().optional().nullable(),
    pastoAtualId:         z.string().uuid('O ID do pasto atual deve ser um UUID válido.'),
    racaId:               uuidOpcional,
    sistemaProducaoId:    uuidOpcional,
    regimeAlimentarId:    uuidOpcional,
    // Mesma regra da movimentação: o pasto inicial precisa estar livre, salvo
    // consentimento explícito. Não é coluna — o service remove antes do Prisma.
    permitirLotacaoConjunta: z.boolean().optional().default(false),
    ...camposDeCompra,
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
    ...camposDeCompra,
}).strict();

export default RebanhoCreateSchema;
