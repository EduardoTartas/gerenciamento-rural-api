// src/repository/MutacaoAplicadaRepository.js

import DbConnect from '../config/dbConnect.js';

/**
 * Idempotência do endpoint de lote.
 *
 * A chave é o id da **mutação**, não o da entidade: duas edições do mesmo pasto
 * são mutações distintas e ambas devem ser aplicadas. Confiar no id da entidade
 * cobriria `CREATE` e deixaria a movimentação ser aplicada duas vezes.
 */
class MutacaoAplicadaRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    /** Mapa `id -> resultado` das mutações que já foram aplicadas. */
    async buscarPorIds(ids) {
        if (ids.length === 0) return new Map();

        const registros = await this.prisma.mutacaoAplicada.findMany({
            where: { id: { in: ids } },
            select: { id: true, resultado: true },
        });
        return new Map(registros.map((r) => [r.id, r.resultado]));
    }

    /**
     * Grava o registro **dentro da transação da mutação**, recebida de fora.
     * É isso que impede o caso em que a mutação entra e o registro não.
     */
    async registrar(tx, { id, usuarioId, entidade, entidadeId, resultado }) {
        await tx.mutacaoAplicada.create({
            data: { id, usuarioId, entidade, entidadeId, resultado },
        });
    }

    /**
     * Remove o que passou da janela de retenção.
     *
     * Roda no próprio endpoint de lote: a tabela só cresce quando há
     * sincronização, então a limpeza acontece exatamente quando precisa, sem
     * agendador nem processo à parte.
     */
    async limparAntigas(usuarioId, dias) {
        const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
        const { count } = await this.prisma.mutacaoAplicada.deleteMany({
            where: { usuarioId, aplicadaEm: { lt: limite } },
        });
        return count;
    }
}

export default MutacaoAplicadaRepository;
