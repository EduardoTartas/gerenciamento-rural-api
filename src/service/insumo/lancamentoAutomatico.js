// src/service/insumo/lancamentoAutomatico.js
//
// Lançamento automático do consumo diário (issue #72). Lógica pura: recebe os
// regimes automáticos de um insumo e o ledger dele, e devolve as saídas que
// faltam lançar. Quem grava é o `LancamentoAutomaticoService`.

import { calcularSaldoReal, marcoDoRegime, marcosDeConsumo } from './calculoSaldo.js';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Teto de dias lançados por regime numa execução: ligar o automático num
 * regime antigo lança o atraso aos poucos, sem uma transação gigante.
 */
export const TETO_DE_DIAS_POR_EXECUCAO = 400;

export const OBSERVACAO_AUTOMATICA = 'Lançamento automático do consumo diário.';

/**
 * Saídas `ConsumoRebanho` que faltam para cada regime automático.
 *
 * Mesma conta do consumo projetado (`calculoSaldo.js`): a partir do marco do
 * rebanho (ou do início do regime, o que for mais recente), uma saída a cada
 * 24 h completas, até `agora` e até o `dataFim`. Como cada saída é um marco do
 * rebanho, a estimativa volta a contar exatamente de onde o último lançamento
 * parou — e rodar de novo não acha nada a lançar.
 *
 * Nunca lança mais do que o saldo real: com estoque insuficiente lança o que
 * resta e para; o insumo fica esgotado e a notificação avisa.
 *
 * @param {Array<{ id, insumoId, rebanhoId, quantidadeDia: number, dataInicio: Date, dataFim: Date|null }>} regimes
 * @param {Array<{ tipo, quantidade: number, origem, data: Date, rebanhoId }>} movimentacoes ledger ativo do insumo
 */
export function planejarLancamentos(regimes = [], movimentacoes = [], agora = new Date()) {
    let saldo = calcularSaldoReal(movimentacoes);
    const marcos = marcosDeConsumo(movimentacoes);
    const ordenados = [...regimes].sort((a, b) => a.dataInicio - b.dataInicio);
    const lancamentos = [];

    for (const regime of ordenados) {
        if (!(regime.quantidadeDia > 0)) continue;
        const marco = marcoDoRegime(regime, marcos);
        const base = marco && marco > regime.dataInicio ? marco : regime.dataInicio;
        const fim = regime.dataFim && regime.dataFim < agora ? regime.dataFim : agora;
        const dias = Math.min(
            TETO_DE_DIAS_POR_EXECUCAO,
            Math.max(0, Math.floor((fim.getTime() - base.getTime()) / MS_POR_DIA)),
        );

        for (let k = 1; k <= dias && saldo > 0; k++) {
            const quantidade = Math.min(regime.quantidadeDia, saldo);
            lancamentos.push({
                insumoId: regime.insumoId,
                rebanhoId: regime.rebanhoId,
                regimeConsumoId: regime.id,
                tipo: 'Saida',
                origem: 'ConsumoRebanho',
                quantidade,
                data: new Date(base.getTime() + k * MS_POR_DIA),
                observacoes: OBSERVACAO_AUTOMATICA,
            });
            saldo -= quantidade;
        }
    }
    return lancamentos;
}
