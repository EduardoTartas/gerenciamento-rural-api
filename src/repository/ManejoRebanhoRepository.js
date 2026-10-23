
import DbConnect from '../config/dbConnect.js';
import { comTransacao } from '../utils/helpers/transacao.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { aplicarAtivoOuDiferenca, intervaloData } from '../utils/helpers/index.js';

const MANEJO_SELECT = {
    id: true,
    rebanhoId: true,
    tipoManejoId: true,
    medicamentoVacina: true,
    pesoRegistrado: true,
    dataAtividade: true,
    observacoes: true,
    ativo: true,
    createdAt: true,
    updatedAt: true,
    tipoManejo: { select: { id: true, nome: true } },
    rebanho: {
        select: {
            id: true,
            nomeRebanho: true,
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

class ManejoRebanhoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = {
            rebanho: { propriedade: { usuarioId } },
        };

        aplicarAtivoOuDiferenca(where, filters);

        if (filters.rebanhoId)    where.rebanhoId    = filters.rebanhoId;
        if (filters.tipoManejoId) where.tipoManejoId = filters.tipoManejoId;
        if (filters.propriedadeId) {
            where.rebanho = { ...where.rebanho, propriedadeId: filters.propriedadeId };
        }
        if (filters.dataInicio || filters.dataFim) {
            where.dataAtividade = intervaloData(filters.dataInicio, filters.dataFim);
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma.manejoRebanho.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { dataAtividade: 'desc' },
                select: MANEJO_SELECT,
            }),
            this.prisma.manejoRebanho.count({ where }),
        ]);

        return { docs: docs.map(comItens), totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    async findById(id, usuarioId) {
        const manejo = await this.prisma.manejoRebanho.findFirst({
            where: { id, rebanho: { propriedade: { usuarioId } } },
            select: MANEJO_SELECT,
        });
        return manejo ? comItens(manejo) : null;
    }

    async create(data, tx) {
        return comItens(await ondeEscrever(tx, this.prisma).manejoRebanho.create({ data, select: MANEJO_SELECT }));
    }

    async createComAtualizacaoPeso(data, executor) {
        return comTransacao(this.prisma, executor, async (tx) => {
            const manejo = comItens(await tx.manejoRebanho.create({ data, select: MANEJO_SELECT }));

            if (data.pesoRegistrado != null) {
                const pesagemMaisRecente = await tx.manejoRebanho.findFirst({
                    where: { rebanhoId: data.rebanhoId, pesoRegistrado: { not: null } },
                    orderBy: [{ dataAtividade: 'desc' }, { createdAt: 'desc' }],
                    select: { id: true, pesoRegistrado: true },
                });

                if (pesagemMaisRecente?.id === manejo.id) {
                    await tx.rebanho.update({
                        where: { id: data.rebanhoId },
                        data: { pesoMedioAtual: pesagemMaisRecente.pesoRegistrado },
                    });
                }
            }

            return manejo;
        });
    }

    async update(id, data, tx) {
        return comItens(await ondeEscrever(tx, this.prisma).manejoRebanho.update({ where: { id }, data, select: MANEJO_SELECT }));
    }

    async updateComAtualizacaoPeso(id, rebanhoId, data, executor) {
        return comTransacao(this.prisma, executor, async (tx) => {
            const manejo = comItens(await tx.manejoRebanho.update({ where: { id }, data, select: MANEJO_SELECT }));

            if (data.pesoRegistrado != null) {
                const pesagemMaisRecente = await tx.manejoRebanho.findFirst({
                    where: { rebanhoId, pesoRegistrado: { not: null } },
                    orderBy: [{ dataAtividade: 'desc' }, { createdAt: 'desc' }],
                    select: { id: true, pesoRegistrado: true },
                });

                if (pesagemMaisRecente?.id === manejo.id) {
                    await tx.rebanho.update({
                        where: { id: rebanhoId },
                        data: { pesoMedioAtual: pesagemMaisRecente.pesoRegistrado },
                    });
                }
            }

            return manejo;
        });
    }

    async remove(id, tx) {
        return ondeEscrever(tx, this.prisma).manejoRebanho.update({
            where: { id },
            data: { ativo: false },
        });
    }
}

export default ManejoRebanhoRepository;
