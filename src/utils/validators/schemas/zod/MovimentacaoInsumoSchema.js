import { z } from 'zod/v4';

export const TIPOS_MOVIMENTACAO = ['Entrada', 'Saida'];

export const ORIGENS_POR_TIPO = {
    Entrada: ['Compra', 'CadastroInicial', 'Devolucao', 'Outro'],
    Saida: ['ConsumoRebanho', 'Perda', 'Outro'],
};

export const ORIGENS_DO_LEDGER = {
    Entrada: [...ORIGENS_POR_TIPO.Entrada, 'AjusteContagem'],
    Saida: ['ManejoRebanho', 'ManejoPasto', ...ORIGENS_POR_TIPO.Saida, 'AjusteContagem'],
};

const ORIGENS_ACEITAS = [...new Set([...ORIGENS_POR_TIPO.Entrada, ...ORIGENS_POR_TIPO.Saida])];

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

export function problemasDoValor({ tipo, valorTotal }) {
    if (valorTotal == null || tipo === 'Entrada') return [];
    return [{ path: ['valorTotal'], message: 'O valor pago só pode ser informado em entrada de estoque.' }];
}

const valorDaEntrada = z.number({ error: 'O valor total deve ser um número.' })
    .finite('Valor total inválido.')
    .positive('O valor total deve ser maior que zero.')
    .optional()
    .nullable();

const dataNaoFutura = z.coerce.date({ error: 'A data deve ser uma data válida.' })
    .refine((d) => d.getTime() <= Date.now() + 5 * 60 * 1000, { message: 'A data não pode ser no futuro.' });

export const MovimentacaoInsumoCreateSchema = z.object({
    id:         z.string().uuid('O ID deve ser um UUID válido.').optional(),
    insumoId:   z.string().uuid('O ID do insumo deve ser um UUID válido.'),
    tipo:       z.enum([...TIPOS_MOVIMENTACAO, 'Ajuste'], { message: `tipo deve ser um de: ${TIPOS_MOVIMENTACAO.join(', ')}.` }),
    quantidade: z.number({ error: 'A quantidade deve ser um número.' }).finite('Quantidade inválida.'),
    data:       dataNaoFutura,
    origem:     z.enum([...ORIGENS_ACEITAS, 'AjusteContagem'], { message: `origem deve ser uma de: ${ORIGENS_ACEITAS.join(', ')}.` }),
    rebanhoId:  z.string().uuid('O ID do rebanho deve ser um UUID válido.').optional().nullable(),
    pastoId:    z.string().uuid('O ID do pasto deve ser um UUID válido.').optional().nullable(),
    observacoes: z.string().max(500, 'Máximo 500 caracteres.').optional().nullable(),
    valorTotal: valorDaEntrada,
})
    .strict()
    .superRefine((m, ctx) => {
        if (m.tipo === 'Ajuste') {
            if (m.quantidade === 0) {
                ctx.addIssue({ code: 'custom', path: ['quantidade'], message: 'Ajuste sem quantidade não altera o estoque.' });
            }
            const tipoConvertido = m.quantidade > 0 ? 'Entrada' : 'Saida';
            for (const problema of problemasDoValor({ tipo: tipoConvertido, valorTotal: m.valorTotal })) {
                ctx.addIssue({ code: 'custom', ...problema });
            }
            return;
        }

        if (m.quantidade <= 0) {
            ctx.addIssue({ code: 'custom', path: ['quantidade'], message: 'Quantidade deve ser maior que zero.' });
        }

        for (const problema of [...problemasDoMotivo(m), ...problemasDoValor(m)]) {
            ctx.addIssue({ code: 'custom', ...problema });
        }
    })
    .transform((m) => {
        if (m.tipo !== 'Ajuste') return m;
        return {
            ...m,
            tipo: m.quantidade > 0 ? 'Entrada' : 'Saida',
            quantidade: Math.abs(m.quantidade),
            origem: 'AjusteContagem',
        };
    });

export const MovimentacaoInsumoUpdateSchema = z.object({
    quantidade: z.number({ error: 'A quantidade deve ser um número.' })
                  .finite('Quantidade inválida.')
                  .positive('Quantidade deve ser maior que zero.')
                  .optional(),
    data:       dataNaoFutura.optional(),
    origem:     z.enum(ORIGENS_ACEITAS, { message: `origem deve ser uma de: ${ORIGENS_ACEITAS.join(', ')}.` }).optional(),
    observacoes: z.string().max(500, 'Máximo 500 caracteres.').optional().nullable(),
    valorTotal: valorDaEntrada,
})
    .strict()
    .refine((m) => Object.keys(m).length > 0, { message: 'Informe ao menos um campo para editar.' });

export default MovimentacaoInsumoCreateSchema;
