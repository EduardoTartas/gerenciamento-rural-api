// src/utils/validators/schemas/zod/MovimentacaoInsumoSchema.js
import { z } from 'zod/v4';

/**
 * O estoque só muda por entrada ou saída, sempre com motivo (issue #67). A
 * antiga contagem (`Ajuste`/`AjusteContagem`) sobrescrevia o saldo sem explicar
 * a diferença.
 */
export const TIPOS_MOVIMENTACAO = ['Entrada', 'Saida'];

/**
 * Motivos (`origem`) aceitos por tipo neste endpoint. `ManejoRebanho` e
 * `ManejoPasto` são saídas válidas do ledger, mas só nascem pelo fluxo de
 * manejo — nunca por este endpoint, como antes.
 */
export const ORIGENS_POR_TIPO = {
    Entrada: ['Compra', 'CadastroInicial', 'Devolucao', 'Outro'],
    Saida: ['ConsumoRebanho', 'Perda', 'Outro'],
};

/**
 * Todas as origens que existem no ledger, inclusive as geradas pelo manejo e a
 * `AjusteContagem` legada (contagem antiga convertida — só leitura, nunca
 * lançada de novo por aqui).
 */
export const ORIGENS_DO_LEDGER = {
    Entrada: [...ORIGENS_POR_TIPO.Entrada, 'AjusteContagem'],
    Saida: ['ManejoRebanho', 'ManejoPasto', ...ORIGENS_POR_TIPO.Saida, 'AjusteContagem'],
};

const ORIGENS_ACEITAS = [...new Set([...ORIGENS_POR_TIPO.Entrada, ...ORIGENS_POR_TIPO.Saida])];

export const MovimentacaoInsumoCreateSchema = z.object({
    id:         z.string().uuid('O ID deve ser um UUID válido.').optional(),
    insumoId:   z.string().uuid('O ID do insumo deve ser um UUID válido.'),
    // `Ajuste` só entra para ser convertido (app antigo com contagem na fila);
    // nunca é gravado. Ver o `transform` abaixo.
    tipo:       z.enum([...TIPOS_MOVIMENTACAO, 'Ajuste'], { message: `tipo deve ser um de: ${TIPOS_MOVIMENTACAO.join(', ')}.` }),
    quantidade: z.number({ error: 'A quantidade deve ser um número.' }).finite('Quantidade inválida.'),
    data:       z.coerce.date({ error: 'A data deve ser uma data válida.' })
                  // Tolera +5 min: o app offline grava com o relógio do celular,
                  // que pode estar alguns segundos à frente do servidor.
                  .refine((d) => d.getTime() <= Date.now() + 5 * 60 * 1000, { message: 'A data não pode ser no futuro.' }),
    origem:     z.enum([...ORIGENS_ACEITAS, 'AjusteContagem'], { message: `origem deve ser uma de: ${ORIGENS_ACEITAS.join(', ')}.` }),
    rebanhoId:  z.string().uuid('O ID do rebanho deve ser um UUID válido.').optional().nullable(),
    pastoId:    z.string().uuid('O ID do pasto deve ser um UUID válido.').optional().nullable(),
    observacoes: z.string().max(500, 'Máximo 500 caracteres.').optional().nullable(),
})
    .strict()
    .superRefine((m, ctx) => {
        if (m.tipo === 'Ajuste') {
            if (m.quantidade === 0) {
                ctx.addIssue({ code: 'custom', path: ['quantidade'], message: 'Ajuste sem quantidade não altera o estoque.' });
            }
            return;
        }

        if (m.quantidade <= 0) {
            ctx.addIssue({ code: 'custom', path: ['quantidade'], message: 'Quantidade deve ser maior que zero.' });
        }

        const aceitas = ORIGENS_POR_TIPO[m.tipo];
        if (!aceitas.includes(m.origem)) {
            ctx.addIssue({
                code: 'custom',
                path: ['origem'],
                message: `Motivo inválido para ${m.tipo === 'Entrada' ? 'entrada' : 'saída'}. Use: ${aceitas.join(', ')}.`,
            });
        }

        if (m.origem === 'Outro' && !m.observacoes?.trim()) {
            ctx.addIssue({ code: 'custom', path: ['observacoes'], message: 'Descreva o motivo nas observações quando escolher "Outro".' });
        }
    })
    // Compatibilidade (issue #67): o app antigo ainda pode ter uma contagem na
    // fila offline. Recusar travaria a fila; a contagem vira entrada ou saída
    // pelo sinal, com origem `AjusteContagem` — é uma conferência física de
    // verdade e continua valendo como marco da projeção. Igual à conversão da
    // migration `estoque_sem_contagem`. Lançamento NOVO com `AjusteContagem`
    // (sem `tipo: Ajuste`) é recusado no `superRefine` acima.
    .transform((m) => {
        if (m.tipo !== 'Ajuste') return m;
        return {
            ...m,
            tipo: m.quantidade > 0 ? 'Entrada' : 'Saida',
            quantidade: Math.abs(m.quantidade),
            origem: 'AjusteContagem',
        };
    });

export default MovimentacaoInsumoCreateSchema;
