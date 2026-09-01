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

    it('list sem insumoId e sem atualizadoDesde retorna 400', async () => {
        await expect(
            service.list({ ...req(), _parsedQuery: {} }),
        ).rejects.toMatchObject({ errorType: 'validationError', field: 'insumoId', statusCode: 400 });
    });

    it('list com atualizadoDesde e sem insumoId faz leitura por diferenca sem validar insumo', async () => {
        const ensureInsumo = vi.fn();
        service.ensureInsumoDoUsuario = ensureInsumo;
        const list = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 });
        service.repository = { list };
        const marca = new Date('2026-08-25T00:00:00.000Z');

        await service.list({ ...req(), _parsedQuery: { atualizadoDesde: marca } });

        expect(ensureInsumo).not.toHaveBeenCalled();
        const [usuarioId, filters] = list.mock.calls[0];
        expect(usuarioId).toBe('dono');
        expect(filters).not.toHaveProperty('insumoId');
        expect(filters.atualizadoDesde).toBe(marca);
    });

    it('list com atualizadoDesde aceita propriedadeId como filtro', async () => {
        const list = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 });
        service.repository = { list };

        await service.list({ ...req(), _parsedQuery: { atualizadoDesde: new Date(), propriedadeId: 'p1' } });

        expect(list.mock.calls[0][1]).toMatchObject({ propriedadeId: 'p1' });
    });

    it('recusa rebanhoId de outro usuario', async () => {
        service.insumoRepository = { findById: vi.fn().mockResolvedValue({ id: 'i1', propriedadeId: 'p1' }) };
        service.rebanhoRepository = { findById: vi.fn().mockResolvedValue(null) };
        await expect(
            service.create(
                { insumoId: 'i1', tipo: 'Saida', quantidade: 5, data: new Date(), origem: 'ConsumoRebanho', rebanhoId: 'r-alheio' },
                req(),
            ),
        ).rejects.toMatchObject({ errorType: 'validationError', statusCode: 400, field: 'rebanhoId' });
    });

    it('recusa pastoId de outra propriedade', async () => {
        service.insumoRepository = { findById: vi.fn().mockResolvedValue({ id: 'i1', propriedadeId: 'p1' }) };
        service.pastoRepository = { findById: vi.fn().mockResolvedValue({ id: 'past1', propriedadeId: 'p2' }) };
        await expect(
            service.create(
                { insumoId: 'i1', tipo: 'Saida', quantidade: 5, data: new Date(), origem: 'Perda', pastoId: 'past1' },
                req(),
            ),
        ).rejects.toMatchObject({ errorType: 'validationError', statusCode: 400, field: 'pastoId' });
    });

    it('cria com rebanhoId da mesma propriedade', async () => {
        service.insumoRepository = { findById: vi.fn().mockResolvedValue({ id: 'i1', propriedadeId: 'p1' }) };
        service.rebanhoRepository = { findById: vi.fn().mockResolvedValue({ id: 'r1', propriedadeId: 'p1' }) };
        const create = vi.fn().mockResolvedValue({ id: 'mov1' });
        service.repository = { create };
        await service.create(
            { insumoId: 'i1', tipo: 'Saida', quantidade: 5, data: new Date(), origem: 'ConsumoRebanho', rebanhoId: 'r1' },
            req(),
        );
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ rebanhoId: 'r1' }), undefined);
    });
});
