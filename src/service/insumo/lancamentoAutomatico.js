
import { marcoDoRegime, marcosDeConsumo } from './calculoSaldo.js';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export const TETO_DE_DIAS_POR_EXECUCAO = 400;

export const OBSERVACAO_AUTOMATICA = 'Lançamento automático do consumo diário.';

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
