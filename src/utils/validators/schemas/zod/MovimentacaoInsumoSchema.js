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

/**
 * Regra do motivo, compartilhada entre o lançamento (POST) e a edição (PATCH):
 * a `origem` tem que caber no `tipo`, e "Outro" exige observação. Na edição o
 * `tipo` vem da movimentação gravada e `origem`/`observacoes` do resultado do
 * merge, então a regra não pode morar só no `superRefine` do corpo.
 *
 * @returns {{path: string[], message: string}[]}
 */
export function problemasDoMotivo({ tipo, origem, observacoes }) {
    const problemas = [];
    const aceitas = ORIGENS_POR_TIPO[tipo] ?? [];
    if (!aceitas.includes(origem)) {
        problemas.push({
            path: ['origem'],
            message: `Motivo inválido para ${tipo === 'Entrada' ? 'entrada' : 'saída'}. Use: ${aceitas.join(', ')}.`,
        });
    }
    if (origem === 'Outro' && !observacoes?.trim()) {
        problemas.push({ path: ['observacoes'], message: 'Descreva o motivo nas observações quando escolher "Outro".' });
    }
    return problemas;
}

const dataNaoFutura = z.coerce.date({ error: 'A data deve ser uma data válida.' })
    // Tolera +5 min: o app offline grava com o relógio do celular,
    // que pode estar alguns segundos à frente do servidor.
    .refine((d) => d.getTime() <= Date.now() + 5 * 60 * 1000, { message: 'A data não pode ser no futuro.' });

export const MovimentacaoInsumoCreateSchema = z.object({
    id:         z.string().uuid('O ID deve ser um UUID válido.').optional(),
    insumoId:   z.string().uuid('O ID do insumo deve ser um UUID válido.'),
    // `Ajuste` só entra para ser convertido (app antigo com contagem na fila);
    // nunca é gravado. Ver o `transform` abaixo.
    tipo:       z.enum([...TIPOS_MOVIMENTACAO, 'Ajuste'], { message: `tipo deve ser um de: ${TIPOS_MOVIMENTACAO.join(', ')}.` }),
    quantidade: z.number({ error: 'A quantidade deve ser um número.' }).finite('Quantidade inválida.'),
    data:       dataNaoFutura,
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

        for (const problema of problemasDoMotivo(m)) {
            ctx.addIssue({ code: 'custom', ...problema });
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

/**
 * Edição de um lançamento (issue #68). Só o que o produtor corrige:
 * quantidade, data, motivo e observações. `insumoId` e `tipo` não mudam —
 * trocar o insumo ou inverter entrada/saída é outro lançamento — e o
 * `.strict()` recusa com 400. A regra do motivo depende do `tipo` gravado, por
 * isso é conferida no service com `problemasDoMotivo`, depois do merge.
 */
export const MovimentacaoInsumoUpdateSchema = z.object({
    quantidade: z.number({ error: 'A quantidade deve ser um número.' })
                  .finite('Quantidade inválida.')
                  .positive('Quantidade deve ser maior que zero.')
                  .optional(),
    data:       dataNaoFutura.optional(),
    origem:     z.enum(ORIGENS_ACEITAS, { message: `origem deve ser uma de: ${ORIGENS_ACEITAS.join(', ')}.` }).optional(),
    observacoes: z.string().max(500, 'Máximo 500 caracteres.').optional().nullable(),
})
    .strict()
    .refine((m) => Object.keys(m).length > 0, { message: 'Informe ao menos um campo para editar.' });

export default MovimentacaoInsumoCreateSchema;
