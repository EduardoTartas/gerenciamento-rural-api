import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('RegimeConsumoInsumoService', () => {
    let service;
    const req = (usuarioId = 'dono') => ({ user: { id: usuarioId }, params: {}, query: {} });
    const base = {
        rebanhoId: 'r1', insumoId: 'i1', quantidadeDia: 5,
        dataInicio: new Date('2026-08-20T00:00:00Z'), dataFim: null,
    };

    beforeEach(async () => {
        vi.doMock('../../src/config/dbConnect.js', () => ({ default: { prisma: {} } }));
        vi.resetModules();
        const { default: RegimeConsumoInsumoService } = await import('../../src/service/RegimeConsumoInsumoService.js');
        service = new RegimeConsumoInsumoService();
        // comTransacao sem tx externa chama prisma.$transaction(cb) -> aqui roda cb com um "tx" fake
        service.prisma = { $transaction: (cb) => cb('TX') };
    });

    it('recusa regime em rebanho de outro usuario', async () => {
        service.rebanhoRepository = { findById: vi.fn().mockResolvedValue(null) };
        await expect(service.create(base, req('invasor')))
            .rejects.toMatchObject({ errorType: 'resourceNotFound', statusCode: 404 });
    });

    it('recusa insumo cujo destino nao serve ao rebanho', async () => {
        service.rebanhoRepository = { findById: vi.fn().mockResolvedValue({ id: 'r1', propriedadeId: 'p1' }) };
        service.insumoRepository = { findById: vi.fn().mockResolvedValue({ id: 'i1', propriedadeId: 'p1', destino: 'Pasto' }) };
        await expect(service.create(base, req()))
            .rejects.toMatchObject({ errorType: 'validationError', field: 'insumoId' });
    });

    it('recusa insumo de outra propriedade', async () => {
        service.rebanhoRepository = { findById: vi.fn().mockResolvedValue({ id: 'r1', propriedadeId: 'p1' }) };
        service.insumoRepository = { findById: vi.fn().mockResolvedValue({ id: 'i1', propriedadeId: 'p2', destino: 'Rebanho' }) };
        await expect(service.create(base, req()))
            .rejects.toMatchObject({ errorType: 'validationError', field: 'insumoId' });
    });

    it('encerra o regime em aberto do par antes de criar o novo', async () => {
        service.rebanhoRepository = { findById: vi.fn().mockResolvedValue({ id: 'r1', propriedadeId: 'p1' }) };
        service.insumoRepository = { findById: vi.fn().mockResolvedValue({ id: 'i1', propriedadeId: 'p1', destino: 'Ambos' }) };
        const update = vi.fn().mockResolvedValue({});
        const create = vi.fn().mockResolvedValue({ id: 'novo' });
        service.repository = {
            findAbertoDoPar: vi.fn().mockResolvedValue({ id: 'antigo' }),
            update, create,
        };

        await service.create({ ...base, id: 'novo' }, req());

        expect(update).toHaveBeenCalledWith('antigo', expect.objectContaining({ ativo: false, dataFim: base.dataInicio }), 'TX');
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: 'novo' }), 'TX');
    });
});
