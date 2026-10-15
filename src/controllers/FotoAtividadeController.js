// src/controllers/FotoAtividadeController.js

import FotoAtividadeService from '../service/FotoAtividadeService.js';
import { FotoAtividadeCreateSchema } from '../utils/validators/schemas/zod/FotoAtividadeSchema.js';
import {
    FotoAtividadeIdSchema,
    FotoAtividadeQuerySchema,
} from '../utils/validators/schemas/zod/querys/FotoAtividadeQuerySchema.js';
import { ManejoPastoIdSchema } from '../utils/validators/schemas/zod/querys/ManejoPastoQuerySchema.js';
import { ManejoRebanhoIdSchema } from '../utils/validators/schemas/zod/querys/ManejoRebanhoQuerySchema.js';
import { CommonResponse, HttpStatusCodes } from '../utils/helpers/index.js';

class FotoAtividadeController {
    constructor() {
        this.service = new FotoAtividadeService();
    }

    /**
     * Lista fotos de atividade (leitura por diferença do app).
     * GET /manejos/fotos
     */
    async list(req, res) {
        req._parsedQuery = await FotoAtividadeQuerySchema.parseAsync(req.query ?? {});
        const data = await this.service.list(req);

        const totalDocs = data?.totalDocs ?? 0;
        const message = totalDocs === 0
            ? 'Nenhuma foto encontrada.'
            : `${totalDocs} foto(s) encontrada(s).`;
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, message);
    }

    /**
     * Envia foto de um manejo de pastagem.
     * POST /pastagens/manejos/:id/fotos
     */
    async createPasto(req, res) {
        ManejoPastoIdSchema.parse(req.params.id);
        return this._create('pasto', req, res);
    }

    /**
     * Envia foto de um manejo de rebanho.
     * POST /rebanhos/manejos/:id/fotos
     */
    async createRebanho(req, res) {
        ManejoRebanhoIdSchema.parse(req.params.id);
        return this._create('rebanho', req, res);
    }

    async _create(tipo, req, res) {
        // `multipart/form-data`: os campos de texto chegam em `req.body`, o
        // arquivo em `req.files.file`.
        const parsedData = FotoAtividadeCreateSchema.parse(req.body ?? {});
        const { foto, criada } = await this.service.create(tipo, req.params.id, parsedData, req.files?.file, req);

        if (!criada) {
            return CommonResponse.success(res, foto, HttpStatusCodes.OK.code, 'Foto já enviada.');
        }
        return CommonResponse.created(res, foto, 'Foto enviada com sucesso.');
    }

    /**
     * Exclui uma foto de atividade.
     * DELETE /manejos/fotos/:id
     */
    async remove(req, res) {
        const { id } = req.params;
        FotoAtividadeIdSchema.parse(id);

        const data = await this.service.remove(id, req);
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Foto excluída com sucesso.');
    }
}

export default FotoAtividadeController;
