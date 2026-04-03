// src/routes/index.js

import express from 'express';
import logRoutes from '../middlewares/LogRoutesMiddleware.js';
import dotenv from 'dotenv';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUI from 'swagger-ui-express';
import getSwaggerOptions from '../docs/config/head.js';
import DbConnect from '../config/dbConnect.js';

// Route imports
import userRoutes from './userRoutes.js';

dotenv.config();

const swaggerMiddlewarePromise = (async () => {
    const opts = await getSwaggerOptions();
    const swaggerDocs = swaggerJSDoc(opts);
    return swaggerUI.setup(swaggerDocs, {
        customSiteTitle: 'Pasto Livre API Docs',
    });
})();

const routes = (app) => {
    // Debug log middleware
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

    // Register all routes
    app.use(
        express.json(),
        userRoutes,
    );
};

export default routes;
