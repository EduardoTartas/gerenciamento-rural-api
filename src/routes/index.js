// src/routes/index.js

import express from 'express';
import logRoutes from '../middlewares/LogRoutesMiddleware.js';
import dotenv from 'dotenv';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUI from 'swagger-ui-express';
import getSwaggerOptions from '../docs/config/head.js';
import DbConnect from '../config/dbConnect.js';
import { authRateLimit } from '../middlewares/RateLimitMiddleware.js';

// Importação de rotas
import userRoutes from './userRoutes.js';
import propriedadeRoutes from './propriedadeRoutes.js';
import pastoRoutes from './pastoRoutes.js';
import manejoPastoRoutes from './manejoPastoRoutes.js';
import catalogoRoutes from './catalogoRoutes.js';
import rebanhoRoutes from './rebanhoRoutes.js';
import manejoRebanhoRoutes from './manejoRebanhoRoutes.js';
import movimentacaoRoutes from './movimentacaoRoutes.js';

dotenv.config();

const swaggerMiddlewarePromise = (async () => {
    const opts = await getSwaggerOptions();
    const swaggerDocs = swaggerJSDoc(opts);
    return swaggerUI.setup(swaggerDocs, {
        customSiteTitle: 'Pasto Livre API Docs',
    });
})();

const routes = (app) => {
    // Middleware de log para debug
    if (process.env.DEBUGLOG) {
        app.use(logRoutes);
    }

    app.get('/', (req, res) => {
        res.redirect('/docs');
    });

    app.use('/docs', swaggerUI.serve, (req, res, next) => {
        swaggerMiddlewarePromise
            .then((setup) => setup(req, res, next))
            .catch(next);
    });

    // Endpoint de verificação de saúde (health check)
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

    // Registro de todas as rotas (com rate limiting geral para rotas autenticadas)
    // IMPORTANTE: rotas específicas de /rebanhos/* devem vir ANTES de rebanhoRoutes
    // para evitar que GET /rebanhos/:id capture /rebanhos/manejos e /rebanhos/movimentacoes
    app.use(
        authRateLimit,
        userRoutes,
        propriedadeRoutes,
        catalogoRoutes,
        manejoPastoRoutes,
        pastoRoutes,
        manejoRebanhoRoutes,
        movimentacaoRoutes,
        rebanhoRoutes,
    );
};

export default routes;
