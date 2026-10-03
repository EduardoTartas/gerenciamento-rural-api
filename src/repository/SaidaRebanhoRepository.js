// src/repository/SaidaRebanhoRepository.js

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
    observacoes: true,
    ativo: true,
    createdAt: true,
    // Relógio da sincronização — ver `MOVIMENTACAO_SELECT`.
    updatedAt: true,
    // Estado do rebanho DEPOIS da saída: o aplicativo atualiza a cópia local
    // (cabeças restantes, finalizado) sem esperar a próxima leitura de rebanhos.
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

    /**
     * Registra a saída e baixa as cabeças do rebanho na mesma transação.
     *
     * A baixa é um `updateMany` condicional (`quantidadeCabecas >= saída`) em vez
     * de ler e gravar: duas saídas concorrentes do mesmo lote não conseguem,
     * juntas, tirar mais cabeças do que existem. Se a condição falha, o saldo
     * mudou entre a validação do service e este ponto.
     *
     * Finaliza quando a saída zera o rebanho ou quando `finalizar` é pedido:
     * inativa o lote, solta o pasto e recalcula o status dele contando
     * rebanhos ativos — nunca lendo o campo `status`, que é cache.
     */
    async createComTransacao(
        { id, rebanhoId, motivo, quantidadeCabecas, dataSaida, observacoes, finalizar },
        executor,
    ) {
        // Reaproveita a transação do lote quando houver (issues #34 e #35).
        return comTransacao(this.prisma, executor, async (tx) => {
            let baixa = await tx.rebanho.updateMany({
                where: { id: rebanhoId, ativo: true, quantidadeCabecas: { gte: quantidadeCabecas } },
                data: { quantidadeCabecas: { decrement: quantidadeCabecas } },
            });
            // Rebanho sem contagem só sai finalizando (regra do service). Não há
            // o que baixar; o update só trava a linha e avança o `updatedAt`.
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

            // Lido DEPOIS da baixa: a linha já está travada por esta transação,
            // então o saldo é o real, não o de antes de uma saída concorrente.
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

            // Por último, para o `select` aninhado devolver o rebanho já baixado.
            return tx.saidaRebanho.create({
                data: {
                    id,
                    rebanhoId,
                    motivo,
                    quantidadeCabecas,
                    dataSaida,
                    finalizouRebanho: finalizou,
                    observacoes,
                },
                select: SAIDA_SELECT,
            });
        });
    }
}

export default SaidaRebanhoRepository;
