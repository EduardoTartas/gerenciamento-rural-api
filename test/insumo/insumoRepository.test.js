import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('InsumoRepository.anexarResumoLedger', () => {
    let repository;

    beforeEach(async () => {
        vi.doMock('../../src/config/dbConnect.js', () => ({ default: { prisma: {} } }));
        vi.resetModules();
        const { default: InsumoRepository } = await import('../../src/repository/InsumoRepository.js');
        repository = new InsumoRepository();
    });

    it('dobra as duas agregações em _resumoLedger por insumo', async () => {
        const contagem = new Date('2026-08-25T00:00:00Z');
        repository.prisma = {
            movimentacaoInsumo: {
                groupBy: vi.fn()
                    .mockResolvedValueOnce([
                        { insumoId: 'i1', tipo: 'Entrada', _sum: { quantidade: 100 } },
                        { insumoId: 'i1', tipo: 'Saida', _sum: { quantidade: 30 } },
                        { insumoId: 'i1', tipo: 'Ajuste', _sum: { quantidade: -4 } },
                        { insumoId: 'i2', tipo: 'Entrada', _sum: { quantidade: 50 } },
                    ])
                    .mockResolvedValueOnce([
                        { insumoId: 'i1', _max: { data: contagem } },
                    ]),
            },
        };

        const docs = await repository.anexarResumoLedger([{ id: 'i1' }, { id: 'i2' }]);

        expect(docs[0]._resumoLedger).toEqual({ entrada: 100, saida: 30, ajuste: -4, ultimaContagem: contagem });
        expect(docs[1]._resumoLedger).toEqual({ entrada: 50, saida: 0, ajuste: 0, ultimaContagem: null });
    });

    it('escopa as agregações aos ids da página e só linhas ativas', async () => {
        const groupBy = vi.fn().mockResolvedValue([]);
        repository.prisma = { movimentacaoInsumo: { groupBy } };

        await repository.anexarResumoLedger([{ id: 'i1' }, { id: 'i2' }]);

        expect(groupBy).toHaveBeenNthCalledWith(1, expect.objectContaining({
            by: ['insumoId', 'tipo'],
            where: { insumoId: { in: ['i1', 'i2'] }, ativo: true },
            _sum: { quantidade: true },
        }));
        expect(groupBy).toHaveBeenNthCalledWith(2, expect.objectContaining({
            by: ['insumoId'],
            where: { insumoId: { in: ['i1', 'i2'] }, ativo: true, origem: 'AjusteContagem' },
            _max: { data: true },
        }));
    });

    it('página vazia não consulta o banco', async () => {
        const groupBy = vi.fn();
        repository.prisma = { movimentacaoInsumo: { groupBy } };

        const docs = await repository.anexarResumoLedger([]);

        expect(docs).toEqual([]);
        expect(groupBy).not.toHaveBeenCalled();
    });
});
