import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
    TIPOS_DE_ERRO,
    descreverErro,
    ehRecuperavel,
} from '../src/utils/helpers/tiposDeErro.js';

const RAIZ_SRC = fileURLToPath(new URL('../src', import.meta.url));

describe('tipos de erro', () => {
    it('declara todo o contrato, incluindo o que nasce fora dos services', () => {
        expect(Object.keys(TIPOS_DE_ERRO).sort()).toEqual([
            'authError',
            'conflict',
            'databaseError',
            'forbidden',
            'foreignKeyViolation',
            'notFound',
            'operationalError',
            'rateLimit',
            'recordNotFound',
            'resourceNotFound',
            'serverError',
            'tokenExpired',
            'unauthorized',
            'uniqueConstraintViolation',
            'validationError',
        ]);
    });

    it('mapeia cada tipo ao seu código HTTP', () => {
        expect(descreverErro('validationError').http).toBe(400);
        expect(descreverErro('unauthorized').http).toBe(401);
        expect(descreverErro('forbidden').http).toBe(403);
        expect(descreverErro('notFound').http).toBe(404);
        expect(descreverErro('resourceNotFound').http).toBe(404);
        expect(descreverErro('conflict').http).toBe(409);
        expect(descreverErro('rateLimit').http).toBe(429);
        expect(descreverErro('serverError').http).toBe(500);
    });

    it('marca como recuperável só o que vale tentar de novo', () => {
        // O cliente decidia isso pelo statusCode, e foi assim que 429 virou
        // falha permanente. Agora o servidor declara.
        expect(ehRecuperavel('rateLimit')).toBe(true);
        expect(ehRecuperavel('serverError')).toBe(true);
        expect(ehRecuperavel('unauthorized')).toBe(true);

        expect(ehRecuperavel('validationError')).toBe(false);
        expect(ehRecuperavel('conflict')).toBe(false);
        expect(ehRecuperavel('notFound')).toBe(false);
        expect(ehRecuperavel('resourceNotFound')).toBe(false);
        expect(ehRecuperavel('forbidden')).toBe(false);
    });

    it('resourceNotFound (erro real dos services de domínio) não é retry infinito', () => {
        // `ensure*Exists` nos seis services lança `errorType: 'resourceNotFound'`,
        // não `notFound`. Sem esta entrada, caía no padrão `serverError` e o
        // cliente offline reenviaria a mutação morta para sempre.
        expect(descreverErro('resourceNotFound')).toEqual({
            tipo: 'resourceNotFound',
            http: 404,
            recuperavel: false,
        });
    });

    it('sessão expirada é recuperável, não culpa do dado', () => {
        // Se fosse permanente, o rollback do cliente reverteria o trabalho do
        // produtor a cada sessão vencida.
        expect(descreverErro('unauthorized')).toEqual({
            tipo: 'unauthorized',
            http: 401,
            recuperavel: true,
        });
    });

    it('tipo desconhecido cai em serverError', () => {
        expect(descreverErro('coisaQueNaoExiste')).toEqual({
            tipo: 'serverError',
            http: 500,
            recuperavel: true,
        });
    });

    it('erro do Prisma vira 409/404 definitivo, não retry eterno', () => {
        // `CustomError.fromPrisma` emite estes três, e `CommonResponse.error`
        // carimba `recuperavel` a partir daqui. Marcados como recuperáveis, o
        // cliente offline reenviaria para sempre um cadastro duplicado.
        expect(descreverErro('uniqueConstraintViolation')).toEqual({
            tipo: 'uniqueConstraintViolation', http: 409, recuperavel: false,
        });
        expect(descreverErro('foreignKeyViolation')).toEqual({
            tipo: 'foreignKeyViolation', http: 409, recuperavel: false,
        });
        expect(descreverErro('recordNotFound')).toEqual({
            tipo: 'recordNotFound', http: 404, recuperavel: false,
        });
    });

    it('falha de autenticação é recuperável; falha de banco também', () => {
        expect(descreverErro('tokenExpired')).toEqual({
            tipo: 'tokenExpired', http: 401, recuperavel: true,
        });
        expect(descreverErro('authError')).toEqual({
            tipo: 'authError', http: 401, recuperavel: true,
        });
        expect(descreverErro('databaseError')).toEqual({
            tipo: 'databaseError', http: 500, recuperavel: true,
        });
        expect(descreverErro('operationalError')).toEqual({
            tipo: 'operationalError', http: 500, recuperavel: true,
        });
    });

    it('código de Prisma não tabelado não vaza para o cliente nem vira retry eterno', () => {
        // `fromPrisma` monta `prisma:P2011` para o que não reconhece, já com
        // 400 — problema do dado. Chave dinâmica não cabe na tabela, então o
        // prefixo é resolvido em `descreverErro`.
        expect(descreverErro('prisma:P2011')).toEqual({
            tipo: 'validationError', http: 400, recuperavel: false,
        });
        expect(ehRecuperavel('prisma:P2000')).toBe(false);
    });

    it('conflito de transação do Prisma é recuperável, não descarte da escrita', () => {
        // Toda mutação do lote e todo desfazer de movimentação rodam dentro de
        // `$transaction`, então P2034 (deadlock), P2024 (pool esgotado) e P2028
        // são cenários reais aqui. Marcados como definitivos, o cliente
        // offline-first descarta a mutação — perde o trabalho do produtor numa
        // falha que um simples reenvio resolveria.
        for (const codigo of ['P2024', 'P2028', 'P2034']) {
            expect(descreverErro(`prisma:${codigo}`), codigo).toEqual({
                tipo: 'databaseError', http: 500, recuperavel: true,
            });
            expect(ehRecuperavel(`prisma:${codigo}`), codigo).toBe(true);
        }
    });

    it('a exceção dos transitórios não afrouxa os códigos de dado ruim', () => {
        // Guarda contra a correção se desfazer: P2011 (violação de not-null),
        // P2000 (valor longo demais) e P2023 (coluna inconsistente) continuam
        // sendo culpa do dado enviado — reenviar repete o mesmo erro.
        for (const codigo of ['P2011', 'P2000', 'P2023']) {
            expect(descreverErro(`prisma:${codigo}`), codigo).toEqual({
                tipo: 'validationError', http: 400, recuperavel: false,
            });
            expect(ehRecuperavel(`prisma:${codigo}`), codigo).toBe(false);
        }
    });
});

/**
 * Guarda de regressão.
 *
 * `resourceNotFound` só foi descoberto faltando depois que um 404 de negócio
 * virou retry infinito em produção de teste. O padrão silencioso de
 * `descreverErro` — cair em `serverError`, que é recuperável — é o que torna
 * essa falha invisível: nada quebra, o cliente só reenvia para sempre.
 *
 * Este teste varre `src/` e exige que todo tipo emitido tenha entrada na tabela.
 */
describe('nenhum errorType emitido pela API fica fora da tabela', () => {
    /**
     * Tipos que a varredura não alcança porque não são escritos como
     * `errorType: 'x'` — chegam como argumento posicional de
     * `CommonResponse.error` ou como fallback de `||`.
     *
     * Levantados por grep manual em `src/`. **Mantenha em sincronia à mão** ao
     * mexer em `errorHandler.js`, `CustomError.js` ou nos middlewares.
     */
    const EMITIDOS_FORA_DO_PADRAO = [
        'tokenExpired',     // errorHandler.js — CommonResponse.error posicional
        'operationalError', // errorHandler.js — `err.errorType || 'operationalError'`
        'authError',        // CustomError.js  — `... || error.code || 'authError'`
        'rateLimit',        // RateLimitMiddleware.js — posicional
        'serverError',      // errorHandler.js e default do CustomError
        'validationError',  // errorHandler.js — Zod, JSON inválido, TypeError
        'resourceNotFound', // app.js — rota inexistente
    ];

    function arquivosJs(diretorio) {
        return readdirSync(diretorio, { withFileTypes: true }).flatMap((entrada) => {
            const caminho = join(diretorio, entrada.name);
            if (entrada.isDirectory()) return arquivosJs(caminho);
            return entrada.name.endsWith('.js') ? [caminho] : [];
        });
    }

    function tiposEmitidosNoCodigo() {
        const encontrados = new Set();
        for (const arquivo of arquivosJs(RAIZ_SRC)) {
            const conteudo = readFileSync(arquivo, 'utf8');
            for (const [, tipo] of conteudo.matchAll(/errorType:\s*'([^']+)'/g)) {
                encontrados.add(tipo);
            }
        }
        return encontrados;
    }

    it('a varredura encontra os tipos conhecidos (o regex ainda funciona)', () => {
        // Sem esta trava, um regex quebrado deixaria o teste seguinte verde por
        // não encontrar nada — a pior forma de guarda de regressão.
        const encontrados = tiposEmitidosNoCodigo();
        expect(encontrados.size).toBeGreaterThan(3);
        expect(encontrados).toContain('validationError');
        expect(encontrados).toContain('resourceNotFound');
        expect(encontrados).toContain('uniqueConstraintViolation');
    });

    it('todo errorType construído em src/ tem entrada em TIPOS_DE_ERRO', () => {
        const emitidos = [...tiposEmitidosNoCodigo(), ...EMITIDOS_FORA_DO_PADRAO];
        const semEntrada = emitidos.filter((tipo) => !Object.hasOwn(TIPOS_DE_ERRO, tipo));

        expect(semEntrada).toEqual([]);
    });
});
