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

    it('na listagem usa o _resumoLedger agregado pelo repository (sem ledger cru)', async () => {
        service.repository = {
            list: vi.fn().mockResolvedValue({
                docs: [{
                    id: 'i1', nome: 'Ração', estoqueMinimo: 30,
                    regimesConsumo: [
                        { quantidadeDia: 10, dataInicio: new Date('2026-08-01T00:00:00Z'), dataFim: null, ativo: true },
                    ],
                    _resumoLedger: { entrada: 100, saida: 25, ajuste: 5, ultimaContagem: null },
                }],
                totalDocs: 1, page: 1, limit: 10, totalPages: 1,
            }),
        };

        const q = { ...req(), _parsedQuery: { page: 1, limit: 10 } };
        const out = await service.list(q);

        const insumo = out.docs[0];
        // saldoReal vem das somas do resumo: 100 - 25 + 5
        expect(insumo.saldo.saldoReal).toBe(80);
        // regime ativo antigo => consumo projetado > 0 e relação mantida
        expect(insumo.saldo.consumoProjetado).toBeGreaterThan(0);
        expect(insumo.saldo.saldoProjetado).toBe(insumo.saldo.saldoReal - insumo.saldo.consumoProjetado);
        expect(insumo.saldo.consumoDiaTotal).toBe(10);
        // o resumo interno e os regimes crus não vazam na resposta
        expect(insumo).not.toHaveProperty('_resumoLedger');
        expect(insumo).not.toHaveProperty('regimesConsumo');
    });
});
