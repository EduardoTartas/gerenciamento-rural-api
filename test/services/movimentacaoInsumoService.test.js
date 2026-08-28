import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('MovimentacaoInsumoService', () => {
    let service;
    const req = (usuarioId = 'dono') => ({ user: { id: usuarioId }, params: {}, query: {} });

    beforeEach(async () => {
        vi.doMock('../../src/config/dbConnect.js', () => ({ default: { prisma: {} } }));
        vi.resetModules();
        const { default: MovimentacaoInsumoService } = await import('../../src/service/MovimentacaoInsumoService.js');
        service = new MovimentacaoInsumoService();
    });

    it('recusa movimentacao para insumo de outro usuario', async () => {
        service.insumoRepository = { findById: vi.fn().mockResolvedValue(null) };
        await expect(
            service.create({ insumoId: 'i1', tipo: 'Entrada', quantidade: 10, data: new Date(), origem: 'Compra' }, req('invasor')),
        ).rejects.toMatchObject({ errorType: 'resourceNotFound', statusCode: 404 });
    });

    it('preserva o id ao criar', async () => {
        service.insumoRepository = { findById: vi.fn().mockResolvedValue({ id: 'i1' }) };
        const create = vi.fn().mockResolvedValue({ id: 'uuid-cli' });
        service.repository = { create };
        await service.create(
            { id: 'uuid-cli', insumoId: 'i1', tipo: 'Entrada', quantidade: 10, data: new Date(), origem: 'Compra' },
            req(),
        );
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: 'uuid-cli' }), undefined);
    });

    it('list exige insumoId', async () => {
        await expect(
            service.list({ ...req(), _parsedQuery: {} }),
        ).rejects.toMatchObject({ errorType: 'validationError', field: 'insumoId' });
    });
});
