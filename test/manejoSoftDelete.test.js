import { describe, expect, it, vi } from 'vitest';

/**
 * O manejo excluído sumia do banco. O aplicativo nunca ficava sabendo e mantinha
 * o registro para sempre — o produtor via no histórico um lançamento que não
 * existe mais.
 */
describe('exclusão de manejo deixa rastro', () => {
    async function montarRepositorio(caminho, tabela) {
        const update = vi.fn().mockResolvedValue({ id: 'm1', ativo: false });
        const deleteFn = vi.fn();

        vi.doMock('../src/config/dbConnect.js', () => ({
            default: { prisma: { [tabela]: { update, delete: deleteFn } } },
        }));

        vi.resetModules();
        const { default: Repositorio } = await import(caminho);
        return { repo: new Repositorio(), update, deleteFn };
    }

    it('manejo de pasto é marcado como inativo, não apagado', async () => {
        const { repo, update, deleteFn } = await montarRepositorio(
            '../src/repository/ManejoPastoRepository.js',
            'manejoPasto',
        );

        await repo.remove('m1');

        expect(deleteFn).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledWith({
            where: { id: 'm1' },
            data: { ativo: false },
        });
    });

    it('manejo de rebanho é marcado como inativo, não apagado', async () => {
        const { repo, update, deleteFn } = await montarRepositorio(
            '../src/repository/ManejoRebanhoRepository.js',
            'manejoRebanho',
        );

        await repo.remove('m1');

        expect(deleteFn).not.toHaveBeenCalled();
        expect(update).toHaveBeenCalledWith({
            where: { id: 'm1' },
            data: { ativo: false },
        });
    });
});
