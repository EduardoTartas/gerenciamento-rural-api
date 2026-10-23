
import DbConnect from '../config/dbConnect.js';
import { comTransacao } from '../utils/helpers/transacao.js';
import { CustomError, HttpStatusCodes, aplicarAtivoOuDiferenca, intervaloData } from '../utils/helpers/index.js';

const MOVIMENTACAO_SELECT = {
    id: true,
    rebanhoId: true,
    pastoOrigemId: true,
    pastoDestinoId: true,
    dataMovimentacao: true,
    observacoes: true,
    ativo: true,
    createdAt: true,
    updatedAt: true,
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

        aplicarAtivoOuDiferenca(where, filters);

        if (filters.rebanhoId)     where.rebanhoId     = filters.rebanhoId;
        if (filters.propriedadeId) {
            where.rebanho = { ...where.rebanho, propriedadeId: filters.propriedadeId };
        }
        if (filters.pastoOrigemId)  where.pastoOrigemId  = filters.pastoOrigemId;
        if (filters.pastoDestinoId) where.pastoDestinoId = filters.pastoDestinoId;
        if (filters.dataInicio || filters.dataFim) {
            where.dataMovimentacao = intervaloData(filters.dataInicio, filters.dataFim);
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

    async createComTransacao(
        { id, rebanhoId, pastoOrigemId, pastoDestinoId, dataMovimentacao, observacoes },
        executor,
    ) {
        return comTransacao(this.prisma, executor, async (tx) => {
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

    /** movimentação ativa mais recente de um rebanho, ou `null`. */
    async ultimaDoRebanho(rebanhoId) {
        return this.prisma.historicoMovimentacao.findFirst({
            where: { rebanhoId, ativo: true },
            orderBy: [{ dataMovimentacao: 'desc' }, { createdAt: 'desc' }],
        });
    }

    async desfazerComTransacao(movimentacao, executor) {
        const { id, rebanhoId, pastoOrigemId, pastoDestinoId } = movimentacao;

        return comTransacao(this.prisma, executor, async (tx) => {
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
