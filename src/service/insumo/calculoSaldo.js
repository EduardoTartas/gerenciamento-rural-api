// src/service/insumo/calculoSaldo.js
//
// Lógica pura de estoque de insumo. O service converte Prisma.Decimal para
// Number e passa Date antes de chamar qualquer função daqui.

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Dias inteiros de `de` até `ate`, nunca negativo. */
function diasEntre(de, ate) {
    return Math.max(0, Math.floor((ate.getTime() - de.getTime()) / MS_POR_DIA));
}

/**
 * Saldo pelo ledger: entradas menos saídas. Desde a issue #67 não existe mais
 * ajuste assinado — a contagem antiga virou entrada ou saída (pelo sinal) com
 * origem `AjusteContagem` na migration `estoque_sem_contagem`.
 */
export function calcularSaldoReal(movimentacoes = []) {
    return movimentacoes.reduce((total, m) => {
        if (m.tipo === 'Entrada') return total + m.quantidade;
        if (m.tipo === 'Saida') return total - m.quantidade;
        return total;
    }, 0);
}

/**
 * Consumo dos regimes desde o marco de cada um (ou desde o início do regime, o
 * que for mais recente) até `agora`, respeitando o `dataFim` de cada regime.
 *
 * @param {(regime) => Date|null} marcoDe marco de consumo que vale para o regime
 */
function consumoProjetadoDesde(regimes, marcoDe, agora) {
    return regimes.reduce((total, regime) => {
        const marco = marcoDe(regime);
        const inicioBase = marco && marco > regime.dataInicio ? marco : regime.dataInicio;
        const fim = regime.dataFim && regime.dataFim < agora ? regime.dataFim : agora;
        return total + regime.quantidadeDia * diasEntre(inicioBase, fim);
    }, 0);
}

/**
 * Marca o fim da estimativa de consumo: a partir dela, o que os regimes
 * consumiram ainda não está no ledger.
 *
 * - Saída `ConsumoRebanho`: o produtor lançou o consumo real, que encerra a
 *   estimativa até ali — contar de novo o mesmo período dobraria o consumo.
 * - `AjusteContagem` (contagem antiga, de qualquer tipo): era conferência
 *   física do estoque, o saldo dali já incluía tudo que foi consumido.
 *
 * Compra, perda, devolução, "Outro" e manejo **não** são marco: uma compra não
 * diz nada sobre quanto o rebanho já comeu (issue #67). Usar qualquer
 * movimentação fazia uma compra apagar consumo ainda não lançado.
 */
export function ehMarcoDeConsumo(m) {
    return (m.tipo === 'Saida' && m.origem === 'ConsumoRebanho') || m.origem === 'AjusteContagem';
}

/**
 * O marco vale para todos os regimes do insumo, e não só para o do mesmo rebanho?
 *
 * Desde a issue #72 o consumo lançado encerra a estimativa **só do rebanho dele**:
 * com o lançamento automático, o consumo de um lote é lançado sozinho enquanto o
 * de outro lote continua manual, e um marco do insumo inteiro apagaria o consumo
 * ainda não lançado do lote manual. A contagem antiga (`AjusteContagem`) e a
 * saída de consumo sem rebanho (anterior à issue #63) continuam valendo para
 * todos: eram conferência ou lançamento do insumo como um todo.
 */
function marcoGeral(m) {
    return m.origem === 'AjusteContagem' || !m.rebanhoId;
}

/**
 * Marco de consumo que vale para cada regime, a partir dos marcos agregados:
 * o mais recente entre o geral e o do rebanho do regime. Regime sem `rebanhoId`
 * (chamada antiga) aceita qualquer marco.
 *
 * @param {{ geral: Date|null, porRebanho: Map<string, Date> }} marcos
 */
export function marcoDoRegime(regime, marcos) {
    const geral = marcos?.geral ?? null;
    if (!regime.rebanhoId) return marcos?.maisRecente ?? geral;
    const doRebanho = marcos?.porRebanho?.get(regime.rebanhoId) ?? null;
    if (!geral) return doRebanho;
    if (!doRebanho) return geral;
    return doRebanho > geral ? doRebanho : geral;
}

/** Agrega os marcos de consumo de uma lista de movimentações (ver `marcoDoRegime`). */
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

/**
 * Consumo dos regimes ainda não lançado no ledger, desde o marco de cada regime
 * (ver `ehMarcoDeConsumo` e `marcoDoRegime`) ou desde o início dele, o que for
 * mais recente.
 */
export function calcularConsumoProjetadoNaoLancado(regimes = [], movimentacoes = [], agora = new Date()) {
    const marcos = marcosDeConsumo(movimentacoes);
    return consumoProjetadoDesde(regimes, (r) => marcoDoRegime(r, marcos), agora);
}

/** Soma de `quantidadeDia` dos regimes vigentes hoje. */
export function calcularConsumoDiaTotal(regimes = [], agora = new Date()) {
    return regimes
        .filter((r) => r.ativo !== false && (!r.dataFim || r.dataFim > agora) && r.dataInicio <= agora)
        .reduce((total, r) => total + r.quantidadeDia, 0);
}

/** Monta o pacote de saldo a partir do saldo real e do consumo projetado já apurados. */
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

/** Pacote completo exibido na leitura de um insumo (ledger cru — usado no findById). */
export function calcularSaldos({ movimentacoes = [], regimes = [], agora = new Date() }) {
    return montarPacote({
        saldoReal: calcularSaldoReal(movimentacoes),
        consumoProjetado: calcularConsumoProjetadoNaoLancado(regimes, movimentacoes, agora),
        regimes,
        agora,
    });
}

/**
 * Mesma matemática de `calcularSaldos`, mas a partir do ledger já agregado no
 * banco: uma soma por tipo e os marcos de consumo (geral e por rebanho). Evita
 * trazer todas as linhas de `movimentacoes_insumo` na listagem (issue #37).
 *
 * @param {{ entrada: number, saida: number, marcos: Array<{ origem: string, rebanhoId: string|null, data: Date }> }} resumo
 *   `marcos`: o último marco de cada (rebanho, origem), já filtrado como marco
 */
export function calcularSaldosComResumo({ resumo, regimes = [], agora = new Date() }) {
    const saldoReal = (resumo?.entrada ?? 0) - (resumo?.saida ?? 0);
    // As linhas já são marcos; `tipo: 'Saida'` só para o filtro reconhecer o
    // consumo do rebanho (a contagem antiga vale por qualquer tipo).
    const marcos = marcosDeConsumo((resumo?.marcos ?? []).map((m) => ({ ...m, tipo: 'Saida' })));
    return montarPacote({
        saldoReal,
        consumoProjetado: consumoProjetadoDesde(regimes, (r) => marcoDoRegime(r, marcos), agora),
        regimes,
        agora,
    });
}
