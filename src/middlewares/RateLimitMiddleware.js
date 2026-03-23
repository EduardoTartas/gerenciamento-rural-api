// src/middlewares/RateLimitMiddleware.js

import rateLimit from 'express-rate-limit';
import CommonResponse from '../utils/helpers/CommonResponse.js';
import HttpStatusCodes from '../utils/helpers/HttpStatusCodes.js';

// Helper para extrair IP do cliente considerando proxy
function getClientIdentifier(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.headers['x-real-ip'] || req.ip || req.socket.remoteAddress || 'unknown';
}

// Rate limiter geral para todas as rotas autenticadas
export const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        message: 'Muitas requisições. Tente novamente em 15 minutos.',
        data: null,
        errors: [{
            path: 'rate_limit',
            message: 'Limite de requisições excedido. Aguarde 15 minutos.'
        }]
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getClientIdentifier,
    validate: { trustProxy: false, xForwardedForHeader: false, keyGeneratorIpFallback: false },
    handler: (req, res) => {
        return CommonResponse.error(
            res,
            HttpStatusCodes.TOO_MANY_REQUESTS.code,
            'validationError',
            'rate_limit',
            [{
                path: 'rate_limit',
                message: 'Limite de requisições excedido. Aguarde 15 minutos.'
            }],
            'Muitas requisições. Tente novamente em 15 minutos.'
        );
    },
    skip: (req) => {
        return false;
    }
});

// Rate limiter mais restritivo para operações sensíveis (login, etc.)
export const strictRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 50,
    message: {
        message: 'Muitas tentativas. Tente novamente em 5 minutos.',
        data: null,
        errors: [{
            path: 'rate_limit',
            message: 'Limite de requisições sensíveis excedido. Aguarde 5 minutos.'
        }]
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getClientIdentifier,
    validate: { trustProxy: false, xForwardedForHeader: false, keyGeneratorIpFallback: false },
    handler: (req, res) => {
        return CommonResponse.error(
            res,
            HttpStatusCodes.TOO_MANY_REQUESTS.code,
            'validationError',
            'rate_limit',
            [{
                path: 'rate_limit',
                message: 'Limite de requisições sensíveis excedido. Aguarde 5 minutos.'
            }],
            'Muitas tentativas. Tente novamente em 5 minutos.'
        );
    }
});

// Rate limiter para endpoints públicos
export const publicRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        message: 'Muitas requisições. Tente novamente em 15 minutos.',
        data: null,
        errors: [{
            path: 'rate_limit',
            message: 'Limite de requisições públicas excedido.'
        }]
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getClientIdentifier,
    validate: { trustProxy: false, xForwardedForHeader: false, keyGeneratorIpFallback: false },
    handler: (req, res) => {
        return CommonResponse.error(
            res,
            HttpStatusCodes.TOO_MANY_REQUESTS.code,
            'validationError',
            'rate_limit',
            [{
                path: 'rate_limit',
                message: 'Limite de requisições públicas excedido.'
            }],
            'Muitas requisições. Tente novamente em 15 minutos.'
        );
    }
});
