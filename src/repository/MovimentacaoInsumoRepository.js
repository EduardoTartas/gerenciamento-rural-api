// src/repository/MovimentacaoInsumoRepository.js
import DbConnect from '../config/dbConnect.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { aplicarAtivoOuDiferenca, intervaloData } from '../utils/helpers/index.js';

const MOV_SELECT = {
    id: true,
    insumoId: true,
    tipo: true,
    quantidade: true,
    data: true,
    origem: true,
    manejoRebanhoId: true,
    manejoPastoId: true,
    rebanhoId: true,
    pastoId: true,
    observacoes: true,
    ativo: true,
    createdAt: true,
    updatedAt: true,
    insumo: { select: { id: true, nome: true, unidadeMedida: true } },
};

class MovimentacaoInsumoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = { insumo: { propriedade: { usuarioId } } };
        aplicarAtivoOuDiferenca(where, filters);

        if (filters.insumoId) where.insumoId = filters.insumoId;
        if (filters.tipo)     where.tipo = filters.tipo;
        if (filters.origem)   where.origem = filters.origem;
        if (filters.dataInicio || filters.dataFim) {
            where.data = intervaloData(filters.dataInicio, filters.dataFim);
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma.movimentacaoInsumo.findMany({
                where, skip: (page - 1) * limit, take: limit,
                orderBy: { data: 'desc' }, select: MOV_SELECT,
            }),
            this.prisma.movimentacaoInsumo.count({ where }),
        ]);
        return { docs, totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    async findById(id, usuarioId) {
        return this.prisma.movimentacaoInsumo.findFirst({
            where: { id, insumo: { propriedade: { usuarioId } } },
            select: MOV_SELECT,
        });
    }

    async create(data, tx) {
        return ondeEscrever(tx, this.prisma).movimentacaoInsumo.create({ data, select: MOV_SELECT });
    }

    async remove(id, tx) {
        return ondeEscrever(tx, this.prisma).movimentacaoInsumo.update({ where: { id }, data: { ativo: false } });
    }
}

export default MovimentacaoInsumoRepository;
