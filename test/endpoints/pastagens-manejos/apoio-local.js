// Fábrica local à suíte de /pastagens/manejos — grava manejos de pasto direto
// via Prisma para controlar `dataAtividade`/`ativo` em pré-condições que o
// endpoint POST não cobre (ex.: manejo já excluído, manejo com data antiga
// para testar paginação/ordenação). Não editar test/apoio/* (outros agentes
// rodam em paralelo); o controller de tasks consolida depois.
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
