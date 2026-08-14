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
];

let garageClient = null;

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
