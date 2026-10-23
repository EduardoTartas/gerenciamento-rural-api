
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

export async function buscarConflito({ tx, entidade, entidadeId, versaoBase, usuarioId }) {
    const escopo = ESCOPO_DO_DONO[entidade];
    if (!escopo || versaoBase == null) return null;

    const existe = await tx[MODELO_PRISMA[entidade]].findFirst({
        where: { id: entidadeId, ...escopo(usuarioId) },
        select: { id: true },
    });
    if (!existe) return null;

    const [atual] = await tx.$queryRawUnsafe(
        `SELECT "versao" FROM "${entidade}" WHERE "id" = $1 FOR UPDATE`,
        entidadeId,
    );

    return atual.versao === versaoBase ? null : { versaoServidor: atual.versao };
}
