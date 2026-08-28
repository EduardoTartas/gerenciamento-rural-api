// src/controllers/MovimentacaoInsumoController.js
import MovimentacaoInsumoService from '../service/MovimentacaoInsumoService.js';
import { MovimentacaoInsumoCreateSchema } from '../utils/validators/schemas/zod/MovimentacaoInsumoSchema.js';
import {
    MovimentacaoInsumoQuerySchema,
    MovimentacaoInsumoIdSchema,
} from '../utils/validators/schemas/zod/querys/MovimentacaoInsumoQuerySchema.js';
import { CommonResponse, CustomError, HttpStatusCodes } from '../utils/helpers/index.js';

class MovimentacaoInsumoController {
    constructor() {
        this.service = new MovimentacaoInsumoService();
    }

    async list(req, res) {
        const { id } = req.params;
        if (id) MovimentacaoInsumoIdSchema.parse(id);

        const query = req?.query;
        if (query && Object.keys(query).length !== 0) {
            req._parsedQuery = await MovimentacaoInsumoQuerySchema.parseAsync(query);
        }
        const data = await this.service.list(req);

        if (id) {
            return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Movimentação encontrada com sucesso.');
        }
        const totalDocs = data?.totalDocs ?? 0;
        const msg = totalDocs === 0
            ? 'Nenhuma movimentação encontrada.'
            : `${totalDocs} movimentação(ões) encontrada(s).`;
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, msg);
    }

    async create(req, res) {
        if (!req.body || Object.keys(req.body).length === 0) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'body',
                details: [{ path: 'body', message: 'O corpo da requisição não pode estar vazio.' }],
                customMessage: 'Forneça os dados da movimentação.',
            });
        }
        const parsedData = MovimentacaoInsumoCreateSchema.parse(req.body);
        const data = await this.service.create(parsedData, req);
        return CommonResponse.created(res, data, 'Movimentação registrada com sucesso.');
    }

    async remove(req, res) {
        const { id } = req.params;
        MovimentacaoInsumoIdSchema.parse(id);
        const data = await this.service.remove(id, req);
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Movimentação excluída com sucesso.');
    }
}

export default MovimentacaoInsumoController;
