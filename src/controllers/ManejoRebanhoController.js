// src/controllers/ManejoRebanhoController.js

import ManejoRebanhoService from '../service/ManejoRebanhoService.js';
import { ManejoRebanhoCreateSchema, ManejoRebanhoUpdateSchema } from '../utils/validators/schemas/zod/ManejoRebanhoSchema.js';
import { ManejoRebanhoQuerySchema, ManejoRebanhoIdSchema } from '../utils/validators/schemas/zod/querys/ManejoRebanhoQuerySchema.js';
import { CommonResponse, CustomError, HttpStatusCodes } from '../utils/helpers/index.js';

class ManejoRebanhoController {
    constructor() {
        this.service = new ManejoRebanhoService();
    }

    async list(req, res) {
        const { id } = req.params;

        if (id) ManejoRebanhoIdSchema.parse(id);

        const query = req?.query;
        if (query && Object.keys(query).length !== 0) {
            await ManejoRebanhoQuerySchema.parseAsync(query);
        }

        const data = await this.service.list(req);

        if (id) {
            return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Manejo de rebanho encontrado com sucesso.');
        }

        const totalDocs = data?.totalDocs ?? 0;
        if (totalDocs === 0) {
            const hasFilters = query && (query.rebanhoId || query.propriedadeId || query.tipoManejoId);
            const message = hasFilters
                ? 'Nenhum manejo encontrado com os filtros informados.'
                : 'Nenhum manejo de rebanho cadastrado.';
            return CommonResponse.success(res, data, HttpStatusCodes.OK.code, message);
        }

        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, `${totalDocs} manejo(s) de rebanho encontrado(s).`);
    }

    async create(req, res) {
        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [{ path: 'body', message: 'O corpo da requisição não pode estar vazio.' }],
                customMessage: 'Forneça os dados do manejo de rebanho.',
            });
        }

        const parsedData = ManejoRebanhoCreateSchema.parse(req.body);
        const data = await this.service.create(parsedData, req);

        return CommonResponse.created(res, data, 'Manejo de rebanho registrado com sucesso.');
    }

    async update(req, res) {
        const { id } = req.params;
        ManejoRebanhoIdSchema.parse(id);

        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [{ path: 'body', message: 'O corpo da requisição não pode estar vazio.' }],
                customMessage: 'Forneça pelo menos um campo para atualizar.',
            });
        }

        const parsedData = ManejoRebanhoUpdateSchema.parse(req.body);
        const data = await this.service.update(id, parsedData, req);

        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Manejo de rebanho atualizado com sucesso.');
    }

    async remove(req, res) {
        const { id } = req.params;
        ManejoRebanhoIdSchema.parse(id);

        const data = await this.service.remove(id, req);
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Manejo de rebanho excluído com sucesso.');
    }
}

export default ManejoRebanhoController;
