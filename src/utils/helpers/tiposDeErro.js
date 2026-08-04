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
    validationError: { http: 400, recuperavel: false },
    unauthorized:    { http: 401, recuperavel: true  },
    forbidden:       { http: 403, recuperavel: false },
    notFound:        { http: 404, recuperavel: false },
    conflict:        { http: 409, recuperavel: false },
    rateLimit:       { http: 429, recuperavel: true  },
    serverError:     { http: 500, recuperavel: true  },
};

const PADRAO = 'serverError';

/** Descreve um tipo. Tipo desconhecido vira `serverError`, que é recuperável. */
export function descreverErro(tipo) {
    const conhecido = Object.hasOwn(TIPOS_DE_ERRO, tipo) ? tipo : PADRAO;
    return { tipo: conhecido, ...TIPOS_DE_ERRO[conhecido] };
}

export function ehRecuperavel(tipo) {
    return descreverErro(tipo).recuperavel;
}
