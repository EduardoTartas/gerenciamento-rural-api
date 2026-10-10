// src/service/notificacao/regras.js
//
// Regras puras dos avisos da fazenda (issue #62). As mesmas que o app já
// calcula localmente na Home e nas fichas — aqui elas rodam no servidor para o
// produtor ser avisado com o app fechado. Recebem os dados já lidos e
// convertidos (Decimal → Number); não tocam no banco.

export const TIPOS = Object.freeze({
    PASTO_PRONTO: 'PASTO_PRONTO',
    INSUMO_ACABANDO: 'INSUMO_ACABANDO',
    INSUMO_ABAIXO_MINIMO: 'INSUMO_ABAIXO_MINIMO',
    INSUMO_ESGOTADO: 'INSUMO_ESGOTADO',
    OCUPACAO_LONGA: 'OCUPACAO_LONGA',
    LOTACAO_ALTA: 'LOTACAO_ALTA',
    PASTO_PRONTO_AMANHA: 'PASTO_PRONTO_AMANHA',
    LOTE_SEM_PASTO: 'LOTE_SEM_PASTO',
    LOTE_SEM_PESAGEM: 'LOTE_SEM_PESAGEM',
    RESUMO_MES: 'RESUMO_MES',
    // Dados faltando: avisam uma vez por item e só na caixa.
    PASTO_SEM_AREA: 'PASTO_SEM_AREA',
    LOTE_SEM_VALOR_COMPRA: 'LOTE_SEM_VALOR_COMPRA',
    INSUMO_SEM_PRECO: 'INSUMO_SEM_PRECO',
});

/**
 * Dados faltando: não são urgência, então não geram push (só caixa) e avisam
 * uma vez por item — resolvido, não reabre, para não insistir com quem
 * decidiu não preencher.
 */
export const TIPOS_DADOS_FALTANDO = Object.freeze([
    TIPOS.PASTO_SEM_AREA,
    TIPOS.LOTE_SEM_VALOR_COMPRA,
    TIPOS.INSUMO_SEM_PRECO,
]);

/**
 * O resumo do mês é um evento, não uma situação que persiste: a chave já leva
 * o mês, e ele não se "resolve" no dia seguinte.
 */
export const TIPOS_SEM_RESOLUCAO = Object.freeze([TIPOS.RESUMO_MES]);

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Descanso de referência quando nem o pasto nem a forrageira informam (app: `diasDescansoAlvo`). */
export const DIAS_DESCANSO_PADRAO = 30;
/** Insumo "acabando": previsão de término em até tantos dias. */
export const DIAS_ALERTA_INSUMO = 7;
/** Ocupação recomendada do piquete (app: `Lotacao.diasOcupacaoReferencia`). */
export const DIAS_OCUPACAO_REFERENCIA = 7;
/** Lotação de referência da fazenda, em UA/ha (app: `Lotacao.tetoDeReferencia`). */
export const TETO_LOTACAO_UA_HA = 2.0;
/** Uma unidade animal = 450 kg de peso vivo. */
export const KG_POR_UA = 450;
/** Lote sem pesagem há mais que isso: peso médio e lotação ficam suspeitos. */
export const DIAS_SEM_PESAGEM = 60;

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const umaCasa = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function dias(n) {
    return n === 1 ? '1 dia' : `${n} dias`;
}

function cabecas(n) {
    return n === 1 ? '1 cabeça' : `${numero.format(n)} cabeças`;
}

/**
 * Peso médio estimado de um lote sem peso informado, pelo sistema de produção
 * — a mesma tabela de `Lotacao.pesoEstimadoKg` do app.
 */
export function pesoEstimadoKg(sistemaProducao) {
    const nome = (sistemaProducao ?? '').trim().toLowerCase();
    if (nome === 'cria') return 400;
    if (nome === 'recria') return 300;
    if (nome.startsWith('engorda') || nome.includes('termina')) return 450;
    if (nome.startsWith('ciclo')) return 350;
    if (nome.startsWith('leit')) return 450;
    return KG_POR_UA;
}

/** UA de um lote: cabeças × peso médio (ou estimado) ÷ 450. Lote sem cabeças não conta. */
export function unidadesAnimais(lote) {
    const cabecas = lote.quantidadeCabecas ?? 0;
    if (cabecas <= 0) return 0;
    const peso = lote.pesoMedioAtual != null && lote.pesoMedioAtual > 0
        ? lote.pesoMedioAtual
        : pesoEstimadoKg(lote.sistemaProducao);
    return (cabecas * peso) / KG_POR_UA;
}

/**
 * Situações da fazenda que pedem aviso agora. Cada item tem a `chave` da
 * situação (`<usuario>:<tipo>:<entidade>`) — a mesma enquanto ela persistir,
 * que é o que impede notificar de novo a cada verificação.
 *
 * @param {object} p
 * @param {string} p.usuarioId
 * @param {Array} p.fazendas  propriedades com `pastos` e `rebanhos`
 * @param {Array} p.insumos   `{ id, nome, unidadeMedida, propriedadeId, estoqueMinimo, teveEntrada, saldo }`
 * @param {Array} p.lotesSemValorCompra  lotes vendidos/finalizados sem `valorCompra`: `{ id, nomeRebanho, propriedadeId }`
 * @param {Array} p.insumosSemPreco      insumos com consumo no mês e nenhuma entrada com valor: `{ id, nome, propriedadeId }`
 * @param {object|null} p.resumoMes      só no dia 1: `{ referencia: 'AAAA-MM', nomeMes, fazendas: [{ propriedadeId, nome, cabecasVendidas, receita, cabecasSaidas }] }`
 * @param {Date}  p.agora
 */
export function avaliarSituacoes({
    usuarioId, fazendas = [], insumos = [], lotesSemValorCompra = [], insumosSemPreco = [],
    resumoMes = null, agora = new Date(),
}) {
    const situacoes = [];
    const nova = (tipo, entidade, entidadeId, propriedadeId, rota, titulo, mensagem, chave = `${usuarioId}:${tipo}:${entidadeId}`) =>
        situacoes.push({
            chave,
            tipo, entidade, entidadeId, propriedadeId, rota, titulo, mensagem,
            push: !TIPOS_DADOS_FALTANDO.includes(tipo),
        });

    for (const fazenda of fazendas) {
        const nomesDosPastos = new Map(fazenda.pastos.map((p) => [p.id, p.nome]));

        // Descanso do pasto acabou: em descanso há pelo menos os dias dele (ajuste
        // do pasto, senão da forrageira, senão a referência) — `descansoConcluido`
        // do app. Sem data de saída não dá para afirmar há quanto tempo descansa.
        for (const pasto of fazenda.pastos) {
            if (pasto.status !== 'Descanso' || !pasto.dataUltimaSaida) continue;
            const alvo = pasto.diasDescanso ?? pasto.tipoPastagem?.diasDescanso ?? DIAS_DESCANSO_PADRAO;
            const emDescanso = (agora.getTime() - pasto.dataUltimaSaida.getTime()) / MS_POR_DIA;
            if (emDescanso >= alvo) {
                nova(TIPOS.PASTO_PRONTO, 'pasto', pasto.id, fazenda.id, `/pastos/${pasto.id}`,
                    `${pasto.nome} pronto para receber gado`,
                    `O descanso de ${dias(alvo)} terminou. O pasto já pode receber um lote.`);
            } else if (alvo - emDescanso <= 1) {
                // Último dia de descanso: aviso de véspera, que se encerra
                // sozinho quando o PASTO_PRONTO nasce.
                nova(TIPOS.PASTO_PRONTO_AMANHA, 'pasto', pasto.id, fazenda.id, `/pastos/${pasto.id}`,
                    `${pasto.nome} termina o descanso amanhã`,
                    'Planeje a mudança do lote.');
            }
        }

        // Pasto sem área fica fora da lotação da fazenda.
        for (const pasto of fazenda.pastos) {
            if (pasto.extensaoHa > 0) continue;
            nova(TIPOS.PASTO_SEM_AREA, 'pasto', pasto.id, fazenda.id, `/pastos/${pasto.id}`,
                `${pasto.nome} sem área cadastrada`,
                'Sem a área, o pasto fica fora do cálculo de lotação. Informe os hectares.');
        }

        // Lote sem pasto e lote sem pesagem recente (pesagem = manejo com
        // `pesoRegistrado`; nunca pesado conta da criação do lote).
        for (const lote of fazenda.rebanhos) {
            if (!lote.pastoAtualId) {
                nova(TIPOS.LOTE_SEM_PASTO, 'rebanho', lote.id, fazenda.id, `/rebanhos/${lote.id}`,
                    `${lote.nomeRebanho} está sem pasto`,
                    'Vincule o lote a um pasto para acompanhar a ocupação e a lotação.');
            }

            const base = lote.ultimaPesagem ?? lote.createdAt;
            const semPesar = base ? Math.floor((agora.getTime() - base.getTime()) / MS_POR_DIA) : 0;
            if (semPesar > DIAS_SEM_PESAGEM) {
                nova(TIPOS.LOTE_SEM_PESAGEM, 'rebanho', lote.id, fazenda.id, `/rebanhos/${lote.id}`,
                    lote.ultimaPesagem
                        ? `${lote.nomeRebanho} sem pesagem há ${dias(semPesar)}`
                        : `${lote.nomeRebanho} nunca foi pesado`,
                    'O peso médio e a lotação podem estar desatualizados. Registre uma pesagem.');
            }
        }

        // Lote há muito tempo no mesmo piquete.
        for (const lote of fazenda.rebanhos) {
            if (!lote.pastoAtualId || !lote.dataEntradaPastoAtual) continue;
            const noPiquete = Math.floor((agora.getTime() - lote.dataEntradaPastoAtual.getTime()) / MS_POR_DIA);
            if (noPiquete <= DIAS_OCUPACAO_REFERENCIA) continue;
            const pasto = nomesDosPastos.get(lote.pastoAtualId) ?? 'mesmo piquete';
            nova(TIPOS.OCUPACAO_LONGA, 'rebanho', lote.id, fazenda.id, `/rebanhos/${lote.id}`,
                `${lote.nomeRebanho} há ${dias(noPiquete)} no ${pasto}`,
                `O lote passou dos ${DIAS_OCUPACAO_REFERENCIA} dias no mesmo piquete. Avalie mudar de pasto para o capim descansar.`);
        }

        // Lotação da fazenda: UA de todos os lotes ativos ÷ área dos pastos com área.
        const hectares = fazenda.pastos.reduce((soma, p) => soma + (p.extensaoHa > 0 ? p.extensaoHa : 0), 0);
        const ua = fazenda.rebanhos.reduce((soma, l) => soma + unidadesAnimais(l), 0);
        if (hectares > 0 && ua / hectares > TETO_LOTACAO_UA_HA) {
            nova(TIPOS.LOTACAO_ALTA, 'propriedade', fazenda.id, fazenda.id, '/pastos',
                `Lotação alta na ${fazenda.nome}`,
                `A fazenda está com ${umaCasa.format(ua / hectares)} UA/ha, acima da referência de ${umaCasa.format(TETO_LOTACAO_UA_HA)} UA/ha. Avalie a carga dos pastos.`);
        }
    }

    // Estoque: um aviso por insumo, o mais grave (esgotado > abaixo do mínimo >
    // acabando). Trocar de gravidade troca a chave: o aviso antigo se encerra e
    // nasce o novo. Insumo sem nenhuma entrada ainda não tem estoque a acabar.
    for (const insumo of insumos) {
        if (!insumo.teveEntrada) continue;
        const { saldoProjetado, consumoDiaTotal, diasRestantes } = insumo.saldo;
        const un = insumo.unidadeMedida;
        const rota = `/insumos/${insumo.id}`;

        if (saldoProjetado <= 0) {
            nova(TIPOS.INSUMO_ESGOTADO, 'insumo', insumo.id, insumo.propriedadeId, rota,
                `${insumo.nome} acabou`,
                'O estoque está zerado. Registre uma entrada quando repor.');
        } else if (insumo.estoqueMinimo != null && saldoProjetado <= insumo.estoqueMinimo) {
            nova(TIPOS.INSUMO_ABAIXO_MINIMO, 'insumo', insumo.id, insumo.propriedadeId, rota,
                `${insumo.nome} abaixo do mínimo`,
                `Restam ${numero.format(saldoProjetado)} ${un}, abaixo do mínimo de ${numero.format(insumo.estoqueMinimo)} ${un}.`);
        } else if (consumoDiaTotal > 0 && diasRestantes != null && diasRestantes <= DIAS_ALERTA_INSUMO) {
            const restam = Math.max(1, Math.floor(diasRestantes));
            nova(TIPOS.INSUMO_ACABANDO, 'insumo', insumo.id, insumo.propriedadeId, rota,
                `${insumo.nome} está acabando`,
                `Pelo consumo diário, o estoque dura cerca de ${dias(restam)}. Restam ${numero.format(saldoProjetado)} ${un}.`);
        }
    }

    for (const lote of lotesSemValorCompra) {
        nova(TIPOS.LOTE_SEM_VALOR_COMPRA, 'rebanho', lote.id, lote.propriedadeId, `/rebanhos/${lote.id}`,
            `${lote.nomeRebanho} sem valor de compra`,
            'Sem o valor de compra, o resultado do lote fica sem custo. Informe quanto foi pago.');
    }

    for (const insumo of insumosSemPreco) {
        nova(TIPOS.INSUMO_SEM_PRECO, 'insumo', insumo.id, insumo.propriedadeId, `/insumos/${insumo.id}`,
            `${insumo.nome} sem preço de compra`,
            'O consumo deste mês fica sem custo no relatório. Informe o valor pago numa entrada.');
    }

    // Resumo do mês anterior, por fazenda que teve saída de animais.
    for (const f of resumoMes?.fazendas ?? []) {
        if (f.cabecasSaidas <= 0) continue;
        let mensagem;
        if (f.cabecasVendidas > 0) {
            mensagem = f.receita > 0
                ? `Vendidas ${cabecas(f.cabecasVendidas)} por ${reais.format(f.receita)}.`
                : `Vendidas ${cabecas(f.cabecasVendidas)}.`;
        } else {
            mensagem = 'Nenhuma venda no mês.';
        }
        const outras = f.cabecasSaidas - f.cabecasVendidas;
        if (outras > 0) mensagem += ` Outras saídas: ${cabecas(outras)}.`;
        mensagem += ' Veja o relatório.';

        nova(TIPOS.RESUMO_MES, 'propriedade', f.propriedadeId, f.propriedadeId, '/home/relatorio',
            `Resumo de ${resumoMes.nomeMes} na ${f.nome}`,
            mensagem,
            `${usuarioId}:${TIPOS.RESUMO_MES}:${resumoMes.referencia}:${f.propriedadeId}`);
    }

    return situacoes;
}
