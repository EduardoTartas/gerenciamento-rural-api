// src/repository/ManejoRebanhoRepository.js

import DbConnect from '../config/dbConnect.js';
import { comTransacao } from '../utils/helpers/transacao.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { aplicarAtivoOuDiferenca, intervaloData } from '../utils/helpers/index.js';

const MANEJO_SELECT = {
    id: true,
    rebanhoId: true,
    tipoManejoId: true,
    medicamentoVacina: true,
    pesoRegistrado: true,
    dataAtividade: true,
    observacoes: true,
    // `ativo` viaja na resposta porque a leitura por diferença devolve o que foi
    // excluído. Sem este campo o aplicativo recebe a linha apagada igual a uma
    // viva e a ressuscita — o oposto do que o rastro de exclusão existe para
    // resolver.
    ativo: true,
    createdAt: true,
    updatedAt: true,
    tipoManejo: { select: { id: true, nome: true } },
    rebanho: {
        select: {
            id: true,
            nomeRebanho: true,
            propriedade: { select: { id: true, nome: true } },
        },
    },
    movimentacoesInsumo: {
        where: { ativo: true },
        select: {
            id: true, insumoId: true, quantidade: true, observacoes: true,
            insumo: { select: { id: true, nome: true, unidadeMedida: true } },
        },
    },
};

/**
 * A relação `movimentacoesInsumo` viaja no `select` para uma única consulta, mas
 * a resposta expõe os itens do manejo sob a chave `itens` — o nome cru do ledger
 * não vaza para o aplicativo.
 */
function comItens({ movimentacoesInsumo, ...manejo }) {
    return { ...manejo, itens: movimentacoesInsumo ?? [] };
}

class ManejoRebanhoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = {
            rebanho: { propriedade: { usuarioId } },
        };

        aplicarAtivoOuDiferenca(where, filters);

        if (filters.rebanhoId)    where.rebanhoId    = filters.rebanhoId;
        if (filters.tipoManejoId) where.tipoManejoId = filters.tipoManejoId;
        if (filters.propriedadeId) {
            where.rebanho = { ...where.rebanho, propriedadeId: filters.propriedadeId };
        }
        if (filters.dataInicio || filters.dataFim) {
            where.dataAtividade = intervaloData(filters.dataInicio, filters.dataFim);
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma.manejoRebanho.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { dataAtividade: 'desc' },
                select: MANEJO_SELECT,
            }),
            this.prisma.manejoRebanho.count({ where }),
        ]);

        return { docs: docs.map(comItens), totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    async findById(id, usuarioId) {
        const manejo = await this.prisma.manejoRebanho.findFirst({
            where: { id, rebanho: { propriedade: { usuarioId } } },
            select: MANEJO_SELECT,
        });
        return manejo ? comItens(manejo) : null;
    }

    /**
     * `tx` opcional: o lote (`POST /v1/sync`) passa a transação em vigor para
     * que a escrita entre junto com a lápide de idempotência; o REST não passa
     * nada e escreve pelo pool. Issue #34.
     */
    async create(data, tx) {
        return comItens(await ondeEscrever(tx, this.prisma).manejoRebanho.create({ data, select: MANEJO_SELECT }));
    }

    /**
     * Cria o manejo e, se for uma pesagem, atualiza rebanho.pesoMedioAtual dentro da
     * mesma transação — mas só se este manejo for a pesagem mais recente do rebanho.
     * Evita que uma pesagem retroativa sobrescreva um peso mais atual já registrado.
     *
     * Reaproveita a transação recebida em vez de abrir outra: vindo do lote,
     * abrir aqui daria transação interativa dentro de transação interativa, que
     * o Prisma não compõe — a de dentro pega outra conexão do pool (issues #34 e
     * #35).
     */
    async createComAtualizacaoPeso(data, executor) {
        return comTransacao(this.prisma, executor, async (tx) => {
            const manejo = comItens(await tx.manejoRebanho.create({ data, select: MANEJO_SELECT }));

            if (data.pesoRegistrado != null) {
                const pesagemMaisRecente = await tx.manejoRebanho.findFirst({
                    where: { rebanhoId: data.rebanhoId, pesoRegistrado: { not: null } },
                    orderBy: [{ dataAtividade: 'desc' }, { createdAt: 'desc' }],
                    select: { id: true, pesoRegistrado: true },
                });

                if (pesagemMaisRecente?.id === manejo.id) {
                    await tx.rebanho.update({
                        where: { id: data.rebanhoId },
                        data: { pesoMedioAtual: pesagemMaisRecente.pesoRegistrado },
                    });
                }
            }

            return manejo;
        });
    }

    /**
     * `tx` opcional: o lote (`POST /v1/sync`) passa a transação em vigor para
     * que a escrita entre junto com a lápide de idempotência; o REST não passa
     * nada e escreve pelo pool. Issue #34.
     */
    async update(id, data, tx) {
        return comItens(await ondeEscrever(tx, this.prisma).manejoRebanho.update({ where: { id }, data, select: MANEJO_SELECT }));
    }

    /**
     * Exclusão lógica. A linha precisa continuar existindo para o delta poder
     * reportá-la: uma linha apagada de verdade não tem `updatedAt` para
     * informar, e o aplicativo ficaria com um registro fantasma.
     *
     * `tx` opcional: o lote (`POST /v1/sync`) passa a transação em vigor para
     * que a escrita entre junto com a lápide de idempotência; o REST não passa
     * nada e escreve pelo pool. Issue #34.
     */
    async remove(id, tx) {
        return ondeEscrever(tx, this.prisma).manejoRebanho.update({
            where: { id },
            data: { ativo: false },
        });
    }
}

export default ManejoRebanhoRepository;
