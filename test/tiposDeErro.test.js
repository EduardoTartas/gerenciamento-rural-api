import { describe, expect, it } from 'vitest';
import {
    TIPOS_DE_ERRO,
    descreverErro,
    ehRecuperavel,
} from '../src/utils/helpers/tiposDeErro.js';

describe('tipos de erro', () => {
    it('declara os oito tipos do contrato', () => {
        expect(Object.keys(TIPOS_DE_ERRO).sort()).toEqual([
            'conflict',
            'forbidden',
            'notFound',
            'rateLimit',
            'resourceNotFound',
            'serverError',
            'unauthorized',
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
});
