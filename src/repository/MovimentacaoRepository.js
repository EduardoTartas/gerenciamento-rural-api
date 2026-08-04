// src/repository/MovimentacaoRepository.js

import DbConnect from '../config/dbConnect.js';
import { CustomError, HttpStatusCodes } from '../utils/helpers/index.js';

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

        // Numa leitura por diferença, o que foi excluído precisa vir junto —
        // é assim que o aplicativo fica sabendo da exclusão. Filtrar por
        // `ativo` aqui esconderia exatamente o que o cliente precisa saber.
        if (filters.atualizadoDesde) {
            where.updatedAt = { gt: filters.atualizadoDesde };
        }
        if (filters.ativo !== undefined) {
            where.ativo = filters.ativo;
        } else if (!filters.atualizadoDesde) {
            where.ativo = true;
        }

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

            // 4. Pasto de origem → conta rebanhos restantes dentro da transação.
            //    Ao esvaziar, o pasto entra em Descanso e `dataUltimaSaida` passa
            //    a ser o marco zero da rebrota. `Vazio` fica reservado ao pasto
            //    recém-cadastrado, que nunca recebeu lote.
            if (pastoOrigemId) {
                const rebanhosRestantes = await tx.rebanho.count({
                    where: { pastoAtualId: pastoOrigemId, ativo: true },
                });
                if (rebanhosRestantes === 0) {
                    await tx.pasto.update({
                        where: { id: pastoOrigemId },
                        data: { status: 'Descanso', dataUltimaSaida: dataMovimentacao },
                    });
                }
            }

            return movimentacao;
        });
    }

    /** Movimentação ativa mais recente de um rebanho, ou `null`. */
    async ultimaDoRebanho(rebanhoId) {
        return this.prisma.historicoMovimentacao.findFirst({
            where: { rebanhoId, ativo: true },
            orderBy: [{ dataMovimentacao: 'desc' }, { createdAt: 'desc' }],
        });
    }

    /**
     * Reverte o efeito de uma movimentação, em transação.
     *
     * O `status` dos pastos é recalculado contando rebanhos ativos, nunca lendo
     * o campo `status` — ele é cache e já esteve comprovadamente defasado.
     *
     * A checagem "isso ainda é a última movimentação do rebanho?" é refeita
     * AQUI, com o cliente transacional (`tx`), e não apenas confiando no read
     * que o service fez antes de abrir a transação. Entre aquele read e este
     * ponto outra movimentação pode ter sido criada para o mesmo rebanho —
     * sem reconferir dentro da transação, a reversão aplicaria efeitos sobre
     * um estado que já mudou.
     */
    async desfazerComTransacao(movimentacao) {
        const { id, rebanhoId, pastoOrigemId, pastoDestinoId } = movimentacao;

        return this.prisma.$transaction(async (tx) => {
            const ultima = await tx.historicoMovimentacao.findFirst({
                where: { rebanhoId, ativo: true },
                orderBy: [{ dataMovimentacao: 'desc' }, { createdAt: 'desc' }],
            });
            if (!ultima || ultima.id !== id) {
                throw new CustomError({
                    statusCode: HttpStatusCodes.CONFLICT.code,
                    errorType: 'conflict',
                    field: 'id',
                    details: [{
                        path: 'id',
                        message: `Só a última movimentação pode ser desfeita. A última é ${ultima?.id ?? 'inexistente'}.`,
                    }],
                    customMessage: 'Só a última movimentação do lote pode ser desfeita.',
                });
            }

            const desfeita = await tx.historicoMovimentacao.update({
                where: { id },
                data: { ativo: false },
                select: MOVIMENTACAO_SELECT,
            });

            await tx.rebanho.update({
                where: { id: rebanhoId },
                data: {
                    pastoAtualId: pastoOrigemId,
                    dataEntradaPastoAtual: movimentacao.dataMovimentacao,
                },
            });

            for (const pastoId of [pastoOrigemId, pastoDestinoId]) {
                if (!pastoId) continue;
                const ocupantes = await tx.rebanho.count({
                    where: { pastoAtualId: pastoId, ativo: true },
                });
                await tx.pasto.update({
                    where: { id: pastoId },
                    data: ocupantes > 0
                        ? { status: 'Ocupado' }
                        : { status: 'Descanso', dataUltimaSaida: new Date() },
                });
            }

            return desfeita;
        });
    }
}

export default MovimentacaoRepository;
