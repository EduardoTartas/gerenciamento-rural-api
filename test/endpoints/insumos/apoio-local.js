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

export async function criarRegimeConsumoInsumo(rebanhoId, insumoId, dados = {}) {
    return prisma.regimeConsumoInsumo.create({
        data: {
            rebanhoId,
            insumoId,
            quantidadeDia: 10,
            dataInicio: new Date(),
            ...dados,
        },
    });
}
