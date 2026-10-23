
import DbConnect from '../config/dbConnect.js';
import { contemInsensitive, igualInsensitive } from '../utils/helpers/index.js';

export const CATALOGO_ENTITIES = {
    'racas':                { model: 'raca',               label: 'Raça',                      relationModel: 'rebanho',       relationField: 'racaId' },

    'sistemas-producao':    { model: 'sistemaProducao',    label: 'Sistema de Produção',       relationModel: 'rebanho',       relationField: 'sistemaProducaoId' },
    'regimes-alimentares':  { model: 'regimeAlimentar',    label: 'Regime Alimentar',          relationModel: 'rebanho',       relationField: 'regimeAlimentarId' },
    'tipos-manejo-rebanho': { model: 'tipoManejoRebanho',  label: 'Tipo de Manejo de Rebanho', relationModel: 'manejoRebanho', relationField: 'tipoManejoId' },
    'tipos-manejo-pasto':   { model: 'tipoManejoPasto',    label: 'Tipo de Manejo de Pasto',   relationModel: 'manejoPasto',   relationField: 'tipoManejoId' },
    'tipos-insumo':         { model: 'tipoInsumo',         label: 'Tipo de Insumo',            relationModel: 'insumo',        relationField: 'tipoInsumoId' },
    'tipos-pastagem':       { model: 'tipoPastagem',       label: 'Tipo de Pastagem',          relationModel: 'pasto',         relationField: 'tipoPastagemId', camposExtras: ['diasDescanso'] },
};

const CATALOG_SELECT = { id: true, nome: true, ativo: true, createdAt: true, updatedAt: true };

const SELECT_POR_MODEL = Object.fromEntries(
    Object.values(CATALOGO_ENTITIES).map(({ model, camposExtras = [] }) => [
        model,
        { ...CATALOG_SELECT, ...Object.fromEntries(camposExtras.map((campo) => [campo, true])) },
    ]),
);

class CatalogoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async list(model, filters = {}, page = 1, limit = 10) {
        const where = {
            ativo: filters.ativo !== undefined ? filters.ativo : true,
        };
        if (filters.nome) where.nome = contemInsensitive(filters.nome);

        const [docs, totalDocs] = await Promise.all([
            this.prisma[model].findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { nome: 'asc' },
                select: SELECT_POR_MODEL[model],
            }),
            this.prisma[model].count({ where }),
        ]);

        return { docs, totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    async findById(model, id) {
        return this.prisma[model].findFirst({ where: { id }, select: SELECT_POR_MODEL[model] });
    }

    async findByNome(model, nome, excludeId = null) {
        const where = { nome: igualInsensitive(nome), ativo: true };
        if (excludeId) where.id = { not: excludeId };
        return this.prisma[model].findFirst({ where });
    }

    async create(model, data) {
        return this.prisma[model].create({ data, select: SELECT_POR_MODEL[model] });
    }

    async update(model, id, data) {
        return this.prisma[model].update({ where: { id }, data, select: SELECT_POR_MODEL[model] });
    }

    async countDependentes(relationModel, relationField, id) {
        return this.prisma[relationModel].count({ where: { [relationField]: id } });
    }
}

export default CatalogoRepository;
