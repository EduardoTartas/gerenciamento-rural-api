// src/middlewares/LogRoutesMiddleware.js

import logger from '../utils/logger.js';

const logRoutes = async (req, res, next) => {
    try {
        const timestamp = new Date().toISOString();

        let ip = req.headers["x-forwarded-for"] ||
            req.socket.remoteAddress ||
            null;

        logger.info(`${timestamp} ${ip} ${req.method} ${req.protocol}://${req.get("host")}${req.originalUrl}`);
    } catch (e) {
        logger.error('Erro ao fazer o log', { error: e.message });
    }
    next();
};

export default logRoutes;
