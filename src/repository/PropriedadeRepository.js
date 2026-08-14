// src/repository/PropriedadeRepository.js

import DbConnect from '../config/dbConnect.js';
import { contemInsensitive, igualInsensitive, aplicarAtivoOuDiferenca } from '../utils/helpers/index.js';

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
        };

        aplicarAtivoOuDiferenca(where, filters);

        if (filters.nome) where.nome = contemInsensitive(filters.nome);
        if (filters.localizacao) where.localizacao = contemInsensitive(filters.localizacao);

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
                    areaTotalHa: true,
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
     * Busca uma propriedade por ID. Retorna null se não encontrar.
     * Restrito ao usuarioId para garantir a propriedade do recurso.
     */
    async findById(id, usuarioId) {
        return this.prisma.propriedade.findFirst({
            where: { id, usuarioId },
            select: {
                id: true,
                usuarioId: true,
                nome: true,
                localizacao: true,
                areaTotalHa: true,
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
     * Busca uma propriedade pelo nome para um usuário específico, opcionalmente excluindo um ID.
     * Usado para validação de nome único.
     */
    async findByNome(nome, usuarioId, excludeId = null) {
        const where = {
            nome: igualInsensitive(nome),
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
                areaTotalHa: true,
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
                areaTotalHa: true,
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
