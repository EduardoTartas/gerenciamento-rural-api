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

    async update(id, data) {
        return this.prisma.manejoRebanho.update({ where: { id }, data, select: MANEJO_SELECT });
    }

    async remove(id) {
        return this.prisma.manejoRebanho.delete({
            where: { id },
            select: { id: true, rebanhoId: true, tipoManejoId: true, dataAtividade: true },
        });
    }
}

export default ManejoRebanhoRepository;
