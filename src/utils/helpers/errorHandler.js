// src/utils/helpers/errorHandler.js

import pkg from '@prisma/client';
import { ZodError } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import logger from '../logger.js';
import CommonResponse from './CommonResponse.js';
import CustomError from './CustomError.js';

const { Prisma } = pkg;

const errorHandler = (err, req, res, next) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const errorId = uuidv4();
    const requestId = req.requestId || 'N/A';

    // Evitar enviar resposta se os headers já foram enviados
    if (res.headersSent) {
        logger.error('Headers já enviados, delegando ao Express', { message: err.message, path: req.path, requestId });
        return next(err);
    }

    // Tratamento para erros de validação do Zod
    if (err instanceof ZodError) {
        const zodIssues = err.issues || err.errors || [];
        logger.warn('Erro de validação', { errors: zodIssues, path: req.path, requestId });
        return CommonResponse.error(
            res,
            400,
            'validationError',
            null,
            zodIssues.map(e => ({ path: (e.path || []).join('.'), message: e.message })),
            `Erro de validação. ${zodIssues.length} campo(s) inválido(s).`
        );
    }

    // Tratamento para erros provenientes do Prisma/PostgreSQL
    if (
        err instanceof Prisma.PrismaClientKnownRequestError ||
        err instanceof Prisma.PrismaClientUnknownRequestError ||
        err instanceof Prisma.PrismaClientValidationError ||
        err instanceof Prisma.PrismaClientInitializationError
    ) {
        const prismaError = CustomError.fromPrisma(err);
        logger.warn('Erro do Prisma/PostgreSQL', {
            message: prismaError.customMessage,
            code: err.code,
            target: err.meta?.target,
            path: req.path,
            requestId,
        });

        return CommonResponse.error(
            res,
            prismaError.statusCode,
            prismaError.errorType,
            prismaError.field,
            prismaError.details,
            prismaError.customMessage
        );
    }

    // Tratamento para erros originados do fluxo de autenticação (BetterAuth)
    if (err.provider === 'betterauth' || err.name === 'BetterAuthError') {
        const authError = err instanceof CustomError ? err : CustomError.fromBetterAuth(err);
        logger.warn('Erro de autenticação (BetterAuth)', {
            message: authError.customMessage,
            code: authError.errorType,
            path: req.path,
            requestId,
        });

        return CommonResponse.error(
            res,
            authError.statusCode,
            authError.errorType,
            authError.field,
            authError.details,
            authError.customMessage
        );
    }

    // Tratamento específico para CustomError com errorType 'tokenExpired'
    if (err instanceof CustomError && err.errorType === 'tokenExpired') {
        logger.warn('Erro de token expirado', { message: err.message, path: req.path, requestId });
        return CommonResponse.error(
            res,
            err.statusCode || 401,
            'tokenExpired',
            null,
            [{ message: err.customMessage || 'Token expirado.' }],
            err.customMessage || 'Token expirado. Por favor, faça login novamente.'
        );
    }

    // Tratamento para erros de parsing JSON
    if (err.name === 'SyntaxError' || err.type === 'entity.parse.failed' || err.message?.includes('Unexpected token') || err.message?.includes('is not valid JSON')) {
        logger.warn('Erro de parsing JSON', { message: err.message, path: req.path, requestId });
        return CommonResponse.error(
            res,
            400,
            'validationError',
            'body',
            [{ path: 'body', message: 'JSON inválido. Verifique a sintaxe do corpo da requisição.' }],
            'Formato JSON inválido.'
        );
    }

    // Tratamento para TypeError (acesso a propriedade de null/undefined)
    if (err instanceof TypeError) {
        logger.error(`TypeError [ID: ${errorId}]`, { message: err.message, stack: err.stack, path: req.path, requestId });
        const detalhes = isProduction
            ? [{ message: `Erro ao processar a requisição. Referência: ${errorId}` }]
            : [{ message: err.message }];
        return CommonResponse.error(
            res,
            400,
            'validationError',
            null,
            detalhes,
            'Erro ao processar a requisição. Verifique os dados enviados.'
        );
    }

    // Tratamento para erros operacionais
    if (err.isOperational) {
        logger.warn('Erro operacional', { message: err.message, path: req.path, requestId });
        return CommonResponse.error(
            res,
            err.statusCode,
            err.errorType || 'operationalError',
            err.field || null,
            err.details || [],
            err.customMessage || 'Erro operacional.'
        );
    }

    // Tratamento para erros internos
    logger.error(`Erro interno [ID: ${errorId}]`, { message: err.message, stack: err.stack, requestId });
    const detalhes = isProduction
        ? [{ message: `Erro interno do servidor. Referência: ${errorId}` }]
        : [{ message: err.message, stack: err.stack }];

    return CommonResponse.error(res, 500, 'serverError', null, detalhes);
};

export default errorHandler;
