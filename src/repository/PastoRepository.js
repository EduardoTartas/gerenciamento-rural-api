// src/repository/PastoRepository.js

import DbConnect from '../config/dbConnect.js';
import { ondeEscrever } from '../utils/helpers/transacao.js';
import { contemInsensitive, igualInsensitive, aplicarAtivoOuDiferenca } from '../utils/helpers/index.js';


class PastoRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    /**
     * Lista pastos com paginação e filtros opcionais.
     * Sempre restrito às propriedades do usuário autenticado.
     */
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
        if (filters.tipoPastagem) where.tipoPastagem = contemInsensitive(filters.tipoPastagem);

        const [docs, totalDocs] = await Promise.all([
            this.prisma.pasto.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { nome: 'asc' },
                select: {
                    id: true,
                    propriedadeId: true,
                    nome: true,
                    extensaoHa: true,
                    tipoPastagem: true,
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
                },
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

    /**
     * Busca um pasto por ID. Retorna null se não encontrar.
     * Restrito ao usuário autenticado via propriedade.
     */
    async findById(id, usuarioId) {
        const pasto = await this.prisma.pasto.findFirst({
            where: {
                id,
                propriedade: { usuarioId },
            },
            select: {
                id: true,
                propriedadeId: true,
                nome: true,
                extensaoHa: true,
                tipoPastagem: true,
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
            },
        });

        return pasto;
    }

    /**
     * Busca um pasto pelo nome dentro de uma propriedade específica.
     * Usado para validação de nome único por propriedade.
     */
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

    /**
     * Cria um novo pasto.
     *
     * `tx` opcional: o lote (`POST /v1/sync`) passa a transação em vigor para
     * que a escrita entre junto com a lápide de idempotência; o REST não passa
     * nada e escreve pelo pool. Issue #34.
     */
    async create(data, tx) {
        return ondeEscrever(tx, this.prisma).pasto.create({
            data,
            select: {
                id: true,
                propriedadeId: true,
                nome: true,
                extensaoHa: true,
                tipoPastagem: true,
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
            },
        });
    }

    /**
     * Atualiza um pasto por ID.
     *
     * `tx` opcional: o lote (`POST /v1/sync`) passa a transação em vigor para
     * que a escrita entre junto com a lápide de idempotência; o REST não passa
     * nada e escreve pelo pool. Issue #34.
     */
    async update(id, data, tx) {
        return ondeEscrever(tx, this.prisma).pasto.update({
            where: { id },
            data,
            select: {
                id: true,
                propriedadeId: true,
                nome: true,
                extensaoHa: true,
                tipoPastagem: true,
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
            },
        });
    }


    /**
     * Conta a quantidade de rebanhos ativos associados a este pasto.
     * Útil para validações de regra de negócio (não inativar pasto ocupado, etc).
     */
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
