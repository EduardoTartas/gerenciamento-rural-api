// src/repository/RebanhoRepository.js

import DbConnect from '../config/dbConnect.js';

/**
 * Select padrão para listas e buscas individuais de rebanho.
 * Inclui todos os relacionamentos relevantes para o frontend.
 */
const REBANHO_SELECT = {
    id: true,
    propriedadeId: true,
    pastoAtualId: true,
    racaId: true,
    sistemaProducaoId: true,
    regimeAlimentarId: true,
    nomeRebanho: true,
    quantidadeCabecas: true,
    pesoMedioAtual: true,
    dataEntradaPastoAtual: true,
    ativo: true,
    createdAt: true,
    updatedAt: true,
    propriedade: { select: { id: true, nome: true } },
    pastoAtual:  { select: { id: true, nome: true, status: true } },
    raca:        { select: { id: true, nome: true } },
    sistemaProducao:  { select: { id: true, nome: true } },
    regimeAlimentar:  { select: { id: true, nome: true } },
};

class RebanhoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    /**
     * Lista rebanhos com paginação e filtros.
     * Restrito às propriedades do usuário autenticado.
     */
    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = {
            propriedade: { usuarioId },
            ativo: filters.ativo !== undefined ? filters.ativo : true,
        };

        if (filters.nomeRebanho) where.nomeRebanho = { contains: filters.nomeRebanho, mode: 'insensitive' };
        if (filters.propriedadeId) where.propriedadeId = filters.propriedadeId;
        if (filters.pastoAtualId)  where.pastoAtualId  = filters.pastoAtualId;
        if (filters.racaId)        where.racaId        = filters.racaId;
        if (filters.sistemaProducaoId)  where.sistemaProducaoId  = filters.sistemaProducaoId;
        if (filters.regimeAlimentarId)  where.regimeAlimentarId  = filters.regimeAlimentarId;

        const [docs, totalDocs] = await Promise.all([
            this.prisma.rebanho.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { nomeRebanho: 'asc' },
                select: REBANHO_SELECT,
            }),
            this.prisma.rebanho.count({ where }),
        ]);

        return { docs, totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    /**
     * Busca um rebanho por ID. Restrito ao usuário autenticado.
     */
    async findById(id, usuarioId) {
        return this.prisma.rebanho.findFirst({
            where: { id, propriedade: { usuarioId } },
            select: REBANHO_SELECT,
        });
    }

    /**
     * Busca rebanho ativo pelo nome dentro de uma propriedade.
     * Usado para validação de nome único (case-insensitive, apenas ativos).
     */
    async findByNome(nomeRebanho, propriedadeId, excludeId = null) {
        const where = {
            nomeRebanho: { equals: nomeRebanho, mode: 'insensitive' },
            propriedadeId,
            ativo: true,
        };
        if (excludeId) where.id = { not: excludeId };
        return this.prisma.rebanho.findFirst({ where });
    }

    /**
     * Cria um novo rebanho.
     */
    async create(data) {
        return this.prisma.rebanho.create({ data, select: REBANHO_SELECT });
    }

    /**
     * Atualiza um rebanho por ID.
     */
    async update(id, data) {
        return this.prisma.rebanho.update({ where: { id }, data, select: REBANHO_SELECT });
    }

    /**
     * Conta rebanhos ativos em um pasto.
     * Usado para atualizar o status do pasto após movimentação/inativação.
     */
    async countAtivosNoPasto(pastoId) {
        return this.prisma.rebanho.count({ where: { pastoAtualId: pastoId, ativo: true } });
    }
}

export default RebanhoRepository;
