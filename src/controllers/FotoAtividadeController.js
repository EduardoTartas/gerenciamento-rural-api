
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

    async list(req, res) {
        req._parsedQuery = await FotoAtividadeQuerySchema.parseAsync(req.query ?? {});
        const data = await this.service.list(req);

        const totalDocs = data?.totalDocs ?? 0;
        const message = totalDocs === 0
            ? 'Nenhuma foto encontrada.'
            : `${totalDocs} foto(s) encontrada(s).`;
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, message);
    }

    async createPasto(req, res) {
        ManejoPastoIdSchema.parse(req.params.id);
        return this._create('pasto', req, res);
    }

    async createRebanho(req, res) {
        ManejoRebanhoIdSchema.parse(req.params.id);
        return this._create('rebanho', req, res);
    }

    async _create(tipo, req, res) {
        const parsedData = FotoAtividadeCreateSchema.parse(req.body ?? {});
        const { foto, criada } = await this.service.create(tipo, req.params.id, parsedData, req.files?.file, req);

        if (!criada) {
            return CommonResponse.success(res, foto, HttpStatusCodes.OK.code, 'Foto já enviada.');
        }
        return CommonResponse.created(res, foto, 'Foto enviada com sucesso.');
    }

    async remove(req, res) {
        const { id } = req.params;
        FotoAtividadeIdSchema.parse(id);

        const data = await this.service.remove(id, req);
        return CommonResponse.success(res, data, HttpStatusCodes.OK.code, 'Foto excluída com sucesso.');
    }
}

export default FotoAtividadeController;
