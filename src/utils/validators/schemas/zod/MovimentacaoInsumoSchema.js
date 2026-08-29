// src/utils/validators/schemas/zod/MovimentacaoInsumoSchema.js
import { z } from 'zod/v4';

export const TIPOS_MOVIMENTACAO = ['Entrada', 'Saida', 'Ajuste'];
// Origens que o produtor lança direto. ManejoRebanho/ManejoPasto só nascem
// pelo fluxo de manejo, nunca por este endpoint.
export const ORIGENS_MOVIMENTACAO = ['Compra', 'CadastroInicial', 'ConsumoRebanho', 'AjusteContagem', 'Perda'];

export const MovimentacaoInsumoCreateSchema = z.object({
    id:         z.string().uuid('O ID deve ser um UUID válido.').optional(),
    insumoId:   z.string().uuid('O ID do insumo deve ser um UUID válido.'),
    tipo:       z.enum(TIPOS_MOVIMENTACAO, { message: `tipo deve ser um de: ${TIPOS_MOVIMENTACAO.join(', ')}.` }),
    quantidade: z.number({ error: 'A quantidade deve ser um número.' }).finite('Quantidade inválida.'),
    data:       z.coerce.date({ error: 'A data deve ser uma data válida.' })
                  // Tolera +5 min: o app offline grava com o relógio do celular,
                  // que pode estar alguns segundos à frente do servidor.
                  .refine((d) => d.getTime() <= Date.now() + 5 * 60 * 1000, { message: 'A data não pode ser no futuro.' }),
    origem:     z.enum(ORIGENS_MOVIMENTACAO, { message: `origem deve ser uma de: ${ORIGENS_MOVIMENTACAO.join(', ')}.` }),
    rebanhoId:  z.string().uuid('O ID do rebanho deve ser um UUID válido.').optional().nullable(),
    pastoId:    z.string().uuid('O ID do pasto deve ser um UUID válido.').optional().nullable(),
    observacoes: z.string().max(500, 'Máximo 500 caracteres.').optional().nullable(),
})
    .strict()
    .refine((m) => m.tipo === 'Ajuste' || m.quantidade > 0, {
        message: 'Quantidade deve ser maior que zero para Entrada e Saída.',
        path: ['quantidade'],
    })
    .refine((m) => m.quantidade !== 0, { message: 'A quantidade não pode ser zero.', path: ['quantidade'] });

export default MovimentacaoInsumoCreateSchema;
