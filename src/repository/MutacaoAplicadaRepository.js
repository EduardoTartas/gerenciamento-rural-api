
import DbConnect from '../config/dbConnect.js';

class MutacaoAplicadaRepository {
    constructor() {
        this.prisma = DbConnect.prisma;
    }

    async buscarPorIds(usuarioId, ids) {
        if (ids.length === 0) return new Map();

        const registros = await this.prisma.mutacaoAplicada.findMany({
            where: { id: { in: ids }, usuarioId },
            select: { id: true, resultado: true },
        });
        return new Map(registros.map((r) => [r.id, r.resultado]));
    }

    async registrar(tx, { id, usuarioId, entidade, entidadeId, resultado }) {
        await tx.mutacaoAplicada.create({
            data: { id, usuarioId, entidade, entidadeId, resultado },
        });
    }

    async limparAntigas(usuarioId, dias) {
        const limite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
        const { count } = await this.prisma.mutacaoAplicada.deleteMany({
            where: { usuarioId, aplicadaEm: { lt: limite } },
        });
        return count;
    }
}

export default MutacaoAplicadaRepository;
