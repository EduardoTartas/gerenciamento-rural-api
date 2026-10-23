import DbConnect from '../../../src/config/dbConnect.js';

const { prisma } = DbConnect;

export async function criarMovimentacaoInsumo(insumoId, dados = {}) {
    return prisma.movimentacaoInsumo.create({
        data: {
            insumoId,
            tipo: 'Entrada',
            quantidade: 100,
            data: new Date(),
            origem: 'Compra',
            ...dados,
        },
    });
}
