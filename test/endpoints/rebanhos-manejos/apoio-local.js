import DbConnect from '../../../src/config/dbConnect.js';

const { prisma } = DbConnect;

export async function criarManejoRebanho(rebanhoId, tipoManejoId, dados = {}) {
    return prisma.manejoRebanho.create({
        data: {
            rebanhoId,
            tipoManejoId,
            dataAtividade: new Date(),
            ...dados,
        },
    });
}
