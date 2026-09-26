// src/repository/RegimeConsumoInsumoRepository.js
import DbConnect from '../config/dbConnect.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { aplicarAtivoOuDiferenca } from '../utils/helpers/index.js';

const REGIME_SELECT = {
    id: true,
    rebanhoId: true,
    insumoId: true,
    quantidadeDia: true,
    dataInicio: true,
    dataFim: true,
    ativo: true,
    createdAt: true,
    updatedAt: true,
    insumo: { select: { id: true, nome: true, unidadeMedida: true } },
    rebanho: { select: { id: true, nomeRebanho: true } },
};

class RegimeConsumoInsumoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = { rebanho: { propriedade: { usuarioId } } };
        aplicarAtivoOuDiferenca(where, filters);

        if (filters.rebanhoId) where.rebanhoId = filters.rebanhoId;
        if (filters.insumoId)  where.insumoId = filters.insumoId;
        if (filters.emAberto)  where.dataFim = null;
        // Mantém o `usuarioId` no filtro: um `propriedadeId` forjado devolve
        // lista vazia, nunca dado de outro tenant (mesmo padrão de
        // MovimentacaoInsumoRepository.list).
        if (filters.propriedadeId) {
            where.rebanho = { propriedade: { usuarioId, id: filters.propriedadeId } };
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma.regimeConsumoInsumo.findMany({
                where, skip: (page - 1) * limit, take: limit,
                orderBy: { dataInicio: 'desc' }, select: REGIME_SELECT,
            }),
            this.prisma.regimeConsumoInsumo.count({ where }),
        ]);
        return { docs, totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    async findById(id, usuarioId) {
        return this.prisma.regimeConsumoInsumo.findFirst({
            where: { id, rebanho: { propriedade: { usuarioId } } },
            select: REGIME_SELECT,
        });
    }

    /** O regime vigente (não encerrado) do par, se houver. Respeita a transação. */
    async findAbertoDoPar(rebanhoId, insumoId, tx) {
        return ondeEscrever(tx, this.prisma).regimeConsumoInsumo.findFirst({
            where: { rebanhoId, insumoId, ativo: true, dataFim: null },
            select: { id: true },
        });
    }

    async create(data, tx) {
        return ondeEscrever(tx, this.prisma).regimeConsumoInsumo.create({ data, select: REGIME_SELECT });
    }

    async update(id, data, tx) {
        return ondeEscrever(tx, this.prisma).regimeConsumoInsumo.update({ where: { id }, data, select: REGIME_SELECT });
    }

    /**
     * Desativa os regimes ativos de um insumo (exclusão do insumo). Mesma regra da
     * exclusão de um regime: `ativo: false` e `dataFim = max(agora, dataInicio)` —
     * um regime que ainda não começou encerra na própria `dataInicio`, nunca antes
     * dela. Regimes já inativos não são tocados. Um `update` por regime (e não
     * `updateMany`) porque o `dataFim` depende da `dataInicio` de cada um.
     */
    async desativarPorInsumo(insumoId, tx) {
        const db = ondeEscrever(tx, this.prisma);
        const ativos = await db.regimeConsumoInsumo.findMany({
            where: { insumoId, ativo: true },
            select: { id: true, dataInicio: true },
        });
        const agora = Date.now();
        for (const regime of ativos) {
            const dataFim = new Date(Math.max(agora, new Date(regime.dataInicio).getTime()));
            await db.regimeConsumoInsumo.update({ where: { id: regime.id }, data: { ativo: false, dataFim } });
        }
        return ativos.length;
    }
}

export default RegimeConsumoInsumoRepository;
