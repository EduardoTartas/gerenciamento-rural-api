
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const requiredGarageVars = [
    'GARAGE_ENDPOINT',
    'GARAGE_PORT',
    'GARAGE_ACCESS_KEY',
    'GARAGE_SECRET_KEY',
    'GARAGE_BUCKET_FOTOS',
    'GARAGE_PUBLIC_URL',
];

let garageClient = null;

export function baseUrlPublica(bucket = process.env.GARAGE_BUCKET_FOTOS) {
    if (process.env.GARAGE_PUBLIC_URL) {
        return process.env.GARAGE_PUBLIC_URL.replace(/\/$/, '');
    }

    const protocolo = process.env.GARAGE_USE_SSL === 'true' ? 'https' : 'http';
    return `${protocolo}://${process.env.GARAGE_ENDPOINT}:${process.env.GARAGE_PORT}/${bucket}`;
}

export function ensureGarageEnv() {
    for (const varName of requiredGarageVars) {
        if (!process.env[varName]) {
            const msg = `GARAGE: variável de ambiente '${varName}' não está definida.`;
            logger.error(msg);
            throw new Error(msg);
        }
    }
}

export async function getGarageClient() {
    if (garageClient) return garageClient;

    ensureGarageEnv();

    const Minio = await import('minio');

    garageClient = new Minio.Client({
        endPoint: process.env.GARAGE_ENDPOINT,
        port: parseInt(process.env.GARAGE_PORT, 10),
        useSSL: process.env.GARAGE_USE_SSL === 'true',
        accessKey: process.env.GARAGE_ACCESS_KEY,
        secretKey: process.env.GARAGE_SECRET_KEY,
        region: 'garage',
        pathStyle: true,
    });

    return garageClient;
}

export default getGarageClient;
