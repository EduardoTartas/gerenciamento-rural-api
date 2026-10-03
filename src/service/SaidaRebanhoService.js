// src/service/SaidaRebanhoService.js

import { CustomError, HttpStatusCodes, messages } from '../utils/helpers/index.js';
import { saidaRebanhoRepository, rebanhoRepository } from '../repository/index.js';

class SaidaRebanhoService {
    constructor() {
        this.repository = saidaRebanhoRepository;
        this.rebanhoRepository = rebanhoRepository;
    }

    /**
     * Lista as saídas de animais do usuário autenticado.
     */
    async list(req) {
        const { id } = req.params;
        const usuarioId = req.user.id;

        if (id) {
            return this.ensureSaidaExists(id, usuarioId);
        }

        const { rebanhoId, propriedadeId, motivo, dataInicio, dataFim, ativo, atualizadoDesde, page = 1, limit = 10 } = req._parsedQuery ?? req.query;
        const filters = {};

        if (rebanhoId)     filters.rebanhoId     = rebanhoId;
        if (propriedadeId) filters.propriedadeId = propriedadeId;
        if (motivo)        filters.motivo        = motivo;
        if (dataInicio)    filters.dataInicio    = dataInicio;
        if (dataFim)       filters.dataFim       = dataFim;
        if (ativo !== undefined) filters.ativo   = ativo;
        if (atualizadoDesde) filters.atualizadoDesde = atualizadoDesde;

        return this.repository.list(
            usuarioId,
            filters,
            parseInt(page, 10),
            parseInt(limit, 10) || 10,
        );
    }

    /**
     * Registra a saída de animais de um rebanho.
     *
     * Regras de negócio:
     * 1. Rebanho deve existir, pertencer ao usuário e estar ativo.
     * 2. Rebanho sem quantidade de cabeças só aceita a saída que o finaliza —
     *    sem saldo não há como saber o que sobrou de uma saída parcial.
     * 3. A saída não pode passar das cabeças atuais do rebanho.
     * 4. Saída da quantidade inteira (ou com `finalizar`) encerra o rebanho e
     *    libera o pasto. Tudo numa transação (ver o repository).
     */
    async create(parsedData, req, tx) {
        const usuarioId = req.user.id;
        const rebanho = await this.ensureRebanhoExists(parsedData.rebanhoId, usuarioId);

        if (!rebanho.ativo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'rebanhoId',
                details: [{ path: 'rebanhoId', message: 'Não é possível registrar saída de um rebanho finalizado ou inativo.' }],
                customMessage: 'Rebanho está inativo.',
            });
        }

        const atuais = rebanho.quantidadeCabecas;

        if (atuais === null || atuais === undefined) {
            if (!parsedData.finalizar) {
                throw new CustomError({
                    statusCode: HttpStatusCodes.BAD_REQUEST.code,
                    errorType: 'validationError',
                    field: 'quantidadeCabecas',
                    details: [{
                        path: 'quantidadeCabecas',
                        message: 'Preencha a quantidade de cabeças do rebanho antes de registrar uma saída parcial.',
                    }],
                    customMessage: 'O rebanho não tem a quantidade de cabeças preenchida.',
                });
            }
        } else if (parsedData.quantidadeCabecas > atuais) {
            throw new CustomError({
                statusCode: HttpStatusCodes.CONFLICT.code,
                errorType: 'conflict',
                field: 'quantidadeCabecas',
                details: [{
                    path: 'quantidadeCabecas',
                    message: `A saída tem ${parsedData.quantidadeCabecas} cabeça(s), mas o rebanho tem ${atuais}.`,
                }],
                customMessage: 'A saída tem mais cabeças do que o rebanho.',
            });
        }

        // Campo a campo de propósito: `finalizar` é regra de negócio, não coluna.
        return this.repository.createComTransacao({
            id: parsedData.id,
            rebanhoId: parsedData.rebanhoId,
            motivo: parsedData.motivo,
            quantidadeCabecas: parsedData.quantidadeCabecas,
            dataSaida: parsedData.dataSaida ?? new Date(),
            observacoes: parsedData.observacoes ?? null,
            finalizar: parsedData.finalizar ?? false,
            precoArroba: parsedData.precoArroba ?? null,
            pesoTotalKg: parsedData.pesoTotalKg ?? null,
            valorTotal: parsedData.valorTotal ?? null,
        }, tx);
    }

    // ================================
    // MÉTODOS UTILITÁRIOS
    // ================================

    async ensureSaidaExists(id, usuarioId) {
        const saida = await this.repository.findById(id, usuarioId);
        if (!saida) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Saída',
                details: [],
                customMessage: messages.error.resourceNotFound('Saída'),
            });
        }
        return saida;
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
}

export default SaidaRebanhoService;
