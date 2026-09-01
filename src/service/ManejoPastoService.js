// src/service/ManejoPastoService.js

import {
    CustomError,
    HttpStatusCodes,
    messages,
} from '../utils/helpers/index.js';
import {
    insumoRepository,
    manejoPastoRepository,
    movimentacaoInsumoRepository,
    pastoRepository,
} from '../repository/index.js';
import DbConnect from '../config/dbConnect.js';
import { comTransacao } from '../utils/helpers/transacao.js';
import { calcularSaldos } from './insumo/calculoSaldo.js';

class ManejoPastoService {
    constructor() {
        this.repository = manejoPastoRepository;
        this.pastoRepository = pastoRepository;
        this.insumoRepository = insumoRepository;
        this.movimentacaoInsumoRepository = movimentacaoInsumoRepository;
        this.prisma = DbConnect.prisma;
    }

    /**
     * Lista manejos de pasto com paginação e filtragem.
     * Sempre restrito ao usuário autenticado (via pasto -> propriedade).
     */
    async list(req) {
        const { id } = req.params;
        const usuarioId = req.user.id;

        if (id) {
            return this.ensureManejoExists(id, usuarioId);
        }

        const { pastoId, propriedadeId, tipoManejoId, dataInicio, dataFim, ativo, atualizadoDesde, page = 1, limit = 10 } = req._parsedQuery ?? req.query;
        const filters = {};

        if (pastoId)       filters.pastoId       = pastoId;
        if (propriedadeId) filters.propriedadeId = propriedadeId;
        if (tipoManejoId)  filters.tipoManejoId  = tipoManejoId;
        if (dataInicio)    filters.dataInicio    = dataInicio;
        if (dataFim)       filters.dataFim       = dataFim;
        if (ativo !== undefined) filters.ativo   = ativo;
        if (atualizadoDesde) filters.atualizadoDesde = atualizadoDesde;

        return this.repository.list(
            usuarioId,
            filters,
            parseInt(page, 10),
            Math.min(parseInt(limit, 10) || 10, 100),
        );
    }

    /**
     * Cria um novo manejo de pasto.
     * Valida que o pasto e o tipo de manejo pertencem/existem.
     */
    async create(parsedData, req, tx) {
        const usuarioId = req.user.id;
        const { itens = [], ...dadosManejo } = parsedData;

        const pasto = await this.ensurePastoExists(dadosManejo.pastoId, usuarioId);

        if (!pasto.ativo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'pastoId',
                details: [{ path: 'pastoId', message: 'Não é possível registrar um manejo em um pasto inativo.' }],
                customMessage: 'Pasto está inativo.',
            });
        }

        await this.ensureTipoManejoExists(dadosManejo.tipoManejoId);

        // Valida os insumos ANTES de abrir a transação: um item inválido é erro 400,
        // não pode chegar a criar o manejo.
        const insumosPorId = new Map();
        for (const item of itens) {
            if (insumosPorId.has(item.insumoId)) continue;
            const insumo = await this.insumoRepository.findById(item.insumoId, usuarioId);
            if (!insumo || insumo.propriedadeId !== pasto.propriedadeId) {
                throw new CustomError({
                    statusCode: HttpStatusCodes.BAD_REQUEST.code,
                    errorType: 'validationError',
                    field: 'itens',
                    details: [{ path: 'itens', message: `Insumo ${item.insumoId} não encontrado nesta propriedade.` }],
                    customMessage: 'Insumo do item não encontrado nesta propriedade.',
                });
            }
            if (!['Pasto', 'Ambos'].includes(insumo.destino)) {
                throw new CustomError({
                    statusCode: HttpStatusCodes.BAD_REQUEST.code,
                    errorType: 'validationError',
                    field: 'itens',
                    details: [{ path: 'itens', message: `O insumo "${insumo.nome}" não é destinado ao pasto.` }],
                    customMessage: 'Um dos insumos não pode ser usado em manejo de pasto.',
                });
            }
            insumosPorId.set(item.insumoId, insumo);
        }

        return comTransacao(this.prisma, tx, async (trx) => {
            const manejo = await this.repository.create(dadosManejo, trx);

            const avisos = [];
            const movimentacoes = [];
            for (const item of itens) {
                const insumo = insumosPorId.get(item.insumoId);
                const mov = await this.movimentacaoInsumoRepository.create({
                    insumoId: item.insumoId,
                    tipo: 'Saida',
                    quantidade: item.quantidade,
                    data: dadosManejo.dataAtividade,
                    origem: 'ManejoPasto',
                    manejoPastoId: manejo.id,
                    pastoId: pasto.id,
                    observacoes: item.observacoes ?? null,
                }, trx);
                movimentacoes.push(mov);

                const movs = (insumo.movimentacoes ?? []).map((m) => ({
                    tipo: m.tipo, quantidade: Number(m.quantidade), origem: m.origem, data: m.data,
                }));
                movs.push({ tipo: 'Saida', quantidade: item.quantidade, origem: 'ManejoPasto', data: dadosManejo.dataAtividade });
                const regimes = (insumo.regimesConsumo ?? []).map((r) => ({
                    quantidadeDia: Number(r.quantidadeDia), dataInicio: r.dataInicio, dataFim: r.dataFim, ativo: r.ativo,
                }));
                if (calcularSaldos({ movimentacoes: movs, regimes, agora: new Date() }).saldoProjetado < 0) {
                    avisos.push(`Estoque insuficiente de "${insumo.nome}" — saldo ficará negativo.`);
                }
            }

            return { ...manejo, itens: movimentacoes, ...(avisos.length ? { avisos } : {}) };
        });
    }

    /**
     * Atualiza um manejo de pasto existente.
     */
    async update(id, parsedData, req, tx) {
        const usuarioId = req.user.id;

        await this.ensureManejoExists(id, usuarioId);

        if (parsedData.tipoManejoId) {
            await this.ensureTipoManejoExists(parsedData.tipoManejoId);
        }

        return this.repository.update(id, parsedData, tx);
    }

    /**
     * Exclui um manejo de pasto.
     */
    async remove(id, req, tx) {
        const usuarioId = req.user.id;
        await this.ensureManejoExists(id, usuarioId);
        return comTransacao(this.prisma, tx, async (trx) => {
            const removido = await this.repository.remove(id, trx);
            // Sem isto, as Saídas de insumo do manejo continuam debitando o saldo
            // enquanto o manejo já não aparece em nenhuma leitura.
            await this.movimentacaoInsumoRepository.desativarPorManejo('manejoPastoId', id, trx);
            return removido;
        });
    }

    // ================================
    // MÉTODOS UTILITÁRIOS
    // ================================

    async ensureManejoExists(id, usuarioId) {
        const manejo = await this.repository.findById(id, usuarioId);
        if (!manejo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Manejo de Pasto',
                details: [],
                customMessage: messages.error.resourceNotFound('Manejo de Pasto'),
            });
        }
        return manejo;
    }

    async ensurePastoExists(pastoId, usuarioId) {
        const pasto = await this.pastoRepository.findById(pastoId, usuarioId);
        if (!pasto) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Pastagem',
                details: [],
                customMessage: 'Pastagem não encontrada ou não pertence ao usuário autenticado.',
            });
        }
        return pasto;
    }

    async ensureTipoManejoExists(tipoManejoId) {
        const tipo = await this.prisma.tipoManejoPasto.findFirst({
            where: { id: tipoManejoId, ativo: true },
        });
        if (!tipo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'tipoManejoId',
                details: [{ path: 'tipoManejoId', message: 'Tipo de manejo de pasto não encontrado ou inativo.' }],
                customMessage: 'Tipo de manejo de pasto não encontrado.',
            });
        }
        return tipo;
    }
}

export default ManejoPastoService;
