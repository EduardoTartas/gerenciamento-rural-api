import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('InsumoService', () => {
    let service;
    const req = (usuarioId = 'dono') => ({ user: { id: usuarioId }, params: {}, query: {} });

    beforeEach(async () => {
        vi.doMock('../../src/config/dbConnect.js', () => ({ default: { prisma: {} } }));
        vi.resetModules();
        const { default: InsumoService } = await import('../../src/service/InsumoService.js');
        service = new InsumoService();
    });

    it('recusa criar insumo em propriedade de outro usuario', async () => {
        service.propriedadeRepository = { findById: vi.fn().mockResolvedValue(null) };

        await expect(
            service.create({ propriedadeId: 'p1', tipoInsumoId: 't1', nome: 'Ração', destino: 'Rebanho', unidadeMedida: 'kg' }, req('invasor')),
        ).rejects.toMatchObject({ errorType: 'resourceNotFound', statusCode: 404 });
    });

    it('recusa tipoInsumo inexistente ou inativo', async () => {
        service.propriedadeRepository = { findById: vi.fn().mockResolvedValue({ id: 'p1', ativo: true }) };
        service.repository = { findByNome: vi.fn().mockResolvedValue(null) };
        service.prisma = { tipoInsumo: { findFirst: vi.fn().mockResolvedValue(null) } };

        await expect(
            service.create({ propriedadeId: 'p1', tipoInsumoId: 'x', nome: 'Ração', destino: 'Rebanho', unidadeMedida: 'kg' }, req()),
        ).rejects.toMatchObject({ errorType: 'resourceNotFound', field: 'tipoInsumoId' });
    });

    it('recusa nome de insumo repetido na mesma propriedade', async () => {
        service.propriedadeRepository = { findById: vi.fn().mockResolvedValue({ id: 'p1', ativo: true }) };
        service.prisma = { tipoInsumo: { findFirst: vi.fn().mockResolvedValue({ id: 't1' }) } };
        service.repository = { findByNome: vi.fn().mockResolvedValue({ id: 'outro' }) };

        await expect(
            service.create({ propriedadeId: 'p1', tipoInsumoId: 't1', nome: 'Ração', destino: 'Rebanho', unidadeMedida: 'kg' }, req()),
        ).rejects.toMatchObject({ errorType: 'conflict', field: 'nome' });

        // multi-tenancy: findByNome recebe o usuarioId como primeiro argumento
        expect(service.repository.findByNome).toHaveBeenCalledWith('dono', 'p1', 'Ração', null);
    });

    it('preserva o id recebido ao criar (offline-first)', async () => {
        service.propriedadeRepository = { findById: vi.fn().mockResolvedValue({ id: 'p1', ativo: true }) };
        service.prisma = { tipoInsumo: { findFirst: vi.fn().mockResolvedValue({ id: 't1' }) } };
        const create = vi.fn().mockResolvedValue({ id: 'uuid-do-cliente' });
        service.repository = { findByNome: vi.fn().mockResolvedValue(null), create };

        await service.create(
            { id: 'uuid-do-cliente', propriedadeId: 'p1', tipoInsumoId: 't1', nome: 'Ração', destino: 'Rebanho', unidadeMedida: 'kg' },
            req(),
        );
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: 'uuid-do-cliente' }), undefined);
    });

    it('projeta consumo de regime encerrado, mas conta só o aberto no consumoDiaTotal', () => {
        const insumoBase = (regimes) => ({
            id: 'i1', estoqueMinimo: null,
            movimentacoes: [{ tipo: 'Entrada', quantidade: 500, origem: 'Compra', data: new Date('2026-08-01T00:00:00Z') }],
            regimesConsumo: regimes,
        });
        const regimeFechado = {
            quantidadeDia: 2, ativo: false,
            dataInicio: new Date('2026-08-01T00:00:00Z'), dataFim: new Date('2026-08-11T00:00:00Z'),
        };
        const regimeAberto = {
            quantidadeDia: 3, ativo: true,
            dataInicio: new Date('2026-08-01T00:00:00Z'), dataFim: null,
        };

        const comAmbos = service.comSaldo(insumoBase([regimeFechado, regimeAberto]));
        const soAberto = service.comSaldo(insumoBase([regimeAberto]));

        // o regime encerrado contribui com seus 10 dias * 2/dia = 20 para a projeção
        expect(comAmbos.saldo.consumoProjetado - soAberto.saldo.consumoProjetado).toBe(20);
        // mas não entra na taxa diária: só o regime aberto (3/dia)
        expect(comAmbos.saldo.consumoDiaTotal).toBe(3);
    });

    it('recusa reativar insumo cujo nome ja foi reutilizado por outro ativo', async () => {
        service.repository = {
            findById: vi.fn().mockResolvedValue({ id: 'i1', ativo: false, nome: 'Ração', propriedadeId: 'p1' }),
            findByNome: vi.fn().mockResolvedValue({ id: 'outro' }),
        };

        await expect(
            service.update('i1', { ativo: true }, req()),
        ).rejects.toMatchObject({ errorType: 'conflict', field: 'nome' });

        expect(service.repository.findByNome).toHaveBeenCalledWith('dono', 'p1', 'Ração', 'i1');
    });

    it('enriquece a leitura por id com o pacote de saldo', async () => {
        service.repository = {
            findById: vi.fn().mockResolvedValue({
                id: 'i1', estoqueMinimo: null,
                movimentacoes: [{ tipo: 'Entrada', quantidade: 100, origem: 'Compra', data: new Date('2026-08-01T00:00:00Z') }],
                regimesConsumo: [],
            }),
        };
        const out = await service.list({ ...req(), params: { id: 'i1' } });
        expect(out.saldo.saldoReal).toBe(100);
        expect(out.saldo.saldoProjetado).toBe(100);
    });
});
