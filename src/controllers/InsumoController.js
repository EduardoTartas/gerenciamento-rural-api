// src/controllers/InsumoController.js
import InsumoService from '../service/InsumoService.js';
import { InsumoCreateSchema, InsumoUpdateSchema } from '../utils/validators/schemas/zod/InsumoSchema.js';
import { InsumoQuerySchema, InsumoIdSchema } from '../utils/validators/schemas/zod/querys/InsumoQuerySchema.js';
import { CommonResponse, CustomError, HttpStatusCodes } from '../utils/helpers/index.js';

class InsumoController {
    constructor() {
        this.service = new InsumoService();
    }

    async list(req, res) {
        const { id } = req.params;
        if (id) InsumoIdSchema.parse(id);

        const query = req?.query;
        if (query && Object.keys(query).length !== 0) {
            req._parsedQuery = await InsumoQuerySchema.parseAsync(query);
        }

        const data = await this.service.list(req);

        if (id) {
            return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Insumo encontrado com sucesso.');
        }
        const totalDocs = data?.totalDocs ?? 0;
        const msg = totalDocs === 0
            ? 'Nenhum insumo cadastrado.'
            : `${totalDocs} insumo(s) encontrado(s).`;
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, msg);
    }

    async create(req, res) {
        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [{ path: 'body', message: 'O corpo da requisição não pode estar vazio.' }],
                customMessage: 'Forneça os dados do insumo.',
            });
        }
        const parsedData = InsumoCreateSchema.parse(req.body);
        const data = await this.service.create(parsedData, req);
        return CommonResponse.created(res, data, 'Insumo cadastrado com sucesso.');
    }

    async update(req, res) {
        const { id } = req.params;
        InsumoIdSchema.parse(id);
        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [{ path: 'body', message: 'O corpo da requisição não pode estar vazio.' }],
                customMessage: 'Forneça pelo menos um campo para atualizar.',
            });
        }
        const parsedData = InsumoUpdateSchema.parse(req.body);
        const data = await this.service.update(id, parsedData, req);
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Insumo atualizado com sucesso.');
    }

    async remove(req, res) {
        const { id } = req.params;
        InsumoIdSchema.parse(id);
        const data = await this.service.remove(id, req);
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Insumo excluído com sucesso.');
    }
}

export default InsumoController;
