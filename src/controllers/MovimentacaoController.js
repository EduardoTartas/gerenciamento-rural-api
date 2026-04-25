// src/controllers/MovimentacaoController.js

import MovimentacaoService from '../service/MovimentacaoService.js';
import { MovimentacaoCreateSchema } from '../utils/validators/schemas/zod/MovimentacaoSchema.js';
import { MovimentacaoQuerySchema, MovimentacaoIdSchema } from '../utils/validators/schemas/zod/querys/MovimentacaoQuerySchema.js';
import { CommonResponse, CustomError, HttpStatusCodes } from '../utils/helpers/index.js';

class MovimentacaoController {
    constructor() {
        this.service = new MovimentacaoService();
    }

    /**
     * Lista histórico de movimentações (geral ou por ID).
     * GET /rebanhos/movimentacoes
     * GET /rebanhos/movimentacoes/:id
     */
    async list(req, res) {
        const { id } = req.params;

        if (id) MovimentacaoIdSchema.parse(id);

        const query = req?.query;
        if (query && Object.keys(query).length !== 0) {
            await MovimentacaoQuerySchema.parseAsync(query);
        }

        const data = await this.service.list(req);

        if (id) {
            return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Movimentação encontrada com sucesso.');
        }

        const totalDocs = data?.totalDocs ?? 0;
        if (totalDocs === 0) {
            const hasFilters = query && (query.rebanhoId || query.pastoOrigemId || query.pastoDestinoId);
            const message = hasFilters
                ? 'Nenhuma movimentação encontrada com os filtros informados.'
                : 'Nenhuma movimentação registrada.';
            return CommonResponse.success(res, data, HttpStatusCodes.OK.code, message);
        }

        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, `${totalDocs} movimentação(ões) encontrada(s).`);
    }

    /**
     * Registra uma nova movimentação de rebanho entre pastos.
     * POST /rebanhos/movimentacoes
     */
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

        const parsedData = MovimentacaoCreateSchema.parse(req.body);
        const data = await this.service.create(parsedData, req);

        return CommonResponse.created(res, data, 'Movimentação registrada com sucesso.');
    }
}

export default MovimentacaoController;
