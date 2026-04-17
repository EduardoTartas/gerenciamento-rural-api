// src/routes/index.js

import express from 'express';
import logRoutes from '../middlewares/LogRoutesMiddleware.js';
import dotenv from 'dotenv';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUI from 'swagger-ui-express';
import getSwaggerOptions from '../docs/config/head.js';
import DbConnect from '../config/dbConnect.js';

// Importação de rotas
import userRoutes from './userRoutes.js';
import propriedadeRoutes from './propriedadeRoutes.js';
import pastoRoutes from './pastoRoutes.js';
import manejoPastoRoutes from './manejoPastoRoutes.js';

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

    // Middleware para impedir que o Cloudflare faça cache da documentação
    app.use('/docs', (req, res, next) => {
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

    // Registro de todas as rotas
    app.use(
        express.json(),
        userRoutes,
        propriedadeRoutes,
        manejoPastoRoutes,
        pastoRoutes,
    );
};

export default routes;
