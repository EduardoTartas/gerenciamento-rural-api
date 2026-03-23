// src/utils/helpers/CustomError.js

import pkg from '@prisma/client';

const { Prisma } = pkg;

/**
 * Wrapper para padronizar erros operacionais na API, permitindo adicionar contexto do
 * PostgreSQL (via Prisma) e do fluxo de autenticação (BetterAuth).
 */
class CustomError extends Error {
    constructor({
        statusCode = 500,
        errorType = 'serverError',
        field = null,
        details = [],
        customMessage = null,
        provider = 'application',
        metadata = {},
        originalError = null,
    } = {}) {
        super(customMessage || 'Ocorreu um erro interno.');
        this.name = 'CustomError';
        this.statusCode = statusCode;
        this.errorType = errorType;
        this.field = field;
        this.details = details;
        this.customMessage = customMessage;
        this.provider = provider;
        this.metadata = metadata;
        this.originalError = originalError;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Normaliza erros conhecidos do Prisma (PostgreSQL) para o formato CustomError.
     */
    static fromPrisma(error, overrides = {}) {
        const basePayload = {
            provider: 'postgresql',
            metadata: {
                code: error.code,
                target: error.meta?.target,
                cause: error.meta,
            },
            originalError: error,
            statusCode: 500,
            errorType: 'databaseError',
            customMessage: 'Erro ao acessar o banco de dados.',
        };

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            switch (error.code) {
                case 'P2002': // Unique constraint violation
                    return new CustomError({
                        ...basePayload,
                        statusCode: 409,
                        errorType: 'uniqueConstraintViolation',
                        field: Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : error.meta?.target,
                        customMessage:
                            overrides.customMessage ||
                            'Já existe um registro com os dados informados.',
                        ...overrides,
                    });
                case 'P2003': // Foreign key constraint
                    return new CustomError({
                        ...basePayload,
                        statusCode: 409,
                        errorType: 'foreignKeyViolation',
                        customMessage:
                            overrides.customMessage ||
                            'Relacionamento inválido. Verifique se os registros referenciados existem.',
                        ...overrides,
                    });
                case 'P2025': // Record not found
                    return new CustomError({
                        ...basePayload,
                        statusCode: 404,
                        errorType: 'recordNotFound',
                        customMessage:
                            overrides.customMessage || 'Registro não encontrado para os critérios informados.',
                        ...overrides,
                    });
                default:
                    return new CustomError({
                        ...basePayload,
                        statusCode: overrides.statusCode || 400,
                        errorType: overrides.errorType || `prisma:${error.code}`,
                        customMessage: overrides.customMessage || error.message,
                        ...overrides,
                    });
            }
        }

        return new CustomError({ ...basePayload, ...overrides });
    }

    /**
     * Normaliza erros emitidos pelo BetterAuth (ou bibliotecas compatíveis) para o formato CustomError.
     */
    static fromBetterAuth(error, overrides = {}) {
        const statusCode = overrides.statusCode || error.status || error.statusCode || 401;
        const errorType = overrides.errorType || error.code || 'authError';

        return new CustomError({
            statusCode,
            errorType,
            provider: 'betterauth',
            customMessage: overrides.customMessage || error.message || 'Erro de autenticação.',
            metadata: {
                code: error.code,
                cause: error.cause,
                hint: error.hint,
            },
            originalError: error,
            ...overrides,
        });
    }
}

export default CustomError;
