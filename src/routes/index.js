// src/routes/index.js

import express from 'express';
import logRoutes from '../middlewares/LogRoutesMiddleware.js';
import dotenv from 'dotenv';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUI from 'swagger-ui-express';
import getSwaggerOptions from '../docs/config/head.js';

// Importação das rotas


dotenv.config();

const swaggerMiddlewarePromise = (async () => {
    const opts = await getSwaggerOptions();
    const swaggerDocs = swaggerJSDoc(opts);
    return swaggerUI.setup(swaggerDocs, {
        customSiteTitle: 'Pasto Livre API Docs',
    });
})();

const routes = (app) => {
    // Middleware de log, se ativado
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

    // Health check endpoint
    app.get('/health', (req, res) => {
        const isConnected = mongoose.connection.readyState === 1;

        res.status(isConnected ? 200 : 503).json({
            status: isConnected ? 'healthy' : 'unhealthy',
            database: isConnected ? 'connected' : 'disconnected',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    });

    // Registra todas as rotas
    app.use(
        express.json(),
    );
};

export default routes;
