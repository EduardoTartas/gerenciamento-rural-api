// src/controllers/ManejoPastoController.js

import ManejoPastoService from '../service/ManejoPastoService.js';
import { ManejoPastoCreateSchema, ManejoPastoUpdateSchema } from '../utils/validators/schemas/zod/ManejoPastoSchema.js';
import {
    ManejoPastoQuerySchema,
    ManejoPastoIdSchema,
} from '../utils/validators/schemas/zod/querys/ManejoPastoQuerySchema.js';
import {
    CommonResponse,
    CustomError,
    HttpStatusCodes,
} from '../utils/helpers/index.js';

class ManejoPastoController {
    constructor() {
        this.service = new ManejoPastoService();
    }

    /**
     * Lista os manejos de pasto (Geral ou por ID).
     * GET /pastagens/manejos
     * GET /pastagens/manejos/:id
     */
    async list(req, res) {
        const { id } = req.params;

        if (id) {
            ManejoPastoIdSchema.parse(id);
        }

        const query = req?.query;
        if (query && Object.keys(query).length !== 0) {
            await ManejoPastoQuerySchema.parseAsync(query);
        }

        const data = await this.service.list(req);

        if (id) {
            return CommonResponse.success(
                res,
                data,
                HttpStatusCodes.OK.code,
                'Manejo de pasto encontrado com sucesso.',
            );
        }

        const totalDocs = data?.totalDocs ?? data?.docs?.length ?? 0;
        if (totalDocs === 0) {
            const hasFilters = query && (query.pastoId || query.propriedadeId || query.tipoManejo);
            const message = hasFilters
                ? 'Nenhum manejo de pasto encontrado com os filtros informados.'
                : 'Nenhum manejo de pasto cadastrado.';
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
            `${totalDocs} manejo(s) de pasto encontrado(s).`,
        );
    }

    /**
     * Cria um novo manejo de pasto.
     * POST /pastagens/manejos
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
                customMessage: 'Forneça os dados do manejo de pasto.',
            });
        }

        const parsedData = ManejoPastoCreateSchema.parse(req.body);
        const data = await this.service.create(parsedData, req);

        return CommonResponse.created(
            res,
            data,
            'Manejo de pasto registrado com sucesso.',
        );
    }

    /**
     * Atualiza um manejo de pasto existente.
     * PATCH /pastagens/manejos/:id
     */
    async update(req, res) {
        const { id } = req.params;
        ManejoPastoIdSchema.parse(id);

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

        const parsedData = ManejoPastoUpdateSchema.parse(req.body);
        const data = await this.service.update(id, parsedData, req);

        return CommonResponse.success(
            res,
            data,
            HttpStatusCodes.OK.code,
            'Manejo de pasto atualizado com sucesso.',
        );
    }

    /**
     * Remove um manejo de pasto.
     * DELETE /pastagens/manejos/:id
     */
    async remove(req, res) {
        const { id } = req.params;
        ManejoPastoIdSchema.parse(id);

        const data = await this.service.remove(id, req);
        return CommonResponse.success(
            res,
            data,
            HttpStatusCodes.OK.code,
            'Manejo de pasto excluído com sucesso.',
        );
    }
}

export default ManejoPastoController;
