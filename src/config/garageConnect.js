// src/config/garageConnect.js

import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const requiredGarageVars = [
    'GARAGE_ENDPOINT',
    'GARAGE_PORT',
    'GARAGE_ACCESS_KEY',
    'GARAGE_SECRET_KEY',
    'GARAGE_BUCKET_FOTOS',
    // Ficava de fora e a ausência não derrubava o boot — mas quebrava o registro
    // de foto de perfil em runtime, longe da causa. Melhor falhar aqui.
    'GARAGE_PUBLIC_URL',
];

let garageClient = null;

/**
 * URL base pública do bucket de fotos, sem barra no fim.
 *
 * Fonte única para quem grava a URL da imagem (`UploadRepository`) e para quem a
 * valida depois (`UserService`): se os dois montarem a base por conta própria, a
 * API chega a gravar uma URL que ela mesma rejeita na etapa seguinte.
 *
 * `GARAGE_PUBLIC_URL` é a verdade — é o endereço que o aplicativo consegue abrir.
 * O caminho por endpoint e porta permanece como rede de segurança para chamadas
 * fora do fluxo de boot, onde `ensureGarageEnv` não rodou.
 */
export function baseUrlPublica(bucket = process.env.GARAGE_BUCKET_FOTOS) {
    if (process.env.GARAGE_PUBLIC_URL) {
        return process.env.GARAGE_PUBLIC_URL.replace(/\/$/, '');
    }

    const protocolo = process.env.GARAGE_USE_SSL === 'true' ? 'https' : 'http';
    return `${protocolo}://${process.env.GARAGE_ENDPOINT}:${process.env.GARAGE_PORT}/${bucket}`;
}

/**
 * Valida as env vars do Garage. Chamada explicitamente no boot da API (server.js/app.js)
 * pra falhar rápido se a config estiver faltando — sem precisar importar `minio` pra isso.
 */
export function ensureGarageEnv() {
    for (const varName of requiredGarageVars) {
        if (!process.env[varName]) {
            const msg = `GARAGE: variável de ambiente '${varName}' não está definida.`;
            logger.error(msg);
            throw new Error(msg);
        }
    }
}

/**
 * Cria o client do Garage sob demanda, na primeira chamada real de upload/delete —
 * nunca na importação do módulo, nem o require do pacote `minio` em si. `repository/
 * index.js` importa todos os repositories num barrel só; carregar `minio` no import
 * faria QUALQUER serviço, mesmo sem relação com upload, pagar esse custo. A validação
 * de env var já rodou no boot via `ensureGarageEnv` — repetida aqui só como garantia
 * pra quem chamar este módulo fora do fluxo normal de boot (ex.: testes isolados).
 */
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
