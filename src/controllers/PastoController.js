// src/controllers/PastoController.js

import PastoService from '../service/PastoService.js';
import { PastoCreateSchema, PastoUpdateSchema } from '../utils/validators/schemas/zod/PastoSchema.js';
import {
    PastoQuerySchema,
    PastoIdSchema,
} from '../utils/validators/schemas/zod/querys/PastoQuerySchema.js';
import {
    CommonResponse,
    CustomError,
    HttpStatusCodes,
} from '../utils/helpers/index.js';

class PastoController {
    constructor() {
        this.service = new PastoService();
    }

    /**
     * Lista os pastos (Geral ou por ID).
     * GET /pastagens
     * GET /pastagens/:id
     */
    async list(req, res) {
        const { id } = req.params;

        if (id) {
            PastoIdSchema.parse(id);
        }

        const query = req?.query;
        if (query && Object.keys(query).length !== 0) {
            await PastoQuerySchema.parseAsync(query);
        }

        const data = await this.service.list(req);

        if (id) {
            return CommonResponse.success(
                res,
                data,
                HttpStatusCodes.OK.code,
                'Pastagem encontrada com sucesso.',
            );
        }

        const totalDocs = data?.totalDocs ?? data?.docs?.length ?? 0;
        if (totalDocs === 0) {
            const hasFilters = query && (query.nome || query.propriedadeId || query.status || query.tipoPastagem);
            const message = hasFilters
                ? 'Nenhuma pastagem encontrada com os filtros informados.'
                : 'Nenhuma pastagem cadastrada.';
            return CommonResponse.success(
                res,
                data,
                HttpStatusCodes.OK.code,
                message,
            );
        }

        return CommonResponse.success(
            res,
            data,
            HttpStatusCodes.OK.code,
            `${totalDocs} pastagem(ns) encontrada(s).`,
        );
    }

    /**
     * Cria uma nova pastagem.
     * POST /pastagens
     */
    async create(req, res) {
        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [
                    {
                        path: 'body',
                        message: 'O corpo da requisição não pode estar vazio.',
                    },
                ],
                customMessage: 'Forneça os dados da pastagem.',
            });
        }

        const parsedData = PastoCreateSchema.parse(req.body);
        const data = await this.service.create(parsedData, req);

        return CommonResponse.created(
            res,
            data,
            'Pastagem criada com sucesso.',
        );
    }

    /**
     * Atualiza uma pastagem existente.
     * PATCH /pastagens/:id
     */
    async update(req, res) {
        const { id } = req.params;
        PastoIdSchema.parse(id);

        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [
                    {
                        path: 'body',
                        message: 'O corpo da requisição não pode estar vazio.',
                    },
                ],
                customMessage: 'Forneça pelo menos um campo para atualizar.',
            });
        }

        const parsedData = PastoUpdateSchema.parse(req.body);
        const data = await this.service.update(id, parsedData, req);

        return CommonResponse.success(
            res,
            data,
            HttpStatusCodes.OK.code,
            'Pastagem atualizada com sucesso.',
        );
    }

    /**
     * Remove uma pastagem.
     * DELETE /pastagens/:id
     */
    async remove(req, res) {
        const { id } = req.params;
        PastoIdSchema.parse(id);

        const data = await this.service.remove(id, req);
        return CommonResponse.success(
            res,
            data,
            HttpStatusCodes.OK.code,
            'Pastagem excluída com sucesso.',
        );
    }
}

export default PastoController;
