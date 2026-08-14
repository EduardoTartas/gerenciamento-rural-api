// src/service/UploadService.js

import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import sharp from 'sharp';
import { uploadRepository } from '../repository/index.js';
import { CustomError, HttpStatusCodes } from '../utils/helpers/index.js';

const EXTENSOES_VALIDAS = ['jpg', 'jpeg', 'png'];
const MIME_TYPES_VALIDOS = ['image/jpeg', 'image/png'];
const MAX_BYTES = 5 * 1024 * 1024; // avatar não precisa dos 50MB globais do express-fileupload

class UploadService {
    constructor() {
        this.repository = uploadRepository;
    }

    /**
     * Valida, recomprime (Sharp) e envia uma imagem para o Garage.
     * @param {Object} file - Arquivo do express-fileupload (req.files.file).
     * @returns {Promise<{url: string, fileName: string}>}
     */
    async processarImagem(file) {
        if (!file) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'file',
                customMessage: 'Nenhum arquivo enviado.',
            });
        }

        const ext = file.name ? path.extname(file.name).slice(1).toLowerCase() : '';

        if (!EXTENSOES_VALIDAS.includes(ext)) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'file',
                customMessage: `Extensão inválida (.${ext}). Permitido: ${EXTENSOES_VALIDAS.join(', ')}.`,
            });
        }

        if (!MIME_TYPES_VALIDOS.includes(file.mimetype)) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'file',
                customMessage: 'Tipo de arquivo inválido ou adulterado.',
            });
        }

        if (file.size > MAX_BYTES) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'file',
                customMessage: `Arquivo excede o tamanho máximo de ${MAX_BYTES / (1024 * 1024)}MB.`,
            });
        }

        const fileName = `${uuidv4()}.jpeg`;

        let buffer;
        try {
            buffer = await sharp(file.data)
                .resize(512, 512, { fit: 'cover', withoutEnlargement: true })
                .jpeg({ quality: 80, progressive: true, mozjpeg: true })
                .toBuffer();
        } catch {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'file',
                customMessage: 'Não foi possível processar a imagem enviada.',
            });
        }

        const url = await this.repository.uploadFile(buffer, fileName, 'image/jpeg');

        return { url, fileName };
    }

    /**
     * Remove uma imagem do Garage a partir da URL. Usado tanto para rollback
     * (upload sem cadastro concluído) quanto para descartar avatar antigo.
     */
    async deletarImagem(url) {
        if (!url) return;
        await this.repository.deleteFile(url);
    }
}

export default UploadService;
