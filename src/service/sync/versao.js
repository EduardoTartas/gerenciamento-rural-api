// src/service/sync/versao.js

/**
 * Detecção de conflito de edição por versão do registro (issue #76).
 *
 * O aparelho guarda a `versao` com que baixou o registro e a devolve em
 * `versaoBase` ao enviar um `UPDATE`. Se a versão atual do servidor for outra,
 * alguém editou o registro no meio do caminho e a mutação não é aplicada: o
 * lote devolve o veredito `conflito` e o produtor escolhe qual edição vale.
 *
 * Só as entidades com `UPDATE` no lote e `versao` no schema aparecem aqui. A
 * chave é o nome da entidade no lote, que coincide com o da tabela (`@@map`).
 */
const ESCOPO_DO_DONO = {
    propriedades: (usuarioId) => ({ usuarioId }),
    pastos: (usuarioId) => ({ propriedade: { usuarioId } }),
    insumos: (usuarioId) => ({ propriedade: { usuarioId } }),
    rebanhos: (usuarioId) => ({ propriedade: { usuarioId } }),
    manejo_pastos: (usuarioId) => ({ pasto: { propriedade: { usuarioId } } }),
    manejo_rebanhos: (usuarioId) => ({ rebanho: { propriedade: { usuarioId } } }),
    movimentacoes_insumo: (usuarioId) => ({ insumo: { propriedade: { usuarioId } } }),
    regimes_consumo_insumo: (usuarioId) => ({ rebanho: { propriedade: { usuarioId } } }),
};

const MODELO_PRISMA = {
    propriedades: 'propriedade',
    pastos: 'pasto',
    insumos: 'insumo',
    rebanhos: 'rebanho',
    manejo_pastos: 'manejoPasto',
    manejo_rebanhos: 'manejoRebanho',
    movimentacoes_insumo: 'movimentacaoInsumo',
    regimes_consumo_insumo: 'regimeConsumoInsumo',
};

/**
 * Compara a versão base da mutação com a atual do registro, **dentro da
 * transação da mutação**.
 *
 * A linha fica travada (`FOR UPDATE`) até o fim da transação: sem isso, duas
 * requisições com a mesma versão base passariam juntas na comparação e a
 * segunda sobrescreveria a primeira, que é justamente o que a versão evita.
 *
 * Registro que não é do usuário (ou não existe) não é conflito: devolve `null`
 * e a mutação segue para o service, que recusa com o 404 de sempre. Assim a
 * versão de um registro alheio nunca aparece na resposta.
 *
 * @returns {Promise<{versaoServidor: number} | null>} `null` quando não há conflito.
 */
export async function buscarConflito({ tx, entidade, entidadeId, versaoBase, usuarioId }) {
    const escopo = ESCOPO_DO_DONO[entidade];
    if (!escopo || versaoBase == null) return null;

    const existe = await tx[MODELO_PRISMA[entidade]].findFirst({
        where: { id: entidadeId, ...escopo(usuarioId) },
        select: { id: true },
    });
    if (!existe) return null;

    // `entidade` só chega aqui se for chave de ESCOPO_DO_DONO, então o nome da
    // tabela nunca vem do cliente.
    const [atual] = await tx.$queryRawUnsafe(
        `SELECT "versao" FROM "${entidade}" WHERE "id" = $1 FOR UPDATE`,
        entidadeId,
    );

    return atual.versao === versaoBase ? null : { versaoServidor: atual.versao };
}
