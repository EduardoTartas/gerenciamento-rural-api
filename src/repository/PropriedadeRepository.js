// src/repository/PropriedadeRepository.js

import DbConnect from '../config/dbConnect.js';
import { CustomError, messages } from '../utils/helpers/index.js';

class PropriedadeRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    /**
     * Lista propriedades com paginação e filtros opcionais.
     * Sempre restrito ao usuarioId fornecido.
     */
    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = {
            usuarioId,
            ativo: filters.ativo !== undefined ? filters.ativo : true,
        };

        if (filters.nome) {
            where.nome = { contains: filters.nome, mode: 'insensitive' };
        }
        if (filters.localizacao) {
            where.localizacao = { contains: filters.localizacao, mode: 'insensitive' };
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma.propriedade.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { nome: 'asc' },
                select: {
                    id: true,
                    nome: true,
                    localizacao: true,
                    ativo: true,
                    createdAt: true,
                    updatedAt: true,
                    usuario: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            }),
            this.prisma.propriedade.count({ where }),
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
     * Busca uma propriedade por ID. Lança erro se não encontrar.
     * Restrito ao usuarioId para garantir a propriedade do recurso.
     */
    async findById(id, usuarioId) {
        const propriedade = await this.prisma.propriedade.findFirst({
            where: { id, usuarioId },
            select: {
                id: true,
                usuarioId: true,
                nome: true,
                localizacao: true,
                ativo: true,
                createdAt: true,
                updatedAt: true,
                usuario: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });

        if (!propriedade) {
            throw new CustomError({
                statusCode: 404,
                errorType: 'resourceNotFound',
                field: 'Propriedade',
                details: [],
                customMessage: messages.error.resourceNotFound('Propriedade'),
            });
        }

        return propriedade;
    }

    /**
     * Busca uma propriedade pelo nome para um usuário específico, opcionalmente excluindo um ID.
     * Usado para validação de nome único.
     */
    async findByNome(nome, usuarioId, excludeId = null) {
        const where = {
            nome: { equals: nome, mode: 'insensitive' },
            usuarioId,
            ativo: true,
        };
        if (excludeId) {
            where.id = { not: excludeId };
        }
        return this.prisma.propriedade.findFirst({ where });
    }

    /**
     * Cria uma nova propriedade.
     */
    async create(data) {
        return this.prisma.propriedade.create({
            data,
            select: {
                id: true,
                usuarioId: true,
                nome: true,
                localizacao: true,
                ativo: true,
                createdAt: true,
                updatedAt: true,
                usuario: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
    }

    /**
     * Atualiza uma propriedade por ID.
     */
    async update(id, data) {
        return this.prisma.propriedade.update({
            where: { id },
            data,
            select: {
                id: true,
                usuarioId: true,
                nome: true,
                localizacao: true,
                ativo: true,
                createdAt: true,
                updatedAt: true,
                usuario: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        });
    }

    /**
     * Remove uma propriedade por ID.
     * A exclusão em cascata é gerenciada pelo schema do Prisma (onDelete: Cascade).
     */
    async remove(id) {
        return this.prisma.propriedade.delete({
            where: { id },
            select: {
                id: true,
                nome: true,
                localizacao: true,
            },
        });
    }

    /**
     * Conta a quantidade de rebanhos ativos associados a esta propriedade.
     * Útil para validações de regra de negócio (não inativar caso haja rebanhos).
     */
    async countRebanhosAtivos(id) {
        return this.prisma.rebanho.count({
            where: {
                propriedadeId: id,
                ativo: true,
            },
        });
    }
}

export default PropriedadeRepository;
