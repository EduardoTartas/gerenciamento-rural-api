// src/repository/ManejoPastoRepository.js

import DbConnect from '../config/dbConnect.js';

const MANEJO_SELECT = {
    id: true,
    pastoId: true,
    tipoManejoId: true,
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
    pasto: {
        select: {
            id: true,
            nome: true,
            propriedade: { select: { id: true, nome: true } },
        },
    },
};

class ManejoPastoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    /**
     * Lista manejos de pasto com paginação e filtros opcionais.
     * Sempre restrito às propriedades do usuário autenticado.
     */
    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = {
            pasto: { propriedade: { usuarioId } },
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

        if (filters.pastoId)      where.pastoId      = filters.pastoId;
        if (filters.tipoManejoId) where.tipoManejoId = filters.tipoManejoId;
        if (filters.propriedadeId) {
            where.pasto = { ...where.pasto, propriedadeId: filters.propriedadeId };
        }
        if (filters.dataInicio || filters.dataFim) {
            where.dataAtividade = {};
            if (filters.dataInicio) where.dataAtividade.gte = filters.dataInicio;
            if (filters.dataFim)    where.dataAtividade.lte = filters.dataFim;
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

        return { docs, totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    /**
     * Busca um manejo de pasto por ID.
     * Restrito ao usuário autenticado via pasto -> propriedade.
     */
    async findById(id, usuarioId) {
        return this.prisma.manejoPasto.findFirst({
            where: { id, pasto: { propriedade: { usuarioId } } },
            select: MANEJO_SELECT,
        });
    }

    /**
     * Cria um novo manejo de pasto.
     */
    async create(data) {
        return this.prisma.manejoPasto.create({ data, select: MANEJO_SELECT });
    }

    /**
     * Atualiza um manejo de pasto por ID.
     */
    async update(id, data) {
        return this.prisma.manejoPasto.update({ where: { id }, data, select: MANEJO_SELECT });
    }

    /**
     * Exclusão lógica. A linha precisa continuar existindo para o delta poder
     * reportá-la: uma linha apagada de verdade não tem `updatedAt` para
     * informar, e o aplicativo ficaria com um registro fantasma.
     */
    async remove(id) {
        return this.prisma.manejoPasto.update({
            where: { id },
            data: { ativo: false },
        });
    }
}

export default ManejoPastoRepository;
