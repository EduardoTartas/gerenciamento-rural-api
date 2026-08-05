// src/repository/ManejoRebanhoRepository.js

import DbConnect from '../config/dbConnect.js';

const MANEJO_SELECT = {
    id: true,
    rebanhoId: true,
    tipoManejoId: true,
    medicamentoVacina: true,
    pesoRegistrado: true,
    dataAtividade: true,
    observacoes: true,
    // `ativo` viaja na resposta porque a leitura por diferença devolve o que foi
    // excluído. Sem este campo o aplicativo recebe a linha apagada igual a uma
    // viva e a ressuscita — o oposto do que o rastro de exclusão existe para
    // resolver.
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
};

class ManejoRebanhoRepository {
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

        if (filters.rebanhoId)    where.rebanhoId    = filters.rebanhoId;
        if (filters.tipoManejoId) where.tipoManejoId = filters.tipoManejoId;
        if (filters.propriedadeId) {
            where.rebanho = { ...where.rebanho, propriedadeId: filters.propriedadeId };
        }
        if (filters.dataInicio || filters.dataFim) {
            where.dataAtividade = {};
            if (filters.dataInicio) where.dataAtividade.gte = filters.dataInicio;
            if (filters.dataFim)    where.dataAtividade.lte = filters.dataFim;
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

        return { docs, totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    async findById(id, usuarioId) {
        return this.prisma.manejoRebanho.findFirst({
            where: { id, rebanho: { propriedade: { usuarioId } } },
            select: MANEJO_SELECT,
        });
    }

    async create(data) {
        return this.prisma.manejoRebanho.create({ data, select: MANEJO_SELECT });
    }

    /**
     * Cria o manejo e, se for uma pesagem, atualiza rebanho.pesoMedioAtual dentro da
     * mesma transação — mas só se este manejo for a pesagem mais recente do rebanho.
     * Evita que uma pesagem retroativa sobrescreva um peso mais atual já registrado.
     */
    async createComAtualizacaoPeso(data) {
        return this.prisma.$transaction(async (tx) => {
            const manejo = await tx.manejoRebanho.create({ data, select: MANEJO_SELECT });

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

    async update(id, data) {
        return this.prisma.manejoRebanho.update({ where: { id }, data, select: MANEJO_SELECT });
    }

    /**
     * Exclusão lógica. A linha precisa continuar existindo para o delta poder
     * reportá-la: uma linha apagada de verdade não tem `updatedAt` para
     * informar, e o aplicativo ficaria com um registro fantasma.
     */
    async remove(id) {
        return this.prisma.manejoRebanho.update({
            where: { id },
            data: { ativo: false },
        });
    }
}

export default ManejoRebanhoRepository;
