
import rateLimit from 'express-rate-limit';
import CommonResponse from '../utils/helpers/CommonResponse.js';
import HttpStatusCodes from '../utils/helpers/HttpStatusCodes.js';

function getClientIdentifier(req) {
    // cloudflare Tunnel injeta o IP real do cliente neste header
    const cfIp = req.headers['cf-connecting-ip'];
    if (cfIp) return cfIp.trim();
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.headers['x-real-ip'] || req.ip || req.socket.remoteAddress || 'unknown';
}

// rate limiter geral para todas as rotas autenticadas
export const authRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    message: {
        message: 'Muitas requisições. Tente novamente em 1 minuto.',
        data: null,
        errors: [{
            path: 'rate_limit',
            message: 'Limite de requisições excedido. Aguarde 1 minuto.'
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
            'rateLimit',
            'rate_limit',
            [{
                path: 'rate_limit',
                message: 'Limite de requisições excedido. Aguarde 1 minuto.'
            }],
            'Muitas requisições. Tente novamente em 1 minuto.'
        );
    },
    skip: () => process.env.NODE_ENV === 'test'
});

export const strictRateLimit = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 8,
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
            'rateLimit',
            'rate_limit',
            [{
                path: 'rate_limit',
                message: 'Limite de requisições sensíveis excedido. Aguarde 5 minutos.'
            }],
            'Muitas tentativas. Tente novamente em 5 minutos.'
        );
    },
    skip: () => process.env.NODE_ENV === 'test'
});

// rate limiter para endpoints públicos
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
            'rateLimit',
            'rate_limit',
            [{
                path: 'rate_limit',
                message: 'Limite de requisições públicas excedido.'
            }],
            'Muitas requisições. Tente novamente em 15 minutos.'
        );
    },
    skip: () => process.env.NODE_ENV === 'test'
});
