
import DbConnect from '../config/dbConnect.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { contemInsensitive, igualInsensitive, aplicarAtivoOuDiferenca } from '../utils/helpers/index.js';

const PROPRIEDADE_SELECT = {
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
};

class PropriedadeRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

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
                select: PROPRIEDADE_SELECT,
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

    async findById(id, usuarioId) {
        return this.prisma.propriedade.findFirst({
            where: { id, usuarioId },
            select: { usuarioId: true, ...PROPRIEDADE_SELECT },
        });
    }

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

    async create(data, tx) {
        return ondeEscrever(tx, this.prisma).propriedade.create({
            data,
            select: { usuarioId: true, ...PROPRIEDADE_SELECT },
        });
    }

    async update(id, data, tx) {
        return ondeEscrever(tx, this.prisma).propriedade.update({
            where: { id },
            data,
            select: { usuarioId: true, ...PROPRIEDADE_SELECT },
        });
    }


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
