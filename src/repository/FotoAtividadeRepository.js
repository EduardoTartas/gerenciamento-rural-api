// src/repository/FotoAtividadeRepository.js

import DbConnect from '../config/dbConnect.js';
import { comTransacao, ondeEscrever } from '../utils/helpers/transacao.js';
import { aplicarAtivoOuDiferenca } from '../utils/helpers/index.js';

const FOTO_SELECT = {
    id: true,
    manejoPastoId: true,
    manejoRebanhoId: true,
    url: true,
    // Viaja na resposta porque a leitura por diferença devolve as excluídas: sem
    // ele o aplicativo trataria a foto apagada como viva.
    ativo: true,
    createdAt: true,
    updatedAt: true,
};

/**
 * Dono da foto: o usuário da propriedade do pasto (manejo de pastagem) ou do
 * rebanho (manejo de rebanho). Uma das duas relações é sempre nula — o CHECK da
 * migration garante — então o `OR` nunca casa as duas ao mesmo tempo.
 */
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

    /**
     * Lista fotos de atividade, sempre restritas ao usuário autenticado.
     * Os filtros entram num `AND` com o escopo para nenhum `OR` sobrescrever outro.
     */
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

    /** Busca uma foto do usuário autenticado (ativa ou não). */
    async findById(id, usuarioId, tx) {
        return ondeEscrever(tx, this.prisma).fotoAtividade.findFirst({
            where: { id, ...escopoDoUsuario(usuarioId) },
            select: FOTO_SELECT,
        });
    }

    /**
     * A que manejo um id de foto já está ligado, sem escopo de usuário.
     *
     * O id vem do aparelho e é chave primária: se já existir, o `create` falharia
     * de qualquer jeito. Esta leitura só serve para distinguir o reenvio do mesmo
     * upload (mesmo manejo, idempotente) de uma colisão (outro manejo, 409) — e
     * devolve apenas os FKs, nunca a foto de outro usuário.
     */
    async findDonoDoId(id) {
        return this.prisma.fotoAtividade.findUnique({
            where: { id },
            select: { manejoPastoId: true, manejoRebanhoId: true },
        });
    }

    /**
     * Fotos ativas de um manejo, fora de transação: checagem antecipada para não
     * processar uma imagem que já vai ser recusada pelo limite.
     *
     * @param {'manejoPastoId'|'manejoRebanhoId'} campoManejo
     */
    async contarAtivas(campoManejo, manejoId) {
        return this.prisma.fotoAtividade.count({ where: { [campoManejo]: manejoId, ativo: true } });
    }

    /**
     * Grava a foto se o manejo ainda tiver vaga. A contagem fica dentro da
     * transação, junto da escrita, e trava a linha do manejo (`FOR UPDATE`) para
     * dois envios simultâneos não passarem os dois pela contagem de 2.
     *
     * @param {'manejoPastoId'|'manejoRebanhoId'} campoManejo
     * @returns {Promise<{foto: object|null, ativas: number}>} `foto` nula quando o limite já foi atingido.
     */
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

    /** Exclusão lógica de uma foto. */
    async remove(id, tx) {
        return ondeEscrever(tx, this.prisma).fotoAtividade.update({
            where: { id },
            data: { ativo: false },
            select: FOTO_SELECT,
        });
    }

    /**
     * Desativa as fotos de um manejo excluído. Chamado dentro da transação da
     * exclusão do manejo, para nunca sobrar foto viva de atividade apagada.
     *
     * @param {'manejoPastoId'|'manejoRebanhoId'} campoManejo
     */
    async desativarPorManejo(campoManejo, manejoId, tx) {
        return ondeEscrever(tx, this.prisma).fotoAtividade.updateMany({
            where: { [campoManejo]: manejoId, ativo: true },
            data: { ativo: false },
        });
    }
}

export default FotoAtividadeRepository;
