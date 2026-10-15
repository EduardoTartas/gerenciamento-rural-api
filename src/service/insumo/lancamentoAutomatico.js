// src/service/insumo/lancamentoAutomatico.js
//
// Lançamento automático do consumo diário (issue #72). Lógica pura: recebe os
// regimes automáticos de um insumo e o ledger dele, e devolve as saídas que
// faltam lançar. Quem grava é o `LancamentoAutomaticoService`.

import { marcoDoRegime, marcosDeConsumo } from './calculoSaldo.js';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Teto de dias olhados por regime numa execução: os mais recentes. Ligar o
 * automático num regime muito antigo não monta uma transação gigante.
 */
export const TETO_DE_DIAS_POR_EXECUCAO = 400;

export const OBSERVACAO_AUTOMATICA = 'Lançamento automático do consumo diário.';

/**
 * Quanto do insumo dá para lançar no instante `t` sem deixar o estoque
 * negativo em nenhum momento dali em diante: o menor saldo do ledger de `t`
 * para frente. Só conta o que tem data até cada ponto — compra registrada
 * hoje não cobre consumo de ontem.
 *
 * @param {Array<{ data: Date, delta: number }>} eventos ledger em ordem de data
 */
function disponivelEm(eventos, t) {
    let saldo = 0;
    let i = 0;
    for (; i < eventos.length && eventos[i].data <= t; i++) saldo += eventos[i].delta;
    let minimo = saldo;
    for (; i < eventos.length; i++) {
        saldo += eventos[i].delta;
        if (saldo < minimo) minimo = saldo;
    }
    return minimo;
}

/**
 * Saídas `ConsumoRebanho` que faltam para cada regime automático.
 *
 * Mesma conta do consumo projetado (`calculoSaldo.js`): a partir do marco do
 * rebanho (ou do início do regime, o que for mais recente), uma saída a cada
 * 24 h completas, até `agora` e até o `dataFim`. Como cada saída é um marco do
 * rebanho, a contagem volta exatamente de onde o último lançamento parou — e
 * rodar de novo não acha nada a lançar.
 *
 * Só lança o dia em que havia estoque (issue #73): o saldo daquele instante,
 * sem deixar o estoque negativo depois (ver `disponivelEm`). Com estoque
 * insuficiente lança o que resta; dia sem estoque fica sem lançamento — o
 * lote não comeu o que não havia. Quando entra estoque, volta a lançar a
 * partir da data da entrada. Os dias de todos os regimes seguem em ordem de
 * data, e o estoque vai para quem consumiu primeiro.
 *
 * @param {Array<{ id, insumoId, rebanhoId, quantidadeDia: number, dataInicio: Date, dataFim: Date|null }>} regimes
 * @param {Array<{ tipo, quantidade: number, origem, data: Date, rebanhoId }>} movimentacoes ledger ativo do insumo
 */
export function planejarLancamentos(regimes = [], movimentacoes = [], agora = new Date()) {
    const marcos = marcosDeConsumo(movimentacoes);
    const eventos = movimentacoes
        .map((m) => ({
            data: m.data,
            delta: m.tipo === 'Entrada' ? m.quantidade : m.tipo === 'Saida' ? -m.quantidade : 0,
        }))
        .sort((a, b) => a.data - b.data);

    const dias = [];
    for (const regime of regimes) {
        if (!(regime.quantidadeDia > 0)) continue;
        const marco = marcoDoRegime(regime, marcos);
        const base = marco && marco > regime.dataInicio ? marco : regime.dataInicio;
        const fim = regime.dataFim && regime.dataFim < agora ? regime.dataFim : agora;
        const total = Math.max(0, Math.floor((fim.getTime() - base.getTime()) / MS_POR_DIA));
        // Só os dias mais recentes: um período longo sem estoque não prende a
        // contagem num ponto antigo.
        for (let k = Math.max(1, total - TETO_DE_DIAS_POR_EXECUCAO + 1); k <= total; k++) {
            dias.push({ regime, data: new Date(base.getTime() + k * MS_POR_DIA) });
        }
    }
    dias.sort((a, b) => a.data - b.data);

    const lancamentos = [];
    let lancado = 0;
    for (const { regime, data } of dias) {
        const quantidade = Math.min(regime.quantidadeDia, disponivelEm(eventos, data) - lancado);
        if (!(quantidade > 0)) continue;
        lancamentos.push({
            insumoId: regime.insumoId,
            rebanhoId: regime.rebanhoId,
            regimeConsumoId: regime.id,
            tipo: 'Saida',
            origem: 'ConsumoRebanho',
            quantidade,
            data,
            observacoes: OBSERVACAO_AUTOMATICA,
        });
        lancado += quantidade;
    }
    return lancamentos;
}
