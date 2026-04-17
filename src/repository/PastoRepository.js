// src/repository/PastoRepository.js

import DbConnect from '../config/dbConnect.js';
import { CustomError, messages } from '../utils/helpers/index.js';

class PastoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    /**
     * Lista pastos com paginação e filtros opcionais.
     * Sempre restrito às propriedades do usuário autenticado.
     */
    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = {
            propriedade: { usuarioId },
        };

        if (filters.nome) {
            where.nome = { contains: filters.nome, mode: 'insensitive' };
        }
        if (filters.propriedadeId) {
            where.propriedadeId = filters.propriedadeId;
        }
        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.tipoPastagem) {
            where.tipoPastagem = { contains: filters.tipoPastagem, mode: 'insensitive' };
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma.pasto.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { nome: 'asc' },
                select: {
                    id: true,
                    propriedadeId: true,
                    nome: true,
                    extensaoHa: true,
                    tipoPastagem: true,
                    status: true,
                    dataUltimaSaida: true,
                    ativo: true,
                    createdAt: true,
                    updatedAt: true,
                    propriedade: {
                        select: {
                            id: true,
                            nome: true,
                        },
                    },
                },
            }),
            this.prisma.pasto.count({ where }),
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
     * Busca um pasto por ID. Lança erro se não encontrar.
     * Restrito ao usuário autenticado via propriedade.
     */
    async findById(id, usuarioId) {
        const pasto = await this.prisma.pasto.findFirst({
            where: {
                id,
                propriedade: { usuarioId },
            },
            select: {
                id: true,
                propriedadeId: true,
                nome: true,
                extensaoHa: true,
                tipoPastagem: true,
                status: true,
                dataUltimaSaida: true,
                ativo: true,
                createdAt: true,
                updatedAt: true,
                propriedade: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
            },
        });

        if (!pasto) {
            throw new CustomError({
                statusCode: 404,
                errorType: 'resourceNotFound',
                field: 'Pastagem',
                details: [],
                customMessage: messages.error.resourceNotFound('Pastagem'),
            });
        }

        return pasto;
    }

    /**
     * Busca um pasto pelo nome dentro de uma propriedade específica.
     * Usado para validação de nome único por propriedade.
     */
    async findByNome(nome, propriedadeId, excludeId = null) {
        const where = {
            nome: { equals: nome, mode: 'insensitive' },
            propriedadeId,
        };
        if (excludeId) {
            where.id = { not: excludeId };
        }
        return this.prisma.pasto.findFirst({ where });
    }

    /**
     * Cria um novo pasto.
     */
    async create(data) {
        return this.prisma.pasto.create({
            data,
            select: {
                id: true,
                propriedadeId: true,
                nome: true,
                extensaoHa: true,
                tipoPastagem: true,
                status: true,
                dataUltimaSaida: true,
                ativo: true,
                createdAt: true,
                updatedAt: true,
                propriedade: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
            },
        });
    }

    /**
     * Atualiza um pasto por ID.
     */
    async update(id, data) {
        return this.prisma.pasto.update({
            where: { id },
            data,
            select: {
                id: true,
                propriedadeId: true,
                nome: true,
                extensaoHa: true,
                tipoPastagem: true,
                status: true,
                dataUltimaSaida: true,
                ativo: true,
                createdAt: true,
                updatedAt: true,
                propriedade: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
            },
        });
    }

    /**
     * Remove um pasto por ID.
     * A exclusão em cascata é gerenciada pelo schema do Prisma (onDelete: Cascade)
     * removendo manejos de pasto, e atualizando rebanhos e movimentações relacionadas.
     */
    async remove(id) {
        return this.prisma.pasto.delete({
            where: { id },
            select: {
                id: true,
                nome: true,
                propriedadeId: true,
            },
        });
    }
    /**
     * Conta a quantidade de rebanhos ativos associados a este pasto.
     * Útil para validações de regra de negócio (não inativar pasto ocupado, etc).
     */
    async countRebanhos(id) {
        return this.prisma.rebanho.count({
            where: {
                pastoAtualId: id,
                ativo: true,
            },
        });
    }
}

export default PastoRepository;
