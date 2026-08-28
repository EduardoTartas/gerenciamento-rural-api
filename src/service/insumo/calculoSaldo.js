// src/service/insumo/calculoSaldo.js
//
// Lógica pura de estoque de insumo. O service converte Prisma.Decimal para
// Number e passa Date antes de chamar qualquer função daqui.

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Dias inteiros de `de` até `ate`, nunca negativo. */
function diasEntre(de, ate) {
    return Math.max(0, Math.floor((ate.getTime() - de.getTime()) / MS_POR_DIA));
}

/** Saldo pelo ledger: Entrada soma, Saida subtrai, Ajuste entra com o sinal dado. */
export function calcularSaldoReal(movimentacoes = []) {
    return movimentacoes.reduce((total, m) => {
        if (m.tipo === 'Entrada') return total + m.quantidade;
        if (m.tipo === 'Saida') return total - m.quantidade;
        return total + m.quantidade; // Ajuste
    }, 0);
}

/**
 * Consumo dos regimes ainda não lançado no ledger, desde a última contagem
 * física (movimentação de origem `AjusteContagem`) ou desde o início de cada
 * regime, o que for mais recente.
 */
export function calcularConsumoProjetadoNaoLancado(regimes = [], movimentacoes = [], agora = new Date()) {
    const contagens = movimentacoes
        .filter((m) => m.origem === 'AjusteContagem')
        .map((m) => m.data.getTime());
    const marco = contagens.length ? new Date(Math.max(...contagens)) : null;

    return regimes.reduce((total, regime) => {
        const inicioBase = marco && marco > regime.dataInicio ? marco : regime.dataInicio;
        const fim = regime.dataFim && regime.dataFim < agora ? regime.dataFim : agora;
        return total + regime.quantidadeDia * diasEntre(inicioBase, fim);
    }, 0);
}

/** Soma de `quantidadeDia` dos regimes vigentes hoje. */
export function calcularConsumoDiaTotal(regimes = [], agora = new Date()) {
    return regimes
        .filter((r) => r.ativo !== false && (!r.dataFim || r.dataFim > agora) && r.dataInicio <= agora)
        .reduce((total, r) => total + r.quantidadeDia, 0);
}

/** Pacote completo exibido na leitura de um insumo. */
export function calcularSaldos({ movimentacoes = [], regimes = [], agora = new Date() }) {
    const saldoReal = calcularSaldoReal(movimentacoes);
    const consumoProjetado = calcularConsumoProjetadoNaoLancado(regimes, movimentacoes, agora);
    const saldoProjetado = saldoReal - consumoProjetado;
    const consumoDiaTotal = calcularConsumoDiaTotal(regimes, agora);

    let diasRestantes = null;
    let previsaoTermino = null;
    const esgotado = saldoProjetado <= 0;

    if (consumoDiaTotal > 0) {
        diasRestantes = saldoProjetado / consumoDiaTotal;
        if (!esgotado) {
            previsaoTermino = new Date(agora.getTime() + diasRestantes * MS_POR_DIA).toISOString();
        }
    }

    return { saldoReal, consumoProjetado, saldoProjetado, consumoDiaTotal, diasRestantes, previsaoTermino, esgotado };
}
