import { describe, expect, it, vi } from 'vitest';

import { comTransacao, ondeEscrever } from '../src/utils/helpers/transacao.js';

/**
 * Issue #34: o lote abria `prisma.$transaction` e passava `tx` ao despacho, mas
 * nenhum handler o recebia — a escrita de domínio ia pelo pool, autocommitada,
 * e só a lápide de idempotência ficava dentro da transação. Se a transação não
 * commitasse depois da escrita ter passado, o registro persistia sem lápide: no
 * reenvio a mutação era reaplicada, batia na chave primária, e o produtor
 * recebia `recusado` por algo que **foi** aplicado.
 *
 * Estes casos cobrem a corrente inteira — helper, repository, service e
 * despacho — sem precisar de banco.
 */
describe('transação do lote', () => {
    describe('helper', () => {
        it('reaproveita a transação recebida em vez de abrir outra', async () => {
            const prisma = { $transaction: vi.fn() };
            const tx = { marca: 'a-de-fora' };

            const recebido = await comTransacao(prisma, tx, async (t) => t);

            expect(recebido).toBe(tx);
            expect(prisma.$transaction).not.toHaveBeenCalled();
        });

        it('abre uma quando não há nenhuma — o caminho do REST', async () => {
            const propria = { marca: 'aberta-aqui' };
            const prisma = { $transaction: vi.fn(async (cb) => cb(propria)) };

            const recebido = await comTransacao(prisma, undefined, async (t) => t);

            expect(recebido).toBe(propria);
            expect(prisma.$transaction).toHaveBeenCalledOnce();
        });

        it('escreve pelo executor recebido, ou pelo pool quando não há', () => {
            const prisma = { marca: 'pool' };
            const tx = { marca: 'transacao' };

            expect(ondeEscrever(tx, prisma)).toBe(tx);
            expect(ondeEscrever(undefined, prisma)).toBe(prisma);
        });
    });

    describe('repository', () => {
        it('grava pela transação recebida, não pelo pool', async () => {
            vi.resetModules();
            const doPool = vi.fn();
            vi.doMock('../src/config/dbConnect.js', () => ({
                default: { prisma: { propriedade: { create: doPool } } },
            }));

            const { default: PropriedadeRepository } = await import(
                '../src/repository/PropriedadeRepository.js'
            );
            const daTransacao = vi.fn().mockResolvedValue({ id: 'p1' });
            const tx = { propriedade: { create: daTransacao } };

            await new PropriedadeRepository().create({ nome: 'Fazenda' }, tx);

            expect(daTransacao).toHaveBeenCalledOnce();
            expect(doPool).not.toHaveBeenCalled();
        });

        it('sem transação, grava pelo pool — o caminho do REST', async () => {
            vi.resetModules();
            const doPool = vi.fn().mockResolvedValue({ id: 'p1' });
            vi.doMock('../src/config/dbConnect.js', () => ({
                default: { prisma: { propriedade: { create: doPool } } },
            }));

            const { default: PropriedadeRepository } = await import(
                '../src/repository/PropriedadeRepository.js'
            );
            await new PropriedadeRepository().create({ nome: 'Fazenda' });

            expect(doPool).toHaveBeenCalledOnce();
        });
    });

    describe('despacho', () => {
        it('entrega a mesma transação ao service de domínio', async () => {
            vi.resetModules();
            const create = vi.fn().mockResolvedValue({ id: 'p1' });
            // O despacho instancia os services no import; mockar a classe é o
            // que permite observar o que ela recebe.
            vi.doMock('../src/service/PropriedadeService.js', () => ({
                default: class {
                    create = create;
                },
            }));

            const { DESPACHO } = await import('../src/service/sync/despacho.js');
            const tx = { marca: 'a-do-lote' };
            const req = { user: { id: 'u1' } };

            await DESPACHO['propriedades:CREATE']({
                entidadeId: 'p1',
                dados: { nome: 'Fazenda' },
                req,
                tx,
            });

            // O terceiro argumento é o `tx`: sem ele, a escrita sairia pelo pool
            // e ficaria fora da transação que registra a lápide.
            expect(create).toHaveBeenCalledWith(
                { nome: 'Fazenda', id: 'p1' },
                req,
                tx,
            );
        });
    });
});
