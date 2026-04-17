// src/service/ManejoPastoService.js

import {
    CustomError,
    HttpStatusCodes,
    messages,
} from '../utils/helpers/index.js';
import ManejoPastoRepository from '../repository/ManejoPastoRepository.js';
import PastoRepository from '../repository/PastoRepository.js';

class ManejoPastoService {
    constructor() {
        this.repository = new ManejoPastoRepository();
        this.pastoRepository = new PastoRepository();
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

        const { pastoId, propriedadeId, tipoManejo, dataInicio, dataFim, page = 1, limit = 10 } = req.query;
        const filters = {};

        if (pastoId) filters.pastoId = pastoId;
        if (propriedadeId) filters.propriedadeId = propriedadeId;
        if (tipoManejo) filters.tipoManejo = tipoManejo;
        if (dataInicio) filters.dataInicio = dataInicio;
        if (dataFim) filters.dataFim = dataFim;

        return this.repository.list(
            usuarioId,
            filters,
            parseInt(page, 10),
            Math.min(parseInt(limit, 10) || 10, 100),
        );
    }

    /**
     * Cria um novo manejo de pasto.
     * Valida que o pasto pertence ao usuário autenticado.
     */
    async create(parsedData, req) {
        const usuarioId = req.user.id;

        // Valida se o pasto existe e pertence ao usuário
        const pasto = await this.ensurePastoExists(parsedData.pastoId, usuarioId);

        if (!pasto.ativo) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'pastoId',
                details: [{ path: 'pastoId', message: 'Não é possível registrar um manejo em um pasto inativo.' }],
                customMessage: 'Pasto está inativo.',
            });
        }


        return this.repository.create(parsedData);
    }

    /**
     * Atualiza um manejo de pasto existente.
     * Apenas o dono da propriedade (via pasto) pode atualizar.
     */
    async update(id, parsedData, req) {
        const usuarioId = req.user.id;

        await this.ensureManejoExists(id, usuarioId);

        return this.repository.update(id, parsedData);
    }

    /**
     * Exclui um manejo de pasto.
     * Apenas o dono da propriedade (via pasto) pode excluir.
     */
    async remove(id, req) {
        const usuarioId = req.user.id;

        await this.ensureManejoExists(id, usuarioId);

        return this.repository.remove(id);
    }

    // ================================
    // MÉTODOS UTILITÁRIOS
    // ================================

    /**
     * Garante que um manejo de pasto com o ID fornecido existe e pertence ao usuário.
     */
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

    /**
     * Garante que o pasto existe e pertence ao usuário autenticado.
     */
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
}

export default ManejoPastoService;
