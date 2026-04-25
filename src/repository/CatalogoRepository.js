// src/repository/CatalogoRepository.js

import DbConnect from '../config/dbConnect.js';

/**
 * Mapeamento das entidades de catálogo:
 * chave  = segmento da URL (/catalogos/:entidade)
 * model  = nome do model Prisma (acesso dinâmico: this.prisma[model])
 * label  = nome amigável para mensagens de erro
 * relationModel / relationField = usados para checar dependências antes de excluir
 */
export const CATALOGO_ENTITIES = {
    'racas':                { model: 'raca',               label: 'Raça',                      relationModel: 'rebanho',       relationField: 'racaId' },

    'sistemas-producao':    { model: 'sistemaProducao',    label: 'Sistema de Produção',       relationModel: 'rebanho',       relationField: 'sistemaProducaoId' },
    'regimes-alimentares':  { model: 'regimeAlimentar',    label: 'Regime Alimentar',          relationModel: 'rebanho',       relationField: 'regimeAlimentarId' },
    'tipos-manejo-rebanho': { model: 'tipoManejoRebanho',  label: 'Tipo de Manejo de Rebanho', relationModel: 'manejoRebanho', relationField: 'tipoManejoId' },
    'tipos-manejo-pasto':   { model: 'tipoManejoPasto',    label: 'Tipo de Manejo de Pasto',   relationModel: 'manejoPasto',   relationField: 'tipoManejoId' },
};

const CATALOG_SELECT = { id: true, nome: true, ativo: true, createdAt: true, updatedAt: true };

class CatalogoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    /**
     * Lista itens de catálogo com paginação e filtros.
     */
    async list(model, filters = {}, page = 1, limit = 10) {
        const where = {
            ativo: filters.ativo !== undefined ? filters.ativo : true,
        };
        if (filters.nome) {
            where.nome = { contains: filters.nome, mode: 'insensitive' };
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma[model].findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { nome: 'asc' },
                select: CATALOG_SELECT,
            }),
            this.prisma[model].count({ where }),
        ]);

        return { docs, totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    /**
     * Busca item por ID.
     */
    async findById(model, id) {
        return this.prisma[model].findFirst({ where: { id }, select: CATALOG_SELECT });
    }

    /**
     * Verifica nome duplicado (case-insensitive).
     */
    async findByNome(model, nome, excludeId = null) {
        const where = { nome: { equals: nome, mode: 'insensitive' }, ativo: true };
        if (excludeId) where.id = { not: excludeId };
        return this.prisma[model].findFirst({ where });
    }

    /**
     * Cria novo item de catálogo.
     */
    async create(model, data) {
        return this.prisma[model].create({ data, select: CATALOG_SELECT });
    }

    /**
     * Atualiza item de catálogo.
     */
    async update(model, id, data) {
        return this.prisma[model].update({ where: { id }, data, select: CATALOG_SELECT });
    }

    /**
     * Conta registros que referenciam este item (para impedir exclusão com dependentes).
     */
    async countDependentes(relationModel, relationField, id) {
        return this.prisma[relationModel].count({ where: { [relationField]: id } });
    }
}

export default CatalogoRepository;
