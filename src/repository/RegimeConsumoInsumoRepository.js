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
}

export default RegimeConsumoInsumoRepository;
