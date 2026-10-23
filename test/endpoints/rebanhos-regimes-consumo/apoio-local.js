import DbConnect from '../../../src/config/dbConnect.js';

const { prisma } = DbConnect;

export async function criarRegimeConsumo(rebanhoId, insumoId, dados = {}) {
    return prisma.regimeConsumoInsumo.create({
        data: {
            rebanhoId,
            insumoId,
            quantidadeDia: 5,
            dataInicio: new Date('2026-01-01T00:00:00.000Z'),
            ...dados,
        },
    });
}
