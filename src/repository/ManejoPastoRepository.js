// src/repository/ManejoPastoRepository.js

import DbConnect from '../config/dbConnect.js';

const MANEJO_SELECT = {
    id: true,
    pastoId: true,
    tipoManejoId: true,
    dataAtividade: true,
    observacoes: true,
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
     * Remove um manejo de pasto por ID.
     */
    async remove(id) {
        return this.prisma.manejoPasto.delete({
            where: { id },
            select: { id: true, pastoId: true, tipoManejoId: true, dataAtividade: true },
        });
    }
}

export default ManejoPastoRepository;
