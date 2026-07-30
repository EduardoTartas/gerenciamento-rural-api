// src/repository/MovimentacaoRepository.js

import DbConnect from '../config/dbConnect.js';

const MOVIMENTACAO_SELECT = {
    id: true,
    rebanhoId: true,
    pastoOrigemId: true,
    pastoDestinoId: true,
    dataMovimentacao: true,
    observacoes: true,
    createdAt: true,
    rebanho: {
        select: {
            id: true,
            nomeRebanho: true,
            quantidadeCabecas: true,
            propriedade: { select: { id: true, nome: true } },
        },
    },
    pastoOrigem:  { select: { id: true, nome: true } },
    pastoDestino: { select: { id: true, nome: true } },
};

class MovimentacaoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = {
            rebanho: { propriedade: { usuarioId } },
        };

        if (filters.rebanhoId)     where.rebanhoId     = filters.rebanhoId;
        if (filters.propriedadeId) {
            where.rebanho = { ...where.rebanho, propriedadeId: filters.propriedadeId };
        }
        if (filters.pastoOrigemId)  where.pastoOrigemId  = filters.pastoOrigemId;
        if (filters.pastoDestinoId) where.pastoDestinoId = filters.pastoDestinoId;
        if (filters.dataInicio || filters.dataFim) {
            where.dataMovimentacao = {};
            if (filters.dataInicio) where.dataMovimentacao.gte = filters.dataInicio;
            if (filters.dataFim)    where.dataMovimentacao.lte = filters.dataFim;
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma.historicoMovimentacao.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { dataMovimentacao: 'desc' },
                select: MOVIMENTACAO_SELECT,
            }),
            this.prisma.historicoMovimentacao.count({ where }),
        ]);

        return { docs, totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    async findById(id, usuarioId) {
        return this.prisma.historicoMovimentacao.findFirst({
            where: { id, rebanho: { propriedade: { usuarioId } } },
            select: MOVIMENTACAO_SELECT,
        });
    }

    /**
     * Cria a movimentação e atualiza rebanho e pastos em uma única transação.
     * O count de rebanhos restantes no pasto de origem é feito DENTRO da transação
     * para evitar race conditions.
     */
    async createComTransacao({ id, rebanhoId, pastoOrigemId, pastoDestinoId, dataMovimentacao, observacoes }) {
        return this.prisma.$transaction(async (tx) => {
            // 1. Cria o registro histórico, preservando o id gerado pelo cliente (offline-first)
            const movimentacao = await tx.historicoMovimentacao.create({
                data: { id, rebanhoId, pastoOrigemId, pastoDestinoId, dataMovimentacao, observacoes },
                select: MOVIMENTACAO_SELECT,
            });

            // 2. Atualiza o rebanho (novo pasto e data de entrada)
            await tx.rebanho.update({
                where: { id: rebanhoId },
                data: { pastoAtualId: pastoDestinoId, dataEntradaPastoAtual: dataMovimentacao },
            });

            // 3. Pasto de destino → status "Ocupado"
            await tx.pasto.update({
                where: { id: pastoDestinoId },
                data: { status: 'Ocupado' },
            });

            // 4. Pasto de origem → conta rebanhos restantes dentro da transação
            if (pastoOrigemId) {
                const rebanhosRestantes = await tx.rebanho.count({
                    where: { pastoAtualId: pastoOrigemId, ativo: true },
                });
                if (rebanhosRestantes === 0) {
                    await tx.pasto.update({
                        where: { id: pastoOrigemId },
                        data: { status: 'Vazio', dataUltimaSaida: dataMovimentacao },
                    });
                }
            }

            return movimentacao;
        });
    }
}

export default MovimentacaoRepository;
