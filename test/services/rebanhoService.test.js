import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Duas regras nascidas de defeito real: reativar sem pasto criava lote ativo
 * sem pasto (estado que `create` proíbe), e a lotação conjunta lia o campo
 * `status`, que é cache e estava comprovadamente defasado no seed.
 */
describe('RebanhoService', () => {
    let service;
    const req = (usuarioId = 'dono') => ({ user: { id: usuarioId }, params: {}, query: {} });

    beforeEach(async () => {
        vi.doMock('../../src/config/dbConnect.js', () => ({
            default: { prisma: { $transaction: async (cb) => cb({}) } },
        }));
        vi.resetModules();
        const { default: RebanhoService } = await import(
            '../../src/service/RebanhoService.js'
        );
        service = new RebanhoService();
    });

    it('recusa reativar rebanho sem informar pasto', async () => {
        service.repository = {
            findById: vi.fn().mockResolvedValue({
                id: 'r1', ativo: false, propriedadeId: 'p1', pastoAtualId: null,
            }),
            findByNome: vi.fn().mockResolvedValue(null),
        };

        await expect(
            service.update('r1', { ativo: true }, req()),
        ).rejects.toMatchObject({ errorType: 'validationError', field: 'pastoAtualId' });
    });

    it('recusa trocar de pasto fora da rota de movimentação', async () => {
        service.repository = {
            findById: vi.fn().mockResolvedValue({
                id: 'r1', ativo: true, propriedadeId: 'p1', pastoAtualId: 'pastoA',
            }),
            findByNome: vi.fn().mockResolvedValue(null),
        };

        await expect(
            service.update('r1', { pastoAtualId: 'pastoB' }, req()),
        ).rejects.toMatchObject({ errorType: 'validationError', field: 'pastoAtualId' });
    });

    it('recusa criar lote em pasto ocupado sem permitir lotação conjunta', async () => {
        service.propriedadeRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'p1', ativo: true }),
        };
        service.pastoRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'pastoA', ativo: true, propriedadeId: 'p1' }),
        };
        service.repository = {
            findByNome: vi.fn().mockResolvedValue(null),
            countAtivosNoPasto: vi.fn().mockResolvedValue(1),
        };

        await expect(
            service.create(
                { propriedadeId: 'p1', pastoAtualId: 'pastoA', nomeRebanho: 'Lote' },
                req(),
            ),
        ).rejects.toMatchObject({ field: 'pastoAtualId' });
    });

    it('conta rebanhos ativos em vez de ler o status do pasto', async () => {
        service.propriedadeRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'p1', ativo: true }),
        };
        // status diz 'Vazio', mas há lote ativo. A verdade é a contagem.
        service.pastoRepository = {
            findById: vi.fn().mockResolvedValue({
                id: 'pastoA', ativo: true, propriedadeId: 'p1', status: 'Vazio',
            }),
        };
        const contar = vi.fn().mockResolvedValue(1);
        service.repository = { findByNome: vi.fn().mockResolvedValue(null), countAtivosNoPasto: contar };

        await expect(
            service.create(
                { propriedadeId: 'p1', pastoAtualId: 'pastoA', nomeRebanho: 'Lote' },
                req(),
            ),
        ).rejects.toThrow();
        expect(contar).toHaveBeenCalledWith('pastoA');
    });

    it('recusa rebanho em pasto de outra propriedade', async () => {
        service.propriedadeRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'p1', ativo: true }),
        };
        service.pastoRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'pastoX', ativo: true, propriedadeId: 'p9' }),
        };
        service.repository = { findByNome: vi.fn().mockResolvedValue(null) };

        await expect(
            service.create(
                { propriedadeId: 'p1', pastoAtualId: 'pastoX', nomeRebanho: 'Lote' },
                req(),
            ),
        ).rejects.toMatchObject({ field: 'pastoAtualId' });
    });
});
