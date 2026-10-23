
import UploadService from '../service/UploadService.js';
import { CommonResponse } from '../utils/helpers/index.js';

class UploadController {
    constructor() {
        this.service = new UploadService();
    }

    async create(req, res) {
        const file = req.files?.file;
        const data = await this.service.processarImagem(file);

        return CommonResponse.created(res, data, 'Imagem enviada com sucesso.');
    }
}

export default UploadController;
