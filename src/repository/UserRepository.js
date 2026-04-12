// src/repository/UserRepository.js

import DbConnect from '../config/dbConnect.js';
import { CustomError, messages } from '../utils/helpers/index.js';

class UserRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    /**
     * Lista usuários com paginação e filtros opcionais.
     */
    async list(filters = {}, page = 1, limit = 10) {
        const where = {};

        if (filters.name) {
            where.name = { contains: filters.name, mode: 'insensitive' };
        }
        if (filters.email) {
            where.email = { contains: filters.email, mode: 'insensitive' };
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { name: 'asc' },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    emailVerified: true,
                    image: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            this.prisma.user.count({ where }),
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
     * Busca um usuário pelo ID. Lança erro se não encontrado.
     */
    async findById(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                emailVerified: true,
                image: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            throw new CustomError({
                statusCode: 404,
                errorType: 'resourceNotFound',
                field: 'User',
                details: [],
                customMessage: messages.error.resourceNotFound('User'),
            });
        }

        return user;
    }

    /**
     * Busca um usuário por e-mail, opcionalmente excluindo um ID.
     */
    async findByEmail(email, excludeId = null) {
        const where = { email };
        if (excludeId) {
            where.id = { not: excludeId };
        }
        return this.prisma.user.findFirst({ where });
    }

    /**
     * Atualiza um usuário pelo ID. Lança erro se não encontrado.
     */
    async update(id, data) {
        const user = await this.prisma.user.update({
            where: { id },
            data,
            select: {
                id: true,
                name: true,
                email: true,
                emailVerified: true,
                image: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return user;
    }

    /**
     * Deleta um usuário pelo ID. Lança erro se não encontrado.
     */
    async remove(id) {
        const user = await this.prisma.user.delete({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
            },
        });

        return user;
    }
}

export default UserRepository;
