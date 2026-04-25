// src/service/ManejoRebanhoService.js

import { CustomError, HttpStatusCodes, messages } from '../utils/helpers/index.js';
import ManejoRebanhoRepository from '../repository/ManejoRebanhoRepository.js';
import RebanhoRepository from '../repository/RebanhoRepository.js';
import DbConnect from '../config/dbConnect.js';

class ManejoRebanhoService {
    constructor() {
        this.repository = new ManejoRebanhoRepository();
        this.rebanhoRepository = new RebanhoRepository();
        this.prisma = DbConnect.prisma;
    }

    async list(req) {
        const { id } = req.params;
        const usuarioId = req.user.id;

        if (id) {
            return this.ensureManejoExists(id, usuarioId);
        }

        const { rebanhoId, tipoManejoId, propriedadeId, dataInicio, dataFim, page = 1, limit = 10 } = req.query;
        const filters = {};

        if (rebanhoId)    filters.rebanhoId    = rebanhoId;
        if (tipoManejoId) filters.tipoManejoId = tipoManejoId;
        if (propriedadeId) filters.propriedadeId = propriedadeId;
        if (dataInicio)   filters.dataInicio   = dataInicio;
        if (dataFim)      filters.dataFim      = dataFim;

        return this.repository.list(
            usuarioId,
            filters,
            parseInt(page, 10),
            Math.min(parseInt(limit, 10) || 10, 100),
        );
    }

    async create(parsedData, req) {
        const usuarioId = req.user.id;
        const rebanho = await this.ensureRebanhoExists(parsedData.rebanhoId, usuarioId);

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
        await this.ensureTipoManejoExists(parsedData.tipoManejoId);

        const manejo = await this.repository.create(parsedData);

        // Regra especial: Pesagem → atualiza pesoMedioAtual do rebanho
        if (parsedData.pesoRegistrado != null) {
            await this.rebanhoRepository.update(parsedData.rebanhoId, {
                pesoMedioAtual: parsedData.pesoRegistrado,
            });
        }

        return manejo;
    }

    async update(id, parsedData, req) {
        const usuarioId = req.user.id;
        await this.ensureManejoExists(id, usuarioId);

        if (parsedData.tipoManejoId) {
            await this.ensureTipoManejoExists(parsedData.tipoManejoId);
        }

        return this.repository.update(id, parsedData);
    }

    async remove(id, req) {
        const usuarioId = req.user.id;
        await this.ensureManejoExists(id, usuarioId);
        return this.repository.remove(id);
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
