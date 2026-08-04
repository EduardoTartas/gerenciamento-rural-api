// src/utils/helpers/tiposDeErro.js

/**
 * Fonte única do contrato de erro entre a API e o aplicativo.
 *
 * `recuperavel` responde a uma pergunta só: vale a pena o cliente tentar de
 * novo? Antes deste campo o aplicativo decidia pelo código HTTP, com a regra
 * `statusCode >= 500` — que classificava 429 e 408 como recusa definitiva,
 * justamente os dois casos em que insistir é a resposta certa.
 */
export const TIPOS_DE_ERRO = {
    validationError:  { http: 400, recuperavel: false },
    unauthorized:     { http: 401, recuperavel: true  },
    forbidden:        { http: 403, recuperavel: false },
    notFound:         { http: 404, recuperavel: false },
    // Os services de domínio lançam `resourceNotFound` (via `ensure*Exists`),
    // não `notFound` — sem esta entrada, `descreverErro` caía no padrão
    // `serverError` (recuperável), e um 404 de negócio virava retry infinito
    // no cliente offline.
    resourceNotFound: { http: 404, recuperavel: false },
    conflict:         { http: 409, recuperavel: false },
    rateLimit:        { http: 429, recuperavel: true  },
    serverError:      { http: 500, recuperavel: true  },

    // ----------------------------------------------------------------------
    // Tipos emitidos fora dos services de domínio.
    //
    // `CommonResponse.error` carimba `tipo`/`recuperavel` em TODA resposta de
    // erro da API, não só nas do lote. Os tipos abaixo nascem em
    // `CustomError.fromPrisma`, `CustomError.fromBetterAuth` e no
    // `errorHandler` — nenhum estava na tabela, então todos caíam no padrão
    // `serverError` e chegavam ao aplicativo marcados como recuperáveis. Um
    // 409 de chave duplicada reenviado para sempre é fila offline travada.
    // ----------------------------------------------------------------------

    /** Prisma P2002 — chave única. O dado já existe; reenviar repete o erro. */
    uniqueConstraintViolation: { http: 409, recuperavel: false },
    /** Prisma P2003 — chave estrangeira. Falta o registro referenciado. */
    foreignKeyViolation:       { http: 409, recuperavel: false },
    /** Prisma P2025 — alvo do update/delete não existe. */
    recordNotFound:            { http: 404, recuperavel: false },
    /**
     * `CustomError.fromPrisma` para o que não é `PrismaClientKnownRequestError`:
     * falha de conexão, de inicialização, banco fora do ar. Condição do
     * servidor, transitória — vale tentar de novo.
     */
    databaseError:             { http: 500, recuperavel: true  },
    /** Sessão vencida. Mesmo raciocínio de `unauthorized`: reautenticar e repetir. */
    tokenExpired:              { http: 401, recuperavel: true  },
    /** Fallback do BetterAuth quando o erro não traz `code`. */
    authError:                 { http: 401, recuperavel: true  },
    /**
     * Fallback do `errorHandler` para erro operacional sem `errorType`. Não é
     * culpa do dado enviado; tratar como condição de servidor.
     */
    operationalError:          { http: 500, recuperavel: true  },
};

const PADRAO = 'serverError';

/**
 * Código do Prisma que `fromPrisma` não reconhece vira `prisma:P2011` e
 * companhia — chave dinâmica, impossível de tabelar. `fromPrisma` já responde
 * 400 nesses casos, ou seja, trata como problema do dado enviado: reportamos
 * como `validationError` para o cliente não reenviar eternamente, e para o
 * código interno do Prisma não vazar como `tipo` na tela do produtor.
 */
const PREFIXO_PRISMA = 'prisma:';

/** Descreve um tipo. Tipo desconhecido vira `serverError`, que é recuperável. */
export function descreverErro(tipo) {
    if (typeof tipo === 'string' && tipo.startsWith(PREFIXO_PRISMA)) {
        return { tipo: 'validationError', ...TIPOS_DE_ERRO.validationError };
    }
    const conhecido = Object.hasOwn(TIPOS_DE_ERRO, tipo) ? tipo : PADRAO;
    return { tipo: conhecido, ...TIPOS_DE_ERRO[conhecido] };
}

export function ehRecuperavel(tipo) {
    return descreverErro(tipo).recuperavel;
}
