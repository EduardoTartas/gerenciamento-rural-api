// src/service/ManejoRebanhoService.js

import { CustomError, HttpStatusCodes, messages } from '../utils/helpers/index.js';
import {
    insumoRepository,
    manejoRebanhoRepository,
    movimentacaoInsumoRepository,
    rebanhoRepository,
} from '../repository/index.js';
import DbConnect from '../config/dbConnect.js';
import { comTransacao } from '../utils/helpers/transacao.js';
import { calcularSaldos } from './insumo/calculoSaldo.js';

class ManejoRebanhoService {
    constructor() {
        this.repository = manejoRebanhoRepository;
        this.rebanhoRepository = rebanhoRepository;
        this.insumoRepository = insumoRepository;
        this.movimentacaoInsumoRepository = movimentacaoInsumoRepository;
        this.prisma = DbConnect.prisma;
    }

    async list(req) {
        const { id } = req.params;
        const usuarioId = req.user.id;

        if (id) {
            return this.ensureManejoExists(id, usuarioId);
        }

        const { rebanhoId, tipoManejoId, propriedadeId, dataInicio, dataFim, ativo, atualizadoDesde, page = 1, limit = 10 } = req._parsedQuery ?? req.query;
        const filters = {};

        if (rebanhoId)    filters.rebanhoId    = rebanhoId;
        if (tipoManejoId) filters.tipoManejoId = tipoManejoId;
        if (propriedadeId) filters.propriedadeId = propriedadeId;
        if (dataInicio)   filters.dataInicio   = dataInicio;
        if (dataFim)      filters.dataFim      = dataFim;
        if (ativo !== undefined) filters.ativo = ativo;
        if (atualizadoDesde) filters.atualizadoDesde = atualizadoDesde;

        return this.repository.list(
            usuarioId,
            filters,
            parseInt(page, 10),
            Math.min(parseInt(limit, 10) || 10, 100),
        );
    }

    async create(parsedData, req, tx) {
        const usuarioId = req.user.id;
        const { itens = [], ...dadosManejo } = parsedData;
        const rebanho = await this.ensureRebanhoExists(dadosManejo.rebanhoId, usuarioId);

        if (!rebanho.ativo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'rebanhoId',
                details: [{ path: 'rebanhoId', message: 'Não é possível registrar um manejo em um rebanho inativo.' }],
                customMessage: 'Rebanho está inativo.',
            });
        }

        // Valida que o tipo de manejo existe e está ativo
        await this.ensureTipoManejoExists(dadosManejo.tipoManejoId);

        // Valida os insumos ANTES de abrir a transação: um item inválido é erro 400,
        // não pode chegar a criar o manejo.
        const insumosPorId = new Map();
        for (const item of itens) {
            if (insumosPorId.has(item.insumoId)) continue;
            const insumo = await this.insumoRepository.findById(item.insumoId, usuarioId);
            if (!insumo || insumo.propriedadeId !== rebanho.propriedadeId) {
                throw new CustomError({
                    statusCode: HttpStatusCodes.BAD_REQUEST.code,
                    errorType: 'validationError',
                    field: 'itens',
                    details: [{ path: 'itens', message: `Insumo ${item.insumoId} não encontrado nesta propriedade.` }],
                    customMessage: 'Insumo do item não encontrado nesta propriedade.',
                });
            }
            if (!['Rebanho', 'Ambos'].includes(insumo.destino)) {
                throw new CustomError({
                    statusCode: HttpStatusCodes.BAD_REQUEST.code,
                    errorType: 'validationError',
                    field: 'itens',
                    details: [{ path: 'itens', message: `O insumo "${insumo.nome}" não é destinado ao rebanho.` }],
                    customMessage: 'Um dos insumos não pode ser usado em manejo de rebanho.',
                });
            }
            insumosPorId.set(item.insumoId, insumo);
        }

        return comTransacao(this.prisma, tx, async (trx) => {
            // Regra especial: Pesagem → atualiza pesoMedioAtual do rebanho dentro
            // da mesma transação e só quando esta pesagem é a mais recente (evita
            // que um lançamento retroativo sobrescreva um peso mais atual).
            const manejo = await this.repository.createComAtualizacaoPeso(dadosManejo, trx);

            const avisos = [];
            const movimentacoes = [];
            for (const item of itens) {
                const insumo = insumosPorId.get(item.insumoId);
                const mov = await this.movimentacaoInsumoRepository.create({
                    insumoId: item.insumoId,
                    tipo: 'Saida',
                    quantidade: item.quantidade,
                    data: dadosManejo.dataAtividade,
                    origem: 'ManejoRebanho',
                    manejoRebanhoId: manejo.id,
                    rebanhoId: rebanho.id,
                    observacoes: item.observacoes ?? null,
                }, trx);
                movimentacoes.push(mov);

                const movs = (insumo.movimentacoes ?? []).map((m) => ({
                    tipo: m.tipo, quantidade: Number(m.quantidade), origem: m.origem, data: m.data,
                }));
                movs.push({ tipo: 'Saida', quantidade: item.quantidade, origem: 'ManejoRebanho', data: dadosManejo.dataAtividade });
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

    async update(id, parsedData, req, tx) {
        const usuarioId = req.user.id;
        await this.ensureManejoExists(id, usuarioId);

        if (parsedData.tipoManejoId) {
            await this.ensureTipoManejoExists(parsedData.tipoManejoId);
        }

        return this.repository.update(id, parsedData, tx);
    }

    async remove(id, req, tx) {
        const usuarioId = req.user.id;
        await this.ensureManejoExists(id, usuarioId);
        return this.repository.remove(id, tx);
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
                field: 'Manejo de Rebanho',
                details: [],
                customMessage: messages.error.resourceNotFound('Manejo de Rebanho'),
            });
        }
        return manejo;
    }

    async ensureRebanhoExists(rebanhoId, usuarioId) {
        const rebanho = await this.rebanhoRepository.findById(rebanhoId, usuarioId);
        if (!rebanho) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Rebanho',
                details: [],
                customMessage: 'Rebanho não encontrado ou não pertence ao usuário autenticado.',
            });
        }
        return rebanho;
    }

    async ensureTipoManejoExists(tipoManejoId) {
        const tipo = await this.prisma.tipoManejoRebanho.findFirst({
            where: { id: tipoManejoId, ativo: true },
        });
        if (!tipo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'tipoManejoId',
                details: [{ path: 'tipoManejoId', message: 'Tipo de manejo de rebanho não encontrado ou inativo.' }],
                customMessage: 'Tipo de manejo de rebanho não encontrado.',
            });
        }
        return tipo;
    }
}

export default ManejoRebanhoService;
