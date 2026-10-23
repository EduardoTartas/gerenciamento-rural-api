
export const TIPOS = Object.freeze({
    PASTO_PRONTO: 'PASTO_PRONTO',
    INSUMO_ACABANDO: 'INSUMO_ACABANDO',
    INSUMO_ABAIXO_MINIMO: 'INSUMO_ABAIXO_MINIMO',
    INSUMO_ESGOTADO: 'INSUMO_ESGOTADO',
    LOTACAO_ALTA: 'LOTACAO_ALTA',
    PASTO_PRONTO_AMANHA: 'PASTO_PRONTO_AMANHA',
    LOTE_SEM_PASTO: 'LOTE_SEM_PASTO',
    RESUMO_MES: 'RESUMO_MES',
    // dados faltando: avisam uma vez por item e só na caixa.
    PASTO_SEM_AREA: 'PASTO_SEM_AREA',
    LOTE_SEM_VALOR_COMPRA: 'LOTE_SEM_VALOR_COMPRA',
    INSUMO_SEM_PRECO: 'INSUMO_SEM_PRECO',
});

export const TIPOS_DADOS_FALTANDO = Object.freeze([
    TIPOS.PASTO_SEM_AREA,
    TIPOS.LOTE_SEM_VALOR_COMPRA,
    TIPOS.INSUMO_SEM_PRECO,
]);

export const TIPOS_SEM_RESOLUCAO = Object.freeze([TIPOS.RESUMO_MES]);

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export const DIAS_DESCANSO_PADRAO = 30;
/** insumo "acabando": previsão de término em até tantos dias. */
export const DIAS_ALERTA_INSUMO = 7;
export const TETO_LOTACAO_UA_HA = 2.0;
/** uma unidade animal = 450 kg de peso vivo. */
export const KG_POR_UA = 450;

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const umaCasa = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function dias(n) {
    return n === 1 ? '1 dia' : `${n} dias`;
}

function cabecas(n) {
    return n === 1 ? '1 cabeça' : `${numero.format(n)} cabeças`;
}

export function pesoEstimadoKg(sistemaProducao) {
    const nome = (sistemaProducao ?? '').trim().toLowerCase();
    if (nome === 'cria') return 400;
    if (nome === 'recria') return 300;
    if (nome.startsWith('engorda') || nome.includes('termina')) return 450;
    if (nome.startsWith('ciclo')) return 350;
    if (nome.startsWith('leit')) return 450;
    return KG_POR_UA;
}

export function unidadesAnimais(lote) {
    const cabecas = lote.quantidadeCabecas ?? 0;
    if (cabecas <= 0) return 0;
    const peso = lote.pesoMedioAtual != null && lote.pesoMedioAtual > 0
        ? lote.pesoMedioAtual
        : pesoEstimadoKg(lote.sistemaProducao);
    return (cabecas * peso) / KG_POR_UA;
}

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
        for (const pasto of fazenda.pastos) {
            if (pasto.status !== 'Descanso' || !pasto.dataUltimaSaida) continue;
            const alvo = pasto.diasDescanso ?? pasto.tipoPastagem?.diasDescanso ?? DIAS_DESCANSO_PADRAO;
            const emDescanso = (agora.getTime() - pasto.dataUltimaSaida.getTime()) / MS_POR_DIA;
            if (emDescanso >= alvo) {
                nova(TIPOS.PASTO_PRONTO, 'pasto', pasto.id, fazenda.id, `/pastos/${pasto.id}`,
                    `${pasto.nome} pronto para receber gado`,
                    `O descanso de ${dias(alvo)} terminou. O pasto já pode receber um lote.`);
            } else if (alvo - emDescanso <= 1) {
                nova(TIPOS.PASTO_PRONTO_AMANHA, 'pasto', pasto.id, fazenda.id, `/pastos/${pasto.id}`,
                    `${pasto.nome} termina o descanso amanhã`,
                    'Planeje a mudança do lote.');
            }
        }

        // pasto sem área fica fora da lotação da fazenda.
        for (const pasto of fazenda.pastos) {
            if (pasto.extensaoHa > 0) continue;
            nova(TIPOS.PASTO_SEM_AREA, 'pasto', pasto.id, fazenda.id, `/pastos/${pasto.id}`,
                `${pasto.nome} sem área cadastrada`,
                'Sem a área, o pasto fica fora do cálculo de lotação. Informe os hectares.');
        }

        // lote sem pasto.
        for (const lote of fazenda.rebanhos) {
            if (!lote.pastoAtualId) {
                nova(TIPOS.LOTE_SEM_PASTO, 'rebanho', lote.id, fazenda.id, `/rebanhos/${lote.id}`,
                    `${lote.nomeRebanho} está sem pasto`,
                    'Vincule o lote a um pasto para acompanhar a ocupação e a lotação.');
            }
        }

        const hectares = fazenda.pastos.reduce((soma, p) => soma + (p.extensaoHa > 0 ? p.extensaoHa : 0), 0);
        const ua = fazenda.rebanhos.reduce((soma, l) => soma + unidadesAnimais(l), 0);
        if (hectares > 0 && ua / hectares > TETO_LOTACAO_UA_HA) {
            nova(TIPOS.LOTACAO_ALTA, 'propriedade', fazenda.id, fazenda.id, '/pastos',
                `Lotação alta na ${fazenda.nome}`,
                `A fazenda está com ${umaCasa.format(ua / hectares)} UA/ha, acima da referência de ${umaCasa.format(TETO_LOTACAO_UA_HA)} UA/ha. Avalie a carga dos pastos.`);
        }
    }

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
