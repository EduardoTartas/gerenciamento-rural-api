// src/controllers/CatalogoController.js

import CatalogoService from '../service/CatalogoService.js';
import { CatalogoCreateSchema, CatalogoUpdateSchema } from '../utils/validators/schemas/zod/CatalogoSchema.js';
import { CatalogoQuerySchema, CatalogoIdSchema } from '../utils/validators/schemas/zod/querys/CatalogoQuerySchema.js';
import { CommonResponse, CustomError, HttpStatusCodes } from '../utils/helpers/index.js';

class CatalogoController {
    constructor() {
        this.service = new CatalogoService();
    }

    /**
     * Lista itens de catálogo (geral ou por ID).
     * GET /catalogos/:entidade
     * GET /catalogos/:entidade/:id
     */
    async list(req, res) {
        const { id } = req.params;

        if (id) {
            CatalogoIdSchema.parse(id);
        }

        let parsedQuery = {};
        const query = req?.query;
        if (query && Object.keys(query).length !== 0) {
            parsedQuery = await CatalogoQuerySchema.parseAsync(query);
        }

        const data = await this.service.list(req, parsedQuery);

        if (id) {
            return CommonResponse.success(res, data, HttpStatusCodes.OK.code, `${data.nome} encontrado(a) com sucesso.`);
        }

        const totalDocs = data?.totalDocs ?? 0;
        const message = totalDocs === 0
            ? 'Nenhum item encontrado neste catálogo.'
            : `${totalDocs} item(ns) encontrado(s).`;

        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, message);
    }

    /**
     * Cria novo item de catálogo.
     * POST /catalogos/:entidade
     */
    async create(req, res) {
        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [{ path: 'body', message: 'O corpo da requisição não pode estar vazio.' }],
                customMessage: 'Forneça os dados do item de catálogo.',
            });
        }

        const parsedData = CatalogoCreateSchema.parse(req.body);
        const data = await this.service.create(parsedData, req);

        return CommonResponse.created(res, data, 'Item de catálogo criado com sucesso.');
    }

    /**
     * Atualiza item de catálogo.
     * PATCH /catalogos/:entidade/:id
     */
    async update(req, res) {
        const { id } = req.params;
        CatalogoIdSchema.parse(id);

        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [{ path: 'body', message: 'O corpo da requisição não pode estar vazio.' }],
                customMessage: 'Forneça pelo menos um campo para atualizar.',
            });
        }

        const parsedData = CatalogoUpdateSchema.parse(req.body);
        const data = await this.service.update(id, parsedData, req);

        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Item de catálogo atualizado com sucesso.');
    }

    /**
     * Remove (soft-delete) item de catálogo.
     * DELETE /catalogos/:entidade/:id
     */
    async remove(req, res) {
        const { id } = req.params;
        CatalogoIdSchema.parse(id);

        const data = await this.service.remove(id, req);
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Item de catálogo removido com sucesso.');
    }
}

export default CatalogoController;
