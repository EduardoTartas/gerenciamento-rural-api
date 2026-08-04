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

/**
 * Trazer a linha excluída no `where` não basta: se `ativo` não estiver no
 * `select`, ela chega ao aplicativo idêntica a uma linha viva e é ressuscitada
 * localmente — pior que o registro fantasma que este plano existe para corrigir.
 *
 * `pasto`, `propriedade` e `rebanho` já selecionavam `ativo`. Manejos e
 * movimentações, não.
 */
describe('o delta entrega o estado de exclusão, não só a linha', () => {
    const REPOSITORIOS = [
        {
            nome: 'manejo de pasto',
            caminho: '../src/repository/ManejoPastoRepository.js',
            tabela: 'manejoPasto',
        },
        {
            nome: 'manejo de rebanho',
            caminho: '../src/repository/ManejoRebanhoRepository.js',
            tabela: 'manejoRebanho',
        },
        {
            nome: 'movimentação',
            caminho: '../src/repository/MovimentacaoRepository.js',
            tabela: 'historicoMovimentacao',
        },
    ];

    async function montar({ caminho, tabela }, docs = []) {
        const findMany = vi.fn().mockResolvedValue(docs);
        const count = vi.fn().mockResolvedValue(docs.length);

        vi.doMock('../src/config/dbConnect.js', () => ({
            default: { prisma: { [tabela]: { findMany, count } } },
        }));

        vi.resetModules();
        const { default: Repositorio } = await import(caminho);
        return { repo: new Repositorio(), findMany };
    }

    it.each(REPOSITORIOS)('$nome seleciona ativo', async (alvo) => {
        const { repo, findMany } = await montar(alvo);

        await repo.list('u1', { atualizadoDesde: new Date() }, 1, 10);

        const { select } = findMany.mock.calls[0][0];
        expect(select.ativo).toBe(true);
    });

    it.each(REPOSITORIOS)('$nome seleciona updatedAt, a marca d\'água do cliente', async (alvo) => {
        // Sem `updatedAt` na resposta o aplicativo não sabe de onde continuar e
        // repete a mesma janela de sincronização para sempre.
        const { repo, findMany } = await montar(alvo);

        await repo.list('u1', { atualizadoDesde: new Date() }, 1, 10);

        const { select } = findMany.mock.calls[0][0];
        expect(select.updatedAt).toBe(true);
    });

    it.each(REPOSITORIOS)('$nome devolve a linha excluída com ativo: false visível', async (alvo) => {
        const excluida = {
            id: 'x1',
            ativo: false,
            updatedAt: new Date('2026-08-04T10:00:00.000Z'),
        };
        const { repo, findMany } = await montar(alvo, [excluida]);

        const { docs } = await repo.list('u1', { atualizadoDesde: new Date('2026-08-01') }, 1, 10);

        // O `select` é o que garante que o campo existe de verdade na consulta;
        // o retorno confirma que ele chega inteiro ao chamador.
        expect(findMany.mock.calls[0][0].select.ativo).toBe(true);
        expect(docs[0].ativo).toBe(false);
        expect(docs[0].updatedAt).toBeInstanceOf(Date);
    });

    it.each(REPOSITORIOS)('$nome aceita o filtro ativo explícito', async (alvo) => {
        const { repo, findMany } = await montar(alvo);

        await repo.list('u1', { atualizadoDesde: new Date(), ativo: false }, 1, 10);

        expect(findMany.mock.calls[0][0].where.ativo).toBe(false);
    });
});

/**
 * O `filters.ativo` dos repositórios acima era código morto: nem o schema de
 * query aceitava o parâmetro, nem o service o repassava.
 */
describe('o parâmetro ativo chega do controller ao repositório', () => {
    const SERVICES = [
        {
            nome: 'ManejoPastoService',
            caminho: '../src/service/ManejoPastoService.js',
            schema: '../src/utils/validators/schemas/zod/querys/ManejoPastoQuerySchema.js',
            exportado: 'ManejoPastoQuerySchema',
        },
        {
            nome: 'ManejoRebanhoService',
            caminho: '../src/service/ManejoRebanhoService.js',
            schema: '../src/utils/validators/schemas/zod/querys/ManejoRebanhoQuerySchema.js',
            exportado: 'ManejoRebanhoQuerySchema',
        },
        {
            nome: 'MovimentacaoService',
            caminho: '../src/service/MovimentacaoService.js',
            schema: '../src/utils/validators/schemas/zod/querys/MovimentacaoQuerySchema.js',
            exportado: 'MovimentacaoQuerySchema',
        },
    ];

    it.each(SERVICES)('$exportado aceita ativo e coage para booleano', async (alvo) => {
        const modulo = await import(alvo.schema);
        const analisado = modulo[alvo.exportado].parse({ ativo: 'false' });

        expect(analisado.ativo).toBe(false);
    });

    it.each(SERVICES)('$exportado recusa ativo fora de true/false', async (alvo) => {
        const modulo = await import(alvo.schema);

        expect(() => modulo[alvo.exportado].parse({ ativo: 'talvez' })).toThrow();
    });

    it.each(SERVICES)('$nome repassa ativo ao repositório', async (alvo) => {
        vi.doMock('../src/config/dbConnect.js', () => ({ default: { prisma: {} } }));
        vi.resetModules();
        const { default: Service } = await import(alvo.caminho);
        const service = new Service();

        const list = vi.fn().mockResolvedValue({ docs: [] });
        service.repository = { list };

        await service.list({
            user: { id: 'u1' },
            params: {},
            _parsedQuery: { ativo: false, page: 1, limit: 10 },
        });

        expect(list.mock.calls[0][1].ativo).toBe(false);
    });

    it.each(SERVICES)('$nome não inventa ativo quando o cliente não pede', async (alvo) => {
        vi.doMock('../src/config/dbConnect.js', () => ({ default: { prisma: {} } }));
        vi.resetModules();
        const { default: Service } = await import(alvo.caminho);
        const service = new Service();

        const list = vi.fn().mockResolvedValue({ docs: [] });
        service.repository = { list };

        await service.list({ user: { id: 'u1' }, params: {}, _parsedQuery: { page: 1, limit: 10 } });

        expect(list.mock.calls[0][1]).not.toHaveProperty('ativo');
    });
});
