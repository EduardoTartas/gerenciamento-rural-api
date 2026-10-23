
import SyncService from '../service/SyncService.js';
import { CommonResponse, HttpStatusCodes } from '../utils/helpers/index.js';
import { SyncLoteSchema } from '../utils/validators/schemas/zod/SyncSchema.js';

class SyncController {
    constructor() {
        this.service = new SyncService();
    }

    async aplicar(req, res) {
        const { mutacoes } = SyncLoteSchema.parse(req.body);

        const { resultados } = await this.service.aplicarLote(mutacoes, req);

        const aceitas = resultados.filter((r) => r.situacao === 'aceito').length;

        return CommonResponse.success(
            res,
            { resultados },
            HttpStatusCodes.OK.code,
            `${aceitas} de ${resultados.length} mutações aplicadas.`,
        );
    }
}

export default SyncController;
