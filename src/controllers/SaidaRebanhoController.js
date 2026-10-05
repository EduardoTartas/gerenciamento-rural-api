// src/controllers/SaidaRebanhoController.js

import SaidaRebanhoService from '../service/SaidaRebanhoService.js';
import { SaidaRebanhoCreateSchema } from '../utils/validators/schemas/zod/SaidaRebanhoSchema.js';
import { SaidaRebanhoQuerySchema, SaidaRebanhoIdSchema } from '../utils/validators/schemas/zod/querys/SaidaRebanhoQuerySchema.js';
import { CommonResponse, CustomError, HttpStatusCodes } from '../utils/helpers/index.js';

class SaidaRebanhoController {
    constructor() {
        this.service = new SaidaRebanhoService();
    }

    /**
     * Lista saídas de animais (geral ou por ID).
     * GET /rebanhos/saidas
     * GET /rebanhos/saidas/:id
     */
    async list(req, res) {
        const { id } = req.params;

        if (id) SaidaRebanhoIdSchema.parse(id);

        const query = req?.query;
        if (query && Object.keys(query).length !== 0) {
            req._parsedQuery = await SaidaRebanhoQuerySchema.parseAsync(query);
        }

        const data = await this.service.list(req);

        if (id) {
            return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Saída encontrada com sucesso.');
        }

        const totalDocs = data?.totalDocs ?? 0;
        if (totalDocs === 0) {
            const hasFilters = query && (query.rebanhoId || query.propriedadeId || query.motivo);
            const message = hasFilters
                ? 'Nenhuma saída encontrada com os filtros informados.'
                : 'Nenhuma saída registrada.';
            return CommonResponse.success(res, data, HttpStatusCodes.OK.code, message);
        }

        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, `${totalDocs} saída(s) encontrada(s).`);
    }

    /**
     * Registra a saída de animais de um rebanho.
     * POST /rebanhos/saidas
     */
    async create(req, res) {
        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [{ path: 'body', message: 'O corpo da requisição não pode estar vazio.' }],
                customMessage: 'Forneça os dados da saída.',
            });
        }

        const parsedData = SaidaRebanhoCreateSchema.parse(req.body);
        const data = await this.service.create(parsedData, req);

        const message = data.finalizouRebanho
            ? 'Saída registrada e rebanho finalizado.'
            : 'Saída registrada com sucesso.';
        return CommonResponse.created(res, data, message);
    }
}

export default SaidaRebanhoController;
