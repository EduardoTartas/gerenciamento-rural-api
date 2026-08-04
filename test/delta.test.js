import { describe, expect, it, vi } from 'vitest';

/**
 * Cada abertura de tela pedia a coleção inteira. Com o delta, pede só o que
 * mudou desde a última sincronização.
 *
 * A regra decisiva: com `atualizadoDesde`, o filtro de `ativo` **sai**. Sem
 * isso o registro excluído nunca chegaria ao aplicativo, e o rastro criado na
 * Task 4 seria inútil.
 */
describe('leitura por diferença', () => {
    async function montarPastoRepository() {
        const findMany = vi.fn().mockResolvedValue([]);
        const count = vi.fn().mockResolvedValue(0);

        vi.doMock('../src/config/dbConnect.js', () => ({
            default: { prisma: { pasto: { findMany, count } } },
        }));

        vi.resetModules();
        const { default: PastoRepository } = await import(
            '../src/repository/PastoRepository.js'
        );
        return { repo: new PastoRepository(), findMany };
    }

    it('sem atualizadoDesde, mantém o comportamento de hoje', async () => {
        const { repo, findMany } = await montarPastoRepository();

        await repo.list('u1', {}, 1, 10);

        const { where } = findMany.mock.calls[0][0];
        expect(where.ativo).toBe(true);
        expect(where.updatedAt).toBeUndefined();
    });

    it('com atualizadoDesde, filtra pela janela', async () => {
        const { repo, findMany } = await montarPastoRepository();
        const desde = new Date('2026-08-03T20:00:00.000Z');

        await repo.list('u1', { atualizadoDesde: desde }, 1, 10);

        const { where } = findMany.mock.calls[0][0];
        expect(where.updatedAt).toEqual({ gt: desde });
    });

    it('com atualizadoDesde, devolve também o que foi excluído', async () => {
        const { repo, findMany } = await montarPastoRepository();

        await repo.list('u1', { atualizadoDesde: new Date() }, 1, 10);

        const { where } = findMany.mock.calls[0][0];
        expect(where.ativo).toBeUndefined();
    });

    it('ativo explícito continua vencendo', async () => {
        const { repo, findMany } = await montarPastoRepository();

        await repo.list('u1', { atualizadoDesde: new Date(), ativo: true }, 1, 10);

        const { where } = findMany.mock.calls[0][0];
        expect(where.ativo).toBe(true);
    });
});
