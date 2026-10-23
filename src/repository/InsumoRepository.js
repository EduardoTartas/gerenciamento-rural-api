import DbConnect from '../config/dbConnect.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { comVersaoNova } from '../utils/helpers/versao.js';
import { aplicarAtivoOuDiferenca, contemInsensitive, igualInsensitive } from '../utils/helpers/index.js';

const INSUMO_SELECT_BASE = {
    id: true,
    propriedadeId: true,
    tipoInsumoId: true,
    nome: true,
    destino: true,
    unidadeMedida: true,
    estoqueMinimo: true,
    ativo: true,
    versao: true,
    createdAt: true,
    updatedAt: true,
    tipoInsumo: { select: { id: true, nome: true } },
    propriedade: { select: { id: true, nome: true } },
    regimesConsumo: {
        select: {
            rebanhoId: true, quantidadeDia: true, dataInicio: true, dataFim: true, ativo: true, lancamentoAutomatico: true,
        },
    },
};

const INSUMO_SELECT = {
    ...INSUMO_SELECT_BASE,
    movimentacoes: {
        where: { ativo: true },
        select: { tipo: true, quantidade: true, data: true, origem: true, rebanhoId: true },
    },
};

class InsumoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = { propriedade: { usuarioId } };
        aplicarAtivoOuDiferenca(where, filters);

        if (filters.tipoInsumoId) where.tipoInsumoId = filters.tipoInsumoId;
        if (filters.destino)      where.destino = filters.destino;
        if (filters.nome)         where.nome = contemInsensitive(filters.nome);
        if (filters.propriedadeId) {
            where.propriedade = { ...where.propriedade, id: filters.propriedadeId };
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma.insumo.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { nome: 'asc' },
                select: INSUMO_SELECT_BASE,
            }),
            this.prisma.insumo.count({ where }),
        ]);

        return {
            docs: await this.anexarResumoLedger(docs),
            totalDocs,
            page,
            limit,
            totalPages: Math.ceil(totalDocs / limit),
        };
    }

    async anexarResumoLedger(docs) {
        if (docs.length === 0) return docs;
        const ids = docs.map((d) => d.id);

        const [somas, marcos] = await Promise.all([
            this.prisma.movimentacaoInsumo.groupBy({
                by: ['insumoId', 'tipo'],
                where: { insumoId: { in: ids }, ativo: true },
                _sum: { quantidade: true },
            }),
            this.prisma.movimentacaoInsumo.groupBy({
                by: ['insumoId', 'rebanhoId', 'origem'],
                where: {
                    insumoId: { in: ids },
                    ativo: true,
                    OR: [{ tipo: 'Saida', origem: 'ConsumoRebanho' }, { origem: 'AjusteContagem' }],
                },
                _max: { data: true },
            }),
        ]);

        const resumoPorInsumo = new Map(
            ids.map((id) => [id, { entrada: 0, saida: 0, marcos: [] }]),
        );
        for (const linha of somas) {
            const resumo = resumoPorInsumo.get(linha.insumoId);
            const valor = Number(linha._sum.quantidade ?? 0);
            if (linha.tipo === 'Entrada') resumo.entrada += valor;
            else if (linha.tipo === 'Saida') resumo.saida += valor;
        }
        for (const linha of marcos) {
            if (!linha._max.data) continue;
            resumoPorInsumo.get(linha.insumoId).marcos.push({
                origem: linha.origem,
                rebanhoId: linha.rebanhoId,
                data: linha._max.data,
            });
        }

        return docs.map((d) => ({ ...d, _resumoLedger: resumoPorInsumo.get(d.id) }));
    }

    async listarAtivosComResumo(usuarioId) {
        const docs = await this.prisma.insumo.findMany({
            where: { ativo: true, propriedade: { usuarioId, ativo: true } },
            orderBy: { nome: 'asc' },
            select: INSUMO_SELECT_BASE,
        });
        return this.anexarResumoLedger(docs);
    }

    async findById(id, usuarioId) {
        return this.prisma.insumo.findFirst({
            where: { id, propriedade: { usuarioId } },
            select: INSUMO_SELECT,
        });
    }

    async findByNome(usuarioId, propriedadeId, nome, excludeId = null) {
        const where = { propriedadeId, propriedade: { usuarioId }, nome: igualInsensitive(nome), ativo: true };
        if (excludeId) where.id = { not: excludeId };
        return this.prisma.insumo.findFirst({ where, select: { id: true } });
    }

    async create(data, tx) {
        return ondeEscrever(tx, this.prisma).insumo.create({ data, select: INSUMO_SELECT });
    }

    async update(id, data, tx) {
        return ondeEscrever(tx, this.prisma).insumo.update({ where: { id }, data: comVersaoNova(data), select: INSUMO_SELECT });
    }

    async remove(id, tx) {
        return ondeEscrever(tx, this.prisma).insumo.update({ where: { id }, data: comVersaoNova({ ativo: false }) });
    }
}

export default InsumoRepository;
