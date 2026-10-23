
import DbConnect from '../config/dbConnect.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { contemInsensitive, igualInsensitive, aplicarAtivoOuDiferenca } from '../utils/helpers/index.js';

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
    valorCompra: true,
    pesoCompraKg: true,
    precoArrobaCompra: true,
    dataCompra: true,
    cabecasCompra: true,
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

    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = {
            propriedade: { usuarioId },
        };

        aplicarAtivoOuDiferenca(where, filters);

        if (filters.nomeRebanho) where.nomeRebanho = contemInsensitive(filters.nomeRebanho);
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

    async findById(id, usuarioId) {
        return this.prisma.rebanho.findFirst({
            where: { id, propriedade: { usuarioId } },
            select: REBANHO_SELECT,
        });
    }

    async findByNome(nomeRebanho, propriedadeId, excludeId = null) {
        const where = {
            nomeRebanho: igualInsensitive(nomeRebanho),
            propriedadeId,
            ativo: true,
        };
        if (excludeId) where.id = { not: excludeId };
        return this.prisma.rebanho.findFirst({ where });
    }

    async create(data, tx) {
        return ondeEscrever(tx, this.prisma).rebanho.create({ data, select: REBANHO_SELECT });
    }

    async update(id, data, tx) {
        return ondeEscrever(tx, this.prisma).rebanho.update({ where: { id }, data, select: REBANHO_SELECT });
    }

    async countAtivosNoPasto(pastoId, { excluirRebanhoId = null } = {}) {
        const where = { pastoAtualId: pastoId, ativo: true };
        if (excluirRebanhoId) where.id = { not: excluirRebanhoId };
        return this.prisma.rebanho.count({ where });
    }
}

export default RebanhoRepository;
