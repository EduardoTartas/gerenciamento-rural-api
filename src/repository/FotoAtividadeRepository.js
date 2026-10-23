
import DbConnect from '../config/dbConnect.js';
import { comTransacao, ondeEscrever } from '../utils/helpers/transacao.js';
import { aplicarAtivoOuDiferenca } from '../utils/helpers/index.js';

const FOTO_SELECT = {
    id: true,
    manejoPastoId: true,
    manejoRebanhoId: true,
    url: true,
    ativo: true,
    createdAt: true,
    updatedAt: true,
};

function escopoDoUsuario(usuarioId) {
    return {
        OR: [
            { manejoPasto: { pasto: { propriedade: { usuarioId } } } },
            { manejoRebanho: { rebanho: { propriedade: { usuarioId } } } },
        ],
    };
}

class FotoAtividadeRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const condicoes = [escopoDoUsuario(usuarioId)];

        if (filters.manejoPastoId)   condicoes.push({ manejoPastoId: filters.manejoPastoId });
        if (filters.manejoRebanhoId) condicoes.push({ manejoRebanhoId: filters.manejoRebanhoId });
        if (filters.pastoId)         condicoes.push({ manejoPasto: { pastoId: filters.pastoId } });
        if (filters.rebanhoId)       condicoes.push({ manejoRebanho: { rebanhoId: filters.rebanhoId } });
        if (filters.propriedadeId) {
            condicoes.push({
                OR: [
                    { manejoPasto: { pasto: { propriedadeId: filters.propriedadeId } } },
                    { manejoRebanho: { rebanho: { propriedadeId: filters.propriedadeId } } },
                ],
            });
        }

        const where = { AND: condicoes };
        aplicarAtivoOuDiferenca(where, filters);

        const [docs, totalDocs] = await Promise.all([
            this.prisma.fotoAtividade.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                select: FOTO_SELECT,
            }),
            this.prisma.fotoAtividade.count({ where }),
        ]);

        return { docs, totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    /** busca uma foto do usuário autenticado (ativa ou não). */
    async findById(id, usuarioId, tx) {
        return ondeEscrever(tx, this.prisma).fotoAtividade.findFirst({
            where: { id, ...escopoDoUsuario(usuarioId) },
            select: FOTO_SELECT,
        });
    }

    async findDonoDoId(id) {
        return this.prisma.fotoAtividade.findUnique({
            where: { id },
            select: { manejoPastoId: true, manejoRebanhoId: true },
        });
    }

    async contarAtivas(campoManejo, manejoId) {
        return this.prisma.fotoAtividade.count({ where: { [campoManejo]: manejoId, ativo: true } });
    }

    async createComLimite(campoManejo, manejoId, data, limite, executor) {
        const tabela = campoManejo === 'manejoPastoId' ? 'manejo_pastos' : 'manejo_rebanhos';
        return comTransacao(this.prisma, executor, async (tx) => {
            await tx.$queryRawUnsafe(`SELECT id FROM "${tabela}" WHERE id = $1 FOR UPDATE`, manejoId);
            const ativas = await tx.fotoAtividade.count({
                where: { [campoManejo]: manejoId, ativo: true },
            });
            if (ativas >= limite) return { foto: null, ativas };
            const foto = await tx.fotoAtividade.create({
                data: { ...data, [campoManejo]: manejoId },
                select: FOTO_SELECT,
            });
            return { foto, ativas: ativas + 1 };
        });
    }

    /** exclusão lógica de uma foto. */
    async remove(id, tx) {
        return ondeEscrever(tx, this.prisma).fotoAtividade.update({
            where: { id },
            data: { ativo: false },
            select: FOTO_SELECT,
        });
    }

    async desativarPorManejo(campoManejo, manejoId, tx) {
        return ondeEscrever(tx, this.prisma).fotoAtividade.updateMany({
            where: { [campoManejo]: manejoId, ativo: true },
            data: { ativo: false },
        });
    }
}

export default FotoAtividadeRepository;
