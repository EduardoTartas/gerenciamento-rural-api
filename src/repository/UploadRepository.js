
import getGarageClient, { baseUrlPublica } from '../config/garageConnect.js';
import logger from '../utils/logger.js';
import { CustomError, HttpStatusCodes } from '../utils/helpers/index.js';

class UploadRepository {
    constructor() {
        this.bucket = process.env.GARAGE_BUCKET_FOTOS;
    }

    async uploadFile(buffer, fileName, contentType) {
        try {
            const client = await getGarageClient();
            await client.putObject(this.bucket, fileName, buffer, buffer.length, {
                'Content-Type': contentType,
            });

            return this.buildPublicUrl(fileName);
        } catch (error) {
            logger.error('Falha no upload para o Garage.', { fileName, error: error.message });
            throw new CustomError({
                statusCode: HttpStatusCodes.SERVICE_UNAVAILABLE.code,
                errorType: 'storageError',
                field: 'file',
                customMessage: 'Falha ao enviar o arquivo. Tente novamente mais tarde.',
            });
        }
    }

    async deleteFile(fileNameOrUrl) {
        try {
            const fileName = this.extractFileName(fileNameOrUrl);
            const client = await getGarageClient();
            await client.removeObject(this.bucket, fileName);
        } catch (error) {
            logger.error('Falha ao deletar arquivo do Garage.', { fileNameOrUrl, error: error.message });
            throw new CustomError({
                statusCode: HttpStatusCodes.SERVICE_UNAVAILABLE.code,
                errorType: 'storageError',
                field: 'file',
                customMessage: 'Falha ao remover o arquivo do armazenamento.',
            });
        }
    }

    buildPublicUrl(fileName) {
        return `${baseUrlPublica(this.bucket)}/${fileName}`;
    }

    extractFileName(fileNameOrUrl) {
        const base = `${baseUrlPublica(this.bucket)}/`;
        if (fileNameOrUrl.startsWith(base)) return fileNameOrUrl.slice(base.length);
        if (!/^https?:\/\//.test(fileNameOrUrl)) return fileNameOrUrl;
        const parts = fileNameOrUrl.split('/');
        return parts[parts.length - 1];
    }
}

export default UploadRepository;
