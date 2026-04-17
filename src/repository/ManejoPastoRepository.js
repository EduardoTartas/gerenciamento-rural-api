// src/repository/ManejoPastoRepository.js

import DbConnect from '../config/dbConnect.js';


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
            pasto: {
                propriedade: { usuarioId },
            },
        };

        if (filters.pastoId) {
            where.pastoId = filters.pastoId;
        }
        if (filters.propriedadeId) {
            where.pasto = {
                ...where.pasto,
                propriedadeId: filters.propriedadeId,
            };
        }
        if (filters.tipoManejo) {
            where.tipoManejo = filters.tipoManejo;
        }
        if (filters.dataInicio || filters.dataFim) {
            where.dataAtividade = {};
            if (filters.dataInicio) where.dataAtividade.gte = filters.dataInicio;
            if (filters.dataFim) where.dataAtividade.lte = filters.dataFim;
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma.manejoPasto.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { dataAtividade: 'desc' },
                select: {
                    id: true,
                    pastoId: true,
                    tipoManejo: true,
                    dataAtividade: true,
                    observacoes: true,
                    pasto: {
                        select: {
                            id: true,
                            nome: true,
                            propriedade: {
                                select: {
                                    id: true,
                                    nome: true,
                                },
                            },
                        },
                    },
                },
            }),
            this.prisma.manejoPasto.count({ where }),
        ]);

        return {
            docs,
            totalDocs,
            page,
            limit,
            totalPages: Math.ceil(totalDocs / limit),
        };
    }

    /**
     * Busca um manejo de pasto por ID.
     * Restrito ao usuário autenticado via pasto -> propriedade.
     */
    async findById(id, usuarioId) {
        const manejo = await this.prisma.manejoPasto.findFirst({
            where: {
                id,
                pasto: {
                    propriedade: { usuarioId },
                },
            },
            select: {
                id: true,
                pastoId: true,
                tipoManejo: true,
                dataAtividade: true,
                observacoes: true,
                pasto: {
                    select: {
                        id: true,
                        nome: true,
                        propriedade: {
                            select: {
                                id: true,
                                nome: true,
                            },
                        },
                    },
                },
            },
        });

        return manejo;
    }

    /**
     * Cria um novo manejo de pasto.
     */
    async create(data) {
        return this.prisma.manejoPasto.create({
            data,
            select: {
                id: true,
                pastoId: true,
                tipoManejo: true,
                dataAtividade: true,
                observacoes: true,
                pasto: {
                    select: {
                        id: true,
                        nome: true,
                        propriedade: {
                            select: {
                                id: true,
                                nome: true,
                            },
                        },
                    },
                },
            },
        });
    }

    /**
     * Atualiza um manejo de pasto por ID.
     */
    async update(id, data) {
        return this.prisma.manejoPasto.update({
            where: { id },
            data,
            select: {
                id: true,
                pastoId: true,
                tipoManejo: true,
                dataAtividade: true,
                observacoes: true,
                pasto: {
                    select: {
                        id: true,
                        nome: true,
                        propriedade: {
                            select: {
                                id: true,
                                nome: true,
                            },
                        },
                    },
                },
            },
        });
    }

    /**
     * Remove um manejo de pasto por ID.
     */
    async remove(id) {
        return this.prisma.manejoPasto.delete({
            where: { id },
            select: {
                id: true,
                pastoId: true,
                tipoManejo: true,
                dataAtividade: true,
            },
        });
    }
}

export default ManejoPastoRepository;
