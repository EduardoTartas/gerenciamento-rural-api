// src/controllers/UploadController.js

import UploadService from '../service/UploadService.js';
import { CommonResponse } from '../utils/helpers/index.js';

class UploadController {
    constructor() {
        this.service = new UploadService();
    }

    /**
     * POST /uploads/imagens
     * Upload genérico: envia o arquivo pro Garage e devolve a URL pública.
     * Não associa a nenhuma entidade — quem chama decide o que fazer com a URL.
     */
    async create(req, res) {
        const file = req.files?.file;
        const data = await this.service.processarImagem(file);

        return CommonResponse.created(res, data, 'Imagem enviada com sucesso.');
    }
}

export default UploadController;
