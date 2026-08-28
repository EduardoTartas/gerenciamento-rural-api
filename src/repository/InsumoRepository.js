// src/repository/InsumoRepository.js
import DbConnect from '../config/dbConnect.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { aplicarAtivoOuDiferenca, contemInsensitive, igualInsensitive } from '../utils/helpers/index.js';

// A leitura carrega o ledger e os regimes para o service calcular o saldo.
const INSUMO_SELECT = {
    id: true,
    propriedadeId: true,
    tipoInsumoId: true,
    nome: true,
    destino: true,
    unidadeMedida: true,
    estoqueMinimo: true,
    ativo: true,
    createdAt: true,
    updatedAt: true,
    tipoInsumo: { select: { id: true, nome: true } },
    propriedade: { select: { id: true, nome: true } },
    movimentacoes: {
        where: { ativo: true },
        select: { tipo: true, quantidade: true, data: true, origem: true },
    },
    regimesConsumo: {
        where: { ativo: true },
        select: { quantidadeDia: true, dataInicio: true, dataFim: true, ativo: true },
    },
};

class InsumoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = { propriedade: { usuarioId } };
        aplicarAtivoOuDiferenca(where, filters);

        if (filters.tipoInsumoId) where.tipoInsumoId = filters.tipoInsumoId;
        if (filters.destino)      where.destino = filters.destino;
        if (filters.nome)         where.nome = contemInsensitive(filters.nome);
        if (filters.propriedadeId) {
            where.propriedade = { ...where.propriedade, id: filters.propriedadeId };
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma.insumo.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { nome: 'asc' },
                select: INSUMO_SELECT,
            }),
            this.prisma.insumo.count({ where }),
        ]);

        return { docs, totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    async findById(id, usuarioId) {
        return this.prisma.insumo.findFirst({
            where: { id, propriedade: { usuarioId } },
            select: INSUMO_SELECT,
        });
    }

    async findByNome(propriedadeId, nome, excludeId = null) {
        const where = { propriedadeId, nome: igualInsensitive(nome), ativo: true };
        if (excludeId) where.id = { not: excludeId };
        return this.prisma.insumo.findFirst({ where, select: { id: true } });
    }

    async create(data, tx) {
        return ondeEscrever(tx, this.prisma).insumo.create({ data, select: INSUMO_SELECT });
    }

    async update(id, data, tx) {
        return ondeEscrever(tx, this.prisma).insumo.update({ where: { id }, data, select: INSUMO_SELECT });
    }

    async remove(id, tx) {
        return ondeEscrever(tx, this.prisma).insumo.update({ where: { id }, data: { ativo: false } });
    }
}

export default InsumoRepository;
