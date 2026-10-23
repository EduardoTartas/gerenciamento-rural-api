
import DbConnect from '../config/dbConnect.js';
import { comTransacao } from '../utils/helpers/transacao.js';
import { CustomError, HttpStatusCodes, aplicarAtivoOuDiferenca, intervaloData } from '../utils/helpers/index.js';

const SAIDA_SELECT = {
    id: true,
    rebanhoId: true,
    motivo: true,
    quantidadeCabecas: true,
    dataSaida: true,
    finalizouRebanho: true,
    precoArroba: true,
    pesoTotalKg: true,
    valorTotal: true,
    observacoes: true,
    ativo: true,
    createdAt: true,
    // relógio da sincronização — ver `MOVIMENTACAO_SELECT`.
    updatedAt: true,
    rebanho: {
        select: {
            id: true,
            nomeRebanho: true,
            quantidadeCabecas: true,
            pastoAtualId: true,
            ativo: true,
            propriedade: { select: { id: true, nome: true } },
        },
    },
};

class SaidaRebanhoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = {
            rebanho: { propriedade: { usuarioId } },
        };

        aplicarAtivoOuDiferenca(where, filters);

        if (filters.rebanhoId) where.rebanhoId = filters.rebanhoId;
        if (filters.propriedadeId) {
            where.rebanho = { ...where.rebanho, propriedadeId: filters.propriedadeId };
        }
        if (filters.motivo) where.motivo = filters.motivo;
        if (filters.dataInicio || filters.dataFim) {
            where.dataSaida = intervaloData(filters.dataInicio, filters.dataFim);
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma.saidaRebanho.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: [{ dataSaida: 'desc' }, { createdAt: 'desc' }],
                select: SAIDA_SELECT,
            }),
            this.prisma.saidaRebanho.count({ where }),
        ]);

        return { docs, totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    async findById(id, usuarioId) {
        return this.prisma.saidaRebanho.findFirst({
            where: { id, rebanho: { propriedade: { usuarioId } } },
            select: SAIDA_SELECT,
        });
    }

    async createComTransacao(
        { id, rebanhoId, motivo, quantidadeCabecas, dataSaida, observacoes, finalizar, precoArroba, pesoTotalKg, valorTotal },
        executor,
    ) {
        return comTransacao(this.prisma, executor, async (tx) => {
            let baixa = await tx.rebanho.updateMany({
                where: { id: rebanhoId, ativo: true, quantidadeCabecas: { gte: quantidadeCabecas } },
                data: { quantidadeCabecas: { decrement: quantidadeCabecas } },
            });
            if (baixa.count === 0 && finalizar) {
                baixa = await tx.rebanho.updateMany({
                    where: { id: rebanhoId, ativo: true, quantidadeCabecas: null },
                    data: { updatedAt: new Date() },
                });
            }
            if (baixa.count === 0) {
                throw new CustomError({
                    statusCode: HttpStatusCodes.CONFLICT.code,
                    errorType: 'conflict',
                    field: 'quantidadeCabecas',
                    details: [{
                        path: 'quantidadeCabecas',
                        message: 'O rebanho mudou enquanto a saída era registrada. Confira as cabeças e tente de novo.',
                    }],
                    customMessage: 'O rebanho mudou enquanto a saída era registrada.',
                });
            }

            const atual = await tx.rebanho.findUnique({
                where: { id: rebanhoId },
                select: { quantidadeCabecas: true, pastoAtualId: true },
            });
            const finalizou = finalizar || atual.quantidadeCabecas === 0;

            if (finalizou) {
                await tx.rebanho.update({
                    where: { id: rebanhoId },
                    data: { ativo: false, pastoAtualId: null, dataEntradaPastoAtual: null },
                });

                if (atual.pastoAtualId) {
                    const ocupantes = await tx.rebanho.count({
                        where: { pastoAtualId: atual.pastoAtualId, ativo: true },
                    });
                    if (ocupantes === 0) {
                        await tx.pasto.update({
                            where: { id: atual.pastoAtualId },
                            data: { status: 'Descanso', dataUltimaSaida: dataSaida },
                        });
                    }
                }
            }

            return tx.saidaRebanho.create({
                data: {
                    id,
                    rebanhoId,
                    motivo,
                    quantidadeCabecas,
                    dataSaida,
                    finalizouRebanho: finalizou,
                    precoArroba,
                    pesoTotalKg,
                    valorTotal,
                    observacoes,
                },
                select: SAIDA_SELECT,
            });
        });
    }
}

export default SaidaRebanhoRepository;
