
const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** dias inteiros de `de` até `ate`, nunca negativo. */
function diasEntre(de, ate) {
    return Math.max(0, Math.floor((ate.getTime() - de.getTime()) / MS_POR_DIA));
}

export function calcularSaldoReal(movimentacoes = []) {
    return movimentacoes.reduce((total, m) => {
        if (m.tipo === 'Entrada') return total + m.quantidade;
        if (m.tipo === 'Saida') return total - m.quantidade;
        return total;
    }, 0);
}

export function regimeParaCalculo(r) {
    return {
        rebanhoId: r.rebanhoId,
        quantidadeDia: Number(r.quantidadeDia),
        dataInicio: r.dataInicio,
        dataFim: r.dataFim,
        ativo: r.ativo,
        lancamentoAutomatico: r.lancamentoAutomatico === true,
    };
}

function consumoProjetadoDesde(regimes, marcoDe, agora) {
    return regimes.reduce((total, regime) => {
        if (regime.lancamentoAutomatico) return total;
        const marco = marcoDe(regime);
        const inicioBase = marco && marco > regime.dataInicio ? marco : regime.dataInicio;
        const fim = regime.dataFim && regime.dataFim < agora ? regime.dataFim : agora;
        return total + regime.quantidadeDia * diasEntre(inicioBase, fim);
    }, 0);
}

export function ehMarcoDeConsumo(m) {
    return (m.tipo === 'Saida' && m.origem === 'ConsumoRebanho') || m.origem === 'AjusteContagem';
}

function marcoGeral(m) {
    return m.origem === 'AjusteContagem' || !m.rebanhoId;
}

export function marcoDoRegime(regime, marcos) {
    const geral = marcos?.geral ?? null;
    if (!regime.rebanhoId) return marcos?.maisRecente ?? geral;
    const doRebanho = marcos?.porRebanho?.get(regime.rebanhoId) ?? null;
    if (!geral) return doRebanho;
    if (!doRebanho) return geral;
    return doRebanho > geral ? doRebanho : geral;
}

export function marcosDeConsumo(movimentacoes = []) {
    const marcos = { geral: null, porRebanho: new Map(), maisRecente: null };
    for (const m of movimentacoes) {
        if (!ehMarcoDeConsumo(m)) continue;
        if (!marcos.maisRecente || m.data > marcos.maisRecente) marcos.maisRecente = m.data;
        if (marcoGeral(m)) {
            if (!marcos.geral || m.data > marcos.geral) marcos.geral = m.data;
        } else {
            const atual = marcos.porRebanho.get(m.rebanhoId);
            if (!atual || m.data > atual) marcos.porRebanho.set(m.rebanhoId, m.data);
        }
    }
    return marcos;
}

export function calcularConsumoProjetadoNaoLancado(regimes = [], movimentacoes = [], agora = new Date()) {
    const marcos = marcosDeConsumo(movimentacoes);
    return consumoProjetadoDesde(regimes, (r) => marcoDoRegime(r, marcos), agora);
}

/** soma de `quantidadeDia` dos regimes vigentes hoje. */
export function calcularConsumoDiaTotal(regimes = [], agora = new Date()) {
    return regimes
        .filter((r) => r.ativo !== false && (!r.dataFim || r.dataFim > agora) && r.dataInicio <= agora)
        .reduce((total, r) => total + r.quantidadeDia, 0);
}

function montarPacote({ saldoReal, consumoProjetado, regimes, agora }) {
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

export function calcularSaldos({ movimentacoes = [], regimes = [], agora = new Date() }) {
    return montarPacote({
        saldoReal: calcularSaldoReal(movimentacoes),
        consumoProjetado: calcularConsumoProjetadoNaoLancado(regimes, movimentacoes, agora),
        regimes,
        agora,
    });
}

export function calcularSaldosComResumo({ resumo, regimes = [], agora = new Date() }) {
    const saldoReal = (resumo?.entrada ?? 0) - (resumo?.saida ?? 0);
    const marcos = marcosDeConsumo((resumo?.marcos ?? []).map((m) => ({ ...m, tipo: 'Saida' })));
    return montarPacote({
        saldoReal,
        consumoProjetado: consumoProjetadoDesde(regimes, (r) => marcoDoRegime(r, marcos), agora),
        regimes,
        agora,
    });
}
