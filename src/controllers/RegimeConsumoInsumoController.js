// src/controllers/RegimeConsumoInsumoController.js
import RegimeConsumoInsumoService from '../service/RegimeConsumoInsumoService.js';
import {
    RegimeConsumoInsumoCreateSchema,
    RegimeConsumoInsumoUpdateSchema,
} from '../utils/validators/schemas/zod/RegimeConsumoInsumoSchema.js';
import {
    RegimeConsumoInsumoQuerySchema,
    RegimeConsumoInsumoIdSchema,
} from '../utils/validators/schemas/zod/querys/RegimeConsumoInsumoQuerySchema.js';
import { CommonResponse, CustomError, HttpStatusCodes } from '../utils/helpers/index.js';

class RegimeConsumoInsumoController {
    constructor() {
        this.service = new RegimeConsumoInsumoService();
    }

    async list(req, res) {
        const { id } = req.params;
        if (id) RegimeConsumoInsumoIdSchema.parse(id);

        const query = req?.query;
        if (query && Object.keys(query).length !== 0) {
            req._parsedQuery = await RegimeConsumoInsumoQuerySchema.parseAsync(query);
        }

        const data = await this.service.list(req);

        if (id) {
            return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Regime de consumo encontrado com sucesso.');
        }
        const totalDocs = data?.totalDocs ?? 0;
        const msg = totalDocs === 0
            ? 'Nenhum regime de consumo cadastrado.'
            : `${totalDocs} regime(s) de consumo encontrado(s).`;
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, msg);
    }

    async create(req, res) {
        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [{ path: 'body', message: 'O corpo da requisição não pode estar vazio.' }],
                customMessage: 'Forneça os dados do regime de consumo.',
            });
        }
        const parsedData = RegimeConsumoInsumoCreateSchema.parse(req.body);
        const data = await this.service.create(parsedData, req);
        return CommonResponse.created(res, data, 'Regime de consumo cadastrado com sucesso.');
    }

    async update(req, res) {
        const { id } = req.params;
        RegimeConsumoInsumoIdSchema.parse(id);
        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [{ path: 'body', message: 'O corpo da requisição não pode estar vazio.' }],
                customMessage: 'Forneça pelo menos um campo para atualizar.',
            });
        }
        const parsedData = RegimeConsumoInsumoUpdateSchema.parse(req.body);
        const data = await this.service.update(id, parsedData, req);
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Regime de consumo atualizado com sucesso.');
    }

    async remove(req, res) {
        const { id } = req.params;
        RegimeConsumoInsumoIdSchema.parse(id);
        const data = await this.service.remove(id, req);
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Regime de consumo encerrado com sucesso.');
    }
}

export default RegimeConsumoInsumoController;
