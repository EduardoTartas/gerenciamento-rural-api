// src/controllers/PropriedadeController.js

import PropriedadeService from '../service/PropriedadeService.js';
import { PropriedadeCreateSchema, PropriedadeUpdateSchema } from '../utils/validators/schemas/zod/PropriedadeSchema.js';
import {
    PropriedadeQuerySchema,
    PropriedadeIdSchema,
} from '../utils/validators/schemas/zod/querys/PropriedadeQuerySchema.js';
import {
    CommonResponse,
    CustomError,
    HttpStatusCodes,
} from '../utils/helpers/index.js';

class PropriedadeController {
    constructor() {
        this.service = new PropriedadeService();
    }

    /**
     * Lista as propriedades (Geral ou por ID).
     * GET /propriedades
     * GET /propriedades/:id
     */
    async list(req, res) {
        const { id } = req.params;

        if (id) {
            PropriedadeIdSchema.parse(id);
        }

        const query = req?.query;
        if (query && Object.keys(query).length !== 0) {
            await PropriedadeQuerySchema.parseAsync(query);
        }

        const data = await this.service.list(req);

        if (id) {
            return CommonResponse.success(
                res,
                data,
                HttpStatusCodes.OK.code,
                'Propriedade encontrada com sucesso.',
            );
        }

        const totalDocs = data?.totalDocs ?? data?.docs?.length ?? 0;
        if (totalDocs === 0) {
            const hasFilters = query && (query.nome || query.localizacao);
            const message = hasFilters
                ? 'Nenhuma propriedade encontrada com os filtros informados.'
                : 'Nenhuma propriedade cadastrada.';
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
            `${totalDocs} propriedade(s) encontrada(s).`,
        );
    }

    /**
     * Cria uma nova propriedade.
     * POST /propriedades
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
                customMessage: 'Forneça os dados da propriedade.',
            });
        }

        const parsedData = PropriedadeCreateSchema.parse(req.body);
        const data = await this.service.create(parsedData, req);

        return CommonResponse.created(
            res,
            data,
            'Propriedade criada com sucesso.',
        );
    }

    /**
     * Atualiza uma propriedade existente.
     * PATCH /propriedades/:id
     */
    async update(req, res) {
        const { id } = req.params;
        PropriedadeIdSchema.parse(id);

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

        const parsedData = PropriedadeUpdateSchema.parse(req.body);
        const data = await this.service.update(id, parsedData, req);

        return CommonResponse.success(
            res,
            data,
            HttpStatusCodes.OK.code,
            'Propriedade atualizada com sucesso.',
        );
    }

    /**
     * Remove uma propriedade.
     * DELETE /propriedades/:id
     */
    async remove(req, res) {
        const { id } = req.params;
        PropriedadeIdSchema.parse(id);

        const data = await this.service.remove(id, req);
        return CommonResponse.success(
            res,
            data,
            HttpStatusCodes.OK.code,
            'Propriedade excluída com sucesso.',
        );
    }
}

export default PropriedadeController;
