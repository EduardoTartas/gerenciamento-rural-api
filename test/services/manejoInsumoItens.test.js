import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ManejoPastoService — itens de insumo', () => {
    let service;
    const req = (usuarioId = 'dono') => ({ user: { id: usuarioId }, params: {}, query: {} });

    beforeEach(async () => {
        vi.doMock('../../src/config/dbConnect.js', () => ({ default: { prisma: { $transaction: (cb) => cb('TX') } } }));
        vi.resetModules();
        const { default: ManejoPastoService } = await import('../../src/service/ManejoPastoService.js');
        service = new ManejoPastoService();
        service.prisma = { $transaction: (cb) => cb('TX') };
    });

    const pasto = { id: 'past1', ativo: true, propriedadeId: 'p1' };

    function armaHappyPath({ destino = 'Pasto', saldoMovs = [{ tipo: 'Entrada', quantidade: 100 }] } = {}) {
        service.pastoRepository = { findById: vi.fn().mockResolvedValue(pasto) };
        service.ensureTipoManejoExists = vi.fn().mockResolvedValue({ id: 'tm1' });
        service.repository = { create: vi.fn().mockResolvedValue({ id: 'manejo1' }) };
        service.insumoRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'i1', propriedadeId: 'p1', destino,
                movimentacoes: saldoMovs.map((m) => ({ ...m, origem: 'Compra', data: new Date('2026-08-01T00:00:00Z') })),
                regimesConsumo: [] }),
        };
        service.movimentacaoInsumoRepository = { create: vi.fn().mockResolvedValue({ id: 'mov1' }) };
    }

    it('cria uma movimentacao Saida por item, na transacao', async () => {
        armaHappyPath();
        await service.create({
            pastoId: 'past1', tipoManejoId: 'tm1', dataAtividade: new Date('2026-08-27T00:00:00Z'),
            itens: [{ insumoId: 'i1', quantidade: 5 }],
        }, req());

        expect(service.movimentacaoInsumoRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({
                insumoId: 'i1', tipo: 'Saida', quantidade: 5,
                origem: 'ManejoPasto', manejoPastoId: 'manejo1', pastoId: 'past1',
            }),
            'TX',
        );
    });

    it('recusa item com insumo de destino incompativel', async () => {
        armaHappyPath({ destino: 'Rebanho' });
        await expect(service.create({
            pastoId: 'past1', tipoManejoId: 'tm1', dataAtividade: new Date('2026-08-27T00:00:00Z'),
            itens: [{ insumoId: 'i1', quantidade: 5 }],
        }, req())).rejects.toMatchObject({ errorType: 'validationError', field: 'itens' });
    });

    it('estoque insuficiente gera aviso, nao erro', async () => {
        armaHappyPath({ saldoMovs: [{ tipo: 'Entrada', quantidade: 2 }] });
        const out = await service.create({
            pastoId: 'past1', tipoManejoId: 'tm1', dataAtividade: new Date('2026-08-27T00:00:00Z'),
            itens: [{ insumoId: 'i1', quantidade: 5 }],
        }, req());
        expect(out.avisos.length).toBe(1);
        expect(service.movimentacaoInsumoRepository.create).toHaveBeenCalled();
    });

    it('sem itens, comportamento inalterado', async () => {
        armaHappyPath();
        await service.create({
            pastoId: 'past1', tipoManejoId: 'tm1', dataAtividade: new Date('2026-08-27T00:00:00Z'),
        }, req());
        expect(service.movimentacaoInsumoRepository.create).not.toHaveBeenCalled();
    });

    it('excluir o manejo desativa as movimentacoes de insumo vinculadas', async () => {
        service.repository = {
            findById: vi.fn().mockResolvedValue({ id: 'manejo1' }),
            remove: vi.fn().mockResolvedValue({ id: 'manejo1', ativo: false }),
        };
        service.movimentacaoInsumoRepository = { desativarPorManejo: vi.fn().mockResolvedValue({ count: 2 }) };

        await service.remove('manejo1', req());

        expect(service.repository.remove).toHaveBeenCalledWith('manejo1', 'TX');
        expect(service.movimentacaoInsumoRepository.desativarPorManejo)
            .toHaveBeenCalledWith('manejoPastoId', 'manejo1', 'TX');
    });
});

describe('ManejoRebanhoService — itens de insumo', () => {
    let service;
    const req = (usuarioId = 'dono') => ({ user: { id: usuarioId }, params: {}, query: {} });

    beforeEach(async () => {
        vi.doMock('../../src/config/dbConnect.js', () => ({ default: { prisma: { $transaction: (cb) => cb('TX') } } }));
        vi.resetModules();
        const { default: ManejoRebanhoService } = await import('../../src/service/ManejoRebanhoService.js');
        service = new ManejoRebanhoService();
        service.prisma = { $transaction: (cb) => cb('TX') };
    });

    const rebanho = { id: 'reb1', ativo: true, propriedadeId: 'p1' };

    function armaHappyPath({ destino = 'Rebanho', saldoMovs = [{ tipo: 'Entrada', quantidade: 100 }] } = {}) {
        service.rebanhoRepository = { findById: vi.fn().mockResolvedValue(rebanho) };
        service.ensureTipoManejoExists = vi.fn().mockResolvedValue({ id: 'tm1' });
        service.repository = { createComAtualizacaoPeso: vi.fn().mockResolvedValue({ id: 'manejo1' }) };
        service.insumoRepository = {
            findById: vi.fn().mockResolvedValue({ id: 'i1', propriedadeId: 'p1', destino,
                movimentacoes: saldoMovs.map((m) => ({ ...m, origem: 'Compra', data: new Date('2026-08-01T00:00:00Z') })),
                regimesConsumo: [] }),
        };
        service.movimentacaoInsumoRepository = { create: vi.fn().mockResolvedValue({ id: 'mov1' }) };
    }

    it('cria uma movimentacao Saida por item, na transacao, e cria o manejo com createComAtualizacaoPeso', async () => {
        armaHappyPath();
        await service.create({
            rebanhoId: 'reb1', tipoManejoId: 'tm1', dataAtividade: new Date('2026-08-27T00:00:00Z'),
            itens: [{ insumoId: 'i1', quantidade: 5 }],
        }, req());

        expect(service.repository.createComAtualizacaoPeso).toHaveBeenCalledWith(
            expect.objectContaining({ rebanhoId: 'reb1' }), 'TX',
        );
        expect(service.movimentacaoInsumoRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({
                insumoId: 'i1', tipo: 'Saida', quantidade: 5,
                origem: 'ManejoRebanho', manejoRebanhoId: 'manejo1', rebanhoId: 'reb1',
            }),
            'TX',
        );
    });

    it('recusa item com insumo de destino incompativel', async () => {
        armaHappyPath({ destino: 'Pasto' });
        await expect(service.create({
            rebanhoId: 'reb1', tipoManejoId: 'tm1', dataAtividade: new Date('2026-08-27T00:00:00Z'),
            itens: [{ insumoId: 'i1', quantidade: 5 }],
        }, req())).rejects.toMatchObject({ errorType: 'validationError', field: 'itens' });
    });

    it('estoque insuficiente gera aviso, nao erro', async () => {
        armaHappyPath({ saldoMovs: [{ tipo: 'Entrada', quantidade: 2 }] });
        const out = await service.create({
            rebanhoId: 'reb1', tipoManejoId: 'tm1', dataAtividade: new Date('2026-08-27T00:00:00Z'),
            itens: [{ insumoId: 'i1', quantidade: 5 }],
        }, req());
        expect(out.avisos.length).toBe(1);
        expect(service.movimentacaoInsumoRepository.create).toHaveBeenCalled();
    });

    it('sem itens, createComAtualizacaoPeso ainda chamado e nenhuma movimentacao', async () => {
        armaHappyPath();
        await service.create({
            rebanhoId: 'reb1', tipoManejoId: 'tm1', dataAtividade: new Date('2026-08-27T00:00:00Z'),
        }, req());
        expect(service.repository.createComAtualizacaoPeso).toHaveBeenCalledWith(expect.any(Object), 'TX');
        expect(service.movimentacaoInsumoRepository.create).not.toHaveBeenCalled();
    });
});
