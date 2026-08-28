// src/repository/ManejoPastoRepository.js

import DbConnect from '../config/dbConnect.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { aplicarAtivoOuDiferenca, intervaloData } from '../utils/helpers/index.js';

const MANEJO_SELECT = {
    id: true,
    pastoId: true,
    tipoManejoId: true,
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
    pasto: {
        select: {
            id: true,
            nome: true,
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

class ManejoPastoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    /**
     * Lista manejos de pasto com paginação e filtros opcionais.
     * Sempre restrito às propriedades do usuário autenticado.
     */
    async list(usuarioId, filters = {}, page = 1, limit = 10) {
        const where = {
            pasto: { propriedade: { usuarioId } },
        };

        aplicarAtivoOuDiferenca(where, filters);

        if (filters.pastoId)      where.pastoId      = filters.pastoId;
        if (filters.tipoManejoId) where.tipoManejoId = filters.tipoManejoId;
        if (filters.propriedadeId) {
            where.pasto = { ...where.pasto, propriedadeId: filters.propriedadeId };
        }
        if (filters.dataInicio || filters.dataFim) {
            where.dataAtividade = intervaloData(filters.dataInicio, filters.dataFim);
        }

        const [docs, totalDocs] = await Promise.all([
            this.prisma.manejoPasto.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { dataAtividade: 'desc' },
                select: MANEJO_SELECT,
            }),
            this.prisma.manejoPasto.count({ where }),
        ]);

        return { docs: docs.map(comItens), totalDocs, page, limit, totalPages: Math.ceil(totalDocs / limit) };
    }

    /**
     * Busca um manejo de pasto por ID.
     * Restrito ao usuário autenticado via pasto -> propriedade.
     */
    async findById(id, usuarioId) {
        const manejo = await this.prisma.manejoPasto.findFirst({
            where: { id, pasto: { propriedade: { usuarioId } } },
            select: MANEJO_SELECT,
        });
        return manejo ? comItens(manejo) : null;
    }

    /**
     * Cria um novo manejo de pasto.
     *
     * `tx` opcional: o lote (`POST /v1/sync`) passa a transação em vigor para
     * que a escrita entre junto com a lápide de idempotência; o REST não passa
     * nada e escreve pelo pool. Issue #34.
     */
    async create(data, tx) {
        return comItens(await ondeEscrever(tx, this.prisma).manejoPasto.create({ data, select: MANEJO_SELECT }));
    }

    /**
     * Atualiza um manejo de pasto por ID.
     *
     * `tx` opcional: o lote (`POST /v1/sync`) passa a transação em vigor para
     * que a escrita entre junto com a lápide de idempotência; o REST não passa
     * nada e escreve pelo pool. Issue #34.
     */
    async update(id, data, tx) {
        return comItens(await ondeEscrever(tx, this.prisma).manejoPasto.update({ where: { id }, data, select: MANEJO_SELECT }));
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
        return ondeEscrever(tx, this.prisma).manejoPasto.update({
            where: { id },
            data: { ativo: false },
        });
    }
}

export default ManejoPastoRepository;
