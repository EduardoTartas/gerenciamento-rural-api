import { describe, expect, it, vi } from 'vitest';

/**
 * O aplicativo reenvia o lote quando a resposta se perde — cenário comum em
 * sinal ruim, que é o caso de uso central do sistema. Sem isto, a movimentação
 * seria aplicada duas vezes.
 */
describe('registro de mutações aplicadas', () => {
    async function montar() {
        const findMany = vi.fn().mockResolvedValue([
            { id: 'm1', resultado: { situacao: 'aceito' } },
        ]);
        const deleteMany = vi.fn().mockResolvedValue({ count: 3 });

        vi.doMock('../src/config/dbConnect.js', () => ({
            default: { prisma: { mutacaoAplicada: { findMany, deleteMany } } },
        }));

        vi.resetModules();
        const { default: MutacaoAplicadaRepository } = await import(
            '../src/repository/MutacaoAplicadaRepository.js'
        );
        return { repo: new MutacaoAplicadaRepository(), findMany, deleteMany };
    }

    it('devolve as já aplicadas indexadas por id', async () => {
        const { repo } = await montar();
        const mapa = await repo.buscarPorIds(['m1', 'm2']);
        expect(mapa.get('m1')).toEqual({ situacao: 'aceito' });
        expect(mapa.has('m2')).toBe(false);
    });

    it('lista vazia não consulta o banco', async () => {
        const { repo, findMany } = await montar();
        const mapa = await repo.buscarPorIds([]);
        expect(mapa.size).toBe(0);
        expect(findMany).not.toHaveBeenCalled();
    });

    it('registra dentro da transação recebida', async () => {
        const { repo } = await montar();
        const create = vi.fn().mockResolvedValue({});
        const tx = { mutacaoAplicada: { create } };

        await repo.registrar(tx, {
            id: 'm9',
            usuarioId: 'u1',
            entidade: 'pastos',
            entidadeId: 'p1',
            resultado: { situacao: 'aceito' },
        });

        // Gravar na mesma transação da mutação é o que torna a garantia real:
        // ou os dois entram, ou nenhum.
        expect(create).toHaveBeenCalledWith({
            data: {
                id: 'm9',
                usuarioId: 'u1',
                entidade: 'pastos',
                entidadeId: 'p1',
                resultado: { situacao: 'aceito' },
            },
        });
    });

    it('limpa o que passou da janela de retenção', async () => {
        const { repo, deleteMany } = await montar();
        const removidas = await repo.limparAntigas('u1', 30);

        expect(removidas).toBe(3);
        const { where } = deleteMany.mock.calls[0][0];
        expect(where.usuarioId).toBe('u1');
        expect(where.aplicadaEm.lt).toBeInstanceOf(Date);
    });
});
