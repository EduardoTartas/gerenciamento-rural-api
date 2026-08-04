import { describe, expect, it, vi } from 'vitest';

/**
 * Movimentação não é cadastro: é evento que produziu efeito. Ao ser criada,
 * alterou `rebanho.pastoAtualId`, o `status` dos dois pastos e
 * `dataUltimaSaida`. Apagar a linha não desfaz nada disso.
 *
 * Desfazer uma do meio da cadeia deixaria o histórico incoerente — o lote
 * apareceria num pasto onde nunca entrou. Por isso só a última.
 */
describe('desfazer movimentação', () => {
    const ULTIMA = {
        id: 'mov3',
        rebanhoId: 'reb1',
        pastoOrigemId: 'pastoC',
        pastoDestinoId: 'pastoD',
        dataMovimentacao: new Date('2026-08-07T10:00:00.000Z'),
        ativo: true,
    };

    async function montarService({ ultima, alvo }) {
        const escritas = [];
        const tx = {
            historicoMovimentacao: {
                update: vi.fn(async (args) => {
                    escritas.push({ tabela: 'movimentacao', ...args });
                    return { ...alvo, ativo: false };
                }),
            },
            rebanho: {
                update: vi.fn(async (args) => {
                    escritas.push({ tabela: 'rebanho', ...args });
                    return {};
                }),
            },
            pasto: {
                update: vi.fn(async (args) => {
                    escritas.push({ tabela: 'pasto', ...args });
                    return {};
                }),
            },
            // Conta rebanhos ativos: nunca ler `pasto.status`, que é cache e já
            // esteve comprovadamente defasado.
            contarRebanhos: vi.fn(async () => 0),
        };
        tx.rebanho.count = tx.contarRebanhos;

        vi.doMock('../src/config/dbConnect.js', () => ({
            default: {
                prisma: {
                    $transaction: async (cb) => cb(tx),
                    historicoMovimentacao: {
                        findFirst: vi.fn().mockResolvedValue(ultima),
                        findUnique: vi.fn().mockResolvedValue(alvo),
                    },
                },
            },
        }));

        vi.resetModules();
        const { default: MovimentacaoService } = await import(
            '../src/service/MovimentacaoService.js'
        );
        const service = new MovimentacaoService();
        service.ensureMovimentacaoExists = vi.fn().mockResolvedValue(alvo);
        return { service, tx, escritas };
    }

    const req = { user: { id: 'u1' } };

    it('desfaz a última e devolve o lote ao pasto de origem', async () => {
        const { service, tx } = await montarService({ ultima: ULTIMA, alvo: ULTIMA });

        await service.remove('mov3', req);

        expect(tx.historicoMovimentacao.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'mov3' },
                data: expect.objectContaining({ ativo: false }),
            }),
        );
        expect(tx.rebanho.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'reb1' },
                data: expect.objectContaining({ pastoAtualId: 'pastoC' }),
            }),
        );
    });

    it('recusa desfazer uma do meio da cadeia', async () => {
        const doMeio = { ...ULTIMA, id: 'mov2', pastoDestinoId: 'pastoC' };
        const { service, tx } = await montarService({ ultima: ULTIMA, alvo: doMeio });

        await expect(service.remove('mov2', req)).rejects.toMatchObject({
            errorType: 'conflict',
            statusCode: 409,
        });
        expect(tx.historicoMovimentacao.update).not.toHaveBeenCalled();
    });

    it('conta rebanhos ativos em vez de ler o status do pasto', async () => {
        const { service, tx } = await montarService({ ultima: ULTIMA, alvo: ULTIMA });

        await service.remove('mov3', req);

        expect(tx.contarRebanhos).toHaveBeenCalled();
    });
});
