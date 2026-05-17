// src/app.js

import cors from "cors";
import helmet from "helmet";
import errorHandler from './utils/helpers/errorHandler.js';
import logger from './utils/logger.js';
import DbConnect from './config/dbConnect.js';
import { auth } from './config/auth.js';
import { toNodeHandler } from 'better-auth/node';
import routes from './routes/index.js';
import CommonResponse from './utils/helpers/CommonResponse.js';
import express from "express";
import expressFileUpload from "express-fileupload";
import compression from 'compression';
import { strictRateLimit } from './middlewares/RateLimitMiddleware.js';

const app = express();

await DbConnect.connect();

// Middlewares de segurança
// Desabilita CSP para a rota do Swagger (que precisa de inline scripts/styles)
// Aplica CSP restritiva para todas as outras rotas
app.use('/docs', helmet({ contentSecurityPolicy: false }));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "blob:"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://static.cloudflareinsights.com"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            fontSrc: ["'self'", "data:"],
        }
    }
}));

// Habilitando CORS — aceita requests sem Origin (mobile apps, Postman)
// e whitelist de origens para ambientes web (Swagger UI, admin panel)
const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, cb) => {
        // Permite requests sem Origin (apps mobile nativos, curl, Postman)
        if (!origin) return cb(null, true);
        // Permite wildcard (*)
        if (allowedOrigins.includes('*')) return cb(null, true);
        // Permite origens na whitelist
        if (allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error('Bloqueado pelo CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
}));

// Habilitando a compressão de respostas
app.use(compression());

// Configuração de proxy para Cloudflare Tunnel
// Confia em proxies locais (loopback) para ler corretamente X-Forwarded-For / CF-Connecting-IP
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

// =============================================
// BetterAuth handler — DEVE vir ANTES de express.json()
// O BetterAuth faz seu próprio parsing do body
// =============================================
app.all('/api/auth/{*any}', strictRateLimit, toNodeHandler(auth));

// Habilitando o uso de json pelo express (APÓS BetterAuth handler)
app.use(express.json());

// Habilitando o uso de arquivos pelo express, com limite de segurança em memória de 50MB
app.use(expressFileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // Trava em 50MB para não esgotar a RAM
    abortOnLimit: true // Rejeita a requisição e poupa a banda automaticamente se passar
}));

// Habilitando o uso de urlencoded pelo express
app.use(express.urlencoded({ extended: true }));

// Servindo arquivos estáticos da pasta public
app.use('/public', express.static('public'));

// Passando para o arquivo de rotas o app
routes(app);

// Middleware para lidar com rotas não encontradas (404)
app.use((req, res, next) => {
    return CommonResponse.error(
        res,
        404,
        'resourceNotFound',
        null,
        [{
            message: 'Rota não encontrada.'
        }]
    );
});

// Listener para erros não tratados
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception thrown:', error);
});

// Middleware de Tratamento de Erros (deve ser adicionado após as rotas)
app.use(errorHandler);

// Exportando para o server.js fazer uso
export default app;
