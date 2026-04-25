// src/controllers/RebanhoController.js

import RebanhoService from '../service/RebanhoService.js';
import { RebanhoCreateSchema, RebanhoUpdateSchema } from '../utils/validators/schemas/zod/RebanhoSchema.js';
import { RebanhoQuerySchema, RebanhoIdSchema } from '../utils/validators/schemas/zod/querys/RebanhoQuerySchema.js';
import { CommonResponse, CustomError, HttpStatusCodes } from '../utils/helpers/index.js';

class RebanhoController {
    constructor() {
        this.service = new RebanhoService();
    }

    /**
     * Lista rebanhos (geral ou por ID).
     * GET /rebanhos
     * GET /rebanhos/:id
     */
    async list(req, res) {
        const { id } = req.params;

        if (id) {
            RebanhoIdSchema.parse(id);
        }

        const query = req?.query;
        if (query && Object.keys(query).length !== 0) {
            await RebanhoQuerySchema.parseAsync(query);
        }

        const data = await this.service.list(req);

        if (id) {
            return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Rebanho encontrado com sucesso.');
        }

        const totalDocs = data?.totalDocs ?? 0;
        if (totalDocs === 0) {
            const hasFilters = query && (query.nomeRebanho || query.propriedadeId || query.racaId || query.sistemaProducaoId);
            const message = hasFilters
                ? 'Nenhum rebanho encontrado com os filtros informados.'
                : 'Nenhum rebanho cadastrado.';
            return CommonResponse.success(res, data, HttpStatusCodes.OK.code, message);
        }

        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, `${totalDocs} rebanho(s) encontrado(s).`);
    }

    /**
     * Cria um novo rebanho.
     * POST /rebanhos
     */
    async create(req, res) {
        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [{ path: 'body', message: 'O corpo da requisição não pode estar vazio.' }],
                customMessage: 'Forneça os dados do rebanho.',
            });
        }

        const parsedData = RebanhoCreateSchema.parse(req.body);
        const data = await this.service.create(parsedData, req);

        return CommonResponse.created(res, data, 'Rebanho criado com sucesso.');
    }

    /**
     * Atualiza um rebanho existente.
     * PATCH /rebanhos/:id
     */
    async update(req, res) {
        const { id } = req.params;
        RebanhoIdSchema.parse(id);

        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [{ path: 'body', message: 'O corpo da requisição não pode estar vazio.' }],
                customMessage: 'Forneça pelo menos um campo para atualizar.',
            });
        }

        const parsedData = RebanhoUpdateSchema.parse(req.body);
        const data = await this.service.update(id, parsedData, req);

        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Rebanho atualizado com sucesso.');
    }

    /**
     * Inativa (soft-delete) um rebanho.
     * DELETE /rebanhos/:id
     */
    async remove(req, res) {
        const { id } = req.params;
        RebanhoIdSchema.parse(id);

        const data = await this.service.remove(id, req);
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Rebanho inativado com sucesso.');
    }
}

export default RebanhoController;
