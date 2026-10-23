
import DbConnect from '../config/dbConnect.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { aplicarAtivoOuDiferenca, intervaloData } from '../utils/helpers/index.js';

const MANEJO_SELECT = {
    id: true,
    pastoId: true,
    tipoManejoId: true,
    dataAtividade: true,
    observacoes: true,
    ativo: true,
    createdAt: true,
    updatedAt: true,
    tipoManejo: { select: { id: true, nome: true } },
    pasto: {
        select: {
            id: true,
            nome: true,
            propriedade: { select: { id: true, nome: true } },
        },
    },
    movimentacoesInsumo: {
        where: { ativo: true },
        select: {
            id: true, insumoId: true, quantidade: true, observacoes: true,
            insumo: { select: { id: true, nome: true, unidadeMedida: true } },
        },
    },
};

function comItens({ movimentacoesInsumo, ...manejo }) {
    return { ...manejo, itens: movimentacoesInsumo ?? [] };
}

class ManejoPastoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = {
            pasto: { propriedade: { usuarioId } },
        };

        aplicarAtivoOuDiferenca(where, filters);

        if (filters.pastoId)      where.pastoId      = filters.pastoId;
        if (filters.tipoManejoId) where.tipoManejoId = filters.tipoManejoId;
        if (filters.propriedadeId) {
            where.pasto = { ...where.pasto, propriedadeId: filters.propriedadeId };
        }
        if (filters.dataInicio || filters.dataFim) {
            where.dataAtividade = intervaloData(filters.dataInicio, filters.dataFim);
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma.manejoPasto.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { dataAtividade: 'desc' },
                select: MANEJO_SELECT,
            }),
            this.prisma.manejoPasto.count({ where }),
        ]);

        return { docs: docs.map(comItens), totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    async findById(id, usuarioId) {
        const manejo = await this.prisma.manejoPasto.findFirst({
            where: { id, pasto: { propriedade: { usuarioId } } },
            select: MANEJO_SELECT,
        });
        return manejo ? comItens(manejo) : null;
    }

    async create(data, tx) {
        return comItens(await ondeEscrever(tx, this.prisma).manejoPasto.create({ data, select: MANEJO_SELECT }));
    }

    async update(id, data, tx) {
        return comItens(await ondeEscrever(tx, this.prisma).manejoPasto.update({ where: { id }, data, select: MANEJO_SELECT }));
    }

    async remove(id, tx) {
        return ondeEscrever(tx, this.prisma).manejoPasto.update({
            where: { id },
            data: { ativo: false },
        });
    }
}

export default ManejoPastoRepository;
