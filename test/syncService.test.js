import { describe, expect, it, vi } from 'vitest';

/**
 * O SyncService não conhece regra de negócio. Ele resolve ordem, dependência e
 * idempotência, e delega ao service de domínio que já existe — multi-tenancy,
 * lotação conjunta e ciclo de descanso continuam com dono único.
 */
describe('aplicação do lote', () => {
    const req = { user: { id: 'u1' } };

    async function montar({ despacho, jaAplicadas = new Map() }) {
        vi.doMock('../src/service/sync/despacho.js', () => ({ DESPACHO: despacho }));
        vi.doMock('../src/repository/MutacaoAplicadaRepository.js', () => ({
            default: class {
                buscarPorIds = vi.fn().mockResolvedValue(jaAplicadas);
                registrar = vi.fn().mockResolvedValue(undefined);
                limparAntigas = vi.fn().mockResolvedValue(0);
            },
        }));
        vi.doMock('../src/config/dbConnect.js', () => ({
            default: { prisma: { $transaction: async (cb) => cb({}) } },
        }));

        vi.resetModules();
        const { default: SyncService } = await import('../src/service/SyncService.js');
        return new SyncService();
    }

    const mutacao = (id, entidade, acao, dependeDe = null) => ({
        id,
        entidade,
        acao,
        entidadeId: `ent-${id}`,
        dependeDe,
        dados: {},
    });

    it('aplica mutações independentes e devolve aceito', async () => {
        const service = await montar({
            despacho: {
                'pastos:CREATE': vi.fn().mockResolvedValue({ id: 'ent-a', nome: 'A' }),
            },
        });

        const { resultados } = await service.aplicarLote(
            [mutacao('a', 'pastos', 'CREATE')],
            req,
        );

        expect(resultados).toHaveLength(1);
        expect(resultados[0]).toMatchObject({
            id: 'a',
            situacao: 'aceito',
            entidade: 'pastos',
            dados: { id: 'ent-a', nome: 'A' },
        });
    });

    it('recusa a que falha e bloqueia quem depende dela', async () => {
        const erroDeConflito = Object.assign(new Error('nome duplicado'), {
            errorType: 'conflict',
            field: 'nome',
            customMessage: 'Já existe uma pastagem com este nome nesta propriedade.',
        });

        const service = await montar({
            despacho: {
                'pastos:CREATE': vi.fn().mockRejectedValue(erroDeConflito),
                'rebanhos:CREATE': vi.fn().mockResolvedValue({}),
                'manejo_rebanhos:CREATE': vi.fn().mockResolvedValue({}),
            },
        });

        const { resultados } = await service.aplicarLote(
            [
                mutacao('pasto', 'pastos', 'CREATE'),
                mutacao('rebanho', 'rebanhos', 'CREATE', 'pasto'),
                mutacao('manejo', 'manejo_rebanhos', 'CREATE', 'rebanho'),
            ],
            req,
        );

        const porId = Object.fromEntries(resultados.map((r) => [r.id, r]));
        expect(porId.pasto.situacao).toBe('recusado');
        expect(porId.pasto.erro).toMatchObject({
            tipo: 'conflict',
            campo: 'nome',
            recuperavel: false,
        });
        // Bloqueado, não recusado: o rebanho não foi tentado, então não pode
        // aparecer como erro seu. Voltar 404 aqui esconderia a causa real.
        expect(porId.rebanho).toMatchObject({
            situacao: 'bloqueado',
            bloqueadoPor: 'pasto',
        });
        expect(porId.manejo.situacao).toBe('bloqueado');
    });

    it('mutação independente entra mesmo com outra recusada', async () => {
        const service = await montar({
            despacho: {
                'pastos:CREATE': vi
                    .fn()
                    .mockRejectedValueOnce(
                        Object.assign(new Error('x'), { errorType: 'conflict' }),
                    )
                    .mockResolvedValueOnce({ id: 'ent-b' }),
            },
        });

        const { resultados } = await service.aplicarLote(
            [mutacao('a', 'pastos', 'CREATE'), mutacao('b', 'pastos', 'CREATE')],
            req,
        );

        const porId = Object.fromEntries(resultados.map((r) => [r.id, r]));
        expect(porId.a.situacao).toBe('recusado');
        expect(porId.b.situacao).toBe('aceito');
    });

    it('não reexecuta mutação já aplicada', async () => {
        const criar = vi.fn().mockResolvedValue({});
        const service = await montar({
            despacho: { 'pastos:CREATE': criar },
            jaAplicadas: new Map([
                ['a', { id: 'a', situacao: 'aceito', entidade: 'pastos', entidadeId: 'ent-a' }],
            ]),
        });

        const { resultados } = await service.aplicarLote(
            [mutacao('a', 'pastos', 'CREATE')],
            req,
        );

        expect(criar).not.toHaveBeenCalled();
        expect(resultados[0].situacao).toBe('aceito');
    });

    it('recusa par entidade-ação desconhecido', async () => {
        const service = await montar({ despacho: {} });

        const { resultados } = await service.aplicarLote(
            [mutacao('a', 'coisas', 'CREATE')],
            req,
        );

        expect(resultados[0]).toMatchObject({
            situacao: 'recusado',
            erro: { tipo: 'validationError' },
        });
    });

    it('lança quando há ciclo de dependência', async () => {
        const service = await montar({ despacho: {} });

        await expect(
            service.aplicarLote(
                [
                    mutacao('a', 'pastos', 'CREATE', 'b'),
                    mutacao('b', 'pastos', 'CREATE', 'a'),
                ],
                req,
            ),
        ).rejects.toMatchObject({ errorType: 'validationError' });
    });
});
