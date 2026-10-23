import DbConnect from '../config/dbConnect.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { comVersaoNova } from '../utils/helpers/versao.js';
import { aplicarAtivoOuDiferenca, intervaloData } from '../utils/helpers/index.js';

const MOV_SELECT = {
    id: true,
    insumoId: true,
    tipo: true,
    quantidade: true,
    data: true,
    origem: true,
    manejoRebanhoId: true,
    manejoPastoId: true,
    rebanhoId: true,
    pastoId: true,
    valorTotal: true,
    regimeConsumoId: true,
    observacoes: true,
    ativo: true,
    versao: true,
    createdAt: true,
    updatedAt: true,
    insumo: { select: { id: true, nome: true, unidadeMedida: true } },
};

class MovimentacaoInsumoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = { insumo: { propriedade: { usuarioId } } };
        aplicarAtivoOuDiferenca(where, filters);

        if (filters.insumoId) where.insumoId = filters.insumoId;
        if (filters.propriedadeId) {
            where.insumo = { propriedade: { usuarioId, id: filters.propriedadeId } };
        }
        if (filters.tipo)     where.tipo = filters.tipo;
        if (filters.origem)   where.origem = filters.origem;
        if (filters.dataInicio || filters.dataFim) {
            where.data = intervaloData(filters.dataInicio, filters.dataFim);
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma.movimentacaoInsumo.findMany({
                where, skip: (page - 1) * limit, take: limit,
                orderBy: { data: 'desc' }, select: MOV_SELECT,
            }),
            this.prisma.movimentacaoInsumo.count({ where }),
        ]);
        return { docs, totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    async findById(id, usuarioId) {
        return this.prisma.movimentacaoInsumo.findFirst({
            where: { id, insumo: { propriedade: { usuarioId } } },
            select: MOV_SELECT,
        });
    }

    async create(data, tx) {
        return ondeEscrever(tx, this.prisma).movimentacaoInsumo.create({ data, select: MOV_SELECT });
    }

    async ledgerDoInsumo(insumoId, tx) {
        const linhas = await ondeEscrever(tx, this.prisma).movimentacaoInsumo.findMany({
            where: { insumoId, ativo: true },
            select: { tipo: true, quantidade: true, origem: true, data: true, rebanhoId: true },
        });
        return linhas.map((m) => ({ ...m, quantidade: Number(m.quantidade) }));
    }

    async criarLancamentosAutomaticos(lancamentos, tx) {
        if (lancamentos.length === 0) return 0;
        const { count } = await ondeEscrever(tx, this.prisma).movimentacaoInsumo.createMany({
            data: lancamentos,
            skipDuplicates: true,
        });
        return count;
    }

    async update(id, data, tx) {
        return ondeEscrever(tx, this.prisma).movimentacaoInsumo.update({ where: { id }, data: comVersaoNova(data), select: MOV_SELECT });
    }

    async desativarPorManejo(campo, manejoId, tx) {
        return ondeEscrever(tx, this.prisma).movimentacaoInsumo.updateMany({
            where: { [campo]: manejoId, ativo: true },
            data: { ativo: false },
        });
    }
}

export default MovimentacaoInsumoRepository;
