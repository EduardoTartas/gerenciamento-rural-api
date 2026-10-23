import DbConnect from '../../../src/config/dbConnect.js';

const { prisma } = DbConnect;

export async function criarManejoPasto(pastoId, tipoManejoId, dados = {}) {
    return prisma.manejoPasto.create({
        data: {
            pastoId,
            tipoManejoId,
            dataAtividade: new Date(),
            ...dados,
        },
    });
}
