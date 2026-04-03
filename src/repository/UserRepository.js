// src/repository/UserRepository.js

import DbConnect from '../config/dbConnect.js';
import { CustomError, messages } from '../utils/helpers/index.js';

class UserRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    /**
     * List users with pagination and optional filters.
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
     * Find a user by ID. Throws if not found.
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
     * Find a user by email, optionally excluding a given ID.
     */
    async findByEmail(email, excludeId = null) {
        const where = { email };
        if (excludeId) {
            where.id = { not: excludeId };
        }
        return this.prisma.user.findFirst({ where });
    }

    /**
     * Update a user by ID. Throws if not found.
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
     * Delete a user by ID. Throws if not found.
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
