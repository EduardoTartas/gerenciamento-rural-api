// src/repository/UserRepository.js

import DbConnect from '../config/dbConnect.js';
import { contemInsensitive } from '../utils/helpers/index.js';

const USER_SELECT = {
    id: true,
    name: true,
    email: true,
    emailVerified: true,
    image: true,
    createdAt: true,
    updatedAt: true,
};

class UserRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    /**
     * Lista usuários com paginação e filtros opcionais.
     */
    async list(filters = {}, page = 1, limit = 10) {
        const where = {};

        if (filters.name) where.name = contemInsensitive(filters.name);
        if (filters.email) where.email = contemInsensitive(filters.email);

        const [docs, totalDocs] = await Promise.all([
            this.prisma.user.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { name: 'asc' },
                select: USER_SELECT,
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
     * Busca um usuário pelo ID. Retorna null se não encontrado.
     */
    async findById(id) {
        return this.prisma.user.findUnique({
            where: { id },
            select: USER_SELECT,
        });
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
            select: USER_SELECT,
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
