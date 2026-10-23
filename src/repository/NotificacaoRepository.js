
import DbConnect from '../config/dbConnect.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { aplicarAtivoOuDiferenca } from '../utils/helpers/index.js';

const NOTIFICACAO_SELECT = {
    id: true,
    tipo: true,
    titulo: true,
    mensagem: true,
    lida: true,
    lidaEm: true,
    entidade: true,
    entidadeId: true,
    propriedadeId: true,
    rota: true,
    ativo: true,
    createdAt: true,
    updatedAt: true,
};

const PUSH_A_ENVIAR = ['pendente'];

class NotificacaoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = { usuarioId };
        aplicarAtivoOuDiferenca(where, filters);
        if (filters.lida !== undefined) where.lida = filters.lida;
        if (filters.propriedadeId) where.propriedadeId = filters.propriedadeId;

        const [docs, totalDocs, naoLidas] = await Promise.all([
            this.prisma.notificacao.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                select: NOTIFICACAO_SELECT,
            }),
            this.prisma.notificacao.count({ where }),
            this.prisma.notificacao.count({ where: { usuarioId, ativo: true, lida: false } }),
        ]);

        return { docs, totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit), naoLidas };
    }

    async findById(id, usuarioId) {
        return this.prisma.notificacao.findFirst({
            where: { id, usuarioId },
            select: NOTIFICACAO_SELECT,
        });
    }

    async marcarLida(id, lida, tx) {
        return ondeEscrever(tx, this.prisma).notificacao.update({
            where: { id },
            data: { lida, lidaEm: lida ? new Date() : null },
            select: NOTIFICACAO_SELECT,
        });
    }

    async marcarTodasLidas(usuarioId, propriedadeId) {
        const where = { usuarioId, ativo: true, lida: false };
        if (propriedadeId) where.propriedadeId = propriedadeId;
        const { count } = await this.prisma.notificacao.updateMany({
            where,
            data: { lida: true, lidaEm: new Date() },
        });
        return count;
    }

    async listarUsuariosComPropriedade() {
        const linhas = await this.prisma.propriedade.findMany({
            where: { ativo: true },
            distinct: ['usuarioId'],
            select: { usuarioId: true },
        });
        return linhas.map((l) => l.usuarioId);
    }

    async carregarFazendas(usuarioId) {
        return this.prisma.propriedade.findMany({
            where: { usuarioId, ativo: true },
            select: {
                id: true,
                nome: true,
                pastos: {
                    where: { ativo: true },
                    select: {
                        id: true, nome: true, extensaoHa: true, status: true,
                        dataUltimaSaida: true, diasDescanso: true,
                        tipoPastagem: { select: { diasDescanso: true } },
                    },
                },
                rebanhos: {
                    where: { ativo: true },
                    select: {
                        id: true, nomeRebanho: true, quantidadeCabecas: true, pesoMedioAtual: true,
                        pastoAtualId: true, dataEntradaPastoAtual: true, createdAt: true,
                        sistemaProducao: { select: { nome: true } },
                    },
                },
            },
        });
    }

    async listarLotesSemValorCompra(usuarioId) {
        return this.prisma.rebanho.findMany({
            where: {
                propriedade: { usuarioId, ativo: true },
                valorCompra: null,
                saidas: { some: { ativo: true, OR: [{ motivo: 'Venda' }, { finalizouRebanho: true }] } },
            },
            select: { id: true, nomeRebanho: true, propriedadeId: true },
        });
    }

    async listarInsumosSemPreco(usuarioId, inicioDoMes, agora) {
        return this.prisma.insumo.findMany({
            where: {
                ativo: true,
                propriedade: { usuarioId, ativo: true },
                movimentacoes: { none: { ativo: true, tipo: 'Entrada', valorTotal: { not: null } } },
                OR: [
                    {
                        movimentacoes: {
                            some: {
                                ativo: true,
                                tipo: 'Saida',
                                origem: { in: ['ConsumoRebanho', 'ManejoRebanho', 'ManejoPasto'] },
                                data: { gte: inicioDoMes },
                            },
                        },
                    },
                    {
                        regimesConsumo: {
                            some: {
                                ativo: true,
                                dataInicio: { lte: agora },
                                OR: [{ dataFim: null }, { dataFim: { gt: inicioDoMes } }],
                            },
                        },
                    },
                ],
            },
            select: { id: true, nome: true, propriedadeId: true },
        });
    }

    async listarSaidasDoPeriodo(usuarioId, inicio, fim) {
        return this.prisma.saidaRebanho.findMany({
            where: {
                ativo: true,
                dataSaida: { gte: inicio, lt: fim },
                rebanho: { propriedade: { usuarioId, ativo: true } },
            },
            select: {
                motivo: true,
                quantidadeCabecas: true,
                valorTotal: true,
                rebanho: { select: { propriedade: { select: { id: true, nome: true } } } },
            },
        });
    }

    /** situações em aberto do usuário: `chaveAtiva` → id. */
    async listarAbertas(usuarioId) {
        return this.prisma.notificacao.findMany({
            where: { usuarioId, chaveAtiva: { not: null } },
            select: { id: true, chaveAtiva: true, tipo: true },
        });
    }

    async listarJaAvisadas(usuarioId, tipos) {
        const linhas = await this.prisma.notificacao.findMany({
            where: { usuarioId, tipo: { in: tipos } },
            select: { tipo: true, entidadeId: true },
        });
        return new Set(linhas.map((l) => `${l.tipo}:${l.entidadeId}`));
    }

    async abrir(dados) {
        try {
            return await this.prisma.notificacao.create({ data: dados, select: { id: true } });
        } catch (erro) {
            if (erro.code === 'P2002') return null;
            throw erro;
        }
    }

    async resolver(ids) {
        if (ids.length === 0) return 0;
        const agora = new Date();
        const [{ count }] = await this.prisma.$transaction([
            this.prisma.notificacao.updateMany({
                where: { id: { in: ids } },
                data: { chaveAtiva: null, resolvidaEm: agora },
            }),
            this.prisma.notificacao.updateMany({
                where: { id: { in: ids }, pushStatus: { in: PUSH_A_ENVIAR } },
                data: { pushStatus: 'descartado' },
            }),
        ]);
        return count;
    }

    async listarPushPendentes(usuarioId) {
        const where = { pushStatus: { in: PUSH_A_ENVIAR }, ativo: true, chaveAtiva: { not: null } };
        if (usuarioId) where.usuarioId = usuarioId;
        return this.prisma.notificacao.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            select: {
                id: true, usuarioId: true, tipo: true, titulo: true, mensagem: true,
                rota: true, propriedadeId: true, entidadeId: true, pushTentativas: true,
            },
        });
    }

    async reservarPush(id) {
        const { count } = await this.prisma.notificacao.updateMany({
            where: { id, pushStatus: 'pendente' },
            data: { pushStatus: 'enviando' },
        });
        return count === 1;
    }

    async liberarEnviosTravados(minutos = 15) {
        const limite = new Date(Date.now() - minutos * 60 * 1000);
        const { count } = await this.prisma.notificacao.updateMany({
            where: { pushStatus: 'enviando', updatedAt: { lt: limite } },
            data: { pushStatus: 'pendente' },
        });
        return count;
    }

    async concluirPush(id, enviado, tentativas, maximoDeTentativas) {
        const data = enviado
            ? { pushStatus: 'enviado', pushEnviadoEm: new Date(), pushTentativas: tentativas }
            : {
                pushStatus: tentativas >= maximoDeTentativas ? 'falhou' : 'pendente',
                pushTentativas: tentativas,
            };
        return this.prisma.notificacao.update({ where: { id }, data, select: { id: true } });
    }
}

export default NotificacaoRepository;
