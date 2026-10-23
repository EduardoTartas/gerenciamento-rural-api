
import DbConnect from '../config/dbConnect.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { contemInsensitive, igualInsensitive, aplicarAtivoOuDiferenca } from '../utils/helpers/index.js';

const PASTO_SELECT = {
    id: true,
    propriedadeId: true,
    nome: true,
    extensaoHa: true,
    tipoPastagemId: true,
    tipoPastagem: { select: { id: true, nome: true, diasDescanso: true } },
    diasDescanso: true,
    status: true,
    dataUltimaSaida: true,
    ativo: true,
    createdAt: true,
    updatedAt: true,
    propriedade: {
        select: {
            id: true,
            nome: true,
        },
    },
};

class PastoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = {
            propriedade: { usuarioId },
        };

        aplicarAtivoOuDiferenca(where, filters);

        if (filters.nome) where.nome = contemInsensitive(filters.nome);
        if (filters.propriedadeId) {
            where.propriedadeId = filters.propriedadeId;
        }
        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.tipoPastagemId) where.tipoPastagemId = filters.tipoPastagemId;

        const [docs, totalDocs] = await Promise.all([
            this.prisma.pasto.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { nome: 'asc' },
                select: PASTO_SELECT,
            }),
            this.prisma.pasto.count({ where }),
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
        const pasto = await this.prisma.pasto.findFirst({
            where: {
                id,
                propriedade: { usuarioId },
            },
            select: PASTO_SELECT,
        });

        return pasto;
    }

    async findTipoPastagemPorNome(nome) {
        return this.prisma.tipoPastagem.findFirst({
            where: { nome: igualInsensitive(nome), ativo: true },
            select: { id: true },
        });
    }

    async findTipoPastagemAtivo(id) {
        return this.prisma.tipoPastagem.findFirst({ where: { id, ativo: true }, select: { id: true } });
    }

    async findByNome(nome, propriedadeId, excludeId = null) {
        const where = {
            nome: igualInsensitive(nome),
            propriedadeId,
            ativo: true,
        };
        if (excludeId) {
            where.id = { not: excludeId };
        }
        return this.prisma.pasto.findFirst({ where });
    }

    async create(data, tx) {
        return ondeEscrever(tx, this.prisma).pasto.create({
            data,
            select: PASTO_SELECT,
        });
    }

    async update(id, data, tx) {
        return ondeEscrever(tx, this.prisma).pasto.update({
            where: { id },
            data,
            select: PASTO_SELECT,
        });
    }


    async countRebanhos(id) {
        return this.prisma.rebanho.count({
            where: {
                pastoAtualId: id,
                ativo: true,
            },
        });
    }
}

export default PastoRepository;
