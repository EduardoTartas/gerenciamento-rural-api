
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import sharp from 'sharp';
import { uploadRepository } from '../repository/index.js';
import { CustomError, HttpStatusCodes } from '../utils/helpers/index.js';

const EXTENSOES_VALIDAS = ['jpg', 'jpeg', 'png'];
const MIME_TYPES_VALIDOS = ['image/jpeg', 'image/png'];
const MB = 1024 * 1024;

export const PERFIS_DE_IMAGEM = {
    avatar: {
        maxBytes: 5 * MB,
        resize: [512, 512, { fit: 'cover', withoutEnlargement: true }],
        jpeg: { quality: 80, progressive: true, mozjpeg: true },
    },
    atividade: {
        maxBytes: 10 * MB,
        resize: [1600, 1600, { fit: 'inside', withoutEnlargement: true }],
        jpeg: { quality: 75, mozjpeg: true },
    },
};

class UploadService {
    constructor() {
        this.repository = uploadRepository;
    }

    async processarImagem(file, { perfil = 'avatar', fileName = `${uuidv4()}.jpeg` } = {}) {
        const regra = PERFIS_DE_IMAGEM[perfil];

        if (!file) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'file',
                customMessage: 'Nenhum arquivo enviado.',
            });
        }

        if (file.truncated) {
            throw new CustomError({
                statusCode: HttpStatusCodes.PAYLOAD_TOO_LARGE.code,
                errorType: 'validationError',
                field: 'file',
                customMessage: 'Arquivo excede o limite de 50MB aceito pelo servidor.',
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

        if (file.size > regra.maxBytes) {
            throw new CustomError({
                statusCode: HttpStatusCodes.BAD_REQUEST.code,
                errorType: 'validationError',
                field: 'file',
                customMessage: `Arquivo excede o tamanho máximo de ${regra.maxBytes / MB}MB.`,
            });
        }

        let buffer;
        try {
            buffer = await sharp(file.data)
                .rotate()
                .resize(...regra.resize)
                .jpeg(regra.jpeg)
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

    async deletarImagem(url) {
        if (!url) return;
        await this.repository.deleteFile(url);
    }
}

export default UploadService;
