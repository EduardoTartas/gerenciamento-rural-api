// src/repository/InsumoRepository.js
import DbConnect from '../config/dbConnect.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { aplicarAtivoOuDiferenca, contemInsensitive, igualInsensitive } from '../utils/helpers/index.js';

// Campos base do insumo, sem o ledger. Os regimes viajam sempre — são poucos
// por insumo e a projeção precisa deles (inclusive dos encerrados).
const INSUMO_SELECT_BASE = {
    id: true,
    propriedadeId: true,
    tipoInsumoId: true,
    nome: true,
    destino: true,
    unidadeMedida: true,
    estoqueMinimo: true,
    ativo: true,
    createdAt: true,
    updatedAt: true,
    tipoInsumo: { select: { id: true, nome: true } },
    propriedade: { select: { id: true, nome: true } },
    // Sem filtro por `ativo`: um regime encerrado (`ativo: false`) ainda teve
    // consumo real antes do `dataFim` que a projeção precisa contar. O filtro
    // de vigência diária fica em `calcularConsumoDiaTotal` (respeita `ativo`).
    regimesConsumo: {
        select: { quantidadeDia: true, dataInicio: true, dataFim: true, ativo: true },
    },
};

// Leitura de um insumo só (findById/create/update): traz o ledger inteiro para o
// service calcular o saldo a partir das linhas cruas.
const INSUMO_SELECT = {
    ...INSUMO_SELECT_BASE,
    movimentacoes: {
        where: { ativo: true },
        select: { tipo: true, quantidade: true, data: true, origem: true },
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

    /**
     * Anexa `_resumoLedger` a cada insumo da página: a soma do ledger por tipo e
     * a data da última contagem física. Dois `groupBy` sobre `movimentacoes_insumo`
     * em vez de trazer o ledger inteiro por linha (issue #37). O service usa esse
     * resumo em `calcularSaldosComResumo`.
     */
    async anexarResumoLedger(docs) {
        if (docs.length === 0) return docs;
        const ids = docs.map((d) => d.id);

        const [somas, contagens] = await Promise.all([
            this.prisma.movimentacaoInsumo.groupBy({
                by: ['insumoId', 'tipo'],
                where: { insumoId: { in: ids }, ativo: true },
                _sum: { quantidade: true },
            }),
            this.prisma.movimentacaoInsumo.groupBy({
                by: ['insumoId'],
                where: { insumoId: { in: ids }, ativo: true, origem: 'AjusteContagem' },
                _max: { data: true },
            }),
        ]);

        const resumoPorInsumo = new Map(
            ids.map((id) => [id, { entrada: 0, saida: 0, ajuste: 0, ultimaContagem: null }]),
        );
        for (const linha of somas) {
            const resumo = resumoPorInsumo.get(linha.insumoId);
            const valor = Number(linha._sum.quantidade ?? 0);
            if (linha.tipo === 'Entrada') resumo.entrada += valor;
            else if (linha.tipo === 'Saida') resumo.saida += valor;
            else resumo.ajuste += valor; // Ajuste
        }
        for (const linha of contagens) {
            resumoPorInsumo.get(linha.insumoId).ultimaContagem = linha._max.data ?? null;
        }

        return docs.map((d) => ({ ...d, _resumoLedger: resumoPorInsumo.get(d.id) }));
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
        return ondeEscrever(tx, this.prisma).insumo.update({ where: { id }, data, select: INSUMO_SELECT });
    }

    async remove(id, tx) {
        return ondeEscrever(tx, this.prisma).insumo.update({ where: { id }, data: { ativo: false } });
    }
}

export default InsumoRepository;
