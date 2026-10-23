
export const TIPOS_DE_ERRO = {
    validationError:  { http: 400, recuperavel: false },
    unauthorized:     { http: 401, recuperavel: true  },
    forbidden:        { http: 403, recuperavel: false },
    notFound:         { http: 404, recuperavel: false },
    resourceNotFound: { http: 404, recuperavel: false },
    conflict:         { http: 409, recuperavel: false },
    rateLimit:        { http: 429, recuperavel: true  },
    serverError:      { http: 500, recuperavel: true  },

    uniqueConstraintViolation: { http: 409, recuperavel: false },
    foreignKeyViolation:       { http: 409, recuperavel: false },
    /** Prisma P2025 — alvo do update/delete não existe. */
    recordNotFound:            { http: 404, recuperavel: false },
    databaseError:             { http: 500, recuperavel: true  },
    tokenExpired:              { http: 401, recuperavel: true  },
    /** fallback do BetterAuth quando o erro não traz `code`. */
    authError:                 { http: 401, recuperavel: true  },
    operationalError:          { http: 500, recuperavel: true  },
    storageError:              { http: 503, recuperavel: true  },
};

const PADRAO = 'serverError';

const PREFIXO_PRISMA = 'prisma:';

const CODIGOS_PRISMA_TRANSITORIOS = new Set([
    'P2024', // esgotou o tempo esperando conexão do pool
    'P2028', // erro na API de transação
    'P2034', // conflito de escrita / falha de serialização (deadlock)
]);

export function descreverErro(tipo) {
    if (typeof tipo === 'string' && tipo.startsWith(PREFIXO_PRISMA)) {
        const codigo = tipo.slice(PREFIXO_PRISMA.length);
        if (CODIGOS_PRISMA_TRANSITORIOS.has(codigo)) {
            return { tipo: 'databaseError', ...TIPOS_DE_ERRO.databaseError };
        }
        return { tipo: 'validationError', ...TIPOS_DE_ERRO.validationError };
    }
    const conhecido = Object.hasOwn(TIPOS_DE_ERRO, tipo) ? tipo : PADRAO;
    return { tipo: conhecido, ...TIPOS_DE_ERRO[conhecido] };
}

export function ehRecuperavel(tipo) {
    return descreverErro(tipo).recuperavel;
}
