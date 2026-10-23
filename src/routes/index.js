
import express from 'express';
import logRoutes from '../middlewares/LogRoutesMiddleware.js';
import dotenv from 'dotenv';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUI from 'swagger-ui-express';
import getSwaggerOptions from '../docs/config/head.js';
import DbConnect from '../config/dbConnect.js';
import { authRateLimit } from '../middlewares/RateLimitMiddleware.js';

// importação de rotas
import userRoutes from './userRoutes.js';
import propriedadeRoutes from './propriedadeRoutes.js';
import pastoRoutes from './pastoRoutes.js';
import manejoPastoRoutes from './manejoPastoRoutes.js';
import catalogoRoutes from './catalogoRoutes.js';
import rebanhoRoutes from './rebanhoRoutes.js';
import manejoRebanhoRoutes from './manejoRebanhoRoutes.js';
import fotoAtividadeRoutes from './fotoAtividadeRoutes.js';
import movimentacaoRoutes from './movimentacaoRoutes.js';
import saidaRebanhoRoutes from './saidaRebanhoRoutes.js';
import insumoRoutes from './insumoRoutes.js';
import regimeConsumoRoutes from './regimeConsumoRoutes.js';
import syncRoutes from './syncRoutes.js';
import uploadRoutes from './uploadRoutes.js';
import notificacaoRoutes from './notificacaoRoutes.js';

dotenv.config();

const swaggerMiddlewarePromise = (async () => {
    const opts = await getSwaggerOptions();
    const swaggerDocs = swaggerJSDoc(opts);
    return swaggerUI.setup(swaggerDocs, {
        customSiteTitle: 'Pasto Livre API Docs',
    });
})();

const routes = (app) => {
    // middleware de log para debug
    if (process.env.DEBUGLOG) {
        app.use(logRoutes);
    }

    app.get('/', (req, res) => {
        res.redirect('/v1/docs');
    });

    app.use('/v1/docs', (req, res, next) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        next();
    }, swaggerUI.serve, (req, res, next) => {
        swaggerMiddlewarePromise
            .then((setup) => setup(req, res, next))
            .catch(next);
    });

    // endpoint de verificação de saúde (health check)
    app.get('/health', async (req, res) => {
        let isConnected = false;
        try {
            await DbConnect.prisma.$queryRaw`SELECT 1`;
            isConnected = true;
        } catch {
            isConnected = false;
        }

        res.status(isConnected ? 200 : 503).json({
            status: isConnected ? 'healthy' : 'unhealthy',
            database: isConnected ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    });

    app.use('/v1',
        authRateLimit,
        userRoutes,
        propriedadeRoutes,
        catalogoRoutes,
        manejoPastoRoutes,
        manejoRebanhoRoutes,
        fotoAtividadeRoutes,
        movimentacaoRoutes,
        saidaRebanhoRoutes,
        insumoRoutes,
        regimeConsumoRoutes,
        pastoRoutes,
        rebanhoRoutes,
        syncRoutes,
        uploadRoutes,
        notificacaoRoutes,
    );
};

export default routes;
