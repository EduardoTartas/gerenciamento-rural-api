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
import insumoRoutes from './insumoRoutes.js';
import syncRoutes from './syncRoutes.js';
import uploadRoutes from './uploadRoutes.js';

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
        res.redirect('/v1/docs');
    });

    // Middleware para impedir que o Cloudflare faça cache da documentação
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
    // Ordem: rotas específicas ANTES de rotas genéricas (/:id), caso contrário
    // GET /rebanhos/:id captura /rebanhos/manejos e /rebanhos/movimentacoes
    //
    // `manejoPastoRoutes` vinha DEPOIS de `pastoRoutes` e caía nessa armadilha:
    // `/pastagens/:id` engolia `/pastagens/manejos`, que respondia 400 "ID de
    // pastagem inválido" para toda listagem de manejo de pasto — inclusive a
    // leitura por diferença.
    app.use('/v1',
        authRateLimit,
        userRoutes,
        propriedadeRoutes,
        catalogoRoutes,
        manejoPastoRoutes,
        manejoRebanhoRoutes,
        movimentacaoRoutes,
        insumoRoutes,
        pastoRoutes,
        rebanhoRoutes,
        syncRoutes,
        uploadRoutes,
    );
};

export default routes;
