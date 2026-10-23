
import cors from "cors";
import helmet from "helmet";
import errorHandler from './utils/helpers/errorHandler.js';
import logger from './utils/logger.js';
import DbConnect from './config/dbConnect.js';
import { ensureGarageEnv } from './config/garageConnect.js';
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
ensureGarageEnv();

app.use((req, res, next) => {
    if (req.path.startsWith('/v1/docs') || req.path.startsWith('/docs')) {
        return helmet({ contentSecurityPolicy: false })(req, res, next);
    }
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "blob:"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://static.cloudflareinsights.com"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                fontSrc: ["'self'", "data:"],
            }
        }
    })(req, res, next);
});

const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        // permite wildcard (*)
        if (allowedOrigins.includes('*')) return cb(null, true);
        // permite origens na whitelist
        if (allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error('Bloqueado pelo CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
}));

// habilitando a compressão de respostas
app.use(compression());

app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

app.all('/api/auth/{*any}', strictRateLimit, toNodeHandler(auth));

app.use(express.json());

app.use(expressFileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // trava em 50MB para não esgotar a RAM
    abortOnLimit: false
}));

// habilitando o uso de urlencoded pelo express
app.use(express.urlencoded({ extended: true }));

// servindo arquivos estáticos da pasta public
app.use('/public', express.static('public'));

// passando para o arquivo de rotas o app
routes(app);

// middleware para lidar com rotas não encontradas (404)
app.use((req, res, next) => {
    return CommonResponse.error(
        res,
        404,
        'resourceNotFound',
        null,
        [{
            message: 'Rota não encontrada.'
        }],
        'Rota não encontrada.'
    );
});

// listener para erros não tratados
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception thrown:', error);
});

app.use(errorHandler);

// exportando para o server.js fazer uso
export default app;
