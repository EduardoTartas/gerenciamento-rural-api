// src/service/MovimentacaoService.js

import { CustomError, HttpStatusCodes, messages } from '../utils/helpers/index.js';
import MovimentacaoRepository from '../repository/MovimentacaoRepository.js';
import RebanhoRepository from '../repository/RebanhoRepository.js';
import PastoRepository from '../repository/PastoRepository.js';

class MovimentacaoService {
    constructor() {
        this.repository = new MovimentacaoRepository();
        this.rebanhoRepository = new RebanhoRepository();
        this.pastoRepository = new PastoRepository();
    }

    /**
     * Lista o histórico de movimentações do usuário autenticado.
     */
    async list(req) {
        const { id } = req.params;
        const usuarioId = req.user.id;

        if (id) {
            return this.ensureMovimentacaoExists(id, usuarioId);
        }

        const { rebanhoId, propriedadeId, pastoOrigemId, pastoDestinoId, dataInicio, dataFim, page = 1, limit = 10 } = req.query;
        const filters = {};

        if (rebanhoId)     filters.rebanhoId     = rebanhoId;
        if (propriedadeId) filters.propriedadeId = propriedadeId;
        if (pastoOrigemId)  filters.pastoOrigemId  = pastoOrigemId;
        if (pastoDestinoId) filters.pastoDestinoId = pastoDestinoId;
        if (dataInicio)    filters.dataInicio    = dataInicio;
        if (dataFim)       filters.dataFim       = dataFim;

        return this.repository.list(
            usuarioId,
            filters,
            parseInt(page, 10),
            Math.min(parseInt(limit, 10) || 10, 100),
        );
    }

    /**
     * Registra uma movimentação de rebanho entre pastos.
     *
     * Regras de negócio:
     * 1. Rebanho deve existir, estar ativo e pertencer ao usuário.
     * 2. Pasto de destino deve existir, estar ativo e pertencer ao usuário.
     * 3. O pasto de destino não pode ser o mesmo que o pasto atual.
     * 4. Toda a operação é executada em uma transação atômica.
     */
    async create(parsedData, req) {
        const usuarioId = req.user.id;

        // Valida o rebanho
        const rebanho = await this.ensureRebanhoExists(parsedData.rebanhoId, usuarioId);

        if (!rebanho.ativo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'rebanhoId',
                details: [{ path: 'rebanhoId', message: 'Não é possível movimentar um rebanho inativo.' }],
                customMessage: 'Rebanho está inativo.',
            });
        }

        // Valida o pasto de destino
        const pastoDestino = await this.ensurePastoExists(parsedData.pastoDestinoId, usuarioId);

        if (!pastoDestino.ativo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'pastoDestinoId',
                details: [{ path: 'pastoDestinoId', message: 'Não é possível mover um rebanho para um pasto inativo.' }],
                customMessage: 'Pasto de destino está inativo.',
            });
        }

        // Valida que destino ≠ origem
        if (rebanho.pastoAtualId && rebanho.pastoAtualId === parsedData.pastoDestinoId) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'pastoDestinoId',
                details: [{ path: 'pastoDestinoId', message: 'O pasto de destino é o mesmo que o pasto atual do rebanho.' }],
                customMessage: 'O rebanho já está neste pasto.',
            });
        }

        if (rebanho.propriedadeId !== pastoDestino.propriedadeId) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'pastoDestinoId',
                details: [{ path: 'pastoDestinoId', message: 'O pasto de destino não pertence à mesma propriedade do rebanho.' }],
                customMessage: 'Pasto de destino não pertence à propriedade do rebanho.',
            });
        }

        const pastoOrigemId = rebanho.pastoAtualId ?? null;
        const dataMovimentacao = parsedData.dataMovimentacao ?? new Date();

        // Conta rebanhos restantes no pasto de origem (excluindo o que está sendo movido)
        let rebanhosRestantesNoOrigem = 0;
        if (pastoOrigemId) {
            rebanhosRestantesNoOrigem = await this.rebanhoRepository.countAtivosNoPasto(pastoOrigemId) - 1;
        }

        return this.repository.createComTransacao({
            rebanhoId: parsedData.rebanhoId,
            pastoOrigemId,
            pastoDestinoId: parsedData.pastoDestinoId,
            dataMovimentacao,
            observacoes: parsedData.observacoes ?? null,
            rebanhosRestantesNoOrigem,
        });
    }

    // ================================
    // MÉTODOS UTILITÁRIOS
    // ================================

    async ensureMovimentacaoExists(id, usuarioId) {
        const mov = await this.repository.findById(id, usuarioId);
        if (!mov) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Movimentação',
                details: [],
                customMessage: messages.error.resourceNotFound('Movimentação'),
            });
        }
        return mov;
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

    async ensurePastoExists(pastoId, usuarioId) {
        const pasto = await this.pastoRepository.findById(pastoId, usuarioId);
        if (!pasto) {
            throw new CustomError({
                statusCode: HttpStatusCodes.NOT_FOUND.code,
                errorType: 'resourceNotFound',
                field: 'Pastagem',
                details: [],
                customMessage: 'Pastagem de destino não encontrada ou não pertence ao usuário autenticado.',
            });
        }
        return pasto;
    }
}

export default MovimentacaoService;
